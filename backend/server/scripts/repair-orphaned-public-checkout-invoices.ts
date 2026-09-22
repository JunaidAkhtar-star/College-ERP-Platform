import "dotenv/config";
import mongoose from "mongoose";
import { configs } from "../configs";
import { PlatformBillingRecordModel } from "../models/platform-billing.model";
import { PublicCheckoutModel } from "../models/public-checkout.model";
import { TenantModel } from "../models/tenant.model";
import { createPlatformOrder } from "../services/platform-billing.service";

async function main() {
  await mongoose.connect(configs.MONGODB_URI, { dbName: configs.MASTER_DB_NAME });
  const checkouts = await PublicCheckoutModel.find({
    status: "pending_payment",
    expiresAt: { $gt: new Date() },
  }).lean();
  let repaired = 0;
  let expired = 0;
  for (const checkout of checkouts) {
    const tenantExists = await TenantModel.exists({ _id: checkout.tenantId });
    if (!tenantExists) {
      await PublicCheckoutModel.updateOne(
        { _id: checkout._id },
        {
          $set: {
            status: "failed",
            error: "Registration data is no longer available. Please register again.",
            expiresAt: new Date(),
          },
        },
      );
      expired += 1;
      continue;
    }
    const existing = await PlatformBillingRecordModel.exists({
      $or: [
        { checkoutId: checkout._id },
        {
          tenantId: checkout.tenantId,
          planId: checkout.planId,
          purchaseKind: "plan",
          paymentMethod: "bank_transfer",
        },
      ],
    });
    if (existing) continue;
    await createPlatformOrder({
      tenantId: String(checkout.tenantId),
      checkoutId: String(checkout._id),
      planId: String(checkout.planId),
      addonSlugs: checkout.addonSlugs,
      billingPeriod: checkout.billingPeriod,
    });
    repaired += 1;
  }
  console.info(
    `Repaired ${repaired} orphaned invoice(s); expired ${expired} unrecoverable checkout(s).`,
  );
}

main()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
  });
