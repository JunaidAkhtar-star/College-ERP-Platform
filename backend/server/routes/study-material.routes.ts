import { Router } from "express";
import { body, param, query } from "express-validator";
import { authenticate, requireRoles, validate } from "../middlewares";
import { studyMaterialController } from "../controllers";
import { SystemRole } from "../constants/roles";

const router = Router();
const { SUPER_ADMIN, ADMIN, PRINCIPAL, DEAN_ACADEMIC, HOD, FACULTY, STUDENT } = SystemRole;
const READ_ROLES = [SUPER_ADMIN, ADMIN, PRINCIPAL, DEAN_ACADEMIC, HOD, FACULTY, STUDENT];
const AUTHOR_ROLES = [HOD, FACULTY];
const MANAGE_ROLES = [SUPER_ADMIN, HOD, FACULTY];
const materialValidation = () => [
  body("title").isString().trim().isLength({ min: 3, max: 200 }),
  body("description").optional({ nullable: true }).isString().trim().isLength({ max: 20000 }),
  body("subjectId").isMongoId().withMessage("Valid subject is required"),
  body("sectionIds").isArray({ min: 1, max: 20 }),
  body("sectionIds.*").isMongoId(),
  body("unitNo").optional({ nullable: true }).isInt({ min: 1, max: 20 }).toInt(),
  body("materialType").isIn(["pdf", "ppt", "video", "notes", "link", "other"]),
  body("fileUrl").optional({ nullable: true }).isURL().isLength({ max: 2000 }),
  body("fileSize")
    .optional({ nullable: true })
    .isInt({ min: 0, max: 5 * 1024 * 1024 * 1024 })
    .toInt(),
  body("externalLink").optional({ nullable: true }).isURL().isLength({ max: 2000 }),
  body("tags").optional().isArray({ max: 20 }),
];

router.get(
  "/",
  [
    query("subjectId").optional().isMongoId(),
    query("departmentId").optional().isMongoId(),
    query("semester").optional().isInt({ min: 1, max: 20 }),
    query("materialType").optional().isIn(["pdf", "ppt", "video", "notes", "link", "other"]),
    query("status").optional().isIn(["draft", "published", "archived"]),
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  authenticate,
  requireRoles(READ_ROLES),
  studyMaterialController.list,
);
router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid material ID")],
  validate,
  authenticate,
  requireRoles(READ_ROLES),
  studyMaterialController.getById,
);
router.post(
  "/:id/download",
  [param("id").isMongoId().withMessage("Invalid material ID")],
  validate,
  authenticate,
  requireRoles(READ_ROLES),
  studyMaterialController.trackDownload,
);
router.post(
  "/",
  materialValidation(),
  validate,
  authenticate,
  requireRoles(AUTHOR_ROLES),
  studyMaterialController.create,
);
router.put(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid material ID"), ...materialValidation()],
  validate,
  authenticate,
  requireRoles(MANAGE_ROLES),
  studyMaterialController.update,
);
router.post(
  "/:id/revisions",
  [param("id").isMongoId().withMessage("Invalid material ID"), ...materialValidation()],
  validate,
  authenticate,
  requireRoles(MANAGE_ROLES),
  studyMaterialController.createRevision,
);
router.post(
  "/:id/publish",
  [param("id").isMongoId().withMessage("Invalid material ID")],
  validate,
  authenticate,
  requireRoles(MANAGE_ROLES),
  studyMaterialController.publish,
);
router.post(
  "/:id/archive",
  [param("id").isMongoId().withMessage("Invalid material ID")],
  validate,
  authenticate,
  requireRoles(MANAGE_ROLES),
  studyMaterialController.archive,
);
router.delete(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid material ID")],
  validate,
  authenticate,
  requireRoles(MANAGE_ROLES),
  studyMaterialController.delete,
);

export default router;
