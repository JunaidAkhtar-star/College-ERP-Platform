import createError from "http-errors";
import { Types } from "mongoose";
import {
  BatchModel,
  AdmissionApplicationModel,
  SectionModel,
  SectionStatus,
  StudentProfileModel,
  StudentSectionAllotmentModel,
  StudentSectionAllotmentStatus,
  StudentStatus,
} from "../models";
import { studentSectionAllotmentRepository } from "../repositories";

async function loadOpenSection(sectionId: string) {
  if (!Types.ObjectId.isValid(sectionId)) throw createError(400, "Valid section is required");
  const section = await SectionModel.findById(sectionId).lean();
  if (!section) throw createError(404, "Section not found");
  if (section.status !== SectionStatus.ACTIVE)
    throw createError(409, "Students can be allotted only to an active section");
  return section;
}

async function validateStudentForSection(
  studentId: string,
  section: Awaited<ReturnType<typeof loadOpenSection>>,
) {
  if (!Types.ObjectId.isValid(studentId)) throw createError(400, "Valid student is required");
  const [student, batch] = await Promise.all([
    StudentProfileModel.findOne({ userId: studentId }).lean(),
    BatchModel.findById(section.batchId).lean(),
  ]);
  if (!student) throw createError(404, "Student profile not found");
  if (!batch) throw createError(409, "Section batch configuration is missing");
  if (student.status !== StudentStatus.ACTIVE)
    throw createError(409, "Only an active student can be allotted");
  if (
    String(student.department) !== String(section.departmentId) ||
    student.program !== section.program ||
    Number.parseInt(student.batch, 10) !== batch.admissionYear
  )
    throw createError(400, "Student does not belong to the section cohort");
  return student;
}

function meaningfulReason(reason: string, action: string) {
  const value = String(reason ?? "").trim();
  if (value.length < 5)
    throw createError(400, `${action} reason must contain at least 5 characters`);
  return value;
}

export type BulkAllotmentStrategy = "sequential" | "balanced" | "merit_rank";

type PlanningSection = { id: string; name: string; capacity: number; allottedCount: number };
type PlanningStudent = { userId: string; rollNumber: string; meritRank?: number };

export function planBulkAllotments(
  students: PlanningStudent[],
  sections: PlanningSection[],
  strategy: BulkAllotmentStrategy,
) {
  const orderedSections = [...sections].sort((a, b) => a.name.localeCompare(b.name));
  const orderedStudents = [...students].sort((a, b) => {
    if (strategy === "merit_rank") {
      const rankA = a.meritRank ?? Number.MAX_SAFE_INTEGER;
      const rankB = b.meritRank ?? Number.MAX_SAFE_INTEGER;
      if (rankA !== rankB) return rankA - rankB;
    }
    return a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true });
  });
  const projected = new Map(orderedSections.map((section) => [section.id, section.allottedCount]));
  const assignments: Array<PlanningStudent & { sectionId: string; sectionName: string }> = [];
  const unassigned: PlanningStudent[] = [];

  for (const student of orderedStudents) {
    const available = orderedSections.filter(
      (section) => (projected.get(section.id) ?? 0) < section.capacity,
    );
    if (!available.length) {
      unassigned.push(student);
      continue;
    }
    const target =
      strategy === "balanced"
        ? [...available].sort((a, b) => {
            const countDifference = (projected.get(a.id) ?? 0) - (projected.get(b.id) ?? 0);
            return countDifference || a.name.localeCompare(b.name);
          })[0]
        : available[0];
    projected.set(target.id, (projected.get(target.id) ?? 0) + 1);
    assignments.push({ ...student, sectionId: target.id, sectionName: target.name });
  }

  return {
    assignments,
    unassigned,
    sections: orderedSections.map((section) => ({
      ...section,
      plannedCount: projected.get(section.id) ?? section.allottedCount,
      newStudents: (projected.get(section.id) ?? section.allottedCount) - section.allottedCount,
    })),
  };
}

