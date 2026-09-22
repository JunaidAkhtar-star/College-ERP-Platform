import { Router } from "express";
import { body, param, query } from "express-validator";
import { admissionController } from "../controllers/admission.controller";
import { authenticate, requireRoles, requireAnyRole } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validation.middleware";
import { SystemRole, ADMISSION_ROLES } from "../constants/roles";
import {
  AdmissionCategory,
  AdmissionType,
  EntranceExam,
} from "../models/admission-application.model";

const router = Router();
const ADMISSION_DECISION_ROLES = [
  SystemRole.SUPER_ADMIN,
  SystemRole.ADMIN,
  SystemRole.ADMINISTRATION_OFFICE,
  SystemRole.ASSISTANT_ADMINISTRATION_OFFICER,
  SystemRole.ADMISSION_INCHARGE,
];
const ADMISSION_OPERATIONS_ROLES = [...ADMISSION_DECISION_ROLES, SystemRole.ADMISSION_COUNSELOR];
const ADMISSION_PAYMENT_ROLES = [
  SystemRole.SUPER_ADMIN,
  SystemRole.ADMIN,
  SystemRole.ACCOUNTS_DEPARTMENT,
];

// ─────────────────────────────────────────────────────────────────────────────
// Public routes
// ─────────────────────────────────────────────────────────────────────────────
router.get("/programs", admissionController.listAdmissionPrograms);

/**
 * Submit a new admission application — mirrors the RITE physical form.
 * Applicants receive their login credentials via email from admin, then fill this.
 */
router.post(
  "/apply",
  [
    // Personal information
    body("candidateName").notEmpty().trim().withMessage("Candidate name is required"),
    body("fatherName").notEmpty().trim().withMessage("Father name is required"),
    body("motherName").notEmpty().trim().withMessage("Mother name is required"),
    body("dateOfBirth").isISO8601().withMessage("Valid date of birth required (ISO8601)"),
    body("gender").isIn(["male", "female"]).withMessage("Gender must be male or female"),
    body("category")
      .isIn(Object.values(AdmissionCategory))
      .withMessage(`Category must be one of: ${Object.values(AdmissionCategory).join(", ")}`),

    // Contact
    body("email").isEmail().normalizeEmail().withMessage("Valid email is required"),
    body("phone").notEmpty().trim().withMessage("Candidate contact number is required"),
    body("whatsappPhone").optional().trim(),
    body("parentPhone").optional().trim(),

    // Address — present
    body("presentAddress.line1").notEmpty().withMessage("Present address line 1 required"),
    body("presentAddress.city").notEmpty().withMessage("Present city required"),
    body("presentAddress.state").notEmpty().withMessage("Present state required"),
    body("presentAddress.pincode").notEmpty().withMessage("Present pincode required"),

    // Address — permanent
    body("permanentAddress.line1").notEmpty().withMessage("Permanent address line 1 required"),
    body("permanentAddress.city").notEmpty().withMessage("Permanent city required"),
    body("permanentAddress.state").notEmpty().withMessage("Permanent state required"),
    body("permanentAddress.pincode").notEmpty().withMessage("Permanent pincode required"),

    // Entrance exam
    body("entranceExam.exam")
      .isIn(Object.values(EntranceExam))
      .withMessage(`Exam must be one of: ${Object.values(EntranceExam).join(", ")}`),
    body("entranceExam.year").isInt({ min: 2000 }).withMessage("Valid exam year required"),
    body("entranceExam.applicationNo").optional().trim(),
    body("entranceExam.rank").optional().isInt({ min: 1 }),
    body("entranceExam.otherName")
      .if(body("entranceExam.exam").equals(EntranceExam.OTHER))
      .notEmpty()
      .withMessage("Specify the exam name when selecting OTHER"),

    // Program
    body("admissionType")
      .isIn(Object.values(AdmissionType))
      .withMessage("admissionType must be regular or lateral_entry"),
    body("programPreferences")
      .isArray({ min: 1, max: 7 })
      .withMessage("At least one program preference is required"),
    body("programPreferences").custom((programs: string[]) => {
      if (new Set(programs).size !== programs.length)
        throw new Error("Program preferences must be unique");
      return true;
    }),
    body("programPreferences.*").isString().trim().notEmpty().isLength({ max: 150 }),
    body("academicYear")
      .matches(/^\d{4}-(?:\d{2}|\d{4})$/)
      .withMessage("Academic year must use YYYY-YY or YYYY-YYYY format"),

    // Academic records — 10th is mandatory
    body("academicRecords")
      .isArray({ min: 2, max: 3 })
      .withMessage("10th and 12th / Diploma academic records are required"),
    body("academicRecords.*.level")
      .isIn(["10th", "12th_or_diploma", "degree"])
      .withMessage("Invalid academic record level"),
    body("academicRecords.*.boardOrUniversity").notEmpty(),
    body("academicRecords.*.instituteName").notEmpty(),
    body("academicRecords.*.yearOfPassing").isInt({ min: 1990 }),
    body("academicRecords.*.percentageOfMarks").isFloat({ min: 0, max: 100 }),

    // Parent info
    body("parentInfo.fatherName").notEmpty().withMessage("Father name is required"),
    body("parentInfo.motherName").notEmpty().withMessage("Mother name is required"),

    // Declaration must be accepted
    body("declarationAccepted")
      .equals("true")
      .withMessage("Declaration must be accepted to submit the form"),
  ],
  validate,
  admissionController.applyOnline,
);

