import { createHash } from "node:crypto";
import createError from "http-errors";
import { Types } from "mongoose";
import { COMPLIANCE_CATALOG } from "../constants/compliance-catalog";
import {
  AccreditationSetupModel,
  AccreditationSnapshotModel,
  type IAccreditationFrameworkScope,
  type TAccreditationTrust,
} from "../models/accreditation-setup.model";
import {
  ComplianceFrameworkModel,
  ComplianceRequirementModel,
  ComplianceSubmissionModel,
} from "../models/compliance-workspace.model";
import { nextSeq } from "../models/counter.model";

const allowedProfileFields = new Set([
  "country",
  "region",
  "institutionType",
  "universityType",
  "affiliatingUniversity",
  "isAutonomous",
  "programmeDomains",
]);

const cleanProfile = (input: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(input).filter(([key]) => allowedProfileFields.has(key)));

const catalogMatch = (input: {
  country: string;
  institutionType: string;
  programmeDomains: string[];
}) =>
  COMPLIANCE_CATALOG.filter((item) => {
    if (item.category === "internal") return false;
    const countryMatches = item.country === "Global" || item.country === input.country;
    const institutionMatches =
      !item.institutionTypes?.length || item.institutionTypes.includes(input.institutionType);
    const domainMatches =
      !item.programmeDomains?.length ||
      item.programmeDomains.some((domain) => input.programmeDomains.includes(domain));
    return countryMatches && institutionMatches && domainMatches;
  });

const scopeOf = async (scopeId: string) => {
  const setup = await AccreditationSetupModel.findOne({ "frameworks._id": scopeId });
  if (!setup) throw createError(404, "Accreditation framework scope not found");
  const scope = setup.frameworks.find((item) => String(item._id) === scopeId);
  if (!scope) throw createError(404, "Accreditation framework scope not found");
  return { setup, scope };
};

const nextTrustState: Partial<Record<TAccreditationTrust, TAccreditationTrust>> = {
  institution_reviewed: "platform_verified",
  platform_verified: "official_template_mapped",
  official_template_mapped: "submitted",
  submitted: "provider_acknowledged",
};