async function buildBulkPlan(data: {
  batchId: string;
  academicYear: string;
  semesterNo: number;
  strategy: BulkAllotmentStrategy;
}) {
  const batch = await BatchModel.findById(data.batchId).lean();
  if (!batch) throw createError(404, "Batch not found");
  const sections = await SectionModel.find({
    batchId: batch._id,
    academicYear: data.academicYear,
    semesterNo: data.semesterNo,
    status: SectionStatus.ACTIVE,
  })
    .sort({ sectionName: 1 })
    .lean();
  if (!sections.length)
    throw createError(409, "Create and activate at least one section for this cohort first");

  const sectionIds = sections.map((section) => section._id);
  const cohortAllotments = await StudentSectionAllotmentModel.find({
    sectionId: { $in: sectionIds },
    batchId: batch._id,
    academicYear: data.academicYear,
    semesterNo: data.semesterNo,
    status: StudentSectionAllotmentStatus.ACTIVE,
  })
    .select("studentId sectionId")
    .lean();
  const allottedStudentIds = new Set(cohortAllotments.map((row) => String(row.studentId)));
  const allottedBySection = new Map<string, number>();
  for (const allotment of cohortAllotments) {
    const sectionId = String(allotment.sectionId);
    allottedBySection.set(sectionId, (allottedBySection.get(sectionId) ?? 0) + 1);
  }

  const students = await StudentProfileModel.find({
    status: StudentStatus.ACTIVE,
    department: batch.departmentId,
    program: batch.program,
    batch: String(batch.admissionYear),
  })
    .select("userId rollNumber admissionApplicationId")
    .lean();
  const eligibleStudents = students.filter(
    (student) => !allottedStudentIds.has(String(student.userId)),
  );
  const admissionIds = eligibleStudents
    .map((student) => student.admissionApplicationId)
    .filter((id): id is Types.ObjectId => Boolean(id));
  const admissions = await AdmissionApplicationModel.find({ _id: { $in: admissionIds } })
    .select("meritRank")
    .lean();
  const meritByAdmission = new Map(admissions.map((row) => [String(row._id), row.meritRank]));
  const plan = planBulkAllotments(
    eligibleStudents.map((student) => ({
      userId: String(student.userId),
      rollNumber: student.rollNumber,
      meritRank: student.admissionApplicationId
        ? meritByAdmission.get(String(student.admissionApplicationId))
        : undefined,
    })),
    sections.map((section) => ({
      id: String(section._id),
      name: section.sectionName,
      capacity: section.capacity,
      allottedCount: allottedBySection.get(String(section._id)) ?? 0,
    })),
    data.strategy,
  );
  return {
    batch,
    eligibleCount: eligibleStudents.length,
    alreadyAllotted: cohortAllotments.length,
    ...plan,
  };
}

