import { iqacRepository } from "../repositories";
import { COPOAttainmentModel } from "../models/iqac.model";
import createError from "http-errors";
import { CurriculumModel } from "../models/curriculum.model";
import { QuizModel, QuizStatus } from "../models/quiz.model";
import { QuizAttemptModel } from "../models/quiz-attempt.model";
import { QuestionModel, QuestionStatus } from "../models/question-bank.model";
import { IQACFeedbackModel } from "../models/iqac.model";
import { Types } from "mongoose";
import { SectionModel } from "../models/section.model";

const feedbackRole: Record<string, string> = {
  student_on_faculty: "student",
  student_course_exit: "student",
  faculty_on_curriculum: "faculty",
  alumni: "alumni",
  employer: "placement_cell",
  parent: "parent",
};

export function attainmentLevelFromPercentage(percentage: number): 0 | 1 | 2 | 3 {
  if (percentage >= 70) return 3;
  if (percentage >= 60) return 2;
  if (percentage >= 50) return 1;
  return 0;
}

export function calculateWeightedAttainment(
  directPercentage: number,
  indirectPercentage: number,
  directWeight: number,
  indirectWeight: number,
) {
  if (
    [directPercentage, indirectPercentage, directWeight, indirectWeight].some(
      (value) => !Number.isFinite(value) || value < 0 || value > 100,
    ) ||
    directWeight + indirectWeight !== 100
  ) {
    throw createError(400, "Attainment percentages and weights are invalid");
  }
  return Number(
    ((directPercentage * directWeight + indirectPercentage * indirectWeight) / 100).toFixed(2),
  );
}

export function normalizeIqacFeedback(data: Record<string, unknown>, roles: string[]) {
  const feedbackType = String(data.feedbackType ?? "");
  if (!feedbackRole[feedbackType] || !roles.includes(feedbackRole[feedbackType]))
    throw createError(403, "Your role cannot submit this feedback type");
  if (!/^\d{4}-\d{2}$/.test(String(data.academicYear ?? "")))
    throw createError(400, "Academic year must use YYYY-YY format");
  if (
    ["student_on_faculty", "student_course_exit", "faculty_on_curriculum"].includes(feedbackType)
  ) {
    if (!Types.ObjectId.isValid(String(data.targetId ?? ""))) {
      throw createError(400, "This feedback type requires a valid target");
    }
  }
  const ratings = Array.isArray(data.ratings)
    ? (data.ratings as Array<{ criterion?: unknown; score?: unknown }>)
    : [];
  if (!ratings.length || ratings.length > 50) throw createError(400, "Valid ratings are required");
  const seen = new Set<string>();
  const normalized = ratings.map((rating) => {
    const criterion = String(rating.criterion ?? "").trim();
    const score = Number(rating.score);
    if (!criterion || seen.has(criterion) || !Number.isInteger(score) || score < 1 || score > 5)
      throw createError(400, "Ratings require unique criteria and scores from 1 to 5");
    seen.add(criterion);
    return { criterion, score };
  });
  return {
    academicYear: String(data.academicYear),
    semesterType: data.semesterType,
    feedbackType,
    targetId: data.targetId,
    ratings: normalized,
    averageScore: normalized.reduce((sum, item) => sum + item.score, 0) / normalized.length,
    textFeedback: String(data.textFeedback ?? "")
      .trim()
      .slice(0, 5000),
    isAnonymous: Boolean(data.isAnonymous),
    respondentId: data.respondentId,
  };
}

const auditTransitions: Record<string, string[]> = {
  scheduled: ["ongoing"],
  ongoing: ["completed"],
  completed: ["closed"],
  closed: [],
};

