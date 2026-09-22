import type { Request, Response, NextFunction } from "express";
import createError from "http-errors";
import { SystemRole } from "../constants/roles";
import { examinationService } from "../services";
import { departmentRepository, studentProfileRepository } from "../repositories";
import { assertDepartmentAccess, getDepartmentScope } from "../utils/ownership.util";
import { nextSeq } from "../models/counter.model";
import { isValidObjectId } from "mongoose";

function resolveStudentAccess(req: Request) {
  const requestedStudentId = req.params["studentId"] || req.user?._id.toString() || "";
  if (req.activeRole === SystemRole.STUDENT && requestedStudentId !== req.user?._id.toString()) {
    throw createError(403, "Students can access only their own examination records");
  }
  return requestedStudentId;
}

async function getScopedDepartmentCode(req: Request) {
  const departmentId = await getDepartmentScope(req);
  if (!departmentId) return undefined;
  const department = await departmentRepository.findById(departmentId);
  return department?.code;
}

async function assertStudentDepartmentAccess(req: Request, studentId: string) {
  const departmentId = await getDepartmentScope(req);
  if (!departmentId) return;
  const profile = await studentProfileRepository.findByUserId(studentId);
  if (!profile || profile.department?.toString() !== departmentId) {
    throw createError(403, "You can access results only for your department students");
  }
}