export const studentSectionAllotmentService = {
  list: (filter: Record<string, unknown>, page: number, limit: number) =>
    studentSectionAllotmentRepository.list(filter, page, Math.min(limit, 100)),

  getById: async (id: string) => {
    const allotment = await studentSectionAllotmentRepository.findById(id);
    if (!allotment) throw createError(404, "Student section allotment not found");
    return allotment;
  },

  previewBulk: async (data: Parameters<typeof buildBulkPlan>[0], scopedDepartmentId?: string) => {
    const plan = await buildBulkPlan(data);
    if (scopedDepartmentId && String(plan.batch.departmentId) !== scopedDepartmentId)
      throw createError(403, "You can manage only your department allotments");
    return plan;
  },

  executeBulk: async (
    data: Parameters<typeof buildBulkPlan>[0],
    createdBy: string,
    scopedDepartmentId?: string,
  ) => {
    const plan = await buildBulkPlan(data);
    if (scopedDepartmentId && String(plan.batch.departmentId) !== scopedDepartmentId)
      throw createError(403, "You can manage only your department allotments");
    if (plan.unassigned.length)
      throw createError(
        409,
        `Section capacity is short by ${plan.unassigned.length}. Increase capacity or add a section before confirming.`,
      );
    const created = [];
    for (const assignment of plan.assignments) {
      created.push(
        await studentSectionAllotmentService.allot(
          {
            studentId: assignment.userId,
            sectionId: assignment.sectionId,
            rollNo: assignment.rollNumber,
          },
          createdBy,
          scopedDepartmentId,
        ),
      );
    }
    return { created: created.length, strategy: data.strategy, sections: plan.sections };
  },

  allot: async (
    data: {
      sectionId: string;
      studentId: string;
      rollNo?: string;
      validFrom?: Date | string;
    },
    createdBy: string,
    scopedDepartmentId?: string,
  ) => {
    const section = await loadOpenSection(data.sectionId);
    if (scopedDepartmentId && String(section.departmentId) !== scopedDepartmentId)
      throw createError(403, "You can manage only your department allotments");
    const student = await validateStudentForSection(data.studentId, section);
    const session = await StudentSectionAllotmentModel.db.startSession();
    let created;
    try {
      await session.withTransaction(async () => {
        const reserved = await SectionModel.findOneAndUpdate(
          {
            _id: section._id,
            status: SectionStatus.ACTIVE,
            $expr: { $lt: [{ $ifNull: ["$allottedCount", 0] }, "$capacity"] },
          },
          { $inc: { allottedCount: 1 } },
          { returnDocument: "after", session },
        );
        if (!reserved) throw createError(409, "Section is full or no longer active");
        const [allotment] = await StudentSectionAllotmentModel.create(
          [
            {
              studentId: student.userId,
              studentProfileId: student._id,
              sectionId: section._id,
              batchId: section.batchId,
              curriculumId: section.curriculumId,
              departmentId: section.departmentId,
              academicYear: section.academicYear,
              semesterNo: section.semesterNo,
              rollNo: String(data.rollNo || student.rollNumber).trim(),
              status: StudentSectionAllotmentStatus.ACTIVE,
              validFrom: data.validFrom ? new Date(data.validFrom) : new Date(),
              createdBy: new Types.ObjectId(createdBy),
            },
          ],
          { session },
        );
        const profileUpdate = await StudentProfileModel.updateOne(
          { _id: student._id, status: StudentStatus.ACTIVE },
          {
            $set: {
              academicYear: section.academicYear,
              currentSemester: section.semesterNo,
              section: section.sectionName,
              updatedBy: new Types.ObjectId(createdBy),
            },
          },
          { session },
        );
        if (profileUpdate.matchedCount !== 1)
          throw createError(409, "Student profile changed during allotment");
        created = allotment;
      });
    } finally {
      await session.endSession();
    }
    return created;
  },

  transfer: async (
    id: string,
    toSectionId: string,
    reason: string,
    changedBy: string,
    scopedDepartmentId?: string,
  ) => {
    const transferReason = meaningfulReason(reason, "Transfer");
    const [allotment, toSection] = await Promise.all([
      StudentSectionAllotmentModel.findById(id).lean(),
      loadOpenSection(toSectionId),
    ]);
    if (!allotment) throw createError(404, "Student section allotment not found");
    if (allotment.status !== StudentSectionAllotmentStatus.ACTIVE)
      throw createError(409, "Only an active allotment can be transferred");
    if (String(allotment.sectionId) === String(toSection._id))
      throw createError(400, "Source and target sections must differ");
    if (scopedDepartmentId && String(allotment.departmentId) !== scopedDepartmentId)
      throw createError(403, "You can manage only your department allotments");
    if (
      String(toSection.batchId) !== String(allotment.batchId) ||
      String(toSection.curriculumId) !== String(allotment.curriculumId) ||
      String(toSection.departmentId) !== String(allotment.departmentId) ||
      toSection.academicYear !== allotment.academicYear ||
      toSection.semesterNo !== allotment.semesterNo
    )
      throw createError(400, "Transfer must remain within the same academic cohort and semester");

    const session = await StudentSectionAllotmentModel.db.startSession();
    let updated;
    try {
      await session.withTransaction(async () => {
        const targetReserved = await SectionModel.findOneAndUpdate(
          {
            _id: toSection._id,
            status: SectionStatus.ACTIVE,
            $expr: { $lt: [{ $ifNull: ["$allottedCount", 0] }, "$capacity"] },
          },
          { $inc: { allottedCount: 1 } },
          { returnDocument: "after", session },
        );
        if (!targetReserved) throw createError(409, "Target section is full or unavailable");
        updated = await StudentSectionAllotmentModel.findOneAndUpdate(
          { _id: id, status: StudentSectionAllotmentStatus.ACTIVE, sectionId: allotment.sectionId },
          {
            $set: { sectionId: toSection._id, updatedBy: new Types.ObjectId(changedBy) },
            $push: {
              transferHistory: {
                fromSectionId: allotment.sectionId,
                toSectionId: toSection._id,
                changedAt: new Date(),
                changedBy: new Types.ObjectId(changedBy),
                reason: transferReason,
              },
            },
          },
          { returnDocument: "after", runValidators: true, session },
        ).lean();
        if (!updated) throw createError(409, "Allotment changed concurrently");
        await SectionModel.updateOne(
          { _id: allotment.sectionId, allottedCount: { $gt: 0 } },
          { $inc: { allottedCount: -1 } },
          { session },
        );
        await StudentProfileModel.updateOne(
          { _id: allotment.studentProfileId },
          { $set: { section: toSection.sectionName, updatedBy: new Types.ObjectId(changedBy) } },
          { session },
        );
      });
    } finally {
      await session.endSession();
    }
    return updated;
  },

  cancel: async (id: string, reason: string, changedBy: string, scopedDepartmentId?: string) => {
    const cancellationReason = meaningfulReason(reason, "Cancellation");
    const allotment = await StudentSectionAllotmentModel.findById(id).lean();
    if (!allotment) throw createError(404, "Student section allotment not found");
    if (allotment.status !== StudentSectionAllotmentStatus.ACTIVE)
      throw createError(409, "Only an active allotment can be cancelled");
    if (scopedDepartmentId && String(allotment.departmentId) !== scopedDepartmentId)
      throw createError(403, "You can manage only your department allotments");
    const session = await StudentSectionAllotmentModel.db.startSession();
    let updated;
    try {
      await session.withTransaction(async () => {
        updated = await StudentSectionAllotmentModel.findOneAndUpdate(
          { _id: id, status: StudentSectionAllotmentStatus.ACTIVE },
          {
            $set: {
              status: StudentSectionAllotmentStatus.CANCELLED,
              validTo: new Date(),
              updatedBy: new Types.ObjectId(changedBy),
            },
            $push: {
              transferHistory: {
                fromSectionId: allotment.sectionId,
                toSectionId: allotment.sectionId,
                changedAt: new Date(),
                changedBy: new Types.ObjectId(changedBy),
                reason: cancellationReason,
              },
            },
          },
          { returnDocument: "after", runValidators: true, session },
        ).lean();
        if (!updated) throw createError(409, "Allotment changed concurrently");
        await SectionModel.updateOne(
          { _id: allotment.sectionId, allottedCount: { $gt: 0 } },
          { $inc: { allottedCount: -1 } },
          { session },
        );
        await StudentProfileModel.updateOne(
          { _id: allotment.studentProfileId },
          { $unset: { section: "" }, $set: { updatedBy: new Types.ObjectId(changedBy) } },
          { session },
        );
      });
    } finally {
      await session.endSession();
    }
    return updated;
  },
};
