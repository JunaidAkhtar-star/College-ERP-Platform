import { Router } from "express";
import { authenticate, requireRoles, validate } from "../middlewares";
import { body, param } from "express-validator";
import { taskController } from "../controllers/task.controller";
import { SystemRole } from "../constants/roles";

const router = Router();
const { SUPER_ADMIN, ADMIN, PRINCIPAL, HOD } = SystemRole;

// All endpoints require authentication
router.use(authenticate);

// Get list of all tasks (tasks created by or assigned to current user)
router.get("/", taskController.list);

// Get specific task by ID
router.get("/:id", [param("id").isMongoId()], validate, taskController.getById);

// Create task (Principal & HOD only)
router.post(
  "/",
  requireRoles([SUPER_ADMIN, ADMIN, PRINCIPAL, HOD]),
  [
    body("title").trim().isLength({ min: 1, max: 200 }),
    body("description").trim().isLength({ min: 1, max: 5000 }),
    body("dueDate").isISO8601(),
    body("assignees").isArray({ min: 1, max: 100 }),
    body("assignees.*").isMongoId(),
    body("priority").optional().isIn(["low", "medium", "high", "critical"]),
    body("notes").optional().trim().isLength({ max: 5000 }),
    body("dependencyIds").optional().isArray({ max: 100 }),
    body("dependencyIds.*").optional().isMongoId(),
    body("attachments").optional().isArray({ max: 20 }),
    body("attachments.*.url")
      .optional()
      .isURL({ protocols: ["https"], require_protocol: true }),
    body("attachments.*.name").optional().trim().isLength({ min: 1, max: 255 }),
    body("recurrence.frequency").optional().isIn(["daily", "weekly", "monthly"]),
    body("recurrence.interval").optional().isInt({ min: 1, max: 365 }),
    body("recurrence.endsAt").optional().isISO8601(),
  ],
  validate,
  taskController.create,
);

// Update status of a task (Faculty assignees and assigner)
router.patch(
  "/:id/status",
  [
    param("id").isMongoId(),
    body("status").isIn(["todo", "in_progress", "completed"]),
    body("completionNote").optional().trim().isLength({ max: 5000 }),
    body("completionEvidence").optional().isArray({ max: 20 }),
    body("completionEvidence.*.url")
      .optional()
      .isURL({ protocols: ["https"], require_protocol: true }),
  ],
  validate,
  taskController.updateStatus,
);

// Decide: approve or reject a task (Assigner Principal & HOD only)
router.patch(
  "/:id/decide",
  requireRoles([SUPER_ADMIN, ADMIN, PRINCIPAL, HOD]),
  [
    param("id").isMongoId(),
    body("action").isIn(["approve", "reject"]),
    body("feedback").optional().trim().isLength({ max: 5000 }),
  ],
  validate,
  taskController.decide,
);
router.post(
  "/:id/comments",
  [param("id").isMongoId(), body("message").trim().isLength({ min: 2, max: 2000 })],
  validate,
  taskController.comment,
);

export default router;
