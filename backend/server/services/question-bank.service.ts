import createError from "http-errors";
import { createHash } from "node:crypto";
import { Types } from "mongoose";
import { questionBankRepository, subjectRepository } from "../repositories";
import { QuestionStatus, type IQuestion, type QuestionType } from "../models/question-bank.model";
import { TimetableModel } from "../models/timetable.model";

const QUESTION_TYPES = new Set<QuestionType>([
  "mcq",
  "short_answer",
  "long_answer",
  "coding",
  "true_false",
]);
const DIFFICULTIES = new Set(["easy", "medium", "hard"]);

function fingerprint(questionText: string): string {
  return createHash("sha256")
    .update(questionText.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-IN"))
    .digest("hex");
}

export function validateQuestionContent(data: Record<string, unknown>) {
  const questionText = String(data.questionText ?? "").trim();
  const questionType = String(data.questionType ?? "") as QuestionType;
  const difficultyLevel = String(data.difficultyLevel ?? "");
  const marks = Number(data.marks);
  const unitNo = Number(data.unitNo);
  if (questionText.length < 3 || questionText.length > 10000)
    throw createError(400, "Question text must contain 3 to 10000 characters");
  if (!QUESTION_TYPES.has(questionType)) throw createError(400, "Invalid question type");
  if (!DIFFICULTIES.has(difficultyLevel)) throw createError(400, "Invalid difficulty level");
  if (!Number.isFinite(marks) || marks <= 0 || marks > 1000)
    throw createError(400, "Question marks must be between 0 and 1000");
  if (!Number.isInteger(unitNo) || unitNo < 1 || unitNo > 20)
    throw createError(400, "Unit number must be between 1 and 20");
  const rawOptions = Array.isArray(data.options) ? data.options : [];
  const options = rawOptions.map((raw) => ({
    optionText: String((raw as { optionText?: unknown }).optionText ?? "").trim(),
    isCorrect: Boolean((raw as { isCorrect?: unknown }).isCorrect),
  }));
  const correctAnswer = String(data.correctAnswer ?? "").trim();
  if (questionType === "mcq") {
    if (options.length < 2 || options.length > 10)
      throw createError(400, "MCQ questions require 2 to 10 options");
    if (options.some((option) => !option.optionText || option.optionText.length > 2000))
      throw createError(400, "Every MCQ option must contain valid text");
    if (options.filter((option) => option.isCorrect).length !== 1)
      throw createError(400, "MCQ questions require exactly one correct option");
  } else if (!correctAnswer) {
    throw createError(400, "A model or correct answer is required");
  }
  if (questionType === "true_false" && !["true", "false"].includes(correctAnswer.toLowerCase()))
    throw createError(400, "True/false answer must be true or false");
  const tags = Array.isArray(data.tags)
    ? [...new Set(data.tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))]
    : [];
  if (tags.length > 20 || tags.some((tag) => tag.length > 50))
    throw createError(400, "At most 20 tags of 50 characters are allowed");
  const coCode = data.coCode ? String(data.coCode).trim().toUpperCase() : undefined;
  if (coCode && !/^CO(?:[1-9]|1\d|20)$/.test(coCode))
    throw createError(400, "Course outcome must use CO1 to CO20 format");
  return {
    questionText,
    fingerprint: fingerprint(questionText),
    questionType,
    difficultyLevel,
    marks,
    unitNo,
    coCode,
    options: questionType === "mcq" ? options : [],
    correctAnswer: questionType === "mcq" ? undefined : correctAnswer,
    explanation: data.explanation ? String(data.explanation).trim() : undefined,
    tags,
  };
}

async function normalizeQuestion(
  data: Record<string, unknown>,
  authorId: string,
  requireTeaching: boolean,
  existing?: IQuestion,
) {
  const subjectId = String(data.subjectId ?? existing?.subjectId ?? "");
  if (!Types.ObjectId.isValid(subjectId)) throw createError(400, "Valid subject is required");
  const subject = await subjectRepository.findById(subjectId);
  if (!subject?.isActive) throw createError(404, "Active subject not found");
  if (
    requireTeaching &&
    !(await TimetableModel.exists({
      isApproved: true,
      isActive: true,
      slots: { $elemMatch: { subjectId, facultyId: authorId } },
    }))
  )
    throw createError(403, "Faculty may author questions only for subjects they teach");
  const content = validateQuestionContent({ ...existing, ...data });
  if (
    await questionBankRepository.findDuplicate(
      subjectId,
      content.fingerprint,
      existing?._id.toString(),
    )
  )
    throw createError(409, "An active question with the same text already exists for this subject");
  return {
    ...data,
    ...content,
    subjectId: subject._id,
    subjectCode: subject.code,
    departmentId: subject.departmentId,
    createdBy: existing?.createdBy ?? authorId,
  };
}

