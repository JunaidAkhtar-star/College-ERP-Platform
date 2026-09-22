import createError from "http-errors";
import type { UploadedFile } from "express-fileupload";
import { NotificationType } from "../models/notification.model";
import { JobPostingStatus, JobType, type IJobPosting } from "../models/job-posting.model";
import type { IStudentPlacementProfile } from "../models/student-placement-profile.model";
import { jobPostingRepository } from "../repositories/job-posting.repository";
import { studentPlacementProfileRepository } from "../repositories/student-placement-profile.repository";
import { redisUtil } from "../utils/redis.util";
import { uploadUtil } from "../utils/upload.util";
import { notifyStudentsByClass } from "./helpers/notify.helper";
import { formatIndiaDate } from "../utils/date.util";

const CACHE_PREFIX = "tp:job:";
const CACHE_TTL = 300;
const MUTABLE_FIELDS = [
  "companyName",
  "companyWebsite",
  "companyDescription",
  "jobTitle",
  "jobType",
  "location",
  "isRemote",
  "description",
  "responsibilities",
  "requirements",
  "salaryMin",
  "salaryMax",
  "isSalaryDisclosed",
  "stipend",
  "eligiblePrograms",
  "eligibleBranches",
  "eligibleBatches",
  "minCgpa",
  "maxBacklogs",
  "graduationYear",
  "applyMode",
  "applicationDeadline",
  "externalApplyLink",
  "applyEmail",
] as const;

function cleanStrings(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
}

function optionalNumber(value: unknown, name: string, min: number, max?: number) {
  if (value === undefined || value === null || value === "") return undefined;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || (max !== undefined && number > max)) {
    throw createError(400, `${name} is invalid`);
  }
  return number;
}

function validHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeJobPosting(input: Record<string, unknown>, requirePublishable = false) {
  const data: Record<string, unknown> = {};
  for (const field of MUTABLE_FIELDS) if (field in input) data[field] = input[field];

  for (const field of ["companyName", "jobTitle", "location", "description"] as const) {
    const value = String(data[field] ?? "").trim();
    if (!value) throw createError(400, `${field} is required`);
    data[field] = value;
  }
  if (!Object.values(JobType).includes(data.jobType as JobType)) {
    throw createError(400, "A valid job type is required");
  }
  data.eligiblePrograms = cleanStrings(data.eligiblePrograms);
  data.eligibleBranches = cleanStrings(data.eligibleBranches);
  data.eligibleBatches = cleanStrings(data.eligibleBatches);
  data.minCgpa = optionalNumber(data.minCgpa, "Minimum CGPA", 0, 10);
  data.maxBacklogs = optionalNumber(data.maxBacklogs, "Maximum backlogs", 0);
  data.salaryMin = optionalNumber(data.salaryMin, "Minimum salary", 0);
  data.salaryMax = optionalNumber(data.salaryMax, "Maximum salary", 0);
  data.stipend = optionalNumber(data.stipend, "Stipend", 0);
  if (
    data.salaryMin !== undefined &&
    data.salaryMax !== undefined &&
    Number(data.salaryMin) > Number(data.salaryMax)
  ) {
    throw createError(400, "Minimum salary cannot exceed maximum salary");
  }

  const deadline = new Date(String(data.applicationDeadline ?? ""));
  if (Number.isNaN(deadline.getTime())) throw createError(400, "A valid deadline is required");
  if (requirePublishable && deadline <= new Date()) {
    throw createError(400, "Application deadline must be in the future");
  }
  data.applicationDeadline = deadline;
  const applyMode = data.applyMode === "internal" ? "internal" : "external";
  data.applyMode = applyMode;
  if (applyMode === "external") {
    const link = String(data.externalApplyLink ?? "").trim();
    const email = String(data.applyEmail ?? "")
      .trim()
      .toLowerCase();
    if (link && !validHttpUrl(link)) throw createError(400, "External application link is invalid");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw createError(400, "Application email is invalid");
    if (!link && !email)
      throw createError(400, "An external application link or email is required");
    data.externalApplyLink = link || undefined;
    data.applyEmail = email || undefined;
  } else {
    delete data.externalApplyLink;
  }
  const website = String(data.companyWebsite ?? "").trim();
  if (website && !validHttpUrl(website)) throw createError(400, "Company website is invalid");
  return data;
}

