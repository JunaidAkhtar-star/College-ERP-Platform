import createError from "http-errors";
import { studentProfileRepository } from "../repositories";
import { pdfService } from "../pdf/pdf.service";
import { cryptoUtil } from "../utils/crypto.util";
import { csvUtil } from "../utils/csv.util";
import { StudentProfileModel, StudentStatus } from "../models/student-profile.model";
import {
  AdmissionApplicationModel,
  IDocumentChecklistItem,
} from "../models/admission-application.model";
import type { IStudentProfile } from "../models";
import { SemesterResultModel } from "../models/examination.model";
import { Types } from "mongoose";
import { BatchModel } from "../models/batch.model";
import { CurriculumModel } from "../models/curriculum.model";
import { nextSeq } from "../models/counter.model";
import { formatIndiaDate } from "../utils/date.util";

const ADMIN_UPDATE_FIELDS: (keyof IStudentProfile)[] = [
  "registrationNumber",
  "enrollmentNumber",
  "aadhaarNumber",
  "abcId",
  "firstName",
  "middleName",
  "lastName",
  "dateOfBirth",
  "gender",
  "bloodGroup",
  "nationality",
  "religion",
  "caste",
  "category",
  "isPhysicallyChallenged",
  "pcDisabilityType",
  "pcPercentage",
  "motherTongue",
  "maritalStatus",
  "passportNumber",
  "personalEmail",
  "collegeEmail",
  "phone",
  "whatsappPhone",
  "emergencyContactName",
  "emergencyContactRelationship",
  "emergencyContactPhone",
  "permanentAddress",
  "currentAddress",
  "program",
  "admissionType",
  "admissionCategory",
  "batch",
  "academicYear",
  "department",
  "section",
  "mentor",
  "classTeacher",
  "admissionDate",
  "status",
  "entranceExam",
  "entranceRank",
  "entranceScore",
  "parentInfo",
  "hasGapYear",
  "gapYearReason",
  "isLocalStudent",
  "remarks",
];

const studentStatusTransitions: Partial<Record<StudentStatus, StudentStatus[]>> = {
  [StudentStatus.ACTIVE]: [
    StudentStatus.DETAINED,
    StudentStatus.DROPPED,
    StudentStatus.TRANSFERRED,
    StudentStatus.RUSTICATED,
  ],
  [StudentStatus.DETAINED]: [StudentStatus.ACTIVE, StudentStatus.DROPPED, StudentStatus.RUSTICATED],
  [StudentStatus.LATERAL_PROMOTED]: [StudentStatus.ACTIVE, StudentStatus.DROPPED],
};

export function assertStudentStatusTransition(current: StudentStatus, next: StudentStatus) {
  if (current === next) return;
  if (!studentStatusTransitions[current]?.includes(next))
    throw createError(409, `Student status cannot change from ${current} to ${next}`);
}

export function redactStudentProfile<T extends Record<string, unknown>>(profile: T): T {
  const result = { ...profile };
  for (const field of [
    "aadhaarNumber",
    "abcId",
    "passportNumber",
    "permanentAddress",
    "currentAddress",
    "parentInfo",
    "feeRecords",
    "totalFeeDue",
    "totalFeePaid",
    "scholarships",
    "remarks",
    "documents",
    "admissionApplicationId",
  ])
    delete result[field];
  return result;
}

/** Encrypt aadhaarNumber before persisting; no-op if absent. */
function encryptAadhaar(data: Partial<IStudentProfile>): Partial<IStudentProfile> {
  const result = { ...data };
  if (data.aadhaarNumber) {
    result.aadhaarNumber = cryptoUtil.encrypt(data.aadhaarNumber);
  }
  if (data.parentInfo?.fatherAadhaar) {
    result.parentInfo = {
      ...data.parentInfo,
      fatherAadhaar: cryptoUtil.encrypt(data.parentInfo.fatherAadhaar),
    };
  }
  return result;
}

