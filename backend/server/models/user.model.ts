import { auditPlugin } from "../plugins/audit.plugin";
import type { Document, Types } from "mongoose";
import mongoose, { Schema } from "mongoose";
import type { SystemRole } from "../constants/roles";
import { ALL_ROLES } from "../constants/roles";

// ─────────────────────────────────────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface IFcmToken {
  web?: string;
  ios?: string;
  android?: string;
}

export interface IFcmDeviceToken {
  deviceId: string;
  platform: "web" | "ios" | "android";
  token: string;
  lastSeenAt: Date;
}

export interface IEmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

/**
 * Core user document.
 * A single user may hold multiple roles (e.g., faculty + mentor + IQAC coordinator).
 * At login, the user selects the active role from their assigned roles array.
 */
export interface IUser extends Document {
  _id: Types.ObjectId;

  // ── Identity ──────────────────────────────────────────────────────────────
  employeeId?: string; // For staff (system-generated)
  studentId?: string; // For students (system-generated)
  facultyId?: string; // For faculty (system-generated, e.g. RICSE0001)
  name: string;
  email: string;
  phone?: string;
  password: string;
  /** Forces a password change on next login (set when admin provisions account). */
  mustChangePassword?: boolean;
  /** Single-use token emailed to the user to verify email + set initial password. */
  passwordSetToken?: string;
  passwordSetTokenExpires?: Date;

  // ── Role & Access ─────────────────────────────────────────────────────────
  /**
   * TWO-TIER ROLE SYSTEM (by design):
   *
   * Tier 1 — System roles (this field):
   *   `roles: SystemRole[]` stores hardcoded enum values like "student", "faculty",
   *   "hod", "admin". These drive RBAC middleware and JWT claims. They are fast,
   *   enum-safe, and never need a DB join.
   *
   * Tier 2 — Custom roles (Role collection):
   *   The `Role` model stores named permission sets (e.g. "Placement Coordinator")
   *   with granular module-level actions. These are used for fine-grained nav and
   *   feature access WITHIN a system role. `customRoleIds` makes those roles
   *   explicitly assignable and selectable at login/role switch.
   *
   * Rule: RBAC gate checks → use `req.user.roles` (Tier 1).
   *       Nav/feature visibility → use user's assigned Role doc (Tier 2).
   */
  roles: SystemRole[];
  customRoleIds: Types.ObjectId[];

  /** Department reference — required for HOD/Faculty/Student. */
  department?: Types.ObjectId;

  // NOTE: Profile refs removed to avoid dual-write consistency problems.
  // To get a student's profile: StudentProfile.findOne({ userId: user._id })
  // To get a faculty's profile: FacultyProfile.findOne({ userId: user._id })

  // ── Profile ───────────────────────────────────────────────────────────────
  avatar?: string; // Cloudinary URL
  avatarPublicId?: string;
  bloodGroup?: string;

  emergencyContact?: IEmergencyContact;

  // ── Account state ─────────────────────────────────────────────────────────
  /**
   * pending_verification: awaiting email verification + initial password set
   * active: normal access
   * inactive: disabled by admin
   * suspended: temporary system ban
   * blocked: blocked by admin (cannot login until unblocked)
   */
  status: "pending_verification" | "active" | "inactive" | "suspended" | "blocked";
  isEmailVerified: boolean;
  isPhoneVerified: boolean;

  // ── MFA ───────────────────────────────────────────────────────────────────
  mfaEnabled: boolean;
  mfaSecret?: string; // TOTP secret (store encrypted in production)

  // ── Mobile MPIN (server-side sync for reinstall recovery) ─────────────────
  /** bcrypt hash of the user's mobile app MPIN. Never returned in API responses (select: false). */
  mpinHash?: string;

  // ── Push notifications ────────────────────────────────────────────────────
  fcmToken?: IFcmToken;
  fcmTokens?: IFcmDeviceToken[];

  // ── Notification channel preferences ─────────────────────────────────────
  notificationPreferences?: {
    email: boolean;
    inApp: boolean;
    push: boolean;
    sms: boolean;
  };
  // ── Chat mute list ───────────────────────────────────────
  /** Conversation _ids for which this user has muted notifications. */
  mutedConversations?: Types.ObjectId[];
  /** Conversation _ids for which this user has pinned the chat. */
  pinnedConversations?: Types.ObjectId[];
  // ── Session tracking ─────────────────────────────────────────────────────
  lastLogin?: Date; // set on every successful login
  lastLoginIp?: string;
  lastSeenAt?: Date;
  passwordChangedAt?: Date;

