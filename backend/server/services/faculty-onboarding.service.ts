/**
 * @file faculty-onboarding.service.ts
 * @description Single-call onboarding for a new faculty member.
 *   - Creates a User in `pending_verification` status (no password yet — a
 *     random placeholder is stored only to satisfy the schema; the user MUST
 *     verify their email and set a password via the invite link).
 *   - Generates a department-scoped faculty ID via the Counter collection.
 *   - Creates a matching FacultyProfile with the full profile payload.
 *   - Emails an invite link the user clicks to verify + set password.
 */

import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Conflict, NotFound, BadRequest } from "http-errors";
import mongoose, { Types } from "mongoose";
import type { Request } from "express";

import { userRepository } from "../repositories/user.repository";
import { DepartmentModel } from "../models/department.model";
import {
  FacultyProfileModel,
  FacultyStatus,
  type IFacultyProfile,
} from "../models/faculty-profile.model";
import { UserModel, type IUser } from "../models/user.model";
import { SystemRole } from "../constants/roles";
import { Module } from "../constants/permissions";
import { generateFacultyEmpId } from "../utils/id.util";
import { emailService } from "../email/email.service";
import { auditLogRepository } from "../repositories/audit-log.repository";
import { encryptFacultyFields } from "./faculty-profile.service";
import { tenantActivationUrl } from "../utils/tenant-app-url.util";

const INVITE_TOKEN_TTL_HOURS = 24;

export interface FacultyOnboardingPayload {
  /** Joining type — drives whether teaching or non_teaching profile is seeded. */
  joiningType: "teaching" | "non_teaching" | "new" | "existing";

  // Step 2 — Account & Roles
  name: string;
  email: string;
  phone?: string;
  roles: (SystemRole | string)[]; // e.g. "faculty", "administration_office", "hostel_warden", "accounts_department"
  departmentId: string;

  // Steps 3-8 — full FacultyProfile payload (typed loosely; the model validates)
  profile: Record<string, unknown>;
}

