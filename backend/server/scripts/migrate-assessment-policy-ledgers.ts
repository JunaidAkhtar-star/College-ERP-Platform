/** @file migrate-assessment-policy-ledgers.ts @description Adds immutable legacy policy snapshots to pre-policy marks records. */
import "dotenv/config";
import mongoose from "mongoose";
import { StudentMarksModel } from "../models/examination.model";
import { logger } from "../utils/logger.util";
async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is required");
  await mongoose.connect(uri);
  const cursor = StudentMarksModel.find({ assessmentPolicyCode: { $exists: false } }).cursor();
  let updated = 0;
  for await (const mark of cursor) {
    const components = mark.internalComponents?.length
      ? mark.internalComponents
      : [
          {
            name: "Legacy internal total",
            maxMarks: mark.internalMax,
            marksObtained: mark.internalTotal,
          },
        ];
    await StudentMarksModel.updateOne(
      { _id: mark._id, assessmentPolicyCode: { $exists: false } },
      {
        $set: {
          assessmentPolicyCode: "LEGACY",
          assessmentPolicyVersion: 0,
          assessmentPolicySnapshot: {
            legacy: true,
            capturedAt: new Date(),
            resultTarget: "internal",
            maximumMarks: mark.internalMax,
            components,
            externalMaximumMarks: mark.externalMax,
            gradeLetter: mark.gradeLetter,
            gradePoint: mark.gradePoint,
            isPassed: mark.isPassed,
          },
        },
      },
    );
    updated += 1;
  }
  logger.info(`[migrate-assessment-policy-ledgers] updated=${updated}`);
  await mongoose.disconnect();
}
main().catch((error) => {
  logger.error("[migrate-assessment-policy-ledgers] failed", { error });
  process.exit(1);
});
