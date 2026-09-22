/**
 * Parent Portal Service — SRS §4.6, Module 32
 * Provides a parent with read-only access to their ward's data.
 */
import createError from "http-errors";
import { StudentProfileModel, type IStudentProfile } from "../models/student-profile.model";
import { attendanceService } from "./attendance.service";
import { feeService } from "./fee.service";
import { examinationService } from "./examination.service";
import { noticeService } from "./notice.service";
import { chatService } from "./chat.service";
import { redisUtil } from "../utils/redis.util";
import { UserModel } from "../models/user.model";
import { paymentSubmissionService } from "./payment-submission.service";
import type { UploadedFile } from "express-fileupload";
import type { FeePaymentMode } from "../models";
import { ConversationModel } from "../models/chat.model";
import { SystemRole } from "../constants/roles";

const CACHE_TTL = 120; // 2 minutes

/** Resolve the student profile linked to this parent account */
async function resolveWard(parentUserId: string): Promise<Partial<IStudentProfile>> {
  const cacheKey = `parent:ward:${parentUserId}`;
  const cached = await redisUtil.get<Partial<IStudentProfile>>(cacheKey);
  if (cached) return cached;

  const parent = await UserModel.findById(parentUserId).select("email status roles").lean();
  if (!parent || parent.status !== "active") throw createError(403, "Parent account is not active");
  const email = parent.email.trim().toLowerCase();
  const profile = await StudentProfileModel.findOne({
    $or: [
      { "parentInfo.guardianEmail": email },
      { "parentInfo.fatherEmail": email },
      { "parentInfo.motherEmail": email },
    ],
  })
    .lean()
    .exec();

  if (!profile) throw createError(404, "No linked student found for this parent account");
  await redisUtil.set(cacheKey, profile, CACHE_TTL);
  return profile;
}

/** Return only information a parent needs; never expose identity, finance or staff-only notes. */
export function parentWardView(profile: Partial<IStudentProfile>) {
  const fullName = [profile.firstName, profile.middleName, profile.lastName]
    .filter(Boolean)
    .join(" ");
  return {
    _id: profile._id,
    userId: profile.userId,
    rollNumber: profile.rollNumber,
    registrationNumber: profile.registrationNumber,
    firstName: profile.firstName,
    middleName: profile.middleName,
    lastName: profile.lastName,
    fullName,
    collegeEmail: profile.collegeEmail,
    email: profile.collegeEmail,
    phone: profile.phone,
    program: profile.program,
    batch: profile.batch,
    academicYear: profile.academicYear,
    currentSemester: profile.currentSemester,
    currentYear: profile.currentYear,
    section: profile.section,
    department: profile.department,
    mentor: profile.mentor,
    classTeacher: profile.classTeacher,
    status: profile.status,
    currentCgpa: profile.currentCgpa,
    totalBacklogs: profile.totalBacklogs,
    passportPhotoUrl: profile.passportPhotoUrl,
    photo: profile.passportPhotoUrl,
  };
}

function getStudentId(profile: Partial<IStudentProfile>): string {
  return (
    (profile.userId as unknown as { toString(): string })?.toString() ??
    (profile as { _id: { toString(): string } })._id.toString()
  );
}

