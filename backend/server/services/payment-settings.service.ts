import createError from "http-errors";
import { paymentSettingsRepository } from "../repositories/payment-settings.repository";
import { uploadUtil } from "../utils/upload.util";
import { cryptoUtil } from "../utils/crypto.util";
import { redisUtil } from "../utils/redis.util";
import type { UploadedFile } from "express-fileupload";

const SETTINGS_CACHE_KEY = "payment:settings:active";
const SETTINGS_TTL = 300; // 5 min

/** Encrypt account numbers before persisting. */
function encryptBankAccounts(accounts: Array<Record<string, unknown>>) {
  return accounts.map((acc) => ({
    ...acc,
    accountNumber: acc.accountNumber
      ? cryptoUtil.encrypt(acc.accountNumber as string)
      : acc.accountNumber,
  }));
}

/** Decrypt account numbers for payment display/editing. */
function decryptBankAccounts(accounts: Array<Record<string, unknown>>) {
  return accounts.map((acc) => {
    let accountNumber = acc.accountNumber;
    if (acc.accountNumber) {
      try {
        accountNumber = cryptoUtil.decrypt(acc.accountNumber as string);
      } catch {
        accountNumber = acc.accountNumber;
      }
    }
    return { ...acc, accountNumber };
  });
}

export const paymentSettingsService = {
  /**
   * Get the active payment settings.
   * Students need the actual beneficiary account/UPI details to pay.
   * The values remain encrypted at rest and are decrypted only for authenticated users.
   */
  getActive: async (isAdmin = false) => {
    const cached = await redisUtil.get<Record<string, unknown>>(SETTINGS_CACHE_KEY);
    if (cached && !isAdmin) return cached;

    const settings = await paymentSettingsRepository.getActive();
    if (!settings)
      throw createError(404, "Payment settings not configured. Contact administrator.");

    const result = {
      ...settings,
      bankAccounts: decryptBankAccounts(
        settings.bankAccounts as unknown as Array<Record<string, unknown>>,
      ),
    };

    if (!isAdmin) await redisUtil.set(SETTINGS_CACHE_KEY, result, SETTINGS_TTL);
    return result;
  },

  /** Get all settings records (Super Admin). */
  getAll: async () => {
    const settings = await paymentSettingsRepository.getAll();
    return settings.map((item) => ({
      ...item,
      bankAccounts: decryptBankAccounts(
        item.bankAccounts as unknown as Array<Record<string, unknown>>,
      ),
    }));
  },

  /**
   * Create or update payment settings.
   * Only one active record is maintained — activating a new one deactivates others.
   */
  upsert: async (data: Record<string, unknown>, updatedBy: string) => {
    // Encrypt bank account numbers
    if (Array.isArray(data.bankAccounts)) {
      data.bankAccounts = encryptBankAccounts(data.bankAccounts as Array<Record<string, unknown>>);
    }

    // If setting as active, deactivate all others
    if (data.isActive) {
      await paymentSettingsRepository.deactivateAll();
    }

    let result;
    if (data._id) {
      result = await paymentSettingsRepository.updateById(data._id as string, {
        ...data,
        updatedBy,
      });
    } else {
      result = await paymentSettingsRepository.create({ ...data, updatedBy });
    }

    // Invalidate cache
    await redisUtil.del(SETTINGS_CACHE_KEY);
    return result;
  },

  /**
   * Upload a QR code image.
   * Replaces any existing QR code in Cloudinary.
   */
  uploadQrCode: async (file: UploadedFile, settingsId: string, updatedBy: string) => {
    const uploaded = await uploadUtil.uploadDocument(file, "erp/payment-qr");
    const updated = await paymentSettingsRepository.updateById(settingsId, {
      qrCodeUrl: uploaded.url,
      qrCodePublicId: uploaded.publicId,
      updatedBy,
    });
    await redisUtil.del(SETTINGS_CACHE_KEY);
    return updated;
  },

  /** Activate a settings record and deactivate all others. */
  activate: async (id: string, updatedBy: string) => {
    await paymentSettingsRepository.deactivateAll();
    const result = await paymentSettingsRepository.updateById(id, {
      isActive: true,
      updatedBy,
    });
    await redisUtil.del(SETTINGS_CACHE_KEY);
    return result;
  },
};
