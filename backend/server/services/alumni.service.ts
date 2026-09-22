import createError from "http-errors";
import { Types } from "mongoose";
import { AlumniEngagementModel, AlumniModel, DonationModel } from "../models/alumni.model";
import { BatchModel } from "../models/batch.model";
import { BookIssueModel } from "../models/library.model";
import { CurriculumModel } from "../models/curriculum.model";
import { DepartmentModel } from "../models/department.model";
import { SemesterResultModel } from "../models/examination.model";
import { FeeRecordModel } from "../models/fee.model";
import { HostelAllocationModel } from "../models/hostel.model";
import { StudentProfileModel, StudentStatus } from "../models/student-profile.model";
import { TransportAllocationModel } from "../models/transport.model";
import { nextSeq } from "../models/counter.model";
import { alumniRepository } from "../repositories";
import { financialYearForDate } from "./accounts.service";
import { generalLedgerService } from "./general-ledger.service";

const CAREER_FIELDS = [
  "currentEmployer",
  "currentDesignation",
  "currentLocation",
  "linkedinUrl",
  "higherStudies",
  "isPlaced",
  "package",
  "skills",
] as const;

export function validateAcademicCompletion(input: {
  totalSemesters: number;
  totalCreditsRequired: number;
  results: Array<{
    semester: number;
    result: "PASS" | "FAIL" | "WITHHELD";
    isPublished: boolean;
    totalCreditsEarned: number;
  }>;
}) {
  const latestBySemester = new Map<number, (typeof input.results)[number]>();
  for (const result of input.results)
    if (!latestBySemester.has(result.semester)) latestBySemester.set(result.semester, result);
  const missingSemesters: number[] = [];
  for (let semester = 1; semester <= input.totalSemesters; semester += 1) {
    const result = latestBySemester.get(semester);
    if (!result?.isPublished || result.result !== "PASS") missingSemesters.push(semester);
  }
  const creditsEarned = [...latestBySemester.values()].reduce(
    (sum, result) => sum + Math.max(0, Number(result.totalCreditsEarned ?? 0)),
    0,
  );
  return {
    complete: missingSemesters.length === 0 && creditsEarned >= input.totalCreditsRequired,
    missingSemesters,
    creditsEarned,
  };
}

export function cleanCareerUpdate(input: Record<string, unknown>) {
  const update: Record<string, unknown> = {};
  for (const field of CAREER_FIELDS) if (field in input) update[field] = input[field];
  if (update.package !== undefined) {
    const value = Number(update.package);
    if (!Number.isFinite(value) || value < 0) throw createError(400, "Package is invalid");
    update.package = value;
  }
  if (update.isPlaced === true && !String(update.currentEmployer ?? "").trim())
    throw createError(400, "Employer is required for a placed career outcome");
  if (update.higherStudies && typeof update.higherStudies === "object") {
    const study = update.higherStudies as Record<string, unknown>;
    if (
      !String(study.institution ?? "").trim() ||
      !String(study.program ?? "").trim() ||
      !Number.isInteger(Number(study.year))
    )
      throw createError(400, "Higher-study institution, program, and year are required");
  }
  const linkedinUrl = String(update.linkedinUrl ?? "").trim();
  if (linkedinUrl) {
    try {
      const url = new URL(linkedinUrl);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    } catch {
      throw createError(400, "LinkedIn URL is invalid");
    }
  }
  if (Array.isArray(update.skills))
    update.skills = [
      ...new Set(update.skills.map((skill) => String(skill).trim().toLowerCase()).filter(Boolean)),
    ];
  return update;
}

export function alumniDonationJournalLines(input: {
  amount: number;
  paymentMethod: "online" | "cheque" | "dd" | "cash";
  alumniId: string | Types.ObjectId;
}) {
  return [
    {
      accountCode: input.paymentMethod === "cash" ? "CASH" : "BANK",
      accountName: input.paymentMethod === "cash" ? "Cash on Hand" : "Bank Account",
      accountType: "asset" as const,
      debit: input.amount,
      partyId: input.alumniId,
    },
    {
      accountCode: "INCOME-ALUMNI-DONATIONS",
      accountName: "Alumni Donations",
      accountType: "income" as const,
      credit: input.amount,
      partyId: input.alumniId,
    },
  ];
}

