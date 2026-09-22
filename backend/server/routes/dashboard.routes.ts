import { Router } from "express";
import { authenticate } from "../middlewares";
import { dashboardController } from "../controllers/dashboard.controller";

const router = Router();

// GET /api/v1/dashboard — role-based aggregate dashboard
router.get("/", authenticate, dashboardController.get);

export default router;
