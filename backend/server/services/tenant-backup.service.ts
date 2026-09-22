import {
  createCipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "crypto";
import { execFile } from "child_process";
import { constants, createReadStream, createWriteStream } from "fs";
import { access, mkdtemp, rm, stat } from "fs/promises";
import https from "https";
import { tmpdir } from "os";
import path from "path";
import { pipeline } from "stream/promises";
import createError from "http-errors";
import { configs } from "../configs";
import { tenantLocalStorage } from "../configs/connectionManager";
import { TenantBackupConfigModel, TenantBackupJobModel } from "../models/tenant-backup.model";
import { InstitutionSettingModel } from "../models/institution-setting.model";
import { cryptoUtil } from "../utils/crypto.util";
import { isAllowedCorsOrigin } from "../utils/cors.util";
import { platformIntegrationService } from "./platform-integration.service";

type Frequency = "daily" | "weekly" | "monthly";
interface IOAuthState {
  tenantId: string;
  databaseName: string;
  returnUrl: string;
  expiresAt: number;
}

interface IGoogleDrivePlatformConfig extends Record<string, unknown> {
  clientId: string;
  callbackUrl: string;
}

async function googleDriveCredentials() {
  return platformIntegrationService.credentials<IGoogleDrivePlatformConfig>("google_drive");
}

function safeReturnUrl(value: string): string {
  const url = new URL(value);
  if (
    configs.NODE_ENV === "production" &&
    !isAllowedCorsOrigin(url.origin, configs.ALLOWED_ORIGINS)
  ) {
    throw createError(400, "Backup return URL is not an approved application origin.");
  }
  return url.toString();
}

function signState(payload: IOAuthState): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", configs.JWT_SECRET).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyBackupOAuthState(value: string): IOAuthState {
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) throw createError(400, "Invalid Google authorization state.");
  const expected = createHmac("sha256", configs.JWT_SECRET).update(encoded).digest("base64url");
  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    throw createError(400, "Invalid Google authorization state.");
  }
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as IOAuthState;
  if (payload.expiresAt < Date.now()) throw createError(400, "Google authorization has expired.");
  payload.returnUrl = safeReturnUrl(payload.returnUrl);
  return payload;
}

function nextRun(
  frequency: Frequency,
  hourUtc: number,
  dayOfWeek: number,
  dayOfMonth: number,
  from = new Date(),
): Date {
  const next = new Date(from);
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(hourUtc);
  if (frequency === "daily") {
    if (next <= from) next.setUTCDate(next.getUTCDate() + 1);
  } else if (frequency === "weekly") {
    const delta = (dayOfWeek - next.getUTCDay() + 7) % 7;
    next.setUTCDate(next.getUTCDate() + delta);
    if (next <= from) next.setUTCDate(next.getUTCDate() + 7);
  } else {
    next.setUTCDate(dayOfMonth);
    if (next <= from) next.setUTCMonth(next.getUTCMonth() + 1);
  }
  return next;
}

async function tokenRequest(params: URLSearchParams) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params,
    signal: AbortSignal.timeout(15_000),
  });
  const result = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    error_description?: string;
  };
  if (!response.ok || !result.access_token) {
    throw createError(502, result.error_description || "Google authorization failed.");
  }
  return result;
}

async function accessToken(encryptedRefreshToken: string): Promise<string> {
  const platform = await googleDriveCredentials();
  if (!platform) throw createError(503, "Google Drive backup is not ready.");
  const token = await tokenRequest(
    new URLSearchParams({
      client_id: platform.config.clientId,
      client_secret: platform.secret,
      refresh_token: cryptoUtil.decrypt(encryptedRefreshToken),
      grant_type: "refresh_token",
    }),
  );
  return token.access_token as string;
}

