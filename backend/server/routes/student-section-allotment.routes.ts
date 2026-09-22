import { Router } from "express";
import { body, param } from "express-validator";
import { authenticate, requirePermission, validate } from "../middlewares";
import { studentSectionAllotmentController } from "../controllers";
import { Module, PermissionAction } from "../constants/permissions";

const router = Router();
const canView = requirePermission(Module.STUDENT_ALLOTMENT, PermissionAction.VIEW);
const canCreate = requirePermission(Module.STUDENT_ALLOTMENT, PermissionAction.CREATE);
const canEdit = requirePermission(Module.STUDENT_ALLOTMENT, PermissionAction.EDIT);
const canApprove = requirePermission(Module.STUDENT_ALLOTMENT, PermissionAction.APPROVE);
const bulkValidators = [
  body("batchId").isMongoId().withMessage("Valid batch required"),
  body("academicYear")
    .matches(/^\d{4}-(?:\d{2}|\d{4})$/)
    .withMessage("Academic year must use YYYY-YY or YYYY-YYYY format"),
  body("semesterNo").isInt({ min: 1, max: 12 }).withMessage("Valid semester required"),
  body("strategy")
    .isIn(["sequential", "balanced", "merit_rank"])
    .withMessage("Valid allotment strategy required"),
];

router.get("/", authenticate, canView, studentSectionAllotmentController.list);
router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  canView,
  studentSectionAllotmentController.getById,
);
router.post(
  "/",
  [
    body("studentId").isMongoId().withMessage("Valid student required"),
    body("sectionId").isMongoId().withMessage("Valid section required"),
    body("rollNo").optional().isString().trim(),
  ],
  validate,
  authenticate,
  canCreate,
  studentSectionAllotmentController.allot,
);
router.post(
  "/bulk/preview",
  bulkValidators,
  validate,
  authenticate,
  canView,
  studentSectionAllotmentController.previewBulk,
);
router.post(
  "/bulk/execute",
  bulkValidators,
  validate,
  authenticate,
  canApprove,
  studentSectionAllotmentController.executeBulk,
);
router.post(
  "/:id/transfer",
  [
    param("id").isMongoId().withMessage("Invalid ID"),
    body("toSectionId").isMongoId().withMessage("Valid target section required"),
    body("reason").notEmpty().withMessage("Transfer reason required"),
  ],
  validate,
  authenticate,
  canEdit,
  studentSectionAllotmentController.transfer,
);
router.post(
  "/:id/cancel",
  [
    param("id").isMongoId().withMessage("Invalid ID"),
    body("reason").notEmpty().withMessage("Cancellation reason required"),
  ],
  validate,
  authenticate,
  canApprove,
  studentSectionAllotmentController.cancel,
);

export default router;
