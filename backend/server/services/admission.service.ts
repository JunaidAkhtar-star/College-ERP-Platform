import { NotFound, BadRequest, Conflict } from "http-errors";
import bcrypt from "bcryptjs";
import mongoose, { type ClientSession, type Types } from "mongoose";
import { admissionRepository } from "../repositories/admission.repository";
import { auditLogRepository } from "../repositories/audit-log.repository";
import { userRepository } from "../repositories/user.repository";
import { generateStudentRegNo } from "../utils/id.util";
import { SeatMatrixModel } from "../models/seat-matrix.model";
import {
  type AdmissionType,
  AdmissionApplicationModel,
  ApplicationStatus,
  DOCUMENT_REQUIREMENTS,
  type IAdmissionApplication,
  type IAcademicRecord,
  type IPaymentDetails,
  type PaymentMode,
  type EntranceExam,
} from "../models/admission-application.model";
import {
  StudentProfileModel,
  StudentStatus,
  HostelType,
  TransportMode,
} from "../models/student-profile.model";
import { DepartmentModel, DepartmentStatus } from "../models/department.model";
import { CurriculumModel } from "../models/curriculum.model";
import { UserModel, type IUser } from "../models/user.model";
import { Module } from "../constants/permissions";
import { SystemRole, ADMISSION_ROLES } from "../constants/roles";
import type { PaginationQuery } from "../types";
import type { Request } from "express";
import { emailService } from "../email/email.service";
import { logger } from "../utils/logger.util";
import { configs } from "../configs";
import { tenantAppBaseUrl } from "../utils/tenant-app-url.util";
import { uploadUtil } from "../utils/upload.util";
import { csvUtil } from "../utils/csv.util";
import { cryptoUtil } from "../utils/crypto.util";
import type { UploadedFile } from "express-fileupload";
import { notificationService } from "./notification.service";
import { randomBytes } from "node:crypto";
import {
  NotificationType,
  NotificationChannel,
  NotificationAudience,
} from "../models/notification.model";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function generateTempPassword(): string {
  return `${randomBytes(9).toString("base64url")}A1!`;
}

export function validateAdmissionAcademicRecords(
  records?: IAcademicRecord[],
  requiresDegree = false,
): void {
  if (!records || !Array.isArray(records)) throw new BadRequest("Academic records are required");
  const map = new Map<string, number>();
  for (const record of records) {
    if (record.level && record.yearOfPassing) {
      if (map.has(record.level)) {
        throw new BadRequest(`Only one ${record.level} academic record is allowed`);
      }
      map.set(record.level, Number(record.yearOfPassing));
    }
  }
  if (!map.has("10th") || !map.has("12th_or_diploma")) {
    throw new BadRequest("Both 10th and 12th / Diploma academic records are required");
  }
  if (requiresDegree) {
    if (!map.has("degree"))
      throw new BadRequest("A degree academic record is required for PG admission");
  }
  const yr10 = map.get("10th");
  const yr12 = map.get("12th_or_diploma");
  const yrDegree = map.get("degree");

  if (yr10 !== undefined && yr12 !== undefined) {
    if (yr12 <= yr10) {
      throw new BadRequest(
        "Passing year of Class 12th / Diploma must be greater than Class 10th passing year",
      );
    }
  }
  if (yr12 !== undefined && yrDegree !== undefined) {
    if (yrDegree <= yr12) {
      throw new BadRequest(
        "Passing year of Degree must be greater than Class 12th / Diploma passing year",
      );
    }
  }
  if (yr10 !== undefined && yrDegree !== undefined) {
    if (yrDegree <= yr10) {
      throw new BadRequest("Passing year of Degree must be greater than Class 10th passing year");
    }
  }
}

// ─── Notification helpers ────────────────────────────────────────────────────
// All admission state changes push real-time updates over Socket.IO (handled
// inside notificationService.create) plus persist an in-app row and queue an
// email when applicable. No mobile push — see socket.gateway pushNotification.

async function notifyApplicant(
  application: Pick<
    IAdmissionApplication,
    "enrolledUserId" | "candidateName" | "applicationNumber"
  >,
  title: string,
  body: string,
  opts: { withEmail?: boolean; actionUrl?: string } = {},
) {
  const userId = application.enrolledUserId as unknown as Types.ObjectId | undefined;
  if (!userId) return; // public submissions with no linked account
  try {
    await notificationService.create({
      title,
      body,
      type: NotificationType.ADMISSION,
      channels: opts.withEmail
        ? [NotificationChannel.IN_APP, NotificationChannel.EMAIL]
        : [NotificationChannel.IN_APP],
      audience: NotificationAudience.SPECIFIC_USER,
      targetUserIds: [String(userId)],
      actionUrl: opts.actionUrl ?? "/admission-portal",
      createdBy: String(userId),
      createdByName: "Admission Cell",
    });
  } catch (err) {
    logger.error("[Admission] notifyApplicant failed", { err, app: application.applicationNumber });
  }
}

async function notifyStaffByRoles(
  roles: SystemRole[],
  title: string,
  body: string,
  actionUrl: string,
  createdByUserId?: string | Types.ObjectId,
  createdByName = "Admission Cell",
) {
  try {
    const users = await UserModel.find({ roles: { $in: roles }, status: "active" })
      .select("_id")
      .lean();
    const ids = users.map((u) => String(u._id));
    if (!ids.length) return;
    await notificationService.create({
      title,
      body,
      type: NotificationType.ADMISSION,
      channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
      audience: NotificationAudience.SPECIFIC_USER,
      targetUserIds: ids,
      actionUrl,
      createdBy: createdByUserId ? String(createdByUserId) : ids[0],
      createdByName,
    });
  } catch (err) {
    logger.error("[Admission] notifyStaffByRoles failed", { err, roles });
  }
}

/**
 * Compute merit score — retained as advisory metadata only (no longer drives a
 * ranked merit-list workflow). Formula: 70% qualifying exam percentile + 30%
 * average academic marks.
 */
function computeMeritScore(application: Partial<IAdmissionApplication>): number {
  const qualPercentile = application.entranceExam?.percentile ?? 0;
  const records = application.academicRecords ?? [];
  const tenthRecord = records.find((r) => r.level === "10th");
  const higherRecord = records.find((r) => r.level === "12th_or_diploma" || r.level === "degree");
  const acadScore =
    ((higherRecord?.percentageOfMarks ?? 0) + (tenthRecord?.percentageOfMarks ?? 0)) / 2;
  return Math.round(qualPercentile * 0.7 + acadScore * 0.3);
}

const RESERVED_OR_SPECIAL_CATEGORIES = new Set<string>(["sc", "st", "obc", "sebc", "ph"]);

async function activeAdmissionPrograms(programs: string[]) {
  const unique = [...new Set(programs.map((program) => program.trim()).filter(Boolean))];
  if (!unique.length) throw new BadRequest("Select at least one programme");
  const curricula = await CurriculumModel.find({
    program: { $in: unique },
    isActive: true,
    openForAdmissions: true,
  })
    .select("program academicLevel regulationYear")
    .sort({ regulationYear: -1 })
    .lean();
  const latestByProgram = new Map<string, (typeof curricula)[number]>();
  for (const curriculum of curricula) {
    if (!latestByProgram.has(curriculum.program))
      latestByProgram.set(curriculum.program, curriculum);
  }
  const activeSet = new Set(latestByProgram.keys());
  const unavailable = unique.filter((program) => !activeSet.has(program));
  if (unavailable.length) {
    throw new BadRequest(
      `Programme is not configured as open for admission: ${unavailable.join(", ")}`,
    );
  }
  const missingLevel = [...latestByProgram.values()].filter((row) => !row.academicLevel);
  if (missingLevel.length) {
    throw new BadRequest(
      `Academic level is not configured for: ${missingLevel.map((row) => row.program).join(", ")}`,
    );
  }
  return [...latestByProgram.values()];
}

async function validatePreferredDepartment(
  preferredDepartmentId: Types.ObjectId | string | null | undefined,
  program: string | undefined,
) {
  if (!preferredDepartmentId) return;
  if (!program) throw new BadRequest("Select a programme before selecting a branch");
  if (!mongoose.isValidObjectId(preferredDepartmentId)) {
    throw new BadRequest("Selected branch is invalid");
  }
  const curricula = await CurriculumModel.find({
    program,
    isActive: true,
    openForAdmissions: true,
  }).distinct("_id");
  const department = await DepartmentModel.findOne({
    _id: preferredDepartmentId,
    status: DepartmentStatus.ACTIVE,
    $or: [{ programs: program }, { curriculumIds: { $in: curricula } }],
  })
    .select("_id")
    .lean();
  if (!department) {
    throw new BadRequest("Selected branch is not available for this programme");
  }
}

async function usesDegreeDocuments(application: Partial<IAdmissionApplication>): Promise<boolean> {
  const choices = [application.allocatedProgram, ...(application.programPreferences ?? [])].filter(
    (program): program is string => Boolean(program),
  );
  const curricula = await activeAdmissionPrograms(choices);
  return curricula.some((row) => ["postgraduate", "doctoral"].includes(row.academicLevel));
}

async function requiredDocumentRequirements(application: Partial<IAdmissionApplication>) {
  const isPg = await usesDegreeDocuments(application);
  const needsCategoryDocs = RESERVED_OR_SPECIAL_CATEGORIES.has(String(application.category ?? ""));
  return DOCUMENT_REQUIREMENTS.filter(
    (r) => r.mandatory && (!r.pgOnly || isPg) && (!r.casteOnly || needsCategoryDocs),
  );
}