/** Public status check by application number */
router.get(
  "/status/:applicationNumber",
  [param("applicationNumber").notEmpty()],
  validate,
  admissionController.checkStatus,
);

// ─────────────────────────────────────────────────────────────────────────────
// Protected routes (admission cell + admin)
// ─────────────────────────────────────────────────────────────────────────────

router.use(authenticate);

router.get(
  "/seat-matrix",
  [query("academicYear").matches(/^\d{4}-(?:\d{2}|\d{4})$/)],
  validate,
  requireAnyRole(ADMISSION_ROLES),
  admissionController.listSeatMatrix,
);
router.put(
  "/seat-matrix",
  [
    body("program").isString().trim().notEmpty().isLength({ max: 150 }),
    body("academicYear").matches(/^\d{4}-(?:\d{2}|\d{4})$/),
    body("totalSeats").isInt({ min: 0, max: 10000 }).toInt(),
    body("generalSeats").isInt({ min: 0, max: 10000 }).toInt(),
    body("scSeats").isInt({ min: 0, max: 10000 }).toInt(),
    body("stSeats").isInt({ min: 0, max: 10000 }).toInt(),
    body("obcSeats").isInt({ min: 0, max: 10000 }).toInt(),
    body("ewsSeats").isInt({ min: 0, max: 10000 }).toInt(),
  ],
  validate,
  requireAnyRole(ADMISSION_DECISION_ROLES),
  admissionController.upsertSeatMatrix,
);

/**
 * Admin initiates a new application with minimal info; backend creates a
 * stable ERP Student ID plus a temporary password and emails credentials.
 */
router.post(
  "/initiate",
  [
    body("candidateName").notEmpty().trim().withMessage("Candidate name is required"),
    body("email")
      .optional({ checkFalsy: true })
      .isEmail()
      .normalizeEmail()
      .withMessage("Valid email is required"),
    body("phone").notEmpty().trim().withMessage("Phone is required"),
    body("admissionType").isIn(Object.values(AdmissionType)).withMessage("Invalid admission type"),
    body("programPreference").isString().trim().notEmpty().isLength({ max: 150 }),
    body("preferredDepartmentId")
      .optional({ nullable: true, checkFalsy: true })
      .isMongoId()
      .withMessage("Preferred branch must be a valid department"),
    body("academicYear")
      .matches(/^\d{4}-(?:\d{2}|\d{4})$/)
      .withMessage("Academic year must use YYYY-YY or YYYY-YYYY format"),
    body("sendEmail").optional().isBoolean(),
  ],
  validate,
  requireAnyRole(ADMISSION_OPERATIONS_ROLES),
  admissionController.initiateApplication,
);

