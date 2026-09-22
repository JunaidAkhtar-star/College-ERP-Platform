import { BackendDomain, type DomainManifest } from "../../platform/domain.types";

export const collegeErpManifest: DomainManifest = {
  id: BackendDomain.COLLEGE_ERP,
  displayName: "College ERP",
  description: "Education product workflows and institution-owned operational data.",
  routes: [],
  capabilities: [
    "admissions",
    "academics",
    "attendance",
    "assessment",
    "student-lifecycle",
    "faculty-hr",
    "finance",
    "campus-operations",
    "quality-and-compliance",
  ],
  dependencies: [BackendDomain.SHARED_FOUNDATION, BackendDomain.PLATFORM_CORE],
};
