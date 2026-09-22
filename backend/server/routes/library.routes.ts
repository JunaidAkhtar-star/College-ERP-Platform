import { Router } from "express";
import { body, param } from "express-validator";
import { authenticate, requireRoles, validate } from "../middlewares";
import { libraryController } from "../controllers";
import { SystemRole } from "../constants/roles";

const router = Router();
const { SUPER_ADMIN, ADMIN, PRINCIPAL, LIBRARY_STAFF, FACULTY, STUDENT } = SystemRole;
const LIBRARY_READERS = [SUPER_ADMIN, ADMIN, PRINCIPAL, LIBRARY_STAFF, FACULTY, STUDENT];

// Books
router.get("/books", authenticate, requireRoles(LIBRARY_READERS), libraryController.searchBooks);
router.get(
  "/books/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  requireRoles(LIBRARY_READERS),
  libraryController.getBook,
);
router.post(
  "/books",
  authenticate,
  requireRoles([SUPER_ADMIN, LIBRARY_STAFF]),
  [
    body("isbn").trim().notEmpty(),
    body("title").trim().isLength({ min: 1, max: 300 }),
    body("authors").isArray({ min: 1, max: 20 }),
    body("authors.*").isString().trim().isLength({ min: 1, max: 200 }),
    body("publisher").trim().notEmpty(),
    body("publicationYear").isInt({ min: 1000, max: new Date().getFullYear() + 1 }),
    body("category").trim().notEmpty(),
    body("totalCopies").isInt({ min: 1 }),
  ],
  validate,
  libraryController.addBook,
);
router.put(
  "/books/:id",
  [
    param("id").isMongoId().withMessage("Invalid ID"),
    body("totalCopies").optional().isInt({ min: 0 }),
    body("publicationYear")
      .optional()
      .isInt({ min: 1000, max: new Date().getFullYear() + 1 }),
  ],
  validate,
  authenticate,
  requireRoles([SUPER_ADMIN, LIBRARY_STAFF]),
  libraryController.updateBook,
);

// Issues
router.get(
  "/issues",
  authenticate,
  requireRoles([SUPER_ADMIN, LIBRARY_STAFF]),
  libraryController.listIssues,
);
router.get(
  "/issues/my",
  authenticate,
  requireRoles([FACULTY, STUDENT]),
  libraryController.myIssues,
);
router.post(
  "/issues",
  authenticate,
  requireRoles([SUPER_ADMIN, LIBRARY_STAFF]),
  [
    body("bookId").isMongoId(),
    body("memberId").isMongoId(),
    body("memberType").isIn(["student", "faculty"]),
  ],
  validate,
  libraryController.issueBook,
);
router.put(
  "/issues/:id/return",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  requireRoles([SUPER_ADMIN, LIBRARY_STAFF]),
  libraryController.returnBook,
);
router.put(
  "/issues/:id/renew",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  authenticate,
  requireRoles(LIBRARY_READERS),
  libraryController.renewBook,
);
router.post(
  "/issues/:id/fine-payments",
  authenticate,
  requireRoles([SUPER_ADMIN, LIBRARY_STAFF]),
  [
    param("id").isMongoId().withMessage("Invalid ID"),
    body("amount").isFloat({ gt: 0 }),
    body("paymentMode").isIn(["cash", "bank_transfer", "upi"]),
    body("referenceNo").optional().trim().isLength({ max: 100 }),
  ],
  validate,
  libraryController.collectFine,
);
router.get("/digital", authenticate, requireRoles(LIBRARY_READERS), libraryController.listDigital);
router.post(
  "/digital",
  authenticate,
  requireRoles([SUPER_ADMIN, LIBRARY_STAFF]),
  [
    body("isbn").trim().notEmpty(),
    body("title").trim().isLength({ min: 1, max: 300 }),
    body("authors").isArray({ min: 1, max: 20 }),
    body("authors.*").isString().trim().isLength({ min: 1, max: 200 }),
    body("publisher").trim().notEmpty(),
    body("publicationYear").isInt({ min: 1000, max: new Date().getFullYear() + 1 }),
    body("category").trim().notEmpty(),
    body("digitalUrl").isURL({ protocols: ["https"], require_protocol: true }),
  ],
  validate,
  libraryController.addDigital,
);

export default router;
