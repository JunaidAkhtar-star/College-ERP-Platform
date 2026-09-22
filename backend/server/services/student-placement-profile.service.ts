import createError from "http-errors";
import type { UploadedFile } from "express-fileupload";
import { studentPlacementProfileRepository } from "../repositories/student-placement-profile.repository";
import { placementApplicationRepository } from "../repositories/placement-application.repository";
import { uploadUtil } from "../utils/upload.util";
import { redisUtil } from "../utils/redis.util";
import { PlacementEligibilityStatus } from "../models/student-placement-profile.model";
import { StudentProfileModel, StudentStatus } from "../models/student-profile.model";
import { DepartmentModel } from "../models/department.model";

const CACHE_PREFIX = "tp:spp:";
const CACHE_TTL = 300;

const studentEditableFields = [
  "skills",
  "certifications",
  "projects",
  "internships",
  "personalEmail",
  "linkedinUrl",
  "githubUrl",
  "portfolioUrl",
] as const;

function normalizeStudentEditable(data: Record<string, unknown>) {
  const filtered: Record<string, unknown> = {};
  for (const key of studentEditableFields) {
    if (key in data) filtered[key] = data[key];
  }
  if ("personalEmail" in filtered) {
    const email = String(filtered.personalEmail ?? "")
      .trim()
      .toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw createError(400, "Enter a valid personal email address");
    filtered.personalEmail = email || undefined;
  }
  for (const key of ["linkedinUrl", "githubUrl", "portfolioUrl"] as const) {
    if (!(key in filtered)) continue;
    const value = String(filtered[key] ?? "").trim();
    if (!value) {
      filtered[key] = undefined;
      continue;
    }
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw createError(400, `${key} must be a complete HTTPS URL`);
    }
    if (url.protocol !== "https:" || url.username || url.password)
      throw createError(400, `${key} must be a safe HTTPS URL`);
    filtered[key] = url.toString();
  }
  if ("skills" in filtered) {
    if (!Array.isArray(filtered.skills) || filtered.skills.length > 50)
      throw createError(400, "Use at most 50 placement skills");
    const seen = new Set<string>();
    filtered.skills = filtered.skills.map((raw) => {
      if (!raw || typeof raw !== "object") throw createError(400, "Invalid skill entry");
      const entry = raw as Record<string, unknown>;
      const name = String(entry.name ?? "").trim();
      const proficiency = String(entry.proficiency ?? "");
      const normalized = name.toLowerCase();
      if (name.length < 2 || name.length > 80) throw createError(400, "Invalid skill name");
      if (seen.has(normalized)) throw createError(400, `Duplicate skill: ${name}`);
      if (!["beginner", "intermediate", "advanced", "expert"].includes(proficiency))
        throw createError(400, `Invalid proficiency for ${name}`);
      seen.add(normalized);
      return { name, proficiency };
    });
  }
  return filtered;
}