/** Applicant self-service: fetch / update / submit own draft application */
router.get("/my-application", admissionController.getMyApplication);
router.patch("/my-application", admissionController.updateMyApplication);
router.post("/my-application/submit", admissionController.submitMyApplication);
router.patch(
  "/my-application/onboard",
  [
    body("onboardStatus").isIn(["pending", "hosteller", "day_scholar"]),
    body("transportOption").optional({ nullable: true }).isIn(["bus", "own"]),
  ],
  validate,
  admissionController.updateMyOnboarding,
);
router.patch(
  "/my-application/payment",
  [
    body("amountInNumber").optional().isFloat({ min: 0 }).withMessage("Valid amount required"),
    body("transactionId").optional().isString().trim(),
    body("paidAt").optional().isISO8601().withMessage("Valid payment date required"),
  ],
  validate,
  admissionController.updateMyPaymentInfo,
);

/** Applicant self-service: per-document upload / delete (multipart, field name = document) */
router.post(
  "/my-application/documents/:docType",
  [param("docType").isString().trim().notEmpty()],
  validate,
  admissionController.uploadMyDocument,
);
router.delete(
  "/my-application/documents/:docType",
  [param("docType").isString().trim().notEmpty(), query("publicId").optional().isString()],
  validate,
  admissionController.deleteMyDocument,
);

router.get(
  "/dashboard",
  [query("academicYear").matches(/^\d{4}-(?:\d{2}|\d{4})$/)],
  validate,
  requireAnyRole(ADMISSION_ROLES),
  admissionController.getDashboard,
);

router.get(
  "/bulk-import/template",
  requireAnyRole(ADMISSION_OPERATIONS_ROLES),
  admissionController.getBulkImportTemplate,
);
router.post(
  "/bulk-import",
  [
    query("academicYear")
      .matches(/^\d{4}-(?:\d{2}|\d{4})$/)
      .withMessage("Academic year must use YYYY-YY or YYYY-YYYY format"),
  ],
  validate,
  requireAnyRole(ADMISSION_OPERATIONS_ROLES),
  admissionController.bulkImport,
);

router.get("/applications", requireAnyRole(ADMISSION_ROLES), admissionController.listApplications);

router.get(
  "/applications/:id",
  [param("id").isMongoId()],
  validate,
  requireAnyRole(ADMISSION_ROLES),
  admissionController.getApplication,
);

router.patch(
  "/applications/:id",
  [param("id").isMongoId()],
  validate,
  requireAnyRole(ADMISSION_OPERATIONS_ROLES),
  admissionController.updateApplication,
);

router.delete(
  "/applications/:id",
  [param("id").isMongoId()],
  validate,
  requireAnyRole(ADMISSION_OPERATIONS_ROLES),
  admissionController.deleteApplication,
);

/** AO / AOO moves a submitted application into review */
router.patch(
  "/applications/:id/start-review",
  [param("id").isMongoId()],
  validate,
  requireAnyRole(ADMISSION_OPERATIONS_ROLES),
  admissionController.startReview,
);

/** Per-document review — verify or reject a single doc, request a doc, or toggle physical flags */
router.patch(
  "/applications/:id/documents/:docType/review",
  [
    param("id").isMongoId(),
    param("docType").isString().trim().notEmpty(),
    body("action")
      .isIn(["verify", "reject", "set-original", "request"])
      .withMessage("action must be verify, reject, set-original, or request"),
    body("reason").optional().isString().trim(),
    body("originalSubmitted").optional().isBoolean(),
    body("photocopySubmitted").optional().isBoolean(),
  ],
  validate,
  requireAnyRole(ADMISSION_OPERATIONS_ROLES),
  admissionController.reviewDocument,
);

