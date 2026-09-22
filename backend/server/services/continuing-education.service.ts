import createError from "http-errors";
import crypto from "node:crypto";
import mongoose from "mongoose";
import {
  ContinuingEducationCohortModel,
  ContinuingEducationEnrollmentModel,
  ContinuingEducationOfferingModel,
} from "../models/advancement-continuing-education.model";
import { CampusModel } from "../models/campus-governance.model";
import { nextSeq } from "../models/counter.model";
import { UserModel } from "../models/user.model";
import { SystemRole } from "../constants/roles";
const date = (value: unknown, label: string) => {
  const result = new Date(String(value));
  if (!Number.isFinite(result.getTime())) throw createError(400, `${label} is invalid`);
  return result;
};
export const continuingEducationService = {
  offerings: () => ContinuingEducationOfferingModel.find().sort({ code: 1 }).lean(),
  createOffering: (actorId: string, input: Record<string, unknown>) =>
    ContinuingEducationOfferingModel.create({
      ...input,
      code: String(input.code).trim().toUpperCase(),
      learningOutcomes: [
        ...new Set((input.learningOutcomes as string[]).map((v) => v.trim()).filter(Boolean)),
      ],
      prerequisites: [
        ...new Set(((input.prerequisites ?? []) as string[]).map((v) => v.trim()).filter(Boolean)),
      ],
      createdBy: actorId,
    }),
  cohorts: () =>
    ContinuingEducationCohortModel.find()
      .populate("offeringId", "code title fee credentialType")
      .populate("instructorId", "name email")
      .populate("campusId", "code name")
      .sort({ startsAt: -1 })
      .lean(),
  async createCohort(actorId: string, input: Record<string, unknown>) {
    const offeringId = String(input.offeringId),
      instructorId = String(input.instructorId),
      campusId = input.campusId ? String(input.campusId) : undefined;
    const startsAt = date(input.startsAt, "Cohort start"),
      endsAt = date(input.endsAt, "Cohort end"),
      enrollmentOpensAt = date(input.enrollmentOpensAt, "Enrollment opening"),
      enrollmentClosesAt = date(input.enrollmentClosesAt, "Enrollment closing");
    if (
      !(
        enrollmentOpensAt < enrollmentClosesAt &&
        enrollmentClosesAt <= startsAt &&
        startsAt < endsAt
      )
    )
      throw createError(400, "Enrollment and cohort dates must be in chronological order");
    const [offering, instructor, campus] = await Promise.all([
      ContinuingEducationOfferingModel.exists({ _id: offeringId, status: "published" }),
      UserModel.exists({
        _id: instructorId,
        status: "active",
        roles: { $nin: [SystemRole.SUPER_ADMIN] },
      }),
      campusId ? CampusModel.exists({ _id: campusId, status: "active" }) : true,
    ]);
    if (!offering || !instructor || !campus)
      throw createError(404, "Published offering, active instructor, or campus not found");
    return ContinuingEducationCohortModel.create({
      ...input,
      offeringId,
      instructorId,
      campusId,
      startsAt,
      endsAt,
      enrollmentOpensAt,
      enrollmentClosesAt,
      createdBy: actorId,
    });
  },
  enrollments: () =>
    ContinuingEducationEnrollmentModel.find()
      .populate({
        path: "cohortId",
        populate: { path: "offeringId", select: "code title fee credentialType" },
      })
      .sort({ createdAt: -1 })
      .lean(),
  async enroll(actorId: string, input: Record<string, unknown>) {
    const cohortId = String(input.cohortId),
      learnerId = input.learnerId ? String(input.learnerId) : undefined,
      now = new Date();
    if (learnerId) {
      const eligibleLearner = await UserModel.exists({
        _id: learnerId,
        status: "active",
        roles: { $nin: [SystemRole.SUPER_ADMIN] },
      });
      if (!eligibleLearner) throw createError(404, "Eligible learner account not found");
    }
    return mongoose.connection.transaction(async (session) => {
      const cohort = await ContinuingEducationCohortModel.findOneAndUpdate(
        {
          _id: cohortId,
          status: "open",
          enrollmentOpensAt: { $lte: now },
          enrollmentClosesAt: { $gte: now },
          $expr: { $lt: ["$enrolledCount", "$capacity"] },
        },
        { $inc: { enrolledCount: 1 } },
        { returnDocument: "after", session },
      ).populate("offeringId");
      if (!cohort)
        throw createError(409, "Enrollment is closed or this cohort has reached capacity");
      const offering = cohort.offeringId as unknown as { fee: number };
      const enrollmentNumber = `CE-${new Date().getFullYear()}-${String(await nextSeq(`continuing-enrollment:${new Date().getFullYear()}`)).padStart(6, "0")}`;
      const [created] = await ContinuingEducationEnrollmentModel.create(
        [
          {
            ...input,
            cohortId,
            enrollmentNumber,
            learnerEmail: String(input.learnerEmail).trim().toLowerCase(),
            paymentStatus: offering.fee > 0 ? "pending" : "not_required",
            status: offering.fee > 0 ? "pending" : "enrolled",
            createdBy: actorId,
          },
        ],
        { session },
      );
      return created.toObject();
    });
  },
  async recordProgress(
    id: string,
    actorId: string,
    input: { attendancePercent: number; assessmentScore?: number; paymentStatus?: string },
  ) {
    const enrollment = await ContinuingEducationEnrollmentModel.findById(id);
    if (!enrollment) throw createError(404, "Continuing-education enrollment not found");
    if (["withdrawn", "completed", "failed"].includes(enrollment.status))
      throw createError(409, "This enrollment is already final");
    enrollment.attendancePercent = input.attendancePercent;
    if (input.assessmentScore !== undefined) enrollment.assessmentScore = input.assessmentScore;
    if (input.paymentStatus)
      enrollment.paymentStatus = input.paymentStatus as typeof enrollment.paymentStatus;
    if (
      enrollment.status === "pending" &&
      ["paid", "not_required"].includes(enrollment.paymentStatus)
    )
      enrollment.status = "enrolled";
    enrollment.updatedBy = actorId as never;
    await enrollment.save();
    return enrollment.toObject();
  },
  async complete(
    id: string,
    actorId: string,
    input: {
      outcome: "completed" | "failed";
      attendanceThreshold: number;
      scoreThreshold?: number;
    },
  ) {
    const enrollment = await ContinuingEducationEnrollmentModel.findOne({
      _id: id,
      status: "enrolled",
    });
    if (!enrollment) throw createError(409, "Only an enrolled learner can be completed");
    if (input.outcome === "completed") {
      if (!["paid", "not_required"].includes(enrollment.paymentStatus))
        throw createError(409, "Payment must be settled before completion");
      if (enrollment.attendancePercent < input.attendanceThreshold)
        throw createError(409, "Attendance is below the completion threshold");
      if (
        input.scoreThreshold !== undefined &&
        (enrollment.assessmentScore ?? -1) < input.scoreThreshold
      )
        throw createError(409, "Assessment score is below the completion threshold");
      enrollment.credentialCode = `DVC-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
      enrollment.credentialIssuedAt = new Date();
      enrollment.completedAt = new Date();
    }
    enrollment.status = input.outcome;
    enrollment.updatedBy = actorId as never;
    await enrollment.save();
    return enrollment.toObject();
  },
  async verifyCredential(code: string) {
    const record = await ContinuingEducationEnrollmentModel.findOne({
      credentialCode: code,
      status: "completed",
      credentialRevokedAt: { $exists: false },
    })
      .populate({
        path: "cohortId",
        populate: { path: "offeringId", select: "code title credentialType durationHours" },
      })
      .select("learnerName completedAt credentialCode credentialIssuedAt cohortId")
      .lean();
    if (!record) throw createError(404, "Credential is invalid or revoked");
    return record;
  },
  async dashboard() {
    const [offerings, openCohorts, enrolled, completed, credentials] = await Promise.all([
      ContinuingEducationOfferingModel.countDocuments({ status: "published" }),
      ContinuingEducationCohortModel.countDocuments({ status: { $in: ["open", "in_progress"] } }),
      ContinuingEducationEnrollmentModel.countDocuments({ status: "enrolled" }),
      ContinuingEducationEnrollmentModel.countDocuments({ status: "completed" }),
      ContinuingEducationEnrollmentModel.countDocuments({
        credentialCode: { $exists: true },
        credentialRevokedAt: { $exists: false },
      }),
    ]);
    return {
      publishedOfferings: offerings,
      openCohorts,
      enrolledLearners: enrolled,
      completions: completed,
      activeCredentials: credentials,
    };
  },
};
