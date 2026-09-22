import { Schema, model, type Document, type Types } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";

export type TLmsEntity = "course" | "section" | "user" | "enrollment" | "assignment" | "grade";
export interface ILmsIntegrationProfile extends Document {
  name: string;
  connectorId: Types.ObjectId;
  provider: "canvas_lms" | "moodle_lms" | "oneroster_1_2" | "coursera";
  standard: "canonical_v1" | "oneroster_1_2";
  academicYear: string;
  departmentIds: Types.ObjectId[];
  directions: {
    courses: "export" | "disabled";
    rosters: "export" | "disabled";
    assignments: "export" | "disabled";
    grades: "import" | "export" | "bidirectional" | "disabled";
  };
  enabled: boolean;
  syncSchedule: "manual" | "hourly" | "daily";
  nextSyncAt?: Date;
  lti?: {
    issuer: string;
    clientId: string;
    deploymentId: string;
    authorizationUrl: string;
    tokenUrl: string;
    jwksUrl: string;
  };
  lastSyncAt?: Date;
  createdBy: Types.ObjectId;
}
export interface ILmsEntityMapping extends Document {
  profileId: Types.ObjectId;
  entityType: TLmsEntity;
  localId: Types.ObjectId;
  externalId: string;
  externalVersion?: string;
  contentHash?: string;
  lastSyncedAt: Date;
}
export interface ILmsSyncRun extends Document {
  profileId: Types.ObjectId;
  scope: "courses" | "rosters" | "assignments" | "grades" | "full";
  direction: "import" | "export";
  status: "queued" | "running" | "succeeded" | "partially_succeeded" | "failed";
  idempotencyKey: string;
  requestedBy: Types.ObjectId;
  counts: { examined: number; succeeded: number; skipped: number; failed: number };
  syncErrors: Array<{
    entityType: TLmsEntity;
    localId?: Types.ObjectId;
    externalId?: string;
    code: string;
    message: string;
  }>;
  startedAt: Date;
  completedAt?: Date;
}

const ProfileSchema = new Schema<ILmsIntegrationProfile>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    connectorId: {
      type: Schema.Types.ObjectId,
      ref: "ExternalConnector",
      required: true,
      unique: true,
    },
    provider: {
      type: String,
      enum: ["canvas_lms", "moodle_lms", "oneroster_1_2", "coursera"],
      required: true,
    },
    standard: { type: String, enum: ["canonical_v1", "oneroster_1_2"], required: true },
    academicYear: { type: String, required: true, trim: true },
    departmentIds: { type: [Schema.Types.ObjectId], ref: "Department", default: [] },
    directions: {
      courses: { type: String, enum: ["export", "disabled"], default: "export" },
      rosters: { type: String, enum: ["export", "disabled"], default: "export" },
      assignments: { type: String, enum: ["export", "disabled"], default: "export" },
      grades: {
        type: String,
        enum: ["import", "export", "bidirectional", "disabled"],
        default: "import",
      },
    },
    enabled: { type: Boolean, default: false, index: true },
    syncSchedule: {
      type: String,
      enum: ["manual", "hourly", "daily"],
      default: "manual",
      index: true,
    },
    nextSyncAt: { type: Date, index: true },
    lti: {
      issuer: { type: String, trim: true },
      clientId: { type: String, trim: true },
      deploymentId: { type: String, trim: true },
      authorizationUrl: { type: String, trim: true },
      tokenUrl: { type: String, trim: true },
      jwksUrl: { type: String, trim: true },
    },
    lastSyncAt: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
ProfileSchema.plugin(auditPlugin);

