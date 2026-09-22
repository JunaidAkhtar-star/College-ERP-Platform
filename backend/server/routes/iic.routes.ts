/**
 * @file iic.routes.ts
 */
import { Router } from "express";
import { param, body, query } from "express-validator";
import { authenticate, requirePermission, validate } from "../middlewares";
import { iicController } from "../controllers/iic.controller";
import { Module, PermissionAction } from "../constants/permissions";

const router = Router();
const auth = authenticate;
const canView = requirePermission(Module.IIC, PermissionAction.VIEW);
const canCreate = requirePermission(Module.IIC, PermissionAction.CREATE);
const canEdit = requirePermission(Module.IIC, PermissionAction.EDIT);
const canApprove = requirePermission(Module.IIC, PermissionAction.APPROVE);
const canDelete = requirePermission(Module.IIC, PermissionAction.DELETE);

router.get(
  "/projects",
  auth,
  [
    query("status")
      .optional()
      .isIn([
        "submitted",
        "screening",
        "evaluation",
        "approved",
        "incubating",
        "completed",
        "rejected",
      ]),
  ],
  validate,
  iicController.listProjects,
);
router.post(
  "/projects",
  auth,
  canView,
  [
    body("title").trim().isLength({ min: 3, max: 200 }),
    body("problemStatement").trim().isLength({ min: 20, max: 5000 }),
    body("proposedSolution").trim().isLength({ min: 20, max: 5000 }),
    body("category").trim().isLength({ min: 2, max: 120 }),
    body("teamMemberIds").optional().isArray({ max: 20 }),
  ],
  validate,
  iicController.createProject,
);
router.get("/projects/:id", auth, [param("id").isMongoId()], validate, iicController.getProject);
router.patch(
  "/projects/:id/transition",
  auth,
  canApprove,
  [
    param("id").isMongoId(),
    body("status").isIn([
      "screening",
      "evaluation",
      "approved",
      "incubating",
      "completed",
      "rejected",
    ]),
    body("note").trim().isLength({ min: 5, max: 3000 }),
    body("score").optional().isFloat({ min: 0, max: 100 }),
  ],
  validate,
  iicController.transitionProject,
);
router.patch(
  "/projects/:id/mentor",
  auth,
  canEdit,
  [param("id").isMongoId(), body("mentorId").isMongoId()],
  validate,
  iicController.assignMentor,
);
router.post(
  "/projects/:id/milestones",
  auth,
  canEdit,
  [param("id").isMongoId(), body("title").trim().isLength({ min: 3 }), body("dueDate").isISO8601()],
  validate,
  iicController.addMilestone,
);
router.patch(
  "/projects/:id/milestones/:index/complete",
  auth,
  canEdit,
  [
    param("id").isMongoId(),
    param("index").isInt({ min: 0 }),
    body("evidenceUrl").isURL({ protocols: ["https"], require_protocol: true }),
  ],
  validate,
  iicController.completeMilestone,
);
router.patch(
  "/projects/:id/funding",
  auth,
  canEdit,
  [
    param("id").isMongoId(),
    body("allocated").isFloat({ min: 0 }),
    body("spent").isFloat({ min: 0 }),
  ],
  validate,
  iicController.updateFunding,
);
router.post(
  "/projects/:id/ip",
  auth,
  canEdit,
  [
    param("id").isMongoId(),
    body("type").isIn(["patent", "copyright", "trademark", "design"]),
    body("applicationNumber").trim().isLength({ min: 2, max: 200 }),
    body("status").isIn(["draft", "filed", "published", "granted", "rejected"]),
  ],
  validate,
  iicController.addIpRecord,
);
router.patch(
  "/projects/:id/outcome",
  auth,
  canEdit,
  [
    param("id").isMongoId(),
    body("outcome").trim().isLength({ min: 10, max: 5000 }),
    body("prototypeUrl")
      .optional({ checkFalsy: true })
      .isURL({ protocols: ["https"], require_protocol: true }),
  ],
  validate,
  iicController.recordOutcome,
);

router.get("/", auth, iicController.list);
router.get("/stats", auth, iicController.stats);
router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  auth,
  iicController.get,
);
router.post(
  "/",
  [
    body("title").isString().trim().notEmpty(),
    body("kind").isString().trim().notEmpty(),
    body("quarter").isIn(["Q1", "Q2", "Q3", "Q4"]),
    body("academicYear").isString().trim().notEmpty(),
    body("startDate").isISO8601(),
  ],
  validate,
  auth,
  canCreate,
  iicController.create,
);
router.patch("/:id", [param("id").isMongoId()], validate, auth, canEdit, iicController.update);
router.patch(
  "/:id/reported",
  [param("id").isMongoId()],
  validate,
  auth,
  canApprove,
  iicController.markReported,
);
router.delete("/:id", [param("id").isMongoId()], validate, auth, canDelete, iicController.delete);

export default router;
