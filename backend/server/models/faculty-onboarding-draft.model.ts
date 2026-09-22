import type { Document, Types } from "mongoose";
import mongoose, { Schema } from "mongoose";

export interface IFacultyOnboardingDraft extends Document {
  _id: Types.ObjectId;
  createdBy: Types.ObjectId;
  step: number;
  draftData: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const facultyOnboardingDraftSchema = new Schema<IFacultyOnboardingDraft>(
  {
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    step: { type: Number, required: true, default: 0 },
    draftData: { type: Schema.Types.Map, of: Schema.Types.Mixed, required: true, default: {} },
  },
  { timestamps: true },
);

export const FacultyOnboardingDraftModel = mongoose.model<IFacultyOnboardingDraft>(
  "FacultyOnboardingDraft",
  facultyOnboardingDraftSchema,
);
