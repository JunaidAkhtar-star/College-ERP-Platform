/**
 * Module-level validation rules for all ERP modules.
 * Uses express-validator. Applied via validation.middleware.ts.
 *
 * Pattern: import { fooValidation } from "../validations";
 *          router.post("/", fooValidation.create, validate, controller.create);
 */
import { body, param } from "express-validator";

// ── Helpers ───────────────────────────────────────────────────────────────────
const mongoId = (field: string) =>
  param(field).isMongoId().withMessage(`${field} must be a valid MongoDB ObjectId`);

const optionalString = (field: string) =>
  body(field).optional().isString().trim().withMessage(`${field} must be a string`);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authValidation = {
  login: [
    body("email").isEmail().normalizeEmail().withMessage("Valid email required"),
    body("password").isString().notEmpty().withMessage("Password required"),
  ],
  forgotPassword: [body("email").isEmail().normalizeEmail().withMessage("Valid email required")],
  resetPassword: [
    body("email").isEmail().normalizeEmail(),
    body("otp").isString().isLength({ min: 6, max: 6 }).withMessage("OTP must be 6 digits"),
    body("newPassword")
      .isLength({ min: 8 })
      .matches(/^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/)
      .withMessage("Password must be 8+ chars with uppercase, number, and special char"),
  ],
  changePassword: [
    body("currentPassword").isString().notEmpty(),
    body("newPassword")
      .isLength({ min: 8 })
      .matches(/^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/)
      .withMessage("Password must be 8+ chars with uppercase, number, and special char"),
  ],
};

// ── User ──────────────────────────────────────────────────────────────────────
export const userCreateValidation = {
  create: [
    body("name").isString().trim().notEmpty().withMessage("Name required"),
    body("email").isEmail().normalizeEmail().withMessage("Valid email required"),
    body("roles").isArray({ min: 1 }).withMessage("At least one role required"),
    body("password").isLength({ min: 8 }).withMessage("Password min 8 chars"),
    optionalString("phone"),
  ],
  update: [optionalString("name"), optionalString("phone"), optionalString("bloodGroup")],
};

// ── Admission ─────────────────────────────────────────────────────────────────
export const admissionValidation = {
  create: [
    body("applicantName").isString().trim().notEmpty().withMessage("Applicant name required"),
    body("email").isEmail().normalizeEmail().withMessage("Valid email required"),
    body("phone").isMobilePhone("any").withMessage("Valid phone required"),
    body("program").isString().notEmpty().withMessage("Program required"),
    body("academicYear").isString().notEmpty().withMessage("Academic year required"),
  ],
  updateStatus: [
    mongoId("id"),
    body("status").isString().notEmpty().withMessage("Status required"),
  ],
};

// ── Attendance ────────────────────────────────────────────────────────────────
export const attendanceValidation = {
  mark: [
    body("subjectId").isMongoId().withMessage("Valid subject ID required"),
    body("date").isISO8601().withMessage("Valid date required"),
    body("records").isArray({ min: 1 }).withMessage("Attendance records required"),
    body("records.*.studentId").isMongoId().withMessage("Valid student ID required"),
    body("records.*.status")
      .isIn(["present", "absent", "late", "excused"])
      .withMessage("Invalid attendance status"),
  ],
};

// ── Examination ───────────────────────────────────────────────────────────────
export const examinationValidation = {
  createSchedule: [
    body("examName").isString().notEmpty().withMessage("Exam name required"),
    body("examType").isString().notEmpty().withMessage("Exam type required"),
    body("semester").isInt({ min: 1, max: 8 }).withMessage("Semester 1-8 required"),
    body("academicYear").isString().notEmpty().withMessage("Academic year required"),
    body("startDate").isISO8601().withMessage("Valid start date required"),
    body("endDate").isISO8601().withMessage("Valid end date required"),
  ],
  enterMarks: [
    body("marks").isArray({ min: 1 }).withMessage("Marks array required"),
    body("marks.*.studentId").isMongoId().withMessage("Valid student ID required"),
    body("marks.*.subjectId").isMongoId().withMessage("Valid subject ID required"),
  ],
};

