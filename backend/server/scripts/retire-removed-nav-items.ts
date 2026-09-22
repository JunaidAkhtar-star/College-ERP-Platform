/**
 * @file retire-removed-nav-items.ts
 * @description Migration script that cleanly removes deprecated navigation items
 * (/sso-settings, /external-connector, /developer-platform) from every tenant MongoDB NavItem
 * collection and purges their references from tenant Role documents.
 *
 * Run:
 *   pnpm exec ts-node server/scripts/retire-removed-nav-items.ts
 */
import "dotenv/config";
import mongoose, { type Connection } from "mongoose";
import { logger } from "../utils/logger.util";

const targetHrefs = ["/sso-settings", "/external-connector", "/developer-platform"];

interface ITenantRegistryRecord {
  tenantId?: string;
  databaseName?: string;
}

/**
 * Removes retired links and their role references from one isolated tenant database.
 */
async function retireTenantNav(connection: Connection, tenant: ITenantRegistryRecord) {
  const tenantId = String(tenant.tenantId ?? "");
  const databaseName = String(tenant.databaseName ?? "");
  if (!tenantId || !databaseName) {
    throw new Error(`Tenant registry record is missing tenantId or databaseName.`);
  }
  if (databaseName !== `tenant_${tenantId}`) {
    throw new Error(`Refusing unexpected database mapping '${databaseName}' for '${tenantId}'.`);
  }

  const tenantDb = connection.useDb(databaseName, { useCache: true });
  const navItems = tenantDb.collection("navitems");
  const roles = tenantDb.collection("roles");
  const retired = await navItems
    .find({ href: { $in: targetHrefs } }, { projection: { _id: 1 } })
    .toArray();
  const retiredIds = retired.map((item) => item._id);

  if (!retiredIds.length) {
    logger.info(`[retire-removed-nav-items] ${tenantId}: no matching NavItems found.`);
    return;
  }

  const roleResult = await roles.updateMany({ allowedNavItems: { $in: retiredIds } }, [
    {
      $set: {
        allowedNavItems: {
          $setDifference: [{ $ifNull: ["$allowedNavItems", []] }, retiredIds],
        },
      },
    },
  ]);
  const navResult = await navItems.deleteMany({ _id: { $in: retiredIds } });
  logger.info(
    `[retire-removed-nav-items] ${tenantId}: deleted ${navResult.deletedCount} NavItems and updated ${roleResult.modifiedCount} roles.`,
  );
}

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI is required");
  }
  const masterDatabaseName = process.env.MASTER_DB_NAME ?? "devvelocity_master";
  await mongoose.connect(mongoUri, { dbName: masterDatabaseName });

  const tenants = (await mongoose.connection
    .collection<ITenantRegistryRecord>("tenants")
    .find({}, { projection: { tenantId: 1, databaseName: 1 } })
    .toArray()) as ITenantRegistryRecord[];
  for (const tenant of tenants) {
    await retireTenantNav(mongoose.connection, tenant);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  logger.error("[retire-removed-nav-items] failed", { err });
  process.exit(1);
});
