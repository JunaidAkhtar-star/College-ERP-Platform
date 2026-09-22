/** Backfills authoritative placement-drive policy, application history, and outcome verification. */
import "dotenv/config";
import mongoose, { type Connection } from "mongoose";

const mongoUri = process.env["MONGODB_URI"] ?? "";
const masterDatabaseName = process.env["MASTER_DB_NAME"] ?? "devvelocity_master";

function academicYearFor(date: Date) {
  const year = date.getUTCFullYear();
  const start = date.getUTCMonth() >= 5 ? year : year - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

async function migrateTenant(connection: Connection, databaseName: string) {
  const tenantDb = connection.useDb(databaseName, { useCache: true });
  const drives = tenantDb.collection("placementdrives");
  const applications = tenantDb.collection("placementapplications");
  const profiles = tenantDb.collection("studentplacementprofiles");
  let migratedDrives = 0;

  for await (const drive of drives.find({})) {
    const legacyApplicationStates = new Map<
      string,
      { studentId: mongoose.Types.ObjectId; status: "registered" | "shortlisted" | "selected" }
    >();
    const collectLegacyStudents = (
      values: unknown,
      status: "registered" | "shortlisted" | "selected",
    ) => {
      if (!Array.isArray(values)) return;
      for (const value of values) {
        const rawId =
          typeof value === "object" && value !== null && "studentId" in value
            ? (value as { studentId: unknown }).studentId
            : value;
        if (!mongoose.isValidObjectId(rawId)) {
          throw new Error(
            `Placement drive ${String(drive._id)} contains an invalid legacy student reference`,
          );
        }
        const studentId = new mongoose.Types.ObjectId(String(rawId));
        legacyApplicationStates.set(String(studentId), { studentId, status });
      }
    };
    collectLegacyStudents(drive.registeredStudents, "registered");
    collectLegacyStudents(drive.shortlistedStudents, "shortlisted");
    collectLegacyStudents(drive.selectedStudents, "selected");
    // A legacy offered marker has no controlled offer evidence, so preserve it as selected.
    collectLegacyStudents(drive.offeredStudents, "selected");

    for (const legacyState of legacyApplicationStates.values()) {
      const existingApplication = await applications.findOne({
        driveId: drive._id,
        studentId: legacyState.studentId,
      });
      if (existingApplication) continue;

      const profile = await profiles.findOne({ studentId: legacyState.studentId });
      if (!profile) {
        throw new Error(
          `Cannot migrate placement drive ${String(drive._id)} student ${String(legacyState.studentId)}: placement profile is missing`,
        );
      }
      const changedBy =
        drive.updatedBy ??
        drive.createdBy ??
        profile.updatedBy ??
        profile.createdBy ??
        legacyState.studentId;
      const migratedAt = new Date(drive.updatedAt ?? drive.createdAt ?? new Date());
      await applications.insertOne({
        driveId: drive._id,
        studentId: legacyState.studentId,
        studentPlacementProfileId: profile._id,
        rollNumber: profile.rollNumber,
        studentName: profile.name,
        program: profile.program,
        branch: profile.branch,
        batch: profile.batch,
        cgpaAtTimeOfApplication: Number(profile.cgpa ?? 0),
        backlogsAtTimeOfApplication: Number(profile.activeBacklogs ?? 0),
        status: legacyState.status,
        registeredAt: new Date(drive.createdAt ?? migratedAt),
        roundResults: [],
        currentRound: 0,
        statusHistory: [
          {
            to: legacyState.status,
            changedBy,
            changedAt: migratedAt,
            reason: "Migrated from the legacy embedded placement-drive lifecycle state",
          },
        ],
        outcomeVerified: false,
        createdBy: changedBy,
        updatedBy: changedBy,
        createdAt: migratedAt,
        updatedAt: migratedAt,
      });
    }

    const driveDate = new Date(drive.driveDate ?? drive.createdAt ?? new Date());
    const fallbackStart = new Date(driveDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    const registrationStartCandidate = new Date(
      drive.registrationStart ?? drive.createdAt ?? fallbackStart,
    );
    const registrationStart =
      registrationStartCandidate <= driveDate ? registrationStartCandidate : fallbackStart;
    const registrationEndCandidate = new Date(drive.registrationEnd ?? driveDate);
    const registrationEnd =
      registrationEndCandidate >= registrationStart && registrationEndCandidate <= driveDate
        ? registrationEndCandidate
        : driveDate;
    const legacyCriteria = (drive.eligibilityCriteria ?? {}) as Record<string, unknown>;
    const rounds = Array.isArray(drive.rounds)
      ? drive.rounds.map((round: Record<string, unknown>, index: number) => ({
          ...round,
          roundNo: index + 1,
          roundName: String(round.roundName ?? `Round ${index + 1}`).trim(),
        }))
      : [];
    await drives.updateOne(
      { _id: drive._id },
      {
        $set: {
          academicYear: /^\d{4}-\d{2}$/.test(String(drive.academicYear ?? ""))
            ? drive.academicYear
            : academicYearFor(driveDate),
          jobRole: drive.jobRole ?? drive.designation ?? "Legacy role",
          registrationStart,
          registrationEnd,
          packageMax: Math.max(Number(drive.packageMax ?? 0), Number(drive.package ?? 0)),
          eligibilityCgpa: drive.eligibilityCgpa ?? legacyCriteria.minCgpa,
          eligibilityBacklogs: drive.eligibilityBacklogs ?? legacyCriteria.maxBacklogs ?? 0,
          eligiblePrograms: Array.isArray(drive.eligiblePrograms)
            ? drive.eligiblePrograms
            : (legacyCriteria.allowedPrograms ?? []),
          eligibleBranches: Array.isArray(drive.eligibleBranches)
            ? drive.eligibleBranches
            : (legacyCriteria.allowedBranches ?? []),
          eligibleBatches: Array.isArray(drive.eligibleBatches)
            ? drive.eligibleBatches
            : (legacyCriteria.allowedBatches ?? []),
          rounds,
        },
        $unset: {
          eligibilityCriteria: "",
          designation: "",
          registeredStudents: "",
          shortlistedStudents: "",
          selectedStudents: "",
          offeredStudents: "",
        },
      },
    );
    migratedDrives += 1;
  }

  await applications.updateMany({ status: "applied" }, { $set: { status: "registered" } });
  await applications.updateMany({}, [
    {
      $set: {
        statusHistory: {
          $cond: [
            { $gt: [{ $size: { $ifNull: ["$statusHistory", []] } }, 0] },
            "$statusHistory",
            [
              {
                to: "$status",
                changedBy: {
                  $ifNull: ["$updatedBy", { $ifNull: ["$createdBy", "$studentId"] }],
                },
                changedAt: { $ifNull: ["$updatedAt", "$createdAt"] },
                reason: "Legacy lifecycle state migrated without independent evidence",
              },
            ],
          ],
        },
        outcomeVerified: { $ifNull: ["$outcomeVerified", false] },
        offerExpiresAt: {
          $cond: [
            { $eq: ["$status", "offered"] },
            { $ifNull: ["$offerExpiresAt", new Date("2099-12-31T23:59:59.999Z")] },
            "$offerExpiresAt",
          ],
        },
      },
    },
  ]);
  await profiles.updateMany({}, [
    {
      $set: {
        placementOutcomeVerified: { $ifNull: ["$placementOutcomeVerified", false] },
        academicSyncedAt: { $ifNull: ["$academicSyncedAt", new Date()] },
      },
    },
  ]);

  await drives.createIndex(
    { academicYear: 1, companyName: 1, jobRole: 1, driveDate: 1 },
    { unique: true, name: "placement_drive_business_key" },
  );
  await applications.createIndex({ status: 1, offerExpiresAt: 1 });
  await profiles.createIndex({ placementOutcomeVerified: 1 });
  console.info(`Migrated ${migratedDrives} placement drives in ${databaseName}`);
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
    console.error("Placement governance migration failed", error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
