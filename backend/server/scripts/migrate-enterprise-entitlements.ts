import mongoose from "mongoose";
import { configs } from "../configs";
import { ProductModuleModel, SubscriptionPlanModel } from "../models/platform.model";

async function run(): Promise<void> {
  await mongoose.connect(configs.MONGODB_URI, { dbName: configs.MASTER_DB_NAME });
  try {
    const modules = await ProductModuleModel.find({ status: "active" }).select("slug").lean();
    if (modules.length === 0) throw new Error("No active product modules are configured.");

    const result = await SubscriptionPlanModel.updateMany(
      { slug: "enterprise" },
      {
        $set: {
          moduleSlugs: modules.map((productModule) => productModule.slug),
          includedAddonSlugs: [],
        },
      },
      { runValidators: true },
    );

    console.info(
      `Enterprise entitlements synchronized: plans=${result.matchedCount}, modules=${modules.length}.`,
    );
  } finally {
    await mongoose.disconnect();
  }
  process.exit(0);
}

void run().catch(async (error: unknown) => {
  console.error(error instanceof Error ? error.message : "Enterprise migration failed.");
  await mongoose.disconnect();
  process.exit(1);
});