export const examinationController = {
  // Schedules
  createSchedule: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await examinationService.createSchedule(
        req.body,
        req.user?._id.toString() || "",
      );
      res.status(201).json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  getSchedule: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await examinationService.getSchedule(req.params["id"]!);
      await assertDepartmentAccess(req, data.departmentId);
      if (
        req.activeRole === SystemRole.FACULTY &&
        !data.subjects.some((subject) =>
          subject.invigilators?.some(
            (invigilator) => invigilator.toString() === req.user?._id.toString(),
          ),
        )
      ) {
        throw createError(403, "Faculty can access only their assigned examination schedules");
      }
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  listSchedules: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filter = { ...req.query } as Record<string, unknown>;
      const departmentCode = await getScopedDepartmentCode(req);
      if (departmentCode) filter["branch"] = departmentCode;
      if (req.activeRole === SystemRole.FACULTY) {
        filter["subjects.invigilators"] = req.user?._id;
      }
      const data = await examinationService.listSchedules(filter);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  updateSchedule: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await examinationService.updateSchedule(req.params["id"]!, req.body);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  // Marks
  enterMarks: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const marks = Array.isArray(req.body) ? req.body : req.body.marks;
      const enteredBy = req.user?._id.toString() || "";
      const data = await examinationService.enterMarks(
        marks.map((m: Record<string, unknown>) => ({
          ...m,
          enteredBy,
          requireAssignedSchedule: req.activeRole === SystemRole.FACULTY,
        })),
      );
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  getStudentMarks: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { semester, academicYear } = req.query as Record<string, string>;
      const studentId = resolveStudentAccess(req);
      await assertStudentDepartmentAccess(req, studentId);
      const data = await examinationService.getStudentMarks(
        studentId,
        Number(semester),
        academicYear,
        req.activeRole === SystemRole.STUDENT,
      );
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  listPendingMarkVerification: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filter: Record<string, unknown> = {};
      if (req.query["scheduleId"]) filter["scheduleId"] = req.query["scheduleId"];
      if (req.query["academicYear"]) filter["academicYear"] = req.query["academicYear"];
      const data = await examinationService.listPendingMarkVerification(filter);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  verifyMarks: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await examinationService.verifyMarks(
        req.body.markIds,
        req.user?._id.toString() || "",
      );
      res.json({ success: true, data, message: "Marks verified" });
    } catch (e) {
      next(e);
    }
  },

  listAttempts: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentId, subjectId, semester, academicYear, attemptType } = req.query;
      const filter: Record<string, unknown> = {};
      if (studentId) filter.studentId = studentId;
      if (subjectId) filter.subjectId = subjectId;
      if (semester) filter.semester = Number(semester);
      if (academicYear) filter.academicYear = academicYear;
      if (attemptType) filter.attemptType = attemptType;

      if (req.activeRole === SystemRole.STUDENT) {
        filter.studentId = req.user?._id.toString();
      }

      const departmentId = await getDepartmentScope(req);
      if (departmentId) filter.departmentId = departmentId;

      const data = await examinationService.listAttempts(filter);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  // Results
  compileSemesterResult: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentId, rollNumber, enrollmentNumber, semester, academicYear, program, branch } =
        req.body;
      const data = await examinationService.compileSemesterResult(
        studentId,
        rollNumber,
        enrollmentNumber,
        Number(semester),
        academicYear,
        program,
        branch,
        req.user?._id.toString() || "",
      );
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  publishResults: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { semester, academicYear } = req.body;
      const data = await examinationService.publishResults(Number(semester), academicYear);
      res.json({ success: true, data, message: "Results published" });
    } catch (e) {
      next(e);
    }
  },

  getResult: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { semester, academicYear } = req.query as Record<string, string>;
      const studentId = resolveStudentAccess(req);
      await assertStudentDepartmentAccess(req, studentId);
      const data = await examinationService.getResult(
        studentId,
        Number(semester),
        academicYear,
        req.activeRole === SystemRole.STUDENT,
      );
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  getStudentResults: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const studentId = resolveStudentAccess(req);
      await assertStudentDepartmentAccess(req, studentId);
      const data = await examinationService.getStudentResults(
        studentId,
        req.activeRole === SystemRole.STUDENT,
      );
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  listResults: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, academicYear, program, departmentId, batchId, semester } =
        req.query as Record<string, string>;
      const filter: Record<string, unknown> = {};
      if (academicYear) {
        if (!/^\d{4}-(?:\d{2}|\d{4})$/.test(academicYear)) {
          throw createError(400, "Select a valid academic year");
        }
        filter.academicYear = academicYear;
      }
      if (program) filter.program = program.trim().slice(0, 100);
      if (departmentId) {
        if (!isValidObjectId(departmentId)) throw createError(400, "Invalid department filter");
        filter.departmentId = departmentId;
      }
      if (batchId) {
        if (!isValidObjectId(batchId)) throw createError(400, "Invalid batch filter");
        filter.batchId = batchId;
      }
      if (semester) {
        const semesterNumber = Number(semester);
        if (!Number.isInteger(semesterNumber) || semesterNumber < 1 || semesterNumber > 12) {
          throw createError(400, "Invalid semester filter");
        }
        filter.semester = semesterNumber;
      }
      const departmentCode = await getScopedDepartmentCode(req);
      if (departmentCode) filter.branch = departmentCode;
      const data = await examinationService.listResults(
        filter,
        Number(page || 1),
        Math.min(Math.max(Number(limit || 20), 1), 500),
      );
      res.json({ success: true, ...data });
    } catch (e) {
      next(e);
    }
  },

  getRanklist: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { semester, academicYear, program, departmentId, batchId } = req.query as Record<
        string,
        string
      >;
      if (!/^\d{4}-(?:\d{2}|\d{4})$/.test(academicYear ?? "")) {
        throw createError(400, "Select a valid academic year");
      }
      const semesterNumber = Number(semester);
      if (!Number.isInteger(semesterNumber) || semesterNumber < 1 || semesterNumber > 12) {
        throw createError(400, "Select a valid semester");
      }
      const filter: Record<string, unknown> = {
        semester: semesterNumber,
        academicYear,
      };
      if (program) filter.program = program.trim().slice(0, 100);
      if (departmentId) {
        if (!isValidObjectId(departmentId)) throw createError(400, "Invalid department filter");
        filter.departmentId = departmentId;
      }
      if (batchId) {
        if (!isValidObjectId(batchId)) throw createError(400, "Invalid batch filter");
        filter.batchId = batchId;
      }
      const departmentCode = await getScopedDepartmentCode(req);
      if (departmentCode) filter.branch = { $regex: departmentCode, $options: "i" };
      const data = await examinationService.getRanklist(filter);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  generateHallTicket: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const seq = await nextSeq("examination:hall-ticket");
      const pdf = await examinationService.generateHallTicket(
        { ...req.body, generatedBy: req.user?._id.toString() },
        seq,
      );
      res.set("Content-Type", "application/pdf");
      res.set("Content-Disposition", "inline; filename=hall-ticket.pdf");
      res.send(pdf);
    } catch (e) {
      next(e);
    }
  },

  generateSeatingPlan: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const createdBy = (req.user!._id as unknown as string).toString();
      const asPdf = req.query.pdf === "true";
      const data = await examinationService.generateSeatingPlan(req.params.id, createdBy, asPdf);
      if (asPdf && Buffer.isBuffer(data)) {
        res.set({
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="seating-plan-${req.params.id}.pdf"`,
        });
        res.send(data);
        return;
      }
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  // ── Recheck / Revaluation (M20) ──────────────────────────────────────────
  submitRecheck: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const studentId = (req.user!._id as unknown as string).toString();
      const {
        rollNumber,
        semester,
        academicYear,
        subjectCode,
        subjectName,
        requestType,
        currentMarks,
        reason,
      } = req.body;
      const data = await examinationService.submitRecheckRequest(
        studentId,
        rollNumber,
        Number(semester),
        academicYear,
        subjectCode,
        subjectName,
        requestType,
        Number(currentMarks),
        reason,
      );
      res.status(201).json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  listRecheckRequests: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentId, status, semester, academicYear, requestType, feePaid, page, limit } =
        req.query;
      const filter: Record<string, unknown> = {};
      if (studentId) filter.studentId = studentId;
      if (status) filter.status = status;
      if (semester) filter.semester = Number(semester);
      if (academicYear) filter.academicYear = academicYear;
      if (requestType) filter.requestType = requestType;
      if (feePaid === "true" || feePaid === "false") filter.feePaid = feePaid === "true";
      const departmentId = await getDepartmentScope(req);
      if (departmentId) {
        filter.studentId = {
          $in: await studentProfileRepository.findUserIdsByDepartment(departmentId),
        };
      }
      const result = await examinationService.listRecheckRequests(
        filter,
        Number(page) || 1,
        Number(limit) || 20,
      );
      res.json({ success: true, ...result });
    } catch (e) {
      next(e);
    }
  },

  listMyRecheckRequests: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, semester, academicYear, requestType, feePaid } = req.query;
      const filter: Record<string, unknown> = { studentId: req.user!._id };
      if (status) filter.status = status;
      if (semester) filter.semester = Number(semester);
      if (academicYear) filter.academicYear = academicYear;
      if (requestType) filter.requestType = requestType;
      if (feePaid === "true" || feePaid === "false") filter.feePaid = feePaid === "true";
      const result = await examinationService.listRecheckRequests(
        filter,
        Number(req.query.page) || 1,
        Math.min(Math.max(Number(req.query.limit) || 20, 1), 500),
      );
      res.json({ success: true, ...result });
    } catch (e) {
      next(e);
    }
  },

  reviewRecheck: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reviewedBy = (req.user!._id as unknown as string).toString();
      const { status, revisedMarks, reviewNotes } = req.body;
      const data = await examinationService.reviewRecheckRequest(
        req.params.id,
        reviewedBy,
        status,
        revisedMarks,
        reviewNotes,
      );
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  markRecheckFeePaid: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await examinationService.markRecheckFeePaid(req.params.id);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  // ── Marksheet / Transcript ──────────────────────────────────────────────────

  /** GET /examination/results/student/:studentId/marksheet?semester=&academicYear= */
  downloadMarksheet: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { semester, academicYear } = req.query as Record<string, string>;
      const resolvedStudentId = resolveStudentAccess(req);
      await assertStudentDepartmentAccess(req, resolvedStudentId);

      if (!semester || !academicYear) {
        res
          .status(400)
          .json({ success: false, message: "semester and academicYear query params are required" });
        return;
      }

      const pdfBuffer = await examinationService.generateMarksheetPdf(
        resolvedStudentId,
        Number(semester),
        academicYear,
      );

      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="marksheet_${resolvedStudentId}_sem${semester}.pdf"`,
        "Content-Length": pdfBuffer.length,
        "Cache-Control": "private, max-age=3600",
      });
      res.end(pdfBuffer);
    } catch (e) {
      next(e);
    }
  },

  /** GET /examination/results/student/:studentId/transcript */
  downloadTranscript: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resolvedStudentId = resolveStudentAccess(req);
      await assertStudentDepartmentAccess(req, resolvedStudentId);
      const pdfBuffer = await examinationService.generateTranscriptPdf(resolvedStudentId);

      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="transcript_${resolvedStudentId}.pdf"`,
        "Content-Length": pdfBuffer.length,
        "Cache-Control": "private, max-age=3600",
      });
      res.end(pdfBuffer);
    } catch (e) {
      next(e);
    }
  },
};