export const accreditationSetupService = {
  get: () => AccreditationSetupModel.findOne({}).lean(),

  saveProfile: async (input: Record<string, unknown>) => {
    const profile = cleanProfile(input);
    if (!profile["country"] || !profile["institutionType"])
      throw createError(400, "Country and institution type are required");
    return AccreditationSetupModel.findOneAndUpdate(
      {},
      { $set: { ...profile, setupStatus: "in_progress" }, $setOnInsert: { frameworks: [] } },
      { upsert: true, returnDocument: "after", runValidators: true },
    ).lean();
  },

  recommendations: async () => {
    const setup = await AccreditationSetupModel.findOne({}).lean();
    if (!setup) throw createError(409, "Complete the institution classification first");
    const active = new Set(setup.frameworks.map((scope) => scope.frameworkSlug));
    return catalogMatch(setup).map((item) => ({
      ...item,
      alreadyConfigured: active.has(item.slug),
      confidence: item.country === setup.country ? "recommended" : "optional",
      verificationRequired: true,
      reason:
        item.programmeDomains
          ?.filter((domain) => setup.programmeDomains.includes(domain))
          .join(", ") || `${setup.institutionType.replace(/_/g, " ")} in ${setup.country}`,
    }));
  },

  addScope: async (input: Partial<IAccreditationFrameworkScope>) => {
    const setup = await AccreditationSetupModel.findOne({});
    if (!setup) throw createError(409, "Complete the institution classification first");
    const catalog = COMPLIANCE_CATALOG.find((item) => item.slug === input.frameworkSlug);
    const framework = await ComplianceFrameworkModel.findOne({ slug: input.frameworkSlug }).lean();
    if (!catalog && !framework)
      throw createError(400, "Select a known or tenant-verified framework");
    if (!input.frameworkVersion?.trim())
      throw createError(400, "Framework version is required and must match the adopted manual");
    if (input.scopeType === "campus" && !input.campusIds?.length)
      throw createError(400, "Campus-scoped accreditation requires at least one campus");
    if (input.scopeType === "programme" && !input.programIds?.length)
      throw createError(400, "Programme-scoped accreditation requires at least one programme");
    if (
      input.validFrom &&
      input.validUntil &&
      new Date(input.validFrom) > new Date(input.validUntil)
    )
      throw createError(400, "Validity start cannot be after validity end");
    setup.frameworks.push({
      frameworkSlug: String(input.frameworkSlug),
      frameworkVersion: input.frameworkVersion.trim(),
      authority: String(input.authority || catalog?.authority || framework?.authority || ""),
      scopeType: input.scopeType ?? "institution",
      campusIds: (input.campusIds ?? []) as Types.ObjectId[],
      departmentIds: (input.departmentIds ?? []) as Types.ObjectId[],
      programIds: (input.programIds ?? []) as Types.ObjectId[],
      cycleType: input.cycleType ?? "first",
      cycleNumber: input.cycleNumber,
      academicYear: String(input.academicYear),
      validFrom: input.validFrom,
      validUntil: input.validUntil,
      submissionDueAt: input.submissionDueAt,
      officialSourceUrl: input.officialSourceUrl || catalog?.officialSourceUrl,
      officialSourceChecksum: input.officialSourceChecksum,
      trustState: "draft_mapping",
      trustHistory: [],
      status: "draft",
      ownerIds: (input.ownerIds ?? []) as Types.ObjectId[],
      reviewerIds: (input.reviewerIds ?? []) as Types.ObjectId[],
    });
    await setup.save();
    return setup.toObject();
  },

  requestActivation: async (scopeId: string, actorId: string) => {
    const { setup, scope } = await scopeOf(scopeId);
    if (!["draft", "rejected"].includes(scope.status))
      throw createError(409, "Only draft or rejected scopes can be submitted");
    if (!scope.officialSourceUrl || !scope.frameworkVersion)
      throw createError(400, "Official source and framework version are required");
    if (!scope.ownerIds.length || !scope.reviewerIds.length)
      throw createError(400, "Assign at least one evidence owner and independent reviewer");
    if (scope.reviewerIds.some((id) => String(id) === actorId))
      throw createError(409, "The activation requester cannot be an assigned reviewer");
    scope.status = "pending_approval";
    scope.trustState = "institution_reviewed";
    scope.requestedBy = new Types.ObjectId(actorId);
    scope.requestedAt = new Date();
    setup.setupStatus = "pending_approval";
    await setup.save();
    return setup.toObject();
  },

  decideActivation: async (scopeId: string, actorId: string, approved: boolean, note: string) => {
    const { setup, scope } = await scopeOf(scopeId);
    if (scope.status !== "pending_approval")
      throw createError(409, "Scope is not awaiting approval");
    if (String(scope.requestedBy) === actorId)
      throw createError(409, "The activation requester cannot approve their own framework");
    if (!scope.reviewerIds.some((id) => String(id) === actorId))
      throw createError(403, "Only an assigned framework reviewer can decide activation");
    scope.status = approved ? "active" : "rejected";
    scope.approvedBy = approved ? new Types.ObjectId(actorId) : undefined;
    scope.approvedAt = approved ? new Date() : undefined;
    scope.decisionNote = note.trim();
    setup.setupStatus = setup.frameworks.some((item) => item.status === "active")
      ? "active"
      : "in_progress";
    await setup.save();
    return setup.toObject();
  },

  advanceTrust: async (
    scopeId: string,
    actorId: string,
    input: {
      state: TAccreditationTrust;
      evidenceReference: string;
      evidenceSource: "official_document" | "verified_portal_evidence" | "verified_api";
      note: string;
    },
  ) => {
    const { setup, scope } = await scopeOf(scopeId);
    if (scope.status !== "active")
      throw createError(409, "Only an active framework scope can advance verification");
    if (String(scope.requestedBy) === actorId)
      throw createError(409, "The activation requester cannot verify their own framework");
    if (!scope.reviewerIds.some((id) => String(id) === actorId))
      throw createError(403, "Only an assigned independent reviewer can advance verification");
    if (nextTrustState[scope.trustState] !== input.state)
      throw createError(409, "Verification states must advance sequentially");
    if (!scope.officialSourceChecksum && input.state === "platform_verified")
      throw createError(409, "Record the adopted official-source checksum before verification");
    if (
      input.state === "provider_acknowledged" &&
      !["verified_portal_evidence", "verified_api"].includes(input.evidenceSource)
    )
      throw createError(
        409,
        "Provider acknowledgement requires verified portal evidence or a verified API response",
      );
    scope.trustState = input.state;
    scope.trustHistory.push({
      ...input,
      changedBy: new Types.ObjectId(actorId),
      changedAt: new Date(),
    });
    await setup.save();
    return setup.toObject();
  },

  readiness: async (academicYear: string) => {
    const setup = await AccreditationSetupModel.findOne({}).lean();
    if (!setup) return { setupRequired: true, frameworks: [], tasks: [] };
    const scopes = setup.frameworks.filter((scope) => scope.academicYear === academicYear);
    const slugs = scopes.map((scope) => scope.frameworkSlug);
    const candidateRequirements = await ComplianceRequirementModel.find({
      framework: { $in: slugs },
      isActive: true,
    }).lean();
    const requirements = candidateRequirements.filter((requirement) =>
      scopes.some((scope) => {
        if (scope.frameworkSlug !== requirement.framework) return false;
        const departments = new Set(scope.departmentIds.map(String));
        const programmes = new Set(scope.programIds.map(String));
        return (
          (!departments.size ||
            !requirement.departmentIds.length ||
            requirement.departmentIds.some((id) => departments.has(String(id)))) &&
          (scope.scopeType !== "programme" ||
            !requirement.applicablePrograms.length ||
            requirement.applicablePrograms.some((id) => programmes.has(id)))
        );
      }),
    );
    const requirementIds = requirements.map((item) => item._id);
    const scopedDepartmentIds = [
      ...new Set(scopes.flatMap((scope) => scope.departmentIds.map(String))),
    ];
    const submissions = requirementIds.length
      ? await ComplianceSubmissionModel.find({
          academicYear,
          requirementId: { $in: requirementIds },
          ...(scopedDepartmentIds.length
            ? { departmentId: { $in: scopedDepartmentIds.map((id) => new Types.ObjectId(id)) } }
            : {}),
        }).lean()
      : [];
    const tasks: Array<{
      severity: "blocker" | "warning" | "info";
      code: string;
      message: string;
    }> = [];
    for (const scope of scopes) {
      if (scope.status !== "active")
        tasks.push({
          severity: "blocker",
          code: "SCOPE_NOT_ACTIVE",
          message: `${scope.frameworkSlug} is not approved for use`,
        });
      if (!scope.officialSourceChecksum)
        tasks.push({
          severity: "warning",
          code: "SOURCE_NOT_CHECKSUMMED",
          message: `${scope.frameworkSlug} official source checksum is not recorded`,
        });
      if (scope.submissionDueAt && scope.submissionDueAt < new Date())
        tasks.push({
          severity: "blocker",
          code: "DEADLINE_PASSED",
          message: `${scope.frameworkSlug} submission deadline has passed`,
        });
      if (!requirements.some((item) => item.framework === scope.frameworkSlug))
        tasks.push({
          severity: "blocker",
          code: "REQUIREMENTS_MISSING",
          message: `${scope.frameworkSlug} has no published requirement mapping`,
        });
    }
    for (const requirement of requirements) {
      if (!requirement.ownerIds.length)
        tasks.push({
          severity: "blocker",
          code: "EVIDENCE_OWNER_MISSING",
          message: `${requirement.code} has no evidence owner`,
        });
      if (!requirement.reviewerIds.length)
        tasks.push({
          severity: "blocker",
          code: "EVIDENCE_REVIEWER_MISSING",
          message: `${requirement.code} has no independent reviewer`,
        });
    }
    for (const submission of submissions) {
      if (submission.evidenceValidUntil && submission.evidenceValidUntil < new Date()) {
        const requirement = requirements.find(
          (item) => String(item._id) === String(submission.requirementId),
        );
        tasks.push({
          severity: "warning",
          code: "EVIDENCE_EXPIRED",
          message: `Evidence for ${requirement?.code ?? "a mapped requirement"} has expired`,
        });
      }
    }
    const approvedRequirementIds = new Set(
      submissions
        .filter((item) => item.status === "approved")
        .map((item) => String(item.requirementId)),
    );
    const approved = approvedRequirementIds.size;
    return {
      setupRequired: false,
      setupStatus: setup.setupStatus,
      frameworks: scopes,
      tasks,
      summary: {
        frameworks: scopes.length,
        requirements: requirements.length,
        submissions: submissions.length,
        approved,
        readiness: requirements.length ? Math.round((approved / requirements.length) * 100) : 0,
      },
    };
  },

  createSnapshot: async (scopeId: string, actorId: string) => {
    const { scope } = await scopeOf(scopeId);
    if (scope.status !== "active")
      throw createError(409, "Only active framework scopes can be snapshotted");
    const allRequirements = await ComplianceRequirementModel.find({
      framework: scope.frameworkSlug,
      isActive: true,
    }).lean();
    const scopeDepartmentIds = new Set(scope.departmentIds.map(String));
    const scopeProgramIds = new Set(scope.programIds.map(String));
    const requirements = allRequirements.filter((item) => {
      const departmentMatches =
        !scopeDepartmentIds.size ||
        !item.departmentIds.length ||
        item.departmentIds.some((id) => scopeDepartmentIds.has(String(id)));
      const programmeMatches =
        scope.scopeType !== "programme" ||
        !item.applicablePrograms.length ||
        item.applicablePrograms.some((id) => scopeProgramIds.has(id));
      return departmentMatches && programmeMatches;
    });
    if (!requirements.length)
      throw createError(409, "Publish requirement mappings before creating a snapshot");
    const submissions = await ComplianceSubmissionModel.find({
      academicYear: scope.academicYear,
      requirementId: { $in: requirements.map((item) => item._id) },
      ...(scope.departmentIds.length ? { departmentId: { $in: scope.departmentIds } } : {}),
    }).lean();
    const framework = {
      frameworkSlug: scope.frameworkSlug,
      frameworkVersion: scope.frameworkVersion,
      authority: scope.authority,
      scopeType: scope.scopeType,
      campusIds: scope.campusIds,
      departmentIds: scope.departmentIds,
      programIds: scope.programIds,
      cycleType: scope.cycleType,
      cycleNumber: scope.cycleNumber,
      academicYear: scope.academicYear,
      officialSourceUrl: scope.officialSourceUrl,
      officialSourceChecksum: scope.officialSourceChecksum,
      trustState: scope.trustState,
    };
    const payload = { framework, requirements, submissions };
    const payloadHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    const year = new Date().getFullYear();
    const sequence = await nextSeq(`accreditation-snapshot-${year}`);
    return AccreditationSnapshotModel.create({
      snapshotNumber: `ACC-${year}-${String(sequence).padStart(7, "0")}`,
      frameworkSlug: scope.frameworkSlug,
      frameworkVersion: scope.frameworkVersion,
      academicYear: scope.academicYear,
      scope: {
        scopeType: scope.scopeType,
        campusIds: scope.campusIds,
        departmentIds: scope.departmentIds,
        programIds: scope.programIds,
      },
      payload,
      payloadHash,
      trustState: scope.trustState,
      preparedBy: actorId,
      approvedBy: scope.approvedBy,
    });
  },

  snapshots: () =>
    AccreditationSnapshotModel.find({}).select("-payload").sort({ createdAt: -1 }).lean(),
};
