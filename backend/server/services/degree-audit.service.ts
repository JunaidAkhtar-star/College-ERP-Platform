import createError from "http-errors";
import {
  AcademicPlanModel,
  CurriculumModel,
  SemesterResultModel,
  StudentProfileModel,
  TransferCreditEvaluationModel,
  TransferCreditStatus,
} from "../models";

type TObjectIdLike = { toString(): string };

interface IPlanInput {
  goalGraduationTerm?: string;
  notes?: string;
  submit?: boolean;
  items: Array<{ subjectId: string; plannedSemester: number }>;
}

interface ITransferInput {
  studentProfileId: string;
  externalInstitution: string;
  externalProgramme: string;
  transcriptDocumentId?: string;
  referenceNumber: string;
  submit?: boolean;
  courses: Array<{
    externalCourseCode: string;
    externalCourseName: string;
    externalCredits: number;
    grade?: string;
    targetSubjectId?: string;
  }>;
}

const findStudent = async (studentProfileId: string) => {
  const student = await StudentProfileModel.findById(studentProfileId).lean();
  if (!student) throw createError(404, "Student profile not found");
  return student;
};

const findCurriculum = async (program: string, batch: string) => {
  const curriculum = await CurriculumModel.findOne({
    program,
    isActive: true,
    $or: [{ regulationYear: batch }, { regulationYear: { $lte: batch } }],
  })
    .sort({ regulationYear: -1, version: -1 })
    .lean();
  if (!curriculum) throw createError(409, "No active curriculum is assigned to this student");
  return curriculum;
};

const curriculumSubjects = (curriculum: Awaited<ReturnType<typeof findCurriculum>>) =>
  curriculum.semesterPlans.flatMap((semester) =>
    semester.subjects.map((subject) => ({
      subjectId: subject.subjectId,
      subjectCode: subject.subjectCode,
      subjectName: subject.subjectName,
      credits: subject.credits,
      semester: semester.semesterNo,
      isElective: subject.isElective,
      electiveGroup: subject.electiveGroup,
    })),
  );

async function buildAudit(studentProfileId: string) {
  const student = await findStudent(studentProfileId);
  const curriculum = await findCurriculum(student.program, student.batch);
  const [results, transfers, academicPlan] = await Promise.all([
    SemesterResultModel.find({ studentId: student.userId, isPublished: true })
      .sort({ semester: 1 })
      .lean(),
    TransferCreditEvaluationModel.find({ studentProfileId: student._id })
      .sort({ createdAt: -1 })
      .lean(),
    AcademicPlanModel.findOne({ studentProfileId: student._id }).lean(),
  ]);

  const passed = new Map<
    string,
    { source: "institution"; credits: number; grade?: string; semester: number }
  >();
  for (const result of results) {
    for (const subject of result.subjectResults) {
      if (subject.isPassed) {
        passed.set(subject.subjectCode.toLowerCase(), {
          source: "institution",
          credits: subject.credits,
          grade: subject.gradeLetter,
          semester: result.semester,
        });
      }
    }
  }
  const transferred = new Map<string, { source: "transfer"; credits: number }>();
  for (const evaluation of transfers) {
    if (
      ![TransferCreditStatus.APPROVED, TransferCreditStatus.PARTIALLY_APPROVED].includes(
        evaluation.status,
      )
    )
      continue;
    for (const course of evaluation.courses) {
      if (course.decision === "approved" && course.targetSubjectCode) {
        transferred.set(course.targetSubjectCode.toLowerCase(), {
          source: "transfer",
          credits: course.approvedCredits,
        });
      }
    }
  }
  const planByCode = new Map(
    (academicPlan?.items ?? []).map((item) => [item.subjectCode.toLowerCase(), item]),
  );
  const requirements = curriculumSubjects(curriculum).map((subject) => {
    const completion = passed.get(subject.subjectCode.toLowerCase());
    const transfer = transferred.get(subject.subjectCode.toLowerCase());
    const planned = planByCode.get(subject.subjectCode.toLowerCase());
    return {
      ...subject,
      status: completion
        ? "completed"
        : transfer
          ? "transferred"
          : planned
            ? "planned"
            : "remaining",
      completedCredits: completion?.credits ?? transfer?.credits ?? 0,
      grade: completion?.grade,
      completedSemester: completion?.semester,
      plannedSemester: planned?.plannedSemester,
    };
  });
  const creditsEarned = requirements.reduce((sum, row) => sum + row.completedCredits, 0);
  const remainingCredits = Math.max(0, curriculum.totalCreditsRequired - creditsEarned);
  const backlogs = results.reduce((sum, result) => sum + result.backlogs, 0);
  return {
    student: {
      _id: student._id,
      name: [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" "),
      rollNumber: student.rollNumber,
      program: student.program,
      batch: student.batch,
      currentSemester: student.currentSemester,
      departmentId: student.department,
    },
    curriculum: {
      _id: curriculum._id,
      program: curriculum.program,
      regulationYear: curriculum.regulationYear,
      totalSemesters: curriculum.totalSemesters,
      totalCreditsRequired: curriculum.totalCreditsRequired,
    },
    summary: {
      creditsEarned,
      remainingCredits,
      completionPercent:
        curriculum.totalCreditsRequired > 0
          ? Math.min(100, Math.round((creditsEarned / curriculum.totalCreditsRequired) * 100))
          : 0,
      completedRequirements: requirements.filter((row) =>
        ["completed", "transferred"].includes(row.status),
      ).length,
      totalRequirements: requirements.length,
      backlogs,
      graduationReady: remainingCredits === 0 && backlogs === 0,
    },
    requirements,
    plan: academicPlan,
    transferEvaluations: transfers,
  };
}

