/**
 * Institution Setting Service
 *
 * Implements business logic for managing global institution settings.
 */
import {
  InstitutionSettingModel,
  type IInstitutionSetting,
} from "../models/institution-setting.model";
import { uploadUtil } from "../utils/upload.util";
import type { UploadedFile } from "express-fileupload";
import createError from "http-errors";
import mongoose from "mongoose";
import type { IFcmDeviceToken, IFcmToken } from "../models/user.model";
import { sendFcmToUser } from "../utils/fcm.util";
import { logger } from "../utils/logger.util";

const onboardingCache = new Map<string, { completed: boolean; expiresAt: number }>();
const ONBOARDING_CACHE_MS = 30_000;

const settingsCache = new Map<string, { settings: IInstitutionSetting; expiresAt: number }>();
const SETTINGS_CACHE_MS = 60_000;

export function invalidateInstitutionSettingCache(tenantId?: string): void {
  if (tenantId) {
    onboardingCache.delete(tenantId);
    settingsCache.delete(tenantId);
  } else {
    onboardingCache.clear();
    settingsCache.clear();
  }
}

function validateInstitutionInput(data: Partial<IInstitutionSetting>): void {
  if (data.name !== undefined && (!data.name.trim() || data.name.trim().length > 180)) {
    throw createError(400, "Enter a valid institution name.");
  }
  if (data.shortCode !== undefined && !/^[A-Za-z0-9]{2,12}$/.test(data.shortCode.trim())) {
    throw createError(400, "Short code must be 2–12 letters or numbers only (for example, RITE).");
  }
  if (
    data.email !== undefined &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim().toLowerCase())
  ) {
    throw createError(400, "Enter a valid official email address.");
  }
  if (data.phone !== undefined && !/^\+?[0-9][0-9 ()-]{7,19}$/.test(data.phone.trim())) {
    throw createError(400, "Enter a valid official phone number.");
  }
  if (data.websiteUrl !== undefined && data.websiteUrl.trim()) {
    let website: URL;
    try {
      website = new URL(data.websiteUrl.trim());
    } catch {
      throw createError(400, "Enter a complete institution website URL.");
    }
    if (!["http:", "https:"].includes(website.protocol)) {
      throw createError(400, "Institution website must use HTTP or HTTPS.");
    }
  }
}