async function ensureFolder(token: string, configuredFolder?: string): Promise<string> {
  if (configuredFolder) return configuredFolder;
  const lookup = new URL("https://www.googleapis.com/drive/v3/files");
  lookup.searchParams.set("fields", "files(id,name)");
  lookup.searchParams.set(
    "q",
    "name = 'Devvelocity ERP Backups' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
  );
  const response = await fetch(lookup, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw createError(502, "Google Drive folder lookup failed.");
  const list = (await response.json()) as { files?: { id: string; name: string }[] };
  const existing = list.files?.find((item) => item.name === "Devvelocity ERP Backups");
  if (existing) return existing.id;
  const created = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      name: "Devvelocity ERP Backups",
      mimeType: "application/vnd.google-apps.folder",
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!created.ok) throw createError(502, "Google Drive backup folder creation failed.");
  return ((await created.json()) as { id: string }).id;
}

async function uploadFile(
  token: string,
  filePath: string,
  fileName: string,
  folderId: string,
): Promise<string> {
  const size = (await stat(filePath)).size;
  const session = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "x-upload-content-length": String(size),
        "x-upload-content-type": "application/octet-stream",
      },
      body: JSON.stringify({ name: fileName, parents: [folderId] }),
      signal: AbortSignal.timeout(15_000),
    },
  );
  const location = session.headers.get("location");
  if (!session.ok || !location) throw createError(502, "Google Drive upload could not start.");

  return new Promise((resolve, reject) => {
    const target = new URL(location);
    const request = https.request(
      target,
      {
        method: "PUT",
        headers: {
          authorization: `Bearer ${token}`,
          "content-length": size,
          "content-type": "application/octet-stream",
        },
        timeout: 10 * 60 * 1000,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          if ((response.statusCode ?? 500) >= 300) {
            reject(new Error(`Google Drive upload failed with HTTP ${response.statusCode}`));
            return;
          }
          resolve((JSON.parse(Buffer.concat(chunks).toString("utf8")) as { id: string }).id);
        });
      },
    );
    request.on("timeout", () => request.destroy(new Error("Google Drive upload timed out.")));
    request.on("error", reject);
    createReadStream(filePath).pipe(request);
  });
}

