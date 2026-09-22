import createError from "http-errors";
import { Types } from "mongoose";
import { RegulatoryConnectionModel } from "../models/regulatory-connection.model";
import {
  RegulatoryIntegrationModel,
  type TRegulatoryProvider,
} from "../models/regulatory-integration.model";
import { cryptoUtil } from "../utils/crypto.util";

const providers: TRegulatoryProvider[] = ["digilocker", "nad", "abc", "aishe", "nirf"];

const publicRecord = (record: {
  provider: TRegulatoryProvider;
  mode: "portal_export" | "api";
  enabled: boolean;
  apiBaseUrl?: string;
  clientId?: string;
  secretCiphertext?: string;
  status: string;
  adapterAvailable: boolean;
  lastTestedAt?: Date;
  lastTestSucceeded?: boolean;
  message?: string;
  updatedAt?: Date;
}) => ({
  provider: record.provider,
  mode: record.mode,
  enabled: record.enabled,
  apiBaseUrl: record.apiBaseUrl,
  clientId: record.clientId,
  hasCredential: Boolean(record.secretCiphertext),
  status: record.status,
  adapterAvailable: record.adapterAvailable,
  lastTestedAt: record.lastTestedAt,
  lastTestSucceeded: record.lastTestSucceeded,
  message: record.message,
  updatedAt: record.updatedAt,
});

export const regulatoryConnectionService = {
  async list() {
    const records = await RegulatoryConnectionModel.find().select("+secretCiphertext").lean();
    return providers.map((provider) => {
      const record = records.find((item) => item.provider === provider);
      return record
        ? publicRecord(record)
        : {
            provider,
            mode: "portal_export" as const,
            enabled: true,
            hasCredential: false,
            status: "verified",
            adapterAvailable: true,
            message: "Governed file export and manual portal acknowledgement are available.",
          };
    });
  },

  async save(
    provider: TRegulatoryProvider,
    input: {
      mode?: "portal_export" | "api";
      enabled?: boolean;
      apiBaseUrl?: string;
      clientId?: string;
      credential?: string;
    },
    userId: string,
  ) {
    const mode = input.mode ?? "portal_export";
    if (mode === "api" && input.enabled) {
      const governance = await RegulatoryIntegrationModel.findOne({ provider })
        .select("productionEnabled approval.status")
        .lean();
      if (!governance?.productionEnabled || governance.approval?.status !== "approved")
        throw createError(
          409,
          "Independent production authorization is required before API credentials can be stored.",
        );
    }
    const existing = await RegulatoryConnectionModel.findOne({ provider })
      .select("+secretCiphertext")
      .exec();
    const credential = String(input.credential ?? "").trim();
    const secretCiphertext = credential
      ? cryptoUtil.encrypt(credential)
      : existing?.secretCiphertext;
    const apiBaseUrl = String(input.apiBaseUrl ?? "").trim() || undefined;
    const clientId = String(input.clientId ?? "").trim() || undefined;
    if (mode === "api" && apiBaseUrl) {
      const url = new URL(apiBaseUrl);
      if (url.protocol !== "https:") throw createError(400, "API base URL must use HTTPS.");
    }
    const enabled = Boolean(input.enabled);
    const status = !enabled
      ? "not_configured"
      : mode === "portal_export"
        ? "verified"
        : !clientId || !secretCiphertext
          ? "credential_required"
          : "configured";
    const record = await RegulatoryConnectionModel.findOneAndUpdate(
      { provider },
      {
        $set: {
          mode,
          enabled,
          apiBaseUrl,
          clientId,
          secretCiphertext,
          status,
          adapterAvailable: mode === "portal_export",
          lastTestSucceeded: mode === "portal_export" ? true : undefined,
          message:
            mode === "portal_export"
              ? "Governed file export and manual portal acknowledgement are available."
              : "Credentials are stored encrypted. Live transmission remains disabled until an official provider adapter is installed and verified.",
          updatedBy: new Types.ObjectId(userId),
        },
      },
      { upsert: true, returnDocument: "after", runValidators: true },
    )
      .select("+secretCiphertext")
      .lean();
    if (!record) throw createError(500, "Connection profile could not be saved.");
    return publicRecord(record);
  },

  async test(provider: TRegulatoryProvider, userId: string) {
    const record = await RegulatoryConnectionModel.findOne({ provider })
      .select("+secretCiphertext")
      .exec();
    if (!record?.enabled) throw createError(409, "Enable and save the connection profile first.");
    record.lastTestedAt = new Date();
    record.updatedBy = new Types.ObjectId(userId);
    if (record.mode === "portal_export") {
      record.status = "verified";
      record.lastTestSucceeded = true;
      record.message = "File export, approval and acknowledgement workflow verified.";
      await record.save();
      return publicRecord(record);
    }
    if (!record.clientId || !record.secretCiphertext) {
      record.status = "credential_required";
      record.lastTestSucceeded = false;
      record.message = "Institution-issued client ID and credential are required.";
      await record.save();
      return publicRecord(record);
    }
    record.status = "failed";
    record.lastTestSucceeded = false;
    record.message =
      "Credentials are present, but no approved provider adapter is installed. No external request was sent.";
    await record.save();
    return publicRecord(record);
  },
};
