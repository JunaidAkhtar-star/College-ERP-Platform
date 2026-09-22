/** Backfills scholarship schemes and governed financial lifecycle fields for every tenant. */
import "dotenv/config";
import mongoose, { type Connection } from "mongoose";

const mongoUri = process.env["MONGODB_URI"] ?? "";
const masterDatabaseName = process.env["MASTER_DB_NAME"] ?? "devvelocity_master";

async function migrateTenant(connection: Connection, databaseName: string) {
  const tenantDb = connection.useDb(databaseName, { useCache: true });
  const scholarships = tenantDb.collection("scholarships");
  const schemes = tenantDb.collection("scholarshipschemes");
  const groups = await scholarships
    .aggregate<{
      _id: { scholarshipName: string; academicYear: string };
      scholarshipType: string;
      awardingBody: string;
      total: number;
      maximum: number;
      reserved: number;
      disbursed: number;
    }>([
      {
        $group: {
          _id: { scholarshipName: "$scholarshipName", academicYear: "$academicYear" },
          scholarshipType: { $first: "$scholarshipType" },
          awardingBody: { $first: "$awardingBody" },
          total: { $sum: { $max: ["$amount", 0] } },
          maximum: { $max: { $max: ["$amount", 0] } },
          reserved: {
            $sum: {
              $cond: [
                { $eq: ["$status", "approved"] },
                { $ifNull: ["$approvedAmount", "$amount"] },
                0,
              ],
            },
          },
          disbursed: {
            $sum: {
              $cond: [
                { $eq: ["$status", "disbursed"] },
                { $ifNull: ["$disbursedAmount", "$amount"] },
                0,
              ],
            },
          },
        },
      },
    ])
    .toArray();

  let migrated = 0;
  for (const group of groups) {
    const name = String(group._id.scholarshipName || "Legacy scholarship").trim();
    const academicYear = String(group._id.academicYear || "legacy").trim();
    const budgetAmount = Math.max(1, group.total, group.reserved + group.disbursed);
    const scheme = await schemes.findOneAndUpdate(
      { name, academicYear },
      {
        $setOnInsert: {
          name,
          academicYear,
          scholarshipType: group.scholarshipType || "private",
          awardingBody: group.awardingBody || "Legacy awarding body",
          benefitMode: "bank_transfer",
          applicationStart: new Date("2000-01-01T00:00:00.000Z"),
          applicationEnd: new Date("2099-12-31T23:59:59.999Z"),
          budgetAmount,
          reservedAmount: group.reserved,
          disbursedAmount: group.disbursed,
          maxAwardAmount: Math.max(1, group.maximum),
          maxBacklogs: 99,
          requiredDocumentTypes: [],
          isActive: false,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { upsert: true, returnDocument: "after" },
    );
    if (!scheme) throw new Error(`${databaseName}: could not create legacy scholarship scheme`);
    const result = await scholarships.updateMany(
      { scholarshipName: group._id.scholarshipName, academicYear: group._id.academicYear },
      [
        {
          $set: {
            schemeId: scheme._id,
            benefitMode: { $ifNull: ["$benefitMode", "bank_transfer"] },
            approvedAmount: {
              $cond: [
                { $in: ["$status", ["approved", "disbursed"]] },
                { $ifNull: ["$approvedAmount", "$amount"] },
                "$approvedAmount",
              ],
            },
            verifiedBy: {
              $cond: [
                { $in: ["$status", ["approved", "disbursed"]] },
                { $ifNull: ["$verifiedBy", "$approvedBy"] },
                "$verifiedBy",
              ],
            },
            verifiedAt: {
              $cond: [
                { $in: ["$status", ["approved", "disbursed"]] },
                { $ifNull: ["$verifiedAt", "$approvedAt"] },
                "$verifiedAt",
              ],
            },
          },
        },
      ],
    );
    migrated += result.modifiedCount;
  }

  await schemes.createIndex(
    { name: 1, academicYear: 1 },
    { unique: true, name: "scholarship_scheme_name_year" },
  );
  await schemes.createIndex({ academicYear: 1, isActive: 1, applicationEnd: 1 });
  await scholarships.createIndex({ schemeId: 1, status: 1 });
  const scholarshipIndexes = await scholarships.indexes();
  if (
    scholarshipIndexes.some(
      (index) => index.name === "studentId_1_academicYear_1_scholarshipName_1",
    )
  )
    await scholarships.dropIndex("studentId_1_academicYear_1_scholarshipName_1");
  if (scholarshipIndexes.some((index) => index.name === "studentId_1_academicYear_1"))
    await scholarships.dropIndex("studentId_1_academicYear_1");
  await scholarships.createIndex(
    { studentId: 1, schemeId: 1 },
    { unique: true, name: "scholarship_student_scheme_unique" },
  );
  console.info(`Migrated ${migrated} scholarship applications in ${databaseName}`);
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
    console.error("Scholarship governance migration failed", error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
