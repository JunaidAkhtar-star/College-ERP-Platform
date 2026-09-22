import createError from "http-errors";
import { Types } from "mongoose";
import { courseProgressRepository } from "../repositories";
import { AttendanceRecordModel } from "../models/attendance.model";
import { CourseProgressModel } from "../models/course-progress.model";
import { LessonPlanModel, type IUnitPlan } from "../models/lesson-plan.model";

type ProgressTopic = {
  unitNo: number;
  plannedTopic: string;
  noOfClasses: number;
  evidenceVerified?: boolean;
};

export function calculateCourseCompletion(
  units: Array<Pick<IUnitPlan, "unitNo" | "plannedTopics" | "plannedClasses">>,
  entries: ProgressTopic[],
) {
  const verifiedEntries = entries.filter((entry) => entry.evidenceVerified !== false);
  const unitProgress = units.map((unit) => {
    const entriesForUnit = verifiedEntries.filter((entry) => entry.unitNo === unit.unitNo);
    const covered = new Set(
      entriesForUnit.map((entry) => entry.plannedTopic.trim().replace(/\s+/g, " ").toLowerCase()),
    );
    const actualClasses = entriesForUnit.reduce((sum, entry) => sum + entry.noOfClasses, 0);
    const allTopicsCovered = unit.plannedTopics.every((topic) =>
      covered.has(topic.trim().replace(/\s+/g, " ").toLowerCase()),
    );
    return {
      unitNo: unit.unitNo,
      actualClasses,
      isComplete: allTopicsCovered && actualClasses >= unit.plannedClasses,
    };
  });
  const totalPlanned = units.reduce((sum, unit) => sum + unit.plannedClasses, 0);
  const totalConducted = verifiedEntries.reduce((sum, entry) => sum + entry.noOfClasses, 0);
  return {
    unitProgress,
    totalConducted,
    completionPercentage: totalPlanned
      ? Number(Math.min(100, (totalConducted / totalPlanned) * 100).toFixed(2))
      : 0,
    isComplete: unitProgress.length > 0 && unitProgress.every((unit) => unit.isComplete),
  };
}

function dayBounds(value: unknown) {
  const raw = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw createError(400, "Valid class date is required");
  const start = new Date(`${raw}T00:00:00.000+05:30`);
  const end = new Date(`${raw}T23:59:59.999+05:30`);
  if (!Number.isFinite(start.getTime())) throw createError(400, "Valid class date is required");
  return { start, end };
}

export const courseProgressService = {
  getAll: (filter: Record<string, unknown>, page: number, limit: number) =>
    courseProgressRepository.list(filter, page, limit),

  getById: (id: string) => courseProgressRepository.findById(id),

  addTopic: async (id: string, facultyId: string, input: Record<string, unknown>) => {
    const progress = await CourseProgressModel.findById(id).lean();
    if (!progress) throw createError(404, "Course progress not found");
    if (String(progress.facultyId) !== facultyId)
      throw createError(403, "Only the assigned faculty can record course delivery");
    if (progress.isComplete) throw createError(409, "Completed course progress is locked");
    const lessonPlan = await LessonPlanModel.findOne({
      _id: progress.lessonPlanId,
      status: "approved",
    }).lean();
    if (!lessonPlan) throw createError(409, "An approved lesson plan is required");
    const unitNo = Number(input.unitNo);
    const unit = lessonPlan.unitPlans.find((row) => row.unitNo === unitNo);
    if (!unit) throw createError(400, "Unit is outside the approved lesson plan");
    const plannedTopic = String(input.plannedTopic ?? input.topicCovered ?? "").trim();
    const canonicalTopic = unit.plannedTopics.find(
      (topic) =>
        topic.trim().replace(/\s+/g, " ").toLowerCase() ===
        plannedTopic.replace(/\s+/g, " ").toLowerCase(),
    );
    if (!canonicalTopic) throw createError(400, "Topic is outside the approved unit plan");
    const topicCovered = String(input.topicCovered ?? canonicalTopic).trim();
    if (!topicCovered || topicCovered.length > 2000)
      throw createError(400, "Valid topic coverage notes are required");
    const { start, end } = dayBounds(input.date);
    const requestedIds = Array.isArray(input.attendanceRecordIds)
      ? input.attendanceRecordIds.map(String)
      : [];
    if (requestedIds.some((recordId) => !Types.ObjectId.isValid(recordId)))
      throw createError(400, "Invalid attendance evidence ID");
    const attendanceFilter: Record<string, unknown> = {
      sectionId: progress.sectionId,
      subjectId: progress.subjectId,
      facultyId: progress.facultyId,
      academicYear: progress.academicYear,
      date: { $gte: start, $lte: end },
      totalStrength: { $gt: 0 },
      ...(requestedIds.length ? { _id: { $in: requestedIds } } : {}),
    };
    const attendanceRecords = await AttendanceRecordModel.find(attendanceFilter)
      .select("_id date")
      .lean();
    if (
      !attendanceRecords.length ||
      (requestedIds.length && attendanceRecords.length !== requestedIds.length)
    )
      throw createError(400, "Matching attendance evidence is required for every recorded class");
    const evidenceIds = attendanceRecords.map((record) => String(record._id));
    const alreadyUsed = progress.topicEntries.some((entry) =>
      entry.attendanceRecordIds.some((recordId) => evidenceIds.includes(String(recordId))),
    );
    if (alreadyUsed) throw createError(409, "Attendance evidence has already been used");
    const topicEntry = {
      date: start,
      unitNo,
      plannedTopic: canonicalTopic,
      topicCovered,
      noOfClasses: evidenceIds.length,
      attendanceRecordIds: evidenceIds,
      coMappings: unit.coMappings,
      evidenceVerified: true,
      teachingMethod: input.teachingMethod ? String(input.teachingMethod).trim() : undefined,
      remarks: input.remarks ? String(input.remarks).trim() : undefined,
    };

    const session = await CourseProgressModel.db.startSession();
    try {
      let updated;
      await session.withTransaction(async () => {
        updated = await CourseProgressModel.findOneAndUpdate(
          {
            _id: id,
            facultyId,
            isComplete: false,
            "topicEntries.attendanceRecordIds": { $nin: evidenceIds },
          },
          { $push: { topicEntries: topicEntry } },
          { returnDocument: "after", runValidators: true, session },
        ).lean();
        if (!updated) throw createError(409, "Course progress was concurrently changed");
        const metrics = calculateCourseCompletion(lessonPlan.unitPlans, updated.topicEntries);
        updated = await CourseProgressModel.findByIdAndUpdate(
          id,
          {
            $set: {
              totalConductedClasses: metrics.totalConducted,
              completionPercentage: metrics.completionPercentage,
              isComplete: metrics.isComplete,
              ...(metrics.isComplete ? { completedAt: new Date() } : {}),
            },
          },
          { returnDocument: "after", runValidators: true, session },
        ).lean();
        await LessonPlanModel.bulkWrite(
          metrics.unitProgress.map((unitMetric) => ({
            updateOne: {
              filter: { _id: lessonPlan._id, "unitPlans.unitNo": unitMetric.unitNo },
              update: {
                $set: {
                  "unitPlans.$.actualClasses": unitMetric.actualClasses,
                  "unitPlans.$.isComplete": unitMetric.isComplete,
                },
              },
            },
          })),
          { session },
        );
      });
      return updated;
    } finally {
      await session.endSession();
    }
  },
};
