import { Router } from "express";
import { param, body } from "express-validator";
import { studentProfileController } from "../controllers";
import { authenticate, requireRoles, validate } from "../middlewares";
import { SystemRole } from "../constants/roles";

const router = Router();
const auth = authenticate;
const admin = requireRoles([
  SystemRole.SUPER_ADMIN,
  SystemRole.ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.DEAN_ACADEMIC,
  SystemRole.HOD,
  SystemRole.ADMINISTRATION_OFFICE,
  SystemRole.ASSISTANT_ADMINISTRATION_OFFICER,
]);
const lifecycleAdmin = requireRoles([
  SystemRole.SUPER_ADMIN,
  SystemRole.ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.DEAN_ACADEMIC,
  SystemRole.ADMINISTRATION_OFFICE,
]);
const staff = requireRoles([
  SystemRole.SUPER_ADMIN,
  SystemRole.ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.DEAN_ACADEMIC,
  SystemRole.FACULTY,
  SystemRole.HOD,
  SystemRole.EXAMINATION_CELL,
  SystemRole.ACCOUNTS_DEPARTMENT,
  SystemRole.ADMINISTRATION_OFFICE,
  SystemRole.ASSISTANT_ADMINISTRATION_OFFICER,
  SystemRole.ADMISSION_INCHARGE,
  SystemRole.PLACEMENT_CELL,
  SystemRole.SCHOLARSHIP_CELL,
]);
/** AO / AOO / Admin can update the university registration number later. */
const regNoUpdaters = requireRoles([
  SystemRole.SUPER_ADMIN,
  SystemRole.ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.ADMINISTRATION_OFFICE,
  SystemRole.ASSISTANT_ADMINISTRATION_OFFICER,
  SystemRole.ADMISSION_INCHARGE,
]);

router.get("/", auth, staff, studentProfileController.list);
router.get("/export", auth, lifecycleAdmin, studentProfileController.exportCsv);
router.get("/stats", auth, admin, studentProfileController.getStats);
router.get("/me", auth, requireRoles([SystemRole.STUDENT]), studentProfileController.getMyProfile);
router.get(
  "/me/abc-ledger",
  auth,
  requireRoles([SystemRole.STUDENT]),
  studentProfileController.getMyAbcLedger,
);
router.patch(
  "/me",
  auth,
  requireRoles([SystemRole.STUDENT]),
  studentProfileController.updateMyProfile,
);
router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  auth,
  staff,
  studentProfileController.getById,
);
router.post(
  "/",
  auth,
  lifecycleAdmin,
  [
    body("aadhaarNumber")
      .optional()
      .matches(/^\d{12}$/)
      .withMessage("Aadhaar must contain 12 digits"),
    body("parentInfo.fatherAadhaar")
      .optional()
      .matches(/^\d{12}$/)
      .withMessage("Father Aadhaar must contain 12 digits"),
    body("status").optional().equals("active").withMessage("New students start as active"),
  ],
  validate,
  studentProfileController.create,
);
router.put(
  "/:id",
  [
    param("id").isMongoId().withMessage("Invalid ID"),
    body("aadhaarNumber")
      .optional()
      .matches(/^\d{12}$/)
      .withMessage("Aadhaar must contain 12 digits"),
    body("parentInfo.fatherAadhaar")
      .optional()
      .matches(/^\d{12}$/)
      .withMessage("Father Aadhaar must contain 12 digits"),
    body("currentSemester").not().exists().withMessage("Use the promotion workflow"),
    body("semesterResults").not().exists().withMessage("Results are managed by Examination"),
    body("status")
      .optional()
      .isIn(["active", "detained", "dropped", "transferred", "lateral_promoted", "rusticated"]),
  ],
  validate,
  auth,
  lifecycleAdmin,
  studentProfileController.update,
);
router.delete(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  auth,
  lifecycleAdmin,
  studentProfileController.remove,
);
router.post(
  "/:id/promote",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  auth,
  lifecycleAdmin,
  studentProfileController.promoteSemester,
);
router.post(
  "/:id/bonafide",
  [
    param("id").isMongoId().withMessage("Invalid ID"),
    body("purpose").isString().trim().isLength({ min: 3, max: 300 }),
  ],
  validate,
  auth,
  admin,
  studentProfileController.generateBonafide,
);

/**
 * AO / AOO / Admin set the university (BPUT) registration number after the
 * affiliating university issues it. ERP roll number is untouched.
 */
router.patch(
  "/:id/registration-number",
  [
    param("id").isMongoId().withMessage("Invalid ID"),
    body("registrationNumber")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("registrationNumber is required"),
  ],
  validate,
  auth,
  regNoUpdaters,
  studentProfileController.setRegistrationNumber,
);

export default router;
