import { Schema, model, type Document, type Types } from "mongoose";

export interface IMeetingMessage extends Document {
  meetingId: Types.ObjectId;
  userId: Types.ObjectId;
  userName: string;
  content: string;
  createdAt: Date;
}
const schema = new Schema<IMeetingMessage>(
  {
    meetingId: { type: Schema.Types.ObjectId, ref: "Meeting", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    userName: { type: String, required: true, trim: true, maxlength: 120 },
    content: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true },
);
schema.index({ meetingId: 1, createdAt: -1 });
export const MeetingMessageModel = model<IMeetingMessage>("MeetingMessage", schema);
