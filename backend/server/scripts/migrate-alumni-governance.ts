/** Backfills alumni verification and donation accounting controls for every tenant. */
import "dotenv/config";
import mongoose, { type Connection } from "mongoose";

const mongoUri = process.env["MONGODB_URI"] ?? "";
const masterDatabaseName = process.env["MASTER_DB_NAME"] ?? "devvelocity_master";

async function assertNoDuplicates(
  collection: ReturnType<Connection["collection"]>,
  field: string,
  databaseName: string,
) {
  const duplicates = await collection
    .aggregate([
      { $match: { [field]: { $exists: true, $nin: [null, ""] } } },
      { $group: { _id: `$${field}`, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 5 },
    ])
    .toArray();
  if (duplicates.length)
    throw new Error(
      `${databaseName}: duplicate ${field} values require review: ${duplicates.map((item) => String(item._id)).join(", ")}`,
    );
}

async function migrateTenant(connection: Connection, databaseName: string) {
  const tenantDb = connection.useDb(databaseName, { useCache: true });
  const alumni = tenantDb.collection("alumnis");
  const donations = tenantDb.collection("donations");

  await alumni.updateMany({}, [
    {
      $set: {
        careerOutcomeVerified: { $ifNull: ["$careerOutcomeVerified", false] },
        isDeleted: { $ifNull: ["$isDeleted", false] },
        verificationSource: {
          $cond: [
            { $eq: ["$isVerified", true] },
            { $ifNull: ["$verificationSource", "legacy_review"] },
            "$verificationSource",
          ],
        },
        verifiedAt: {
          $cond: [
            { $eq: ["$isVerified", true] },
            { $ifNull: ["$verifiedAt", { $ifNull: ["$updatedAt", "$createdAt"] }] },
            "$verifiedAt",
          ],
        },
      },
    },
  ]);

  let migratedDonations = 0;
  for await (const donation of donations.find({})) {
    const alumnus = await alumni.findOne({ _id: donation.alumniId });
    const inferredCreator = donation.createdBy ?? alumnus?.userId ?? donation.confirmedBy;
    if (!inferredCreator) {
      throw new Error(
        `${databaseName}: donation ${String(donation._id)} has no auditable recorder or linked alumni user`,
      );
    }
    await donations.updateOne(
      { _id: donation._id },
      {
        $set: {
          createdBy: inferredCreator,
          currency: String(donation.currency ?? "INR").toUpperCase(),
          accountingVerified: donation.accountingVerified ?? false,
          isDeleted: donation.isDeleted ?? false,
        },
      },
    );
    migratedDonations += 1;
  }

  await assertNoDuplicates(alumni, "userId", databaseName);
  await assertNoDuplicates(alumni, "rollNumber", databaseName);
  await assertNoDuplicates(donations, "transactionId", databaseName);
  await alumni.createIndex({ userId: 1 }, { unique: true, sparse: true });
  await alumni.createIndex({ rollNumber: 1 }, { unique: true, sparse: true });
  await alumni.createIndex({ careerOutcomeVerified: 1, passoutYear: -1 });
  await donations.createIndex({ transactionId: 1 }, { unique: true, sparse: true });
  await donations.createIndex({ receiptNumber: 1 }, { unique: true, sparse: true });
  await donations.createIndex({ accountingVerified: 1, status: 1, donatedAt: -1 });
  console.info(`Migrated ${migratedDonations} alumni donations in ${databaseName}`);
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
    console.error("Alumni governance migration failed", error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