function hasChecklistFile(item: unknown): boolean {
  const d = item as
    | {
        uploadedFileUrl?: string;
        files?: Array<unknown>;
      }
    | undefined;
  return Boolean(d?.uploadedFileUrl) || Boolean(d?.files?.length);
}

async function assertRequiredDocumentsUploaded(application: IAdmissionApplication): Promise<void> {
  const checklist = application.documentChecklist ?? [];
  const requirements = await requiredDocumentRequirements(application);
  const missing = requirements.filter((requirement) => {
    const item = checklist.find((d) => d?.docType === requirement.docType);
    return !hasChecklistFile(item);
  });

  if (missing.length) {
    throw new BadRequest(`Missing required document(s): ${missing.map((d) => d.label).join(", ")}`);
  }
}

async function assertDocumentsReadyForApproval(application: IAdmissionApplication): Promise<void> {
  await assertRequiredDocumentsUploaded(application);

  const checklist = application.documentChecklist ?? [];
  const requirements = await requiredDocumentRequirements(application);
  const requiredUnverified = requirements.filter((requirement) => {
    const item = checklist.find((d) => d?.docType === requirement.docType);
    return !item || item.status !== "verified";
  });
  const uploadedUnverified = checklist.filter(
    (d) => hasChecklistFile(d) && d.status !== "verified",
  );
  const names = new Set<string>([
    ...requiredUnverified.map((d) => d.label),
    ...uploadedUnverified.map((d) => d.docType.replace(/_/g, " ")),
  ]);

  if (names.size) {
    throw new BadRequest(
      `Cannot approve: document(s) still need verification: ${Array.from(names).join(", ")}`,
    );
  }
}

function assertPaymentReadyForEnrollment(application: IAdmissionApplication): void {
  const payment = application.paymentDetails;
  // Payment is optional during initial enrollment (students can pay fees post-enrollment).
  // Only block if a payment was explicitly rejected by finance.
  if (payment && payment.verificationStatus === "rejected") {
    throw new BadRequest("Payment was rejected and must be re-submitted before enrollment");
  }
}

function sanitizeApplicantPaymentDetails(
  paymentData: unknown,
): Pick<IPaymentDetails, "amountInNumber" | "transactionId" | "paidAt"> | undefined {
  if (!paymentData || typeof paymentData !== "object") return undefined;
  const raw = paymentData as {
    amountInNumber?: number | string;
    transactionId?: string;
    paidAt?: string | Date;
  };
  const hasPayment =
    raw.amountInNumber !== undefined || raw.transactionId !== undefined || raw.paidAt !== undefined;
  if (!hasPayment) return undefined;

  return {
    amountInNumber:
      raw.amountInNumber !== undefined && raw.amountInNumber !== ""
        ? Number(raw.amountInNumber)
        : undefined,
    transactionId: raw.transactionId?.trim() || undefined,
    paidAt: raw.paidAt ? new Date(raw.paidAt) : undefined,
  };
}

function buildApplicantDraftPatch(
  patch: Partial<IAdmissionApplication>,
): Partial<IAdmissionApplication> {
  const allowed: Partial<IAdmissionApplication> = {};
  const source = patch as Record<string, unknown>;
  const copy = <K extends keyof IAdmissionApplication>(key: K) => {
    if (source[key as string] !== undefined) {
      allowed[key] = patch[key] as never;
    }
  };

  copy("candidateName");
  copy("fatherName");
  copy("motherName");
  copy("guardianName");
  copy("dateOfBirth");
  copy("gender");
  copy("category");
  copy("religion");
  copy("nationality");
  copy("aadhaarNumber");
  copy("bloodGroup");
  copy("phone");
  copy("whatsappPhone");
  copy("parentPhone");
  copy("guardianPhone");
  copy("presentAddress");
  copy("permanentAddress");
  copy("entranceExam");
  copy("lastCollegeAttended");
  copy("admissionType");
  copy("programPreferences");
  copy("preferredDepartmentId");
  copy("academicRecords");
  copy("parentInfo");
  copy("declarationAccepted");
  copy("declarationAcceptedAt");

  const applicantPayment = sanitizeApplicantPaymentDetails(patch.paymentDetails);
  if (applicantPayment) {
    allowed.paymentDetails = {
      ...applicantPayment,
      verificationStatus: "pending",
      verificationRemarks: undefined,
      verifiedBy: undefined,
      verifiedAt: undefined,
    };
  }

  return allowed;
}

/**
 * Seed a StudentProfile from the enrolled admission record so a freshly
 * enrolled student has a complete profile immediately.
 */
