import crypto from "crypto";
import bcrypt from "bcryptjs";
import createError from "http-errors";
import { Types, type Model } from "mongoose";
import { DepartmentModel, DepartmentStatus } from "../models/department.model";
import { CurriculumModel } from "../models/curriculum.model";
import { BatchModel, BatchStatus } from "../models/batch.model";
import { FacultyProfileModel } from "../models/faculty-profile.model";
import { FeeRecordModel } from "../models/fee.model";
import { ImportJobModel, type IImportJob, type TImportTarget } from "../models/import-center.model";
import { StudentProfileModel } from "../models/student-profile.model";
import { SubjectModel } from "../models/subject.model";
import { UserModel } from "../models/user.model";
import { jobQueueService } from "./job-queue.service";
import { SystemRole } from "../constants/roles";
import { userRepository } from "../repositories/user.repository";

type TFieldType = "text" | "number" | "date" | "boolean" | "email";
interface IImportField {
  key: string;
  label: string;
  type: TFieldType;
  required: boolean;
  aliases?: string[];
  example?: string;
}
interface ITargetDefinition {
  key: TImportTarget;
  label: string;
  description: string;
  uniqueField: string;
  matchFields?: string[];
  fields: IImportField[];
}

const addressFields: IImportField[] = [
  ["permanentAddress.line1", "Address", "text", true],
  ["permanentAddress.city", "City", "text", true],
  ["permanentAddress.district", "District", "text", true],
  ["permanentAddress.state", "State", "text", true],
  ["permanentAddress.pincode", "Pincode", "text", true],
  ["permanentAddress.country", "Country", "text", false],
].map(([key, label, type, required]) => ({
  key: String(key),
  label: String(label),
  type: type as TFieldType,
  required: Boolean(required),
}));

