import { createHash } from "crypto";
import createError from "http-errors";
import { Types } from "mongoose";
import { AssignmentModel, AssignmentStatus } from "../models/assignment.model";
import { ExternalConnectorModel } from "../models/external-connector.model";
import {
  LmsEntityMappingModel,
  LmsCourseModel,
  LmsCredentialModel,
  LmsEnrollmentModel,
  LmsImportedGradeModel,
  LmsIntegrationProfileModel,
  LmsSyncRunModel,
  type TLmsEntity,
} from "../models/lms-integration.model";
import {
  StudentSectionAllotmentModel,
  StudentSectionAllotmentStatus,
} from "../models/student-section-allotment.model";
import { SubjectModel } from "../models/subject.model";
import { UserModel } from "../models/user.model";
import { SystemRole } from "../constants/roles";
import { assignmentService } from "./assignment.service";
import { externalConnectorService } from "./external-connector.service";

type TScope = "courses" | "rosters" | "assignments" | "grades" | "full";
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const sisId = (entity: string, id: Types.ObjectId | string) => `dv:${entity}:${String(id)}`;
const nextSyncDate = (schedule: "manual" | "hourly" | "daily", from = new Date()) => {
  if (schedule === "manual") return undefined;
  return new Date(from.getTime() + (schedule === "hourly" ? 60 : 24 * 60) * 60 * 1000);
};
async function profileById(id: string) {
  const profile = await LmsIntegrationProfileModel.findById(id).lean();
  if (!profile) throw createError(404, "LMS integration profile not found");
  if (!profile.enabled) throw createError(409, "LMS integration profile is disabled");
  return profile;
}
async function upsertMappings(
  profileId: Types.ObjectId,
  entityType: TLmsEntity,
  rows: Array<{ localId: Types.ObjectId; externalId: string; contentHash: string }>,
) {
  if (!rows.length) return;
  await LmsEntityMappingModel.bulkWrite(
    rows.map((row) => ({
      updateOne: {
        filter: { profileId, entityType, localId: row.localId },
        update: {
          $set: {
            externalId: row.externalId,
            contentHash: row.contentHash,
            lastSyncedAt: new Date(),
          },
        },
        upsert: true,
      },
    })),
  );
}

function connectorRecords(execution: unknown): Array<Record<string, unknown>> {
  const summary = (execution as { resultSummary?: Record<string, unknown> } | null)?.resultSummary;
  const nested = summary?.data as Record<string, unknown> | undefined;
  const rows = summary?.records ?? summary?.courses ?? nested?.records ?? nested?.courses;
  return Array.isArray(rows) ? (rows as Array<Record<string, unknown>>) : [];
}

