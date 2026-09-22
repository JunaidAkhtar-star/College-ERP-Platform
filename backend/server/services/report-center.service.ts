import createError from "http-errors";
import mongoose, { Types, type Model } from "mongoose";
import { createHash, randomUUID } from "crypto";
import { AdmissionApplicationModel } from "../models/admission-application.model";
import { AttendanceRecordModel } from "../models/attendance.model";
import { StudentMarksModel } from "../models/examination.model";
import { FacultyProfileModel } from "../models/faculty-profile.model";
import { FeeRecordModel } from "../models/fee.model";
import {
  ReportDefinitionModel,
  ReportScheduleModel,
  ReportSnapshotModel,
  type IReportDefinition,
  type IReportFilter,
  type TReportDataset,
} from "../models/report-center.model";
import { StudentProfileModel } from "../models/student-profile.model";
import { nextSeq } from "../models/counter.model";
import { SystemRole } from "../constants/roles";
import { UserModel } from "../models/user.model";

interface IFieldDefinition {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "boolean";
  restrictedRoles?: string[];
}

interface IDatasetDefinition {
  key: TReportDataset;
  label: string;
  description: string;
  model: Model<unknown>;
  fields: IFieldDefinition[];
  scopeField?: string;
  asOfField?: string;
}

const CONTACT_ROLES = ["super_admin", "admin", "principal", "administration_office"];

