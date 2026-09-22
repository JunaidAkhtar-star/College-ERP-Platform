import { Router } from "express";
import { body, param, query } from "express-validator";
import { authenticate, requireRoles, validate } from "../middlewares";
import { questionBankController } from "../controllers";
import { SystemRole } from "../constants/roles";

const router = Router();
const { SUPER_ADMIN, PRINCIPAL, DEAN_ACADEMIC, HOD, FACULTY, EXAMINATION_CELL } = SystemRole;
const READ_ROLES = [SUPER_ADMIN, PRINCIPAL, DEAN_ACADEMIC, HOD, FACULTY, EXAMINATION_CELL];
const AUTHOR_ROLES = [HOD, FACULTY, EXAMINATION_CELL];
const GOVERNANCE_ROLES = [SUPER_ADMIN, DEAN_ACADEMIC, HOD, EXAMINATION_CELL];
const questionValidation = () => [
  body("subjectId").isMongoId().withMessage("Valid subject is required"),
  body("unitNo").isInt({ min: 1, max: 20 }).toInt(),
  body("coCode").optional({ nullable: true }).isString().trim().isLength({ max: 20 }),
  body("questionText").isString().trim().isLength({ min: 3, max: 10000 }),
  body("questionType").isIn(["mcq", "short_answer", "long_answer", "coding", "true_false"]),
  body("difficultyLevel").isIn(["easy", "medium", "hard"]),
  body("marks").isFloat({ gt: 0, max: 1000 }).toFloat(),
  body("options").optional().isArray({ max: 10 }),
  body("correctAnswer").optional({ nullable: true }).isString().trim().isLength({ max: 10000 }),
  body("explanation").optional({ nullable: true }).isString().trim().isLength({ max: 20000 }),
  body("tags").optional().isArray({ max: 20 }),
];

router.get(
  "/",
  [
    query("subjectId").optional().isMongoId(),
    query("unitNo").optional().isInt({ min: 1, max: 20 }),
    query("difficultyLevel").optional().isIn(["easy", "medium", "hard"]),
    query("questionType")
      .optional()
      .isIn(["mcq", "short_answer", "long_answer", "coding", "true_false"]),
    query("status").optional().isIn(["draft", "approved", "retired"]),
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  authenticate,
  requireRoles(READ_ROLES),
  questionBankController.list,
);
router.get(
  "/random",
  [
    query("subjectId").isMongoId(),
    query("unitNo").isInt({ min: 1, max: 20 }),
    query("difficulty").isIn(["easy", "medium", "hard"]),
    query("count").optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  authenticate,
  requireRoles(READ_ROLES),
  questionBankController.getRandom,
);
router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid question ID")],
  validate,
  authenticate,
  requireRoles(READ_ROLES),
  questionBankController.getById,
);
router.post(
  "/",
  questionValidation(),
  validate,
  authenticate,
  requireRoles(AUTHOR_ROLES),
  questionBankController.create,
);
router.post(
  "/bulk",
  [body("questions").isArray({ min: 1, max: 200 })],
  validate,
  authenticate,
  requireRoles(AUTHOR_ROLES),
  questionBankController.createBulk,
);
router.put(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid question ID"), ...questionValidation()],
  validate,
  authenticate,
  requireRoles(AUTHOR_ROLES),
  questionBankController.update,
);
router.post(
  "/:id/approve",
  [param("id").isMongoId().withMessage("Invalid question ID")],
  validate,
  authenticate,
  requireRoles(GOVERNANCE_ROLES),
  questionBankController.approve,
);
router.post(
  "/:id/retire",
  [
    param("id").isMongoId().withMessage("Invalid question ID"),
    body("reason").isString().trim().isLength({ min: 3, max: 1000 }),
  ],
  validate,
  authenticate,
  requireRoles(GOVERNANCE_ROLES),
  questionBankController.retire,
);
router.delete(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid question ID")],
  validate,
  authenticate,
  requireRoles([SUPER_ADMIN, HOD, FACULTY, EXAMINATION_CELL]),
  questionBankController.delete,
);

export default router;
