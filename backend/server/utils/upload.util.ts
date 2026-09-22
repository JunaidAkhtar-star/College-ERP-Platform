import type { UploadedFile } from "express-fileupload";
import cloudinary from "cloudinary";
import type { UploadResult } from "../types";
import { tenantLocalStorage } from "../configs/connectionManager";
import { BadRequest } from "http-errors";
import { configureCloudinary } from "../services/cloudinary-client.service";

const ALLOWED_IMAGE_FORMATS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "avif",
  "bmp",
  "tif",
  "tiff",
  "heic",
  "heif",
  "ico",
];
const ALLOWED_DOC_FORMATS = ["pdf", ...ALLOWED_IMAGE_FORMATS];
const ALLOWED_CHAT_FORMATS = ALLOWED_DOC_FORMATS;
const MAX_DOC_SIZE_MB = 5;
const MAX_AVATAR_SIZE_MB = 2;
const MAX_CHAT_SIZE_MB = 25;

const MIME_EXTENSION_MAP: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/bmp": "bmp",
  "image/x-ms-bmp": "bmp",
  "image/tiff": "tiff",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
};

export function resolveUploadExtension(
  file: Pick<UploadedFile, "name" | "mimetype">,
  allowedFormats: readonly string[],
): string {
  const normalizedName = String(file.name ?? "")
    .trim()
    .split(/[?#]/, 1)[0];
  const declaredExtension = normalizedName.includes(".")
    ? (normalizedName.split(".").pop()?.trim().toLowerCase() ?? "")
    : "";

  if (allowedFormats.includes(declaredExtension)) return declaredExtension;

  const mimeExtension =
    MIME_EXTENSION_MAP[
      String(file.mimetype ?? "")
        .trim()
        .toLowerCase()
    ];
  if (mimeExtension && allowedFormats.includes(mimeExtension)) return mimeExtension;

  throw new BadRequest(`Invalid file format. Allowed: ${allowedFormats.join(", ")}`);
}

// ── Magic byte signatures ─────────────────────────────────────────────────────
// Validates actual file content, not just the extension or Content-Type header.
const MAGIC_BYTES: Record<string, number[][]> = {
  jpg: [[0xff, 0xd8, 0xff]],
  jpeg: [[0xff, 0xd8, 0xff]],
  png: [[0x89, 0x50, 0x4e, 0x47]],
  webp: [[0x52, 0x49, 0x46, 0x46]], // "RIFF" — full check done below
  gif: [
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
  ],
  bmp: [[0x42, 0x4d]],
  tif: [
    [0x49, 0x49, 0x2a, 0x00],
    [0x4d, 0x4d, 0x00, 0x2a],
  ],
  tiff: [
    [0x49, 0x49, 0x2a, 0x00],
    [0x4d, 0x4d, 0x00, 0x2a],
  ],
  pdf: [[0x25, 0x50, 0x44, 0x46]], // "%PDF"
  ico: [[0x00, 0x00, 0x01, 0x00]],
};

/**
 * Verify actual file bytes match the declared extension.
 * Prevents extension-spoofing attacks (e.g. a PHP script renamed to .jpg).
 */
function assertMagicBytes(file: UploadedFile, ext: string): void {
  const buf: Buffer = Buffer.isBuffer(file.data)
    ? file.data
    : Buffer.from(file.data as unknown as ArrayBuffer);

  if (["avif", "heic", "heif"].includes(ext)) {
    const header = buf.subarray(0, 40).toString("ascii");
    const allowedBrands =
      ext === "avif" ? ["avif", "avis"] : ["heic", "heix", "hevc", "hevx", "heif", "mif1"];
    if (
      buf.subarray(4, 8).toString("ascii") !== "ftyp" ||
      !allowedBrands.some((b) => header.includes(b))
    ) {
      throw new Error(`File content does not match declared format (.${ext}). Upload rejected.`);
    }
    return;
  }

  const signatures = MAGIC_BYTES[ext];
  if (!signatures) return;
  const matches = signatures.some((sig) => sig.every((byte, i) => buf[i] === byte));
  if (!matches) {
    throw new BadRequest(`File content does not match declared format (.${ext}). Upload rejected.`);
  }
  // Extra check for WebP: bytes 8–11 must be "WEBP"
  if (ext === "webp") {
    const webpMarker = buf.subarray(8, 12).toString("ascii");
    if (webpMarker !== "WEBP") {
      throw new BadRequest("File content does not match declared format (.webp). Upload rejected.");
    }
  }
}

export const uploadUtil = {
  /** Upload a student/employee document to Cloudinary under /erp/{tenantId}/documents/. */
  async uploadDocument(
    file: UploadedFile,
    folder = "erp/documents",
    options: { publicId?: string } = {},
  ): Promise<UploadResult> {
    await configureCloudinary();
    const ext = resolveUploadExtension(file, ALLOWED_DOC_FORMATS);
    if (file.size > MAX_DOC_SIZE_MB * 1024 * 1024) {
      throw new BadRequest(`File size exceeds ${MAX_DOC_SIZE_MB} MB limit`);
    }
    assertMagicBytes(file, ext);

    const tenantId = tenantLocalStorage.getStore()?.tenantId || "global";
    const subFolder = folder.startsWith("erp/") ? folder.slice(4) : folder;
    const targetFolder = `erp/${tenantId}/${subFolder}`;

    const result = await cloudinary.v2.uploader.upload(
      `data:${file.mimetype};base64,${file.data.toString("base64")}`,
      {
        folder: targetFolder,
        resource_type: "auto",
        ...(options.publicId
          ? { public_id: options.publicId, overwrite: true, invalidate: true }
          : {}),
      },
    );

    return {
      url: result.secure_url,
      publicId: result.public_id,
      resourceType: result.resource_type as UploadResult["resourceType"],
      format: result.format,
      bytes: result.bytes,
    };
  },

  /** Upload a profile avatar to /erp/{tenantId}/avatars/. */
  async uploadAvatar(file: UploadedFile): Promise<UploadResult> {
    await configureCloudinary();
    const ext = resolveUploadExtension(file, ALLOWED_IMAGE_FORMATS);
    if (file.size > MAX_AVATAR_SIZE_MB * 1024 * 1024) {
      throw new BadRequest(`Avatar size exceeds ${MAX_AVATAR_SIZE_MB} MB limit`);
    }
    assertMagicBytes(file, ext);

    const tenantId = tenantLocalStorage.getStore()?.tenantId || "global";
    const targetFolder = `erp/${tenantId}/avatars`;

    const result = await cloudinary.v2.uploader.upload(
      `data:${file.mimetype};base64,${file.data.toString("base64")}`,
      { folder: targetFolder, transformation: [{ width: 400, crop: "limit" }] },
    );

    return {
      url: result.secure_url,
      publicId: result.public_id,
      resourceType: "image",
      format: result.format,
      bytes: result.bytes,
    };
  },

  /** Delete a file from Cloudinary by publicId. */
  async deleteFile(publicId: string): Promise<void> {
    await configureCloudinary();
    await cloudinary.v2.uploader.destroy(publicId);
  },

  /**
   * Delete a file from Cloudinary given its secure URL.
   * Parses the URL to recover `public_id` and `resource_type` (image / video /
   * raw) — both are required because Cloudinary stores each resource type in
   * a separate bucket and `destroy()` defaults to `image`.
   *
   * Returns `true` on success, `false` if the URL is not a Cloudinary URL
   * or the delete failed (logged, never thrown — caller decides whether to
   * proceed with DB cleanup).
   */
  async deleteByUrl(url: string): Promise<boolean> {
    if (!url || typeof url !== "string") return false;
    try {
      await configureCloudinary();
      const u = new URL(url);
      if (!u.hostname.endsWith("cloudinary.com")) return false;
      // Path layout: /<cloud>/<resource_type>/upload/[v<version>/]<folder>/<file>.<ext>
      const parts = u.pathname.split("/").filter(Boolean);
      const uploadIdx = parts.indexOf("upload");
      if (uploadIdx < 1) return false;
      const resourceType = parts[uploadIdx - 1] as "image" | "video" | "raw";
      const after = parts.slice(uploadIdx + 1);
      // Drop the version segment (e.g. "v1700000000") if present.
      const withoutVersion = after[0]?.match(/^v\d+$/) ? after.slice(1) : after;
      const joined = withoutVersion.join("/");
      // Strip extension only for image/video — `raw` stores public_id WITH ext.
      const publicId = resourceType === "raw" ? joined : joined.replace(/\.[a-zA-Z0-9]+$/, "");
      if (!publicId) return false;
      await cloudinary.v2.uploader.destroy(publicId, { resource_type: resourceType });
      return true;
    } catch (err) {
      console.warn(`[upload.deleteByUrl] failed for ${url}:`, (err as Error).message);
      return false;
    }
  },

  /**
   * Upload a chat attachment to /erp/{tenantId}/chat/.
   * Chat accepts the same governed document/image formats as other uploads,
   * with a larger size limit. Both the extension/MIME declaration and file
   * signature are checked before data reaches Cloudinary.
   */
  async uploadChatAttachment(file: UploadedFile): Promise<UploadResult> {
    await configureCloudinary();
    const ext = resolveUploadExtension(file, ALLOWED_CHAT_FORMATS);
    if (file.size > MAX_CHAT_SIZE_MB * 1024 * 1024) {
      throw new BadRequest(`File size exceeds ${MAX_CHAT_SIZE_MB} MB limit`);
    }
    assertMagicBytes(file, ext);
    const tenantId = tenantLocalStorage.getStore()?.tenantId || "global";
    const targetFolder = `erp/${tenantId}/chat`;

    const result = await cloudinary.v2.uploader.upload(
      `data:${file.mimetype};base64,${file.data.toString("base64")}`,
      { folder: targetFolder, resource_type: "auto" },
    );
    return {
      url: result.secure_url,
      publicId: result.public_id,
      resourceType: result.resource_type as UploadResult["resourceType"],
      format: result.format,
      bytes: result.bytes,
    };
  },
};