const datasets: IDatasetDefinition[] = [
  {
    key: "students",
    label: "Students",
    description: "Student identity, academic placement and lifecycle status",
    model: StudentProfileModel as Model<unknown>,
    scopeField: "department",
    asOfField: "createdAt",
    fields: [
      { key: "rollNumber", label: "Roll number", type: "text" },
      { key: "registrationNumber", label: "Registration number", type: "text" },
      { key: "firstName", label: "First name", type: "text" },
      { key: "lastName", label: "Last name", type: "text" },
      { key: "program", label: "Program", type: "text" },
      { key: "batch", label: "Admission batch", type: "text" },
      { key: "currentSemester", label: "Current semester", type: "number" },
      { key: "currentYear", label: "Current year", type: "number" },
      { key: "section", label: "Section", type: "text" },
      { key: "academicYear", label: "Academic year", type: "text" },
      { key: "admissionType", label: "Admission type", type: "text" },
      { key: "admissionCategory", label: "Admission category", type: "text" },
      { key: "currentCgpa", label: "Current CGPA", type: "number" },
      { key: "totalBacklogs", label: "Total backlogs", type: "number" },
      { key: "isPlacementEligible", label: "Placement eligible", type: "boolean" },
      { key: "status", label: "Status", type: "text" },
      { key: "admissionDate", label: "Admission date", type: "date" },
      { key: "createdAt", label: "Created at", type: "date" },
    ],
  },
  {
    key: "faculty",
    label: "Faculty",
    description: "Faculty employment and academic profile",
    model: FacultyProfileModel as Model<unknown>,
    scopeField: "department",
    asOfField: "createdAt",
    fields: [
      { key: "employeeId", label: "Employee ID", type: "text" },
      { key: "firstName", label: "First name", type: "text" },
      { key: "lastName", label: "Last name", type: "text" },
      { key: "designation", label: "Designation", type: "text" },
      { key: "employmentType", label: "Employment type", type: "text" },
      { key: "joiningDate", label: "Joining date", type: "date" },
      { key: "highestQualification", label: "Highest qualification", type: "text" },
      { key: "specialization", label: "Specialization", type: "text" },
      { key: "totalTeachingExperience", label: "Teaching experience (years)", type: "number" },
      { key: "totalIndustryExperience", label: "Industry experience (years)", type: "number" },
      { key: "currentApiScore", label: "Current API score", type: "number" },
      { key: "patentsGranted", label: "Patents granted", type: "number" },
      { key: "status", label: "Status", type: "text" },
      { key: "createdAt", label: "Created at", type: "date" },
    ],
  },
  {
    key: "admissions",
    label: "Admissions",
    description: "Applications, programs and admission workflow status",
    model: AdmissionApplicationModel as Model<unknown>,
    asOfField: "createdAt",
    fields: [
      { key: "applicationNumber", label: "Application number", type: "text" },
      { key: "candidateName", label: "Candidate name", type: "text" },
      {
        key: "email",
        label: "Email",
        type: "text",
        restrictedRoles: CONTACT_ROLES,
      },
      {
        key: "phone",
        label: "Phone",
        type: "text",
        restrictedRoles: CONTACT_ROLES,
      },
      { key: "allocatedProgram", label: "Allocated program", type: "text" },
      { key: "admissionType", label: "Admission type", type: "text" },
      { key: "category", label: "Category", type: "text" },
      { key: "academicYear", label: "Academic year", type: "text" },
      { key: "meritScore", label: "Merit score", type: "number" },
      { key: "meritRank", label: "Merit rank", type: "number" },
      { key: "onboardStatus", label: "Onboarding status", type: "text" },
      { key: "submittedAt", label: "Submitted at", type: "date" },
      { key: "status", label: "Status", type: "text" },
      { key: "createdAt", label: "Applied at", type: "date" },
    ],
  },
  {
    key: "fees",
    label: "Fees",
    description: "Invoices, collections and outstanding balances",
    model: FeeRecordModel as Model<unknown>,
    scopeField: "departmentId",
    asOfField: "createdAt",
    fields: [
      { key: "invoiceNumber", label: "Invoice number", type: "text" },
      { key: "rollNumber", label: "Roll number", type: "text" },
      { key: "studentName", label: "Student name", type: "text" },
      { key: "program", label: "Program", type: "text" },
      { key: "branch", label: "Branch", type: "text" },
      { key: "semester", label: "Semester", type: "number" },
      { key: "academicYear", label: "Academic year", type: "text" },
      { key: "netDue", label: "Net due", type: "number" },
      { key: "grossAmount", label: "Gross amount", type: "number" },
      { key: "totalConcession", label: "Concession", type: "number" },
      { key: "totalScholarship", label: "Scholarship", type: "number" },
      { key: "totalPaid", label: "Paid", type: "number" },
      { key: "balanceDue", label: "Balance", type: "number" },
      { key: "lateFee", label: "Late fee", type: "number" },
      { key: "status", label: "Status", type: "text" },
      { key: "dueDate", label: "Due date", type: "date" },
    ],
  },
  {
    key: "attendance",
    label: "Attendance sessions",
    description: "Class attendance registers and strength summaries",
    model: AttendanceRecordModel as Model<unknown>,
    scopeField: "departmentId",
    asOfField: "date",
    fields: [
      { key: "date", label: "Date", type: "date" },
      { key: "subjectCode", label: "Subject code", type: "text" },
      { key: "subjectName", label: "Subject name", type: "text" },
      { key: "classType", label: "Class type", type: "text" },
      { key: "program", label: "Program", type: "text" },
      { key: "branch", label: "Branch", type: "text" },
      { key: "semester", label: "Semester", type: "number" },
      { key: "academicYear", label: "Academic year", type: "text" },
      { key: "section", label: "Section", type: "text" },
      { key: "periodNumber", label: "Period", type: "number" },
      { key: "startTime", label: "Start time", type: "text" },
      { key: "endTime", label: "End time", type: "text" },
      { key: "totalStrength", label: "Strength", type: "number" },
      { key: "totalPresent", label: "Present", type: "number" },
      { key: "totalAbsent", label: "Absent", type: "number" },
      { key: "isLocked", label: "Locked", type: "boolean" },
    ],
  },
  {
    key: "examinations",
    label: "Examination marks",
    description: "Published and draft student marks",
    model: StudentMarksModel as Model<unknown>,
    scopeField: "departmentId",
    asOfField: "createdAt",
    fields: [
      { key: "rollNumber", label: "Roll number", type: "text" },
      { key: "enrollmentNumber", label: "Enrollment number", type: "text" },
      { key: "subjectCode", label: "Subject code", type: "text" },
      { key: "examType", label: "Exam type", type: "text" },
      { key: "academicYear", label: "Academic year", type: "text" },
      { key: "semester", label: "Semester", type: "number" },
      { key: "internalTotal", label: "Internal marks", type: "number" },
      { key: "internalMax", label: "Internal maximum", type: "number" },
      { key: "externalMarks", label: "External marks", type: "number" },
      { key: "externalMax", label: "External maximum", type: "number" },
      { key: "totalMarks", label: "Total marks", type: "number" },
      { key: "totalMax", label: "Total maximum", type: "number" },
      { key: "percentage", label: "Percentage", type: "number" },
      { key: "gradeLetter", label: "Grade", type: "text" },
      { key: "gradePoint", label: "Grade point", type: "number" },
      { key: "isPassed", label: "Passed", type: "boolean" },
      { key: "isAbsent", label: "Absent", type: "boolean" },
      { key: "isWithheld", label: "Withheld", type: "boolean" },
      { key: "isPublished", label: "Published", type: "boolean" },
      { key: "createdAt", label: "Recorded at", type: "date" },
    ],
  },
];

