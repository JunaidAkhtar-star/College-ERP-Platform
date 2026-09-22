import { Router } from "express";
import { body, param } from "express-validator";
import { authenticate, requireRoles, validate } from "../middlewares";
import { placementController } from "../controllers";
import { studentPlacementProfileController } from "../controllers/student-placement-profile.controller";
import { SystemRole } from "../constants/roles";
import { placementNetworkController } from "../controllers/placement-network.controller";

const router = Router();
const { SUPER_ADMIN, PRINCIPAL, PLACEMENT_CELL, STUDENT } = SystemRole;
const coordinatorGuard = requireRoles([SUPER_ADMIN, PLACEMENT_CELL]);
const placementReaders = requireRoles([SUPER_ADMIN, PRINCIPAL, PLACEMENT_CELL]);
const placementViewers = requireRoles([SUPER_ADMIN, PRINCIPAL, PLACEMENT_CELL, STUDENT]);
const applicationReaders = requireRoles([SUPER_ADMIN, PLACEMENT_CELL, STUDENT]);
const mongoId = (name: string) => param(name).isMongoId().withMessage(`Invalid ${name}`);

router.get("/network", authenticate, placementReaders, placementNetworkController.list);
router.get(
  "/network/requests",
  authenticate,
  placementReaders,
  placementNetworkController.requests,
);
router.post(
  "/network/:listingId/requests",
  [
    mongoId("listingId"),
    body("estimatedStudents").isInt({ min: 1, max: 10000 }),
    body("contactName").trim().isLength({ min: 2, max: 150 }),
    body("contactEmail").isEmail().normalizeEmail(),
    body("message").optional().trim().isLength({ max: 1000 }),
  ],
  validate,
  authenticate,
  placementReaders,
  placementNetworkController.request,
);
router.patch(
  "/network/requests/:requestId",
  [
    mongoId("requestId"),
    body("decision").isIn(["approve", "reject"]),
    body("decisionNote").optional().trim().isLength({ max: 1000 }),
  ],
  validate,
  authenticate,
  coordinatorGuard,
  placementNetworkController.decide,
);
router.delete(
  "/network/:listingId",
  [mongoId("listingId")],
  validate,
  authenticate,
  coordinatorGuard,
  placementNetworkController.withdraw,
);

// Student-owned placement profile and applications must precede the /:id drive route.
router.get(
  "/my/applications",
  authenticate,
  requireRoles([STUDENT]),
  placementController.myApplications,
);
router.get(
  "/profiles/me",
  authenticate,
  requireRoles([STUDENT]),
  studentPlacementProfileController.myProfile,
);
router.get(
  "/profiles/me/applications",
  authenticate,
  requireRoles([STUDENT]),
  studentPlacementProfileController.myApplications,
);
router.post(
  "/profiles",
  authenticate,
  requireRoles([STUDENT]),
  studentPlacementProfileController.create,
);
router.put(
  "/profiles/me",
  authenticate,
  requireRoles([STUDENT]),
  studentPlacementProfileController.update,
);
router.post(
  "/profiles/me/resume",
  authenticate,
  requireRoles([STUDENT]),
  studentPlacementProfileController.uploadResume,
);

router.get(
  "/profiles/list",
  authenticate,
  placementReaders,
  studentPlacementProfileController.list,
);
router.get(
  "/profiles/stats",
  authenticate,
  placementReaders,
  studentPlacementProfileController.stats,
);
router.get(
  "/profiles/:id",
  [mongoId("id")],
  validate,
  authenticate,
  placementReaders,
  studentPlacementProfileController.getById,
);
router.put(
  "/profiles/:id/admin",
  [mongoId("id")],
  validate,
  authenticate,
  coordinatorGuard,
  studentPlacementProfileController.adminUpdate,
);
router.put(
  "/profiles/:studentId/eligibility",
  [mongoId("studentId")],
  validate,
  authenticate,
  coordinatorGuard,
  studentPlacementProfileController.recalculateEligibility,
);

