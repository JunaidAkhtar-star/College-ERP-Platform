import createError from "http-errors";
import { AssessmentScoreLedgerModel, GradebookStatus } from "../models/assessment-gradebook.model";
import { CurriculumModel } from "../models/curriculum.model";
import { FacultyProfileModel, FacultyStatus } from "../models/faculty-profile.model";
import { FeeRecordModel } from "../models/fee.model";
import {
  PlacementApplicationModel,
  PlacementApplicationStatus,
} from "../models/placement-application.model";
import { ResearchProjectModel, RndPublicationModel } from "../models/research-development.model";
import type { TRegulatoryProvider } from "../models/regulatory-integration.model";
import { StudentProfileModel, StudentStatus } from "../models/student-profile.model";

interface IRegulatoryIssue {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  entityType: string;
  entityId?: string;
  reference?: string;
}

interface IRegulatorySection {
  key: string;
  label: string;
  value: number;
  ready: number;
  description: string;
}

interface IRegulatoryRow {
  reference: string;
  name: string;
  category: string;
  status: "ready" | "warning" | "blocked";
  primaryValue: string;
  secondaryValue: string;
  issues: string[];
  payload?: Record<string, string | number>;
}

export interface IRegulatoryOperationalData {
  provider: TRegulatoryProvider;
  academicYear: string;
  generatedAt: string;
  source: "live_erp";
  summary: { total: number; ready: number; warnings: number; blocked: number; readiness: number };
  sections: IRegulatorySection[];
  issues: IRegulatoryIssue[];
  rows: IRegulatoryRow[];
  exportFields: string[];
}

const currentAcademicYear = () => {
  const now = new Date();
  const start = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
};

const summarize = (rows: IRegulatoryRow[]) => {
  const ready = rows.filter((row) => row.status === "ready").length;
  const warnings = rows.filter((row) => row.status === "warning").length;
  const blocked = rows.filter((row) => row.status === "blocked").length;
  return {
    total: rows.length,
    ready,
    warnings,
    blocked,
    readiness: rows.length ? Math.round((ready / rows.length) * 100) : 0,
  };
};

