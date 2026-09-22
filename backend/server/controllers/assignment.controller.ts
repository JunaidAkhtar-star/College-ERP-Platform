import type { Request, Response, NextFunction } from "express";
import { assignmentService } from "../services";
import createError from "http-errors";
import { SystemRole } from "../constants/roles";
import { applyDepartmentScope, assertDepartmentAccess } from "../utils/ownership.util";
import { AssignmentStatus } from "../models/assignment.model";
import {
  assignmentRepository,
  sectionRepository,
  semesterRegistrationRepository,
  studentSectionAllotmentRepository,
} from "../repositories";
import { RegistrationStatus } from "../models/semester-registration.model";
import { UserModel } from "../models/user.model";

async function studentAssignmentScope(req: Request): Promise<Record<string, unknown>> {
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

function redactStudentSubmissions<T extends { submissions?: Array<{ studentId: unknown }> }>(
  assignment: T,
  studentId: string,
): T & { mySubmission?: { studentId: unknown } } {
  const ownSubmission = assignment.submissions?.find(
    (item) => String(item.studentId) === studentId,
  );
  return {
    ...assignment,
    submissions: ownSubmission ? [ownSubmission] : [],
    mySubmission: ownSubmission,
  } as T & { mySubmission?: { studentId: unknown } };
}

const TEACHING_AUTHOR_ROLES = [SystemRole.HOD, SystemRole.FACULTY];

function isTeachingAuthor(req: Request): boolean {
  return TEACHING_AUTHOR_ROLES.includes(req.activeRole as SystemRole);
}

function assertTeachingAuthorOwnership(req: Request, facultyId: unknown, action: string): void {
  if (isTeachingAuthor(req) && String(facultyId) !== req.user!._id.toString()) {
    throw createError(403, `You can ${action} only assignments from your own teaching workload`);
  }
}

export const assignmentController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { search, status, sectionId, subjectId, academicYear, section, departmentId } =
        req.query;
      const filter: Record<string, unknown> = {};
      if (search) {
        const escaped = String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        filter.$or = [
          { title: { $regex: escaped, $options: "i" } },
          { description: { $regex: escaped, $options: "i" } },
          { subjectCode: { $regex: escaped, $options: "i" } },
          { program: { $regex: escaped, $options: "i" } },
          { section: { $regex: escaped, $options: "i" } },
        ];
      }
      if (status) filter.status = status;
      if (sectionId) filter.sectionId = sectionId;
      if (subjectId) filter.subjectId = subjectId;
      if (academicYear) filter.academicYear = academicYear;
      if (section) filter.section = section;
      if (departmentId) filter.departmentId = departmentId;
      const scopedFilter: Record<string, unknown> =
        req.activeRole === SystemRole.STUDENT
          ? {
              ...filter,
              ...(await studentAssignmentScope(req)),
              status:
                status && status !== AssignmentStatus.DRAFT
                  ? status
                  : {
                      $in:
                        status === AssignmentStatus.DRAFT
                          ? []
                          : [
                              AssignmentStatus.PUBLISHED,
                              AssignmentStatus.CLOSED,
                              AssignmentStatus.EVALUATED,
                            ],
                    },
            }
          : await applyDepartmentScope(req, filter);
      if (
        req.activeRole === SystemRole.FACULTY ||
        (req.activeRole === SystemRole.HOD && req.query.scope === "mine")
      ) {
        scopedFilter.facultyId = req.user!._id;
      }
      const result = await assignmentService.getAll(
        scopedFilter,
        Number(req.query.page) || 1,
        Number(req.query.limit) || 20,
      );
      let data = result.data as unknown as Array<Record<string, unknown>>;
      if (req.activeRole === SystemRole.STUDENT) {
        const ownSubmissions = await assignmentRepository.findStudentSubmissions(
          result.data.map((item) => String(item._id)),
          req.user!._id.toString(),
        );
        const ownByAssignment = new Map(
          ownSubmissions.map((item) => [String(item._id), item.submissions?.[0]]),
        );
        data = result.data.map((item) => ({
          ...item,
          mySubmission: ownByAssignment.get(String(item._id)),
        }));
      }
      res.json({ success: true, ...result, data });
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await assignmentService.getById(req.params.id);
      if (!data) {
        res.status(404).json({ success: false, message: "Not found" });
        return;
      }
      if (req.activeRole === SystemRole.STUDENT) {
        if (data.status === AssignmentStatus.DRAFT) throw createError(404, "Assignment not found");
        const scope = await studentAssignmentScope(req);
        if (
          String(data.departmentId) !== String(scope["departmentId"]) ||
          String(data.sectionId) !== String(scope["sectionId"]) ||
          data.semester !== scope["semester"] ||
          data.academicYear !== scope["academicYear"]
        ) {
          throw createError(403, "This assignment is not assigned to your class");
        }
        res.json({
          success: true,
          data: redactStudentSubmissions(data, req.user!._id.toString()),
        });
        return;
      }
      await assertDepartmentAccess(req, data.departmentId);
      if (
        req.activeRole === SystemRole.FACULTY &&
        String(data.facultyId) !== req.user!._id.toString()
      ) {
        throw createError(403, "Faculty can access only their own assignments");
      }
      const students = await UserModel.find({
        _id: { $in: data.submissions.map((item) => item.studentId) },
      })
        .select("_id name studentId")
        .lean();
      const studentNames = new Map(
        students.map((student) => [String(student._id), student.name || student.studentId]),
      );
      res.json({
        success: true,
        data: {
          ...data,
          submissions: data.submissions.map((item) => ({
            ...item,
            studentId: String(item.studentId),
            studentName: studentNames.get(String(item.studentId)),
          })),
        },
      });
    } catch (err) {
      next(err);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const section = await sectionRepository.findRawById(String(req.body.sectionId || ""));
      if (!section) throw createError(404, "Section not found");
      await assertDepartmentAccess(req, section.departmentId);
      const data = await assignmentService.create({
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
      const existing = await assignmentService.getById(req.params.id);
      if (!existing) throw createError(404, "Assignment not found");
      await assertDepartmentAccess(req, existing.departmentId);
      assertTeachingAuthorOwnership(req, existing.facultyId, "update");
      const data = await assignmentService.update(
        req.params.id,
        req.body,
        String(existing.facultyId),
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  submit: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fileUrl, textContent } = req.body;
      const assignment = await assignmentService.getById(req.params.id);
      if (!assignment) {
        res.status(404).json({ success: false, message: "Not found" });
        return;
      }
      const scope = await studentAssignmentScope(req);
      if (
        String(assignment.departmentId) !== String(scope["departmentId"]) ||
        String(assignment.sectionId) !== String(scope["sectionId"]) ||
        assignment.semester !== scope["semester"] ||
        assignment.academicYear !== scope["academicYear"]
      ) {
        throw createError(403, "This assignment is not assigned to your class");
      }
      if (!assignment.isActive) throw createError(409, "This assignment is closed");
      const registration = await semesterRegistrationRepository.findByStudentSemester(
        req.user!._id.toString(),
        assignment.semester,
        assignment.academicYear,
      );
      if (
        !registration ||
        ![RegistrationStatus.APPROVED, RegistrationStatus.FROZEN].includes(registration.status) ||
        !registration.registeredSubjects.some(
          (subject) => String(subject.subjectId) === String(assignment.subjectId),
        )
      ) {
        throw createError(403, "Student is not registered for this assignment subject");
      }
      const data = await assignmentService.submitAssignment(
        req.params.id,
        req.user!._id as unknown as string,
        { fileUrl, textContent },
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  grade: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { marks, feedback } = req.body;
      const studentId = req.params.studentId;
      const assignment = await assignmentService.getById(req.params.id);
      if (!assignment) throw createError(404, "Assignment not found");
      await assertDepartmentAccess(req, assignment.departmentId);
      assertTeachingAuthorOwnership(req, assignment.facultyId, "grade");
      if (
        !Number.isFinite(Number(marks)) ||
        Number(marks) < 0 ||
        Number(marks) > assignment.maxMarks
      ) {
        throw createError(400, `Marks must be between 0 and ${assignment.maxMarks}`);
      }
      const data = await assignmentService.gradeSubmission(
        req.params.id,
        studentId,
        marks,
        feedback,
        req.user!._id as unknown as string,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  publish: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const assignment = await assignmentService.getById(req.params.id);
      if (!assignment) throw createError(404, "Assignment not found");
      await assertDepartmentAccess(req, assignment.departmentId);
      const facultyId = isTeachingAuthor(req) ? req.user!._id.toString() : undefined;
      const data = await assignmentService.publish(req.params.id, facultyId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  close: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const assignment = await assignmentService.getById(req.params.id);
      if (!assignment) throw createError(404, "Assignment not found");
      await assertDepartmentAccess(req, assignment.departmentId);
      const facultyId =
        req.activeRole === SystemRole.FACULTY ? req.user!._id.toString() : undefined;
      const data = await assignmentService.close(req.params.id, facultyId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};
