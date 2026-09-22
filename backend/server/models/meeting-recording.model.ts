import { Schema, model, type Document, type Types } from "mongoose";

export interface IMeetingRecording extends Document {
  meetingId: Types.ObjectId;
  title: string;
  secureUrl: string;
  publicId: string;
  bytes: number;
  durationSeconds: number;
  format: string;
  status: "active" | "deleted" | "expired";
  expiresAt: Date;
  uploadedBy: Types.ObjectId;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IMeetingRecording>(
  {
    meetingId: { type: Schema.Types.ObjectId, ref: "Meeting", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    secureUrl: { type: String, required: true, trim: true },
    publicId: { type: String, required: true, unique: true, trim: true },
    bytes: { type: Number, required: true, min: 1 },
    durationSeconds: { type: Number, required: true, min: 1 },
    format: { type: String, required: true, trim: true, lowercase: true },
    status: {
      type: String,
      enum: ["active", "deleted", "expired"],
      default: "active",
      index: true,
    },
    expiresAt: { type: Date, required: true, index: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    deletedAt: Date,
  },
  { timestamps: true },
);
schema.index({ meetingId: 1, createdAt: -1 });
schema.index({ status: 1, expiresAt: 1 });

export const MeetingRecordingModel = model<IMeetingRecording>("MeetingRecording", schema);