  // ── Active sessions (for concurrent session control / force logout) ───────
  activeSessions?: Array<{
    jti: string; // JWT ID — unique per token
    device: string; // "web" | "ios" | "android" | user-agent hint
    ip: string;
    createdAt: Date;
    /** Short replay-grace metadata used to make refresh rotation reload-safe. */
    rotatedAt?: Date;
    rotatedToJti?: string;
  }>;

  // ── Timestamps (auto) ─────────────────────────────────────────────────────
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-schemas
// ─────────────────────────────────────────────────────────────────────────────

const emergencyContactSchema = new Schema<IEmergencyContact>(
  {
    name: { type: String, required: true, trim: true },
    relationship: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const fcmTokenSchema = new Schema<IFcmToken>(
  {
    web: { type: String },
    ios: { type: String },
    android: { type: String },
  },
  { _id: false },
);

const fcmDeviceTokenSchema = new Schema<IFcmDeviceToken>(
  {
    deviceId: { type: String, required: true, trim: true },
    platform: { type: String, enum: ["web", "ios", "android"], required: true },
    token: { type: String, required: true, trim: true },
    lastSeenAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
);

// ─────────────────────────────────────────────────────────────────────────────
// Main schema
// ─────────────────────────────────────────────────────────────────────────────

const userSchema = new Schema<IUser>(
  {
    employeeId: { type: String, unique: true, sparse: true, trim: true },
    studentId: { type: String, unique: true, sparse: true, trim: true },
    facultyId: { type: String, unique: true, sparse: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true, maxlength: 255 },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    phone: { type: String, trim: true, sparse: true },
    password: { type: String, required: true, select: false },
    mustChangePassword: { type: Boolean, default: false },
    passwordSetToken: { type: String, select: false, index: true },
    passwordSetTokenExpires: { type: Date, select: false },

    roles: {
      type: [String],
      enum: ALL_ROLES,
      required: true,
      validate: {
        validator: (v: string[]) => v.length > 0,
        message: "User must have at least one role",
      },
    },
    customRoleIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "Role" }],
      default: [],
    },
    department: { type: Schema.Types.ObjectId, ref: "Department", default: null },

    avatar: { type: String },
    avatarPublicId: { type: String },
    bloodGroup: {
      type: String,
      enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
    },
    emergencyContact: { type: emergencyContactSchema },

    status: {
      type: String,
      enum: ["pending_verification", "active", "inactive", "suspended", "blocked"],
      default: "active",
      index: true,
    },
    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },

    mfaEnabled: { type: Boolean, default: false },
    mfaSecret: { type: String, select: false },

    // Mobile MPIN — bcrypt hash stored for reinstall recovery
    mpinHash: { type: String, select: false },

    fcmToken: { type: fcmTokenSchema },
    fcmTokens: { type: [fcmDeviceTokenSchema], default: [] },

    notificationPreferences: {
      type: new Schema(
        {
          email: { type: Boolean, default: true },
          inApp: { type: Boolean, default: true },
          push: { type: Boolean, default: false },
          sms: { type: Boolean, default: true },
        },
        { _id: false },
      ),
      default: () => ({ email: true, inApp: true, push: false, sms: true }),
    },
    mutedConversations: {
      type: [{ type: Schema.Types.ObjectId, ref: "Conversation" }],
      default: [],
    },
    pinnedConversations: {
      type: [{ type: Schema.Types.ObjectId, ref: "Conversation" }],
      default: [],
    },
    lastLogin: { type: Date },
    lastLoginIp: { type: String },
    lastSeenAt: { type: Date },
    passwordChangedAt: { type: Date },
    activeSessions: {
      type: [
        new Schema(
          {
            jti: { type: String, required: true },
            device: { type: String, default: "unknown" },
            ip: { type: String, default: "" },
            createdAt: { type: Date, default: Date.now },
            rotatedAt: { type: Date },
            rotatedToJti: { type: String },
          },
          { _id: false },
        ),
      ],
      default: [],
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, unknown>) {
        delete ret["password"];
        delete ret["mfaSecret"];
        delete ret["__v"];
      },
    },
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Compound indexes
// ─────────────────────────────────────────────────────────────────────────────

userSchema.index({ roles: 1 });
userSchema.index({ customRoleIds: 1 });
userSchema.index({ department: 1, roles: 1 });
userSchema.index({ status: 1, roles: 1 });

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

userSchema.plugin(auditPlugin);

export const UserModel = mongoose.model<IUser>("User", userSchema);