const datasetMap = new Map(datasets.map((dataset) => [dataset.key, dataset]));

function datasetFor(key: string) {
  const dataset = datasetMap.get(key as TReportDataset);
  if (!dataset) throw createError(400, "Unsupported report dataset");
  return dataset;
}

function fieldsForRole(dataset: IDatasetDefinition, role: string) {
  return dataset.fields.filter(
    (field) => !field.restrictedRoles || field.restrictedRoles.includes(role),
  );
}

function validateFields(dataset: IDatasetDefinition, fields: string[], role: string) {
  const allowed = new Set(fieldsForRole(dataset, role).map((field) => field.key));
  if (!fields.length || fields.some((field) => !allowed.has(field)))
    throw createError(400, "Report contains unsupported fields");
}

function buildFilter(dataset: IDatasetDefinition, filters: IReportFilter[], role: string) {
  const allowed = new Map(fieldsForRole(dataset, role).map((field) => [field.key, field]));
  const query: Record<string, unknown> = {};
  const typedValue = (
    field: { type: "text" | "number" | "date" | "boolean" },
    rawValue: unknown,
  ) => {
    if (field.type === "number") {
      const number = Number(rawValue);
      if (!Number.isFinite(number))
        throw createError(400, "Enter a valid number in report filters");
      return number;
    }
    if (field.type === "boolean") return String(rawValue) === "true";
    if (field.type === "date") {
      const date = new Date(String(rawValue));
      if (Number.isNaN(date.getTime()))
        throw createError(400, "Enter a valid date in report filters");
      return date;
    }
    return rawValue;
  };
  for (const filter of filters) {
    const field = allowed.get(filter.field);
    if (!field) throw createError(400, `Unsupported filter field: ${filter.field}`);
    const value = typedValue(field, filter.value);
    if (filter.operator === "eq") query[filter.field] = value;
    else if (filter.operator === "ne") query[filter.field] = { $ne: value };
    else if (filter.operator === "contains")
      query[filter.field] = {
        $regex: String(filter.value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        $options: "i",
      };
    else if (filter.operator === "gte") query[filter.field] = { $gte: value };
    else if (filter.operator === "lte") query[filter.field] = { $lte: value };
    else if (filter.operator === "between")
      query[filter.field] = {
        $gte: value,
        $lte: typedValue(field, filter.secondValue),
      };
    else if (filter.operator === "in")
      query[filter.field] = {
        $in: Array.isArray(filter.value)
          ? filter.value
          : String(filter.value)
              .split(",")
              .map((item) => item.trim()),
      };
  }
  return query;
}

async function execute(
  definition: Pick<IReportDefinition, "dataset" | "columns" | "filters" | "sort">,
  limit = 100,
  context: { role: string; departmentId?: string; asOf?: Date },
) {
  const dataset = datasetFor(definition.dataset);
  validateFields(dataset, definition.columns, context.role);
  const sort = Object.fromEntries(
    definition.sort.map((item) => {
      validateFields(dataset, [item.field], context.role);
      return [item.field, item.direction === "desc" ? -1 : 1];
    }),
  ) as Record<string, 1 | -1>;
  const query = buildFilter(dataset, definition.filters, context.role);
  const departmentScoped = [SystemRole.HOD, SystemRole.FACULTY].includes(
    context.role as SystemRole,
  );
  if (departmentScoped) {
    if (!context.departmentId || !dataset.scopeField)
      throw createError(403, "This dataset is unavailable without a department-safe scope");
    query[dataset.scopeField] = new Types.ObjectId(context.departmentId);
  }
  if (context.asOf && dataset.asOfField) query[dataset.asOfField] = { $lte: context.asOf };
  const projection = Object.fromEntries(definition.columns.map((column) => [column, 1]));
  const [rows, total] = await Promise.all([
    dataset.model.find(query, projection).sort(sort).limit(Math.min(limit, 5000)).lean(),
    dataset.model.countDocuments(query),
  ]);
  return { rows, total, truncated: total > limit };
}

function definitionHash(data: Record<string, unknown>) {
  return createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

export const reportCenterService = {
  metadata: async (role: string, departmentId?: string) => {
    const departmentScoped = [SystemRole.HOD, SystemRole.FACULTY].includes(role as SystemRole);
    const optionFields = new Set([
      "program",
      "branch",
      "academicYear",
      "status",
      "semester",
      "currentSemester",
      "designation",
      "employmentType",
      "grade",
      "section",
    ]);
    const visibleDatasets = departmentScoped
      ? datasets.filter((dataset) => dataset.scopeField && departmentId)
      : datasets;
    return Promise.all(
      visibleDatasets.map(async (dataset) => {
        const fields = fieldsForRole(dataset, role);
        const scopeQuery =
          departmentScoped && dataset.scopeField && departmentId
            ? { [dataset.scopeField]: new Types.ObjectId(departmentId) }
            : {};
        return {
          key: dataset.key,
          label: dataset.label,
          description: dataset.description,
          asOfField: dataset.asOfField,
          fields: await Promise.all(
            fields.map(async (field) => ({
              ...field,
              options: optionFields.has(field.key)
                ? (
                    await dataset.model.distinct(field.key, {
                      ...scopeQuery,
                      [field.key]: { $nin: [null, ""] },
                    })
                  )
                    .slice(0, 100)
                    .map(String)
                : undefined,
            })),
          ),
        };
      }),
    );
  },
  list: async (userId: string, role: string) => {
    const reports = await ReportDefinitionModel.find({
      isActive: true,
      status: { $ne: "retired" },
      $or: [
        { createdBy: userId },
        { visibility: "institution" },
        { visibility: "roles", allowedRoles: role },
      ],
    })
      .sort({ updatedAt: -1 })
      .lean();
    return reports.map((report) => ({
      ...report,
      canEdit: String(report.createdBy) === userId,
      canApprove: report.submittedBy ? String(report.submittedBy) !== userId : false,
    }));
  },
  save: async (data: Partial<IReportDefinition>, userId: string, role: string, id?: string) => {
    if (!data.name || !data.dataset || !data.columns?.length)
      throw createError(400, "Name, dataset and columns are required");
    const dataset = datasetFor(data.dataset);
    validateFields(dataset, data.columns, role);
    buildFilter(dataset, data.filters ?? [], role);
    const definition = {
      name: data.name.trim(),
      description: data.description?.trim(),
      dataset: data.dataset,
      columns: data.columns,
      filters: data.filters ?? [],
      sort: data.sort ?? [],
      visibility: data.visibility ?? "private",
      allowedRoles: data.allowedRoles ?? [],
    };
    if (definition.visibility === "roles" && definition.allowedRoles.length === 0)
      throw createError(400, "Select at least one role for role-based visibility");
    const safe = {
      ...definition,
      definitionHash: definitionHash(definition),
      createdBy: userId,
      status: definition.visibility === "private" ? ("published" as const) : ("draft" as const),
      publishedBy: definition.visibility === "private" ? userId : undefined,
      publishedAt: definition.visibility === "private" ? new Date() : undefined,
      isActive: true,
    };
    if (id) {
      const prior = await ReportDefinitionModel.findOne({ _id: id, createdBy: userId }).lean();
      if (!prior) throw createError(404, "Editable report not found");
      return ReportDefinitionModel.create({
        ...safe,
        definitionKey: prior.definitionKey || randomUUID(),
        version: (prior.version || 1) + 1,
        previousVersionId: prior._id,
      });
    }
    return ReportDefinitionModel.create({
      ...safe,
      definitionKey: randomUUID(),
      version: 1,
    });
  },
  preview: (
    data: Pick<IReportDefinition, "dataset" | "columns" | "filters" | "sort">,
    context: { role: string; departmentId?: string; asOf?: Date },
  ) => execute(data, 100, context),
  exportAdHoc: (
    data: Pick<IReportDefinition, "dataset" | "columns" | "filters" | "sort">,
    context: { role: string; departmentId?: string; asOf?: Date },
  ) => execute(data, 5000, context),
  async submit(id: string, userId: string) {
    const row = await ReportDefinitionModel.findOneAndUpdate(
      { _id: id, createdBy: userId, status: "draft" },
      { $set: { status: "pending_approval", submittedBy: userId } },
      { returnDocument: "after" },
    ).lean();
    if (!row) throw createError(409, "Only an owned draft report can be submitted");
    return row;
  },
  async publish(id: string, reviewerId: string) {
    const row = await ReportDefinitionModel.findOne({ _id: id, status: "pending_approval" }).lean();
    if (!row) throw createError(409, "Only a submitted report can be published");
    if (String(row.submittedBy) === reviewerId)
      throw createError(409, "Report submitter cannot publish the same definition");
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await ReportDefinitionModel.updateMany(
          { definitionKey: row.definitionKey, status: "published" },
          { $set: { status: "retired", isActive: false } },
          { session },
        );
        const changed = await ReportDefinitionModel.updateOne(
          { _id: id, status: "pending_approval" },
          {
            $set: {
              status: "published",
              publishedBy: reviewerId,
              publishedAt: new Date(),
            },
          },
          { session },
        );
        if (changed.modifiedCount !== 1) throw createError(409, "Report was concurrently reviewed");
      });
    } finally {
      await session.endSession();
    }
    return ReportDefinitionModel.findById(id).lean();
  },
  run: async (
    id: string,
    userId: string,
    role: string,
    limit = 1000,
    departmentId?: string,
    asOf?: Date,
  ) => {
    const definition = await ReportDefinitionModel.findOne({
      _id: id,
      isActive: true,
      $or: [
        { createdBy: userId },
        { visibility: "institution" },
        { visibility: "roles", allowedRoles: role },
      ],
    }).lean();
    if (!definition) throw createError(404, "Report not found");
    if (definition.status !== "published" && String(definition.createdBy) !== userId)
      throw createError(403, "Only published reports can be shared");
    return {
      definition,
      ...(await execute(definition, limit, { role, departmentId, asOf })),
    };
  },
  async snapshot(
    id: string,
    userId: string,
    role: string,
    departmentId: string | undefined,
    asOf: Date,
    schedule?: { id: string; scheduledFor: Date },
  ) {
    if (schedule) {
      const existing = await ReportSnapshotModel.findOne({
        scheduleId: schedule.id,
        scheduledFor: schedule.scheduledFor,
      }).lean();
      if (existing) return existing;
    }
    const result = await this.run(id, userId, role, 5000, departmentId, asOf);
    const year = new Date().getFullYear();
    const sequence = await nextSeq(`report-snapshot-${year}`);
    const snapshotNumber = `RPT-${year}-${String(sequence).padStart(7, "0")}`;
    const hash = definitionHash({
      snapshotNumber,
      definitionHash: result.definition.definitionHash,
      asOf: asOf.toISOString(),
      rows: result.rows,
      total: result.total,
    });
    return ReportSnapshotModel.create({
      snapshotNumber,
      reportDefinitionId: result.definition._id,
      definitionKey: result.definition.definitionKey,
      definitionVersion: result.definition.version,
      definitionHash: result.definition.definitionHash,
      asOf,
      generatedBy: userId,
      generatedByRole: role,
      rowCount: result.rows.length,
      total: result.total,
      rows: result.rows,
      snapshotHash: hash,
      scheduleId: schedule?.id,
      scheduledFor: schedule?.scheduledFor,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    });
  },
  listSnapshots: (userId: string) =>
    ReportSnapshotModel.find({ generatedBy: userId })
      .select("-rows")
      .sort({ createdAt: -1 })
      .limit(500)
      .lean(),
  getSnapshot: (id: string, userId: string) =>
    ReportSnapshotModel.findOne({ _id: id, generatedBy: userId }).lean(),
  listSchedules: (userId: string) =>
    ReportScheduleModel.find({ createdBy: userId })
      .populate("reportDefinitionId", "name definitionKey version status")
      .populate("recipientUserIds", "name email roles")
      .sort({ createdAt: -1 })
      .lean(),
  async createSchedule(
    input: Partial<import("../models/report-center.model").IReportSchedule>,
    userId: string,
    role: string,
    departmentId?: string,
  ) {
    const report = await ReportDefinitionModel.findOne({
      _id: input.reportDefinitionId,
      status: "published",
      isActive: true,
      $or: [
        { createdBy: userId },
        { visibility: "institution" },
        { visibility: "roles", allowedRoles: role },
      ],
    }).lean();
    if (!report) throw createError(409, "Only an accessible published report can be scheduled");
    const recipientIds = Array.from(
      new Set((input.recipientUserIds ?? []).map((value) => String(value))),
    );
    const recipients = await UserModel.find({ _id: { $in: recipientIds } })
      .select("_id roles department")
      .lean();
    if (recipients.length !== recipientIds.length)
      throw createError(400, "One or more report recipients do not exist");
    if (
      report.visibility === "private" &&
      recipients.some((recipient) => String(recipient._id) !== userId)
    )
      throw createError(403, "Private reports can only be scheduled to yourself");
    if (
      report.visibility === "roles" &&
      recipients.some(
        (recipient) =>
          !recipient.roles.some((recipientRole) => report.allowedRoles.includes(recipientRole)),
      )
    )
      throw createError(403, "Every recipient must have a role allowed by this report");
    if (
      departmentId &&
      [SystemRole.HOD, SystemRole.FACULTY].includes(role as SystemRole) &&
      recipients.some((recipient) => String(recipient.department) !== departmentId)
    )
      throw createError(403, "Department-scoped reports cannot be sent outside your department");
    return ReportScheduleModel.create({
      ...input,
      recipientUserIds: recipientIds,
      createdBy: userId,
      createdByRole: role,
      departmentId,
    });
  },
  async setScheduleStatus(id: string, userId: string, status: "active" | "paused") {
    const schedule = await ReportScheduleModel.findOneAndUpdate(
      { _id: id, createdBy: userId },
      { $set: { status } },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!schedule) throw createError(404, "Owned report schedule not found");
    return schedule;
  },
};
