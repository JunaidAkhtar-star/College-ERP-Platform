import { Router } from "express";
import { body, param, query } from "express-validator";
import { notificationController } from "../controllers";
import { authenticate, requireRoles, validate } from "../middlewares";
import { SystemRole } from "../constants/roles";

const router = Router();
const auth = authenticate;
const admin = requireRoles([
  SystemRole.SUPER_ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.HOD,
  SystemRole.FACULTY,
]);

router.get(
  "/",
  auth,
  admin,
  [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  notificationController.listAll,
);
router.get(
  "/my",
  auth,
  [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  notificationController.getForCurrentUser,
);
router.get("/preferences", auth, notificationController.getPreferences);
router.put(
  "/preferences",
  auth,
  [
    body("email").optional().isBoolean(),
    body("inApp").optional().isBoolean(),
    body("push").optional().isBoolean(),
    body("sms").optional().isBoolean(),
  ],
  validate,
  notificationController.updatePreferences,
);
router.post("/fcm-token", auth, notificationController.registerFcmToken);
router.delete("/fcm-token", auth, notificationController.unregisterFcmToken);
router.post("/chat/read-all", auth, notificationController.markAllChatRead);
router.post("/read-all", auth, notificationController.markAllRead);
router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  auth,
  notificationController.getById,
);
router.post("/", auth, admin, notificationController.create);
router.put(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  auth,
  admin,
  notificationController.update,
);
router.post(
  "/:id/read",
  auth,
  [param("id").isMongoId()],
  validate,
  notificationController.markRead,
);
router.delete(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  auth,
  admin,
  notificationController.deactivate,
);

export default router;