/** Decrypt aadhaarNumber on the way out; no-op if field absent or already plaintext. */
function decryptAadhaar<T extends Partial<IStudentProfile>>(profile: T): T {
  try {
    const decryptIdentityValue = (value: string) => {
      const normalized = value.replace(/\s/g, "");
      return /^\d{12}$/.test(normalized) ? normalized : cryptoUtil.decrypt(value);
    };
    return {
      ...profile,
      ...(profile.aadhaarNumber
        ? { aadhaarNumber: decryptIdentityValue(profile.aadhaarNumber) }
        : {}),
      ...(profile.parentInfo?.fatherAadhaar
        ? {
            parentInfo: {
              ...profile.parentInfo,
              fatherAadhaar: decryptIdentityValue(profile.parentInfo.fatherAadhaar),
            },
          }
        : {}),
    };
  } catch {
    throw createError(500, "Student identity data could not be decrypted");
  }
}

async function enrichFromApplication<T extends Partial<IStudentProfile>>(profile: T): Promise<T> {
  if (!profile || !profile.admissionApplicationId) return profile;

  const appId =
    typeof profile.admissionApplicationId === "object" && profile.admissionApplicationId !== null
      ? (profile.admissionApplicationId as { _id?: Types.ObjectId })._id
      : profile.admissionApplicationId;

  if (!appId) return profile;

  const appDoc = await AdmissionApplicationModel.findById(appId).lean();
  if (!appDoc) return profile;

  const updateSet: Record<string, unknown> = {};

  if (!profile.middleName && appDoc.candidateName) {
    const parts = appDoc.candidateName.trim().split(/\s+/);
    if (parts.length > 2) {
      profile.firstName = parts[0];
      profile.middleName = parts.slice(1, -1).join(" ");
      profile.lastName = parts[parts.length - 1];

      updateSet.firstName = profile.firstName;
      updateSet.middleName = profile.middleName;
      updateSet.lastName = profile.lastName;
    }
  }

  if ((!profile.documents || profile.documents.length === 0) && appDoc.documentChecklist?.length) {
    profile.documents = appDoc.documentChecklist.map((d: IDocumentChecklistItem) => ({
      docType: d.docType,
      originalSubmitted: Boolean(d.originalSubmitted),
      photocopySubmitted: Boolean(d.photocopySubmitted),
      verifiedBy: d.verifiedBy,
      verifiedAt: d.verifiedAt,
      uploadedFileUrl:
        d.uploadedFileUrl || (d.files && d.files.length > 0 ? d.files[0].url : undefined),
      uploadedFilePublicId:
        d.uploadedFilePublicId || (d.files && d.files.length > 0 ? d.files[0].publicId : undefined),
    }));

    updateSet.documents = profile.documents;
  }

  if (Object.keys(updateSet).length > 0 && profile._id) {
    await StudentProfileModel.updateOne({ _id: profile._id }, { $set: updateSet }).catch(() => {});
  }

  return profile;
}