export const studentPlacementProfileService = {
  /** Get profile by studentId (used by student viewing their own profile). */
  getMyProfile: async (studentId: string) => {
    const profile = await studentPlacementProfileRepository.findByStudentId(studentId);
    if (!profile)
      throw createError(404, "Placement profile not found. Please complete your profile.");
    return profile;
  },

  /** Admin/coordinator view by profile ID. */
  getById: async (id: string) => {
    const cached = await redisUtil.get<
      ReturnType<typeof studentPlacementProfileRepository.findById>
    >(CACHE_PREFIX + id);
    if (cached) return cached;
    const profile = await studentPlacementProfileRepository.findById(id);
    if (!profile) throw createError(404, "Placement profile not found");
    await redisUtil.set(CACHE_PREFIX + id, profile, CACHE_TTL);
    return profile;
  },

  /** Create or return existing profile. */
  createProfile: async (studentId: string, data: Record<string, unknown>) => {
    const existing = await studentPlacementProfileRepository.findByStudentId(studentId);
    if (existing) throw createError(409, "Placement profile already exists. Use update instead.");
    const academic = await StudentProfileModel.findOne({
      userId: studentId,
      status: StudentStatus.ACTIVE,
    }).lean();
    if (!academic) throw createError(403, "An active student profile is required");
    const department = await DepartmentModel.findById(academic.department).lean();
    if (!department) throw createError(409, "Student department is unavailable");
    const name = [academic.firstName, academic.middleName, academic.lastName]
      .filter(Boolean)
      .join(" ");
    const editable = normalizeStudentEditable(data);
    return studentPlacementProfileRepository.create({
      ...editable,
      studentId,
      studentProfileId: academic._id,
      rollNumber: academic.rollNumber,
      name,
      program: academic.program,
      branch: department.code,
      batch: academic.batch,
      currentSemester: academic.currentSemester,
      cgpa: academic.currentCgpa ?? 0,
      activeBacklogs: academic.totalBacklogs,
      totalBacklogs: academic.totalBacklogs,
      eligibilityStatus: academic.isPlacementEligible
        ? PlacementEligibilityStatus.ELIGIBLE
        : PlacementEligibilityStatus.NOT_ELIGIBLE,
      isEligibleForPlacement: academic.isPlacementEligible,
      academicSyncedAt: new Date(),
      createdBy: studentId,
    });
  },

  /** Student updates their own profile (skills, certifications, projects). */
  updateProfile: async (studentId: string, data: Record<string, unknown>) => {
    // Strip fields students shouldn't update directly
    const filtered = normalizeStudentEditable(data);
    const updated = await studentPlacementProfileRepository.updateByStudentId(studentId, filtered);
    if (!updated) throw createError(404, "Placement profile not found");
    await redisUtil.delPattern(`${CACHE_PREFIX}*`);
    return updated;
  },

  /** Coordinator updates academic/eligibility fields. */
  adminUpdate: async (id: string, data: Record<string, unknown>) => {
    const profile = await studentPlacementProfileRepository.findById(id);
    if (!profile) throw createError(404, "Placement profile not found");
    const allowedFields = ["placementCoordinatorNote", "isHigherPackageSeeking"];
    const update = Object.fromEntries(
      Object.entries(data).filter(([key]) => allowedFields.includes(key)),
    );
    const updated = await studentPlacementProfileRepository.updateByStudentId(
      String(profile.studentId),
      update,
    );
    await redisUtil.del(`${CACHE_PREFIX}${id}`);
    return updated;
  },

  /** Upload resume. */
  uploadResume: async (studentId: string, file: UploadedFile) => {
    const profile = await studentPlacementProfileRepository.findByStudentId(studentId);
    if (!profile) throw createError(404, "Placement profile not found");

    if (profile.resumePublicId) {
      await uploadUtil.deleteFile(profile.resumePublicId);
    }

    const result = await uploadUtil.uploadDocument(file, "erp/resumes");
    const updated = await studentPlacementProfileRepository.updateByStudentId(studentId, {
      resumeUrl: result.url,
      resumePublicId: result.publicId,
      resumeUpdatedAt: new Date(),
    });
    await redisUtil.delPattern(`${CACHE_PREFIX}*`);
    return updated;
  },

  /** Recalculate eligibility based on drive criteria.
   *  Called by coordinator when they update CGPA/backlogs. */
  recalculateEligibility: async (
    studentId: string,
    opts: { minCgpa?: number; maxBacklogs?: number },
  ) => {
    const profile = await studentPlacementProfileRepository.findByStudentId(studentId);
    if (!profile) throw createError(404, "Placement profile not found");

    const academic = await StudentProfileModel.findOne({
      userId: studentId,
      status: StudentStatus.ACTIVE,
    }).lean();
    if (!academic) throw createError(409, "Active academic profile is unavailable");
    const minCgpa = opts.minCgpa ?? 0;
    const maxBacklogs = opts.maxBacklogs ?? Number.MAX_SAFE_INTEGER;
    const isEligible =
      academic.isPlacementEligible &&
      (academic.currentCgpa ?? 0) >= minCgpa &&
      academic.totalBacklogs <= maxBacklogs &&
      profile.eligibilityStatus !== PlacementEligibilityStatus.OPTED_OUT &&
      profile.eligibilityStatus !== PlacementEligibilityStatus.PLACED;

    const updated = await studentPlacementProfileRepository.updateByStudentId(studentId, {
      isEligibleForPlacement: isEligible,
      eligibilityStatus: isEligible
        ? PlacementEligibilityStatus.ELIGIBLE
        : PlacementEligibilityStatus.NOT_ELIGIBLE,
      cgpa: academic.currentCgpa ?? 0,
      activeBacklogs: academic.totalBacklogs,
      totalBacklogs: academic.totalBacklogs,
      currentSemester: academic.currentSemester,
      academicSyncedAt: new Date(),
    });
    return updated;
  },

  /** Bulk-load profiles for placement drive eligibility. */
  getEligibleStudentsForDrive: (
    programs: string[],
    branches: string[],
    batches: string[],
    minCgpa: number,
    maxBacklogs: number,
  ) =>
    studentPlacementProfileRepository.findEligibleByDriveCriteria(
      programs,
      branches,
      batches,
      minCgpa,
      maxBacklogs,
    ),

  /** Paginate all profiles (admin). */
  list: async (query: Record<string, unknown>, page = 1, limit = 20) => {
    const filter: Record<string, unknown> = {};
    if (query.batch) filter.batch = query.batch;
    if (query.program) filter.program = query.program;
    if (query.branch) filter.branch = query.branch;
    if (query.eligibilityStatus) filter.eligibilityStatus = query.eligibilityStatus;
    if (query.isEligibleForPlacement !== undefined)
      filter.isEligibleForPlacement = query.isEligibleForPlacement === "true";
    return studentPlacementProfileRepository.paginate(filter, page, limit);
  },

  /** Get placement statistics. */
  getStats: (batch?: string) => studentPlacementProfileRepository.getStats(batch),

  /** Get applications for a student. */
  getMyApplications: (studentId: string) => placementApplicationRepository.findByStudent(studentId),
};
