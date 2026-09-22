/**
 * @file fix-notification-nav-path.ts
 * @description One-shot migration: rename any NavItem whose path ends in
 * "/notifications" (plural) to "/notification" (singular) so the link routes
 * to the actual app/[role]/notification page.
 *
 * Run once:  pnpm tsx server/scripts/fix-notification-nav-path.ts
 */

import mongoose from "mongoose";
import { configs } from "../configs";
import { NavItemModel } from "../models/nav-item.model";
import { logger } from "../utils/logger.util";

async function main() {
  await mongoose.connect(configs.MONGODB_URI);
  const res = await NavItemModel.updateMany(
    { path: { $in: ["/notifications", "notifications"] } },
    { $set: { path: "/notification" } },
  );
  logger.info(
    `[fix-notification-nav-path] matched=${res.matchedCount} modified=${res.modifiedCount}`,
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  logger.error("[fix-notification-nav-path] failed", { err });
  process.exit(1);
});