export const alumniService = {
  getAll: (filter: Record<string, unknown>, page: number, limit: number) =>
    alumniRepository.list(filter, page, Math.min(limit, 100)),

  getById: async (id: string) => {
    const alumni = await alumniRepository.findById(id);
    if (!alumni) throw createError(404, "Alumni profile not found");
    return alumni;
  },

  getGraduationCandidates: async (page = 1, limit = 25) => {
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const students = await StudentProfileModel.find({
      status: StudentStatus.ACTIVE,
      currentSemester: { $gte: 4 },
    })
      .select(
        "userId firstName middleName lastName rollNumber program batch department currentSemester",
      )
      .sort({ batch: 1, rollNumber: 1 })
      .skip((Math.max(page, 1) - 1) * safeLimit)
      .limit(safeLimit)
      .lean();
    const candidates = await Promise.all(
      students.map(async (student) => {
        const batch = await BatchModel.findOne({
          program: student.program,
          departmentId: student.department,
          admissionYear: Number.parseInt(student.batch, 10),
        }).lean();
        const curriculum = batch ? await CurriculumModel.findById(batch.curriculumId).lean() : null;
        if (!curriculum || student.currentSemester < curriculum.totalSemesters) return null;
        const [results, feeDue, activeIssues, hostel, transport] = await Promise.all([
          SemesterResultModel.find({ studentId: student.userId })
            .sort({ semester: 1, publishedAt: -1, updatedAt: -1 })
            .lean(),
          FeeRecordModel.exists({ studentId: student.userId, balanceDue: { $gt: 0 } }),
          BookIssueModel.exists({
            memberId: student.userId,
            status: { $in: ["issued", "overdue", "lost"] },
          }),
          HostelAllocationModel.exists({ studentId: student.userId, status: "active" }),
          TransportAllocationModel.exists({ studentId: student.userId, status: "active" }),
        ]);
        const completion = validateAcademicCompletion({
          totalSemesters: curriculum.totalSemesters,
          totalCreditsRequired: curriculum.totalCreditsRequired,
          results,
        });
        const blockers = [
          ...completion.missingSemesters.map((semester) => `Semester ${semester} not passed`),
          completion.creditsEarned < curriculum.totalCreditsRequired &&
            `${completion.creditsEarned}/${curriculum.totalCreditsRequired} credits`,
          feeDue && "Fee dues",
          activeIssues && "Library dues",
          hostel && "Active hostel allocation",
          transport && "Active transport allocation",
        ].filter(Boolean);
        return {
          studentProfileId: student._id,
          studentId: student.userId,
          fullName: [student.firstName, student.middleName, student.lastName]
            .filter(Boolean)
            .join(" "),
          rollNumber: student.rollNumber,
          program: student.program,
          batch: student.batch,
          currentSemester: student.currentSemester,
          eligible: blockers.length === 0,
          blockers,
        };
      }),
    );
    return { data: candidates.filter(Boolean), page: Math.max(page, 1), limit: safeLimit };
  },

  graduateStudent: async (studentProfileId: string, actorId: string) => {
    const student = await StudentProfileModel.findById(studentProfileId).lean();
    if (!student) throw createError(404, "Student profile not found");
    if (student.status === StudentStatus.PASSED_OUT) {
      const existing = await AlumniModel.findOne({ userId: student.userId }).lean();
      if (existing) return existing;
      throw createError(
        409,
        "Student is passed out but the alumni profile requires migration review",
      );
    }
    if (student.status !== StudentStatus.ACTIVE)
      throw createError(409, "Only an active student can complete graduation");
    const admissionYear = Number.parseInt(student.batch, 10);
    const batch = await BatchModel.findOne({
      program: student.program,
      departmentId: student.department,
      admissionYear,
    }).lean();
    if (!batch) throw createError(409, "Authoritative batch configuration is missing");
    const [curriculum, department, results, feeDue, activeIssues, hostel, transport] =
      await Promise.all([
        CurriculumModel.findById(batch.curriculumId).lean(),
        DepartmentModel.findById(student.department).lean(),
        SemesterResultModel.find({ studentId: student.userId })
          .sort({ semester: 1, publishedAt: -1, updatedAt: -1 })
          .lean(),
        FeeRecordModel.exists({ studentId: student.userId, balanceDue: { $gt: 0 } }),
        BookIssueModel.exists({
          memberId: student.userId,
          status: { $in: ["issued", "overdue", "lost"] },
        }),
        HostelAllocationModel.exists({ studentId: student.userId, status: "active" }),
        TransportAllocationModel.exists({ studentId: student.userId, status: "active" }),
      ]);
    if (!curriculum || !department)
      throw createError(409, "Curriculum or department configuration is missing");
    const completion = validateAcademicCompletion({
      totalSemesters: curriculum.totalSemesters,
      totalCreditsRequired: curriculum.totalCreditsRequired,
      results,
    });
    if (!completion.complete)
      throw createError(
        409,
        `Academic completion failed: semesters ${completion.missingSemesters.join(", ") || "none"}; ${completion.creditsEarned}/${curriculum.totalCreditsRequired} credits`,
      );
    const holds = [
      feeDue && "fee dues",
      activeIssues && "library dues",
      hostel && "active hostel allocation",
      transport && "active transport allocation",
    ].filter(Boolean);
    if (holds.length) throw createError(409, `Graduation clearance pending: ${holds.join(", ")}`);

    const session = await AlumniModel.db.startSession();
    let alumni;
    try {
      await session.withTransaction(async () => {
        const updatedStudent = await StudentProfileModel.findOneAndUpdate(
          { _id: student._id, status: StudentStatus.ACTIVE },
          { $set: { status: StudentStatus.PASSED_OUT, updatedBy: actorId } },
          { returnDocument: "after", session },
        );
        if (!updatedStudent)
          throw createError(409, "Student graduation state changed concurrently");
        const [created] = await AlumniModel.create(
          [
            {
              userId: student.userId,
              fullName: [student.firstName, student.middleName, student.lastName]
                .filter(Boolean)
                .join(" "),
              email: student.personalEmail || student.collegeEmail,
              phone: student.phone,
              rollNumber: student.rollNumber,
              registrationNo: student.registrationNumber,
              program: student.program,
              branch: department.code,
              passoutYear: new Date().getFullYear(),
              isVerified: true,
              verifiedBy: actorId,
              verifiedAt: new Date(),
              verificationSource: "academic_completion",
              careerOutcomeVerified: false,
              createdBy: actorId,
            },
          ],
          { session },
        );
        alumni = created;
      });
    } finally {
      await session.endSession();
    }
    return alumni;
  },

  update: async (id: string, input: Record<string, unknown>, actorId: string) => {
    const current = await AlumniModel.findById(id).lean();
    if (!current) throw createError(404, "Alumni profile not found");
    const update = cleanCareerUpdate({ ...current, ...input });
    const alumni = await alumniRepository.updateCareer(id, {
      ...update,
      updatedBy: actorId,
    });
    if (!alumni) throw createError(404, "Alumni profile not found");
    return alumni;
  },

  verify: async (id: string, actorId: string) => {
    const current = await AlumniModel.findById(id).lean();
    if (!current || current.isVerified)
      throw createError(409, "Alumni profile is missing or already verified");
    const identityConditions = [
      ...(current.userId ? [{ userId: current.userId }] : []),
      ...(current.rollNumber ? [{ rollNumber: current.rollNumber }] : []),
    ];
    if (!identityConditions.length)
      throw createError(409, "Alumni identity cannot be matched to a student record");
    const student = await StudentProfileModel.findOne({
      status: StudentStatus.PASSED_OUT,
      $or: identityConditions,
    }).lean();
    if (!student || student.program !== current.program)
      throw createError(409, "A matching passed-out student record is required for verification");
    const alumni = await alumniRepository.verify(id, actorId);
    if (!alumni) throw createError(409, "Alumni profile is missing or already verified");
    return alumni;
  },

  verifyCareerOutcome: async (id: string, actorId: string) => {
    const current = await AlumniModel.findById(id).lean();
    if (!current || !current.isVerified || current.careerOutcomeVerified)
      throw createError(409, "Verified alumni with an unverified career outcome required");
    if (current.isPlaced && (!current.currentEmployer || !current.package))
      throw createError(409, "Placed outcomes require employer and package evidence");
    if (!current.isPlaced && !current.higherStudies)
      throw createError(409, "Employment or higher-study evidence is required");
    const alumni = await AlumniModel.findOneAndUpdate(
      { _id: id, isVerified: true, careerOutcomeVerified: false },
      {
        $set: {
          careerOutcomeVerified: true,
          careerOutcomeVerifiedBy: actorId,
          careerOutcomeVerifiedAt: new Date(),
          updatedBy: actorId,
        },
      },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!alumni)
      throw createError(409, "Verified alumni with an unverified career outcome required");
    return alumni;
  },

  getStatsByYear: () => alumniRepository.getStatsByYear(),

  listEngagements: async (status?: "planned" | "completed" | "cancelled") =>
    AlumniEngagementModel.find(status ? { status } : {})
      .populate("alumniIds", "fullName email program passoutYear")
      .sort({ scheduledAt: -1 })
      .lean(),

  createEngagement: async (input: Record<string, unknown>, createdBy: string) => {
    const type = String(input.type ?? "") as
      | "reunion"
      | "mentorship"
      | "guest_talk"
      | "referral"
      | "networking"
      | "other";
    if (!["reunion", "mentorship", "guest_talk", "referral", "networking", "other"].includes(type))
      throw createError(400, "Engagement type is invalid");
    const alumniIds = [
      ...new Set((Array.isArray(input.alumniIds) ? input.alumniIds : []).map(String)),
    ];
    if (!alumniIds.length || alumniIds.some((id) => !Types.ObjectId.isValid(id)))
      throw createError(400, "Choose at least one valid alumni participant");
    const verifiedCount = await AlumniModel.countDocuments({
      _id: { $in: alumniIds },
      isVerified: true,
    });
    if (verifiedCount !== alumniIds.length)
      throw createError(409, "Every selected participant must be a verified alumni");
    const scheduledAt = new Date(String(input.scheduledAt ?? ""));
    if (Number.isNaN(scheduledAt.getTime()))
      throw createError(400, "Choose a valid engagement date and time");
    const capacity = input.capacity ? Number(input.capacity) : undefined;
    if (capacity !== undefined && (!Number.isInteger(capacity) || capacity < alumniIds.length))
      throw createError(400, "Capacity cannot be lower than the selected alumni count");
    return AlumniEngagementModel.create({
      type,
      title: String(input.title ?? "").trim(),
      description: String(input.description ?? "").trim(),
      scheduledAt,
      venue: String(input.venue ?? "").trim() || undefined,
      alumniIds,
      capacity,
      status: "planned",
      createdBy,
    });
  },

  closeEngagement: async (
    id: string,
    status: "completed" | "cancelled",
    outcome: string,
    actorId: string,
  ) => {
    const note = outcome.trim();
    if (note.length < 5) throw createError(400, "Add a meaningful outcome or cancellation reason");
    const engagement = await AlumniEngagementModel.findOneAndUpdate(
      { _id: id, status: "planned" },
      { $set: { status, outcome: note, updatedBy: actorId } },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!engagement) throw createError(409, "Only a planned engagement can be closed");
    return engagement;
  },

  createDonation: async (input: Record<string, unknown>, createdBy: string) => {
    const alumniId = String(input.alumniId ?? "");
    if (!Types.ObjectId.isValid(alumniId)) throw createError(400, "Alumni ID is invalid");
    const alumni = await AlumniModel.findOne({ _id: alumniId, isVerified: true }).lean();
    if (!alumni) throw createError(409, "A verified alumni profile is required");
    const amount = Math.round(Number(input.amount) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0)
      throw createError(400, "Donation amount must be positive");
    const currency = String(input.currency ?? "INR").toUpperCase();
    if (currency !== "INR")
      throw createError(
        400,
        "Only INR donations can be accounted without an approved FX settlement",
      );
    const paymentMethod = String(input.paymentMethod ?? "") as "online" | "cheque" | "dd" | "cash";
    if (!["online", "cheque", "dd", "cash"].includes(paymentMethod))
      throw createError(400, "Payment method is invalid");
    const transactionId = String(input.transactionId ?? "").trim();
    if (paymentMethod !== "cash" && !transactionId)
      throw createError(400, "Bank or instrument reference is required");
    return DonationModel.create({
      alumniId: alumni._id,
      amount,
      currency,
      purpose: String(input.purpose ?? "").trim(),
      paymentMethod,
      transactionId: transactionId || undefined,
      notes: String(input.notes ?? "").trim() || undefined,
      donatedAt: input.donatedAt ? new Date(String(input.donatedAt)) : new Date(),
      status: "pending",
      accountingVerified: false,
      createdBy,
    });
  },

  listDonations: async (filter: Record<string, unknown>, page = 1, limit = 20) => {
    const skip = (page - 1) * Math.min(limit, 100);
    const [data, total] = await Promise.all([
      DonationModel.find(filter)
        .populate("alumniId", "fullName email")
        .sort({ donatedAt: -1 })
        .skip(skip)
        .limit(Math.min(limit, 100))
        .lean(),
      DonationModel.countDocuments(filter),
    ]);
    return {
      data,
      total,
      page,
      limit: Math.min(limit, 100),
      pages: Math.ceil(total / Math.min(limit, 100)),
    };
  },

  confirmDonation: async (id: string, confirmedBy: string) => {
    const donation = await DonationModel.findById(id).lean();
    if (!donation) throw createError(404, "Donation not found");
    if (donation.status !== "pending")
      throw createError(409, "Only a pending donation can be confirmed");
    if (String(donation.createdBy) === confirmedBy)
      throw createError(409, "Donation recorder and confirmer must be different users");
    const session = await DonationModel.db.startSession();
    let confirmed;
    try {
      await session.withTransaction(async () => {
        const financialYear = financialYearForDate(donation.donatedAt);
        const receiptSequence = await nextSeq(`alumni-donation-receipt:${financialYear}`);
        const receiptNumber = `ADR-${financialYear.replace(/[^0-9]/g, "")}-${String(receiptSequence).padStart(7, "0")}`;
        const journal = await generalLedgerService.postJournal(
          {
            date: donation.donatedAt,
            financialYear,
            description: `Alumni donation – ${donation.purpose}`,
            sourceType: "AlumniDonation",
            sourceId: donation._id,
            sourceEvent: "confirm",
            postedBy: confirmedBy,
            lines: alumniDonationJournalLines({
              amount: donation.amount,
              paymentMethod: donation.paymentMethod,
              alumniId: donation.alumniId,
            }),
          },
          session,
        );
        confirmed = await DonationModel.findOneAndUpdate(
          { _id: id, status: "pending" },
          {
            $set: {
              status: "confirmed",
              confirmedBy,
              confirmedAt: new Date(),
              receiptNumber,
              journalEntryId: journal._id,
              accountingVerified: true,
              updatedBy: confirmedBy,
            },
          },
          { returnDocument: "after", session, runValidators: true },
        ).lean();
        if (!confirmed) throw createError(409, "Donation state changed concurrently");
      });
    } finally {
      await session.endSession();
    }
    return confirmed;
  },

  failDonation: async (id: string, failedBy: string, reason: string) => {
    const failureReason = String(reason ?? "").trim();
    if (failureReason.length < 5)
      throw createError(400, "A meaningful rejection reason is required");
    const donation = await DonationModel.findOneAndUpdate(
      { _id: id, status: "pending" },
      {
        $set: {
          status: "failed",
          failedBy,
          failedAt: new Date(),
          failureReason,
          updatedBy: failedBy,
        },
      },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!donation) throw createError(409, "Only a pending donation can be rejected");
    return donation;
  },

  donationStats: () =>
    DonationModel.aggregate([
      {
        $match: {
          status: "confirmed",
          currency: "INR",
          accountingVerified: true,
          journalEntryId: { $exists: true },
          isDeleted: { $ne: true },
        },
      },
      { $group: { _id: "$purpose", total: { $sum: "$amount" }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
};