router.post(
  "/applications/:applicationId/offer",
  [
    mongoId("applicationId"),
    body("offeredPackage").isFloat({ gt: 0 }),
    body("offeredRole").trim().isLength({ min: 2, max: 200 }),
    body("offerExpiresAt").isISO8601(),
    body("joiningDate").optional().isISO8601(),
  ],
  validate,
  authenticate,
  coordinatorGuard,
  placementController.issueOffer,
);
router.put(
  "/applications/:applicationId/respond",
  [
    mongoId("applicationId"),
    body("response").isIn(["accept", "decline"]),
    body("reason").if(body("response").equals("decline")).trim().isLength({ min: 3, max: 1000 }),
  ],
  validate,
  authenticate,
  requireRoles([STUDENT]),
  placementController.respondToOffer,
);
router.get(
  "/applications/:applicationId",
  [mongoId("applicationId")],
  validate,
  authenticate,
  applicationReaders,
  placementController.getApplication,
);

router.get("/stats", authenticate, placementReaders, placementController.stats);
router.get("/", authenticate, placementViewers, placementController.list);
router.post(
  "/",
  authenticate,
  coordinatorGuard,
  [
    body("academicYear").trim().isLength({ min: 4, max: 20 }),
    body("companyName").trim().isLength({ min: 2, max: 200 }),
    body("jobRole").trim().isLength({ min: 2, max: 200 }),
    body("venue").trim().isLength({ min: 2, max: 300 }),
    body("driveDate").isISO8601(),
    body("registrationStart").isISO8601(),
    body("registrationEnd").isISO8601(),
    body("package").isFloat({ gt: 0 }),
    body("rounds").isArray({ min: 1, max: 20 }),
  ],
  validate,
  placementController.create,
);

router.post(
  "/:id/network/publish",
  [
    mongoId("id"),
    body("participationNote").optional().trim().isLength({ max: 1000 }),
    body("availableSeats").optional().isInt({ min: 1, max: 10000 }),
  ],
  validate,
  authenticate,
  coordinatorGuard,
  placementNetworkController.publish,
);

router.get(
  "/:id/applications/counts",
  [mongoId("id")],
  validate,
  authenticate,
  coordinatorGuard,
  placementController.getDriveApplicationCounts,
);
router.get(
  "/:id/applications",
  [mongoId("id")],
  validate,
  authenticate,
  coordinatorGuard,
  placementController.getDriveApplications,
);
router.post(
  "/:id/register",
  [mongoId("id")],
  validate,
  authenticate,
  requireRoles([STUDENT]),
  placementController.register,
);
router.put(
  "/:id/shortlist",
  [mongoId("id"), body("studentIds").isArray({ min: 1, max: 1000 })],
  validate,
  authenticate,
  coordinatorGuard,
  placementController.shortlist,
);
router.put(
  "/:id/select",
  [mongoId("id"), body("applicationIds").isArray({ min: 1, max: 1000 })],
  validate,
  authenticate,
  coordinatorGuard,
  placementController.select,
);
router.post(
  "/:id/rounds",
  [
    mongoId("id"),
    body("roundNo").isInt({ min: 1 }),
    body("roundName").trim().isLength({ min: 2, max: 150 }),
    body("results").isArray({ min: 1, max: 1000 }),
    body("results.*.applicationId").isMongoId(),
    body("results.*.status").isIn(["pass", "fail", "absent"]),
    body("results.*.score").optional().isFloat({ min: 0 }),
  ],
  validate,
  authenticate,
  coordinatorGuard,
  placementController.declareRoundResults,
);
router.patch(
  "/:id/status",
  [
    mongoId("id"),
    body("action").isIn(["cancel", "complete"]),
    body("reason").if(body("action").equals("cancel")).trim().isLength({ min: 3, max: 1000 }),
  ],
  validate,
  authenticate,
  coordinatorGuard,
  placementController.transition,
);
router.put(
  "/:id",
  [mongoId("id")],
  validate,
  authenticate,
  coordinatorGuard,
  placementController.update,
);
router.get(
  "/:id",
  [mongoId("id")],
  validate,
  authenticate,
  placementViewers,
  placementController.getById,
);

export default router;