const targets: ITargetDefinition[] = [
  {
    key: "curricula",
    label: "Programs / curricula",
    description: "Create programme foundations before departments and batches",
    uniqueField: "program",
    matchFields: ["program", "regulationYear"],
    fields: [
      {
        key: "program",
        label: "Program",
        type: "text",
        required: true,
        aliases: ["course", "programme"],
        example: "B.Tech",
      },
      {
        key: "academicLevel",
        label: "Academic level",
        type: "text",
        required: true,
        example: "undergraduate",
      },
      {
        key: "regulationYear",
        label: "Regulation year",
        type: "text",
        required: true,
        example: "2026",
      },
      {
        key: "totalSemesters",
        label: "Total semesters",
        type: "number",
        required: true,
        example: "8",
      },
      {
        key: "totalCreditsRequired",
        label: "Credits required",
        type: "number",
        required: true,
        example: "160",
      },
      {
        key: "openForAdmissions",
        label: "Open for admissions",
        type: "boolean",
        required: false,
        example: "yes",
      },
    ],
  },
  {
    key: "departments",
    label: "Departments",
    description: "Create departments linked to an existing programme curriculum",
    uniqueField: "code",
    fields: [
      {
        key: "code",
        label: "Department code",
        type: "text",
        required: true,
        aliases: ["department_code"],
        example: "CSE",
      },
      { key: "name", label: "Department name", type: "text", required: true },
      {
        key: "shortName",
        label: "Short name",
        type: "text",
        required: true,
        example: "Dept. of CSE",
      },
      {
        key: "curriculumProgram",
        label: "Program",
        type: "text",
        required: true,
        aliases: ["programme"],
        example: "B.Tech",
      },
      {
        key: "curriculumRegulationYear",
        label: "Regulation year",
        type: "text",
        required: true,
        example: "2026",
      },
      { key: "intake", label: "Approved intake", type: "number", required: true, example: "60" },
      { key: "establishedYear", label: "Established year", type: "number", required: false },
      { key: "email", label: "Department email", type: "email", required: false },
      { key: "phone", label: "Department phone", type: "text", required: false },
      { key: "location", label: "Location", type: "text", required: false },
    ],
  },
  {
    key: "batches",
    label: "Batches",
    description: "Create batches linked to their programme and department",
    uniqueField: "name",
    matchFields: ["curriculumId", "departmentId", "admissionYear"],
    fields: [
      { key: "name", label: "Batch name", type: "text", required: true, example: "CSE 2026-30" },
      { key: "program", label: "Program", type: "text", required: true, example: "B.Tech" },
      {
        key: "regulationYear",
        label: "Regulation year",
        type: "text",
        required: true,
        example: "2026",
      },
      {
        key: "departmentCode",
        label: "Department code",
        type: "text",
        required: true,
        example: "CSE",
      },
      {
        key: "admissionYear",
        label: "Admission year",
        type: "number",
        required: true,
        example: "2026",
      },
      {
        key: "expectedGraduationYear",
        label: "Graduation year",
        type: "number",
        required: true,
        example: "2030",
      },
      { key: "intake", label: "Intake", type: "number", required: true, example: "60" },
      {
        key: "lateralEntryAllowed",
        label: "Lateral entry allowed",
        type: "boolean",
        required: false,
        example: "no",
      },
    ],
  },
  {
    key: "students",
    label: "Student profiles",
    description: "Create profiles for existing student user accounts",
    uniqueField: "rollNumber",
    fields: [
      {
        key: "userEmail",
        label: "Existing user email",
        type: "email",
        required: true,
        aliases: ["email"],
      },
      {
        key: "rollNumber",
        label: "Roll number",
        type: "text",
        required: true,
        aliases: ["roll", "roll_no"],
      },
      {
        key: "registrationNumber",
        label: "University registration",
        type: "text",
        required: false,
      },
      { key: "firstName", label: "First name", type: "text", required: true },
      { key: "lastName", label: "Last name", type: "text", required: true },
      { key: "dateOfBirth", label: "Date of birth", type: "date", required: true },
      { key: "gender", label: "Gender", type: "text", required: true, example: "male" },
      { key: "category", label: "Category", type: "text", required: true, example: "general" },
      { key: "collegeEmail", label: "College email", type: "email", required: true },
      { key: "phone", label: "Phone", type: "text", required: true },
      ...addressFields,
      { key: "program", label: "Program", type: "text", required: true, example: "B.Tech" },
      {
        key: "admissionType",
        label: "Admission type",
        type: "text",
        required: true,
        example: "regular",
      },
      {
        key: "admissionCategory",
        label: "Admission category",
        type: "text",
        required: true,
        example: "general",
      },
      { key: "batch", label: "Batch", type: "text", required: true, example: "2026-30" },
      { key: "academicYear", label: "Academic year", type: "text", required: true },
      { key: "currentSemester", label: "Semester", type: "number", required: true },
      { key: "currentYear", label: "Year", type: "number", required: true },
      { key: "departmentCode", label: "Department code", type: "text", required: true },
      { key: "admissionDate", label: "Admission date", type: "date", required: true },
      { key: "parentInfo.fatherName", label: "Father name", type: "text", required: true },
      { key: "parentInfo.fatherPhone", label: "Father phone", type: "text", required: true },
      { key: "parentInfo.motherName", label: "Mother name", type: "text", required: true },
    ],
  },
  {
    key: "faculty",
    label: "Faculty profiles",
    description: "Create profiles for existing faculty user accounts",
    uniqueField: "employeeId",
    fields: [
      {
        key: "userEmail",
        label: "Existing user email",
        type: "email",
        required: true,
        aliases: ["email"],
      },
      { key: "employeeId", label: "Employee ID", type: "text", required: true },
      { key: "firstName", label: "First name", type: "text", required: true },
      { key: "lastName", label: "Last name", type: "text", required: true },
      { key: "dateOfBirth", label: "Date of birth", type: "date", required: true },
      { key: "gender", label: "Gender", type: "text", required: true },
      { key: "category", label: "Category", type: "text", required: true },
      { key: "collegeEmail", label: "College email", type: "email", required: true },
      { key: "phone", label: "Phone", type: "text", required: true },
      ...addressFields,
      { key: "employmentType", label: "Employment type", type: "text", required: true },
      { key: "designation", label: "Designation", type: "text", required: true },
      { key: "departmentCode", label: "Department code", type: "text", required: true },
      { key: "joiningDate", label: "Joining date", type: "date", required: true },
      { key: "highestQualification", label: "Highest qualification", type: "text", required: true },
      { key: "specialization", label: "Specialization", type: "text", required: true },
    ],
  },
  {
    key: "subjects",
    label: "Subjects",
    description: "Import governed subject masters",
    uniqueField: "code",
    fields: [
      { key: "code", label: "Subject code", type: "text", required: true },
      { key: "name", label: "Subject name", type: "text", required: true },
      { key: "shortName", label: "Short name", type: "text", required: true },
      { key: "departmentCode", label: "Department code", type: "text", required: true },
      { key: "type", label: "Type", type: "text", required: true, example: "Theory" },
      { key: "category", label: "Category", type: "text", required: false, example: "Core" },
      { key: "credits", label: "Credits", type: "number", required: true },
      { key: "lectureHours", label: "Lecture hours", type: "number", required: false },
      { key: "tutorialHours", label: "Tutorial hours", type: "number", required: false },
      { key: "practicalHours", label: "Practical hours", type: "number", required: false },
      { key: "semester", label: "Semester", type: "number", required: false },
      { key: "program", label: "Program", type: "text", required: false },
      { key: "internalMarks", label: "Internal marks", type: "number", required: false },
      { key: "externalMarks", label: "External marks", type: "number", required: false },
      { key: "passMarksInternal", label: "Internal pass marks", type: "number", required: false },
      { key: "passMarksExternal", label: "External pass marks", type: "number", required: false },
    ],
  },
  {
    key: "fee_opening_balances",
    label: "Fee opening balances",
    description: "Create opening invoices from a prior system",
    uniqueField: "invoiceNumber",
    fields: [
      { key: "invoiceNumber", label: "Invoice number", type: "text", required: true },
      { key: "studentEmail", label: "Student email", type: "email", required: true },
      { key: "rollNumber", label: "Roll number", type: "text", required: true },
      { key: "studentName", label: "Student name", type: "text", required: true },
      { key: "program", label: "Program", type: "text", required: true },
      { key: "branch", label: "Branch", type: "text", required: true },
      { key: "semester", label: "Semester", type: "number", required: true },
      { key: "academicYear", label: "Academic year", type: "text", required: true },
      { key: "grossAmount", label: "Gross amount", type: "number", required: true },
      { key: "totalPaid", label: "Already paid", type: "number", required: true },
      { key: "dueDate", label: "Due date", type: "date", required: true },
    ],
  },
];

