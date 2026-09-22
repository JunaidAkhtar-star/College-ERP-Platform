import mongoose, { Schema, type Document, type Types } from "mongoose";
export interface IMeetingUsage extends Document {
  meetingId: Types.ObjectId;
  hostId: Types.ObjectId;
  startedAt?: Date;
  endedAt?: Date;
  consumedMinutes: number;
  peakParticipants: number;
  recordingBytes: number;
  activeParticipantIds: Types.ObjectId[];
  participantSessions: {
    userId: Types.ObjectId;
    joinedAt: Date;
    leftAt?: Date;
    durationSeconds: number;
  }[];
}
const schema = new Schema<IMeetingUsage>(
  {
    meetingId: { type: Schema.Types.ObjectId, ref: "Meeting", unique: true, required: true },
    hostId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    startedAt: Date,
    endedAt: Date,
    consumedMinutes: { type: Number, default: 0 },
    peakParticipants: { type: Number, default: 0 },
    recordingBytes: { type: Number, default: 0 },
    activeParticipantIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    participantSessions: [
      {
        _id: false,
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        joinedAt: { type: Date, required: true },
        leftAt: Date,
        durationSeconds: { type: Number, default: 0 },
      },
    ],
  },
  { timestamps: true },
);
schema.index({ startedAt: 1 });
export const MeetingUsageModel = mongoose.model<IMeetingUsage>("MeetingUsage", schema);