export function evaluateJobEligibility(
  posting: Pick<
    IJobPosting,
    | "eligiblePrograms"
    | "eligibleBranches"
    | "eligibleBatches"
    | "minCgpa"
    | "maxBacklogs"
    | "graduationYear"
  >,
  profile: Pick<
    IStudentPlacementProfile,
    | "program"
    | "branch"
    | "batch"
    | "cgpa"
    | "activeBacklogs"
    | "isEligibleForPlacement"
    | "resumeUrl"
  >,
) {
  const reasons: string[] = [];
  if (!profile.isEligibleForPlacement) reasons.push("Student is not placement eligible");
  if (posting.minCgpa !== undefined && profile.cgpa < posting.minCgpa)
    reasons.push(`Minimum CGPA is ${posting.minCgpa}`);
  if (posting.maxBacklogs !== undefined && profile.activeBacklogs > posting.maxBacklogs)
    reasons.push(`Maximum active backlogs is ${posting.maxBacklogs}`);
  if (posting.eligiblePrograms.length && !posting.eligiblePrograms.includes(profile.program))
    reasons.push("Program is not eligible");
  if (posting.eligibleBranches.length && !posting.eligibleBranches.includes(profile.branch))
    reasons.push("Branch is not eligible");
  if (posting.eligibleBatches.length && !posting.eligibleBatches.includes(profile.batch))
    reasons.push("Batch is not eligible");
  if (posting.graduationYear && !profile.batch.includes(String(posting.graduationYear)))
    reasons.push("Graduation year is not eligible");
  return { eligible: reasons.length === 0, reasons };
}

async function getEligibleProfile(studentId: string, posting: IJobPosting) {
  const profile = await studentPlacementProfileRepository.findByStudentId(studentId);
  if (!profile) throw createError(409, "Complete your placement profile before applying");
  const eligibility = evaluateJobEligibility(posting, profile);
  if (!eligibility.eligible) throw createError(403, eligibility.reasons.join(". "));
  return profile;
}

async function notifyEligibleStudents(posting: IJobPosting) {
  const branches = posting.eligibleBranches.length ? posting.eligibleBranches : [undefined];
  const programs = posting.eligiblePrograms.length ? posting.eligiblePrograms : [undefined];
  const deadline = formatIndiaDate(posting.applicationDeadline);
  for (const branch of branches) {
    for (const program of programs) {
      await notifyStudentsByClass(
        { branch, program },
        {
          title: `New job posting: ${posting.companyName}`,
          body: `${posting.jobTitle} is open until ${deadline}.`,
          type: NotificationType.PLACEMENT,
          actionUrl: "/student/job-posting",
        },
      );
    }
  }
}

