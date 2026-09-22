/** Backfills student/document audit controls, encrypts legacy Aadhaar values, and validates identifiers. */
import "dotenv/config";
import mongoose, { type Connection } from "mongoose";
import { cryptoUtil } from "../utils/crypto.util";

const mongoUri = process.env["MONGODB_URI"] ?? "";
const masterDatabaseName = process.env["MASTER_DB_NAME"] ?? "devvelocity_master";

async function migrateTenant(connection: Connection, databaseName: string) {
  const tenantDb = connection.useDb(databaseName, { useCache: true });
  const students = tenantDb.collection("studentprofiles");
  const documents = tenantDb.collection("documents");
  const applications = tenantDb.collection("admissionapplications");
  const users = tenantDb.collection("users");

  await students.updateMany({ isDeleted: { $exists: false } }, { $set: { isDeleted: false } });
  await documents.updateMany({ isDeleted: { $exists: false } }, { $set: { isDeleted: false } });
  await students.updateMany({ createdBy: { $exists: false } }, [
    { $set: { createdBy: "$userId" } },
  ]);

  const duplicates = await students
    .aggregate([
      { $match: { registrationNumber: { $type: "string", $ne: "" } } },
      { $group: { _id: "$registrationNumber", count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 5 },
    ])
    .toArray();
  if (duplicates.length)
    throw new Error(`${databaseName}: duplicate registration numbers require manual review`);

  let encryptedAadhaar = 0;
  for await (const student of students.find({ aadhaarNumber: { $type: "string" } })) {
    const value = String(student.aadhaarNumber).replace(/\s/g, "");
    if (!/^\d{12}$/.test(value)) continue;
    await students.updateOne(
      { _id: student._id },
      { $set: { aadhaarNumber: cryptoUtil.encrypt(value) } },
    );
    encryptedAadhaar += 1;
  }
  for await (const student of students.find({ "parentInfo.fatherAadhaar": { $type: "string" } })) {
    const value = String(student.parentInfo?.fatherAadhaar ?? "").replace(/\s/g, "");
    if (!/^\d{12}$/.test(value)) continue;
    await students.updateOne(
      { _id: student._id },
      { $set: { "parentInfo.fatherAadhaar": cryptoUtil.encrypt(value) } },
    );
    encryptedAadhaar += 1;
  }

  for await (const doc of documents.find({ createdBy: { $exists: false } })) {
    let creatorId = doc.ownerModel === "User" ? doc.owner : doc.verifiedBy;
    if (!creatorId && doc.ownerModel === "AdmissionApplication") {
      const application = await applications.findOne(
        { _id: doc.owner },
        { projection: { email: 1 } },
      );
      if (application?.email) {
        const user = await users.findOne(
          { email: String(application.email).trim().toLowerCase() },
          { projection: { _id: 1 } },
        );
        creatorId = user?._id;
      }
    }
    if (!creatorId)
      throw new Error(`${databaseName}: document ${String(doc._id)} has no recoverable creator`);
    await documents.updateOne({ _id: doc._id }, { $set: { createdBy: creatorId } });
  }

  await students.createIndex(
    { registrationNumber: 1 },
    { unique: true, sparse: true, name: "student_registration_unique" },
  );
  await documents.createIndex({ owner: 1, type: 1, status: 1 });
  console.info(`Migrated ${databaseName}; encrypted ${encryptedAadhaar} legacy Aadhaar values`);
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
    console.error("Student records governance migration failed", error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
