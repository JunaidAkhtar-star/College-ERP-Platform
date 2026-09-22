import createError from "http-errors";
import { Types } from "mongoose";
import type { UploadedFile } from "express-fileupload";
import { placementRepository } from "../repositories";
import { placementApplicationRepository } from "../repositories/placement-application.repository";
import { PlacementDriveModel, type IPlacementDrive } from "../models/placement.model";
import {
  PlacementApplicationModel,
  PlacementApplicationStatus,
} from "../models/placement-application.model";
import {
  PlacementEligibilityStatus,
  StudentPlacementProfileModel,
} from "../models/student-placement-profile.model";
import { StudentProfileModel, StudentStatus } from "../models/student-profile.model";
import { uploadUtil } from "../utils/upload.util";
import { redisUtil } from "../utils/redis.util";
import { notifyUsers } from "./helpers/notify.helper";
import { NotificationType } from "../models/notification.model";

const CACHE_PREFIX = "placement:drive:";
const CACHE_TTL = 300;

type DriveEligibility = Pick<
  IPlacementDrive,
  | "eligibilityCgpa"
  | "eligibilityBacklogs"
  | "eligiblePrograms"
  | "eligibleBranches"
  | "eligibleBatches"
  | "package"
>;

export function evaluatePlacementDriveEligibility(
  drive: DriveEligibility,
  profile: {
    cgpa: number;
    activeBacklogs: number;
    program: string;
    branch: string;
    batch: string;
    eligibilityStatus: PlacementEligibilityStatus;
    isEligibleForPlacement: boolean;
    placedPackage?: number;
    isHigherPackageSeeking: boolean;
  },
) {
  const reasons: string[] = [];
  if (!profile.isEligibleForPlacement) reasons.push("Student is not placement eligible");
  if (profile.eligibilityStatus === PlacementEligibilityStatus.OPTED_OUT)
    reasons.push("Student opted out of campus placement");
  if (profile.eligibilityStatus === PlacementEligibilityStatus.PLACED) {
    if (!profile.isHigherPackageSeeking) reasons.push("Student has already accepted an offer");
    else if (drive.package < (profile.placedPackage ?? 0) * 1.2)
      reasons.push("New drive must offer at least a 20% package increase");
  }
  if (drive.eligibilityCgpa !== undefined && profile.cgpa < drive.eligibilityCgpa)
    reasons.push(`Minimum CGPA is ${drive.eligibilityCgpa}`);
  if (drive.eligibilityBacklogs !== undefined && profile.activeBacklogs > drive.eligibilityBacklogs)
    reasons.push(`Maximum active backlogs is ${drive.eligibilityBacklogs}`);
  if (drive.eligiblePrograms.length && !drive.eligiblePrograms.includes(profile.program))
    reasons.push("Programme is not eligible");
  if (drive.eligibleBranches.length && !drive.eligibleBranches.includes(profile.branch))
    reasons.push("Branch is not eligible");
  if (drive.eligibleBatches.length && !drive.eligibleBatches.includes(profile.batch))
    reasons.push("Batch is not eligible");
  return { eligible: reasons.length === 0, reasons };
}

