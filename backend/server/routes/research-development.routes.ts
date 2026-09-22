/**
 * @file research-development.routes.ts
 */
import { Router } from "express";
import { param, body } from "express-validator";
import { authenticate, requireRoles, validate } from "../middlewares";
import { researchDevelopmentController as ctl } from "../controllers/research-development.controller";
import { SystemRole } from "../constants/roles";

const router = Router();
const auth = authenticate;
const RND_ADMINS = [
  SystemRole.SUPER_ADMIN,
  SystemRole.ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.DEAN_ACADEMIC,
  SystemRole.RESEARCH_DEVELOPMENT,
];

// ── Projects ─────────────────────────────────────────────────────────────────
router.get("/projects", auth, ctl.listProjects);
router.get("/projects/stats", auth, ctl.stats);
router.get(
  "/projects/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validate,
  auth,
  ctl.getProject,
);
router.post(
  "/projects",
  [body("title").isString().trim().notEmpty(), body("principalInvestigator").isMongoId()],
  validate,
  auth,
  requireRoles(RND_ADMINS),
  ctl.createProject,
);
router.patch(
  "/projects/:id",
  [param("id").isMongoId()],
  validate,
  auth,
  requireRoles(RND_ADMINS),
  ctl.updateProject,
);
router.delete(
  "/projects/:id",
  [param("id").isMongoId()],
  validate,
  auth,
  requireRoles(RND_ADMINS),
  ctl.deleteProject,
);

// ── Publications ─────────────────────────────────────────────────────────────
router.get("/publications", auth, ctl.listPublications);
router.post(
  "/publications",
  [
    body("title").isString().trim().notEmpty(),
    body("kind").isIn(["journal", "conference", "patent", "book", "chapter"]),
    body("year").isInt({ min: 1900 }),
  ],
  validate,
  auth,
  requireRoles(RND_ADMINS),
  ctl.createPublication,
);
router.patch(
  "/publications/:id",
  [param("id").isMongoId()],
  validate,
  auth,
  requireRoles(RND_ADMINS),
  ctl.updatePublication,
);
router.delete(
  "/publications/:id",
  [param("id").isMongoId()],
  validate,
  auth,
  requireRoles(RND_ADMINS),
  ctl.deletePublication,
);

export default router;