async function abcData(academicYear: string): Promise<IRegulatoryOperationalData> {
  const [students, ledgers, curricula] = await Promise.all([
    StudentProfileModel.find({
      status: {
        $in: [StudentStatus.ACTIVE, StudentStatus.LATERAL_PROMOTED, StudentStatus.PASSED_OUT],
      },
    })
      .select(
        "userId rollNumber firstName middleName lastName abcId program currentSemester semesterResults",
      )
      .lean(),
    AssessmentScoreLedgerModel.find({ academicYear, status: GradebookStatus.FROZEN })
      .select("studentId subjectId semester passed gradeLetter gradePoint")
      .lean(),
    CurriculumModel.find({ isActive: true }).select("program semesterPlans").lean(),
  ]);
  const studentByUser = new Map(students.map((student) => [String(student.userId), student]));
  const subjectById = new Map(
    curricula.flatMap((curriculum) =>
      curriculum.semesterPlans.flatMap((semester) =>
        semester.subjects.map(
          (subject) =>
            [
              String(subject.subjectId),
              {
                program: curriculum.program,
                subjectCode: subject.subjectCode,
                subjectName: subject.subjectName,
                credits: subject.credits,
              },
            ] as const,
        ),
      ),
    ),
  );
  const ledgerRows: IRegulatoryRow[] = ledgers.map((ledger) => {
    const student = studentByUser.get(String(ledger.studentId));
    const subject = subjectById.get(String(ledger.subjectId));
    const issues = [
      ...(student ? [] : ["Student profile is missing for this result ledger"]),
      ...(student?.abcId ? [] : ["Missing APAAR/ABC ID"]),
      ...(subject ? [] : ["Subject is not mapped to an active curriculum"]),
      ...(ledger.passed ? [] : ["Failed course credit cannot be deposited"]),
    ];
    return {
      reference: `${student?.rollNumber ?? String(ledger.studentId)}-${subject?.subjectCode ?? String(ledger.subjectId)}`,
      name: student
        ? [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" ")
        : "Unmapped student",
      category: `${subject?.program ?? student?.program ?? "Unmapped programme"} · ${subject?.subjectName ?? "Unmapped subject"}`,
      status: !student?.abcId || !subject || !ledger.passed ? "blocked" : "ready",
      primaryValue: student?.abcId || "ABC ID missing",
      secondaryValue: `${subject?.credits ?? 0} credits · Grade ${ledger.gradeLetter || "—"}`,
      issues,
      payload: {
        ABC_ID: student?.abcId ?? "",
        ROLL_NUMBER: student?.rollNumber ?? "",
        STUDENT_NAME: student
          ? [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" ")
          : "",
        PROGRAM: subject?.program ?? student?.program ?? "",
        SUBJECT_CODE: subject?.subjectCode ?? "",
        SUBJECT_NAME: subject?.subjectName ?? "",
        SEMESTER: ledger.semester,
        ACADEMIC_YEAR: academicYear,
        CREDITS_EARNED: ledger.passed ? (subject?.credits ?? 0) : 0,
        GRADE: ledger.gradeLetter,
        RESULT: ledger.passed ? "pass" : "fail",
      },
    };
  });
  const studentsWithLedger = new Set(ledgers.map((ledger) => String(ledger.studentId)));
  const fallbackRows: IRegulatoryRow[] = students
    .filter((student) => !studentsWithLedger.has(String(student.userId)))
    .flatMap<IRegulatoryRow>((student) => {
      const name = [student.firstName, student.middleName, student.lastName]
        .filter(Boolean)
        .join(" ");
      const results = student.semesterResults.filter(
        (result) => result.academicYear === academicYear,
      );
      if (!results.length) {
        return [
          {
            reference: student.rollNumber,
            name,
            category: student.program,
            status: "warning" as const,
            primaryValue: student.abcId || "ABC ID missing",
            secondaryValue: "No result for reporting year",
            issues: [
              ...(student.abcId ? [] : ["Missing APAAR/ABC ID"]),
              "No semester result available for the selected academic year",
            ],
            payload: {
              ABC_ID: student.abcId ?? "",
              ROLL_NUMBER: student.rollNumber,
              STUDENT_NAME: name,
              PROGRAM: student.program,
              SEMESTER: student.currentSemester,
              ACADEMIC_YEAR: academicYear,
              CREDITS_EARNED: 0,
              RESULT: "missing",
            },
          },
        ];
      }
      return results.map((result) => {
        const issues = [
          ...(student.abcId ? [] : ["Missing APAAR/ABC ID"]),
          ...(result.result === "pass" ? [] : [`Result is ${result.result}`]),
          ...(typeof result.creditsEarned === "number" ? [] : ["Credits earned are missing"]),
          "Subject-level frozen gradebook is unavailable; using semester summary",
        ];
        return {
          reference: `${student.rollNumber}-S${result.semesterNo}`,
          name,
          category: `${student.program} · Semester ${result.semesterNo}`,
          status:
            !student.abcId || typeof result.creditsEarned !== "number" ? "blocked" : "warning",
          primaryValue: student.abcId || "ABC ID missing",
          secondaryValue: `${result.creditsEarned ?? 0} credits earned`,
          issues,
          payload: {
            ABC_ID: student.abcId ?? "",
            ROLL_NUMBER: student.rollNumber,
            STUDENT_NAME: name,
            PROGRAM: student.program,
            SEMESTER: result.semesterNo,
            ACADEMIC_YEAR: academicYear,
            CREDITS_EARNED: result.creditsEarned ?? 0,
            RESULT: result.result,
          },
        } satisfies IRegulatoryRow;
      });
    });
  const rows = [...ledgerRows, ...fallbackRows];
  const issues: IRegulatoryIssue[] = rows.flatMap((row) =>
    row.issues.map((message) => ({
      severity: row.status === "blocked" ? "error" : "warning",
      code: message
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_|_$/g, ""),
      message,
      entityType: "student_credit",
      reference: row.reference,
    })),
  );
  const studentsWithId = students.filter((student) => student.abcId).length;
  const creditRows = rows.filter(
    (row) =>
      row.secondaryValue.includes("credits earned") || row.secondaryValue.includes("credits ·"),
  );
  return {
    provider: "abc",
    academicYear,
    generatedAt: new Date().toISOString(),
    source: "live_erp",
    summary: summarize(rows),
    sections: [
      {
        key: "identity",
        label: "Student identity",
        value: students.length,
        ready: studentsWithId,
        description: "Students mapped to an APAAR/ABC ID",
      },
      {
        key: "credits",
        label: "Credit records",
        value: creditRows.length,
        ready: creditRows.filter((row) => row.status === "ready").length,
        description: "Semester credit records ready for deposit",
      },
    ],
    issues,
    rows,
    exportFields: [
      "ABC_ID",
      "ROLL_NUMBER",
      "STUDENT_NAME",
      "PROGRAM",
      "SUBJECT_CODE",
      "SUBJECT_NAME",
      "SEMESTER",
      "ACADEMIC_YEAR",
      "CREDITS_EARNED",
      "GRADE",
      "RESULT",
    ],
  };
}