/** Verifier uploads a document on behalf of the applicant */
router.post(
  "/applications/:id/documents/:docType",
  [param("id").isMongoId(), param("docType").isString().trim().notEmpty()],
  validate,
  requireAnyRole(ADMISSION_OPERATIONS_ROLES),
  admissionController.uploadApplicationDocument,
);

/** Verifier removes a document file on behalf of the applicant */
router.delete(
  "/applications/:id/documents/:docType",
  [
    param("id").isMongoId(),
    param("docType").isString().trim().notEmpty(),
    query("publicId").optional().isString(),
  ],
  validate,
  requireAnyRole(ADMISSION_OPERATIONS_ROLES),
  admissionController.deleteApplicationDocument,
);

/** Verifier updates self-reported booking fee payment details */
router.patch(
  "/applications/:id/booking-payment",
  [
    param("id").isMongoId(),
    body("amountInNumber").optional().isFloat({ min: 0 }).withMessage("Valid amount required"),
    body("transactionId").optional().isString().trim(),
    body("paidAt").optional().isISO8601().withMessage("Valid payment date required"),
  ],
  validate,
  requireAnyRole(ADMISSION_PAYMENT_ROLES),
  admissionController.updateBookingPayment,
);

/** Verifier/admin updates admission payment details, optionally with a payment proof screenshot */
router.patch(
  "/applications/:id/payment",
  [
    param("id").isMongoId(),
    body("amountInNumber").optional().isFloat({ min: 0 }).withMessage("Valid amount required"),
    body("amountInWords").optional().isString().trim(),
    body("receiptNo").optional().isString().trim(),
    body("receiptDate").optional().isISO8601().withMessage("Valid receipt date required"),
    body("transactionId").optional().isString().trim(),
    body("paidAt").optional().isISO8601().withMessage("Valid payment date required"),
    body("paymentMode")
      .optional()
      .isIn(["cash", "upi", "net_banking", "card"])
      .withMessage("Invalid payment mode"),
  ],
  validate,
  requireAnyRole(ADMISSION_PAYMENT_ROLES),
  admissionController.updatePaymentInfo,
);

/** Verifier/admin approves or rejects admission payment details */
router.patch(
  "/applications/:id/payment/review",
  [
    param("id").isMongoId(),
    body("action").isIn(["approve", "reject"]).withMessage("action must be approve or reject"),
    body("remarks").optional().isString().trim(),
  ],
  validate,
  requireAnyRole(ADMISSION_PAYMENT_ROLES),
  admissionController.reviewPaymentInfo,
);

/** AO / AOO final decision on the application (approve / reject). */
router.patch(
  "/applications/:id/decide",
  [
    param("id").isMongoId(),
    body("decision").isIn(["approved", "rejected"]).withMessage("Invalid decision"),
    body("remarks").notEmpty().withMessage("Remarks are required"),
  ],
  validate,
  requireAnyRole(ADMISSION_DECISION_ROLES),
  admissionController.decideApplication,
);

router.patch(
  "/applications/:id/onboard",
  [
    param("id").isMongoId(),
    body("onboardStatus")
      .isIn(["pending", "hosteller", "day_scholar"])
      .withMessage("Invalid onboard status"),
    body("transportOption")
      .optional({ nullable: true })
      .isIn(["bus", "own"])
      .withMessage("Invalid transport option"),
  ],
  validate,
  requireAnyRole(ADMISSION_ROLES),
  admissionController.updateOnboarding,
);

router.post(
  "/applications/:id/enroll",
  [param("id").isMongoId()],
  validate,
  requireRoles([
    SystemRole.SUPER_ADMIN,
    SystemRole.ADMIN,
    SystemRole.ADMINISTRATION_OFFICE,
    SystemRole.ASSISTANT_ADMINISTRATION_OFFICER,
  ]),
  admissionController.confirmEnrollment,
);

export default router;
