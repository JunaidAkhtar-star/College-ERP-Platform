import { Schema, model, type Document, type Types } from "mongoose";

export interface IStudyMaterialAccess extends Document {
  materialId: Types.ObjectId;
  userId: Types.ObjectId;
  accessType: "view" | "download";
  accessDate: string;
  createdAt: Date;
}

const StudyMaterialAccessSchema = new Schema<IStudyMaterialAccess>(
  {
    materialId: { type: Schema.Types.ObjectId, ref: "StudyMaterial", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    accessType: { type: String, enum: ["view", "download"], required: true },
    accessDate: { type: String, required: true },
  },
  { timestamps: true },
);

StudyMaterialAccessSchema.index(
  { materialId: 1, userId: 1, accessType: 1, accessDate: 1 },
  { unique: true },
);
StudyMaterialAccessSchema.index({ createdAt: 1 }, { expireAfterSeconds: 400 * 24 * 60 * 60 });

export const StudyMaterialAccessModel = model<IStudyMaterialAccess>(
  "StudyMaterialAccess",
  StudyMaterialAccessSchema,
);
