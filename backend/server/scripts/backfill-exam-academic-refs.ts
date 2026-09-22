/**
 * @file backfill-exam-academic-refs.ts
 * @description Backfill department/curriculum/batch/section references into
 * old examination result and marks rows using student allotment/profile data.
 *
 * Run:
 *   pnpm exec ts-node server/scripts/backfill-exam-academic-refs.ts
 */
import "dotenv/config";
import mongoose from "mongoose";
import { SemesterResultModel, StudentMarksModel } from "../models/examination.model";
import { studentProfileRepository, studentSectionAllotmentRepository } from "../repositories";
import { logger } from "../utils/logger.util";

async function refsFor(studentId: string, academicYear: string, semester: number) {
  const allotment = await studentSectionAllotmentRepository.findActiveForStudentSemester(
    studentId,
    academicYear,
    semester,
  );
  if (allotment) {
    return {
      curriculumId: allotment.curriculumId,
      departmentId: allotment.departmentId,
      batchId: allotment.batchId,
      sectionId: allotment.sectionId,
    };
  }
  const profile = await studentProfileRepository.findByUserId(studentId);
  return profile?.department ? { departmentId: profile.department } : {};
}

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("MONGODB_URI is required");
  await mongoose.connect(mongoUri);

  let resultsUpdated = 0;
  let marksUpdated = 0;

  const results = await SemesterResultModel.find({
    $or: [{ departmentId: { $exists: false } }, { departmentId: null }],
  })
    .select("_id studentId academicYear semester")
    .lean();

  for (const result of results) {
    const refs = await refsFor(
      result.studentId.toString(),
      result.academicYear,
      Number(result.semester),
    );
    if (!Object.keys(refs).length) continue;
    await SemesterResultModel.updateOne({ _id: result._id }, { $set: refs });
    resultsUpdated += 1;
  }

  const marks = await StudentMarksModel.find({
    $or: [{ departmentId: { $exists: false } }, { departmentId: null }],
  })
    .select("_id studentId academicYear semester")
    .lean();

  for (const mark of marks) {
    const refs = await refsFor(mark.studentId.toString(), mark.academicYear, Number(mark.semester));
    if (!Object.keys(refs).length) continue;
    await StudentMarksModel.updateOne({ _id: mark._id }, { $set: refs });
    marksUpdated += 1;
  }

  logger.info(
    `[backfill-exam-academic-refs] resultsUpdated=${resultsUpdated} marksUpdated=${marksUpdated}`,
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  logger.error("[backfill-exam-academic-refs] failed", { err });
  process.exit(1);
});