// ── Fee ───────────────────────────────────────────────────────────────────────
export const feeValidation = {
  createStructure: [
    body("program").isString().notEmpty(),
    body("academicYear").isString().notEmpty(),
    body("semester").isInt({ min: 1, max: 8 }),
    body("components").isArray({ min: 1 }).withMessage("Fee components required"),
    body("components.*.name").isString().notEmpty(),
    body("components.*.amount").isFloat({ min: 0 }),
  ],
  recordPayment: [
    body("studentId").isMongoId().withMessage("Valid student ID required"),
    body("amount").isFloat({ min: 1 }).withMessage("Amount > 0 required"),
    body("paymentMode").isString().notEmpty().withMessage("Payment mode required"),
  ],
};

// ── Leave ─────────────────────────────────────────────────────────────────────
export const leaveValidation = {
  apply: [
    body("leaveType").isString().notEmpty().withMessage("Leave type required"),
    body("startDate").isISO8601().withMessage("Valid start date required"),
    body("endDate").isISO8601().withMessage("Valid end date required"),
    body("reason").isString().isLength({ min: 10 }).withMessage("Reason (min 10 chars) required"),
  ],
  updateStatus: [
    mongoId("id"),
    body("status").isIn(["approved", "rejected"]).withMessage("Status must be approved/rejected"),
  ],
};

// ── Notice ────────────────────────────────────────────────────────────────────
export const noticeValidation = {
  create: [
    body("title")
      .isString()
      .trim()
      .isLength({ min: 5 })
      .withMessage("Title (min 5 chars) required"),
    body("content").isString().trim().isLength({ min: 10 }).withMessage("Content required"),
    body("targetAudience").isArray({ min: 1 }).withMessage("Target audience required"),
  ],
};

// ── Assignment ────────────────────────────────────────────────────────────────
export const assignmentValidation = {
  create: [
    body("title").isString().trim().notEmpty().withMessage("Title required"),
    body("subjectId").isMongoId().withMessage("Valid subject ID required"),
    body("dueDate").isISO8601().withMessage("Valid due date required"),
    body("maxMarks").isFloat({ min: 1 }).withMessage("Max marks required"),
  ],
};

// ── Quiz ──────────────────────────────────────────────────────────────────────
export const quizValidation = {
  create: [
    body("title").isString().trim().notEmpty().withMessage("Title required"),
    body("subjectId").isMongoId().withMessage("Valid subject ID required"),
    body("totalMarks").isFloat({ min: 1 }).withMessage("Total marks required"),
    body("duration").isInt({ min: 1 }).withMessage("Duration in minutes required"),
    body("questions").isArray({ min: 1 }).withMessage("At least one question required"),
  ],
};

// ── Payroll ───────────────────────────────────────────────────────────────────
export const payrollValidation = {
  generate: [
    body("month").isInt({ min: 1, max: 12 }).withMessage("Month 1-12 required"),
    body("year").isInt({ min: 2020 }).withMessage("Valid year required"),
    body("employeeIds").optional().isArray(),
  ],
};

// ── HR ────────────────────────────────────────────────────────────────────────
export const hrValidation = {
  create: [
    body("userId").isMongoId().withMessage("Valid user ID required"),
    body("name").isString().trim().notEmpty().withMessage("Name required"),
    body("email").isEmail().normalizeEmail(),
    body("phone").isMobilePhone("any").withMessage("Valid phone required"),
    body("gender").isIn(["male", "female", "other"]).withMessage("Valid gender required"),
    body("dateOfBirth").isISO8601().withMessage("Valid date of birth required"),
    body("department").isMongoId().withMessage("Valid department ID required"),
    body("designation").isString().trim().notEmpty().withMessage("Designation required"),
    body("dateOfJoining").isISO8601().withMessage("Valid joining date required"),
    body("basicSalary").isFloat({ min: 0 }).withMessage("Valid salary required"),
  ],
  update: [
    optionalString("designation"),
    body("basicSalary").optional().isFloat({ min: 0 }),
    optionalString("phone"),
  ],
};

// ── Hostel ────────────────────────────────────────────────────────────────────
export const hostelValidation = {
  allocate: [
    body("studentId").isMongoId().withMessage("Valid student ID required"),
    body("roomId").isMongoId().withMessage("Valid room ID required"),
    body("academicYear").isString().notEmpty(),
  ],
};

// ── Transport ─────────────────────────────────────────────────────────────────
export const transportValidation = {
  create: [
    body("routeName").isString().trim().notEmpty().withMessage("Route name required"),
    body("vehicleNumber").isString().trim().notEmpty().withMessage("Vehicle number required"),
    body("driverName").isString().trim().notEmpty(),
    body("capacity").isInt({ min: 1 }).withMessage("Capacity required"),
  ],
};

