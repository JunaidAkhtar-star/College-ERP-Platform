/** Backfills audit ownership and authoritative counters for campus operations. */
import "dotenv/config";
import mongoose, { type Connection } from "mongoose";

const uri = process.env["MONGODB_URI"] ?? "";
const masterDb = process.env["MASTER_DB_NAME"] ?? "devvelocity_master";

async function migrateTenant(connection: Connection, databaseName: string) {
  const db = connection.useDb(databaseName, { useCache: true });
  const events = db.collection("events");
  const clubs = db.collection("clubs");
  const grievances = db.collection("grievances");
  const items = db.collection("storeitems");
  const requests = db.collection("storerequests");
  const movements = db.collection("storestockmovements");
  const users = db.collection("users");
  for (const collection of [events, clubs, grievances, items, requests])
    await collection.updateMany({ isDeleted: { $exists: false } }, { $set: { isDeleted: false } });
  await grievances.updateMany({ createdBy: { $exists: false } }, [
    { $set: { createdBy: "$studentId" } },
  ]);
  await requests.updateMany({ createdBy: { $exists: false } }, [
    { $set: { createdBy: "$requestedBy" } },
  ]);
  await requests.updateMany(
    { status: "approved", approvedBy: { $exists: false }, decidedBy: { $exists: true } },
    [{ $set: { approvedBy: "$decidedBy", approvedAt: "$decidedAt" } }],
  );
  const fallbackManager = await users.findOne(
    { status: "active", roles: { $in: ["store", "super_admin", "principal"] } },
    { projection: { _id: 1 } },
  );
  await clubs.updateMany({ createdBy: { $exists: false }, facultyAdvisor: { $exists: true } }, [
    { $set: { createdBy: "$facultyAdvisor" } },
  ]);
  if (fallbackManager) {
    await clubs.updateMany(
      { createdBy: { $exists: false } },
      { $set: { createdBy: fallbackManager._id } },
    );
    await items.updateMany(
      { createdBy: { $exists: false } },
      { $set: { createdBy: fallbackManager._id } },
    );
  }
  const missingOwners =
    (await clubs.countDocuments({ createdBy: { $exists: false } })) +
    (await items.countDocuments({ createdBy: { $exists: false } }));
  if (missingOwners)
    throw new Error(`${databaseName}: ${missingOwners} campus records have no recoverable owner`);

  for await (const event of events.find({})) {
    const seen = new Set<string>();
    const registrations = (Array.isArray(event.registrations) ? event.registrations : []).filter(
      (registration) => {
        const id = String(registration.userId);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      },
    );
    if (event.maxRegistrations && registrations.length > Number(event.maxRegistrations))
      throw new Error(`${databaseName}: event ${String(event._id)} exceeds registration capacity`);
    await events.updateOne(
      { _id: event._id },
      { $set: { registrations, registrationCount: registrations.length } },
    );
  }

  for await (const item of items.find({ createdBy: { $exists: true }, currentStock: { $gt: 0 } })) {
    const existing = await movements.findOne({ itemId: item._id });
    if (!existing)
      await movements.insertOne({
        itemId: item._id,
        delta: Number(item.currentStock),
        balanceAfter: Number(item.currentStock),
        reason: "Opening balance migrated from legacy inventory",
        performedBy: item.createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
  }
  await movements.createIndex({ itemId: 1, createdAt: -1 });
  await events.createIndex({ isPublished: 1, startDate: 1 });
  console.info(`Migrated campus operations in ${databaseName}`);
}

async function main() {
  if (!uri) throw new Error("MONGODB_URI is required");
  await mongoose.connect(uri, { dbName: masterDb });
  const tenants = await mongoose.connection.collection("tenants").find({}).toArray();
  for (const tenant of tenants)
    await migrateTenant(mongoose.connection, String(tenant.databaseName));
}

main()
  .catch((error) => {
    console.error("Campus operations governance migration failed", error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