async function nadData(
  provider: "nad" | "digilocker",
  academicYear: string,
): Promise<IRegulatoryOperationalData> {
  const students = await StudentProfileModel.find({ "semesterResults.academicYear": academicYear })
    .select(
      "rollNumber registrationNumber firstName middleName lastName dateOfBirth program semesterResults",
    )
    .lean();
  const rows: IRegulatoryRow[] = students.flatMap((student) =>
    student.semesterResults
      .filter((result) => result.academicYear === academicYear)
      .map((result) => {
        const issues = [
          ...(student.registrationNumber ? [] : ["University registration number is missing"]),
          ...(result.marksheetUrl ? [] : ["Verified marksheet file is missing"]),
          ...(result.result === "withheld" ? ["Result is withheld"] : []),
        ];
        return {
          reference: `${student.rollNumber}-S${result.semesterNo}`,
          name: [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" "),
          category: `${student.program} · Marksheet`,
          status:
            !student.registrationNumber || result.result === "withheld"
              ? "blocked"
              : issues.length
                ? "warning"
                : "ready",
          primaryValue: `Semester ${result.semesterNo}`,
          secondaryValue: result.marksheetUrl ? "Award file available" : "Award file missing",
          issues,
          payload: {
            REGISTRATION_NUMBER: student.registrationNumber ?? "",
            ROLL_NUMBER: student.rollNumber,
            STUDENT_NAME: [student.firstName, student.middleName, student.lastName]
              .filter(Boolean)
              .join(" "),
            DATE_OF_BIRTH: new Date(student.dateOfBirth).toISOString().slice(0, 10),
            PROGRAM: student.program,
            SEMESTER: result.semesterNo,
            ACADEMIC_YEAR: academicYear,
            SGPA: result.sgpa ?? "",
            CGPA: result.cgpa ?? "",
            RESULT: result.result,
          },
        } satisfies IRegulatoryRow;
      }),
  );
  return {
    provider,
    academicYear,
    generatedAt: new Date().toISOString(),
    source: "live_erp",
    summary: summarize(rows),
    sections: [
      {
        key: "awards",
        label: "Academic awards",
        value: rows.length,
        ready: rows.filter((row) => row.status === "ready").length,
        description: "Marksheet records ready for NAD publication",
      },
      {
        key: "identity",
        label: "Registration mapping",
        value: rows.length,
        ready: rows.filter(
          (row) => !row.issues.includes("University registration number is missing"),
        ).length,
        description: "Awards with a university registration number",
      },
    ],
    issues: rows.flatMap((row) =>
      row.issues.map((message) => ({
        severity: row.status === "blocked" ? "error" : "warning",
        code: "NAD_DATA_GAP",
        message,
        entityType: "academic_award",
        reference: row.reference,
      })),
    ),
    rows,
    exportFields: [
      "REGISTRATION_NUMBER",
      "ROLL_NUMBER",
      "STUDENT_NAME",
      "DATE_OF_BIRTH",
      "PROGRAM",
      "SEMESTER",
      "ACADEMIC_YEAR",
      "SGPA",
      "CGPA",
      "RESULT",
    ],
  };
}