export const lmsIntegrationService = {
  metadata: async () => ({
    connectors: await ExternalConnectorModel.find({
      provider: { $in: ["canvas_lms", "moodle_lms", "oneroster_1_2", "coursera"] },
    })
      .select("name provider enabled status")
      .sort({ name: 1 })
      .lean(),
    providers: ["canvas_lms", "moodle_lms", "oneroster_1_2", "coursera"],
    standards: ["canonical_v1", "oneroster_1_2", "lti_1_3"],
  }),
  listProfiles: () =>
    LmsIntegrationProfileModel.find()
      .populate("connectorId", "name provider status enabled")
      .sort({ name: 1 })
      .lean(),
  listRuns: (profileId?: string) =>
    LmsSyncRunModel.find({ ...(profileId ? { profileId } : {}) })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean(),
  listPendingGrades: () =>
    LmsImportedGradeModel.find({ status: "pending" })
      .populate("assignmentId", "title subjectCode maxMarks departmentId")
      .populate("studentId", "name email")
      .sort({ importedAt: 1 })
      .limit(500)
      .lean(),
  saveProfile: async (actorId: string, input: Record<string, unknown>, id?: string) => {
    const connectorId = String(input.connectorId ?? "");
    if (!Types.ObjectId.isValid(connectorId))
      throw createError(400, "Select a configured LMS connector");
    const connector = await ExternalConnectorModel.findOne({
      _id: connectorId,
      provider: { $in: ["canvas_lms", "moodle_lms", "oneroster_1_2", "coursera"] },
    }).lean();
    if (!connector) throw createError(400, "Select a configured LMS connector");
    const provider = connector.provider as
      | "canvas_lms"
      | "moodle_lms"
      | "oneroster_1_2"
      | "coursera";
    const standard: "oneroster_1_2" | "canonical_v1" =
      provider === "oneroster_1_2" ? "oneroster_1_2" : "canonical_v1";
    const directions = input.directions as {
      courses: "export" | "disabled";
      rosters: "export" | "disabled";
      assignments: "export" | "disabled";
      grades: "import" | "export" | "bidirectional" | "disabled";
    };
    const lti = input.lti as
      | {
          issuer: string;
          clientId: string;
          deploymentId: string;
          authorizationUrl: string;
          tokenUrl: string;
          jwksUrl: string;
        }
      | undefined;
    const data = {
      name: String(input.name).trim(),
      connectorId: connector._id,
      provider,
      standard,
      academicYear: String(input.academicYear).trim(),
      departmentIds: Array.isArray(input.departmentIds) ? input.departmentIds : [],
      directions,
      enabled: Boolean(input.enabled),
      syncSchedule: (["hourly", "daily"].includes(String(input.syncSchedule))
        ? input.syncSchedule
        : "manual") as "manual" | "hourly" | "daily",
      lti,
      createdBy: actorId,
    };
    const scheduledData = {
      ...data,
      nextSyncAt: data.enabled ? nextSyncDate(data.syncSchedule) : undefined,
    };
    return id
      ? LmsIntegrationProfileModel.findByIdAndUpdate(
          id,
          { $set: scheduledData },
          { returnDocument: "after", runValidators: true },
        ).lean()
      : LmsIntegrationProfileModel.create(scheduledData);
  },
  scope: profileById,
  gradeScope: async (id: string) => {
    const grade = await LmsImportedGradeModel.findById(id).lean();
    if (!grade) throw createError(404, "Imported grade not found");
    const assignment = await AssignmentModel.findById(grade.assignmentId)
      .select("departmentId")
      .lean();
    if (!assignment) throw createError(404, "Mapped assignment not found");
    return { grade, departmentId: assignment.departmentId };
  },
  runExport: async (profileId: string, scope: TScope, actorId: string, idempotencyKey: string) => {
    const prior = await LmsSyncRunModel.findOne({ idempotencyKey }).lean();
    if (prior) return prior;
    const profile = await profileById(profileId);
    const run = await LmsSyncRunModel.create({
      profileId,
      scope,
      direction: "export",
      status: "running",
      idempotencyKey,
      requestedBy: actorId,
      startedAt: new Date(),
      counts: {},
    });
    const scopes =
      scope === "full" ? (["courses", "rosters", "assignments", "grades"] as const) : [scope];
    let examined = 0,
      succeeded = 0,
      skipped = 0;
    const errors: Array<{ entityType: TLmsEntity; code: string; message: string }> = [];
    try {
      for (const current of scopes) {
        if (current === "courses") {
          if (profile.directions.courses === "disabled") {
            skipped += 1;
            continue;
          }
          const subjects = await SubjectModel.find({
            isActive: true,
            ...(profile.departmentIds.length
              ? { departmentId: { $in: profile.departmentIds } }
              : {}),
          })
            .limit(5000)
            .lean();
          const payload = subjects.map((row) => ({
            sisId: sisId("course", row._id),
            code: row.code,
            title: row.name,
            departmentCode: row.departmentCode,
            credits: row.credits,
            academicYear: profile.academicYear,
            status: "active",
          }));
          examined += payload.length;
          if (payload.length)
            await externalConnectorService.execute(
              String(profile.connectorId),
              "lms.course.sync",
              { records: payload, mode: "upsert" },
              `${idempotencyKey}:courses`,
              actorId,
            );
          await upsertMappings(
            profile._id,
            "course",
            subjects.map((row, index) => ({
              localId: row._id,
              externalId: payload[index]!.sisId,
              contentHash: digest(payload[index]),
            })),
          );
          succeeded += payload.length;
        }
        if (current === "rosters") {
          if (profile.directions.rosters === "disabled") {
            skipped += 1;
            continue;
          }
          const rows = await StudentSectionAllotmentModel.find({
            academicYear: profile.academicYear,
            status: StudentSectionAllotmentStatus.ACTIVE,
            ...(profile.departmentIds.length
              ? { departmentId: { $in: profile.departmentIds } }
              : {}),
          })
            .populate("studentId", "name email")
            .limit(10000)
            .lean();
          const payload = rows.map((row) => {
            const user = row.studentId as unknown as {
              _id: Types.ObjectId;
              name?: string;
              email?: string;
            };
            return {
              enrollmentSisId: sisId("enrollment", row._id),
              userSisId: sisId("user", user._id),
              sectionSisId: sisId("section", row.sectionId),
              role: "student",
              name: user.name,
              email: user.email,
              rollNumber: row.rollNo,
              status: "active",
            };
          });
          examined += payload.length;
          for (let index = 0; index < payload.length; index += 500)
            await externalConnectorService.execute(
              String(profile.connectorId),
              "lms.roster.sync",
              { records: payload.slice(index, index + 500), mode: "upsert" },
              `${idempotencyKey}:rosters:${index / 500}`,
              actorId,
            );
          await upsertMappings(
            profile._id,
            "enrollment",
            rows.map((row, index) => ({
              localId: row._id,
              externalId: payload[index]!.enrollmentSisId,
              contentHash: digest(payload[index]),
            })),
          );
          succeeded += payload.length;
        }
        if (current === "assignments") {
          if (profile.directions.assignments === "disabled") {
            skipped += 1;
            continue;
          }
          const rows = await AssignmentModel.find({
            academicYear: profile.academicYear,
            status: {
              $in: [
                AssignmentStatus.PUBLISHED,
                AssignmentStatus.CLOSED,
                AssignmentStatus.EVALUATED,
              ],
            },
            ...(profile.departmentIds.length
              ? { departmentId: { $in: profile.departmentIds } }
              : {}),
          })
            .limit(5000)
            .lean();
          const payload = rows.map((row) => ({
            sisId: sisId("assignment", row._id),
            courseSisId: sisId("course", row.subjectId),
            sectionSisId: sisId("section", row.sectionId),
            title: row.title,
            description: row.description,
            dueAt: row.dueDate.toISOString(),
            maximumScore: row.maxMarks,
            status: row.status,
          }));
          examined += payload.length;
          if (payload.length)
            await externalConnectorService.execute(
              String(profile.connectorId),
              "lms.assignment.sync",
              { records: payload, mode: "upsert" },
              `${idempotencyKey}:assignments`,
              actorId,
            );
          await upsertMappings(
            profile._id,
            "assignment",
            rows.map((row, index) => ({
              localId: row._id,
              externalId: payload[index]!.sisId,
              contentHash: digest(payload[index]),
            })),
          );
          succeeded += payload.length;
        }
        if (current === "grades") {
          if (!["export", "bidirectional"].includes(profile.directions.grades)) {
            skipped += 1;
            continue;
          }
          const rows = await AssignmentModel.find({
            academicYear: profile.academicYear,
            status: AssignmentStatus.EVALUATED,
            ...(profile.departmentIds.length
              ? { departmentId: { $in: profile.departmentIds } }
              : {}),
          })
            .limit(5000)
            .lean();
          const payload = rows.flatMap((row) =>
            row.submissions
              .filter((submission) => submission.evaluatedAt && submission.marks !== undefined)
              .map((submission) => ({
                gradeSisId: sisId("grade", `${row._id}:${submission.studentId}`),
                assignmentSisId: sisId("assignment", row._id),
                userSisId: sisId("user", submission.studentId),
                score: submission.marks,
                maximumScore: row.maxMarks,
                grade: submission.grade,
                feedback: submission.feedback,
                published: true,
              })),
          );
          examined += payload.length;
          for (let index = 0; index < payload.length; index += 500)
            await externalConnectorService.execute(
              String(profile.connectorId),
              "lms.grade.sync",
              { records: payload.slice(index, index + 500), mode: "upsert" },
              `${idempotencyKey}:grades:${index / 500}`,
              actorId,
            );
          succeeded += payload.length;
        }
      }
      run.status = "succeeded";
      await LmsIntegrationProfileModel.updateOne(
        { _id: profile._id },
        {
          $set: {
            lastSyncAt: new Date(),
            nextSyncAt: nextSyncDate(profile.syncSchedule ?? "manual"),
          },
        },
      );
    } catch (error) {
      errors.push({
        entityType: "course",
        code: "PROVIDER_SYNC_FAILED",
        message:
          error instanceof Error ? error.message.slice(0, 1000) : "Provider synchronization failed",
      });
      run.status = succeeded ? "partially_succeeded" : "failed";
    }
    run.counts = { examined, succeeded, skipped, failed: errors.length };
    run.syncErrors = errors;
    run.completedAt = new Date();
    await run.save();
    return run.toObject();
  },
  runDueProfiles: async () => {
    const now = new Date();
    const profiles = await LmsIntegrationProfileModel.find({
      enabled: true,
      syncSchedule: { $in: ["hourly", "daily"] },
      nextSyncAt: { $lte: now },
    })
      .limit(50)
      .lean();
    const results = [];
    for (const profile of profiles) {
      const bucket = now.toISOString().slice(0, profile.syncSchedule === "hourly" ? 13 : 10);
      results.push(
        await lmsIntegrationService.runExport(
          String(profile._id),
          "full",
          String(profile.createdBy),
          `lms:schedule:${profile._id}:${bucket}`,
        ),
      );
    }
    return results;
  },
  retryRun: async (runId: string, actorId: string) => {
    const prior = await LmsSyncRunModel.findById(runId).lean();
    if (!prior) throw createError(404, "LMS synchronization run not found");
    if (!["failed", "partially_succeeded"].includes(prior.status))
      throw createError(409, "Only failed or partially completed runs can be retried");
    return lmsIntegrationService.runExport(
      String(prior.profileId),
      prior.scope,
      actorId,
      `lms:retry:${prior._id}:${Date.now()}`,
    );
  },
  listCourses: async (query: Record<string, unknown>) => {
    const search = String(query.search ?? "").trim();
    const profileId = String(query.profileId ?? "").trim();
    return LmsCourseModel.find({
      status: "active",
      ...(Types.ObjectId.isValid(profileId) ? { profileId } : {}),
      ...(search
        ? {
            $or: [
              { title: { $regex: search, $options: "i" } },
              { skills: { $regex: search, $options: "i" } },
            ],
          }
        : {}),
    })
      .populate("profileId", "name provider")
      .sort({ title: 1 })
      .limit(500)
      .lean();
  },
  importCourses: async (profileId: string, records: Array<Record<string, unknown>>) => {
    const profile = await profileById(profileId);
    if (!records.length || records.length > 1000)
      throw createError(400, "Import 1-1000 courses at a time");
    await LmsCourseModel.bulkWrite(
      records.map((record) => ({
        updateOne: {
          filter: { profileId: profile._id, externalCourseId: String(record.externalCourseId) },
          update: {
            $set: {
              provider: profile.provider,
              title: String(record.title).trim(),
              description: String(record.description ?? "").trim() || undefined,
              courseUrl: String(record.courseUrl ?? "").trim() || undefined,
              skills: Array.isArray(record.skills)
                ? record.skills
                    .map(String)
                    .map((item) => item.trim())
                    .filter(Boolean)
                    .slice(0, 100)
                : [],
              durationHours:
                record.durationHours === undefined ? undefined : Number(record.durationHours),
              certificateAvailable: Boolean(record.certificateAvailable),
              status: record.status === "archived" ? "archived" : "active",
              lastSyncedAt: new Date(),
            },
          },
          upsert: true,
        },
      })),
    );
    return { imported: records.length };
  },
  syncProviderCatalog: async (profileId: string, actorId: string) => {
    const profile = await profileById(profileId);
    const execution = await externalConnectorService.execute(
      String(profile.connectorId),
      "lms.catalog.read",
      { academicYear: profile.academicYear, departmentIds: profile.departmentIds },
      `lms:catalog:${profile._id}:${new Date().toISOString().slice(0, 13)}`,
      actorId,
    );
    const records = connectorRecords(execution);
    if (!records.length)
      throw createError(
        502,
        "The provider returned no catalogue records. Confirm its API scope and response mapping.",
      );
    return lmsIntegrationService.importCourses(profileId, records);
  },
  assignCourse: async (courseId: string, studentIds: string[], actorId: string) => {
    const course = await LmsCourseModel.findById(courseId).lean();
    if (!course || course.status !== "active") throw createError(404, "LMS course not found");
    const profile = await profileById(String(course.profileId));
    const uniqueStudentIds = [...new Set(studentIds)];
    if (!uniqueStudentIds.length || uniqueStudentIds.length > 500)
      throw createError(400, "Select 1-500 students");
    if (uniqueStudentIds.some((id) => !Types.ObjectId.isValid(id)))
      throw createError(400, "One or more selected students are invalid");
    const students = await UserModel.find({
      _id: { $in: uniqueStudentIds },
      roles: SystemRole.STUDENT,
    })
      .select("_id name email")
      .lean();
    if (students.length !== uniqueStudentIds.length)
      throw createError(400, "One or more selected students are unavailable");
    await externalConnectorService.execute(
      String(profile.connectorId),
      "lms.roster.sync",
      {
        mode: "enroll",
        course: { externalCourseId: course.externalCourseId, title: course.title },
        records: students.map((student) => ({
          userSisId: sisId("user", student._id),
          name: student.name,
          email: student.email,
          role: "student",
        })),
      },
      `lms:enroll:${course._id}:${digest(uniqueStudentIds.sort()).slice(0, 20)}`,
      actorId,
    );
    await LmsEnrollmentModel.bulkWrite(
      students.map((student) => ({
        updateOne: {
          filter: { profileId: profile._id, courseId: course._id, studentId: student._id },
          update: {
            $setOnInsert: {
              assignedBy: new Types.ObjectId(actorId),
              status: "assigned",
              progressPercent: 0,
              learningHours: 0,
            },
          },
          upsert: true,
        },
      })),
    );
    return { assigned: students.length };
  },
  listEnrollments: async (query: Record<string, unknown>) => {
    const studentId = String(query.studentId ?? "");
    const courseId = String(query.courseId ?? "");
    return LmsEnrollmentModel.find({
      ...(Types.ObjectId.isValid(studentId) ? { studentId } : {}),
      ...(Types.ObjectId.isValid(courseId) ? { courseId } : {}),
    })
      .populate("courseId", "title provider externalCourseId certificateAvailable")
      .populate("studentId", "name email")
      .sort({ updatedAt: -1 })
      .limit(1000)
      .lean();
  },
  importProgress: async (profileId: string, records: Array<Record<string, unknown>>) => {
    const profile = await profileById(profileId);
    if (!records.length || records.length > 1000)
      throw createError(400, "Import 1-1000 progress records at a time");
    let updated = 0;
    let credentials = 0;
    for (const record of records) {
      const course = await LmsCourseModel.findOne({
        profileId: profile._id,
        externalCourseId: String(record.externalCourseId),
      }).lean();
      const studentId = String(record.studentId ?? "");
      if (!course || !Types.ObjectId.isValid(studentId)) continue;
      const progressPercent = Math.min(100, Math.max(0, Number(record.progressPercent ?? 0)));
      const status =
        progressPercent >= 100 ? "completed" : progressPercent > 0 ? "in_progress" : "enrolled";
      const enrollment = await LmsEnrollmentModel.findOneAndUpdate(
        { profileId: profile._id, courseId: course._id, studentId },
        {
          $set: {
            providerEnrollmentId: String(record.providerEnrollmentId ?? "").trim() || undefined,
            status,
            progressPercent,
            learningHours: Math.max(0, Number(record.learningHours ?? 0)),
            enrolledAt: record.enrolledAt ? new Date(String(record.enrolledAt)) : undefined,
            completedAt:
              status === "completed"
                ? record.completedAt
                  ? new Date(String(record.completedAt))
                  : new Date()
                : undefined,
            lastSyncedAt: new Date(),
          },
          $setOnInsert: { assignedBy: profile.createdBy },
        },
        { upsert: true, returnDocument: "after", runValidators: true },
      );
      updated += 1;
      const credential = record.credential as Record<string, unknown> | undefined;
      if (enrollment && credential?.externalCredentialId) {
        await LmsCredentialModel.updateOne(
          { profileId: profile._id, externalCredentialId: String(credential.externalCredentialId) },
          {
            $set: {
              enrollmentId: enrollment._id,
              courseId: course._id,
              studentId,
              type: credential.type === "badge" ? "badge" : "certificate",
              title: String(credential.title ?? course.title).trim(),
              issuedAt: credential.issuedAt ? new Date(String(credential.issuedAt)) : new Date(),
              credentialUrl: String(credential.credentialUrl ?? "").trim() || undefined,
              verificationUrl: String(credential.verificationUrl ?? "").trim() || undefined,
            },
          },
          { upsert: true, runValidators: true },
        );
        credentials += 1;
      }
    }
    return { updated, credentials, skipped: records.length - updated };
  },
  syncProviderProgress: async (profileId: string, actorId: string) => {
    const profile = await profileById(profileId);
    const execution = await externalConnectorService.execute(
      String(profile.connectorId),
      "lms.progress.read",
      { academicYear: profile.academicYear, includeCredentials: true },
      `lms:progress:${profile._id}:${new Date().toISOString().slice(0, 13)}`,
      actorId,
    );
    const records = connectorRecords(execution);
    if (!records.length)
      throw createError(
        502,
        "The provider returned no progress records. Confirm its reporting API scope.",
      );
    return lmsIntegrationService.importProgress(profileId, records);
  },
  listCredentials: async (query: Record<string, unknown>) => {
    const studentId = String(query.studentId ?? "");
    return LmsCredentialModel.find({
      ...(Types.ObjectId.isValid(studentId) ? { studentId } : {}),
    })
      .populate("courseId", "title provider")
      .populate("studentId", "name email")
      .sort({ issuedAt: -1 })
      .limit(1000)
      .lean();
  },
  importGrades: async (
    profileId: string,
    records: Array<{
      externalGradeId: string;
      assignmentExternalId: string;
      userExternalId: string;
      score: number;
      maximumScore: number;
      feedback?: string;
    }>,
  ) => {
    const profile = await profileById(profileId);
    if (!["import", "bidirectional"].includes(profile.directions.grades))
      throw createError(409, "Grade import is disabled for this profile");
    if (!records.length || records.length > 1000)
      throw createError(400, "Import 1-1000 grade records at a time");
    const assignmentIds = [...new Set(records.map((row) => row.assignmentExternalId))],
      userIds = [...new Set(records.map((row) => row.userExternalId))];
    const mappings = await LmsEntityMappingModel.find({
      profileId,
      $or: [
        { entityType: "assignment", externalId: { $in: assignmentIds } },
        { entityType: "user", externalId: { $in: userIds } },
      ],
    }).lean();
    const map = new Map(
      mappings.map((row) => [`${row.entityType}:${row.externalId}`, row.localId]),
    );
    let staged = 0;
    const errors: Array<{ externalGradeId: string; message: string }> = [];
    for (const row of records) {
      const assignmentId = map.get(`assignment:${row.assignmentExternalId}`);
      const rawUserId = row.userExternalId.startsWith("dv:user:")
        ? row.userExternalId.slice(8)
        : "";
      const studentId =
        map.get(`user:${row.userExternalId}`) ??
        (Types.ObjectId.isValid(rawUserId) ? new Types.ObjectId(rawUserId) : undefined);
      if (
        !assignmentId ||
        !studentId ||
        !Number.isFinite(row.score) ||
        !Number.isFinite(row.maximumScore) ||
        row.maximumScore <= 0 ||
        row.score < 0 ||
        row.score > row.maximumScore
      ) {
        errors.push({
          externalGradeId: row.externalGradeId,
          message: "Grade mapping or score is invalid",
        });
        continue;
      }
      await LmsImportedGradeModel.updateOne(
        { profileId, externalGradeId: row.externalGradeId },
        {
          $setOnInsert: {
            assignmentId,
            studentId,
            score: row.score,
            maximumScore: row.maximumScore,
            feedback: row.feedback,
            status: "pending",
            importedAt: new Date(),
          },
        },
        { upsert: true },
      );
      staged += 1;
    }
    return { received: records.length, staged, errors };
  },
  reviewGrade: async (
    id: string,
    actorId: string,
    decision: "apply" | "reject",
    reason?: string,
  ) => {
    const row = await LmsImportedGradeModel.findOne({ _id: id, status: "pending" });
    if (!row) throw createError(409, "Imported grade is no longer awaiting review");
    if (decision === "reject") {
      if (String(reason ?? "").trim().length < 3)
        throw createError(400, "A rejection reason is required");
      row.status = "rejected";
      row.rejectionReason = String(reason).trim();
      row.reviewedBy = new Types.ObjectId(actorId);
      row.reviewedAt = new Date();
      await row.save();
      return row.toObject();
    }
    const assignment = await AssignmentModel.findById(row.assignmentId)
      .select("maxMarks departmentId")
      .lean();
    if (!assignment) throw createError(404, "Mapped assignment not found");
    const normalized = Number(((row.score / row.maximumScore) * assignment.maxMarks).toFixed(2));
    await assignmentService.gradeSubmission(
      String(row.assignmentId),
      String(row.studentId),
      normalized,
      row.feedback ?? "Imported from LMS and reviewed",
      actorId,
    );
    row.status = "applied";
    row.reviewedBy = new Types.ObjectId(actorId);
    row.reviewedAt = new Date();
    await row.save();
    return row.toObject();
  },
};