export const parentService = {
  /** Get basic ward profile */
  async getWard(parentUserId: string) {
    return parentWardView(await resolveWard(parentUserId));
  },

  /** Get ward's attendance summary */
  async getWardAttendance(parentUserId: string, semester?: number, academicYear?: string) {
    const profile = await resolveWard(parentUserId);
    return attendanceService.getStudentSummary(
      getStudentId(profile),
      semester ?? profile.currentSemester ?? 1,
      academicYear ?? profile.academicYear ?? "",
    );
  },

  /** Get ward's exam results */
  async getWardResults(parentUserId: string) {
    const profile = await resolveWard(parentUserId);
    return examinationService.getStudentResults(getStudentId(profile));
  },

  /** Get ward's fee details */
  async getWardFees(parentUserId: string) {
    const profile = await resolveWard(parentUserId);
    return feeService.getByStudent(getStudentId(profile));
  },

  /** Get notices visible to parents */
  async getNotices(page = 1, limit = 20) {
    return noticeService.getAll(
      { isPublished: true, targetAudience: { $in: ["all", "parents"] } },
      page,
      limit,
    );
  },

  /** Send message to faculty/mentor */
  async sendMessage(
    parentUserId: string,
    recipientId: string | undefined,
    content: string,
    conversationId?: string,
  ) {
    const cleanContent = content?.trim();
    if (!cleanContent || cleanContent.length > 4000)
      throw createError(400, "Message content is invalid");
    let convId = conversationId;
    if (convId) {
      const conversation = await ConversationModel.exists({
        _id: convId,
        participants: parentUserId,
      });
      if (!conversation) throw createError(403, "You are not a participant in this conversation");
    } else {
      if (!recipientId) throw createError(400, "recipientId or conversationId required");
      const [profile, recipient] = await Promise.all([
        resolveWard(parentUserId),
        UserModel.findById(recipientId).select("roles department status").lean(),
      ]);
      const permittedRole = recipient?.roles.some((role) =>
        [SystemRole.FACULTY, SystemRole.HOD, SystemRole.DEAN_ACADEMIC].includes(role),
      );
      const directAcademicContact = [profile.mentor, profile.classTeacher]
        .filter(Boolean)
        .some((id) => id?.toString() === recipientId);
      const sameDepartment = recipient?.department?.toString() === profile.department?.toString();
      if (
        !recipient ||
        recipient.status !== "active" ||
        !permittedRole ||
        (!directAcademicContact && !sameDepartment)
      )
        throw createError(403, "Parents can message only their ward's academic contacts");
      const conv = await chatService.getOrCreateDirect(parentUserId, recipientId);
      convId = (conv as { _id: { toString(): string } })._id.toString();
    }
    return chatService.sendMessage(convId, parentUserId, cleanContent);
  },

  /** Get parent's chat conversations */
  async getConversations(parentUserId: string, page = 1) {
    return chatService.getUserConversations(parentUserId, page, 20);
  },

  // ── Fee Payment ────────────────────────────────────────────────────────────

  /**
   * Parent initiates a fee payment for their ward.
   * Validates that the fee record actually belongs to the ward before calling
   * feeService.recordPayment, preventing horizontal privilege escalation.
   */
  async initiatePayment(
    parentUserId: string,
    data: {
      feeRecordId: string;
      amountPaid: number;
      paymentMode: string;
      paymentDate?: Date;
      bankRef?: string;
      chequeNumber?: string;
      ddNumber?: string;
      upiId?: string;
      remarks?: string;
    },
    screenshotFile?: UploadedFile,
  ) {
    const profile = await resolveWard(parentUserId);
    const studentId = getStudentId(profile);

    // Fetch and verify ownership before allowing payment
    const feeRecords = await feeService.getByStudent(studentId);
    const owned = (feeRecords as Array<{ _id: { toString(): string } }>).some(
      (r) => r._id.toString() === data.feeRecordId,
    );
    if (!owned) {
      throw createError(403, "This fee record does not belong to your ward");
    }

    if (["cash", "cheque", "dd"].includes(String(data.paymentMode).toLowerCase())) {
      throw createError(400, "Offline payments must be recorded by the Accounts office");
    }
    const profileAny = profile as unknown as Record<string, unknown>;
    const studentName = [profile.firstName, profile.middleName, profile.lastName]
      .filter(Boolean)
      .join(" ");
    return paymentSubmissionService.submit(
      {
        feeRecordId: data.feeRecordId,
        studentId,
        studentName,
        rollNumber: profile.rollNumber ?? "",
        program: String(profile.program ?? ""),
        branch: String(profileAny["branch"] ?? ""),
        semester: profile.currentSemester ?? 1,
        academicYear: profile.academicYear ?? "",
        amountSubmitted: data.amountPaid,
        paymentMode: data.paymentMode as FeePaymentMode,
        paymentDate: data.paymentDate
          ? (data.paymentDate instanceof Date
              ? data.paymentDate
              : new Date(data.paymentDate)
            ).toISOString()
          : new Date().toISOString(),
        utrNumber: data.bankRef ?? data.upiId,
        bankReference: data.bankRef,
      },
      screenshotFile,
    );
  },

  /**
   * Get all fee records for the ward (same as getWardFees but named for the
   * payment history context).
   */
  async getPaymentHistory(parentUserId: string) {
    const profile = await resolveWard(parentUserId);
    const submissions = await paymentSubmissionService.getByStudent(getStudentId(profile));
    return submissions.map((submission) => ({
      ...submission,
      amountPaid: submission.amountSubmitted,
      paymentDate: submission.paymentDate,
      bankRef: submission.utrNumber ?? submission.bankReference,
      remarks:
        submission.status === "approved"
          ? "Verified by Accounts"
          : submission.status === "rejected"
            ? submission.reviewRemarks
            : "Awaiting Accounts verification",
    }));
  },
};