export const questionBankService = {
  getAll: (filter: Record<string, unknown>, page: number, limit: number) =>
    questionBankRepository.list(filter, page, limit),

  getById: (id: string) => questionBankRepository.findById(id),

  create: async (data: Record<string, unknown>, authorId: string, requireTeaching: boolean) => {
    const normalized = await normalizeQuestion(data, authorId, requireTeaching);
    return questionBankRepository.create({
      ...normalized,
      status: QuestionStatus.DRAFT,
      isActive: false,
      usageCount: 0,
      revision: 1,
    });
  },

  createBulk: async (
    rows: Record<string, unknown>[],
    authorId: string,
    requireTeaching: boolean,
  ) => {
    if (!Array.isArray(rows) || rows.length < 1 || rows.length > 200)
      throw createError(400, "Bulk import requires 1 to 200 questions");
    const subjectIds = [...new Set(rows.map((row) => String(row.subjectId ?? "")))];
    if (subjectIds.some((id) => !Types.ObjectId.isValid(id)))
      throw createError(400, "Every question requires a valid subject");
    const subjects = await subjectRepository.findByIds(subjectIds);
    if (subjects.length !== subjectIds.length || subjects.some((subject) => !subject.isActive))
      throw createError(404, "Every question requires an active subject");
    const subjectsById = new Map(subjects.map((subject) => [String(subject._id), subject]));

    if (requireTeaching) {
      const taughtSubjects = await TimetableModel.aggregate<{ _id: Types.ObjectId }>([
        {
          $match: {
            isApproved: true,
            isActive: true,
            slots: {
              $elemMatch: {
                facultyId: new Types.ObjectId(authorId),
                subjectId: { $in: subjectIds.map((id) => new Types.ObjectId(id)) },
              },
            },
          },
        },
        { $unwind: "$slots" },
        {
          $match: {
            "slots.facultyId": new Types.ObjectId(authorId),
            "slots.subjectId": { $in: subjectIds.map((id) => new Types.ObjectId(id)) },
          },
        },
        { $group: { _id: "$slots.subjectId" } },
      ]);
      const taught = new Set(taughtSubjects.map((row) => String(row._id)));
      if (subjectIds.some((id) => !taught.has(id)))
        throw createError(403, "Faculty may author questions only for subjects they teach");
    }

    const normalized: Record<string, unknown>[] = [];
    const batchFingerprints = new Set<string>();
    for (const row of rows) {
      const subjectId = String(row.subjectId);
      const subject = subjectsById.get(subjectId)!;
      const content = validateQuestionContent(row);
      const key = `${subjectId}:${content.fingerprint}`;
      if (batchFingerprints.has(key))
        throw createError(409, "Bulk import contains duplicate questions");
      batchFingerprints.add(key);
      normalized.push({
        ...row,
        ...content,
        subjectId: subject._id,
        subjectCode: subject.code,
        departmentId: subject.departmentId,
        createdBy: authorId,
        status: QuestionStatus.DRAFT,
        isActive: false,
        usageCount: 0,
        revision: 1,
      });
    }
    const duplicates = await questionBankRepository.findDuplicates(
      normalized.map((question) => ({
        subjectId: String(question.subjectId),
        fingerprint: String(question.fingerprint),
      })),
    );
    if (duplicates.length > 0)
      throw createError(409, "An active question with the same text already exists");
    return questionBankRepository.createBulk(normalized);
  },

  update: async (
    id: string,
    data: Record<string, unknown>,
    actorId: string,
    facultyOwned: boolean,
  ) => {
    const existing = (await questionBankRepository.findById(id)) as unknown as IQuestion | null;
    if (!existing) throw createError(404, "Question not found");
    if (existing.status !== QuestionStatus.DRAFT || existing.usageCount > 0)
      throw createError(409, "Approved, retired, or used questions are immutable");
    const normalized = (await normalizeQuestion(
      data,
      String(existing.createdBy),
      false,
      existing,
    )) as Record<string, unknown>;
    for (const field of [
      "_id",
      "status",
      "isActive",
      "usageCount",
      "revision",
      "approvedBy",
      "approvedAt",
      "retiredBy",
      "retiredAt",
      "retirementReason",
      "createdAt",
      "updatedAt",
    ])
      delete normalized[field];
    normalized.updatedBy = actorId;
    const updated = await questionBankRepository.updateDraft(
      id,
      normalized,
      facultyOwned ? actorId : undefined,
    );
    if (!updated)
      throw createError(409, "Question was concurrently changed or is not owned by you");
    return updated;
  },

  approve: async (id: string, approvedBy: string) => {
    const existing = await questionBankRepository.findById(id);
    if (!existing) throw createError(404, "Question not found");
    if (String(existing.createdBy) === approvedBy)
      throw createError(409, "Question approval requires a different academic reviewer");
    if (
      await questionBankRepository.findDuplicate(
        String(existing.subjectId),
        existing.fingerprint,
        id,
      )
    )
      throw createError(409, "A duplicate question is already active for this subject");
    const approved = await questionBankRepository.approve(id, approvedBy);
    if (!approved) throw createError(409, "Only a draft question can be approved");
    return approved;
  },

  retire: async (id: string, retiredBy: string, reason: string) => {
    const retirementReason = reason?.trim();
    if (!retirementReason || retirementReason.length > 1000)
      throw createError(400, "A retirement reason is required");
    const retired = await questionBankRepository.retire(id, retiredBy, retirementReason);
    if (!retired) throw createError(409, "Question is already retired");
    return retired;
  },

  delete: async (id: string, facultyOwnerId?: string) => {
    const deleted = await questionBankRepository.deleteUnusedDraft(id, facultyOwnerId);
    if (!deleted)
      throw createError(409, "Only an unused draft question can be permanently deleted");
    return deleted;
  },

  getRandomQuestions: (subjectId: string, unitNo: number, difficulty: string, count: number) => {
    if (!Types.ObjectId.isValid(subjectId)) throw createError(400, "Valid subject is required");
    if (!Number.isInteger(unitNo) || unitNo < 1 || unitNo > 20)
      throw createError(400, "Unit number must be between 1 and 20");
    if (!DIFFICULTIES.has(difficulty)) throw createError(400, "Invalid difficulty");
    if (!Number.isInteger(count) || count < 1 || count > 100)
      throw createError(400, "Question count must be between 1 and 100");
    return questionBankRepository.getRandomQuestions(subjectId, unitNo, difficulty, count);
  },
};