export function validateAndNormalizePlacementDrive(data: Record<string, unknown>) {
  if (!/^\d{4}-\d{2}$/.test(String(data.academicYear ?? "")))
    throw createError(400, "Academic year must use YYYY-YY format");
  for (const [field, min, max] of [
    ["companyName", 2, 200],
    ["jobRole", 2, 200],
    ["venue", 2, 300],
  ] as const) {
    const value = String(data[field] ?? "").trim();
    if (value.length < min || value.length > max)
      throw createError(400, `${field} requires ${min} to ${max} characters`);
    data[field] = value;
  }
  const registrationStart = new Date(String(data.registrationStart ?? ""));
  const registrationEnd = new Date(String(data.registrationEnd ?? ""));
  const driveDate = new Date(String(data.driveDate ?? ""));
  if (
    ![registrationStart, registrationEnd, driveDate].every((date) =>
      Number.isFinite(date.getTime()),
    )
  )
    throw createError(400, "Valid registration and drive dates are required");
  if (registrationEnd < registrationStart || driveDate < registrationEnd)
    throw createError(
      400,
      "Registration must close after opening and no later than the drive date",
    );
  const packageMin = Number(data.package);
  const packageMax = data.packageMax === undefined ? packageMin : Number(data.packageMax);
  if (!Number.isFinite(packageMin) || packageMin <= 0 || packageMax < packageMin)
    throw createError(400, "Valid package range is required");
  const rounds = Array.isArray(data.rounds) ? data.rounds : [];
  const normalizedRounds = rounds.map((raw, index) => {
    const round = raw as Record<string, unknown>;
    if (Number(round.roundNo) !== index + 1)
      throw createError(400, "Drive rounds must be contiguous and ordered from one");
    const roundName = String(round.roundName ?? "").trim();
    if (roundName.length < 2 || roundName.length > 150)
      throw createError(400, `Round ${index + 1} requires a valid name`);
    return { ...round, roundNo: index + 1, roundName };
  });
  const uniqueStrings = (value: unknown) =>
    Array.isArray(value)
      ? [
          ...new Set(
            value
              .map(String)
              .map((item) => item.trim())
              .filter(Boolean),
          ),
        ]
      : [];
  return {
    ...data,
    registrationStart,
    registrationEnd,
    driveDate,
    package: packageMin,
    packageMax,
    rounds: normalizedRounds,
    eligiblePrograms: uniqueStrings(data.eligiblePrograms),
    eligibleBranches: uniqueStrings(data.eligibleBranches),
    eligibleBatches: uniqueStrings(data.eligibleBatches),
    status: "upcoming",
  };
}

