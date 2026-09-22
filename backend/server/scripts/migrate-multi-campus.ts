/** Creates a recoverable default campus and converts department uniqueness to campus scope. */
import "dotenv/config";
import mongoose, { type Connection } from "mongoose";

async function migrateTenant(connection: Connection, databaseName: string) {
  const db = connection.useDb(databaseName, { useCache: true });
  const users = db.collection("users"),
    settings = db.collection("institutionsettings");
  const owner = await users.findOne(
    { status: "active", roles: { $in: ["super_admin", "admin", "principal"] } },
    { projection: { _id: 1 } },
  );
  if (!owner) throw new Error(`${databaseName}: an active institutional leader is required`);
  const institution = await settings.findOne({});
  const campuses = db.collection("campuses"),
    departments = db.collection("departments");
  let campus = await campuses.findOne({ code: "MAIN" });
  if (!campus) {
    const now = new Date();
    const result = await campuses.insertOne({
      code: "MAIN",
      name: String(institution?.name ?? "Main Campus"),
      type: "campus",
      timezone: "Asia/Kolkata",
      address: {
        line1: String(institution?.address ?? "Address setup required"),
        city: "Setup required",
        state: "Setup required",
        postalCode: "000000",
        country: "India",
      },
      status: "active",
      openedAt: now,
      createdBy: owner._id,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
    });
    campus = { _id: result.insertedId };
  }
  await departments.updateMany(
    { campusId: { $exists: false } },
    { $set: { campusId: campus._id } },
  );
  const indexes = await departments.indexes();
  const legacy = indexes.find(
    (index) => index.unique && Object.keys(index.key).length === 1 && index.key.code === 1,
  );
  if (legacy) await departments.dropIndex(legacy.name!);
  await departments.createIndex(
    { campusId: 1, code: 1 },
    { unique: true, name: "campusId_1_code_1" },
  );
  await campuses.createIndex({ code: 1 }, { unique: true });
  console.info(`Migrated multi-campus foundation in ${databaseName}`);
}
async function main() {
  const uri = process.env["MONGODB_URI"] ?? "";
  if (!uri) throw new Error("MONGODB_URI is required");
  await mongoose.connect(uri, { dbName: process.env["MASTER_DB_NAME"] ?? "devvelocity_master" });
  const tenants = await mongoose.connection.collection("tenants").find({}).toArray();
  for (const tenant of tenants)
    await migrateTenant(mongoose.connection, String(tenant.databaseName));
}
main()
  .catch((error) => {
    console.error("Multi-campus migration failed", error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
