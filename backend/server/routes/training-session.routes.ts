import { Router } from "express";
import { param, body, query } from "express-validator";
import { authenticate, requireRoles, validate } from "../middlewares";
import { trainingSessionController } from "../controllers/training-session.controller";
import { SystemRole } from "../constants/roles";

const router = Router();
const { SUPER_ADMIN, PLACEMENT_CELL, PRINCIPAL, STUDENT, FACULTY, HOD } = SystemRole;
const coordinatorGuard = requireRoles([SUPER_ADMIN, PLACEMENT_CELL, PRINCIPAL]);
const attendanceGuard = requireRoles([SUPER_ADMIN, PLACEMENT_CELL, PRINCIPAL, FACULTY, HOD]);
const viewerGuard = requireRoles([SUPER_ADMIN, PLACEMENT_CELL, PRINCIPAL, FACULTY, HOD, STUDENT]);

router.get("/stats", authenticate, coordinatorGuard, trainingSessionController.stats);

router.get(
  "/",
  authenticate,
  viewerGuard,
  [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  trainingSessionController.list,
);
router.get(
  "/upcoming",
  authenticate,
  viewerGuard,
  [query("days").optional().isInt({ min: 1, max: 90 })],
  validate,
  trainingSessionController.upcoming,
);
router.get("/my", authenticate, requireRoles([STUDENT]), trainingSessionController.mySchedule);

router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  viewerGuard,
  trainingSessionController.getById,
);

router.post(
  "/",
  authenticate,
  coordinatorGuard,
  [
    body("title").notEmpty().withMessage("Title required"),
    body("type").notEmpty().withMessage("Type required"),
    body("facilitator").notEmpty().withMessage("Facilitator required"),
    body("scheduledDate").isISO8601().withMessage("Valid date required"),
    body("registrationStart").isISO8601().withMessage("Registration start required"),
    body("registrationEnd").isISO8601().withMessage("Registration end required"),
    body("startTime").notEmpty().withMessage("Start time required"),
    body("endTime").notEmpty().withMessage("End time required"),
    body("venue").notEmpty().withMessage("Venue required"),
    body("mode").isIn(["Offline", "Online", "Hybrid"]),
    body("meetingLink")
      .if(body("mode").not().equals("Offline"))
      .isURL({ protocols: ["http", "https"], require_protocol: true }),
  ],
  validate,
  trainingSessionController.create,
);

router.put(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  coordinatorGuard,
  trainingSessionController.update,
);

router.delete(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  coordinatorGuard,
  trainingSessionController.remove,
);

router.put(
  "/:id/publish",
  authenticate,
  coordinatorGuard,
  [param("id").isMongoId()],
  validate,
  trainingSessionController.publish,
);
router.put(
  "/:id/start",
  authenticate,
  coordinatorGuard,
  [param("id").isMongoId()],
  validate,
  trainingSessionController.start,
);
router.put(
  "/:id/cancel",
  authenticate,
  coordinatorGuard,
  [param("id").isMongoId(), body("reason").trim().isLength({ min: 5, max: 1000 })],
  validate,
  trainingSessionController.cancel,
);

// Student self-registers / unregisters
router.post(
  "/:id/register",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  requireRoles([STUDENT]),
  trainingSessionController.register,
);

router.delete(
  "/:id/register",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  requireRoles([STUDENT]),
  trainingSessionController.unregister,
);

// Mark attendance (coordinator / faculty)
router.post(
  "/:id/attendance",
  [
    param("id").isMongoId().withMessage("Invalid ID"),
    body("attendance").isArray().withMessage("Attendance array required"),
    body("attendance.*.studentId").isMongoId(),
    body("attendance.*.status").isIn(["present", "absent", "late"]),
    body("attendance.*.score").optional().isFloat({ min: 0, max: 100 }),
    body("attendance.*.feedback").optional().isString().isLength({ max: 2000 }),
  ],
  validate,
  authenticate,
  attendanceGuard,
  trainingSessionController.markAttendance,
);

// Upload session material
router.post(
  "/:id/material",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  coordinatorGuard,
  trainingSessionController.uploadMaterial,
);

export default router;
