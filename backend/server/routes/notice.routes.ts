import { Router } from "express";
import { body, param, query } from "express-validator";
import { authenticate, requireAnyPermission, requirePermission, validate } from "../middlewares";
import { noticeController } from "../controllers";
import { Module, PermissionAction } from "../constants/permissions";

const router = Router();
const canCreate = requirePermission(Module.NOTICE, PermissionAction.CREATE);
const canEdit = requirePermission(Module.NOTICE, PermissionAction.EDIT);
const canApprove = requirePermission(Module.NOTICE, PermissionAction.APPROVE);
const canDelete = requirePermission(Module.NOTICE, PermissionAction.DELETE);
const canManage = requireAnyPermission([
  [Module.NOTICE, PermissionAction.CREATE],
  [Module.NOTICE, PermissionAction.EDIT],
  [Module.NOTICE, PermissionAction.APPROVE],
  [Module.NOTICE, PermissionAction.DELETE],
]);

router.get(
  "/",
  authenticate,
  canManage,
  [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  noticeController.list,
);
router.get("/stats", authenticate, canManage, noticeController.stats);
router.get("/active", authenticate, noticeController.getActive);
router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  noticeController.getById,
);
router.post(
  "/",
  authenticate,
  canCreate,
  [
    body("title").isString().trim().isLength({ min: 3, max: 200 }),
    body("content").isString().trim().isLength({ min: 3, max: 20000 }),
  ],
  validate,
  noticeController.create,
);
router.put(
  "/:id",
  authenticate,
  canEdit,
  [
    param("id").isMongoId(),
    body("title").optional().isString().trim().isLength({ min: 3, max: 200 }),
    body("content").optional().isString().trim().isLength({ min: 3, max: 20000 }),
  ],
  validate,
  noticeController.update,
);
router.delete(
  "/:id",
  authenticate,
  canDelete,
  [param("id").isMongoId()],
  validate,
  noticeController.delete,
);
router.post(
  "/:id/publish",
  authenticate,
  canApprove,
  [param("id").isMongoId()],
  validate,
  noticeController.publish,
);
router.post(
  "/:id/read",
  authenticate,
  [param("id").isMongoId()],
  validate,
  noticeController.markRead,
);

export default router;
