/**
 * Maps API route modules to the commercial product entitlement that owns them.
 * Routes omitted here are platform/core capabilities required by every tenant
 * (authentication, users, roles, navigation, settings, health and uploads).
 */
export const API_MODULE_ENTITLEMENTS: Readonly<Record<string, string>> = {
  admission: "admissions",
  "recruitment-crm": "admissions",
  counseling: "admissions",
  scholarship: "admissions",
  "financial-aid": "fees",
  "lms-integration": "lms-integrations",
  "campus-governance": "multi-campus-governance",
  facilities: "procurement",
  advancement: "placements",
  "continuing-education": "academics",
  "ai-governance": "security",
  "student-profile": "academics",
  "faculty-profile": "academics",
  department: "academics",
  subject: "academics",
  curriculum: "academics",
  batch: "academics",
  section: "academics",
  "student-section-allotment": "academics",
  "assessment-policy": "academics",
  "assessment-gradebook": "academics",
  "academic-calendar": "academics",
  timetable: "academics",
  "course-progress": "academics",
  "lesson-plan": "academics",
  "faculty-workload": "academics",
  "semester-registration": "academics",
  "degree-audit": "academics",
  assignment: "academics",
  quiz: "academics",
  "question-bank": "academics",
  "study-material": "academics",
  attendance: "attendance",
  "faculty-attendance": "attendance",
  examination: "examinations",
  fee: "fees",
  accounts: "fees",
  "payment-settings": "fees",
  hr: "hr-payroll",
  payroll: "hr-payroll",
  leave: "hr-payroll",
  "faculty-onboarding": "academics",
  library: "library",
  hostel: "hostel",
  transport: "transport",
  placement: "placements",
  "job-posting": "placements",
  "training-session": "placements",
  alumni: "placements",
  chat: "communication",
  notice: "communication",
  event: "communication",
  "naac-nba": "naac-iqac",
  iqac: "naac-iqac",
  compliance: "naac-iqac",
  "compliance-workspace": "naac-iqac",
  "regulatory-integration": "government-regulatory-integrations",
  "research-development": "research",
  iic: "research",
  procurement: "procurement",
  store: "procurement",
  gatepass: "procurement",
  club: "clubs",
  clubs: "clubs",
  meeting: "virtual-classrooms",
  "meeting-recording": "virtual-classrooms",
  "audit-log": "security",
  dashboard: "analytics",
  "report-center": "analytics",
  "import-center": "analytics",
  "document-template": "academics",
  "communication-hub": "communication",
  sso: "security",
  "form-workflow": "academics",
  discipline: "academics",
  "data-portability": "security",
  "tenant-backup": "security",
  collaboration: "communication",
  "external-connector": "security",
  "tenant-integrations": "security",
  document: "academics",
  mentor: "academics",
  "student-success": "academics",
  grievance: "communication",
  task: "academics",
  operations: "security",
};

/**
 * Commercial entitlement slugs that were renamed after tenants and catalogue
 * records had already been created. Always canonicalize these at the policy
 * boundary so a stale catalogue/cache entry cannot deny a valid subscription.
 */
const LEGACY_ENTITLEMENT_ALIASES: Readonly<Record<string, string>> = {
  "academic-structure": "academics",
  admission: "admissions",
  examination: "examinations",
  faculty: "academics",
  fee: "fees",
  meeting: "virtual-classrooms",
  placement: "placements",
  students: "academics",
};

export function canonicalEntitlementSlug(slug: string): string {
  return LEGACY_ENTITLEMENT_ALIASES[slug] ?? slug;
}

export function entitlementForPath(path: string): string | undefined {
  if (/^\/api\/v1\/tenant-integrations\/[^/?]+\/(?:checkout|webhook)(?:[/?]|$)/.test(path))
    return "fees";
  if (/^\/api\/v1\/parent\/attendance(?:[/?]|$)/.test(path)) return "attendance";
  if (/^\/api\/v1\/parent\/results(?:[/?]|$)/.test(path)) return "examinations";
  if (/^\/api\/v1\/parent\/fees(?:[/?]|$)/.test(path)) return "fees";
  if (/^\/api\/v1\/parent\/(?:notices|messages)(?:[/?]|$)/.test(path)) return "communication";
  if (/^\/api\/v1\/parent\/ward(?:[/?]|$)/.test(path)) return "academics";
  const match = path.match(/^\/api\/v1\/([^/?]+)/);
  const entitlement = match?.[1] ? API_MODULE_ENTITLEMENTS[match[1]] : undefined;
  return entitlement ? canonicalEntitlementSlug(entitlement) : undefined;
}

const NAV_MODULE_ENTITLEMENTS: Readonly<Record<string, string>> = {
  "/academic-structure": "academics",
  "/lms-integration": "lms-integrations",
  "/accreditation": "naac-iqac",
  "/government-integrations": "government-regulatory-integrations",
  "/campus-governance": "multi-campus-governance",
  "/departments": "academics",
  "/document-designer": "academics",
  "/faculty-management": "academics",
  "/forms": "academics",
  "/gate-pass": "procurement",
  "/sso-settings": "security",
  "/student-management": "academics",
  "/subjects": "academics",
  "/task-management": "academics",
  "/parent/attendance": "attendance",
  "/parent/fees": "fees",
  "/parent/results": "examinations",
  "/parent/ward": "academics",
};

/** Resolve commercial ownership for a role-less ERP navigation href. */
export function entitlementForNavHref(href: string): string | undefined {
  const normalized = `/${href.split(/[?#]/)[0].split("/").filter(Boolean).join("/")}`;
  return NAV_MODULE_ENTITLEMENTS[normalized] ?? entitlementForPath(`/api/v1${normalized}`);
}