const targetMap = new Map(targets.map((target) => [target.key, target]));
const normalizedHeader = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    value = "",
    quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]!;
    if (char === '"' && quoted && input[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && input[index + 1] === "\n") index += 1;
      row.push(value);
      value = "";
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
    } else value += char;
  }
  if (value || row.length) {
    row.push(value);
    if (row.some((cell) => cell.trim())) rows.push(row);
  }
  if (quoted) throw createError(400, "CSV contains an unclosed quoted value");
  return rows;
}

function cast(value: string, type: TFieldType): unknown {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (type === "number") {
    const number = Number(trimmed);
    if (!Number.isFinite(number)) throw new Error("Must be a number");
    return number;
  }
  if (type === "boolean") {
    if (!["true", "false", "yes", "no", "1", "0"].includes(trimmed.toLowerCase()))
      throw new Error("Must be yes or no");
    return ["true", "yes", "1"].includes(trimmed.toLowerCase());
  }
  if (type === "date") {
    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) throw new Error("Must be a valid date");
    return date;
  }
  if (type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed))
    throw new Error("Must be a valid email");
  return trimmed;
}

function setPath(target: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split(".");
  let cursor = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index]!;
    const next = cursor[part];
    if (!next || typeof next !== "object" || Array.isArray(next)) cursor[part] = {};
    cursor = cursor[part] as Record<string, unknown>;
  }
  cursor[parts.at(-1)!] = value;
}

function autoMapping(headers: string[], target: ITargetDefinition) {
  const byNormalized = new Map<string, string>();
  for (const field of target.fields) {
    for (const candidate of [field.key, field.label, ...(field.aliases ?? [])])
      byNormalized.set(normalizedHeader(candidate), field.key);
  }
  return Object.fromEntries(
    headers.map((header) => [header, byNormalized.get(normalizedHeader(header)) ?? ""]),
  );
}

