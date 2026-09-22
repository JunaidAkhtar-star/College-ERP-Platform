import { Router } from "express";
import { body, param, query } from "express-validator";
import { SystemRole } from "../constants/roles";
import { financialAidController } from "../controllers/financial-aid.controller";
import { authenticate, requireRoles, validate } from "../middlewares";

const router = Router();
const {
  SUPER_ADMIN,
  ADMIN,
  PRINCIPAL,
  SCHOLARSHIP_CELL,
  ACCOUNTS_DEPARTMENT,
  ADMINISTRATION_OFFICE,
  STUDENT,
} = SystemRole;
const staff = requireRoles([
  SUPER_ADMIN,
  ADMIN,
  PRINCIPAL,
  SCHOLARSHIP_CELL,
  ACCOUNTS_DEPARTMENT,
  ADMINISTRATION_OFFICE,
]);
const packageManagers = requireRoles([SUPER_ADMIN, ADMIN, PRINCIPAL, SCHOLARSHIP_CELL]);
router.use(authenticate);
router.get(
  "/funds",
  staff,
  [query("academicYear").optional().trim().isLength({ min: 4, max: 20 })],
  validate,
  financialAidController.funds,
);
router.post(
  "/funds",
  requireRoles([SUPER_ADMIN, PRINCIPAL]),
  [
    body("code").trim().isLength({ min: 2, max: 40 }),
    body("name").trim().isLength({ min: 2, max: 200 }),
    body("type").isIn(["grant", "scholarship", "loan", "work_study"]),
    body("source").isIn(["government", "institutional", "private", "bank"]),
    body("academicYear").trim().isLength({ min: 4, max: 20 }),
    body("disbursementMode").isIn(["fee_credit", "bank_transfer"]),
    body("budgetAmount").isFloat({ gt: 0 }),
    body("maxPerStudent").isFloat({ gt: 0 }),
    body("isNeedBased").optional().isBoolean(),
  ],
  validate,
  financialAidController.createFund,
);
router.post(
  "/calculate",
  packageManagers,
  [
    body("studentProfileId").isMongoId(),
    body("academicYear").trim().isLength({ min: 4, max: 20 }),
    body("studentContribution").isFloat({ min: 0 }),
    body("indirectCost").optional().isFloat({ min: 0 }),
  ],
  validate,
  financialAidController.calculate,
);
router.get("/packages/mine", requireRoles([STUDENT]), financialAidController.mine);
router.get(
  "/packages",
  staff,
  [
    query("status")
      .optional()
      .isIn([
        "draft",
        "offered",
        "accepted",
        "declined",
        "partially_disbursed",
        "disbursed",
        "cancelled",
      ]),
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  financialAidController.packages,
);
router.post(
  "/packages",
  packageManagers,
  [
    body("studentProfileId").isMongoId(),
    body("academicYear").trim().isLength({ min: 4, max: 20 }),
    body("studentContribution").isFloat({ min: 0 }),
    body("indirectCost").optional().isFloat({ min: 0 }),
    body("items").isArray({ min: 1, max: 20 }),
    body("items.*.fundId").isMongoId(),
    body("items.*.amount").isFloat({ gt: 0 }),
    body("notes").optional().trim().isLength({ max: 5000 }),
  ],
  validate,
  financialAidController.createPackage,
);
router.post(
  "/packages/:id/offer",
  packageManagers,
  [param("id").isMongoId()],
  validate,
  financialAidController.offer,
);
router.post(
  "/packages/:id/respond",
  requireRoles([STUDENT]),
  [
    param("id").isMongoId(),
    body("acceptedFundIds").optional().isArray({ max: 20 }),
    body("acceptedFundIds.*").optional().isMongoId(),
    body("declineAll").optional().isBoolean(),
  ],
  validate,
  financialAidController.respond,
);
router.post(
  "/packages/:id/items/:itemId/disburse",
  requireRoles([ACCOUNTS_DEPARTMENT]),
  [
    param("id").isMongoId(),
    param("itemId").isMongoId(),
    body("referenceNo").trim().isLength({ min: 3, max: 200 }),
  ],
  validate,
  financialAidController.disburse,
);
export default router;
