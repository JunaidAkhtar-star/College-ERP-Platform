import { Router } from "express";
import { body, param } from "express-validator";
import { authenticate, requireRoles, validate } from "../middlewares";
import { hostelController } from "../controllers";
import { SystemRole } from "../constants/roles";

const router = Router();
const { SUPER_ADMIN, ADMIN, PRINCIPAL, HOSTEL_WARDEN, STUDENT } = SystemRole;
const hostelStaff = requireRoles([SUPER_ADMIN, ADMIN, PRINCIPAL, HOSTEL_WARDEN]);

// Rooms
router.get(
  "/rooms",
  authenticate,
  requireRoles([SUPER_ADMIN, ADMIN, PRINCIPAL, HOSTEL_WARDEN, STUDENT]),
  hostelController.listRooms,
);
router.post(
  "/rooms",
  authenticate,
  hostelStaff,
  [
    body("hostelName").trim().isLength({ min: 2, max: 120 }),
    body("roomNumber").trim().isLength({ min: 1, max: 30 }),
    body("blockName").trim().isLength({ min: 1, max: 80 }),
    body("hostelType").isIn(["boys", "girls", "mixed"]),
    body("roomType").isIn(["single", "double", "triple", "dormitory"]),
    body("floor").isInt({ min: 0, max: 100 }),
    body("capacity").isInt({ min: 1, max: 100 }),
    body("monthlyFee").isFloat({ min: 0 }),
  ],
  validate,
  hostelController.addRoom,
);
router.put(
  "/rooms/:id",
  authenticate,
  hostelStaff,
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  hostelController.updateRoom,
);

// Allocations
router.get("/allocations/my", authenticate, requireRoles([STUDENT]), hostelController.myAllocation);
router.get("/allocations", authenticate, hostelStaff, hostelController.listAllocations);
router.post(
  "/allocations",
  authenticate,
  hostelStaff,
  [
    body("studentId").isMongoId(),
    body("roomId").isMongoId(),
    body("academicYear").matches(/^\d{4}-(?:\d{2}|\d{4})$/),
    body("messFee").optional().isFloat({ min: 0 }),
    body("remarks").optional().trim().isLength({ max: 1000 }),
    body("ignoreWarning").optional().isBoolean(),
  ],
  validate,
  hostelController.allocate,
);
router.put(
  "/allocations/:id/vacate",
  authenticate,
  hostelStaff,
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  hostelController.vacate,
);
router.put(
  "/allocations/:id/reallocate",
  authenticate,
  hostelStaff,
  [
    param("id").isMongoId().withMessage("Invalid ID"),
    body("roomId").isMongoId(),
    body("ignoreWarning").optional().isBoolean(),
  ],
  validate,
  hostelController.reallocate,
);

// ─── Visitor Log ──────────────────────────────────────────────────────────────
router.post(
  "/visitors",
  authenticate,
  hostelStaff,
  [
    body("studentId").isMongoId(),
    body("visitorName").trim().isLength({ min: 2, max: 120 }),
    body("visitorPhone")
      .trim()
      .matches(/^[0-9+() -]{7,20}$/),
    body("relation").trim().isLength({ min: 2, max: 80 }),
    body("purpose").optional().trim().isLength({ max: 500 }),
    body("idProofType")
      .optional()
      .isIn(["aadhaar", "passport", "driving_license", "voter_id", "other"]),
    body("idProofNo").optional().trim().isLength({ max: 100 }),
  ],
  validate,
  hostelController.logVisitor,
);
router.get("/visitors", authenticate, hostelStaff, hostelController.listVisitors);
router.put(
  "/visitors/:id/checkout",
  authenticate,
  hostelStaff,
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  hostelController.checkOutVisitor,
);

// ─── Complaints ───────────────────────────────────────────────────────────────
router.post(
  "/complaints",
  authenticate,
  requireRoles([STUDENT]),
  [
    body("category").isIn(["maintenance", "cleanliness", "mess", "security", "other"]),
    body("description").trim().isLength({ min: 10, max: 3000 }),
    body("attachmentUrl").optional().isURL(),
  ],
  validate,
  hostelController.raiseComplaint,
);
router.get(
  "/complaints",
  authenticate,
  requireRoles([SUPER_ADMIN, ADMIN, PRINCIPAL, HOSTEL_WARDEN, STUDENT]),
  hostelController.listComplaints,
);
router.put(
  "/complaints/:id",
  authenticate,
  hostelStaff,
  [
    param("id").isMongoId().withMessage("Invalid ID"),
    body("status").optional().isIn(["open", "in_progress", "resolved", "closed"]),
    body("assignedTo").optional().isMongoId(),
    body("resolution").optional().trim().isLength({ max: 3000 }),
  ],
  validate,
  hostelController.updateComplaint,
);

// ─── Hostel Fee ───────────────────────────────────────────────────────────────
router.post(
  "/fees",
  authenticate,
  hostelStaff,
  [
    body("allocationId").isMongoId(),
    body("month").matches(/^\d{4}-(0[1-9]|1[0-2])$/),
    body("otherCharges").optional().isFloat({ min: 0 }),
    body("dueDate").isISO8601(),
  ],
  validate,
  hostelController.generateFeeRecord,
);
router.get(
  "/fees",
  authenticate,
  requireRoles([SUPER_ADMIN, ADMIN, PRINCIPAL, HOSTEL_WARDEN, STUDENT]),
  hostelController.listFeeRecords,
);
router.put(
  "/fees/:id/pay",
  authenticate,
  hostelStaff,
  [
    param("id").isMongoId().withMessage("Invalid ID"),
    body("paidAmount").isFloat({ gt: 0 }),
    body("paymentMode").isIn(["cash", "online", "bank_transfer", "upi", "dd", "cheque"]),
  ],
  validate,
  hostelController.collectFeePayment,
);

export default router;