async function resolveReferences(target: TImportTarget, row: Record<string, unknown>) {
  if (target === "curricula") {
    return row;
  } else if (target === "departments") {
    const curriculum = await CurriculumModel.findOne({
      program: String(row["curriculumProgram"] ?? ""),
      regulationYear: String(row["curriculumRegulationYear"] ?? ""),
      isActive: true,
    })
      .select("_id program")
      .lean();
    if (!curriculum) throw new Error("Program and regulation year were not found");
    row["curriculumIds"] = [curriculum._id];
    row["programs"] = [curriculum.program];
    delete row["curriculumProgram"];
    delete row["curriculumRegulationYear"];
  } else if (target === "batches") {
    const [curriculum, department] = await Promise.all([
      CurriculumModel.findOne({
        program: String(row["program"] ?? ""),
        regulationYear: String(row["regulationYear"] ?? ""),
        isActive: true,
      })
        .select("_id program")
        .lean(),
      DepartmentModel.findOne({
        code: String(row["departmentCode"] ?? "").toUpperCase(),
        status: DepartmentStatus.ACTIVE,
      })
        .select("_id curriculumIds")
        .lean(),
    ]);
    if (!curriculum) throw new Error("Program and regulation year were not found");
    if (!department) throw new Error("Department code was not found or is inactive");
    if (!department.curriculumIds.some((id) => String(id) === String(curriculum._id)))
      throw new Error("Department is not linked to this program curriculum");
    row["curriculumId"] = curriculum._id;
    row["departmentId"] = department._id;
  } else if (target === "students" || target === "faculty") {
    const userEmail = String(row["userEmail"] ?? "").toLowerCase();
    const user = await UserModel.findOne({ email: userEmail }).select("_id roles").lean();
    if (!user && target === "faculty") throw new Error("Existing user email was not found");
    if (user && target === "students" && !user.roles.includes(SystemRole.STUDENT))
      throw new Error("Existing email belongs to a non-student account");
    delete row["userEmail"];
    const department = await DepartmentModel.findOne({
      code: String(row["departmentCode"] ?? ""),
    })
      .select("_id")
      .lean();
    if (!department) throw new Error("Department code was not found");
    if (user) row["userId"] = user._id;
    else {
      row["userId"] = new Types.ObjectId();
      row["__newStudentUser"] = {
        name: [row["firstName"], row["lastName"]].filter(Boolean).join(" "),
        email: userEmail,
        phone: row["phone"],
        studentId: row["rollNumber"],
        department: department._id,
      };
    }
    row["department"] = department._id;
    delete row["departmentCode"];
  } else if (target === "subjects") {
    const department = await DepartmentModel.findOne({
      code: String(row["departmentCode"] ?? ""),
    })
      .select("_id code")
      .lean();
    if (!department) throw new Error("Department code was not found");
    row["departmentId"] = department._id;
    row["departmentCode"] = department.code;
  } else if (target === "fee_opening_balances") {
    const user = await UserModel.findOne({ email: String(row["studentEmail"] ?? "") })
      .select("_id")
      .lean();
    if (!user) throw new Error("Student email was not found");
    row["studentId"] = user._id;
    delete row["studentEmail"];
  }
  return row;
}

async function prepare(target: TImportTarget, input: Record<string, unknown>, createdBy: string) {
  const row = await resolveReferences(target, { ...input });
  row["createdBy"] = new Types.ObjectId(createdBy);
  if (target === "curricula") {
    row["semesterPlans"] = [];
    row["programOutcomes"] = [];
    row["isActive"] = true;
    row["version"] = 1;
    row["openForAdmissions"] ??= true;
  }
  if (target === "departments") row["status"] = "Active";
  if (target === "batches") row["status"] = BatchStatus.ACTIVE;
  if (target === "students") {
    row["nationality"] ??= "Indian";
    row["status"] ??= "active";
  }
  if (target === "faculty") {
    row["nationality"] ??= "Indian";
    row["status"] ??= "active";
  }
  if (target === "subjects") {
    row["isActive"] = true;
    row["totalHours"] =
      Number(row["lectureHours"] ?? 0) +
      Number(row["tutorialHours"] ?? 0) +
      Number(row["practicalHours"] ?? 0);
    row["totalMarks"] = Number(row["internalMarks"] ?? 30) + Number(row["externalMarks"] ?? 70);
  }
  if (target === "fee_opening_balances") {
    const gross = Number(row["grossAmount"]);
    const paid = Number(row["totalPaid"]);
    row["feeItems"] = [
      { type: "Other", description: "Imported opening balance", amount: gross, isOptional: false },
    ];
    row["netDue"] = gross;
    row["balanceDue"] = Math.max(gross - paid, 0);
    row["status"] = paid >= gross ? "paid" : paid > 0 ? "partial" : "pending";
  }
  return row;
}