async function institutionalData(
  provider: "aishe" | "nirf",
  academicYear: string,
): Promise<IRegulatoryOperationalData> {
  const [students, faculty, curricula, fees, ledgers, publications, projects, placements] =
    await Promise.all([
      StudentProfileModel.find({ academicYear })
        .select("status gender category program currentYear abcId")
        .lean(),
      FacultyProfileModel.find({ status: FacultyStatus.ACTIVE })
        .select("gender category department highestQualification publications patentsGranted")
        .lean(),
      CurriculumModel.find({ isActive: true })
        .select("program academicLevel totalCreditsRequired semesterPlans")
        .lean(),
      FeeRecordModel.find({ academicYear }).select("netDue totalPaid balanceDue").lean(),
      AssessmentScoreLedgerModel.find({ academicYear, status: GradebookStatus.FROZEN })
        .select("passed percentage gradePoint")
        .lean(),
      RndPublicationModel.find({
        isDeleted: false,
        year: Number(academicYear.slice(0, 4)),
        verificationStatus: "verified",
      })
        .select("kind doi evidenceUrl")
        .lean(),
      ResearchProjectModel.find({ isDeleted: false })
        .select("status sanctionedAmount expenditureAmount intellectualProperty documents")
        .lean(),
      PlacementApplicationModel.find({
        status: { $in: [PlacementApplicationStatus.OFFERED, PlacementApplicationStatus.ACCEPTED] },
      })
        .select("outcomeVerified offeredPackage")
        .lean(),
    ]);
  const studentReady = students.filter(
    (student) => student.program && student.gender && student.category,
  ).length;
  const facultyReady = faculty.filter(
    (member) => member.department && member.highestQualification,
  ).length;
  const rows: IRegulatoryRow[] = [
    {
      reference: "STUDENTS",
      name: "Student enrolment",
      category: "Teaching, learning & outcomes",
      status: studentReady === students.length && students.length ? "ready" : "warning",
      primaryValue: String(students.length),
      secondaryValue: `${studentReady} complete records`,
      issues: students.length
        ? studentReady === students.length
          ? []
          : [`${students.length - studentReady} student records are incomplete`]
        : ["No students found for this academic year"],
    },
    {
      reference: "FACULTY",
      name: "Faculty strength",
      category: "Teaching resources",
      status: facultyReady === faculty.length && faculty.length ? "ready" : "warning",
      primaryValue: String(faculty.length),
      secondaryValue: `${facultyReady} complete records`,
      issues: faculty.length
        ? facultyReady === faculty.length
          ? []
          : [`${faculty.length - facultyReady} faculty records are incomplete`]
        : ["No active faculty records found"],
    },
    {
      reference: "PROGRAMMES",
      name: "Active programmes",
      category: "Academic structure",
      status: curricula.length ? "ready" : "blocked",
      primaryValue: String(curricula.length),
      secondaryValue: `${curricula.reduce((sum, item) => sum + item.totalCreditsRequired, 0)} defined credits`,
      issues: curricula.length ? [] : ["No active curriculum records found"],
    },
    {
      reference: "RESULTS",
      name: "Frozen result ledgers",
      category: "Graduation outcomes",
      status: ledgers.length ? "ready" : "warning",
      primaryValue: String(ledgers.length),
      secondaryValue: `${ledgers.filter((item) => item.passed).length} passed`,
      issues: ledgers.length ? [] : ["No frozen gradebook ledgers found for this year"],
    },
    {
      reference: "FINANCE",
      name: "Student fee position",
      category: "Financial resources",
      status: fees.length ? "ready" : "warning",
      primaryValue: `₹${fees.reduce((sum, item) => sum + item.netDue, 0).toLocaleString("en-IN")}`,
      secondaryValue: `₹${fees.reduce((sum, item) => sum + item.balanceDue, 0).toLocaleString("en-IN")} outstanding`,
      issues: fees.length ? [] : ["No fee records found for this year"],
    },
    ...(provider === "nirf"
      ? [
          {
            reference: "RESEARCH",
            name: "Verified research output",
            category: "Research and professional practice",
            status: publications.length ? ("ready" as const) : ("warning" as const),
            primaryValue: String(publications.length),
            secondaryValue: `${publications.filter((item) => item.doi).length} with DOI`,
            issues: publications.length
              ? []
              : ["No verified publications found for the reporting year"],
          },
          {
            reference: "PROJECTS",
            name: "Sponsored projects",
            category: "Research and professional practice",
            status: projects.length ? ("ready" as const) : ("warning" as const),
            primaryValue: String(projects.length),
            secondaryValue: `₹${projects.reduce((sum, item) => sum + (item.sanctionedAmount ?? 0), 0).toLocaleString("en-IN")} sanctioned`,
            issues: projects.length ? [] : ["No research projects found"],
          },
          {
            reference: "PLACEMENTS",
            name: "Verified placement outcomes",
            category: "Graduation outcomes",
            status: placements.some((item) => item.outcomeVerified)
              ? ("ready" as const)
              : ("warning" as const),
            primaryValue: String(placements.filter((item) => item.outcomeVerified).length),
            secondaryValue: `${placements.length} offers recorded`,
            issues: placements.some((item) => item.outcomeVerified)
              ? []
              : ["No verified placement outcomes found"],
          },
        ]
      : []),
  ];
  const issues = rows.flatMap((row) =>
    row.issues.map((message) => ({
      severity: row.status === "blocked" ? ("error" as const) : ("warning" as const),
      code: `${provider.toUpperCase()}_DATA_GAP`,
      message,
      entityType: "reporting_section",
      reference: row.reference,
    })),
  );
  return {
    provider,
    academicYear,
    generatedAt: new Date().toISOString(),
    source: "live_erp",
    summary: summarize(rows),
    sections: rows.map((row) => ({
      key: row.reference.toLowerCase(),
      label: row.name,
      value: Number(row.primaryValue.replace(/[^0-9.]/g, "")) || 0,
      ready: row.status === "ready" ? 1 : 0,
      description: row.secondaryValue,
    })),
    issues,
    rows: rows.map((row) => ({ ...row, payload: { [row.reference]: row.primaryValue } })),
    exportFields:
      provider === "aishe"
        ? ["STUDENTS", "FACULTY", "PROGRAMMES", "RESULTS", "FINANCE"]
        : [
            "STUDENTS",
            "FACULTY",
            "PROGRAMMES",
            "RESULTS",
            "FINANCE",
            "RESEARCH",
            "PROJECTS",
            "PLACEMENTS",
          ],
  };
}

export const regulatoryDataService = {
  async operational(provider: TRegulatoryProvider, academicYear = currentAcademicYear()) {
    if (!/^\d{4}-\d{2}$/.test(academicYear))
      throw createError(400, "Academic year must use YYYY-YY format.");
    if (provider === "abc") return abcData(academicYear);
    if (provider === "nad" || provider === "digilocker") return nadData(provider, academicYear);
    if (provider === "aishe" || provider === "nirf")
      return institutionalData(provider, academicYear);
    throw createError(404, "Operational data is not supported for this provider.");
  },
};