export const studentProfileService = {
  create: async (data: Partial<IStudentProfile>, createdBy: string) => {
    if (data.rollNumber) {
      const exists = await studentProfileRepository.findByRollNumber(data.rollNumber);
      if (exists)
        throw createError(409, `Student with roll number ${data.rollNumber} already exists`);
    }
    return studentProfileRepository.create({
      ...encryptAadhaar(data),
      createdBy: new Types.ObjectId(createdBy),
    });
  },

  getById: async (id: string, includeSensitive = true) => {
    const profile = await studentProfileRepository.findById(id);
    if (!profile) throw createError(404, "Student profile not found");
    const output = includeSensitive
      ? decryptAadhaar(profile as Partial<IStudentProfile>)
      : redactStudentProfile(profile as unknown as Record<string, unknown>);
    return enrichFromApplication(output as Partial<IStudentProfile>);
  },

  getByUserId: async (userId: string) => {
    const profile = await studentProfileRepository.findByUserId(userId);
    if (!profile) throw createError(404, "Student profile not found");
    const output = decryptAadhaar(profile as Partial<IStudentProfile>);
    return enrichFromApplication(output);
  },

  getByRollNumber: async (rollNumber: string) => {
    const profile = await studentProfileRepository.findByRollNumber(rollNumber);
    if (!profile) throw createError(404, "Student profile not found");
    const output = decryptAadhaar(profile as Partial<IStudentProfile>);
    return enrichFromApplication(output);
  },

  list: async (query: Record<string, unknown>, page = 1, limit = 20, includeSensitive = false) => {
    const search = (query["search"] as string) || undefined;
    const filter: Record<string, unknown> = {};
    if (query["program"]) filter["program"] = query["program"];
    if (query["semester"]) filter["currentSemester"] = Number(query["semester"]);
    if (query["academicYear"]) filter["batch"] = query["academicYear"];
    if (query["status"]) filter["status"] = query["status"];
    if (query["department"]) filter["department"] = query["department"];
    const result = await studentProfileRepository.paginate(filter, {
      page,
      limit: Math.min(limit, 500),
      search,
    });
    const enrichedData = result.data.map((profile) => {
      return includeSensitive
        ? decryptAadhaar(profile as Partial<IStudentProfile>)
        : redactStudentProfile(profile as unknown as Record<string, unknown>);
    });
    return {
      ...result,
      data: enrichedData,
    };
  },

  update: async (id: string, data: Partial<IStudentProfile>, updatedBy: string) => {
    const current = await studentProfileRepository.findById(id);
    if (!current) throw createError(404, "Student profile not found");
    if (data.status) assertStudentStatusTransition(current.status, data.status);
    const coreChanged = ["program", "batch", "department"].some(
      (field) =>
        data[field as keyof IStudentProfile] !== undefined &&
        String(data[field as keyof IStudentProfile]) !==
          String(current[field as keyof typeof current]),
    );
    if (coreChanged && current.currentSemester > 1)
      throw createError(409, "Program, batch, and department are immutable after semester one");
    const patch: Partial<IStudentProfile> = {};
    for (const key of ADMIN_UPDATE_FIELDS)
      if (key in data)
        (patch as Record<string, unknown>)[key] = (data as Record<string, unknown>)[key];
    // Repair legacy admission-created profiles during their next governed update.
    // Older enrollment records may still contain the original 12-digit value.
    if (
      !("aadhaarNumber" in patch) &&
      current.aadhaarNumber &&
      /^\d{12}$/.test(current.aadhaarNumber.replace(/\s/g, ""))
    ) {
      patch.aadhaarNumber = current.aadhaarNumber.replace(/\s/g, "");
    }
    const updated = await studentProfileRepository.updateById(id, {
      ...encryptAadhaar(patch),
      updatedBy: new Types.ObjectId(updatedBy),
    });
    if (!updated) throw createError(404, "Student profile not found");
    return decryptAadhaar(updated as Partial<IStudentProfile>);
  },

  /**
   * AO / Admin sets the university (BPUT) registration number on an existing
   * student profile. Called after BPUT issues the official number, weeks
   * after enrollment. The ERP rollNumber (e.g. `26RE001`) is not touched.
   */
  setRegistrationNumber: async (id: string, registrationNumber: string, updatedBy: string) => {
    const trimmed = (registrationNumber ?? "").trim();
    if (!trimmed) throw createError(400, "Registration number is required");
    const duplicate = await studentProfileRepository.findByRegistrationNumber(trimmed);
    if (duplicate && duplicate._id.toString() !== id)
      throw createError(409, "Registration number is already assigned to another student");
    const updated = await studentProfileRepository.updateById(id, {
      registrationNumber: trimmed,
      updatedBy: new Types.ObjectId(updatedBy),
    } as Partial<IStudentProfile>);
    if (!updated) throw createError(404, "Student profile not found");
    return decryptAadhaar(updated as Partial<IStudentProfile>);
  },

  /**
   * Bulk export of student profiles as CSV (Excel-compatible). Honours the
   * same filter query as `list()` but bypasses pagination. Used by admin /
   * AO / HR / department leadership for offline review or reporting.
   */
  exportCsv: async (query: Record<string, string>) => {
    const filter: Record<string, unknown> = {};
    if (query["program"]) filter["program"] = query["program"];
    if (query["semester"]) filter["currentSemester"] = Number(query["semester"]);
    if (query["academicYear"]) filter["batch"] = query["academicYear"];
    if (query["status"]) filter["status"] = query["status"];
    if (query["department"]) filter["department"] = query["department"];

    const docs = await StudentProfileModel.find(filter)
      .populate("userId", "name email status")
      .populate("department", "name code")
      .lean()
      .exec();

    const rows = docs.map((s) => {
      const u = (s.userId as unknown as { name?: string; email?: string; status?: string }) ?? {};
      const d = (s.department as unknown as { code?: string; name?: string }) ?? {};
      return {
        rollNumber: s.rollNumber ?? "",
        registrationNumber: s.registrationNumber ?? "",
        name: u.name ?? `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim(),
        email: u.email ?? s.collegeEmail ?? "",
        phone: s.phone ?? "",
        program: s.program ?? "",
        department: d.code ?? "",
        batch: s.batch ?? "",
        semester: String(s.currentSemester ?? ""),
        section: s.section ?? "",
        gender: s.gender ?? "",
        category: s.category ?? "",
        admissionType: s.admissionType ?? "",
        admissionDate: s.admissionDate ? new Date(s.admissionDate).toISOString().slice(0, 10) : "",
        cgpa: s.currentCgpa !== null && s.currentCgpa !== undefined ? String(s.currentCgpa) : "",
        backlogs: String(s.totalBacklogs ?? 0),
        status: s.status ?? "",
        fatherName: s.parentInfo?.fatherName ?? "",
        fatherPhone: s.parentInfo?.fatherPhone ?? "",
        motherName: s.parentInfo?.motherName ?? "",
        motherPhone: s.parentInfo?.motherPhone ?? "",
      };
    });

    const headers = [
      "rollNumber",
      "registrationNumber",
      "name",
      "email",
      "phone",
      "program",
      "department",
      "batch",
      "semester",
      "section",
      "gender",
      "category",
      "admissionType",
      "admissionDate",
      "cgpa",
      "backlogs",
      "status",
      "fatherName",
      "fatherPhone",
      "motherName",
      "motherPhone",
    ];

    return { csv: csvUtil.serialize(headers, rows), count: rows.length };
  },

  /**
   * Self-service update for the logged-in student. Whitelists only fields the
   * student is allowed to edit; admin-controlled fields (rollNumber, program,
   * semester, department, fees, results, etc.) are stripped.
   */
  updateMyProfile: async (userId: string, data: Partial<IStudentProfile>) => {
    const profile = await studentProfileRepository.findByUserId(userId);
    if (!profile) throw createError(404, "Student profile not found");

    // Student-editable personal/contact fields ONLY.
    // Locked (admin-only — exam, finance, ABC, identity audit depend on these):
    //   rollNumber, registrationNumber, program, batch, semester, department,
    //   status, fees, results, scholarships,
    //   aadhaarNumber  -> DBT / admit-card ID match
    //   abcId          -> UGC ABC linkage / transcripts
    //   passportPhotoUrl -> admit card / ID card / mark sheets
    //   signatureUrl     -> answer scripts / certificates
    // Students must re-submit photo / signature / Aadhaar through the Documents
    // module so the admin can verify before they take effect.
    const ALLOWED: (keyof IStudentProfile)[] = [
      "middleName",
      "bloodGroup",
      "religion",
      "motherTongue",
      "maritalStatus",
      "personalEmail",
      "whatsappPhone",
      "emergencyContactName",
      "emergencyContactRelationship",
      "emergencyContactPhone",
      "permanentAddress",
      "currentAddress",
    ];
    const patch: Partial<IStudentProfile> = {};
    for (const key of ALLOWED) {
      if (key in data)
        (patch as Record<string, unknown>)[key as string] = (data as Record<string, unknown>)[
          key as string
        ];
    }

    const updated = await studentProfileRepository.updateById(
      (profile as { _id: { toString(): string } })._id.toString(),
      { ...patch, updatedBy: new Types.ObjectId(userId) },
    );
    if (!updated) throw createError(404, "Student profile not found");
    return decryptAadhaar(updated as Partial<IStudentProfile>);
  },

  delete: async (_id: string) => {
    throw createError(409, "Student records cannot be deleted; use a governed lifecycle status");
  },

  promoteSemester: async (id: string, updatedBy: string) => {
    const profile = await studentProfileRepository.findById(id);
    if (!profile) throw createError(404, "Student profile not found");
    if (![StudentStatus.ACTIVE, StudentStatus.LATERAL_PROMOTED].includes(profile.status))
      throw createError(409, "Only an active student can be promoted");
    const batch = await BatchModel.findOne({
      departmentId: profile.department,
      program: profile.program,
      admissionYear: Number.parseInt(profile.batch, 10),
    }).lean();
    if (!batch) throw createError(409, "Authoritative batch configuration is missing");
    const [curriculum, result] = await Promise.all([
      CurriculumModel.findById(batch.curriculumId).lean(),
      SemesterResultModel.findOne({
        studentId: profile.userId,
        semester: profile.currentSemester,
        result: "PASS",
        isPublished: true,
      }).lean(),
    ]);
    if (!curriculum) throw createError(409, "Authoritative curriculum is missing");
    if (profile.currentSemester >= curriculum.totalSemesters)
      throw createError(409, "Final-semester students must use the governed graduation workflow");
    if (!result)
      throw createError(409, "A published passing semester result is required before promotion");
    return studentProfileRepository.updateById(id, {
      currentSemester: profile.currentSemester + 1,
      currentYear: Math.ceil((profile.currentSemester + 1) / 2),
      updatedBy: new Types.ObjectId(updatedBy),
    } as Partial<IStudentProfile>);
  },

  // Dashboard stats
  getStats: async (filter: Record<string, unknown> = {}) => {
    const [byProgram, byStatus, total] = await Promise.all([
      StudentProfileModel.aggregate([
        { $match: filter },
        { $group: { _id: "$program", count: { $sum: 1 } } },
      ]),
      StudentProfileModel.aggregate([
        { $match: filter },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      StudentProfileModel.countDocuments(filter),
    ]);
    const counts = new Map<string, number>(
      byStatus.map((row: { _id: string; count: number }) => [row._id, row.count]),
    );
    return {
      total,
      active: counts.get(StudentStatus.ACTIVE) ?? 0,
      detained: counts.get(StudentStatus.DETAINED) ?? 0,
      passedOut: counts.get(StudentStatus.PASSED_OUT) ?? 0,
      byProgram,
      byStatus,
    };
  },

  generateBonafide: async (
    profileId: string,
    purpose: string,
    issuedBy: string,
    designation: string,
  ) => {
    const profile = (await studentProfileRepository.findById(
      profileId,
    )) as unknown as IStudentProfile & Record<string, string>;
    if (!profile) throw createError(404, "Student profile not found");

    const year = new Date().getFullYear();
    const seq = await nextSeq(`bonafide:${year}`);
    const department = profile.department as unknown as { code?: string; name?: string };
    const pdf = await pdfService.generateBonafide({
      certificateNumber: `BON-${year}-${String(seq).padStart(7, "0")}`,
      studentName: [profile.firstName, profile.middleName, profile.lastName]
        .filter(Boolean)
        .join(" "),
      fatherName: profile.parentInfo?.fatherName ?? "",
      rollNumber: profile.rollNumber || "",
      program: profile.program || "",
      branch: department.code ?? department.name ?? "",
      semester: profile.currentSemester || 1,
      academicYear: profile.batch || "",
      dateOfAdmission: profile.admissionDate ? formatIndiaDate(profile.admissionDate) : "",
      purpose,
      issuedBy,
      designation,
      issuedDate: formatIndiaDate(new Date()),
    });
    return pdf;
  },
};
