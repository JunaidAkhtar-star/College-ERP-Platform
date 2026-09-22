import type { Request, Response, NextFunction } from "express";
import { quizService } from "../services";
import createError from "http-errors";
import { SystemRole } from "../constants/roles";
import { QuizStatus } from "../models/quiz.model";
import {
  quizRepository,
  sectionRepository,
  semesterRegistrationRepository,
  studentSectionAllotmentRepository,
} from "../repositories";
import { applyDepartmentScope, assertDepartmentAccess } from "../utils/ownership.util";
import { RegistrationStatus } from "../models/semester-registration.model";

async function studentQuizScope(req: Request) {
  const allotment = await studentSectionAllotmentRepository.findCurrentActiveForStudent(
    req.user!._id.toString(),
  );
  if (!allotment) throw createError(403, "An active class allotment is required");
  return {
    sectionId: allotment.sectionId,
    departmentId: allotment.departmentId,
    semester: allotment.semesterNo,
    academicYear: allotment.academicYear,
  };
}

async function assertStudentEligibility(req: Request, quiz: Record<string, unknown>) {
  const scope = await studentQuizScope(req);
  if (
    String(quiz.departmentId) !== String(scope.departmentId) ||
    String(quiz.sectionId) !== String(scope.sectionId) ||
    quiz.semester !== scope.semester ||
    quiz.academicYear !== scope.academicYear
  )
    throw createError(403, "This quiz is not assigned to your class");
  const registration = await semesterRegistrationRepository.findByStudentSemester(
    req.user!._id.toString(),
    Number(quiz.semester),
    String(quiz.academicYear),
  );
  if (
    !registration ||
    ![RegistrationStatus.APPROVED, RegistrationStatus.FROZEN].includes(registration.status) ||
    !registration.registeredSubjects.some(
      (subject) => String(subject.subjectId) === String(quiz.subjectId),
    )
  )
    throw createError(403, "Student is not registered for this quiz subject");
}