export const degreeAuditService = {
  profileForUser: async (userId: string) => {
    const student = await StudentProfileModel.findOne({ userId }).select("_id").lean();
    if (!student) throw createError(403, "An active student profile is required");
    return student;
  },

  audit: buildAudit,

  transferById: async (id: string) => {
    const evaluation = await TransferCreditEvaluationModel.findById(id).lean();
    if (!evaluation) throw createError(404, "Transfer-credit evaluation not found");
    return evaluation;
  },

  savePlan: async (studentProfileId: string, actorId: string, input: IPlanInput) => {
    const student = await findStudent(studentProfileId);
    const curriculum = await findCurriculum(student.program, student.batch);
    const available = new Map(
      curriculumSubjects(curriculum).map((subject) => [subject.subjectId.toString(), subject]),
    );
    const seen = new Set<string>();
    const items = input.items.map((item) => {
      const subject = available.get(item.subjectId);
      if (!subject)
        throw createError(400, "Academic plan contains a subject outside the curriculum");
      if (seen.has(item.subjectId))
        throw createError(400, "Academic plan contains a duplicate subject");
      seen.add(item.subjectId);
      return {
        subjectId: subject.subjectId,
        subjectCode: subject.subjectCode,
        subjectName: subject.subjectName,
        credits: subject.credits,
        plannedSemester: item.plannedSemester,
        status: "planned" as const,
      };
    });
    return AcademicPlanModel.findOneAndUpdate(
      { studentProfileId: student._id },
      {
        $set: {
          studentId: student.userId,
          curriculumId: curriculum._id,
          items,
          goalGraduationTerm: input.goalGraduationTerm,
          notes: input.notes,
          status: input.submit ? "submitted" : "draft",
          submittedAt: input.submit ? new Date() : undefined,
          updatedBy: actorId,
        },
        $unset: { reviewedBy: 1, reviewedAt: 1, reviewRemarks: 1 },
      },
      { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true },
    ).lean();
  },

  reviewPlan: async (
    studentProfileId: string,
    reviewerId: string,
    decision: "approved" | "returned",
    remarks?: string,
  ) => {
    const updated = await AcademicPlanModel.findOneAndUpdate(
      { studentProfileId, status: "submitted" },
      {
        $set: {
          status: decision,
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          reviewRemarks: remarks,
        },
      },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!updated) throw createError(409, "Only a submitted academic plan can be reviewed");
    return updated;
  },

  createTransferEvaluation: async (actorId: string, input: ITransferInput) => {
    const student = await findStudent(input.studentProfileId);
    const curriculum = await findCurriculum(student.program, student.batch);
    const available = new Map(
      curriculumSubjects(curriculum).map((subject) => [subject.subjectId.toString(), subject]),
    );
    const courses = input.courses.map((course) => {
      const target = course.targetSubjectId ? available.get(course.targetSubjectId) : undefined;
      if (course.targetSubjectId && !target) {
        throw createError(400, "A transfer mapping targets a subject outside the curriculum");
      }
      return {
        ...course,
        targetSubjectId: target?.subjectId,
        targetSubjectCode: target?.subjectCode,
        targetSubjectName: target?.subjectName,
        approvedCredits: 0,
        decision: "pending" as const,
      };
    });
    return TransferCreditEvaluationModel.create({
      studentProfileId: student._id,
      studentId: student.userId,
      externalInstitution: input.externalInstitution,
      externalProgramme: input.externalProgramme,
      transcriptDocumentId: input.transcriptDocumentId,
      referenceNumber: input.referenceNumber,
      courses,
      status: input.submit ? TransferCreditStatus.SUBMITTED : TransferCreditStatus.DRAFT,
      submittedAt: input.submit ? new Date() : undefined,
      createdBy: actorId,
    });
  },

  reviewTransferEvaluation: async (
    id: string,
    reviewerId: string,
    input: {
      remarks?: string;
      courses: Array<{
        courseId: string;
        decision: "approved" | "rejected";
        approvedCredits: number;
        remarks?: string;
      }>;
    },
  ) => {
    const evaluation = await TransferCreditEvaluationModel.findOne({
      _id: id,
      status: TransferCreditStatus.SUBMITTED,
    });
    if (!evaluation) throw createError(409, "Only a submitted transfer evaluation can be reviewed");
    const decisions = new Map(input.courses.map((course) => [course.courseId, course]));
    for (const course of evaluation.courses) {
      const decision = decisions.get((course._id as TObjectIdLike | undefined)?.toString() ?? "");
      if (!decision) throw createError(400, "Every transfer course requires a decision");
      if (decision.decision === "approved" && !course.targetSubjectId) {
        throw createError(400, "Approved transfer courses require a curriculum subject mapping");
      }
      if (decision.decision === "approved" && decision.approvedCredits <= 0) {
        throw createError(400, "Approved transfer courses require a positive credit value");
      }
      if (decision.approvedCredits > course.externalCredits) {
        throw createError(400, "Approved credits cannot exceed external course credits");
      }
      course.decision = decision.decision;
      course.approvedCredits = decision.decision === "approved" ? decision.approvedCredits : 0;
      course.remarks = decision.remarks;
    }
    const approved = evaluation.courses.filter((course) => course.decision === "approved").length;
    evaluation.status =
      approved === evaluation.courses.length
        ? TransferCreditStatus.APPROVED
        : approved > 0
          ? TransferCreditStatus.PARTIALLY_APPROVED
          : TransferCreditStatus.REJECTED;
    evaluation.reviewedBy = reviewerId as never;
    evaluation.reviewedAt = new Date();
    evaluation.reviewRemarks = input.remarks;
    await evaluation.save();
    return evaluation.toObject();
  },
};
