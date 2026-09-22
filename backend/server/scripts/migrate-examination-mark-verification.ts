/** Migrates examination verification, resource locks, and safe facility venue links. */
import "dotenv/config";
import mongoose, { type Connection } from "mongoose";

const mongoUri = process.env["MONGODB_URI"] ?? "";
const masterDatabaseName = process.env["MASTER_DB_NAME"] ?? "devvelocity_master";

async function migrateTenant(connection: Connection, databaseName: string) {
  const tenantDb = connection.useDb(databaseName, { useCache: true });
  const marks = tenantDb.collection("studentmarks");
  const schedules = tenantDb.collection("examschedules");
  const facilities = tenantDb.collection("facilityspaces");
  const mutationLocks = tenantDb.collection("examschedulemutationlocks");
  await marks.createIndex(
    { isPublished: 1, verifiedBy: 1, updatedAt: 1 },
    { name: "mark_verification_queue" },
  );
  const pending = await marks.countDocuments({
    isPublished: { $ne: true },
    verifiedBy: { $exists: false },
  });
  await mutationLocks.createIndex({ key: 1 }, { unique: true, name: "exam_resource_lock_key" });

  const spaces = await facilities
    .find({ code: { $type: "string" } }, { projection: { _id: 1, code: 1 } })
    .toArray();
  const byCode = new Map<string, Array<(typeof spaces)[number]>>();
  for (const space of spaces) {
    const code = String(space.code).trim().toUpperCase();
    byCode.set(code, [...(byCode.get(code) ?? []), space]);
  }
  let linkedVenueCodes = 0;
  for (const [code, matches] of byCode) {
    if (matches.length !== 1) continue;
    const result = await schedules.updateMany(
      { subjects: { $elemMatch: { venue: code, venueId: { $exists: false } } } },
      { $set: { "subjects.$[subject].venueId": matches[0]._id } },
      { arrayFilters: [{ "subject.venue": code, "subject.venueId": { $exists: false } }] },
    );
    if (result.modifiedCount) linkedVenueCodes += 1;
  }
  const unresolvedVenues = await schedules.countDocuments({
    subjects: { $elemMatch: { venueId: { $exists: false } } },
  });
  console.info(
    `${databaseName}: ${pending} marks await verification; linked ${linkedVenueCodes} exam venue code(s); ${unresolvedVenues} schedule(s) retain legacy venues`,
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
    console.error("Examination mark-verification migration failed", error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
