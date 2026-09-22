/** Backfills faculty/HR audit fields, workload totals, and encryption of legacy identifiers. */
import "dotenv/config";
import mongoose, { type Connection } from "mongoose";
import { cryptoUtil } from "../utils/crypto.util";

const mongoUri = process.env["MONGODB_URI"] ?? "";
const masterDb = process.env["MASTER_DB_NAME"] ?? "devvelocity_master";

async function migrateTenant(connection: Connection, databaseName: string) {
  const db = connection.useDb(databaseName, { useCache: true });
  const profiles = db.collection("facultyprofiles");
  const employees = db.collection("hremployees");
  const workloads = db.collection("facultyworkloads");
  for (const collection of [profiles, employees, workloads])
    await collection.updateMany({ isDeleted: { $exists: false } }, { $set: { isDeleted: false } });
  await profiles.updateMany({ createdBy: { $exists: false } }, [
    { $set: { createdBy: "$userId" } },
  ]);
  await employees.updateMany({ createdBy: { $exists: false } }, [
    { $set: { createdBy: "$userId" } },
  ]);
  await workloads.updateMany({ createdBy: { $exists: false } }, [
    { $set: { createdBy: "$facultyId" } },
  ]);

  for await (const workload of workloads.find({})) {
    const teaching = Array.isArray(workload.teachingAssignments)
      ? workload.teachingAssignments
      : [];
    const duties = Array.isArray(workload.extraDuties) ? workload.extraDuties : [];
    const teachingHours = teaching.reduce((sum, item) => sum + Number(item.weeklyHours ?? 0), 0);
    const totalHours =
      teachingHours + duties.reduce((sum, item) => sum + Number(item.weeklyHours ?? 0), 0);
    if (totalHours > 60)
      throw new Error(`${databaseName}: workload ${String(workload._id)} exceeds 60 hours`);
    await workloads.updateOne(
      { _id: workload._id },
      { $set: { totalWeeklyTeachingHours: teachingHours, totalWeeklyHours: totalHours } },
    );
  }

  let encrypted = 0;
  for (const collection of [profiles, employees]) {
    for await (const record of collection.find({})) {
      const set: Record<string, string> = {};
      for (const [path, value] of [
        ["aadhaarNumber", record.aadhaarNumber],
        ["panNumber", record.panNumber],
        ["bankAccountNumber", record.bankAccountNumber],
        ["salaryDetails.panNumber", record.salaryDetails?.panNumber],
        ["salaryDetails.bankAccountNo", record.salaryDetails?.bankAccountNo],
      ] as const) {
        const text = String(value ?? "").replace(/\s/g, "");
        if (
          /^\d{12}$/.test(text) ||
          /^[A-Z]{5}\d{4}[A-Z]$/i.test(text) ||
          /^\d{6,20}$/.test(text)
        ) {
          set[path] = cryptoUtil.encrypt(text.toUpperCase());
          encrypted += 1;
        }
      }
      if (Object.keys(set).length) await collection.updateOne({ _id: record._id }, { $set: set });
    }
  }
  await workloads.createIndex({ facultyId: 1, academicYear: 1, semesterType: 1 }, { unique: true });
  console.info(`Migrated ${databaseName}; encrypted ${encrypted} faculty/HR identifiers`);
}

async function main() {
  if (!mongoUri) throw new Error("MONGODB_URI is required");
  await mongoose.connect(mongoUri, { dbName: masterDb });
  const tenants = await mongoose.connection.collection("tenants").find({}).toArray();
  for (const tenant of tenants)
    await migrateTenant(mongoose.connection, String(tenant.databaseName));
}

main()
  .catch((error) => {
    console.error("Faculty/HR governance migration failed", error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
