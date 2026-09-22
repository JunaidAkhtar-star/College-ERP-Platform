import { Router } from "express";
import { body, param } from "express-validator";
import { authenticate, requirePermission, validate } from "../middlewares";
import { documentController } from "../controllers/document.controller";
import { Module, PermissionAction } from "../constants/permissions";

const router = Router();
const canView = requirePermission(Module.DOCUMENT_MANAGEMENT, PermissionAction.VIEW);
const canApprove = requirePermission(Module.DOCUMENT_MANAGEMENT, PermissionAction.APPROVE);

// Student/Employee — own documents
router.get("/my", authenticate, canView, documentController.myDocuments);
router.post("/upload", authenticate, canView, documentController.upload);
router.get("/expiring/soon", authenticate, canApprove, documentController.expiringSoon);
router.put(
  "/:id/reupload",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  canView,
  documentController.reUpload,
);
router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  canView,
  documentController.getById,
);

// Staff — list and manage all documents
router.get("/", authenticate, canApprove, documentController.list);
router.get(
  "/owner/:ownerId",
  [param("ownerId").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  canApprove,
  documentController.getByOwner,
);
router.put(
  "/:id/verify",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  canApprove,
  documentController.verify,
);
router.put(
  "/:id/reject",
  [
    param("id").isMongoId().withMessage("Invalid ID"),
    body("reason").isString().trim().isLength({ min: 5, max: 500 }),
  ],
  validate,
  authenticate,
  canApprove,
  documentController.reject,
);
export default router;
