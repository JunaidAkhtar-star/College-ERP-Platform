import { PaymentSettingsModel } from "../models/payment-settings.model";

export const paymentSettingsRepository = {
  /** Get the single active settings document. */
  getActive: () => PaymentSettingsModel.findOne({ isActive: true }).lean(),

  /** Get all settings records (admin). */
  getAll: () => PaymentSettingsModel.find().sort({ createdAt: -1 }).lean(),

  /** Create a new settings record. */
  create: (data: Record<string, unknown>) => PaymentSettingsModel.create(data),

  /** Update a settings record by id. */
  updateById: (id: string, data: Record<string, unknown>) =>
    PaymentSettingsModel.findByIdAndUpdate(id, { $set: data }).lean(),

  /** Deactivate all — only one active at a time. */
  deactivateAll: () =>
    PaymentSettingsModel.updateMany({ isActive: true }, { $set: { isActive: false } }),
};
