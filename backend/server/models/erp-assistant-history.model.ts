import { model, Schema, Types, type Document } from "mongoose";

export interface IErpAssistantHistory extends Document {
  userId: Types.ObjectId;
  conversationId: string;
  question: string;
  answer: string;
  contextPath?: string;
  mentionedModules: string[];
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ErpAssistantHistorySchema = new Schema<IErpAssistantHistory>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    conversationId: { type: String, required: true, trim: true, maxlength: 80 },
    question: { type: String, required: true, trim: true, maxlength: 1500 },
    answer: { type: String, required: true, maxlength: 30000 },
    contextPath: { type: String, trim: true, maxlength: 300 },
    mentionedModules: { type: [String], default: [] },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

ErpAssistantHistorySchema.index({ userId: 1, createdAt: -1 });
ErpAssistantHistorySchema.index({ userId: 1, conversationId: 1, createdAt: 1 });
ErpAssistantHistorySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ErpAssistantHistoryModel = model<IErpAssistantHistory>(
  "ErpAssistantHistory",
  ErpAssistantHistorySchema,
);