async function enforceRetention(token: string, retentionCount: number): Promise<void> {
  const expired = await TenantBackupJobModel.find({
    status: "completed",
    driveFileId: { $exists: true },
    retentionDeletedAt: { $exists: false },
  })
    .sort({ completedAt: -1 })
    .skip(retentionCount)
    .select("driveFileId")
    .lean();
  for (const backup of expired) {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(String(backup.driveFileId))}`,
      {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (response.ok || response.status === 404) {
      await TenantBackupJobModel.updateOne(
        { _id: backup._id },
        { $set: { retentionDeletedAt: new Date() }, $unset: { driveFileId: 1 } },
      );
    }
  }
}

async function execFileAsync(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    execFile(command, args, { timeout: 30 * 60 * 1000 }, (error) =>
      error ? reject(error) : resolve(),
    );
  });
}

async function updateProgress(
  jobId: string,
  progress: number,
  stage: "exporting" | "encrypting" | "verifying" | "authorizing" | "uploading" | "finalizing",
  progressMessage: string,
): Promise<void> {
  await TenantBackupJobModel.updateOne(
    { _id: jobId, status: "running" },
    { $set: { progress, stage, progressMessage } },
  );
  clearOverviewCache();
}

function secureBackupKey(): Buffer {
  if (/^[a-f0-9]{64}$/i.test(configs.ENCRYPTION_KEY)) {
    return Buffer.from(configs.ENCRYPTION_KEY, "hex");
  }
  if (configs.NODE_ENV === "production") {
    throw createError(503, "Secure backup encryption is not configured.");
  }
  return createHash("sha256").update("devvelocity-development-backup-key").digest();
}

function friendlyBackupFailure(error: unknown): { code: string; message: string } {
  const raw = error instanceof Error ? error.message : "Backup failed";
  if (/ENOENT|mongodump/i.test(raw)) {
    return {
      code: "EXPORT_TOOL_UNAVAILABLE",
      message: "The database export service is unavailable on the backup server.",
    };
  }
  if (/invalid_grant|refresh token|not connected/i.test(raw)) {
    return {
      code: "DRIVE_AUTH_EXPIRED",
      message: "Google Drive access expired. Reconnect the Drive account and try again.",
    };
  }
  if (/storageQuotaExceeded|quota|insufficient storage/i.test(raw)) {
    return {
      code: "DRIVE_STORAGE_FULL",
      message: "The connected Google Drive does not have enough available storage.",
    };
  }
  if (/permission|forbidden|HTTP 401|HTTP 403/i.test(raw)) {
    return {
      code: "DRIVE_PERMISSION_DENIED",
      message: "Google Drive refused the backup. Reconnect the account and verify its permissions.",
    };
  }
  if (/timed out|timeout/i.test(raw)) {
    return {
      code: "BACKUP_TIMEOUT",
      message: "The secure backup took too long. Check server and Drive connectivity, then retry.",
    };
  }
  return {
    code: "BACKUP_FAILED",
    message: raw.slice(0, 300),
  };
}

async function runBackup(jobId: string): Promise<void> {
  const store = tenantLocalStorage.getStore();
  if (!store) throw new Error("Tenant backup requires an active tenant context.");
  const config = await TenantBackupConfigModel.findOne().select("+encryptedRefreshToken").exec();
  if (!config?.encryptedRefreshToken) throw new Error("Google Drive is not connected.");
  const job = await TenantBackupJobModel.findOneAndUpdate(
    { _id: jobId, status: "queued" },
    {
      $set: {
        status: "running",
        progress: 5,
        stage: "exporting",
        progressMessage: "Preparing the tenant database export",
        startedAt: new Date(),
      },
    },
    { returnDocument: "after" },
  ).exec();
  if (!job) return;

  const tempDir = await mkdtemp(path.join(tmpdir(), "erp-backup-"));
  const archive = path.join(tempDir, "tenant.archive.gz");
  const encrypted = path.join(tempDir, "tenant.archive.gz.enc");
  try {
    await updateProgress(
      String(job._id),
      10,
      "exporting",
      "Exporting the tenant database into a private workspace",
    );
    await execFileAsync(configs.MONGODUMP_PATH, [
      `--uri=${configs.MONGODB_URI}`,
      `--db=${store.tenantDb.name}`,
      `--archive=${archive}`,
      "--gzip",
    ]);
    await updateProgress(String(job._id), 35, "encrypting", "Encrypting the database archive");
    const iv = randomBytes(12);
    const backupKey = secureBackupKey();
    const cipher = createCipheriv("aes-256-gcm", backupKey, iv);
    const output = createWriteStream(encrypted);
    output.write(Buffer.from("DVERP01"));
    output.write(iv);
    await pipeline(createReadStream(archive), cipher, output, { end: false });
    output.end(cipher.getAuthTag());
    await new Promise<void>((resolve, reject) => {
      output.on("close", resolve);
      output.on("error", reject);
    });
    await updateProgress(
      String(job._id),
      55,
      "verifying",
      "Calculating archive integrity checksum",
    );
    const bytes = await stat(encrypted);
    const checksum = await new Promise<string>((resolve, reject) => {
      const hash = createHash("sha256");
      createReadStream(encrypted)
        .on("data", (chunk) => hash.update(chunk))
        .on("end", () => resolve(hash.digest("hex")))
        .on("error", reject);
    });
    await updateProgress(
      String(job._id),
      65,
      "authorizing",
      "Opening the institution-owned Drive securely",
    );
    const token = await accessToken(config.encryptedRefreshToken);
    const folderId = await ensureFolder(token, config.driveFolderId);
    if (!config.driveFolderId) {
      config.driveFolderId = folderId;
      await config.save();
    }
    await updateProgress(
      String(job._id),
      75,
      "uploading",
      "Uploading the encrypted archive to Google Drive",
    );
    const fileName = `${store.tenantId}-${new Date().toISOString().replace(/:/g, "-")}.archive.gz.enc`;
    const driveFileId = await uploadFile(token, encrypted, fileName, folderId);
    await updateProgress(
      String(job._id),
      95,
      "finalizing",
      "Verifying the recovery point and applying retention",
    );
    await TenantBackupJobModel.updateOne(
      { _id: job._id },
      {
        $set: {
          status: "completed",
          progress: 100,
          stage: "completed",
          progressMessage: "Secure recovery point created",
          driveFileId,
          driveFileName: fileName,
          byteSize: bytes.size,
          checksum,
          completedAt: new Date(),
        },
      },
    );
    await TenantBackupConfigModel.updateOne(
      { _id: config._id },
      { $set: { lastRunAt: new Date(), lastStatus: "completed" }, $unset: { lastError: 1 } },
    );
    await enforceRetention(token, config.retentionCount).catch(() => undefined);
  } catch (error) {
    const failure = friendlyBackupFailure(error);
    await Promise.all([
      TenantBackupJobModel.updateOne(
        { _id: job._id },
        {
          $set: {
            status: "failed",
            stage: "failed",
            progressMessage: failure.message,
            failureCode: failure.code,
            error: failure.message,
            completedAt: new Date(),
          },
        },
      ),
      TenantBackupConfigModel.updateOne(
        { _id: config._id },
        {
          $set: {
            lastRunAt: new Date(),
            lastStatus: "failed",
            lastError: failure.message,
          },
        },
      ),
    ]);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

interface ICacheEntry<T> {
  data: T;
  expiresAt: number;
}
const overviewCache = new Map<string, ICacheEntry<unknown>>();

export function clearOverviewCache(tenantId?: string) {
  if (tenantId) overviewCache.delete(tenantId);
  else overviewCache.clear();
}

export const tenantBackupService = {
  async overview() {
    const store = tenantLocalStorage.getStore();
    const tenantKey = store?.tenantId || "default";
    const now = Date.now();
    const cached = overviewCache.get(tenantKey);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    const [config, jobs, platform, institution, databaseStats] = await Promise.all([
      TenantBackupConfigModel.findOne().select("-encryptedRefreshToken").lean(),
      TenantBackupJobModel.find().sort({ createdAt: -1 }).limit(30).lean(),
      googleDriveCredentials(),
      InstitutionSettingModel.findOne().select("name").lean(),
      store?.tenantDb.db
        ? store.tenantDb.db
            .command({ dbStats: 1, scale: 1 })
            .catch(() => ({ dataSize: 0, storageSize: 0, collections: 0 }))
        : Promise.resolve({ dataSize: 0, storageSize: 0, collections: 0 }),
    ]);
    const activeJob = jobs.find((job) => ["queued", "running"].includes(job.status));
    const result = {
      providerConfigured: Boolean(platform),
      tenant: {
        tenantId: store?.tenantId ?? "",
        institutionName: institution?.name ?? "Institution",
        databaseName: store?.tenantDb.name ?? "",
        dataSizeBytes: Number(databaseStats.dataSize ?? 0),
        storageSizeBytes: Number(databaseStats.storageSize ?? 0),
        collections: Number(databaseStats.collections ?? 0),
      },
      activeJob: activeJob ?? null,
      config: config
        ? { ...config, connected: Boolean(config.connectedAt) }
        : { connected: false, enabled: false, frequency: "weekly", retentionCount: 7, hourUtc: 2 },
      jobs,
    };
    overviewCache.set(tenantKey, { data: result, expiresAt: now + 3000 });
    return result;
  },
  async authorizationUrl(returnUrl: string) {
    const store = tenantLocalStorage.getStore();
    const platform = await googleDriveCredentials();
    if (!store || !platform) throw createError(503, "Google Drive backup is not ready.");
    const state = signState({
      tenantId: store.tenantId,
      databaseName: store.tenantDb.name,
      returnUrl: safeReturnUrl(returnUrl),
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
    const query = new URLSearchParams({
      client_id: platform.config.clientId,
      redirect_uri: platform.config.callbackUrl,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/drive.file openid email",
      access_type: "offline",
      prompt: "consent",
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${query}`;
  },
  async completeAuthorization(code: string) {
    const platform = await googleDriveCredentials();
    if (!platform) throw createError(503, "Google Drive backup is not ready.");
    const token = await tokenRequest(
      new URLSearchParams({
        code,
        client_id: platform.config.clientId,
        client_secret: platform.secret,
        redirect_uri: platform.config.callbackUrl,
        grant_type: "authorization_code",
      }),
    );
    if (!token.refresh_token) throw createError(400, "Google did not return offline access.");
    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { authorization: `Bearer ${token.access_token}` },
    });
    const profile = (await profileResponse.json()) as { email?: string };
    await TenantBackupConfigModel.findOneAndUpdate(
      { provider: "google_drive" },
      {
        $set: {
          encryptedRefreshToken: cryptoUtil.encrypt(token.refresh_token),
          driveAccountEmail: profile.email,
          connectedAt: new Date(),
        },
        $setOnInsert: { provider: "google_drive" },
      },
      { upsert: true, returnDocument: "after" },
    );
    clearOverviewCache();
  },
  async saveSchedule(input: {
    enabled: boolean;
    frequency: Frequency;
    hourUtc: number;
    dayOfWeek: number;
    dayOfMonth: number;
    retentionCount: number;
    driveFolderId?: string;
    updatedBy?: string;
  }) {
    const connected = await TenantBackupConfigModel.exists({ connectedAt: { $exists: true } });
    if (input.enabled && !connected) throw createError(409, "Connect Google Drive first.");
    const updated = await TenantBackupConfigModel.findOneAndUpdate(
      { provider: "google_drive" },
      {
        $set: {
          ...input,
          ...(input.enabled
            ? {
                nextRunAt: nextRun(
                  input.frequency,
                  input.hourUtc,
                  input.dayOfWeek,
                  input.dayOfMonth,
                ),
              }
            : {}),
        },
        ...(input.enabled ? {} : { $unset: { nextRunAt: 1 } }),
        $setOnInsert: { provider: "google_drive" },
      },
      { upsert: true, returnDocument: "after", runValidators: true },
    ).select("-encryptedRefreshToken");
    clearOverviewCache();
    return updated;
  },
  async queue(trigger: "manual" | "scheduled", requestedBy?: string) {
    const config = await TenantBackupConfigModel.findOne()
      .select("+encryptedRefreshToken connectedAt")
      .lean();
    if (!config?.connectedAt || !config.encryptedRefreshToken) {
      throw createError(409, "Reconnect Google Drive before starting a backup.");
    }
    secureBackupKey();
    try {
      await Promise.all([
        access(configs.MONGODUMP_PATH, constants.X_OK),
        accessToken(config.encryptedRefreshToken),
      ]);
    } catch (error) {
      const failure = friendlyBackupFailure(error);
      throw createError(503, failure.message);
    }
    const active = await TenantBackupJobModel.exists({ status: { $in: ["queued", "running"] } });
    if (active) throw createError(409, "A tenant backup is already in progress.");
    const job = await TenantBackupJobModel.create({
      backupNumber: `BKP-${Date.now()}-${randomUUID().slice(0, 8)}`,
      trigger,
      requestedBy,
      progress: 0,
      stage: "queued",
      progressMessage: "Waiting for the secure backup worker",
    });
    clearOverviewCache();
    void runBackup(String(job._id));
    return job;
  },
  async disconnect() {
    await TenantBackupConfigModel.updateOne(
      { provider: "google_drive" },
      {
        $set: { enabled: false },
        $unset: {
          encryptedRefreshToken: 1,
          driveAccountEmail: 1,
          connectedAt: 1,
          nextRunAt: 1,
        },
      },
    );
    clearOverviewCache();
  },
  nextRun,
  runBackup,
};