export const iqacService = {
  // Feedback
  submitFeedback: async (data: Record<string, unknown>, roles: string[]) => {
    const normalized = normalizeIqacFeedback(data, roles);
    if (normalized.feedbackType === "student_course_exit") {
      const subjectId = String(normalized.targetId || "");
      if (!Types.ObjectId.isValid(subjectId)) {
        throw createError(400, "Course-exit feedback requires a valid subject");
      }
      const curriculum = await CurriculumModel.findOne({
        isActive: true,
        "semesterPlans.subjects.subjectId": subjectId,
      })
        .select("semesterPlans")
        .lean();
      const configuredOutcomes = new Set(
        (curriculum?.semesterPlans ?? [])
          .flatMap((plan) => plan.subjects)
          .find((subject) => subject.subjectId.toString() === subjectId)
          ?.courseOutcomes.map((outcome) => outcome.coCode.trim().toUpperCase()) ?? [],
      );
      const ratedOutcomes = new Set(
        normalized.ratings.map((rating) => rating.criterion.trim().toUpperCase()),
      );
      if (
        !configuredOutcomes.size ||
        configuredOutcomes.size !== ratedOutcomes.size ||
        [...ratedOutcomes].some((coCode) => !configuredOutcomes.has(coCode))
      ) {
        throw createError(400, "Rate every configured course outcome exactly once");
      }
      normalized.ratings = normalized.ratings.map((rating) => ({
        ...rating,
        criterion: rating.criterion.trim().toUpperCase(),
      }));
    }
    return iqacRepository.createFeedback(normalized);
  },

  getFeedback: (filter: Record<string, unknown>, page: number, limit: number) =>
    iqacRepository.listFeedback(filter, page, limit),

  getFeedbackAnalysis: (feedbackType: string, academicYear: string, targetId?: string) =>
    iqacRepository.getFeedbackAnalysis(feedbackType, academicYear, targetId),

  // Audits
  getAudits: (filter: Record<string, unknown>, page: number, limit: number) =>
    iqacRepository.listAudits(filter, page, limit),

  getAuditById: (id: string) => iqacRepository.findAuditById(id),

  createAudit: (data: Record<string, unknown>) => {
    const findings = Array.isArray(data.findings) ? data.findings : [];
    const overallCompliance = findings.length
      ? findings.reduce((sum, item) => {
          const status = String((item as Record<string, unknown>).status);
          return sum + (status === "compliant" ? 100 : status === "partial" ? 50 : 0);
        }, 0) / findings.length
      : 0;
    return iqacRepository.createAudit({
      academicYear: data.academicYear,
      auditType: data.auditType,
      departmentId: data.departmentId,
      auditDate: data.auditDate,
      auditedBy: data.auditedBy,
      createdBy: data.createdBy,
      status: "scheduled",
      findings,
      actionPlan: data.actionPlan,
      overallCompliance,
    });
  },

  updateAudit: async (id: string, data: Record<string, unknown>) => {
    const audit = await iqacRepository.findAuditById(id);
    if (!audit) throw createError(404, "Audit not found");
    const nextStatus = String(data.status ?? audit.status);
    if (nextStatus !== audit.status && !auditTransitions[audit.status]?.includes(nextStatus))
      throw createError(409, `Audit cannot transition from ${audit.status} to ${nextStatus}`);
    const findings = Array.isArray(data.findings) ? data.findings : audit.findings;
    const compliance = findings.length
      ? findings.reduce((sum, item) => {
          const status = String((item as Record<string, unknown>).status);
          return sum + (status === "compliant" ? 100 : status === "partial" ? 50 : 0);
        }, 0) / findings.length
      : 0;
    if (nextStatus === "completed" && !findings.length)
      throw createError(400, "Completed audits require findings");
    if (nextStatus === "closed" && !String(data.actionPlan ?? audit.actionPlan ?? "").trim())
      throw createError(400, "Closing an audit requires an action plan");
    const updated = await iqacRepository.updateAuditWhen(
      { _id: id, status: audit.status },
      {
        findings,
        actionPlan: data.actionPlan ?? audit.actionPlan,
        status: nextStatus,
        overallCompliance: compliance,
        ...(nextStatus === "closed" ? { closureDate: new Date() } : {}),
      },
    );
    if (!updated) throw createError(409, "Audit was changed by another user");
    return updated;
  },

  // CO-PO Attainment
  getAttainment: (
    academicYear: string,
    subjectId: string,
    section: string,
    departmentId?: string,
  ) => iqacRepository.findAttainment(academicYear, subjectId, section, departmentId),

  getAttainmentById: async (id: string) => {
    const record = await COPOAttainmentModel.findById(id).lean();
    if (!record) throw createError(404, "Attainment record not found");
    return record;
  },

  updateAttainmentActionPlans: async (
    id: string,
    actions: Array<{ coCode: string; actionPlan: string }>,
  ) => {
    if (!Types.ObjectId.isValid(id)) throw createError(400, "Valid attainment record is required");
    const record = await COPOAttainmentModel.findById(id).lean();
    if (!record) throw createError(404, "Attainment record not found");
    if (record.status !== "draft") throw createError(409, "Only draft attainment can be updated");
    const actionByCo = new Map(
      actions.map((action) => [
        action.coCode.trim().toUpperCase(),
        action.actionPlan.trim().slice(0, 2000),
      ]),
    );
    const gaps = (record.gaps ?? []).map((gap) => ({
      ...gap,
      actionPlan: actionByCo.get(gap.coCode) ?? gap.actionPlan,
    }));
    if (gaps.some((gap) => gap.actionPlan && gap.actionPlan.length < 10)) {
      throw createError(400, "Improvement action plans must contain at least 10 characters");
    }
    return COPOAttainmentModel.findOneAndUpdate(
      { _id: id, status: "draft" },
      { $set: { gaps } },
      { returnDocument: "after", runValidators: true },
    ).lean();
  },

  submitAttainment: async (id: string, submittedBy: string) => {
    const record = await COPOAttainmentModel.findById(id).lean();
    if (!record) throw createError(404, "Attainment record not found");
    if (record.status !== "draft") throw createError(409, "Only draft attainment can be submitted");
    if (
      !record.evidence?.quizCount ||
      !record.evidence.attemptCount ||
      !record.evidence.mappedQuestionCount
    ) {
      throw createError(409, "Direct assessment evidence is incomplete");
    }
    if ((record.coAttainments ?? []).some((co) => !co.indirectResponseCount)) {
      throw createError(409, "Every course outcome requires course-exit survey evidence");
    }
    if ((record.gaps ?? []).some((gap) => !gap.actionPlan || gap.actionPlan.trim().length < 10)) {
      throw createError(409, "Every attainment gap requires an improvement action plan");
    }
    const updated = await COPOAttainmentModel.findOneAndUpdate(
      { _id: id, status: "draft" },
      { $set: { status: "submitted", submittedBy, submittedAt: new Date() } },
      { returnDocument: "after" },
    ).lean();
    if (!updated) throw createError(409, "Attainment changed while it was being submitted");
    return updated;
  },

  approveAttainment: async (id: string, approvedBy: string) => {
    const record = await COPOAttainmentModel.findById(id).lean();
    if (!record) throw createError(404, "Attainment record not found");
    if (record.status !== "submitted") {
      throw createError(409, "Only submitted attainment can be approved");
    }
    if (String(record.submittedBy) === approvedBy || String(record.calculatedBy) === approvedBy) {
      throw createError(409, "Attainment requires an independent approver");
    }
    const updated = await COPOAttainmentModel.findOneAndUpdate(
      { _id: id, status: "submitted", submittedBy: { $ne: approvedBy } },
      { $set: { status: "approved", approvedBy, approvedAt: new Date() } },
      { returnDocument: "after" },
    ).lean();
    if (!updated) throw createError(409, "Attainment changed while it was being approved");
    return updated;
  },

  getPOAttainmentSummary: (academicYear: string, program: string, departmentId?: string) =>
    iqacRepository.getPOAttainmentSummary(academicYear, program, departmentId),

  getCourseOutcomes: async (subjectId: string) => {
    if (!Types.ObjectId.isValid(subjectId)) throw createError(400, "Valid subject is required");
    const curriculum = await CurriculumModel.findOne({
      isActive: true,
      "semesterPlans.subjects.subjectId": subjectId,
    })
      .select("program regulationYear semesterPlans programOutcomes")
      .lean();
    const subject = (curriculum?.semesterPlans ?? [])
      .flatMap((plan) => plan.subjects)
      .find((item) => item.subjectId.toString() === subjectId);
    if (!subject?.courseOutcomes.length) {
      throw createError(404, "No configured course outcomes found for this subject");
    }
    return {
      program: curriculum?.program,
      regulationYear: curriculum?.regulationYear,
      outcomes: subject.courseOutcomes,
      programOutcomes: curriculum?.programOutcomes ?? [],
    };
  },

  /** Calculates OBE attainment from question-level assessed evidence and course-exit feedback. */
  autoCalculateCOPOAttainment: async (params: {
    academicYear: string;
    sectionId?: string;
    subjectId: string;
    subjectCode: string;
    program: string;
    semester: number;
    section: string;
    coMappings: Array<{
      coCode: string;
      targetPercent: number;
    }>;
    coPOMatrix: Record<string, Array<string | { poCode: string; strength?: 1 | 2 | 3 }>>;
    directWeight?: number;
    indirectWeight?: number;
    calculatedBy: string;
    departmentScope?: string;
  }) => {
    if (!params.sectionId || !Types.ObjectId.isValid(params.sectionId)) {
      throw createError(400, "Select a valid academic section for attainment calculation");
    }
    const section = await SectionModel.findById(params.sectionId).lean();
    if (!section) throw createError(404, "Academic section not found");
    if (params.departmentScope && section.departmentId.toString() !== params.departmentScope) {
      throw createError(403, "You can calculate attainment only for your department");
    }
    params.academicYear = section.academicYear;
    params.program = section.program;
    params.semester = section.semesterNo;
    params.section = section.sectionName;
    const directWeight = params.directWeight ?? 80;
    const indirectWeight = params.indirectWeight ?? 20;
    if (directWeight < 0 || indirectWeight < 0 || directWeight + indirectWeight !== 100) {
      throw createError(400, "Direct and indirect attainment weights must total 100");
    }
    const existingAttainment = await COPOAttainmentModel.findOne({
      academicYear: params.academicYear,
      subjectId: params.subjectId,
      section: params.section,
    })
      .select("status")
      .lean();
    if (existingAttainment?.status === "approved") {
      throw createError(409, "Approved attainment is frozen and cannot be recalculated");
    }
    const requestedMappings = params.coMappings.map((mapping) => ({
      coCode: String(mapping.coCode).trim().toUpperCase(),
      targetPercent: Number(mapping.targetPercent),
    }));
    if (
      !requestedMappings.length ||
      new Set(requestedMappings.map((mapping) => mapping.coCode)).size !==
        requestedMappings.length ||
      requestedMappings.some(
        (mapping) =>
          !/^CO(?:[1-9]|1\d|20)$/.test(mapping.coCode) ||
          !Number.isFinite(mapping.targetPercent) ||
          mapping.targetPercent <= 0 ||
          mapping.targetPercent > 100,
      )
    ) {
      throw createError(400, "Course outcomes and target percentages are invalid or duplicated");
    }

    const curriculum = await CurriculumModel.findOne({
      _id: section.curriculumId,
      isActive: true,
    }).lean();
    const curriculumSubject = curriculum?.semesterPlans
      .find((plan) => plan.semesterNo === params.semester)
      ?.subjects.find((subject) => subject.subjectId.toString() === params.subjectId);
    if (!curriculum || !curriculumSubject?.courseOutcomes.length) {
      throw createError(409, "Configure curriculum course outcomes before calculating attainment");
    }
    const configuredCoCodes = new Set(
      curriculumSubject.courseOutcomes.map((outcome) => outcome.coCode.trim().toUpperCase()),
    );
    if (requestedMappings.some((mapping) => !configuredCoCodes.has(mapping.coCode))) {
      throw createError(
        400,
        "Attainment can use only course outcomes configured in the curriculum",
      );
    }
    const configuredPoCodes = new Set(
      (curriculum.programOutcomes ?? []).map((outcome) => outcome.poCode.trim().toUpperCase()),
    );

    const quizzes = await QuizModel.find({
      subjectId: params.subjectId,
      academicYear: params.academicYear,
      section: params.section.trim().toUpperCase(),
      status: QuizStatus.CLOSED,
    })
      .select("_id questions")
      .lean();
    if (!quizzes.length) {
      throw createError(409, "Close at least one assessed quiz before calculating attainment");
    }
    const bankQuestionIds = [
      ...new Set(
        quizzes.flatMap((quiz) =>
          quiz.questions.map((question) => String(question.questionId || "")).filter(Boolean),
        ),
      ),
    ];
    const bankQuestions = await QuestionModel.find({
      _id: { $in: bankQuestionIds },
      subjectId: params.subjectId,
      status: QuestionStatus.APPROVED,
      isActive: true,
      coCode: { $in: requestedMappings.map((mapping) => mapping.coCode) },
    })
      .select("_id coCode")
      .lean();
    const coByBankQuestion = new Map(
      bankQuestions.map((question) => [question._id.toString(), String(question.coCode)]),
    );
    const evidenceByQuizQuestion = new Map<string, { coCode: string; maximumMarks: number }>();
    for (const quiz of quizzes) {
      for (const question of quiz.questions) {
        const coCode = question.questionId
          ? coByBankQuestion.get(question.questionId.toString())
          : undefined;
        if (coCode && question._id) {
          evidenceByQuizQuestion.set(`${quiz._id}:${question._id}`, {
            coCode,
            maximumMarks: question.marks,
          });
        }
      }
    }
    if (!evidenceByQuizQuestion.size) {
      throw createError(409, "Closed quizzes contain no approved question-bank CO mappings");
    }

    const attempts = await QuizAttemptModel.find({
      quizId: { $in: quizzes.map((quiz) => quiz._id) },
      isSubmitted: true,
    })
      .select("quizId studentId answers")
      .lean();
    if (!attempts.length) throw createError(409, "No submitted assessed attempts are available");
    const scoresByStudentCo = new Map<string, { obtained: number; maximum: number }>();
    for (const attempt of attempts) {
      for (const answer of attempt.answers ?? []) {
        const evidence = evidenceByQuizQuestion.get(`${attempt.quizId}:${answer.questionId}`);
        if (!evidence) continue;
        const key = `${attempt.studentId}:${evidence.coCode}`;
        const score = scoresByStudentCo.get(key) ?? { obtained: 0, maximum: 0 };
        score.obtained += Number(answer.marksAwarded || 0);
        score.maximum += evidence.maximumMarks;
        scoresByStudentCo.set(key, score);
      }
    }

    const feedbackRows = await IQACFeedbackModel.find({
      academicYear: params.academicYear,
      feedbackType: "student_course_exit",
      targetId: params.subjectId,
    })
      .select("ratings")
      .lean();
    const indirectByCo = new Map<string, number[]>();
    for (const feedback of feedbackRows) {
      for (const rating of feedback.ratings ?? []) {
        const coCode = rating.criterion.trim().toUpperCase();
        if (configuredCoCodes.has(coCode)) {
          indirectByCo.set(coCode, [...(indirectByCo.get(coCode) ?? []), rating.score]);
        }
      }
    }

    const coAttainments = requestedMappings.map((mapping) => {
      const studentScores = [...scoresByStudentCo.entries()]
        .filter(([key]) => key.endsWith(`:${mapping.coCode}`))
        .map(([, score]) => score)
        .filter((score) => score.maximum > 0);
      const attainedStudents = studentScores.filter(
        (score) => (score.obtained / score.maximum) * 100 >= mapping.targetPercent,
      ).length;
      const directAttainment = studentScores.length
        ? (attainedStudents / studentScores.length) * 100
        : 0;
      const indirectScores = indirectByCo.get(mapping.coCode) ?? [];
      const indirectAttainment = indirectScores.length
        ? (indirectScores.reduce((sum, score) => sum + score, 0) / indirectScores.length / 5) * 100
        : 0;
      const finalAttainment = calculateWeightedAttainment(
        directAttainment,
        indirectAttainment,
        directWeight,
        indirectWeight,
      );
      return {
        coCode: mapping.coCode,
        targetLevel: 2,
        targetPercentage: mapping.targetPercent,
        directAttainment: Number(directAttainment.toFixed(2)),
        indirectAttainment: Number(indirectAttainment.toFixed(2)),
        finalAttainment,
        attainmentLevel: attainmentLevelFromPercentage(finalAttainment),
        attainedStudents,
        assessedStudents: studentScores.length,
        indirectResponseCount: indirectScores.length,
      };
    });

    const poEvidence = new Map<string, Array<{ value: number; strength: number }>>();
    for (const co of coAttainments) {
      for (const mapping of params.coPOMatrix[co.coCode] ?? []) {
        const poCode = (typeof mapping === "string" ? mapping : mapping.poCode)
          .trim()
          .toUpperCase();
        const strength = typeof mapping === "string" ? 3 : Number(mapping.strength ?? 3);
        if (!configuredPoCodes.has(poCode) || ![1, 2, 3].includes(strength)) {
          throw createError(400, `Invalid CO-PO mapping for ${co.coCode}`);
        }
        poEvidence.set(poCode, [
          ...(poEvidence.get(poCode) ?? []),
          { value: co.finalAttainment, strength },
        ]);
      }
    }
    const poAttainments = [...poEvidence.entries()].map(([poCode, values]) => {
      const weight = values.reduce((sum, item) => sum + item.strength, 0);
      const percentage = values.reduce((sum, item) => sum + item.value * item.strength, 0) / weight;
      return {
        poCode,
        attainmentPercentage: Number(percentage.toFixed(2)),
        attainmentLevel: attainmentLevelFromPercentage(percentage),
      };
    });
    if (!poAttainments.length) throw createError(400, "Map at least one CO to a configured PO");

    const gaps = coAttainments
      .filter((co) => co.attainmentLevel < co.targetLevel)
      .map((co) => ({
        coCode: co.coCode,
        gap: co.targetLevel - co.attainmentLevel,
        message: `${co.coCode} attained level ${co.attainmentLevel}, below target level ${co.targetLevel}`,
      }));
    const record = await COPOAttainmentModel.findOneAndUpdate(
      {
        academicYear: params.academicYear,
        subjectId: params.subjectId,
        section: params.section,
      },
      {
        $set: {
          departmentId: section.departmentId,
          subjectCode: params.subjectCode,
          program: params.program,
          semester: params.semester,
          coAttainments,
          poAttainments,
          directWeight,
          indirectWeight,
          evidence: {
            quizCount: quizzes.length,
            attemptCount: attempts.length,
            mappedQuestionCount: evidenceByQuizQuestion.size,
            feedbackResponseCount: feedbackRows.length,
          },
          gaps,
          calculationVersion: 2,
          status: "draft",
          submittedBy: null,
          submittedAt: null,
          approvedBy: null,
          approvedAt: null,
          calculatedBy: params.calculatedBy,
          calculatedAt: new Date(),
        },
      },
      { upsert: true, returnDocument: "after", runValidators: true },
    );
    return { record, gaps, coAttainments, poAttainments, evidence: record?.evidence };
  },
};