export const placementService = {
  getAll: (filter: Record<string, unknown>, page: number, limit: number, studentId?: string) =>
    placementRepository.list(filter, page, limit, studentId),

  getById: async (id: string) => {
    const cached = await redisUtil.get<Awaited<ReturnType<typeof placementRepository.findById>>>(
      CACHE_PREFIX + id,
    );
    if (cached) return cached;
    const drive = await placementRepository.findById(id);
    if (!drive) throw createError(404, "Placement drive not found");
    await redisUtil.set(CACHE_PREFIX + id, drive, CACHE_TTL);
    return drive;
  },

  create: (data: Record<string, unknown>) =>
    placementRepository.create(validateAndNormalizePlacementDrive(data)),

  update: async (id: string, data: Record<string, unknown>) => {
    const existing = await PlacementDriveModel.findById(id).lean();
    if (!existing) throw createError(404, "Placement drive not found");
    if (existing.status !== "upcoming")
      throw createError(409, "Only an upcoming drive can be edited");
    if (await PlacementApplicationModel.exists({ driveId: id }))
      throw createError(409, "Drive policy is locked after the first registration");
    const normalized = validateAndNormalizePlacementDrive({
      ...existing,
      ...data,
    }) as Record<string, unknown>;
    for (const field of ["_id", "createdAt", "createdBy", "updatedAt", "isDeleted"])
      delete normalized[field];
    const drive = await PlacementDriveModel.findOneAndUpdate(
      { _id: id, status: "upcoming" },
      { $set: normalized },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!drive) throw createError(409, "Drive changed while it was being edited");
    await redisUtil.del(CACHE_PREFIX + id);
    return drive;
  },

  getStats: () => placementRepository.countByStatus(),

  transitionDrive: async (
    id: string,
    action: "cancel" | "complete",
    changedBy: string,
    reason?: string,
  ) => {
    const drive = await PlacementDriveModel.findById(id).lean();
    if (!drive) throw createError(404, "Placement drive not found");
    if (action === "complete") {
      if (drive.status !== "ongoing") throw createError(409, "Only an ongoing drive can complete");
      const active = await PlacementApplicationModel.exists({
        driveId: id,
        status: {
          $in: [
            PlacementApplicationStatus.REGISTERED,
            PlacementApplicationStatus.SHORTLISTED,
            PlacementApplicationStatus.ROUND_ONGOING,
            PlacementApplicationStatus.SELECTED,
            PlacementApplicationStatus.OFFERED,
          ],
        },
      });
      if (active) throw createError(409, "Resolve every active application before completion");
      await PlacementDriveModel.updateOne(
        { _id: id, status: "ongoing" },
        { $set: { status: "completed", updatedBy: changedBy } },
      );
    } else {
      const cancellationReason = String(reason ?? "").trim();
      if (cancellationReason.length < 3) throw createError(400, "Cancellation reason is required");
      if (!["upcoming", "ongoing"].includes(drive.status))
        throw createError(409, "Only an active drive can be cancelled");
      const session = await PlacementDriveModel.db.startSession();
      try {
        await session.withTransaction(async () => {
          const accepted = await PlacementApplicationModel.exists({
            driveId: id,
            status: PlacementApplicationStatus.ACCEPTED,
          }).session(session);
          if (accepted) throw createError(409, "A drive with accepted offers cannot be cancelled");
          await PlacementApplicationModel.updateMany(
            {
              driveId: id,
              status: {
                $in: [
                  PlacementApplicationStatus.REGISTERED,
                  PlacementApplicationStatus.SHORTLISTED,
                  PlacementApplicationStatus.ROUND_ONGOING,
                  PlacementApplicationStatus.SELECTED,
                  PlacementApplicationStatus.OFFERED,
                ],
              },
            },
            {
              $set: { status: PlacementApplicationStatus.WITHDRAWN },
              $push: {
                statusHistory: {
                  to: PlacementApplicationStatus.WITHDRAWN,
                  changedBy,
                  changedAt: new Date(),
                  reason: cancellationReason,
                },
              },
            },
            { session },
          );
          const updated = await PlacementDriveModel.updateOne(
            { _id: id, status: drive.status },
            { $set: { status: "cancelled", updatedBy: changedBy } },
            { session },
          );
          if (updated.modifiedCount !== 1) throw createError(409, "Drive changed concurrently");
        });
      } finally {
        await session.endSession();
      }
    }
    await redisUtil.del(CACHE_PREFIX + id);
    return PlacementDriveModel.findById(id).lean();
  },

  register: async (driveId: string, studentId: string) => {
    const now = new Date();
    const [drive, profile, academic] = await Promise.all([
      PlacementDriveModel.findById(driveId).lean(),
      StudentPlacementProfileModel.findOne({ studentId }).lean(),
      StudentProfileModel.findOne({ userId: studentId, status: StudentStatus.ACTIVE }).lean(),
    ]);
    if (!drive) throw createError(404, "Placement drive not found");
    if (!profile || !academic)
      throw createError(400, "An active academic and placement profile is required");
    if (drive.status !== "upcoming" || now < drive.registrationStart || now > drive.registrationEnd)
      throw createError(409, "Registration is not open for this drive");
    if (!profile.resumeUrl) throw createError(409, "Upload a resume before registering");
    profile.cgpa = academic.currentCgpa ?? 0;
    profile.activeBacklogs = academic.totalBacklogs;
    profile.currentSemester = academic.currentSemester;
    profile.academicSyncedAt = now;
    if (
      ![
        PlacementEligibilityStatus.OPTED_OUT,
        PlacementEligibilityStatus.PLACED,
        PlacementEligibilityStatus.HIGHER_STUDIES,
      ].includes(profile.eligibilityStatus)
    ) {
      profile.isEligibleForPlacement = Boolean(academic.isPlacementEligible);
      profile.eligibilityStatus = academic.isPlacementEligible
        ? PlacementEligibilityStatus.ELIGIBLE
        : PlacementEligibilityStatus.NOT_ELIGIBLE;
    }
    await StudentPlacementProfileModel.updateOne(
      { _id: profile._id },
      {
        $set: {
          cgpa: profile.cgpa,
          activeBacklogs: profile.activeBacklogs,
          totalBacklogs: academic.totalBacklogs,
          currentSemester: academic.currentSemester,
          academicSyncedAt: now,
          isEligibleForPlacement: profile.isEligibleForPlacement,
          eligibilityStatus: profile.eligibilityStatus,
        },
      },
    );
    const eligibility = evaluatePlacementDriveEligibility(drive, profile);
    if (!eligibility.eligible) throw createError(403, eligibility.reasons.join("; "));
    try {
      return await placementApplicationRepository.create({
        driveId,
        studentId,
        studentPlacementProfileId: profile._id,
        rollNumber: profile.rollNumber,
        studentName: profile.name,
        program: profile.program,
        branch: profile.branch,
        batch: profile.batch,
        cgpaAtTimeOfApplication: profile.cgpa,
        backlogsAtTimeOfApplication: profile.activeBacklogs,
        status: PlacementApplicationStatus.REGISTERED,
        statusHistory: [{ to: PlacementApplicationStatus.REGISTERED, changedBy: studentId }],
        createdBy: studentId,
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000)
        throw createError(409, "You are already registered for this drive");
      throw error;
    }
  },

  shortlistStudents: async (driveId: string, studentIds: string[], changedBy: string) => {
    const uniqueIds = [...new Set(studentIds.map(String))];
    const session = await PlacementApplicationModel.db.startSession();
    let shortlisted = 0;
    try {
      await session.withTransaction(async () => {
        const result = await PlacementApplicationModel.updateMany(
          {
            driveId,
            studentId: { $in: uniqueIds },
            status: PlacementApplicationStatus.REGISTERED,
          },
          {
            $set: { status: PlacementApplicationStatus.SHORTLISTED },
            $push: {
              statusHistory: {
                from: PlacementApplicationStatus.REGISTERED,
                to: PlacementApplicationStatus.SHORTLISTED,
                changedBy,
                changedAt: new Date(),
              },
            },
          },
          { session },
        );
        if (result.modifiedCount !== uniqueIds.length)
          throw createError(
            409,
            "Every shortlisted student must have an active drive registration",
          );
        shortlisted = result.modifiedCount;
      });
    } finally {
      await session.endSession();
    }
    return { shortlisted };
  },

  declareRoundResults: async (
    driveId: string,
    roundNo: number,
    roundName: string,
    results: Array<{
      applicationId: string;
      status: "pass" | "fail" | "absent";
      score?: number;
      remarks?: string;
    }>,
    changedBy: string,
  ) => {
    const drive = await PlacementDriveModel.findById(driveId).lean();
    if (!drive || drive.status === "cancelled" || drive.status === "completed")
      throw createError(409, "An active placement drive is required");
    const configuredRound = drive.rounds.find((round) => round.roundNo === roundNo);
    if (!configuredRound || configuredRound.roundName !== String(roundName).trim())
      throw createError(400, "Round does not match the configured drive sequence");
    const ids = [...new Set(results.map((result) => result.applicationId))];
    if (ids.length !== results.length || ids.some((id) => !Types.ObjectId.isValid(id)))
      throw createError(400, "Round results require unique valid application IDs");
    const applications = await PlacementApplicationModel.find({
      _id: { $in: ids },
      driveId,
    }).lean();
    if (applications.length !== ids.length)
      throw createError(400, "Every result must belong to this placement drive");
    for (const application of applications) {
      const allowed =
        roundNo === 1
          ? application.status === PlacementApplicationStatus.SHORTLISTED
          : application.status === PlacementApplicationStatus.ROUND_ONGOING &&
            application.currentRound === roundNo - 1 &&
            application.roundResults.some(
              (result) => result.roundNo === roundNo - 1 && result.status === "pass",
            );
      if (!allowed || application.roundResults.some((result) => result.roundNo === roundNo))
        throw createError(409, "Round results must follow the configured sequence exactly once");
    }
    const session = await PlacementApplicationModel.db.startSession();
    try {
      await session.withTransaction(async () => {
        const conductedAt = new Date();
        const operations = results.map((result) => {
          const nextStatus =
            result.status === "pass"
              ? PlacementApplicationStatus.ROUND_ONGOING
              : result.status === "absent"
                ? PlacementApplicationStatus.ABSENT
                : PlacementApplicationStatus.REJECTED;
          const application = applications.find(
            (item) => String(item._id) === result.applicationId,
          )!;
          return {
            updateOne: {
              filter: {
                _id: new Types.ObjectId(result.applicationId),
                driveId: new Types.ObjectId(driveId),
                currentRound: application.currentRound,
                "roundResults.roundNo": { $ne: roundNo },
              },
              update: {
                $push: {
                  roundResults: {
                    roundNo,
                    roundName: configuredRound.roundName,
                    status: result.status,
                    score: result.score,
                    remarks: result.remarks,
                    conductedAt,
                    resultDeclaredAt: conductedAt,
                  },
                  statusHistory: {
                    from: application.status,
                    to: nextStatus,
                    changedBy: new Types.ObjectId(changedBy),
                    changedAt: conductedAt,
                  },
                },
                $set: { status: nextStatus, currentRound: roundNo },
              },
            },
          };
        });
        const writeResult = await PlacementApplicationModel.bulkWrite(operations, {
          session,
          ordered: true,
        });
        if (writeResult.modifiedCount !== results.length)
          throw createError(409, "An application changed during result declaration");
        await PlacementDriveModel.updateOne(
          { _id: driveId, status: "upcoming" },
          { $set: { status: "ongoing" } },
          { session },
        );
      });
    } finally {
      await session.endSession();
    }
    await redisUtil.del(CACHE_PREFIX + driveId);
    return {
      passed: results.filter((result) => result.status === "pass").length,
      failed: results.filter((result) => result.status !== "pass").length,
    };
  },

  selectStudents: async (driveId: string, applicationIds: string[], changedBy: string) => {
    const drive = await PlacementDriveModel.findById(driveId).lean();
    if (!drive?.rounds.length)
      throw createError(409, "Configured rounds are required before selection");
    const ids = [...new Set(applicationIds.map(String))];
    const finalRound = drive.rounds.length;
    const eligible = await PlacementApplicationModel.countDocuments({
      _id: { $in: ids },
      driveId,
      status: PlacementApplicationStatus.ROUND_ONGOING,
      currentRound: finalRound,
      roundResults: { $elemMatch: { roundNo: finalRound, status: "pass" } },
    });
    if (eligible !== ids.length)
      throw createError(409, "Only final-round pass applications can be selected");
    const session = await PlacementApplicationModel.db.startSession();
    let selected = 0;
    try {
      await session.withTransaction(async () => {
        const result = await PlacementApplicationModel.updateMany(
          { _id: { $in: ids }, driveId, status: PlacementApplicationStatus.ROUND_ONGOING },
          {
            $set: { status: PlacementApplicationStatus.SELECTED },
            $push: {
              statusHistory: {
                from: PlacementApplicationStatus.ROUND_ONGOING,
                to: PlacementApplicationStatus.SELECTED,
                changedBy,
                changedAt: new Date(),
              },
            },
          },
          { session },
        );
        if (result.modifiedCount !== ids.length)
          throw createError(409, "Selection changed concurrently");
        selected = result.modifiedCount;
      });
    } finally {
      await session.endSession();
    }
    return { selected };
  },

  issueOffer: async (
    applicationId: string,
    data: {
      offeredPackage: number;
      offeredRole: string;
      joiningDate?: Date;
      offerExpiresAt?: Date;
      coordinatorRemarks?: string;
    },
    offerLetterFile: UploadedFile | undefined,
    changedBy: string,
  ) => {
    const application = await PlacementApplicationModel.findById(applicationId).lean();
    if (!application || application.status !== PlacementApplicationStatus.SELECTED)
      throw createError(409, "Only a selected application can receive an offer");
    const drive = await PlacementDriveModel.findById(application.driveId).lean();
    if (!drive) throw createError(404, "Placement drive not found");
    const offeredPackage = Number(data.offeredPackage);
    if (
      !Number.isFinite(offeredPackage) ||
      offeredPackage < drive.package ||
      offeredPackage > (drive.packageMax ?? drive.package)
    )
      throw createError(400, "Offered package must be within the approved drive range");
    const offeredRole = String(data.offeredRole ?? "").trim();
    if (offeredRole.length < 2 || offeredRole.length > 200)
      throw createError(400, "Valid offered role is required");
    const offerExpiresAt = new Date(String(data.offerExpiresAt ?? ""));
    if (!Number.isFinite(offerExpiresAt.getTime()) || offerExpiresAt <= new Date())
      throw createError(400, "A future offer response deadline is required");
    if (!offerLetterFile) throw createError(400, "Company offer letter is required");
    const uploaded = await uploadUtil.uploadDocument(offerLetterFile, "erp/offer-letters");
    const updated = await PlacementApplicationModel.findOneAndUpdate(
      { _id: applicationId, status: PlacementApplicationStatus.SELECTED },
      {
        $set: {
          status: PlacementApplicationStatus.OFFERED,
          offeredPackage,
          offeredRole,
          joiningDate: data.joiningDate,
          offerLetterUrl: uploaded.url,
          offerIssuedAt: new Date(),
          offerExpiresAt,
          coordinatorRemarks: data.coordinatorRemarks,
        },
        $push: {
          statusHistory: {
            from: PlacementApplicationStatus.SELECTED,
            to: PlacementApplicationStatus.OFFERED,
            changedBy,
            changedAt: new Date(),
          },
        },
      },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!updated) {
      await uploadUtil.deleteFile(uploaded.publicId).catch(() => undefined);
      throw createError(409, "Application changed while the offer was issued");
    }
    void notifyUsers([application.studentId], {
      title: "Placement offer issued",
      body: `${drive.companyName} issued an offer for ${offeredRole}. Respond before the deadline.`,
      type: NotificationType.PLACEMENT,
      actionUrl: "/student/placement",
    });
    return updated;
  },

  respondToOffer: async (
    applicationId: string,
    studentId: string,
    response: "accept" | "decline",
    reason?: string,
  ) => {
    const session = await PlacementApplicationModel.db.startSession();
    let updated;
    try {
      await session.withTransaction(async () => {
        const application = await PlacementApplicationModel.findOne({
          _id: applicationId,
          studentId,
          status: PlacementApplicationStatus.OFFERED,
          offerExpiresAt: { $gte: new Date() },
        }).session(session);
        if (!application)
          throw createError(409, "Active offer not found or response deadline passed");
        const nextStatus =
          response === "accept"
            ? PlacementApplicationStatus.ACCEPTED
            : PlacementApplicationStatus.DECLINED;
        if (response === "decline" && String(reason ?? "").trim().length < 3)
          throw createError(400, "A decline reason is required");
        if (response === "accept") {
          const profile = await StudentPlacementProfileModel.findOne({ studentId }).session(
            session,
          );
          if (!profile) throw createError(404, "Placement profile not found");
          if (
            profile.eligibilityStatus === PlacementEligibilityStatus.PLACED &&
            !profile.isHigherPackageSeeking
          )
            throw createError(409, "An accepted placement offer already exists");
          const drive = await PlacementDriveModel.findById(application.driveId).session(session);
          if (!drive) throw createError(404, "Placement drive not found");
          await PlacementApplicationModel.updateMany(
            {
              studentId,
              _id: { $ne: application._id },
              status: PlacementApplicationStatus.ACCEPTED,
            },
            {
              $set: {
                status: PlacementApplicationStatus.SUPERSEDED,
                outcomeVerified: false,
              },
              $push: {
                statusHistory: {
                  from: PlacementApplicationStatus.ACCEPTED,
                  to: PlacementApplicationStatus.SUPERSEDED,
                  changedBy: studentId,
                  changedAt: new Date(),
                  reason: "Replaced by a governed higher-package offer",
                },
              },
            },
            { session },
          );
          await StudentPlacementProfileModel.updateOne(
            { _id: profile._id },
            {
              $set: {
                eligibilityStatus: PlacementEligibilityStatus.PLACED,
                placedInDrive: drive._id,
                placedCompany: drive.companyName,
                placedRole: application.offeredRole,
                placedPackage: application.offeredPackage,
                offerLetterUrl: application.offerLetterUrl,
                joiningDate: application.joiningDate,
                placementOutcomeVerified: true,
              },
            },
            { session },
          );
          await StudentProfileModel.updateOne(
            { userId: studentId },
            {
              $set: {
                placedCompany: drive.companyName,
                placementPackage: application.offeredPackage,
                placementDate: new Date(),
              },
            },
            { session },
          );
        }
        application.status = nextStatus;
        application.offerRespondedAt = new Date();
        application.outcomeVerified = response === "accept";
        if (response === "decline") application.declineReason = String(reason).trim();
        application.statusHistory.push({
          from: PlacementApplicationStatus.OFFERED,
          to: nextStatus,
          changedBy: new Types.ObjectId(studentId),
          changedAt: new Date(),
          reason: response === "decline" ? String(reason).trim() : undefined,
        });
        updated = await application.save({ session });
      });
    } finally {
      await session.endSession();
    }
    if (updated)
      void notifyUsers([studentId], {
        title: response === "accept" ? "Placement offer accepted" : "Placement offer declined",
        body: "Your placement application response has been recorded.",
        type: NotificationType.PLACEMENT,
        actionUrl: "/student/placement",
      });
    return updated;
  },

  getDriveApplications: (driveId: string, status?: PlacementApplicationStatus) =>
    placementApplicationRepository.findByDrive(driveId, status),
  getDriveApplicationCounts: (driveId: string) =>
    placementApplicationRepository.countByDriveAndStatus(driveId),
  getStudentApplications: (studentId: string) =>
    placementApplicationRepository.findByStudent(studentId),
  getApplication: async (applicationId: string, studentId?: string) => {
    const application = await placementApplicationRepository.findById(applicationId);
    if (!application) throw createError(404, "Application not found");
    const ownerId =
      typeof application.studentId === "object" && "_id" in application.studentId
        ? String(application.studentId._id)
        : String(application.studentId);
    if (studentId && ownerId !== studentId) throw createError(403, "Access denied");
    return application;
  },
};
