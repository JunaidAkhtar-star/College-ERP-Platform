import { Schema, model, type Document, type Types } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";
export enum AssessmentPolicyStatus {
  DRAFT = "draft",
  PUBLISHED = "published",
  RETIRED = "retired",
}
export enum AssessmentSource {
  MANUAL = "manual",
  QUIZ = "quiz",
  ASSIGNMENT = "assignment",
  ATTENDANCE = "attendance",
  LAB_ACTIVITY = "lab_activity",
  EXAMINATION = "examination",
  IMPORT = "import",
}
export enum CalculationMethod {
  SUM = "sum",
  AVERAGE = "average",
  BEST_N = "best_n",
  DROP_LOWEST = "drop_lowest",
  WEIGHTED = "weighted",
  SCALE = "scale",
}
export enum RoundingMethod {
  NONE = "none",
  NEAREST_INTEGER = "nearest_integer",
  NEAREST_HALF = "nearest_half",
  FLOOR = "floor",
  CEIL = "ceil",
}
export interface IAssessmentComponent {
  key: string;
  name: string;
  category: string;
  source: AssessmentSource;
  deliveryMode: "online" | "offline" | "hybrid" | "not_applicable";
  maximumMarks: number;
  minimumPassMarks: number;
  attemptCount: number;
  method: CalculationMethod;
  bestCount?: number;
  weight?: number;
  scaleFrom?: number;
  rounding: RoundingMethod;
  attendanceRequired: boolean;
  allowMakeup: boolean;
  isRequired: boolean;
  displayOrder: number;
}
export interface IGradeBand {
  letter: string;
  minimumPercentage: number;
  point: number;
}
export interface IAssessmentPolicy extends Document {
  _id: Types.ObjectId;
  name: string;
  code: string;
  version: number;
  curriculumId?: Types.ObjectId;
  program?: string;
  regulationYear?: string;
  semester?: number;
  subjectId?: Types.ObjectId;
  subjectType?: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
  status: AssessmentPolicyStatus;
  components: IAssessmentComponent[];
  maximumMarks: number;
  resultTarget: "internal" | "external" | "standalone";
  minimumTotalMarks: number;
  gradeScale: IGradeBand[];
  createdBy: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
const ComponentSchema = new Schema<IAssessmentComponent>(
  {
    key: { type: String, required: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    source: { type: String, enum: Object.values(AssessmentSource), required: true },
    deliveryMode: {
      type: String,
      enum: ["online", "offline", "hybrid", "not_applicable"],
      default: "not_applicable",
    },
    maximumMarks: { type: Number, required: true, min: 0.01 },
    minimumPassMarks: { type: Number, default: 0, min: 0 },
    attemptCount: { type: Number, default: 1, min: 1, max: 100 },
    method: {
      type: String,
      enum: Object.values(CalculationMethod),
      default: CalculationMethod.SUM,
    },
    bestCount: { type: Number, min: 1 },
    weight: { type: Number, min: 0 },
    scaleFrom: { type: Number, min: 0.01 },
    rounding: { type: String, enum: Object.values(RoundingMethod), default: RoundingMethod.NONE },
    attendanceRequired: { type: Boolean, default: false },
    allowMakeup: { type: Boolean, default: false },
    isRequired: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);
const GradeBandSchema = new Schema<IGradeBand>(
  {
    letter: { type: String, required: true, trim: true },
    minimumPercentage: { type: Number, required: true, min: 0, max: 100 },
    point: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);
const AssessmentPolicySchema = new Schema<IAssessmentPolicy>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    version: { type: Number, required: true, min: 1 },
    curriculumId: { type: Schema.Types.ObjectId, ref: "Curriculum" },
    program: { type: String, trim: true },
    regulationYear: { type: String, trim: true },
    semester: { type: Number, min: 1 },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject" },
    subjectType: { type: String, trim: true },
    effectiveFrom: { type: Date, required: true },
    effectiveTo: Date,
    status: {
      type: String,
      enum: Object.values(AssessmentPolicyStatus),
      default: AssessmentPolicyStatus.DRAFT,
    },
    components: {
      type: [ComponentSchema],
      validate: [
        (value: IAssessmentComponent[]) => value.length > 0,
        "At least one component is required",
      ],
    },
    maximumMarks: { type: Number, required: true, min: 0.01 },
    resultTarget: {
      type: String,
      enum: ["internal", "external", "standalone"],
      default: "internal",
    },
    minimumTotalMarks: { type: Number, default: 0, min: 0 },
    gradeScale: { type: [GradeBandSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    publishedAt: Date,
  },
  { timestamps: true },
);
AssessmentPolicySchema.plugin(auditPlugin);
AssessmentPolicySchema.index({ code: 1, version: 1 }, { unique: true });
AssessmentPolicySchema.index({ curriculumId: 1, semester: 1, subjectId: 1, status: 1 });
export const AssessmentPolicyModel = model<IAssessmentPolicy>(
  "AssessmentPolicy",
  AssessmentPolicySchema,
);
