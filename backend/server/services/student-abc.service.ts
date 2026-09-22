import createError from "http-errors";
import { AssessmentScoreLedgerModel, GradebookStatus } from "../models/assessment-gradebook.model";
import { CurriculumModel } from "../models/curriculum.model";
import { RegulatorySubmissionModel } from "../models/regulatory-submission.model";
import { StudentProfileModel } from "../models/student-profile.model";

export const studentAbcService = {
  async myLedger(userId: string) {
    const student = await StudentProfileModel.findOne({ userId })
      .select(
        "userId rollNumber abcId program academicYear currentSemester semesterResults firstName middleName lastName",
      )
      .lean();
    if (!student) throw createError(404, "Student profile was not found.");
    const [ledgers, curricula, batches] = await Promise.all([
      AssessmentScoreLedgerModel.find({ studentId: student.userId, status: GradebookStatus.FROZEN })
        .select("subjectId semester academicYear passed gradeLetter gradePoint percentage frozenAt")
        .sort({ academicYear: 1, semester: 1 })
        .lean(),
      CurriculumModel.find({ program: student.program, isActive: true })
        .select("regulationYear semesterPlans")
        .lean(),
      RegulatorySubmissionModel.find({
        provider: "abc",
        $or: [
          { "rows.payload.ROLL_NUMBER": student.rollNumber },
          ...(student.abcId ? [{ "rows.payload.ABC_ID": student.abcId }] : []),
        ],
      })
        .select(
          "batchNumber academicYear status rows acknowledgementReference acceptedRecords rejectedRecords exportedAt submittedAt reconciledAt createdAt",
        )
        .sort({ createdAt: -1 })
        .lean(),
    ]);
    const subjectMap = new Map(
      curricula.flatMap((curriculum) =>
        curriculum.semesterPlans.flatMap((semester) =>
          semester.subjects.map(
            (subject) =>
              [
                String(subject.subjectId),
                {
                  code: subject.subjectCode,
                  name: subject.subjectName,
                  credits: subject.credits,
                  regulationYear: curriculum.regulationYear,
                },
              ] as const,
          ),
        ),
      ),
    );
    const subjectCredits = ledgers.map((ledger) => {
      const subject = subjectMap.get(String(ledger.subjectId));
      const reference = `${student.rollNumber}-${subject?.code ?? String(ledger.subjectId)}`;
      const matchedBatch = batches.find((batch) =>
        batch.rows.some((row) => row.reference === reference),
      );
      return {
        reference,
        subjectCode: subject?.code ?? "Unmapped",
        subjectName: subject?.name ?? "Subject mapping unavailable",
        semester: ledger.semester,
        academicYear: ledger.academicYear,
        grade: ledger.gradeLetter,
        gradePoint: ledger.gradePoint,
        percentage: ledger.percentage,
        passed: ledger.passed,
        credits: ledger.passed ? (subject?.credits ?? 0) : 0,
        curriculumMapped: Boolean(subject),
        preparationStatus: !ledger.passed
          ? "not_eligible"
          : !student.abcId
            ? "identity_required"
            : !subject
              ? "mapping_required"
              : matchedBatch
                ? matchedBatch.status
                : "ready",
        batchNumber: matchedBatch?.batchNumber,
      };
    });
    const semesterCredits = student.semesterResults.map((result) => {
      const calculatedCredits = subjectCredits
        .filter(
          (row) => row.semester === result.semesterNo && row.academicYear === result.academicYear,
        )
        .reduce((sum, row) => sum + row.credits, 0);
      return {
        semester: result.semesterNo,
        academicYear: result.academicYear,
        result: result.result,
        sgpa: result.sgpa,
        cgpa: result.cgpa,
        registeredCredits: result.totalCredits,
        earnedCredits: result.creditsEarned ?? calculatedCredits,
        source:
          result.creditsEarned !== undefined ? "published_semester_result" : "frozen_gradebook",
      };
    });
    const submissions = batches.map((batch) => {
      const studentRows = batch.rows.filter(
        (row) =>
          row.payload?.ROLL_NUMBER === student.rollNumber ||
          (student.abcId && row.payload?.ABC_ID === student.abcId),
      );
      return {
        batchNumber: batch.batchNumber,
        academicYear: batch.academicYear,
        status: batch.status,
        recordCount: studentRows.length,
        acknowledgementReference: batch.acknowledgementReference,
        preparedAt: batch.createdAt,
        exportedAt: batch.exportedAt,
        submittedAt: batch.submittedAt,
        reconciledAt: batch.reconciledAt,
        confirmationSource:
          batch.status === "accepted" || batch.status === "partially_accepted"
            ? "institution_recorded_provider_response"
            : "institution_workflow",
      };
    });
    return {
      identity: {
        studentName: [student.firstName, student.middleName, student.lastName]
          .filter(Boolean)
          .join(" "),
        rollNumber: student.rollNumber,
        abcId: student.abcId,
        status: student.abcId ? "recorded_by_institution" : "not_recorded",
        editableByStudent: false,
      },
      summary: {
        totalEarnedCredits: semesterCredits.reduce(
          (sum, semester) => sum + (semester.earnedCredits ?? 0),
          0,
        ),
        subjectMappedCredits: subjectCredits.reduce((sum, subject) => sum + subject.credits, 0),
        passedSubjects: subjectCredits.filter((subject) => subject.passed).length,
        preparedRecords: subjectCredits.filter(
          (subject) =>
            !["ready", "identity_required", "mapping_required", "not_eligible"].includes(
              subject.preparationStatus,
            ),
        ).length,
        submittedRecords: submissions
          .filter((submission) =>
            ["submitted", "partially_accepted", "accepted", "rejected"].includes(submission.status),
          )
          .reduce((sum, submission) => sum + submission.recordCount, 0),
      },
      semesterCredits,
      subjectCredits,
      submissions,
      notices: [
        "Credit and identity data shown here comes from institutional ERP records.",
        "Accepted or rejected status is based on a provider response recorded by the institution unless a verified API connector is active.",
        "Students cannot edit APAAR/ABC identity or academic credits directly; corrections must be requested from the administration or examination office.",
      ],
      generatedAt: new Date().toISOString(),
    };
  },
};
