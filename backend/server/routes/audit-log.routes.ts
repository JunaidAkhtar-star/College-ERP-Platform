import { Router } from "express";
import { authenticate, requireRoles, validate } from "../middlewares";
import { auditLogController } from "../controllers/audit-log.controller";
import { SystemRole } from "../constants/roles";
import { query } from "express-validator";

const router = Router();
const admin = requireRoles([SystemRole.SUPER_ADMIN, SystemRole.ADMIN, SystemRole.PRINCIPAL]);

router.get(
  "/",
  authenticate,
  admin,
  [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 500 }),
    query("search").optional().isLength({ max: 100 }),
    query("from").optional().isISO8601(),
    query("to").optional().isISO8601(),
  ],
  validate,
  auditLogController.list,
);

export default router;
