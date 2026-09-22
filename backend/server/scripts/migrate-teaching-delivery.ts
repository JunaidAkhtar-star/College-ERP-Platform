/** Backfills authoritative lesson-plan scope and evidence-aware course progress. */
import "dotenv/config";
import mongoose, { type Connection } from "mongoose";

const mongoUri = process.env["MONGODB_URI"] ?? "";
const masterDatabaseName = process.env["MASTER_DB_NAME"] ?? "devvelocity_master";
const VALID_PLAN_STATUSES = new Set(["draft", "submitted", "approved", "rejected"]);

async function dropIndexIfPresent(collection: mongoose.mongo.Collection, name: string) {
  const indexes = await collection.indexes();
  if (indexes.some((index) => index.name === name)) await collection.dropIndex(name);
}

async function migrateTenant(connection: Connection, databaseName: string) {
  const tenantDb = connection.useDb(databaseName, { useCache: true });
  const plans = tenantDb.collection("lessonplans");
  const progressRecords = tenantDb.collection("courseprogresses");
  const sections = tenantDb.collection("sections");
  let migratedPlans = 0;

  for await (const plan of plans.find({})) {
    let sectionId = plan.sectionId;
    let curriculumId = plan.curriculumId;
    if (!sectionId) {
      const matches = await sections
        .find({
          departmentId: plan.departmentId,
          program: plan.program,
          semesterNo: plan.semester,
          sectionName: String(plan.section ?? "").toUpperCase(),
          academicYear: plan.academicYear,
        })
        .project({ _id: 1, curriculumId: 1 })
        .limit(2)
        .toArray();
      if (matches.length !== 1) {
        throw new Error(
          `${databaseName}: lesson plan ${String(plan._id)} has ${matches.length} matching sections`,
        );
      }
      sectionId = matches[0]._id;
      curriculumId = matches[0].curriculumId;
    }
    const status = VALID_PLAN_STATUSES.has(String(plan.status)) ? plan.status : "draft";
    const totalPlannedClasses = Array.isArray(plan.unitPlans)
      ? plan.unitPlans.reduce(
          (sum: number, unit: Record<string, unknown>) =>
            sum + Math.max(0, Number(unit.plannedClasses ?? 0)),
          0,
        )
      : 0;
    await plans.updateOne(
      { _id: plan._id },
      {
        $set: {
          sectionId,
          curriculumId,
          status,
          reviewHistory: Array.isArray(plan.reviewHistory) ? plan.reviewHistory : [],
          totalUnits: Array.isArray(plan.unitPlans) ? plan.unitPlans.length : 0,
          totalPlannedClasses,
        },
      },
    );
    migratedPlans += 1;

    let progress = await progressRecords.findOne({
      $or: [
        { lessonPlanId: plan._id },
        {
          academicYear: plan.academicYear,
          subjectId: plan.subjectId,
          facultyId: plan.facultyId,
          section: plan.section,
        },
      ],
    });
    if (status === "approved" && !progress) {
      const inserted = await progressRecords.insertOne({
        lessonPlanId: plan._id,
        sectionId,
        curriculumId,
        academicYear: plan.academicYear,
        semesterType: plan.semesterType,
        subjectId: plan.subjectId,
        subjectCode: plan.subjectCode,
        subjectName: plan.subjectName,
        facultyId: plan.facultyId,
        departmentId: plan.departmentId,
        program: plan.program,
        semester: plan.semester,
        section: plan.section,
        totalPlanedClasses: totalPlannedClasses,
        totalConductedClasses: 0,
        completionPercentage: 0,
        topicEntries: [],
        isComplete: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      progress = await progressRecords.findOne({ _id: inserted.insertedId });
    }
    if (progress) {
      const entries = Array.isArray(progress.topicEntries)
        ? progress.topicEntries.map((entry: Record<string, unknown>) => ({
            ...entry,
            plannedTopic: entry.plannedTopic ?? entry.topicCovered ?? "Legacy topic",
            attendanceRecordIds: Array.isArray(entry.attendanceRecordIds)
              ? entry.attendanceRecordIds
              : [],
            coMappings: Array.isArray(entry.coMappings) ? entry.coMappings : [],
            evidenceVerified:
              entry.evidenceVerified === true &&
              Array.isArray(entry.attendanceRecordIds) &&
              entry.attendanceRecordIds.length > 0,
          }))
        : [];
      const verifiedClasses = entries
        .filter((entry: Record<string, unknown>) => entry.evidenceVerified)
        .reduce(
          (sum: number, entry: Record<string, unknown>) => sum + Number(entry.noOfClasses ?? 0),
          0,
        );
      const plannedClasses = totalPlannedClasses;
      await progressRecords.updateOne(
        { _id: progress._id },
        {
          $set: {
            lessonPlanId: plan._id,
            sectionId,
            curriculumId,
            topicEntries: entries,
            totalPlanedClasses: plannedClasses,
            totalConductedClasses: verifiedClasses,
            completionPercentage: plannedClasses
              ? Math.min(100, Number(((verifiedClasses / plannedClasses) * 100).toFixed(2)))
              : 0,
            isComplete: false,
          },
          $unset: { completedAt: "" },
        },
      );
    }
  }

  await dropIndexIfPresent(plans, "academicYear_1_subjectId_1_facultyId_1_section_1");
  await plans.createIndex(
    { academicYear: 1, subjectId: 1, facultyId: 1, sectionId: 1 },
    { unique: true, name: "lesson_plan_authoritative_class" },
  );
  await dropIndexIfPresent(progressRecords, "academicYear_1_subjectId_1_facultyId_1_section_1");
  await progressRecords.createIndex(
    { lessonPlanId: 1 },
    { unique: true, name: "progress_lesson_plan_unique" },
  );
  await progressRecords.createIndex(
    { academicYear: 1, subjectId: 1, facultyId: 1, sectionId: 1 },
    { unique: true, name: "progress_authoritative_class" },
  );
  console.info(
    `Migrated ${migratedPlans} lesson plans and linked course progress in ${databaseName}`,
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
    console.error("Teaching-delivery migration failed", error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
