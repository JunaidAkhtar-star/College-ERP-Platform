import { randomUUID } from "crypto";
import { SchedulerLeaseModel } from "../models/scheduler-lease.model";

const owner = `${process.env["HOSTNAME"] ?? "local"}:${process.pid}:${randomUUID()}`;
const active = new Set<string>();

export async function withSchedulerLease(
  key: string,
  task: () => Promise<void> | void,
  leaseMs = 10 * 60 * 1000,
): Promise<boolean> {
  if (active.has(key)) return false;
  const now = new Date();
  try {
    const lease = await SchedulerLeaseModel.findOneAndUpdate(
      {
        key,
        $or: [{ lockedUntil: { $lte: now } }, { owner }],
      },
      {
        $set: {
          owner,
          lockedUntil: new Date(now.getTime() + leaseMs),
          acquiredAt: now,
        },
      },
      { returnDocument: "after", upsert: true, setDefaultsOnInsert: true },
    )
      .lean()
      .exec();
    if (!lease || lease.owner !== owner) return false;
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return false;
    throw error;
  }

  active.add(key);
  try {
    await task();
    return true;
  } finally {
    active.delete(key);
    // Release the lease immediately so subsequent ticks or other replicas are not blocked
    await SchedulerLeaseModel.updateOne(
      { key, owner },
      { $set: { lockedUntil: new Date() } },
    ).catch(() => undefined);
  }
}