export const jobPostingService = {
  stats: async () => {
    await jobPostingRepository.expireStalePostings();
    return jobPostingRepository.getStats();
  },
  list: async (query: Record<string, unknown>, page = 1, limit = 20, studentId?: string) => {
    await jobPostingRepository.expireStalePostings();
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.jobType) filter.jobType = query.jobType;
    if (query.batch) filter.eligibleBatches = query.batch;
    if (query.program) filter.eligiblePrograms = query.program;
    if (query.branch) filter.eligibleBranches = query.branch;
    if (studentId) {
      filter.status = JobPostingStatus.ACTIVE;
      filter.applicationDeadline = { $gte: new Date() };
    }
    const result = await jobPostingRepository.paginate(
      filter,
      page,
      Math.min(limit, 100),
      studentId,
    );
    if (!studentId) return result;
    const profile = await studentPlacementProfileRepository.findByStudentId(studentId);
    return {
      ...result,
      data: result.data.map((posting) => ({
        ...posting,
        ...(profile
          ? evaluateJobEligibility(posting, profile)
          : { eligible: false, reasons: ["Placement profile is missing"] }),
      })),
    };
  },

  getById: async (id: string, studentId?: string) => {
    const cacheKey = `${CACHE_PREFIX}${id}`;
    const cached = studentId ? undefined : await redisUtil.get<IJobPosting>(cacheKey);
    const posting = cached ?? (await jobPostingRepository.findById(id));
    if (!posting) throw createError(404, "Job posting not found");
    if (
      studentId &&
      (posting.status !== JobPostingStatus.ACTIVE || posting.applicationDeadline < new Date())
    )
      throw createError(404, "Job posting not found");
    if (studentId) {
      await jobPostingRepository.incrementView(id);
      const profile = await studentPlacementProfileRepository.findByStudentId(studentId);
      const eligibility = profile
        ? evaluateJobEligibility(posting as IJobPosting, profile)
        : { eligible: false, reasons: ["Placement profile is missing"] };
      const { interestedStudents, appliedStudents, ...safePosting } = posting;
      return {
        ...safePosting,
        ...eligibility,
        hasInterest: interestedStudents.some((value) => String(value) === studentId),
        hasApplied: appliedStudents.some((value) => String(value) === studentId),
      };
    }
    await redisUtil.set(cacheKey, posting, CACHE_TTL);
    return posting;
  },

  create: async (input: Record<string, unknown>, postedBy: string) =>
    jobPostingRepository.create({
      ...normalizeJobPosting(input),
      status: JobPostingStatus.DRAFT,
      postedBy,
      postedAt: new Date(),
    }),

  update: async (id: string, input: Record<string, unknown>) => {
    const current = await jobPostingRepository.findById(id);
    if (!current) throw createError(404, "Job posting not found");
    if (current.status !== JobPostingStatus.DRAFT)
      throw createError(409, "Only draft postings can be edited");
    const posting = await jobPostingRepository.updateById(
      id,
      normalizeJobPosting({ ...current, ...input }),
    );
    await redisUtil.del(`${CACHE_PREFIX}${id}`);
    return posting;
  },

  publish: async (id: string) => {
    const current = await jobPostingRepository.findById(id);
    if (!current) throw createError(404, "Job posting not found");
    normalizeJobPosting({ ...current }, true);
    const posting = await jobPostingRepository.transition(id, JobPostingStatus.DRAFT, {
      status: JobPostingStatus.ACTIVE,
      publishedAt: new Date(),
    });
    if (!posting) throw createError(409, "Posting is no longer a draft");
    await redisUtil.del(`${CACHE_PREFIX}${id}`);
    void notifyEligibleStudents(posting as IJobPosting);
    return posting;
  },

  close: async (id: string) => {
    const posting = await jobPostingRepository.transition(id, JobPostingStatus.ACTIVE, {
      status: JobPostingStatus.CLOSED,
      closedAt: new Date(),
    });
    if (!posting) throw createError(409, "Only an active posting can be closed");
    await redisUtil.del(`${CACHE_PREFIX}${id}`);
    return posting;
  },

  markInterest: async (id: string, studentId: string) => {
    const posting = await jobPostingRepository.findById(id);
    if (!posting) throw createError(404, "Job posting not found");
    await getEligibleProfile(studentId, posting as IJobPosting);
    const updated = await jobPostingRepository.markInterest(id, studentId, new Date());
    if (!updated) throw createError(409, "Posting is closed, expired, or already applied");
    await redisUtil.del(`${CACHE_PREFIX}${id}`);
    return { message: "Interest marked successfully" };
  },

  removeInterest: async (id: string, studentId: string) => {
    const posting = await jobPostingRepository.removeInterest(id, studentId);
    if (!posting) throw createError(404, "Job posting not found");
    await redisUtil.del(`${CACHE_PREFIX}${id}`);
    return { message: "Interest removed" };
  },

  markApplied: async (id: string, studentId: string) => {
    const posting = await jobPostingRepository.findById(id);
    if (!posting) throw createError(404, "Job posting not found");
    const profile = await getEligibleProfile(studentId, posting as IJobPosting);
    if (posting.applyMode === "internal" && !profile.resumeUrl)
      throw createError(409, "Upload a resume to your placement profile before applying");
    const updated = await jobPostingRepository.markApplied(id, studentId, new Date());
    if (!updated) throw createError(409, "Posting is closed, expired, or already applied");
    await redisUtil.del(`${CACHE_PREFIX}${id}`);
    return {
      message:
        posting.applyMode === "external"
          ? "External application acknowledgement recorded"
          : "Application submitted successfully",
      applyMode: posting.applyMode,
      externalApplyLink: posting.applyMode === "external" ? posting.externalApplyLink : undefined,
    };
  },

  uploadJD: async (id: string, file: UploadedFile) => {
    const current = await jobPostingRepository.findById(id);
    if (!current) throw createError(404, "Job posting not found");
    if (current.status !== JobPostingStatus.DRAFT)
      throw createError(409, "JD can only be changed while the posting is a draft");
    const result = await uploadUtil.uploadDocument(file, "erp/job-descriptions");
    const posting = await jobPostingRepository.updateById(id, {
      jobDescriptionFileUrl: result.url,
    });
    await redisUtil.del(`${CACHE_PREFIX}${id}`);
    return posting;
  },

  expireStale: () => jobPostingRepository.expireStalePostings(),
};
