import type { Request, Response, NextFunction } from "express";
import createError from "http-errors";
import { questionBankService } from "../services";
import { SystemRole } from "../constants/roles";
import { QuestionStatus } from "../models/question-bank.model";
import { subjectRepository } from "../repositories";
import { applyDepartmentScope, assertDepartmentAccess } from "../utils/ownership.util";

async function assertSubjectAccess(req: Request, subjectId: string) {
  const subject = await subjectRepository.findById(subjectId);
  if (!subject) throw createError(404, "Subject not found");
  await assertDepartmentAccess(req, subject.departmentId);
}

async function assertQuestionAccess(req: Request, question: Record<string, unknown>) {
  await assertDepartmentAccess(req, question.departmentId);
  if (
    req.activeRole === SystemRole.FACULTY &&
    question.status !== QuestionStatus.APPROVED &&
    String(question.createdBy) !== req.user!._id.toString()
  )
    throw createError(403, "Faculty can access only approved questions or their own drafts");
}

export const questionBankController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { subjectId, unitNo, difficultyLevel, questionType, status } = req.query;
      const filter: Record<string, unknown> = {};
      if (subjectId) filter.subjectId = subjectId;
      if (unitNo) filter.unitNo = Number(unitNo);
      if (difficultyLevel) filter.difficultyLevel = difficultyLevel;
      if (questionType) filter.questionType = questionType;
      if (status) filter.status = status;
      const scopedFilter = await applyDepartmentScope(req, filter);
      if (req.activeRole === SystemRole.FACULTY) {
        scopedFilter.$or = [
          { status: QuestionStatus.APPROVED },
          { status: QuestionStatus.DRAFT, createdBy: req.user!._id },
        ];
      }
      const result = await questionBankService.getAll(
        scopedFilter,
        Number(req.query.page) || 1,
        Number(req.query.limit) || 20,
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await questionBankService.getById(req.params.id);
      if (!data) throw createError(404, "Question not found");
      await assertQuestionAccess(req, data as unknown as Record<string, unknown>);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      await assertSubjectAccess(req, String(req.body.subjectId ?? ""));
      const data = await questionBankService.create(
        req.body,
        req.user!._id.toString(),
        req.activeRole === SystemRole.FACULTY,
      );
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  createBulk: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const questions = req.body.questions as Record<string, unknown>[];
      const subjectIds = [
        ...new Set(questions.map((question) => String(question.subjectId ?? ""))),
      ];
      for (const subjectId of subjectIds) await assertSubjectAccess(req, subjectId);
      const data = await questionBankService.createBulk(
        questions,
        req.user!._id.toString(),
        req.activeRole === SystemRole.FACULTY,
      );
      res.status(201).json({ success: true, count: data.length, data });
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await questionBankService.getById(req.params.id);
      if (!existing) throw createError(404, "Question not found");
      await assertQuestionAccess(req, existing as unknown as Record<string, unknown>);
      if (req.body.subjectId) await assertSubjectAccess(req, String(req.body.subjectId));
      const data = await questionBankService.update(
        req.params.id,
        req.body,
        req.user!._id.toString(),
        req.activeRole === SystemRole.FACULTY,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  approve: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await questionBankService.getById(req.params.id);
      if (!existing) throw createError(404, "Question not found");
      await assertDepartmentAccess(req, existing.departmentId);
      const data = await questionBankService.approve(req.params.id, req.user!._id.toString());
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  retire: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await questionBankService.getById(req.params.id);
      if (!existing) throw createError(404, "Question not found");
      await assertDepartmentAccess(req, existing.departmentId);
      const data = await questionBankService.retire(
        req.params.id,
        req.user!._id.toString(),
        req.body.reason,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  delete: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await questionBankService.getById(req.params.id);
      if (!existing) throw createError(404, "Question not found");
      await assertDepartmentAccess(req, existing.departmentId);
      const ownerId = req.activeRole === SystemRole.FACULTY ? req.user!._id.toString() : undefined;
      await questionBankService.delete(req.params.id, ownerId);
      res.json({ success: true, message: "Unused draft deleted" });
    } catch (err) {
      next(err);
    }
  },

  getRandom: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const subjectId = String(req.query.subjectId ?? "");
      await assertSubjectAccess(req, subjectId);
      const data = await questionBankService.getRandomQuestions(
        subjectId,
        Number(req.query.unitNo),
        String(req.query.difficulty ?? ""),
        Number(req.query.count) || 10,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};
