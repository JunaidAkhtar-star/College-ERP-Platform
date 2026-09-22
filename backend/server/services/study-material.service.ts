import createError from "http-errors";
import { Types } from "mongoose";
import {
  curriculumRepository,
  sectionRepository,
  studyMaterialRepository,
  subjectRepository,
} from "../repositories";
import {
  StudyMaterialStatus,
  type IStudyMaterial,
  type MaterialType,
} from "../models/study-material.model";
import { TimetableModel } from "../models/timetable.model";
import { redisUtil } from "../utils/redis.util";

const SM_TTL = 180;
const MATERIAL_TYPES = new Set<MaterialType>(["pdf", "ppt", "video", "notes", "link", "other"]);

function safeHttpUrl(value: unknown, field: string): string | undefined {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw createError(400, `${field} must be a valid URL`);
  }
  if (!["http:", "https:"].includes(url.protocol))
    throw createError(400, `${field} must use HTTP or HTTPS`);
  return url.toString();
}

export function validateMaterialSource(
  materialType: MaterialType,
  rawFileUrl?: unknown,
  rawExternalLink?: unknown,
) {
  if (!MATERIAL_TYPES.has(materialType)) throw createError(400, "Invalid material type");
  const fileUrl = safeHttpUrl(rawFileUrl, "File URL");
  const externalLink = safeHttpUrl(rawExternalLink, "External link");
  if (materialType === "link" && !externalLink)
    throw createError(400, "Link materials require an external link");
  if (materialType !== "link" && !fileUrl && !externalLink)
    throw createError(400, "A file URL or external link is required");
  return { fileUrl, externalLink };
}

