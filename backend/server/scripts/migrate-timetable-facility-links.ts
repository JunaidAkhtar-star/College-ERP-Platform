/**
 * Backfills legacy timetable room codes with authoritative FacilitySpace IDs.
 * Only codes that resolve to exactly one facility in a tenant are linked;
 * ambiguous or missing codes are deliberately left unchanged for manual review.
 */
import "dotenv/config";
import mongoose, { type Connection } from "mongoose";

const mongoUri = process.env["MONGODB_URI"] ?? "";
const masterDatabaseName = process.env["MASTER_DB_NAME"] ?? "devvelocity_master";

async function migrateTenant(connection: Connection, databaseName: string) {
  const tenantDb = connection.useDb(databaseName, { useCache: true });
  const facilities = tenantDb.collection("facilityspaces");
  const timetables = tenantDb.collection("timetables");
  const spaces = await facilities
    .find({ code: { $type: "string" } }, { projection: { _id: 1, code: 1 } })
    .toArray();
  const byCode = new Map<string, Array<(typeof spaces)[number]>>();
  for (const space of spaces) {
    const code = String(space.code).trim().toUpperCase();
    byCode.set(code, [...(byCode.get(code) ?? []), space]);
  }

  let linkedCodes = 0;
  for (const [code, matches] of byCode) {
    if (matches.length !== 1) continue;
    const result = await timetables.updateMany(
      { slots: { $elemMatch: { roomNo: code, roomId: { $exists: false } } } },
      { $set: { "slots.$[slot].roomId": matches[0]._id } },
      { arrayFilters: [{ "slot.roomNo": code, "slot.roomId": { $exists: false } }] },
    );
    if (result.modifiedCount) linkedCodes += 1;
  }

  const unresolved = await timetables.countDocuments({
    slots: { $elemMatch: { roomId: { $exists: false } } },
  });
  console.info(
    `${databaseName}: linked ${linkedCodes} unique facility code(s); ${unresolved} timetable(s) retain legacy room codes`,
  );
}

async function main() {
  if (!mongoUri) throw new Error("MONGODB_URI is required");
  await mongoose.connect(mongoUri, { dbName: masterDatabaseName });
  const tenants = await mongoose.connection.collection("tenants").find({}).toArray();
  for (const tenant of tenants) {
    const databaseName = String(tenant.databaseName ?? "");
    if (!databaseName) throw new Error(`Tenant ${String(tenant.tenantId)} has no databaseName`);
    await migrateTenant(mongoose.connection, databaseName);
  }
}

main()
  .catch((error) => {
    console.error("Timetable facility-link migration failed", error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
