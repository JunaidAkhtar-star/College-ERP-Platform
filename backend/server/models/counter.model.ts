import type { Document, Types } from "mongoose";
import mongoose, { Schema } from "mongoose";

/**
 * Generic atomic counter — used to mint sequential IDs (faculty ID per
 * department, invoice numbers, etc.) without collisions under concurrency.
 *
 * The `key` is opaque (e.g. "faculty:CSE", "faculty:ECE") so multiple
 * sequences can live in the same collection.
 */
export interface ICounter extends Document {
  _id: Types.ObjectId;
  key: string;
  seq: number;
}

const counterSchema = new Schema<ICounter>(
  {
    key: { type: String, required: true, unique: true, index: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

export const CounterModel = mongoose.model<ICounter>("Counter", counterSchema);

/**
 * Atomically increment and return the next value for the given key.
 * Creates the counter document on first call.
 */
export async function nextSeq(key: string): Promise<number> {
  const doc = await CounterModel.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" },
  );
  return doc!.seq;
}