async function normalizeMaterial(
  data: Record<string, unknown>,
  uploaderId: string,
  requireTeaching: boolean,
  existing?: IStudyMaterial,
) {
  const subjectId = String(data.subjectId ?? existing?.subjectId ?? "");
  const rawSectionIds = data.sectionIds ?? existing?.sectionIds ?? [];
  const sectionIds = [
    ...new Set(Array.isArray(rawSectionIds) ? rawSectionIds.map(String) : [String(rawSectionIds)]),
  ].filter(Boolean);
  if (!Types.ObjectId.isValid(subjectId)) throw createError(400, "Valid subject is required");
  if (
    !sectionIds.length ||
    sectionIds.length > 20 ||
    sectionIds.some((id) => !Types.ObjectId.isValid(id))
  )
    throw createError(400, "Between 1 and 20 valid target sections are required");
  const [subject, sections] = await Promise.all([
    subjectRepository.findById(subjectId),
    sectionRepository.findRawByIds(sectionIds),
  ]);
  if (!subject?.isActive) throw createError(404, "Active subject not found");
  if (sections.length !== sectionIds.length) throw createError(404, "Target section not found");
  const first = sections[0]!;
  if (
    sections.some(
      (section) =>
        String(section.departmentId) !== String(first.departmentId) ||
        section.program !== first.program ||
        section.semesterNo !== first.semesterNo ||
        section.academicYear !== first.academicYear,
    )
  )
    throw createError(400, "All target sections must belong to the same class cohort");
  const curriculumIds = [...new Set(sections.map((section) => String(section.curriculumId)))];
  const curricula = await curriculumRepository.findByIds(curriculumIds);
  if (curricula.length !== curriculumIds.length)
    throw createError(400, "A target section curriculum is unavailable");
  const curriculaById = new Map(curricula.map((row) => [String(row._id), row]));
  for (const section of sections) {
    const curriculum = curriculaById.get(String(section.curriculumId));
    const semesterPlan = curriculum?.semesterPlans.find(
      (plan) => plan.semesterNo === section.semesterNo,
    );
    if (
      !curriculum?.isActive ||
      !semesterPlan?.subjects.some((row) => String(row.subjectId) === subjectId)
    )
      throw createError(400, "Subject is not assigned to every target section curriculum");
  }
  if (requireTeaching) {
    const teachingTimetables = await TimetableModel.find({
      isApproved: true,
      isActive: true,
      slots: { $elemMatch: { subjectId, facultyId: uploaderId } },
      $or: [
        { sectionId: { $in: sections.map((section) => section._id) } },
        {
          sectionId: { $exists: false },
          academicYear: first.academicYear,
          program: first.program,
          semester: first.semesterNo,
          $or: [
            { departmentId: first.departmentId },
            { branchDepartmentIds: first.departmentId },
            { "slots.branchDepartmentId": first.departmentId },
            { "slots.branchDepartmentIds": first.departmentId },
          ],
        },
      ],
    })
      .select("sectionId academicYear program semester departmentId branchDepartmentIds slots")
      .lean();
    const facultyCanTeachSection = (section: (typeof sections)[number]) =>
      teachingTimetables.some((timetable) => {
        if (timetable.sectionId) return String(timetable.sectionId) === String(section._id);
        if (
          timetable.academicYear !== section.academicYear ||
          timetable.program !== section.program ||
          timetable.semester !== section.semesterNo
        )
          return false;
        const slot = timetable.slots.find(
          (row) =>
            String(row.subjectId ?? "") === subjectId && String(row.facultyId ?? "") === uploaderId,
        );
        const departmentIds = [
          timetable.departmentId,
          ...(timetable.branchDepartmentIds ?? []),
          slot?.branchDepartmentId,
          ...(slot?.branchDepartmentIds ?? []),
        ]
          .filter(Boolean)
          .map(String);
        return departmentIds.includes(String(section.departmentId));
      });
    if (sections.some((section) => !facultyCanTeachSection(section)))
      throw createError(403, "Faculty may publish only to classes they teach");
  }
  const title = String(data.title ?? existing?.title ?? "").trim();
  if (title.length < 3 || title.length > 200)
    throw createError(400, "Material title must contain 3 to 200 characters");
  const materialType = String(data.materialType ?? existing?.materialType ?? "") as MaterialType;
  const { fileUrl, externalLink } = validateMaterialSource(
    materialType,
    data.fileUrl ?? existing?.fileUrl,
    data.externalLink ?? data.externalUrl ?? existing?.externalLink,
  );
  const tags = Array.isArray(data.tags)
    ? [...new Set(data.tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))]
    : (existing?.tags ?? []);
  if (tags.length > 20 || tags.some((tag) => tag.length > 50))
    throw createError(400, "At most 20 tags of 50 characters are allowed");
  const unitNo = data.unitNo === undefined ? existing?.unitNo : Number(data.unitNo);
  if (unitNo !== undefined && (!Number.isInteger(unitNo) || unitNo < 1 || unitNo > 20))
    throw createError(400, "Unit number must be between 1 and 20");
  return {
    ...data,
    title,
    description: data.description ? String(data.description).trim() : existing?.description,
    subjectId: subject._id,
    sectionIds: sections.map((section) => section._id),
    subjectCode: subject.code,
    departmentId: first.departmentId,
    program: first.program,
    semester: first.semesterNo,
    academicYear: first.academicYear,
    unitNo,
    materialType,
    fileUrl,
    externalLink,
    fileSize: data.fileSize === undefined ? existing?.fileSize : Number(data.fileSize),
    tags,
    uploadedBy: existing?.uploadedBy ?? uploaderId,
  };
}

async function invalidate(id?: string) {
  await Promise.all([
    id ? redisUtil.del(`studymat:${id}`) : Promise.resolve(),
    redisUtil.del("studymat:list:*"),
  ]);
}

function tenantDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export const studyMaterialService = {
  getAll: (filter: Record<string, unknown>, page: number, limit: number) => {
    const cacheKey = `studymat:list:${JSON.stringify(filter)}_p${page}_l${limit}`;
    return redisUtil.remember(cacheKey, SM_TTL, () =>
      studyMaterialRepository.list(filter, page, limit),
    );
  },

  getById: (id: string) =>
    redisUtil.remember(`studymat:${id}`, SM_TTL, () => studyMaterialRepository.findById(id)),

  create: async (data: Record<string, unknown>, uploaderId: string, requireTeaching: boolean) => {
    const normalized = await normalizeMaterial(data, uploaderId, requireTeaching);
    const result = await studyMaterialRepository.create({
      ...normalized,
      status: StudyMaterialStatus.DRAFT,
      isActive: false,
      version: 1,
      viewCount: 0,
      downloadCount: 0,
    });
    await invalidate();
    return result;
  },

  update: async (
    id: string,
    data: Record<string, unknown>,
    actorId: string,
    facultyOwned: boolean,
  ) => {
    const existing = (await studyMaterialRepository.findById(
      id,
    )) as unknown as IStudyMaterial | null;
    if (!existing) throw createError(404, "Study material not found");
    if (existing.status !== StudyMaterialStatus.DRAFT)
      throw createError(409, "Published and archived material versions are immutable");
    const normalized = (await normalizeMaterial(
      data,
      String(existing.uploadedBy),
      false,
      existing,
    )) as Record<string, unknown>;
    for (const field of [
      "_id",
      "status",
      "isActive",
      "version",
      "replacesMaterialId",
      "replacedByMaterialId",
      "publishedAt",
      "archivedAt",
      "archivedBy",
      "viewCount",
      "downloadCount",
      "createdAt",
      "updatedAt",
    ])
      delete normalized[field];
    normalized.updatedBy = actorId;
    const result = await studyMaterialRepository.updateDraft(
      id,
      normalized,
      facultyOwned ? actorId : undefined,
    );
    if (!result) throw createError(409, "Draft was concurrently changed or is not owned by you");
    await invalidate(id);
    return result;
  },

  createRevision: async (
    id: string,
    data: Record<string, unknown>,
    actorId: string,
    requireTeaching: boolean,
  ) => {
    const existing = (await studyMaterialRepository.findById(
      id,
    )) as unknown as IStudyMaterial | null;
    if (!existing) throw createError(404, "Study material not found");
    if (existing.status !== StudyMaterialStatus.PUBLISHED || existing.replacedByMaterialId)
      throw createError(409, "Only the current published version can be revised");
    const normalized = await normalizeMaterial(data, actorId, requireTeaching, existing);
    const revision = await studyMaterialRepository.create({
      ...normalized,
      uploadedBy: actorId,
      status: StudyMaterialStatus.DRAFT,
      isActive: false,
      version: existing.version + 1,
      replacesMaterialId: existing._id,
      replacedByMaterialId: undefined,
      publishedAt: undefined,
      archivedAt: undefined,
      archivedBy: undefined,
      viewCount: 0,
      downloadCount: 0,
    });
    await invalidate();
    return revision;
  },

  publish: async (id: string, facultyOwnerId?: string) => {
    const result = await studyMaterialRepository.publish(id, facultyOwnerId);
    if (!result) throw createError(409, "Only an owned draft can be published");
    await invalidate(id);
    if (result.replacesMaterialId) await invalidate(String(result.replacesMaterialId));
    return result;
  },

  archive: async (id: string, actorId: string, facultyOwnerId?: string) => {
    const result = await studyMaterialRepository.archive(id, actorId, facultyOwnerId);
    if (!result) throw createError(409, "Material is already archived or is not owned by you");
    await invalidate(id);
    return result;
  },

  delete: async (id: string, facultyOwnerId?: string) => {
    const result = await studyMaterialRepository.deleteUnusedDraft(id, facultyOwnerId);
    if (!result) throw createError(409, "Only an unused draft can be permanently deleted");
    await invalidate(id);
    return result;
  },

  trackAccess: async (id: string, userId: string, type: "view" | "download") => {
    const recorded = await studyMaterialRepository.recordAccess(id, userId, type, tenantDateKey());
    if (recorded) await invalidate(id);
    return recorded;
  },
};
