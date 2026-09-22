import { Schema, model, type Document, type Types } from "mongoose";
import type { ProctoringEventType } from "./quiz.model";

export interface IProctoringLog extends Document {
  quizId: Types.ObjectId;
  studentId: Types.ObjectId;
  eventType: ProctoringEventType;
  timestamp: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const ProctoringLogSchema = new Schema<IProctoringLog>(
  {
    quizId: { type: Schema.Types.ObjectId, ref: "Quiz", required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    eventType: {
      type: String,
      enum: [
        "tab_switch",
        "fullscreen_exit",
        "copy_paste",
        "suspicious_activity",
        "auto_submitted",
        "screenshot",
      ],
      required: true,
    },
    timestamp: { type: Date, default: () => new Date(), required: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

ProctoringLogSchema.index({ quizId: 1, studentId: 1 });

export const ProctoringLogModel = model<IProctoringLog>("ProctoringLog", ProctoringLogSchema);