async function seedStudentProfile(
  application: IAdmissionApplication,
  rollNumber: string,
  actorUser?: IUser,
  session?: ClientSession,
): Promise<void> {
  const userId = application.enrolledUserId as unknown as Types.ObjectId | undefined;
  if (!userId) throw new BadRequest("Cannot enroll: application is not linked to a user account");

  const exists = await StudentProfileModel.findOne({ userId })
    .select("_id")
    .session(session ?? null)
    .lean();
  if (exists) return;

  const creatorId = actorUser?._id ?? userId;

  const program = application.allocatedProgram;
  if (!program) throw new BadRequest("Cannot enroll: no program has been allocated");

  const curriculum = await CurriculumModel.findOne({ program, isActive: true })
    .select("_id")
    .session(session ?? null)
    .lean();

  const department = application.preferredDepartmentId
    ? await DepartmentModel.findOne({
        _id: application.preferredDepartmentId,
        status: DepartmentStatus.ACTIVE,
        ...(curriculum ? { curriculumIds: curriculum._id } : {}),
      })
        .select("_id")
        .session(session ?? null)
        .lean()
    : null;

  const nameParts = (application.candidateName?.trim() ?? "").split(/\s+/);
  const firstName = nameParts[0] || "Student";
  const middleName = nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : undefined;
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";
  const batchYear =
    (application.academicYear || "").split("-")[0] || String(new Date().getFullYear());

  const presentAddr = application.presentAddress;
  const toAddr = (a: typeof presentAddr | undefined) =>
    a
      ? {
          line1: a.line1,
          line2: (a as { line2?: string }).line2,
          city: a.city,
          district: (a as { district?: string }).district || a.city,
          state: a.state,
          pincode: a.pincode,
          country: a.country || "India",
        }
      : undefined;
  const permanentAddress = toAddr(application.permanentAddress ?? presentAddr);
  const currentAddress = toAddr(presentAddr);

  const academicRecords = (application.academicRecords ?? []).map((r) => ({
    level: (r.level === "degree" ? "graduation" : r.level) as
      | "10th"
      | "12th_or_diploma"
      | "graduation"
      | "post_graduation",
    examName: r.boardOrUniversity,
    boardOrUniversity: r.boardOrUniversity,
    instituteName: r.instituteName,
    passingYear: r.yearOfPassing,
    percentage: r.percentageOfMarks,
    verified: false,
  }));

  // Carry verified/uploaded docs from the admission checklist into the student
  // profile so the Documents tab is populated immediately on enrollment.
  const checklist = (application.documentChecklist ?? []) as Array<{
    docType: string;
    originalSubmitted?: boolean;
    photocopySubmitted?: boolean;
    status?: string;
    uploadedFileUrl?: string;
    uploadedFilePublicId?: string;
    files?: Array<{ url: string; publicId?: string }>;
    verifiedBy?: Types.ObjectId;
    verifiedAt?: Date;
  }>;
  const documents = checklist.map((d) => ({
    docType: d.docType,
    originalSubmitted: Boolean(d.originalSubmitted),
    photocopySubmitted: Boolean(d.photocopySubmitted),
    verifiedBy: d.verifiedBy,
    verifiedAt: d.verifiedAt,
    uploadedFileUrl: d.uploadedFileUrl || d.files?.[0]?.url,
    uploadedFilePublicId: d.uploadedFilePublicId || d.files?.[0]?.publicId,
  }));
  const passportDoc = checklist.find((d) => d.docType === "passport_photo");
  const passportPhotoUrl = passportDoc?.uploadedFileUrl || passportDoc?.files?.[0]?.url;
  const passportPhotoPublicId =
    passportDoc?.uploadedFilePublicId || passportDoc?.files?.[0]?.publicId;

  await StudentProfileModel.create(
    [
      {
        userId,
        admissionApplicationId: application._id,
        rollNumber,
        aadhaarNumber: application.aadhaarNumber
          ? cryptoUtil.encrypt(application.aadhaarNumber.replace(/\s/g, ""))
          : undefined,
        // registrationNumber (BPUT / university) is intentionally left blank —
        // AO adds it later via student-profile/:id/registration-number once the
        // affiliating university issues the official number.
        firstName,
        middleName,
        lastName,
        dateOfBirth: application.dateOfBirth,
        gender: application.gender,
        bloodGroup: application.bloodGroup,
        religion: application.religion,
        category: application.category,
        nationality: application.nationality || "Indian",
        isPhysicallyChallenged: application.category === "ph",
        collegeEmail: application.email,
        personalEmail: application.email,
        phone: application.phone,
        whatsappPhone: application.whatsappPhone,
        permanentAddress,
        currentAddress,
        program,
        admissionType: application.admissionType,
        admissionCategory: application.category,
        batch: batchYear,
        academicYear: application.academicYear,
        currentSemester: 1,
        currentYear: 1,
        department: department?._id,
        admissionDate: new Date(),
        status: StudentStatus.ACTIVE,
        entranceExam: application.entranceExam?.exam,
        entranceRank: application.entranceExam?.rank,
        entranceScore: application.entranceExam?.percentile,
        academicRecords,
        parentInfo: {
          fatherName: application.parentInfo?.fatherName || application.fatherName,
          fatherPhone:
            (application.parentInfo as { fatherPhone?: string })?.fatherPhone ||
            application.parentPhone ||
            application.phone,
          motherName: application.parentInfo?.motherName || application.motherName,
          motherPhone: (application.parentInfo as { motherPhone?: string })?.motherPhone,
        },
        totalBacklogs: 0,
        feeRecords: [],
        totalFeeDue: 0,
        totalFeePaid: 0,
        semesterResults: [],
        documents,
        passportPhotoUrl,
        passportPhotoPublicId,
        hasGapYear: false,
        isLocalStudent: false,
        createdBy: creatorId,
        updatedBy: creatorId,
        hostelDetails:
          application.onboardStatus === "hosteller"
            ? {
                hostelType:
                  application.gender === "male" ? HostelType.BOYS_HOSTEL : HostelType.GIRLS_HOSTEL,
              }
            : application.onboardStatus === "day_scholar"
              ? { hostelType: HostelType.DAY_SCHOLAR }
              : undefined,
        transportDetails:
          application.onboardStatus === "day_scholar" && application.transportOption
            ? {
                mode:
                  application.transportOption === "bus"
                    ? TransportMode.COLLEGE_BUS
                    : TransportMode.OWN,
              }
            : undefined,
      },
    ],
    { session },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

export const admissionService = {
  async listAdmissionPrograms() {
    const rows = await CurriculumModel.find({
      isActive: true,
      openForAdmissions: true,
      academicLevel: {
        $in: ["certificate", "diploma", "undergraduate", "postgraduate", "doctoral"],
      },
    })
      .select("program academicLevel totalSemesters regulationYear")
      .sort({ program: 1, regulationYear: -1 })
      .lean();
    const latest = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      if (!latest.has(row.program)) latest.set(row.program, row);
    }
    return [...latest.values()].map((row) => ({
      value: row.program,
      label: row.program,
      academicLevel: row.academicLevel,
      totalSemesters: row.totalSemesters,
    }));
  },
  async listSeatMatrix(academicYear: string) {
    const rows = await SeatMatrixModel.find({ academicYear }).sort({ program: 1 }).lean();
    return rows.map((row) => ({
      ...row,
      availableSeats: Math.max(0, row.totalSeats - row.allocatedSeats),
    }));
  },

  async upsertSeatMatrix(
    data: {
      program: string;
      academicYear: string;
      totalSeats: number;
      generalSeats: number;
      scSeats: number;
      stSeats: number;
      obcSeats: number;
      ewsSeats: number;
    },
    actorUser: IUser,
  ) {
    await activeAdmissionPrograms([data.program]);
    const bucketTotal =
      data.generalSeats + data.scSeats + data.stSeats + data.obcSeats + data.ewsSeats;
    if (bucketTotal !== data.totalSeats) {
      throw new BadRequest("Category seat buckets must equal total seats");
    }
    const reservedCount = await AdmissionApplicationModel.countDocuments({
      academicYear: data.academicYear,
      allocatedProgram: data.program,
      status: { $in: [ApplicationStatus.APPROVED, ApplicationStatus.ENROLLED] },
    });
    if (data.totalSeats < reservedCount) {
      throw new Conflict(`Total seats cannot be below ${reservedCount} existing reservations`);
    }
    const updated = await SeatMatrixModel.findOneAndUpdate(
      {
        program: data.program,
        academicYear: data.academicYear,
        allocatedSeats: { $lte: data.totalSeats },
      },
      {
        $set: {
          ...data,
          updatedBy: actorUser._id,
        },
        $max: { allocatedSeats: reservedCount },
      },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (updated) return updated;
    const existing = await SeatMatrixModel.exists({
      program: data.program,
      academicYear: data.academicYear,
    });
    if (existing) throw new Conflict("Seat capacity changed concurrently; reload and try again");
    return SeatMatrixModel.create({
      ...data,
      allocatedSeats: reservedCount,
      updatedBy: actorUser._id,
    });
  },

  /**
   * Public — submit a new application.
   */
  async submitApplication(data: Partial<IAdmissionApplication>, academicYear: string) {
    // Prevent duplicate applications per email per year
    if (!data.email) {
      throw new BadRequest("Email is required");
    }
    const existing = await admissionRepository.findByEmailAndAcademicYear(data.email, academicYear);
    if (existing) {
      throw new Conflict("An application for this email already exists for this academic year");
    }

    const selectedProgramme = data.programPreferences?.[0]?.trim();
    if (!selectedProgramme) throw new BadRequest("Select a configured programme before applying");
    const programmes = await activeAdmissionPrograms(data.programPreferences ?? []);
    validateAdmissionAcademicRecords(
      data.academicRecords,
      programmes.some((row) => ["postgraduate", "doctoral"].includes(row.academicLevel)),
    );

    const meritScore = computeMeritScore(data);

    const application = await admissionRepository.create({
      ...data,
      academicYear,
      applicationNumber: await generateStudentRegNo(
        (data.admissionType as "regular" | "lateral_entry") ?? "regular",
        academicYear,
        selectedProgramme,
      ),
      meritScore,
      status: ApplicationStatus.SUBMITTED,
      submittedAt: new Date(),
    });

    await notifyStaffByRoles(
      ADMISSION_ROLES,
      "New admission application",
      `${application.candidateName} submitted application ${application.applicationNumber}.`,
      `/admission/applications/${application._id}`,
      undefined,
      application.candidateName || "Admission Portal",
    );

    return application;
  },

  /**
   * Admin initiates an application: creates a DRAFT application + a user account
   * with its permanent ERP Student ID and a temporary password. Enrollment and
   * later university registration update this same identity; they never replace it.
   */
  async initiateApplication(
    data: {
      candidateName: string;
      email?: string;
      phone: string;
      academicYear: string;
      admissionType: AdmissionType;
      programPreference: string;
      preferredDepartmentId?: string | null;
      sendEmail?: boolean;
    },
    actorUser: IUser,
    req: Request,
  ) {
    const academicYear = data.academicYear;

    await activeAdmissionPrograms([data.programPreference]);
    await validatePreferredDepartment(data.preferredDepartmentId, data.programPreference);

    try {
      await AdmissionApplicationModel.collection.dropIndex("email_1_academicYear_1");
    } catch {
      // Legacy unique index may already be dropped
    }
    try {
      await UserModel.collection.dropIndex("email_1");
    } catch {
      // Legacy unique index may already be dropped
    }

    const studentId = await generateStudentRegNo(
      data.admissionType as "regular" | "lateral_entry",
      academicYear,
      data.programPreference,
    );
    const tempPassword = generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    const email = data.email?.trim().toLowerCase() || `${studentId.toLowerCase()}@noemail.local`;

    const newUser = await userRepository.create({
      name: data.candidateName,
      email,
      phone: data.phone,
      password: hashedPassword,
      roles: [SystemRole.STUDENT],
      studentId,
      status: "active",
      mustChangePassword: true,
    });

    const application = await new AdmissionApplicationModel({
      academicYear,
      // applicationNumber == ERP Student ID — one stable identity for this lifecycle.
      applicationNumber: studentId,
      candidateName: data.candidateName,
      email,
      phone: data.phone,
      admissionType: data.admissionType,
      programPreferences: [data.programPreference],
      preferredDepartmentId: data.preferredDepartmentId || null,
      status: ApplicationStatus.DRAFT,
      enrolledUserId: newUser._id as unknown as Types.ObjectId,
    }).save({ validateBeforeSave: false });

    const credentialsEmailRequested = Boolean(data.email && data.sendEmail !== false);
    if (credentialsEmailRequested) {
      const tenantBaseUrl = req?.tenantId
        ? await tenantAppBaseUrl(req.tenantId)
        : configs.FRONTEND_URL;
      const portalUrl = `${tenantBaseUrl}/admission-portal`;

      emailService
        .sendApplicantWelcome(
          email,
          data.candidateName,
          studentId,
          data.admissionType,
          data.programPreference,
          tempPassword,
          academicYear,
          portalUrl,
        )
        .catch((err: unknown) =>
          logger.error("[admission] Failed to send applicant credentials", err),
        );
    }

    await auditLogRepository.create({
      user: actorUser,
      action: "ADMISSION_INITIATED",
      module: Module.ADMISSION,
      targetId: application._id?.toString() ?? "",
      targetModel: "AdmissionApplication",
      description: `Initiated application ${application.applicationNumber} for ${data.candidateName} (${email}). ERP Student ID: ${studentId}`,
      req,
    });

    return {
      application,
      // Keep the response key for frontend/API compatibility. This is a permanent
      // ERP Student ID; only the generated password is temporary.
      tempStudentId: studentId,
      // Returned once to the authenticated administrator. Only the hash is persisted.
      tempPassword,
      credentialsEmailRequested,
    };
  },

  /**
   * Fetch the application linked to the currently logged-in applicant user.
   */
  async getMyApplication(userId: string | Types.ObjectId) {
    const application = await AdmissionApplicationModel.findOne({ enrolledUserId: userId })
      .lean()
      .exec();
    if (!application) throw new NotFound("No application found for this user");
    return application;
  },

  /**
   * Applicant updates their own application while it is still a DRAFT.
   * Email/applicationNumber/status/registrationNumber are not editable here.
   */
  async updateMyApplication(
    userId: string | Types.ObjectId,
    patch: Partial<IAdmissionApplication>,
  ) {
    const application = await AdmissionApplicationModel.findOne({ enrolledUserId: userId }).exec();
    if (!application) throw new NotFound("No application found for this user");
    if (application.status !== ApplicationStatus.DRAFT) {
      throw new BadRequest("Application can only be edited while in DRAFT state");
    }

    const allowed = buildApplicantDraftPatch(patch);
    await validatePreferredDepartment(
      patch.preferredDepartmentId === undefined
        ? application.preferredDepartmentId
        : patch.preferredDepartmentId,
      patch.programPreferences?.[0] ?? application.programPreferences?.[0],
    );

    Object.assign(application, allowed);
    application.meritScore = computeMeritScore(application as Partial<IAdmissionApplication>);
    // Drafts are intentionally partial — skip Mongoose required-field validation here.
    // Full validation runs on submit (submitMyApplication).
    await application.save({ validateBeforeSave: false });
    return application.toObject();
  },

  /**
   * Staff/Admin updates an application form by ID (on behalf of applicant or during processing).
   */
  async updateApplicationById(id: string | Types.ObjectId, patch: Partial<IAdmissionApplication>) {
    const application = await AdmissionApplicationModel.findById(id).exec();
    if (!application) throw new NotFound("Application not found");

    const allowed = buildApplicantDraftPatch(patch);
    await validatePreferredDepartment(
      patch.preferredDepartmentId === undefined
        ? application.preferredDepartmentId
        : patch.preferredDepartmentId,
      patch.programPreferences?.[0] ?? application.programPreferences?.[0],
    );
    Object.assign(application, allowed);
    if (patch.candidateName) application.candidateName = patch.candidateName;
    if (patch.phone) application.phone = patch.phone;
    if (patch.email) application.email = patch.email;

    const isSubmitting =
      patch.status === ApplicationStatus.SUBMITTED ||
      (patch as Record<string, unknown>).status === "submitted";

    if (isSubmitting) {
      application.status = ApplicationStatus.SUBMITTED;
      application.submittedAt = new Date();
      if (!application.declarationAccepted) {
        application.declarationAccepted = true;
        application.declarationAcceptedAt = new Date();
      }
    }

    application.meritScore = computeMeritScore(application as Partial<IAdmissionApplication>);

    if (isSubmitting) {
      const validationError = application.validateSync();
      if (validationError) {
        throw new BadRequest(validationError.message);
      }
      await application.save();
    } else {
      await application.save({ validateBeforeSave: false });
    }

    return application.toObject();
  },

  /**
   * Permanently delete an application, associated student user account, and Cloudinary files.
   */
  async deleteApplication(id: string | Types.ObjectId) {
    const application = await AdmissionApplicationModel.findById(id).exec();
    if (!application) throw new NotFound("Application not found");

    const publicIds: string[] = [];
    if (application.passportPhotoPublicId) {
      publicIds.push(application.passportPhotoPublicId);
    }
    if (application.paymentDetails?.screenshotPublicId) {
      publicIds.push(application.paymentDetails.screenshotPublicId);
    }
    if (Array.isArray(application.documentChecklist)) {
      for (const item of application.documentChecklist) {
        if (item.uploadedFilePublicId) publicIds.push(item.uploadedFilePublicId);
        if (Array.isArray(item.files)) {
          for (const f of item.files) {
            if (f.publicId) publicIds.push(f.publicId);
          }
        }
      }
    }

    for (const pid of publicIds) {
      uploadUtil
        .deleteFile(pid)
        .catch((err: unknown) =>
          logger.warn(`[admission] Failed to delete Cloudinary file ${pid}:`, err),
        );
    }

    if (application.enrolledUserId) {
      await userRepository.deleteById(application.enrolledUserId.toString());
    } else if (application.email) {
      const user = await userRepository.findByEmail(application.email);
      if (user) {
        await userRepository.deleteById(user._id.toString());
      }
    }

    await AdmissionApplicationModel.findByIdAndDelete(id).exec();
    return {
      success: true,
      message: "Application, candidate user, and documents permanently deleted.",
    };
  },

  /**
   * Applicant updates booking payment details after submission. Only applicant-
   * supplied payment fields are accepted; verification fields are always reset
   * to pending for staff review.
   */
  async updateMyPaymentInfo(
    userId: string | Types.ObjectId,
    paymentData: {
      amountInNumber?: number | string;
      transactionId?: string;
      paidAt?: string;
    },
    screenshotFile?: UploadedFile,
  ) {
    const application = await AdmissionApplicationModel.findOne({ enrolledUserId: userId }).exec();
    if (!application) throw new NotFound("No application found for this user");
    if (application.status !== ApplicationStatus.APPROVED) {
      throw new BadRequest("Payment details can be submitted only after admission approval");
    }

    const applicantPayment = sanitizeApplicantPaymentDetails(paymentData);
    if (!applicantPayment && !screenshotFile) {
      throw new BadRequest("Payment amount, transaction ID, date, or screenshot is required");
    }

    const currentDetails = application.paymentDetails || {};
    const nextDetails: IPaymentDetails = {
      ...currentDetails,
      ...applicantPayment,
      verificationStatus: "pending",
      verificationRemarks: undefined,
      verifiedBy: undefined,
      verifiedAt: undefined,
    };

    if (screenshotFile) {
      const uploaded = await uploadUtil.uploadDocument(screenshotFile, "erp/admission-payments");
      if (currentDetails.screenshotPublicId) {
        uploadUtil.deleteFile(currentDetails.screenshotPublicId).catch(() => undefined);
      }
      nextDetails.screenshotUrl = uploaded.url;
      nextDetails.screenshotPublicId = uploaded.publicId;
    }

    application.paymentDetails = nextDetails;
    await application.save({ validateBeforeSave: false });

    await notifyStaffByRoles(
      ADMISSION_ROLES,
      "Admission payment submitted",
      `${application.candidateName} submitted payment details for ${application.applicationNumber}.`,
      `/admission/applications/${application._id}`,
      userId,
      application.candidateName,
    );

    return application.toObject();
  },

  /**
   * Applicant submits their completed draft for processing (DRAFT -> SUBMITTED).
   */
  async submitMyApplication(userId: string | Types.ObjectId) {
    const application = await AdmissionApplicationModel.findOne({ enrolledUserId: userId }).exec();
    if (!application) throw new NotFound("No application found for this user");
    if (application.status !== ApplicationStatus.DRAFT) {
      throw new BadRequest("Application has already been submitted");
    }
    if (!application.declarationAccepted) {
      throw new BadRequest("You must accept the declaration before submitting");
    }

    const programmes = await activeAdmissionPrograms(application.programPreferences);
    validateAdmissionAcademicRecords(
      application.academicRecords,
      programmes.some((row) => ["postgraduate", "doctoral"].includes(row.academicLevel)),
    );

    application.status = ApplicationStatus.SUBMITTED;
    application.submittedAt = new Date();
    // The applicant has indicated the form is complete — run full validation now.
    const validationError = application.validateSync();
    if (validationError) {
      throw new BadRequest(validationError.message);
    }
    await assertRequiredDocumentsUploaded(application);
    await application.save();

    await notifyApplicant(
      application,
      "Application submitted",
      `Your application ${application.applicationNumber} has been received and is now under review. Please complete the Onboarding form (choose Hosteller or Day Scholar) in the Admission Portal to help us prepare your facilities.`,
      { withEmail: true },
    );
    await notifyStaffByRoles(
      ADMISSION_ROLES,
      "New admission application",
      `${application.candidateName} submitted application ${application.applicationNumber}.`,
      `/admission/applications/${application._id}`,
      userId,
      application.candidateName,
    );

    return application.toObject();
  },

  /**
   * Applicant uploads a single document for their draft application.
   * Multi-file: appends to the docType's `files` array (12th + diploma + multiple
   * certificates all live under one row). The legacy single-file fields mirror
   * the FIRST file for back-compat reads.
   */
  async uploadMyDocument(userId: string | Types.ObjectId, docType: string, file: UploadedFile) {
    const application = await AdmissionApplicationModel.findOne({ enrolledUserId: userId }).exec();
    if (!application) throw new NotFound("No application found for this user");

    // Allow uploads while DRAFT, OR while in review (UNDER_REVIEW /
    // legacy DOCUMENT_VERIFICATION) but only if a previously uploaded copy
    // of this docType was rejected by the reviewer.
    if (application.status === ApplicationStatus.DRAFT) {
      // ok — fresh draft, anything goes
    } else if (
      application.status === ApplicationStatus.UNDER_REVIEW ||
      application.status === ApplicationStatus.DOCUMENT_VERIFICATION
    ) {
      const existingItem = (application.documentChecklist ?? []).find(
        (d) => (d as { docType?: string })?.docType === docType,
      ) as { status?: string } | undefined;
      if (!existingItem || existingItem.status !== "rejected") {
        throw new BadRequest(
          "This document is not awaiting re-upload. Only rejected documents can be re-uploaded.",
        );
      }
    } else {
      throw new BadRequest("Documents cannot be uploaded at this stage");
    }

    const uploaded = await uploadUtil.uploadDocument(file, "erp/admissions");

    // Convert the entire existing checklist to plain objects up-front so we
    // never end up assigning a mix of Mongoose subdocs + plain objects back
    // to the array (which is what was dropping `docType` on save).
    type ChecklistItem = IAdmissionApplication["documentChecklist"][number];
    const toPlain = (d: unknown): Record<string, unknown> => {
      if (!d) return {};
      const maybe = d as { toObject?: () => Record<string, unknown> };
      return typeof maybe.toObject === "function"
        ? maybe.toObject()
        : (d as Record<string, unknown>);
    };
    const rawList = (application.documentChecklist ?? []).map(toPlain);

    // Self-heal: purge entries with missing/empty docType (residue from an
    // earlier persistence bug). Delete their Cloudinary files best-effort.
    const orphaned = rawList.filter((d) => !d.docType);
    for (const o of orphaned) {
      const files = (o.files as Array<{ publicId?: string }>) ?? [];
      for (const f of files) {
        if (f?.publicId) uploadUtil.deleteFile(f.publicId).catch(() => undefined);
      }
      if (typeof o.uploadedFilePublicId === "string") {
        uploadUtil.deleteFile(o.uploadedFilePublicId).catch(() => undefined);
      }
    }
    const existing = rawList.filter((d) => !!d.docType);
    const idx = existing.findIndex((d) => d.docType === docType);

    const newFile = {
      url: uploaded.url,
      publicId: uploaded.publicId,
      name: file.name,
      mimeType: file.mimetype,
      size: file.size,
      uploadedAt: new Date(),
    };

    let item: Record<string, unknown>;
    if (idx >= 0) {
      const current = existing[idx];
      const files = [...((current.files as (typeof newFile)[]) ?? []), newFile];
      const wasRejected = current.status === "rejected" || Boolean(current.previouslyRejected);
      item = {
        ...current,
        docType,
        files,
        // Soft-copy is automatically considered submitted whenever a file is uploaded.
        photocopySubmitted: true,
        // Re-upload clears any prior rejection so the reviewer sees it as pending again.
        status: "pending",
        rejectionReason: undefined,
        // Remember if this doc was previously rejected so the reviewer sees "Reverify".
        previouslyRejected: wasRejected,
        uploadedFileUrl: files[0]?.url,
        uploadedFilePublicId: files[0]?.publicId,
      };
      existing[idx] = item;
    } else {
      item = {
        docType,
        originalSubmitted: false,
        // Soft-copy is automatically considered submitted when a file is uploaded.
        photocopySubmitted: true,
        status: "pending",
        files: [newFile],
        uploadedFileUrl: newFile.url,
        uploadedFilePublicId: newFile.publicId,
      };
      existing.push(item);
    }

    application.documentChecklist = existing as unknown as ChecklistItem[];
    application.markModified("documentChecklist");
    await application.save({ validateBeforeSave: false });

    // Return a plain object — never the raw Mongoose subdoc (avoids leaking
    // `__parentArray`, `$__parent`, `_doc`, etc. into the API response).
    return item;
  },

  /**
   * Applicant removes a previously uploaded document from their draft.
   * If `publicId` is provided, removes only that single file from the docType's
   * `files` array. Otherwise clears every file under the docType.
   */
  async deleteMyDocument(userId: string | Types.ObjectId, docType: string, publicId?: string) {
    const application = await AdmissionApplicationModel.findOne({ enrolledUserId: userId }).exec();
    if (!application) throw new NotFound("No application found for this user");
    if (application.status !== ApplicationStatus.DRAFT) {
      throw new BadRequest("Documents can only be removed while application is in DRAFT");
    }
    const rawList = application.documentChecklist ?? [];
    // Self-heal: drop entries with missing docType (legacy bad data).
    const orphaned = rawList.filter((d) => !d?.docType);
    if (orphaned.length) {
      for (const o of orphaned) {
        for (const f of o.files ?? []) {
          if (f?.publicId) uploadUtil.deleteFile(f.publicId).catch(() => undefined);
        }
        if (o.uploadedFilePublicId) {
          uploadUtil.deleteFile(o.uploadedFilePublicId).catch(() => undefined);
        }
      }
    }
    const list = rawList.filter((d) => !!d?.docType);
    const idx = list.findIndex((d) => d.docType === docType);
    if (idx < 0) {
      // No matching docType — but we still cleaned up orphans, so persist that.
      application.documentChecklist = list;
      application.markModified("documentChecklist");
      await application.save({ validateBeforeSave: false });
      throw new NotFound("Document not found");
    }

    const item = list[idx];
    const currentFiles = item.files ?? [];
    let removedPublicIds: string[];
    let remainingFiles: typeof currentFiles;

    if (publicId) {
      remainingFiles = currentFiles.filter((f) => f.publicId !== publicId);
      removedPublicIds = currentFiles.filter((f) => f.publicId === publicId).map((f) => f.publicId);
      if (removedPublicIds.length === 0) throw new NotFound("File not found");
    } else {
      removedPublicIds = currentFiles.map((f) => f.publicId);
      // Legacy fallback
      if (!removedPublicIds.length && item.uploadedFilePublicId) {
        removedPublicIds = [item.uploadedFilePublicId];
      }
      remainingFiles = [];
    }

    item.files = remainingFiles;
    item.uploadedFileUrl = remainingFiles[0]?.url;
    item.uploadedFilePublicId = remainingFiles[0]?.publicId;
    list[idx] = item;
    application.documentChecklist = list;
    await application.save({ validateBeforeSave: false });

    for (const pid of removedPublicIds) {
      uploadUtil.deleteFile(pid).catch(() => undefined);
    }
    return { docType, files: remainingFiles };
  },

  async uploadApplicationDocument(applicationId: string, docType: string, file: UploadedFile) {
    const application = await AdmissionApplicationModel.findById(applicationId).exec();
    if (!application) throw new NotFound("Application not found");

    const uploaded = await uploadUtil.uploadDocument(file, "erp/admissions");

    type ChecklistItem = IAdmissionApplication["documentChecklist"][number];
    const toPlain = (d: unknown): Record<string, unknown> => {
      if (!d) return {};
      const maybe = d as { toObject?: () => Record<string, unknown> };
      return typeof maybe.toObject === "function"
        ? maybe.toObject()
        : (d as Record<string, unknown>);
    };
    const rawList = (application.documentChecklist ?? []).map(toPlain);
    const existing = rawList.filter((d) => !!d.docType);
    const idx = existing.findIndex((d) => d.docType === docType);

    const newFile = {
      url: uploaded.url,
      publicId: uploaded.publicId,
      name: file.name,
      mimeType: file.mimetype,
      size: file.size,
      uploadedAt: new Date(),
    };

    let item: Record<string, unknown>;
    if (idx >= 0) {
      const current = existing[idx];
      const files = [...((current.files as (typeof newFile)[]) ?? []), newFile];
      item = {
        ...current,
        docType,
        files,
        photocopySubmitted: true,
        status: "pending",
        rejectionReason: undefined,
        uploadedFileUrl: files[0]?.url,
        uploadedFilePublicId: files[0]?.publicId,
      };
      existing[idx] = item;
    } else {
      item = {
        docType,
        originalSubmitted: false,
        photocopySubmitted: true,
        status: "pending",
        files: [newFile],
        uploadedFileUrl: newFile.url,
        uploadedFilePublicId: newFile.publicId,
      };
      existing.push(item);
    }

    application.documentChecklist = existing as unknown as ChecklistItem[];
    application.markModified("documentChecklist");
    await application.save({ validateBeforeSave: false });

    return item;
  },

  async deleteApplicationDocument(applicationId: string, docType: string, publicId?: string) {
    const application = await AdmissionApplicationModel.findById(applicationId).exec();
    if (!application) throw new NotFound("Application not found");

    const rawList = application.documentChecklist ?? [];
    const list = rawList.filter((d) => !!d?.docType);
    const idx = list.findIndex((d) => d.docType === docType);
    if (idx < 0) {
      throw new NotFound("Document not found");
    }

    const item = list[idx];
    const currentFiles = item.files ?? [];
    let removedPublicIds: string[];
    let remainingFiles: typeof currentFiles;

    if (publicId) {
      remainingFiles = currentFiles.filter((f) => f.publicId !== publicId);
      removedPublicIds = currentFiles.filter((f) => f.publicId === publicId).map((f) => f.publicId);
      if (removedPublicIds.length === 0) throw new NotFound("File not found");
    } else {
      removedPublicIds = currentFiles.map((f) => f.publicId);
      if (!removedPublicIds.length && item.uploadedFilePublicId) {
        removedPublicIds = [item.uploadedFilePublicId];
      }
      remainingFiles = [];
    }

    item.files = remainingFiles;
    item.uploadedFileUrl = remainingFiles[0]?.url;
    item.uploadedFilePublicId = remainingFiles[0]?.publicId;
    list[idx] = item;
    application.documentChecklist = list;
    await application.save({ validateBeforeSave: false });

    for (const pid of removedPublicIds) {
      uploadUtil.deleteFile(pid).catch(() => undefined);
    }
    return { docType, files: remainingFiles };
  },

  async updateBookingPayment(
    applicationId: string,
    paymentData: {
      amountInNumber?: number;
      transactionId?: string;
      paidAt?: string;
    },
    actorUser: IUser,
    req: Request,
  ) {
    return this.updatePaymentInfo(applicationId, paymentData, undefined, actorUser, req);
  },

  async updatePaymentInfo(
    applicationId: string,
    paymentData: {
      amountInNumber?: number | string;
      amountInWords?: string;
      receiptNo?: string;
      receiptDate?: string;
      paymentMode?: string;
      transactionId?: string;
      paidAt?: string;
    },
    screenshotFile: UploadedFile | undefined,
    actorUser: IUser,
    req: Request,
  ) {
    const application = await admissionRepository.findById(applicationId);
    if (!application) throw new NotFound("Application not found");
    if (application.status !== ApplicationStatus.APPROVED) {
      throw new BadRequest("Payment details can be updated only for an approved application");
    }

    const currentDetails = application.paymentDetails || {};
    const nextDetails: IPaymentDetails = {
      ...currentDetails,
    };

    if (paymentData.amountInNumber !== undefined && paymentData.amountInNumber !== "") {
      nextDetails.amountInNumber = Number(paymentData.amountInNumber);
    }
    if (paymentData.amountInWords !== undefined) {
      nextDetails.amountInWords = paymentData.amountInWords;
    }
    if (paymentData.receiptNo !== undefined) {
      nextDetails.receiptNo = paymentData.receiptNo;
    }
    if (paymentData.receiptDate) {
      nextDetails.receiptDate = new Date(paymentData.receiptDate);
    }
    if (paymentData.paymentMode) {
      nextDetails.paymentMode = paymentData.paymentMode as PaymentMode;
    }
    if (paymentData.transactionId !== undefined) {
      nextDetails.transactionId = paymentData.transactionId;
    }
    if (paymentData.paidAt) {
      nextDetails.paidAt = new Date(paymentData.paidAt);
    }
    if (screenshotFile) {
      const uploaded = await uploadUtil.uploadDocument(screenshotFile, "erp/admission-payments");
      if (currentDetails.screenshotPublicId) {
        uploadUtil.deleteFile(currentDetails.screenshotPublicId).catch(() => undefined);
      }
      nextDetails.screenshotUrl = uploaded.url;
      nextDetails.screenshotPublicId = uploaded.publicId;
    }
    const changedPayment =
      paymentData.amountInNumber !== undefined ||
      paymentData.amountInWords !== undefined ||
      paymentData.receiptNo !== undefined ||
      paymentData.receiptDate !== undefined ||
      paymentData.paymentMode !== undefined ||
      paymentData.transactionId !== undefined ||
      paymentData.paidAt !== undefined ||
      Boolean(screenshotFile);
    if (changedPayment) {
      nextDetails.verificationStatus = "pending";
      nextDetails.verificationRemarks = undefined;
      nextDetails.verifiedBy = undefined;
      nextDetails.verifiedAt = undefined;
      if (!nextDetails.collectedBy) {
        nextDetails.collectedBy = actorUser._id;
        nextDetails.collectedAt = new Date();
      }
    }

    const updated = await admissionRepository.updateById(applicationId, {
      paymentDetails: nextDetails,
    });

    await auditLogRepository.create({
      user: actorUser,
      action: "ADMISSION_PAYMENT_UPDATED",
      module: Module.ADMISSION,
      targetId: applicationId,
      targetModel: "AdmissionApplication",
      description: `Booking payment details updated for ${application.applicationNumber} by verification cell`,
      req,
    });

    return updated;
  },

  async reviewPaymentInfo(
    applicationId: string,
    action: "approve" | "reject",
    remarks: string | undefined,
    actorUser: IUser,
    req: Request,
  ) {
    const application = await admissionRepository.findById(applicationId);
    if (!application) throw new NotFound("Application not found");
    if (application.status !== ApplicationStatus.APPROVED) {
      throw new BadRequest("Payment can be reviewed only for an approved application");
    }
    const payment = application.paymentDetails;
    if (!payment?.amountInNumber || payment.amountInNumber <= 0) {
      throw new BadRequest("Payment amount must be recorded before review");
    }
    if (!payment.receiptNo && !payment.transactionId) {
      throw new BadRequest("Receipt number or transaction ID is required before payment review");
    }
    if (!payment.receiptDate && !payment.paidAt) {
      throw new BadRequest("Receipt date or payment date is required before payment review");
    }
    if (action === "reject" && !remarks?.trim()) {
      throw new BadRequest("Remarks are required when rejecting payment");
    }

    await admissionRepository.updateById(applicationId, {
      paymentDetails: {
        ...payment,
        verificationStatus: action === "approve" ? "verified" : "rejected",
        verificationRemarks: remarks?.trim(),
        verifiedBy: actorUser._id,
        verifiedAt: new Date(),
      },
    });

    const updated = await admissionRepository.findById(applicationId);

    await auditLogRepository.create({
      user: actorUser,
      action: action === "approve" ? "ADMISSION_PAYMENT_VERIFIED" : "ADMISSION_PAYMENT_REJECTED",
      module: Module.ADMISSION,
      targetId: applicationId,
      targetModel: "AdmissionApplication",
      description: `Admission payment ${action === "approve" ? "verified" : "rejected"} for ${application.applicationNumber}`,
      metadata: { remarks },
      req,
    });

    await notifyApplicant(
      application,
      action === "approve" ? "Payment verified" : "Payment needs attention",
      action === "approve"
        ? `Your admission payment for application ${application.applicationNumber} has been verified.`
        : `Your admission payment for application ${application.applicationNumber} needs correction. Remarks: ${remarks}`,
      { withEmail: true },
    );

    return updated;
  },

  /**
   * Get a single application.
   */
  async getApplication(id: string) {
    const application = await admissionRepository.findById(id);
    if (!application) throw new NotFound("Application not found");
    return application;
  },

  /**
   * Get application by application number.
   */
  async getByApplicationNumber(applicationNumber: string) {
    const application = await admissionRepository.findByApplicationNumber(applicationNumber);
    if (!application) throw new NotFound("Application not found");
    return application;
  },

  /**
   * List applications with filter & pagination.
   */
  async listApplications(query: PaginationQuery, filter: Record<string, unknown> = {}) {
    return admissionRepository.paginate(filter, query);
  },

  /**
   * Admission staff (AO/AOO/Admission Incharge) moves a submitted application
   * into UNDER_REVIEW so individual documents can be checklist-verified before
   * the final approve/reject decision.
   */
  async startReview(applicationId: string, actorUser: IUser, req: Request) {
    const application = await admissionRepository.findById(applicationId);
    if (!application) throw new NotFound("Application not found");

    if (application.status !== ApplicationStatus.SUBMITTED) {
      throw new BadRequest("Application is not in SUBMITTED state");
    }

    const updated = await admissionRepository.updateStatus(
      applicationId,
      ApplicationStatus.UNDER_REVIEW,
    );

    await auditLogRepository.create({
      user: actorUser,
      action: "ADMISSION_REVIEW_STARTED",
      module: Module.ADMISSION,
      targetId: applicationId,
      targetModel: "AdmissionApplication",
      description: `Review started for application ${application.applicationNumber}`,
      req,
    });

    await notifyApplicant(
      application,
      "Application under review",
      `Your application ${application.applicationNumber} is now being reviewed by the admission office.`,
      { withEmail: true },
    );

    return updated;
  },

  /**
   * AO / AOO reviews a single document in the checklist — verify it, reject it
   * with a reason, or toggle the "physical original received" flag. On reject,
   * the applicant is notified so they can re-upload.
   */
  async reviewDocument(
    applicationId: string,
    docType: string,
    action: "verify" | "reject" | "set-original" | "request",
    reason: string | undefined,
    actorUser: IUser,
    req: Request,
    originalSubmitted?: boolean,
    photocopySubmitted?: boolean,
  ) {
    if ((action === "reject" || action === "request") && (!reason || !reason.trim())) {
      throw new BadRequest("A reason is required");
    }
    const rejectionReason = reason?.trim() ?? "";
    if (action === "set-original" && typeof originalSubmitted !== "boolean") {
      throw new BadRequest("originalSubmitted (boolean) is required");
    }
    const application = await AdmissionApplicationModel.findById(applicationId).exec();
    if (!application) throw new NotFound("Application not found");
    if (
      application.status !== ApplicationStatus.UNDER_REVIEW &&
      application.status !== ApplicationStatus.DOCUMENT_VERIFICATION
    ) {
      throw new BadRequest("Documents can only be reviewed while the application is under review");
    }

    const list = (application.documentChecklist ?? []).map((d) => {
      const maybe = d as unknown as { toObject?: () => Record<string, unknown> };
      return typeof maybe.toObject === "function"
        ? maybe.toObject()
        : (d as unknown as Record<string, unknown>);
    });
    let idx = list.findIndex((d) => d.docType === docType);

    if (idx < 0 && action === "request") {
      const newItem = {
        docType,
        originalSubmitted: false,
        photocopySubmitted: false,
        status: "rejected",
        rejectionReason,
        files: [],
      };
      list.push(newItem);
      idx = list.length - 1;
    } else if (idx < 0) {
      throw new NotFound("This document has not been uploaded yet");
    }

    if (action === "verify") {
      list[idx] = {
        ...list[idx],
        status: "verified",
        rejectionReason: undefined,
        verifiedBy: actorUser._id,
        verifiedAt: new Date(),
        ...(typeof originalSubmitted === "boolean" ? { originalSubmitted } : {}),
        ...(typeof photocopySubmitted === "boolean"
          ? { photocopySubmitted }
          : { photocopySubmitted: true }),
      };
    } else if (action === "reject" || action === "request") {
      list[idx] = {
        ...list[idx],
        status: "rejected",
        rejectionReason,
        verifiedBy: actorUser._id,
        verifiedAt: new Date(),
        ...(typeof originalSubmitted === "boolean" ? { originalSubmitted } : {}),
        ...(typeof photocopySubmitted === "boolean" ? { photocopySubmitted } : {}),
      };
    } else {
      list[idx] = {
        ...list[idx],
        originalSubmitted: Boolean(originalSubmitted),
        ...(originalSubmitted ? { verifiedBy: actorUser._id, verifiedAt: new Date() } : {}),
        ...(typeof photocopySubmitted === "boolean" ? { photocopySubmitted } : {}),
      };
    }

    application.documentChecklist = list as unknown as IAdmissionApplication["documentChecklist"];
    application.markModified("documentChecklist");
    await application.save({ validateBeforeSave: false });

    await auditLogRepository.create({
      user: actorUser,
      action:
        action === "verify"
          ? "ADMISSION_DOCUMENT_VERIFIED"
          : action === "reject" || action === "request"
            ? "ADMISSION_DOCUMENT_REJECTED"
            : originalSubmitted
              ? "ADMISSION_ORIGINAL_RECEIVED"
              : "ADMISSION_ORIGINAL_UNMARKED",
      module: Module.ADMISSION,
      targetId: applicationId,
      targetModel: "AdmissionApplication",
      description:
        action === "verify"
          ? `Document ${docType} verified for application ${application.applicationNumber}`
          : action === "reject" || action === "request"
            ? `Document ${docType} requested/rejected for application ${application.applicationNumber}: ${reason}`
            : `Document ${docType} original ${originalSubmitted ? "received" : "unmarked"} for ${application.applicationNumber}`,
      req,
    });

    if (action === "reject" || action === "request") {
      await notifyApplicant(
        application,
        "Document needs to be uploaded / corrected",
        `A document "${docType.replace(/_/g, " ")}" has been requested by verification cell. Instructions: ${reason}. Please log in to the admission portal and upload it.`,
        { withEmail: true },
      );
    }

    return list[idx];
  },

  /**
   * AO / AOO makes the final admission decision on an UNDER_REVIEW application.
   * On approve: status -> APPROVED, allocatedProgram is set to the first program
   * preference (the simplified flow has no separate seat-allocation step). The
   * applicant is then expected to pay the booking fee; once Accounts records
   * payment, Super Admin / Principal confirms enrollment.
   */
  async decideApplication(
    applicationId: string,
    decision: "approved" | "rejected",
    remarks: string,
    actorUser: IUser,
    req: Request,
  ) {
    const application = await admissionRepository.findById(applicationId);
    if (!application) throw new NotFound("Application not found");
    if (application.status !== ApplicationStatus.UNDER_REVIEW) {
      throw new BadRequest("Application must be under review to decide");
    }
    if (!remarks?.trim()) {
      throw new BadRequest("Remarks are required");
    }

    if (decision === "approved") {
      await assertDocumentsReadyForApproval(application);
    }

    const allocatedProgram = application.allocatedProgram ?? application.programPreferences?.[0];
    if (decision === "approved" && !allocatedProgram) {
      throw new BadRequest("No program preference is available for allocation");
    }

    const session = await mongoose.startSession();
    let decidedApplicationId: Types.ObjectId | undefined;
    try {
      await session.withTransaction(async () => {
        if (decision === "approved") {
          const seatExists = await SeatMatrixModel.exists({
            program: allocatedProgram,
            academicYear: application.academicYear,
          }).session(session);

          if (!seatExists) {
            await SeatMatrixModel.create(
              [
                {
                  program: allocatedProgram,
                  academicYear: application.academicYear,
                  totalSeats: 60,
                  allocatedSeats: 0,
                  generalSeats: 30,
                  scSeats: 9,
                  stSeats: 7,
                  obcSeats: 10,
                  ewsSeats: 4,
                  updatedBy: actorUser._id,
                },
              ],
              { session },
            );
          }

          const reservedCount = await AdmissionApplicationModel.countDocuments({
            academicYear: application.academicYear,
            allocatedProgram,
            status: { $in: [ApplicationStatus.APPROVED, ApplicationStatus.ENROLLED] },
          }).session(session);
          await SeatMatrixModel.updateOne(
            { program: allocatedProgram, academicYear: application.academicYear },
            { $max: { allocatedSeats: reservedCount } },
            { session },
          );
          const reserved = await SeatMatrixModel.findOneAndUpdate(
            {
              program: allocatedProgram,
              academicYear: application.academicYear,
              $expr: { $lt: ["$allocatedSeats", "$totalSeats"] },
            },
            { $inc: { allocatedSeats: 1 }, $set: { updatedBy: actorUser._id } },
            { returnDocument: "after", session },
          );
          if (!reserved) {
            throw new Conflict("No seats are available for the selected program");
          }
        }

        const decidedApplication = await AdmissionApplicationModel.findOneAndUpdate(
          { _id: applicationId, status: ApplicationStatus.UNDER_REVIEW },
          {
            $set: {
              status:
                decision === "approved" ? ApplicationStatus.APPROVED : ApplicationStatus.REJECTED,
              remarks,
              ...(decision === "approved" ? { allocatedProgram } : { rejectionReason: remarks }),
            },
            $push: {
              approvalChain: {
                role: actorUser.roles?.[0] || "Admission Officer",
                approvedBy: actorUser._id,
                approvedByName: actorUser.name,
                status: decision === "approved" ? "approved" : "rejected",
                remarks,
                actionedAt: new Date(),
              },
            },
          },
          { returnDocument: "after", runValidators: true, session },
        );
        if (!decidedApplication) throw new Conflict("Application was concurrently decided");
        decidedApplicationId = decidedApplication._id;
      });
    } finally {
      await session.endSession();
    }
    if (!decidedApplicationId) throw new Conflict("Application decision could not be completed");
    const updated = await AdmissionApplicationModel.findById(decidedApplicationId);
    if (!updated) throw new NotFound("Decided application not found");

    await auditLogRepository.create({
      user: actorUser,
      action: `ADMISSION_${decision.toUpperCase()}`,
      module: Module.ADMISSION,
      targetId: applicationId,
      targetModel: "AdmissionApplication",
      description: `Application ${application.applicationNumber} ${decision} by ${actorUser.name}`,
      metadata: { remarks },
      req,
    });

    if (decision === "approved") {
      const prog = (updated.allocatedProgram || application.allocatedProgram || "")
        .toUpperCase()
        .replace(/_/g, " ");
      await notifyApplicant(
        application,
        "Application approved",
        `Congratulations! Your application ${application.applicationNumber} for program ${prog} has been officially approved. Admission Type: ${application.admissionType === "lateral_entry" ? "Lateral Entry" : "Regular"}. Please log in to the Admission Portal to complete your booking fee payment and finalize your onboarding preferences (Hosteller / Day Scholar with bus services) to confirm your enrollment.`,
        { withEmail: true },
      );
    } else {
      await notifyApplicant(
        application,
        "Application rejected",
        `Your application ${application.applicationNumber} has been rejected. Reason: ${remarks}`,
        { withEmail: true },
      );
    }

    return updated.toObject();
  },

  /**
   * Confirm enrollment after fee payment.
   */
  async confirmEnrollment(applicationId: string, actorUser: IUser, req: Request) {
    const session = await mongoose.startSession();
    let updated: IAdmissionApplication | undefined;
    let rollNumber = "";
    let temporaryPassword: string | undefined;
    try {
      await session.withTransaction(async () => {
        const application =
          await AdmissionApplicationModel.findById(applicationId).session(session);
        if (!application) throw new NotFound("Application not found");
        if (application.status !== ApplicationStatus.APPROVED) {
          throw new BadRequest("Application must be APPROVED before enrollment");
        }
        assertPaymentReadyForEnrollment(application);

        const allocated = application.allocatedProgram ?? application.programPreferences?.[0];
        if (!allocated) throw new BadRequest("No program available for this application");

        const user = application.enrolledUserId
          ? await UserModel.findById(application.enrolledUserId).session(session)
          : null;
        const stableApplicationId = /^\d{2}[A-Z0-9]{2,6}\d{3,}$/.test(application.applicationNumber)
          ? application.applicationNumber
          : undefined;
        rollNumber =
          user?.studentId ||
          stableApplicationId ||
          (await generateStudentRegNo(
            (application.admissionType as "regular" | "lateral_entry") ?? "regular",
            application.academicYear,
            allocated,
          ));

        if (!user) {
          if (await UserModel.exists({ email: application.email }).session(session)) {
            throw new Conflict("An existing user already uses the applicant email");
          }
          temporaryPassword = generateTempPassword();
          const [createdUser] = await UserModel.create(
            [
              {
                name: application.candidateName,
                email: application.email,
                phone: application.phone,
                password: await bcrypt.hash(temporaryPassword, 12),
                roles: [SystemRole.STUDENT],
                studentId: rollNumber,
                status: "active",
                mustChangePassword: true,
              },
            ],
            { session },
          );
          application.enrolledUserId = createdUser._id as Types.ObjectId;
        } else {
          user.studentId = rollNumber;
          user.status = "active";
          await user.save({ session });
        }

        application.allocatedProgram = allocated;
        await seedStudentProfile(application, rollNumber, actorUser, session);
        application.status = ApplicationStatus.ENROLLED;
        application.enrolledAt = new Date();
        application.approvalChain.push({
          role: actorUser.roles?.[0] || "Admission Officer",
          approvedBy: actorUser._id,
          approvedByName: actorUser.name,
          status: "approved",
          remarks: "Enrolled student",
          actionedAt: new Date(),
        });
        await application.save({ session });
        updated = application;
      });
    } finally {
      await session.endSession();
    }
    if (!updated) throw new Conflict("Enrollment could not be completed");

    await notificationService.retireAdmissionPipelineForUser(String(updated.enrolledUserId));

    if (temporaryPassword) {
      const tenantBaseUrl = req?.tenantId
        ? await tenantAppBaseUrl(req.tenantId)
        : configs.FRONTEND_URL;
      const portalUrl = `${tenantBaseUrl}/admission-portal`;

      emailService
        .sendApplicantWelcome(
          updated.email,
          updated.candidateName,
          rollNumber,
          updated.admissionType,
          updated.allocatedProgram!,
          temporaryPassword,
          updated.academicYear,
          portalUrl,
        )
        .catch((err: unknown) =>
          logger.error("[admission] Failed to send enrolled applicant credentials", err),
        );
    }

    await auditLogRepository.create({
      user: actorUser,
      action: "STUDENT_ENROLLED",
      module: Module.ADMISSION,
      targetId: applicationId,
      targetModel: "AdmissionApplication",
      description: `Enrollment confirmed. Student ID: ${rollNumber}`,
      req,
    });

    await notifyApplicant(
      updated,
      "Enrollment confirmed",
      `Welcome aboard! Your student ID is ${rollNumber}. Use it to log in. Your university registration number will be added by the admission office once issued.`,
      { withEmail: true, actionUrl: "/dashboard" },
    );

    return updated.toObject();
  },

  /**
   * Dashboard stats for the admission cell.
   */
  async getDashboardStats(academicYear: string) {
    const counts = await admissionRepository.countByStatus(academicYear);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    const byStatus = Object.entries(counts).map(([_id, count]) => ({ _id, count }));
    const byProgram = await admissionRepository.countByProgram(academicYear);

    const enrolled = counts[ApplicationStatus.ENROLLED] ?? 0;
    const pending =
      (counts[ApplicationStatus.SUBMITTED] ?? 0) +
      (counts[ApplicationStatus.UNDER_REVIEW] ?? 0) +
      (counts[ApplicationStatus.APPROVED] ?? 0);

    return { total, breakdown: counts, byStatus, byProgram, enrolled, pending };
  },

  /**
   * Record payment details (Accounts section only).
   * Mirrors the "IMPORTANT: Admission booking amount" section of the RITE form.
   */
  async recordPayment(
    applicationId: string,
    paymentData: {
      amountInNumber: number;
      amountInWords: string;
      receiptNo: string;
      receiptDate: string;
      paymentMode: string;
    },
    actorUser: IUser,
    req: Request,
  ) {
    const application = await admissionRepository.findById(applicationId);
    if (!application) throw new NotFound("Application not found");

    const updated = await admissionRepository.updateById(applicationId, {
      paymentDetails: {
        amountInNumber: paymentData.amountInNumber,
        amountInWords: paymentData.amountInWords,
        receiptNo: paymentData.receiptNo,
        receiptDate: new Date(paymentData.receiptDate),
        paymentMode: paymentData.paymentMode as PaymentMode,
        collectedBy: actorUser._id,
        collectedAt: new Date(),
      },
    });

    await auditLogRepository.create({
      user: actorUser,
      action: "ADMISSION_PAYMENT_RECORDED",
      module: Module.ADMISSION,
      targetId: applicationId,
      targetModel: "AdmissionApplication",
      description: `Payment of ₹${paymentData.amountInNumber} recorded for ${application.applicationNumber}. Receipt: ${paymentData.receiptNo}`,
      metadata: { paymentMode: paymentData.paymentMode, receiptNo: paymentData.receiptNo },
      req,
    });

    await notifyApplicant(
      application,
      "Payment received",
      `We received your admission fee of ₹${paymentData.amountInNumber}. Receipt no: ${paymentData.receiptNo}.`,
      { withEmail: true },
    );

    return updated;
  },

  // ─── Bulk Import ────────────────────────────────────────────────────────────

  /**
   * Returns a CSV template string with just the header row.
   * Programs in `programPreferences` are semicolon-separated since CSV is
   * comma-delimited; date columns use ISO `YYYY-MM-DD`.
   */
  getBulkImportTemplate(): string {
    return csvUtil.serialize(BULK_IMPORT_HEADERS, []);
  },

  /**
   * Bulk-import admission applications from a CSV file.
   * Each row is processed independently; per-row errors are collected and
   * returned without aborting the batch.
   */
  async bulkImportApplications(
    file: UploadedFile,
    academicYear: string,
  ): Promise<{
    total: number;
    created: number;
    failed: number;
    errors: { row: number; email?: string; error: string }[];
  }> {
    if (!file?.data) throw new BadRequest("CSV file is required");
    const rows = csvUtil.parse(file.data);
    if (!rows.length) throw new BadRequest("CSV has no data rows");

    let created = 0;
    const errors: { row: number; email?: string; error: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      try {
        const presentAddress = {
          line1: r.presentAddress_line1,
          city: r.presentAddress_city,
          state: r.presentAddress_state,
          pincode: r.presentAddress_pincode,
          country: r.presentAddress_country || "India",
        };
        const academicRecords: Partial<IAdmissionApplication["academicRecords"]> = [];
        if (r.tenthBoard) {
          academicRecords.push({
            level: "10th",
            boardOrUniversity: r.tenthBoard,
            instituteName: r.tenthSchool || r.tenthBoard,
            yearOfPassing: Number(r.tenthYear) || new Date().getFullYear(),
            percentageOfMarks: Number(r.tenthPercentage) || 0,
          } as never);
        }
        if (r.twelfthBoard) {
          academicRecords.push({
            level: "12th_or_diploma",
            boardOrUniversity: r.twelfthBoard,
            instituteName: r.twelfthSchool || r.twelfthBoard,
            yearOfPassing: Number(r.twelfthYear) || new Date().getFullYear(),
            percentageOfMarks: Number(r.twelfthPercentage) || 0,
          } as never);
        }

        const payload: Partial<IAdmissionApplication> = {
          candidateName: r.candidateName,
          fatherName: r.fatherName,
          motherName: r.motherName,
          dateOfBirth: r.dateOfBirth ? new Date(r.dateOfBirth) : undefined,
          gender: r.gender as IAdmissionApplication["gender"],
          category: r.category as IAdmissionApplication["category"],
          nationality: "Indian",
          email: r.email?.toLowerCase(),
          phone: r.phone,
          presentAddress: presentAddress as IAdmissionApplication["presentAddress"],
          permanentAddress: presentAddress as IAdmissionApplication["permanentAddress"],
          entranceExam: {
            exam: r.entranceExam as EntranceExam,
            year: Number(r.entranceExamYear) || new Date().getFullYear(),
            rank: r.entranceExamRank ? Number(r.entranceExamRank) : undefined,
            percentile: r.entranceExamPercentile ? Number(r.entranceExamPercentile) : undefined,
          } as IAdmissionApplication["entranceExam"],
          admissionType: r.admissionType as AdmissionType,
          programPreferences: (r.programPreferences || "")
            .split(/[;|]/)
            .map((p) => p.trim())
            .filter(Boolean),
          academicRecords: academicRecords as IAdmissionApplication["academicRecords"],
          parentInfo: {
            fatherName: r.fatherName,
            motherName: r.motherName,
          } as IAdmissionApplication["parentInfo"],
        };

        await this.submitApplication(payload, academicYear);
        created++;
      } catch (err) {
        errors.push({
          row: i + 2, // +1 for header row, +1 for 1-indexed
          email: r.email,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      total: rows.length,
      created,
      failed: errors.length,
      errors,
    };
  },

  async updateOnboarding(
    applicationId?: string,
    enrolledUserId?: string | Types.ObjectId,
    onboardStatus?: "pending" | "hosteller" | "day_scholar",
    transportOption?: "bus" | "own",
  ) {
    const query: Record<string, unknown> = {};
    if (applicationId) {
      query._id = applicationId;
    } else if (enrolledUserId) {
      query.enrolledUserId = enrolledUserId;
    } else {
      throw new BadRequest("Either applicationId or enrolledUserId is required");
    }

    const application = await AdmissionApplicationModel.findOne(query);
    if (!application) throw new NotFound("Application not found");
    if (
      [
        ApplicationStatus.ENROLLED,
        ApplicationStatus.REJECTED,
        ApplicationStatus.WITHDRAWN,
      ].includes(application.status)
    ) {
      throw new BadRequest("Onboarding preferences cannot be changed at this stage");
    }
    if (onboardStatus === "day_scholar" && !transportOption) {
      throw new BadRequest("Day scholars must select college bus or own transport");
    }

    if (onboardStatus) {
      application.onboardStatus = onboardStatus;
    }
    if (onboardStatus === "hosteller" || onboardStatus === "pending") {
      application.transportOption = undefined;
    } else if (transportOption !== undefined) {
      application.transportOption = transportOption;
    }

    await application.save();
    return application.toObject();
  },
};

// Header schema for bulk import — kept as a stable contract for the CSV template.
const BULK_IMPORT_HEADERS = [
  "candidateName",
  "fatherName",
  "motherName",
  "dateOfBirth",
  "gender",
  "category",
  "email",
  "phone",
  "presentAddress_line1",
  "presentAddress_city",
  "presentAddress_state",
  "presentAddress_pincode",
  "presentAddress_country",
  "entranceExam",
  "entranceExamYear",
  "entranceExamRank",
  "entranceExamPercentile",
  "admissionType",
  "programPreferences",
  "tenthBoard",
  "tenthSchool",
  "tenthYear",
  "tenthPercentage",
  "twelfthBoard",
  "twelfthSchool",
  "twelfthYear",
  "twelfthPercentage",
];
