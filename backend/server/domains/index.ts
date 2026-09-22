import type { DomainManifest } from "../platform/domain.types";
import { collegeErpManifest } from "./college-erp/manifest";
import { platformCoreManifest } from "./platform-core/manifest";
import { sharedFoundationManifest } from "./shared-foundation/manifest";

export const backendDomainManifests: readonly DomainManifest[] = [
  sharedFoundationManifest,
  platformCoreManifest,
  collegeErpManifest,
];

export { collegeErpManifest, platformCoreManifest, sharedFoundationManifest };