export const facultyOnboardingService = {
  async createFaculty(payload: FacultyOnboardingPayload, actor: IUser, req: Request) {
    if (!payload.email) throw new BadRequest("Email is required");
    if (!payload.roles || payload.roles.length === 0) {
      throw new BadRequest("At least one system role is required for onboarding");
    }
    const assignableRoles = new Set<string>([
      SystemRole.FACULTY,
      SystemRole.HOD,
      SystemRole.IQAC_NAAC,
      SystemRole.IQAC_TEAM,
      SystemRole.ADMINISTRATION_OFFICE,
      SystemRole.HOSTEL_WARDEN,
      SystemRole.ACCOUNTS_DEPARTMENT,
      SystemRole.HR_DEPARTMENT,
      SystemRole.LIBRARY_STAFF,
      SystemRole.TRANSPORTATION,
      SystemRole.PLACEMENT_CELL,
      SystemRole.EXAMINATION_CELL,
      SystemRole.SCHOLARSHIP_CELL,
      SystemRole.STORE,
      SystemRole.PRINCIPAL,
      SystemRole.DEAN_ACADEMIC,
    ]);
    if (payload.roles.some((role) => !assignableRoles.has(role) && role !== SystemRole.ADMIN)) {
      throw new BadRequest("Employee onboarding contains an unsupported role");
    }

    const exists = await userRepository.existsByEmail(payload.email);
    if (exists) throw new Conflict("A user with this email already exists");

    const dept = await DepartmentModel.findById(payload.departmentId).lean();
    if (!dept) throw new NotFound("Department not found");
    if (payload.roles.includes(SystemRole.HOD) && dept.hodId)
      throw new Conflict("Department already has an HOD; use the governed replacement workflow");

    const facultyId = await generateFacultyEmpId();
    const incomingProfile = payload.profile ?? {};
    const {
      dateOfJoining: legacyJoiningDate,
      highestQualificationSpecialization: legacySpecialization,
      ...profileFields
    } = incomingProfile;
    const normalizedProfile: Record<string, unknown> = {
      ...profileFields,
      category:
        typeof incomingProfile["category"] === "string"
          ? incomingProfile["category"].toLowerCase()
          : incomingProfile["category"],
      joiningDate: incomingProfile["joiningDate"] ?? legacyJoiningDate,
      specialization: incomingProfile["specialization"] ?? legacySpecialization,
    };

    // Placeholder password — overwritten when the user completes the invite flow.
    // We hash a strong random value so the row is never login-able directly.
    const placeholderHash = await bcrypt.hash(crypto.randomBytes(24).toString("hex"), 12);

    // Single-use invite token (raw value emailed; hashed value stored).
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const tokenExpires = new Date(Date.now() + INVITE_TOKEN_TTL_HOURS * 60 * 60 * 1000);

    let newUser: IUser | undefined;
    await mongoose.connection.transaction(async (session) => {
      const userDoc = new UserModel({
        name: payload.name.trim(),
        email: payload.email.toLowerCase().trim(),
        phone: payload.phone,
        password: placeholderHash,
        roles: [...new Set(payload.roles)],
        department: new Types.ObjectId(payload.departmentId),
        facultyId,
        employeeId: facultyId,
        status: "pending_verification",
        isEmailVerified: false,
        mustChangePassword: true,
        passwordSetToken: tokenHash,
        passwordSetTokenExpires: tokenExpires,
      });
      await userDoc.save({ session });
      const profile = new FacultyProfileModel({
        ...encryptFacultyFields(normalizedProfile as Partial<IFacultyProfile>),
        userId: userDoc._id,
        employeeId: facultyId,
        department: dept._id,
        collegeEmail: userDoc.email,
        joiningType: payload.joiningType,
        status: FacultyStatus.ACTIVE,
        createdBy: actor._id,
      });
      await profile.save({ session });
      if (payload.roles.includes(SystemRole.HOD)) {
        const updated = await DepartmentModel.updateOne(
          { _id: dept._id, hodId: { $exists: false } },
          { $set: { hodId: userDoc._id, hodName: userDoc.name, updatedBy: actor._id } },
          { session },
        );
        if (!updated.modifiedCount) throw new Conflict("Department HOD changed concurrently");
      }
      newUser = userDoc;
    });
    if (!newUser) throw new Error("Faculty onboarding transaction did not create a user");

    if (!req.tenantId) throw new Error("Tenant context is required to create an invitation.");
    const setupUrl = await tenantActivationUrl(req.tenantId, rawToken);
    const designation = (payload.profile["designation"] as string) ?? "Faculty";

    await emailService.sendFacultyInvite(newUser.email, {
      name: newUser.name,
      facultyId,
      department: dept.name,
      designation,
      setupUrl,
    });

    await auditLogRepository.create({
      user: actor,
      action: "FACULTY_ONBOARDED",
      module: Module.USER_MANAGEMENT,
      targetId: newUser._id.toString(),
      targetModel: "User",
      description: `Onboarded faculty '${newUser.name}' (${facultyId}) in ${dept.code}`,
      req,
    });

    return {
      userId: newUser._id,
      facultyId,
      email: newUser.email,
      inviteSent: true,
    };
  },

  /**
   * Resolve an invite token to the owning user (without exposing the token).
   * Used by the frontend to render the set-password page with user context.
   */
  async resolveInviteToken(rawToken: string) {
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const user = await UserModel.findOne({
      passwordSetToken: tokenHash,
      passwordSetTokenExpires: { $gt: new Date() },
    })
      .select("+passwordSetToken +passwordSetTokenExpires name email facultyId status")
      .lean();
    if (!user) throw new BadRequest("Invite link is invalid or expired");
    return {
      name: user.name,
      email: user.email,
      facultyId: user.facultyId,
    };
  },

  /**
   * Complete invite: verify email + set initial password + activate account.
   */
  async completeInvite(rawToken: string, newPassword: string) {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequest("Password must be at least 8 characters");
    }
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const user = await UserModel.findOne({
      passwordSetToken: tokenHash,
      passwordSetTokenExpires: { $gt: new Date() },
    }).select("+passwordSetToken +passwordSetTokenExpires");
    if (!user) throw new BadRequest("Invite link is invalid or expired");

    user.password = await bcrypt.hash(newPassword, 12);
    user.status = "active";
    user.isEmailVerified = true;
    user.mustChangePassword = false;
    user.passwordChangedAt = new Date();
    user.passwordSetToken = undefined;
    user.passwordSetTokenExpires = undefined;
    await user.save();

    return { success: true };
  },
};