export const institutionSettingService = {
  isOnboardingComplete: async (tenantId: string) => {
    const cached = onboardingCache.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) return cached.completed;
    const settings = await InstitutionSettingModel.findOne().select("onboardingStatus").lean();
    const completed = settings?.onboardingStatus === "completed";
    onboardingCache.set(tenantId, { completed, expiresAt: Date.now() + ONBOARDING_CACHE_MS });
    return completed;
  },
  getSettings: async (tenantId?: string) => {
    const key = tenantId || "current";
    const cached = settingsCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.settings;
    }
    let settings = await InstitutionSettingModel.findOne();
    if (!settings) {
      settings = await InstitutionSettingModel.create({
        name: "Institution setup required",
        accreditations: [],
      });
    }
    const plain = settings.toObject();
    settingsCache.set(key, { settings: plain, expiresAt: Date.now() + SETTINGS_CACHE_MS });
    return plain;
  },

  updateSettings: async (
    data: Partial<IInstitutionSetting>,
    logoFile?: UploadedFile,
    faviconFile?: UploadedFile,
    userId?: string,
    tenantId?: string,
  ) => {
    validateInstitutionInput(data);
    let settings = await InstitutionSettingModel.findOne();
    if (!settings) {
      settings = new InstitutionSettingModel();
    }

    if (logoFile) {
      if (settings.logoPublicId) {
        await uploadUtil.deleteFile(settings.logoPublicId).catch((error: unknown) => {
          logger.warn("[institution-settings] Previous logo cleanup failed", {
            error,
            publicId: settings?.logoPublicId,
          });
        });
      }
      const uploadRes = await uploadUtil.uploadDocument(logoFile, "erp/institution");
      settings.logoUrl = uploadRes.url;
      settings.logoPublicId = uploadRes.publicId;
    }

    if (faviconFile) {
      if (settings.faviconPublicId) {
        await uploadUtil.deleteFile(settings.faviconPublicId).catch((error: unknown) => {
          logger.warn("[institution-settings] Previous favicon cleanup failed", {
            error,
            publicId: settings?.faviconPublicId,
          });
        });
      }
      const uploadRes = await uploadUtil.uploadDocument(faviconFile, "erp/institution", {
        publicId: "favicon",
      });
      settings.faviconUrl = uploadRes.url;
      settings.faviconPublicId = uploadRes.publicId;
    }

    if (data.name !== undefined) settings.name = data.name;
    if (data.shortCode !== undefined) settings.shortCode = data.shortCode;
    if (data.tagline !== undefined) settings.tagline = data.tagline;
    if (data.address !== undefined) settings.address = data.address;
    if (data.phone !== undefined) settings.phone = data.phone;
    if (data.email !== undefined) settings.email = data.email;
    if (data.websiteUrl !== undefined) settings.websiteUrl = data.websiteUrl;
    if (data.accreditations !== undefined) settings.accreditations = data.accreditations;
    if (data.faviconUrl !== undefined) settings.faviconUrl = data.faviconUrl;
    if (data.invoicePrefix !== undefined) settings.invoicePrefix = data.invoicePrefix;
    if (data.receiptPrefix !== undefined) settings.receiptPrefix = data.receiptPrefix;
    if (data.emailSenderName !== undefined) settings.emailSenderName = data.emailSenderName;
    if (data.replyToEmail !== undefined) settings.replyToEmail = data.replyToEmail;
    if (data.seoTitle !== undefined) settings.seoTitle = data.seoTitle;
    if (data.seoDescription !== undefined) settings.seoDescription = data.seoDescription;
    if (data.seoImageUrl !== undefined) settings.seoImageUrl = data.seoImageUrl;
    if (data.primaryColor !== undefined) settings.primaryColor = data.primaryColor;
    if (data.secondaryColor !== undefined) settings.secondaryColor = data.secondaryColor;
    if (data.onboardingStep !== undefined) {
      const step = Number(data.onboardingStep);
      const currentStep = settings.onboardingStep ?? 0;
      if (Number.isInteger(step) && step >= currentStep && step <= 5) {
        settings.onboardingStep = step;
      }
    }

    if (userId) {
      const { Types } = require("mongoose");
      settings.updatedBy = new Types.ObjectId(userId);
    }

    await settings.save();
    invalidateInstitutionSettingCache(tenantId);
    return settings.toObject();
  },

  completeOnboarding: async (userId?: string, tenantId?: string) => {
    const settings = await InstitutionSettingModel.findOne();
    if (!settings) throw createError(400, "Institution profile has not been created.");

    const required: Array<[string, unknown]> = [
      ["institution name", settings.name],
      ["short code", settings.shortCode],
      ["official address", settings.address],
      ["phone number", settings.phone],
      ["official email", settings.email],
      ["institution logo", settings.logoUrl],
    ];
    const missing = required
      .filter(
        ([label, value]) =>
          !String(value ?? "").trim() ||
          (label === "institution name" && value === "Institution setup required"),
      )
      .map(([label]) => label);
    if (missing.length) {
      throw createError(400, `Complete the required fields: ${missing.join(", ")}.`);
    }

    settings.onboardingStatus = "completed";
    settings.onboardingStep = 5;
    settings.onboardingCompletedAt = new Date();
    if (userId) {
      const { Types } = require("mongoose");
      settings.updatedBy = new Types.ObjectId(userId);
    }
    await settings.save();

    // Auto-create Primary Main Campus if no campus exists yet for this tenant
    const { CampusModel } = require("../models/campus-governance.model");
    const existingCampusCount = await CampusModel.countDocuments();
    if (existingCampusCount === 0) {
      await CampusModel.create({
        code: `${(settings.shortCode || "MAIN").replace(/[^a-zA-Z0-9]/g, "").toUpperCase()}-01`,
        name: `${settings.name} Main Campus`,
        type: "campus",
        timezone: "Asia/Kolkata",
        status: "active",
        address: {
          line1: settings.address || "Main Campus Road",
          city: "Central",
          state: "State",
          postalCode: "000000",
          country: "India",
        },
        createdBy: userId ? new (require("mongoose").Types.ObjectId)(userId) : undefined,
      });
    }
    if (tenantId) {
      invalidateInstitutionSettingCache(tenantId);
      onboardingCache.set(tenantId, {
        completed: true,
        expiresAt: Date.now() + ONBOARDING_CACHE_MS,
      });
    } else {
      invalidateInstitutionSettingCache();
    }

    // Fire-and-forget push notification to platform super-admins
    const instName = settings.name;
    setImmediate(() => {
      mongoose.connection
        .collection<{ fcmToken?: IFcmToken; fcmTokens?: IFcmDeviceToken[] }>("users")
        .find({
          roles: "super_admin",
          status: "active",
          "notificationPreferences.push": true,
        })
        .project<{ fcmToken?: IFcmToken; fcmTokens?: IFcmDeviceToken[] }>({
          fcmToken: 1,
          fcmTokens: 1,
        })
        .toArray()
        .then((admins) =>
          Promise.all(
            admins.map((admin) =>
              sendFcmToUser(
                admin.fcmToken,
                {
                  title: "Tenant Onboarding Completed 🎉",
                  body: `${instName} has completed setup and onboarding successfully.`,
                  data: { actionUrl: "/tenants", url: "/tenants" },
                },
                admin.fcmTokens,
              ),
            ),
          ),
        )
        .catch((error: unknown) => {
          logger.warn("[institution-settings] Onboarding completion push failed", {
            error,
            institutionId: String(settings?._id ?? "unknown"),
          });
        });
    });

    return settings.toObject();
  },
};
