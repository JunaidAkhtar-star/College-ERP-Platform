/**
 * Corrects the historical DevVelocity casing in the singleton public-site profile.
 *
 * Run:
 *   pnpm run migrate:platform-company-name
 */
import "dotenv/config";
import mongoose from "mongoose";
import { PublicSiteConfigModel } from "../models/platform.model";
import { logger } from "../utils/logger.util";

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("MONGODB_URI is required");

  await mongoose.connect(mongoUri, {
    dbName: process.env.MASTER_DB_NAME ?? "devvelocity_master",
  });

  const profile = await PublicSiteConfigModel.findOne().select("_id companyName").lean();
  if (!profile) {
    logger.info("[normalize-platform-company-name] No public-site profile exists.");
    return;
  }

  const companyName = String(profile.companyName ?? "")
    .trim()
    .replace(/devvelocity/gi, "Devvelocity");

  if (companyName === profile.companyName) {
    logger.info("[normalize-platform-company-name] Company name already uses correct casing.");
    return;
  }

  await PublicSiteConfigModel.updateOne({ _id: profile._id }, { $set: { companyName } });
  logger.info(`[normalize-platform-company-name] Company name updated to "${companyName}".`);
}

main()
  .catch((error) => {
    logger.error("[normalize-platform-company-name] Migration failed.", { error });
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