const MappingSchema = new Schema<ILmsEntityMapping>(
  {
    profileId: {
      type: Schema.Types.ObjectId,
      ref: "LmsIntegrationProfile",
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      enum: ["course", "section", "user", "enrollment", "assignment", "grade"],
      required: true,
    },
    localId: { type: Schema.Types.ObjectId, required: true },
    externalId: { type: String, required: true, trim: true, maxlength: 300 },
    externalVersion: String,
    contentHash: String,
    lastSyncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
MappingSchema.index({ profileId: 1, entityType: 1, localId: 1 }, { unique: true });
MappingSchema.index({ profileId: 1, entityType: 1, externalId: 1 }, { unique: true });
MappingSchema.plugin(auditPlugin);

const SyncRunSchema = new Schema<ILmsSyncRun>(
  {
    profileId: {
      type: Schema.Types.ObjectId,
      ref: "LmsIntegrationProfile",
      required: true,
      index: true,
    },
    scope: {
      type: String,
      enum: ["courses", "rosters", "assignments", "grades", "full"],
      required: true,
    },
    direction: { type: String, enum: ["import", "export"], required: true },
    status: {
      type: String,
      enum: ["queued", "running", "succeeded", "partially_succeeded", "failed"],
      default: "queued",
      index: true,
    },
    idempotencyKey: { type: String, required: true, unique: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    counts: {
      examined: { type: Number, default: 0 },
      succeeded: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
    syncErrors: [
      {
        entityType: {
          type: String,
          enum: ["course", "section", "user", "enrollment", "assignment", "grade"],
          required: true,
        },
        localId: Schema.Types.ObjectId,
        externalId: String,
        code: String,
        message: { type: String, maxlength: 1000 },
      },
    ],
    startedAt: { type: Date, default: Date.now },
    completedAt: Date,
  },
  { timestamps: true },
);
SyncRunSchema.index({ profileId: 1, createdAt: -1 });
SyncRunSchema.plugin(auditPlugin);

export const LmsIntegrationProfileModel = model<ILmsIntegrationProfile>(
  "LmsIntegrationProfile",
  ProfileSchema,
);
export const LmsEntityMappingModel = model<ILmsEntityMapping>("LmsEntityMapping", MappingSchema);
export const LmsSyncRunModel = model<ILmsSyncRun>("LmsSyncRun", SyncRunSchema);

export interface ILmsCourse extends Document {
  profileId: Types.ObjectId;
  provider: "canvas_lms" | "moodle_lms" | "oneroster_1_2" | "coursera";
  externalCourseId: string;
  title: string;
  description?: string;
  courseUrl?: string;
  skills: string[];
  durationHours?: number;
  certificateAvailable: boolean;
  status: "active" | "archived";
  lastSyncedAt: Date;
}

const CourseSchema = new Schema<ILmsCourse>(
  {
    profileId: {
      type: Schema.Types.ObjectId,
      ref: "LmsIntegrationProfile",
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ["canvas_lms", "moodle_lms", "oneroster_1_2", "coursera"],
      required: true,
      index: true,
    },
    externalCourseId: { type: String, required: true, trim: true, maxlength: 300 },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    description: { type: String, trim: true, maxlength: 5000 },
    courseUrl: { type: String, trim: true, maxlength: 2000 },
    skills: { type: [String], default: [] },
    durationHours: { type: Number, min: 0, max: 100000 },
    certificateAvailable: { type: Boolean, default: false },
    status: { type: String, enum: ["active", "archived"], default: "active", index: true },
    lastSyncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
CourseSchema.index({ profileId: 1, externalCourseId: 1 }, { unique: true });
CourseSchema.index({ title: "text", skills: "text" });
CourseSchema.plugin(auditPlugin);
export const LmsCourseModel = model<ILmsCourse>("LmsCourse", CourseSchema);

export interface ILmsEnrollment extends Document {
  profileId: Types.ObjectId;
  courseId: Types.ObjectId;
  studentId: Types.ObjectId;
  providerEnrollmentId?: string;
  status: "assigned" | "enrolled" | "in_progress" | "completed" | "cancelled";
  progressPercent: number;
  learningHours: number;
  assignedBy: Types.ObjectId;
  enrolledAt?: Date;
  completedAt?: Date;
  lastSyncedAt?: Date;
}

const EnrollmentSchema = new Schema<ILmsEnrollment>(
  {
    profileId: {
      type: Schema.Types.ObjectId,
      ref: "LmsIntegrationProfile",
      required: true,
      index: true,
    },
    courseId: { type: Schema.Types.ObjectId, ref: "LmsCourse", required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    providerEnrollmentId: { type: String, trim: true, maxlength: 300 },
    status: {
      type: String,
      enum: ["assigned", "enrolled", "in_progress", "completed", "cancelled"],
      default: "assigned",
      index: true,
    },
    progressPercent: { type: Number, min: 0, max: 100, default: 0 },
    learningHours: { type: Number, min: 0, max: 100000, default: 0 },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    enrolledAt: Date,
    completedAt: Date,
    lastSyncedAt: Date,
  },
  { timestamps: true },
);
EnrollmentSchema.index({ profileId: 1, courseId: 1, studentId: 1 }, { unique: true });
EnrollmentSchema.plugin(auditPlugin);
export const LmsEnrollmentModel = model<ILmsEnrollment>("LmsEnrollment", EnrollmentSchema);

export interface ILmsCredential extends Document {
  profileId: Types.ObjectId;
  enrollmentId: Types.ObjectId;
  courseId: Types.ObjectId;
  studentId: Types.ObjectId;
  externalCredentialId: string;
  type: "certificate" | "badge";
  title: string;
  issuedAt: Date;
  credentialUrl?: string;
  verificationUrl?: string;
}

const CredentialSchema = new Schema<ILmsCredential>(
  {
    profileId: {
      type: Schema.Types.ObjectId,
      ref: "LmsIntegrationProfile",
      required: true,
      index: true,
    },
    enrollmentId: {
      type: Schema.Types.ObjectId,
      ref: "LmsEnrollment",
      required: true,
      index: true,
    },
    courseId: { type: Schema.Types.ObjectId, ref: "LmsCourse", required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    externalCredentialId: { type: String, required: true, trim: true, maxlength: 300 },
    type: { type: String, enum: ["certificate", "badge"], required: true },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    issuedAt: { type: Date, required: true },
    credentialUrl: { type: String, trim: true, maxlength: 2000 },
    verificationUrl: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true },
);
CredentialSchema.index({ profileId: 1, externalCredentialId: 1 }, { unique: true });
CredentialSchema.plugin(auditPlugin);
export const LmsCredentialModel = model<ILmsCredential>("LmsCredential", CredentialSchema);

export interface ILmsImportedGrade extends Document {
  profileId: Types.ObjectId;
  assignmentId: Types.ObjectId;
  studentId: Types.ObjectId;
  externalGradeId: string;
  score: number;
  maximumScore: number;
  feedback?: string;
  status: "pending" | "applied" | "rejected";
  importedAt: Date;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  rejectionReason?: string;
}
const ImportedGradeSchema = new Schema<ILmsImportedGrade>(
  {
    profileId: {
      type: Schema.Types.ObjectId,
      ref: "LmsIntegrationProfile",
      required: true,
      index: true,
    },
    assignmentId: { type: Schema.Types.ObjectId, ref: "Assignment", required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    externalGradeId: { type: String, required: true, trim: true },
    score: { type: Number, required: true, min: 0 },
    maximumScore: { type: Number, required: true, min: 1 },
    feedback: { type: String, trim: true, maxlength: 5000 },
    status: {
      type: String,
      enum: ["pending", "applied", "rejected"],
      default: "pending",
      index: true,
    },
    importedAt: { type: Date, default: Date.now },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: Date,
    rejectionReason: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true },
);
ImportedGradeSchema.index({ profileId: 1, externalGradeId: 1 }, { unique: true });
ImportedGradeSchema.index({ assignmentId: 1, studentId: 1, status: 1 });
ImportedGradeSchema.plugin(auditPlugin);
export const LmsImportedGradeModel = model<ILmsImportedGrade>(
  "LmsImportedGrade",
  ImportedGradeSchema,
);