function modelFor(target: TImportTarget): Model<Record<string, unknown>> {
  if (target === "curricula") return CurriculumModel as unknown as Model<Record<string, unknown>>;
  if (target === "departments") return DepartmentModel as unknown as Model<Record<string, unknown>>;
  if (target === "batches") return BatchModel as unknown as Model<Record<string, unknown>>;
  if (target === "students")
    return StudentProfileModel as unknown as Model<Record<string, unknown>>;
  if (target === "faculty") return FacultyProfileModel as unknown as Model<Record<string, unknown>>;
  if (target === "subjects") return SubjectModel as unknown as Model<Record<string, unknown>>;
  return FeeRecordModel as unknown as Model<Record<string, unknown>>;
}

function matchQuery(target: ITargetDefinition, payload: Record<string, unknown>) {
  return Object.fromEntries(
    (target.matchFields ?? [target.uniqueField]).map((field) => [field, payload[field]]),
  );
}

function identityValue(target: ITargetDefinition, payload: Record<string, unknown>) {
  return (target.matchFields ?? [target.uniqueField])
    .map((field) =>
      String(payload[field] ?? "")
        .trim()
        .toLowerCase(),
    )
    .join("::");
}

interface ICacheEntry<T> {
  data: T;
  expiresAt: number;
}
const importListCache = new Map<string, ICacheEntry<unknown>>();

export function clearImportListCache() {
  importListCache.clear();
}