export const quizController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { subjectId, academicYear, section, quizType } = req.query;
      const filter: Record<string, unknown> = {};
      if (subjectId) filter.subjectId = subjectId;
      if (academicYear) filter.academicYear = academicYear;
      if (section) filter.section = section;
      if (quizType) filter.quizType = quizType;
      const scopedFilter =
        req.activeRole === SystemRole.STUDENT
          ? { ...filter, ...(await studentQuizScope(req)), status: QuizStatus.PUBLISHED }
          : await applyDepartmentScope(req, filter);
      if (req.activeRole === SystemRole.FACULTY) scopedFilter.facultyId = req.user!._id;
      const result = await quizService.getAll(
        scopedFilter,
        Number(req.query.page) || 1,
        Number(req.query.limit) || 20,
        req.activeRole !== SystemRole.STUDENT,
      );
      let data = result.data as unknown as Array<Record<string, unknown>>;
      if (req.activeRole === SystemRole.STUDENT) {
        const attempts = await quizRepository.getStudentAttempts(
          result.data.map((quiz) => String(quiz._id)),
          req.user!._id.toString(),
        );
        const attemptByQuiz = new Map(attempts.map((attempt) => [String(attempt.quizId), attempt]));
        data = result.data.map((quiz) => {
          const { questions, ...metadata } = quiz;
          return {
            ...metadata,
            questionCount: Array.isArray(questions) ? questions.length : 0,
            myAttempt: attemptByQuiz.get(String(quiz._id)),
          };
        });
      }
      res.json({ success: true, ...result, data });
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await quizService.getById(req.params.id);
      if (!data) {
        res.status(404).json({ success: false, message: "Not found" });
        return;
      }
      if (req.activeRole === SystemRole.STUDENT) {
        await assertStudentEligibility(req, data as unknown as Record<string, unknown>);
        if (data.status !== QuizStatus.PUBLISHED) throw createError(404, "Quiz not found");
        const { questions: _questions, ...metadata } = data;
        res.json({ success: true, data: metadata });
        return;
      }
      await assertDepartmentAccess(req, data.departmentId);
      if (
        req.activeRole === SystemRole.FACULTY &&
        String(data.facultyId) !== req.user!._id.toString()
      )
        throw createError(403, "Faculty can access only their own quizzes");
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const section = await sectionRepository.findRawById(String(req.body.sectionId ?? ""));
      if (!section) throw createError(404, "Section not found");
      await assertDepartmentAccess(req, section.departmentId);
      const data = await quizService.create({
        ...req.body,
        facultyId: req.user!._id,
        createdBy: req.user!._id,
      });
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await quizService.getById(req.params.id);
      if (!existing) throw createError(404, "Quiz not found");
      await assertDepartmentAccess(req, existing.departmentId);
      if (
        req.activeRole === SystemRole.FACULTY &&
        String(existing.facultyId) !== req.user!._id.toString()
      )
        throw createError(403, "Faculty can update only their own quizzes");
      const data = await quizService.update(req.params.id, req.body, String(existing.facultyId));
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  deleteDraft: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await quizService.getById(req.params.id);
      if (!existing) throw createError(404, "Quiz not found");
      await assertDepartmentAccess(req, existing.departmentId);
      const facultyId =
        req.activeRole === SystemRole.FACULTY ? req.user!._id.toString() : undefined;
      await quizService.deleteDraft(req.params.id, facultyId);
      res.json({ success: true, message: "Quiz draft deleted" });
    } catch (err) {
      next(err);
    }
  },

  submit: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { answers } = req.body;
      const quiz = await quizService.getById(req.params.id);
      if (!quiz) throw createError(404, "Quiz not found");
      await assertStudentEligibility(req, quiz as unknown as Record<string, unknown>);
      const data = await quizService.submitAttempt(
        req.params.id,
        req.user!._id as unknown as string,
        answers,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  saveAnswers: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const quiz = await quizService.getById(req.params.id);
      if (!quiz) throw createError(404, "Quiz not found");
      await assertStudentEligibility(req, quiz as unknown as Record<string, unknown>);
      const data = await quizService.saveAnswers(
        req.params.id,
        req.user!._id.toString(),
        req.body.answers,
        req.body.revision,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  start: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const quiz = await quizService.getById(req.params.id);
      if (!quiz) throw createError(404, "Quiz not found");
      await assertStudentEligibility(req, quiz as unknown as Record<string, unknown>);
      const data = await quizService.startAttempt(req.params.id, req.user!._id.toString());
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  myAttempt: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const quiz = await quizService.getById(req.params.id);
      if (!quiz) throw createError(404, "Quiz not found");
      await assertStudentEligibility(req, quiz as unknown as Record<string, unknown>);
      const data = await quizService.getStudentAttempt(
        req.params.id,
        req.user!._id as unknown as string,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  publish: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const quiz = await quizService.getById(req.params.id);
      if (!quiz) throw createError(404, "Quiz not found");
      await assertDepartmentAccess(req, quiz.departmentId);
      const facultyId =
        req.activeRole === SystemRole.FACULTY ? req.user!._id.toString() : undefined;
      const data = await quizService.publish(req.params.id, facultyId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  close: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const quiz = await quizService.getById(req.params.id);
      if (!quiz) throw createError(404, "Quiz not found");
      await assertDepartmentAccess(req, quiz.departmentId);
      const facultyId =
        req.activeRole === SystemRole.FACULTY ? req.user!._id.toString() : undefined;
      const data = await quizService.close(req.params.id, facultyId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  // ── Proctoring ─────────────────────────────────────────────────────────────

  /** POST /quiz/:id/proctor-event — student reports an event */
  recordProctoringEvent: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { eventType, metadata } = req.body;
      const quiz = await quizService.getById(req.params.id);
      if (!quiz) throw createError(404, "Quiz not found");
      await assertStudentEligibility(req, quiz as unknown as Record<string, unknown>);
      const result = await quizService.recordProctoringEvent(
        req.params.id,
        req.user!._id as unknown as string,
        eventType,
        metadata,
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  /** GET /quiz/:id/proctor-log — faculty / admin views all events */
  getProctoringLog: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const quiz = await quizService.getById(req.params.id);
      if (!quiz) throw createError(404, "Quiz not found");
      await assertDepartmentAccess(req, quiz.departmentId);
      if (
        req.activeRole === SystemRole.FACULTY &&
        String(quiz.facultyId) !== req.user!._id.toString()
      )
        throw createError(403, "Faculty can access only their own quiz proctoring logs");
      const data = await quizService.getProctoringLog(req.params.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};