// ── Scholarship ───────────────────────────────────────────────────────────────
export const scholarshipValidation = {
  apply: [
    body("studentId").isMongoId(),
    body("scholarshipType").isString().notEmpty(),
    body("academicYear").isString().notEmpty(),
  ],
};

// ── Placement ─────────────────────────────────────────────────────────────────
export const placementValidation = {
  createDrive: [
    body("companyName").isString().trim().notEmpty().withMessage("Company name required"),
    body("driveDate").isISO8601().withMessage("Valid drive date required"),
    body("eligiblePrograms").isArray({ min: 1 }),
    body("ctc").isFloat({ min: 0 }).withMessage("CTC required"),
  ],
};

// ── Library ───────────────────────────────────────────────────────────────────
export const libraryValidation = {
  issueBook: [
    body("studentId").isMongoId(),
    body("bookId").isMongoId(),
    body("dueDate").isISO8601().withMessage("Valid due date required"),
  ],
};

// ── Timetable ─────────────────────────────────────────────────────────────────
export const timetableValidation = {
  create: [
    body("department").isMongoId(),
    body("semester").isInt({ min: 1, max: 8 }),
    body("academicYear").isString().notEmpty(),
    body("slots").isArray({ min: 1 }).withMessage("At least one slot required"),
  ],
};

// ── Meeting ───────────────────────────────────────────────────────────────────
export const meetingValidation = {
  create: [
    body("title").isString().trim().notEmpty().withMessage("Title required"),
    body("meetingType")
      .isIn(["faculty", "student"])
      .withMessage("meetingType must be faculty or student"),
    body("agenda").isString().trim().notEmpty().withMessage("Agenda required"),
    body("scheduledAt").isISO8601().withMessage("scheduledAt must be a valid ISO date"),
    body("mode")
      .isIn(["physical", "online", "hybrid"])
      .withMessage("mode must be physical, online, or hybrid"),
    body("venue")
      .if(body("mode").isIn(["physical", "hybrid"]))
      .notEmpty()
      .withMessage("venue required for physical/hybrid meetings"),
    body("meetingLink")
      .if(body("mode").isIn(["online", "hybrid"]))
      .notEmpty()
      .withMessage("meetingLink required for online/hybrid meetings"),
    body("durationMinutes")
      .optional()
      .isInt({ min: 1 })
      .withMessage("durationMinutes must be a positive integer"),
    body("recurrence").optional().isIn(["none", "daily", "weekly", "monthly"]),
    body("recurrenceCount").optional().isInt({ min: 1, max: 52 }),
    body("invitees")
      .if(body("meetingType").equals("faculty"))
      .isArray({ min: 1 })
      .withMessage("At least one faculty invitee required for faculty meetings"),
    body("invitees.*").optional().isMongoId().withMessage("Each invitee must be a valid ID"),
    body("targetDepartments").optional().isArray(),
    body("targetDepartments.*")
      .optional()
      .isMongoId()
      .withMessage("Each department must be a valid ID"),
    body("targetYears").optional().isArray(),
    body("targetYears.*")
      .optional()
      .isInt({ min: 1, max: 6 })
      .withMessage("Year must be between 1 and 6"),
    body("department").optional().isMongoId(),
  ],
  update: [
    body("title").optional().isString().trim().notEmpty(),
    body("agenda").optional().isString().trim().notEmpty(),
    body("scheduledAt").optional().isISO8601(),
    body("mode").optional().isIn(["physical", "online", "hybrid"]),
    body("venue").optional().isString().trim(),
    body("meetingLink").optional().isString().trim(),
    body("durationMinutes").optional().isInt({ min: 1 }),
    body("invitees").optional().isArray(),
    body("invitees.*").optional().isMongoId(),
    body("targetDepartments").optional().isArray(),
    body("targetDepartments.*").optional().isMongoId(),
    body("targetYears").optional().isArray(),
    body("targetYears.*").optional().isInt({ min: 1, max: 6 }),
  ],
  updateStatus: [body("status").isIn(["ongoing", "cancelled"]).withMessage("Invalid status value")],
  remarks: [
    body("remarks").isString().trim().notEmpty().withMessage("Concluding remarks required"),
  ],
};