export const importCenterService = {
  metadata: () => targets,
  list: async (userId: string, canReviewAll = false) => {
    const cacheKey = `${userId}:${canReviewAll ? "all" : "own"}`;
    const now = Date.now();
    const cached = importListCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }
    const result = await ImportJobModel.find(canReviewAll ? {} : { createdBy: userId })
      .select("-stagedRows")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    importListCache.set(cacheKey, { data: result, expiresAt: now + 3000 });
    return result;
  },
  get: (id: string, userId: string, canReviewAll = false, withRows = false) =>
    ImportJobModel.findOne({ _id: id, ...(canReviewAll ? {} : { createdBy: userId }) })
      .select(withRows ? "+stagedRows" : "-stagedRows")
      .lean(),
  stage: async (
    fileName: string,
    file: Buffer,
    targetKey: string,
    mappingInput: Record<string, string> | undefined,
    userId: string,
    options: { skipDuplicates?: boolean; updateExisting?: boolean } = {},
  ) => {
    const target = targetMap.get(targetKey as TImportTarget);
    if (!target) throw createError(400, "Unsupported import target");
    if (file.length > 10 * 1024 * 1024) throw createError(413, "CSV must be 10 MB or smaller");
    const parsed = parseCsv(file.toString("utf8").replace(/^\uFEFF/, ""));
    if (parsed.length < 2)
      throw createError(400, "CSV must contain headers and at least one data row");
    if (parsed.length > 5001) throw createError(400, "A single import supports at most 5,000 rows");
    const headers = parsed[0]!.map((header) => header.trim());
    if (new Set(headers).size !== headers.length || headers.some((header) => !header))
      throw createError(400, "CSV headers must be non-empty and unique");
    const mapping = mappingInput ?? autoMapping(headers, target);
    const mappedFields = new Set(Object.values(mapping).filter(Boolean));
    const missing = target.fields.filter((field) => field.required && !mappedFields.has(field.key));
    if (missing.length)
      throw createError(
        400,
        `Map required fields: ${missing.map((field) => field.label).join(", ")}`,
      );
    const fields = new Map(target.fields.map((field) => [field.key, field]));
    const stagedRows: Record<string, unknown>[] = [];
    const seenUniqueValues = new Set<string>();
    let skippedRows = 0;
    const errors: { row: number; field?: string; value?: string; message: string }[] = [];
    for (let rowIndex = 1; rowIndex < parsed.length; rowIndex += 1) {
      const source = parsed[rowIndex]!;
      const output: Record<string, unknown> = {};
      let invalid = false;
      for (let columnIndex = 0; columnIndex < headers.length; columnIndex += 1) {
        const targetField = mapping[headers[columnIndex]!];
        if (!targetField) continue;
        const definition = fields.get(targetField);
        if (!definition) {
          invalid = true;
          errors.push({ row: rowIndex + 1, field: targetField, message: "Unknown mapped field" });
          continue;
        }
        try {
          const value = cast(source[columnIndex] ?? "", definition.type);
          if (value !== undefined) setPath(output, targetField, value);
        } catch (error) {
          invalid = true;
          errors.push({
            row: rowIndex + 1,
            field: targetField,
            value: String(source[columnIndex] ?? "").slice(0, 100),
            message: error instanceof Error ? error.message : "Invalid value",
          });
        }
      }
      for (const definition of target.fields.filter((field) => field.required)) {
        const value = definition.key
          .split(".")
          .reduce<unknown>(
            (current, part) =>
              current && typeof current === "object"
                ? (current as Record<string, unknown>)[part]
                : undefined,
            output,
          );
        if (value === undefined || value === "") {
          invalid = true;
          errors.push({
            row: rowIndex + 1,
            field: definition.key,
            message: `${definition.label} is required`,
          });
        }
      }
      if (!invalid) {
        try {
          const prepared = await prepare(target.key, output, userId);
          await new (modelFor(target.key))(prepared).validate();
          const uniqueValue = identityValue(target, prepared);
          if (seenUniqueValues.has(uniqueValue))
            throw new Error(`${target.label} contains a repeated ${target.uniqueField}`);
          seenUniqueValues.add(uniqueValue);
          const existing = await modelFor(target.key)
            .findOne(matchQuery(target, prepared))
            .select("_id")
            .lean();
          if (existing && options.updateExisting && prepared["__newStudentUser"]) {
            throw new Error(
              "Updating this student requires an existing Student account with the supplied email",
            );
          }
          if (existing && !options.updateExisting) {
            if (options.skipDuplicates !== false) {
              skippedRows += 1;
              continue;
            }
            throw new Error(`A record with this ${target.uniqueField} already exists`);
          }
          stagedRows.push(prepared);
        } catch (error) {
          errors.push({
            row: rowIndex + 1,
            message: error instanceof Error ? error.message : "Row validation failed",
          });
        }
      }
      if (errors.length > 1000) break;
    }
    const totalRows = parsed.length - 1;
    const validRows = stagedRows.length;
    const invalidRows = totalRows - validRows - skippedRows;
    const createdJob = await ImportJobModel.create({
      target: target.key,
      sourceFileName: fileName,
      sourceFileSize: file.length,
      sourceHash: crypto.createHash("sha256").update(file).digest("hex"),
      headers,
      mapping,
      options: {
        skipDuplicates: options.updateExisting ? false : options.skipDuplicates !== false,
        updateExisting: Boolean(options.updateExisting),
      },
      status: invalidRows ? "validation_failed" : "validated",
      totalRows,
      validRows,
      invalidRows,
      skippedRows,
      stagedRows: stagedRows.map((payload) => ({ payload })),
      rowErrors: errors,
      createdBy: userId,
    });
    clearImportListCache();
    return createdJob;
  },
  queueCommit: async (id: string, userId: string) => {
    const session = await ImportJobModel.db.startSession();
    try {
      const job = await session.withTransaction<IImportJob>(async () => {
        const queuedJob = await ImportJobModel.findOneAndUpdate(
          {
            _id: id,
            status: { $in: ["validated", "validation_failed"] },
            validRows: { $gt: 0 },
          },
          { $set: { status: "queued" } },
          { returnDocument: "after", session },
        ).select("+stagedRows");
        if (!queuedJob) throw createError(409, "Import job is unavailable or cannot be committed");
        await jobQueueService.enqueue(
          "import-center.commit",
          `import-commit:${queuedJob._id}`,
          { importJobId: String(queuedJob._id), userId },
          { session },
        );
        return queuedJob;
      });
      if (!job) throw createError(500, "Import commit transaction did not return a job");
      clearImportListCache();
      return job;
    } finally {
      await session.endSession();
    }
  },
  commit: async (id: string, userId: string) => {
    const job = await ImportJobModel.findOne({
      _id: id,
      status: { $in: ["queued", "committing"] },
    }).select("+stagedRows +committedRecordIds");
    if (!job) throw createError(404, "Queued import job not found");
    job.status = "committing";
    await job.save();
    let committed = job.committedRows;
    let updated = job.updatedRows;
    let failed = job.failedRows;
    const committedRecordIds: Types.ObjectId[] = [...(job.committedRecordIds ?? [])];
    const committedUserIds: Types.ObjectId[] = [...(job.committedUserIds ?? [])];
    const failures: typeof job.rowErrors = [];
    for (let index = job.processedRows; index < job.stagedRows.length; index += 1) {
      let createdStudentUserId: Types.ObjectId | undefined;
      try {
        const payload = { ...job.stagedRows[index]!.payload };
        const target = targetMap.get(job.target)!;
        let updatedExisting = false;
        const newStudentUser = payload["__newStudentUser"] as Record<string, unknown> | undefined;
        delete payload["__newStudentUser"];
        if (job.target === "students" && newStudentUser) {
          const createdUser = await userRepository.create({
            ...newStudentUser,
            password: await bcrypt.hash(crypto.randomBytes(32).toString("base64url"), 12),
            mustChangePassword: true,
            roles: [SystemRole.STUDENT],
            status: "active",
          });
          createdStudentUserId = new Types.ObjectId(String(createdUser._id));
          payload["userId"] = createdStudentUserId;
        }
        if (job.options.updateExisting) {
          const updatePayload = { ...payload };
          delete updatePayload["createdBy"];
          const existing = await modelFor(job.target)
            .findOneAndUpdate(
              matchQuery(target, payload),
              { $set: updatePayload },
              { returnDocument: "after", runValidators: true, upsert: false },
            )
            .lean();
          if (existing) {
            updated += 1;
            updatedExisting = true;
          }
        }
        if (!updatedExisting) {
          const created = await modelFor(job.target).create(payload);
          committedRecordIds.push(new Types.ObjectId(String(created._id)));
          if (createdStudentUserId) committedUserIds.push(createdStudentUserId);
          committed += 1;
        }
      } catch (error) {
        failed += 1;
        if (createdStudentUserId) await UserModel.deleteOne({ _id: createdStudentUserId });
        failures.push({
          row: index + 2,
          message:
            error instanceof Error && error.name === "ValidationError"
              ? "One or more values did not meet the required format"
              : "This row could not be written. Review its mapped values and try again.",
        });
      }
      job.processedRows = index + 1;
      job.committedRows = committed;
      job.updatedRows = updated;
      job.failedRows = failed;
      job.committedRecordIds = committedRecordIds;
      job.committedUserIds = committedUserIds;
      if (failures.length) {
        job.rowErrors.push(
          ...failures.splice(0, failures.length).slice(0, Math.max(0, 1000 - job.rowErrors.length)),
        );
      }
      // Persist every row. This favors crash-safe resumability over maximum import throughput.
      await job.save();
    }
    job.committedRows = committed;
    job.failedRows = failed;
    job.updatedRows = updated;
    job.committedRecordIds = committedRecordIds;
    job.committedUserIds = committedUserIds;
    job.rowErrors.push(...failures.slice(0, Math.max(0, 1000 - job.rowErrors.length)));
    job.status = job.failedRows ? (committed ? "partially_completed" : "failed") : "completed";
    job.committedBy = new Types.ObjectId(userId);
    job.committedAt = new Date();
    job.stagedRows = [];
    await job.save();
    clearImportListCache();
    return job;
  },
  cancel: async (id: string, userId: string) => {
    const job = await ImportJobModel.findOneAndUpdate(
      {
        _id: id,
        createdBy: userId,
        status: { $in: ["uploaded", "validated", "validation_failed"] },
      },
      { $set: { status: "cancelled", cancelledAt: new Date(), stagedRows: [] } },
      { returnDocument: "after" },
    ).lean();
    if (!job) throw createError(409, "Import job cannot be cancelled");
    clearImportListCache();
    return job;
  },
  rollback: async (id: string, userId: string) => {
    const job = await ImportJobModel.findOne({
      _id: id,
      status: { $in: ["completed", "partially_completed"] },
    }).select("+committedRecordIds +committedUserIds");
    if (!job) throw createError(409, "Only a completed import can be rolled back");
    if (job.updatedRows > 0)
      throw createError(409, "Imports that updated existing records require manual correction");
    if (!job.committedRecordIds.length)
      throw createError(409, "This import has no newly created records to roll back");
    const rollbackDeadline = new Date((job.committedAt?.getTime() ?? 0) + 24 * 60 * 60 * 1000);
    if (new Date() > rollbackDeadline)
      throw createError(409, "The 24-hour safe rollback window has closed");
    await modelFor(job.target).deleteMany({ _id: { $in: job.committedRecordIds } });
    if (job.target === "students" && job.committedUserIds?.length) {
      await UserModel.deleteMany({ _id: { $in: job.committedUserIds }, roles: SystemRole.STUDENT });
    }
    job.status = "rolled_back";
    job.rolledBackAt = new Date();
    job.rolledBackBy = new Types.ObjectId(userId);
    await job.save();
    clearImportListCache();
    return job;
  },
};
