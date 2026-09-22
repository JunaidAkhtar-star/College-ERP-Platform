import createError from "http-errors";
import { Types } from "mongoose";
import {
  CampusCalendarModel,
  CampusModel,
  CampusSharedServiceModel,
  CampusUserAssignmentModel,
} from "../models/campus-governance.model";
import { DepartmentModel } from "../models/department.model";
import { FacultyProfileModel, FacultyStatus } from "../models/faculty-profile.model";
import { FeeRecordModel } from "../models/fee.model";
import { StudentProfileModel, StudentStatus } from "../models/student-profile.model";
import { UserModel } from "../models/user.model";

async function validateParent(parentId?: string, selfId?: string) {
  if (!parentId) return;
  if (parentId === selfId) throw createError(400, "A campus cannot be its own parent");
  let current = await CampusModel.findById(parentId).select("parentCampusId").lean();
  if (!current) throw createError(404, "Parent campus not found");
  let depth = 0;
  while (current?.parentCampusId) {
    if (String(current.parentCampusId) === selfId)
      throw createError(409, "Campus hierarchy cannot contain a cycle");
    if (++depth > 10) throw createError(409, "Campus hierarchy cannot exceed ten levels");
    current = await CampusModel.findById(current.parentCampusId).select("parentCampusId").lean();
  }
}
function validateEvents(events: Array<{ startAt: string; endAt: string }>) {
  return events.map((event) => {
    const startAt = new Date(event.startAt),
      endAt = new Date(event.endAt);
    if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime()) || endAt < startAt)
      throw createError(400, "Every campus calendar event requires ordered dates");
    return { ...event, startAt, endAt };
  });
}

export const campusGovernanceService = {
  listCampuses: (filter: Record<string, unknown>) =>
    CampusModel.find(filter).populate("parentCampusId", "code name").sort({ code: 1 }).lean(),
  getCampus: async (id: string) => {
    const campus = await CampusModel.findById(id).lean();
    if (!campus) throw createError(404, "Campus not found");
    return campus;
  },
  saveCampus: async (actorId: string, input: Record<string, unknown>, id?: string) => {
    const parentCampusId = input.parentCampusId ? String(input.parentCampusId) : undefined;
    await validateParent(parentCampusId, id);
    const data = {
      code: String(input.code).trim().toUpperCase(),
      name: String(input.name).trim(),
      type: input.type as "campus" | "school" | "learning_center",
      parentCampusId,
      timezone: String(input.timezone ?? "Asia/Kolkata"),
      address: input.address as {
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
      },
      contactEmail: input.contactEmail ? String(input.contactEmail) : undefined,
      contactPhone: input.contactPhone ? String(input.contactPhone) : undefined,
      status: input.status as "planned" | "active" | "inactive" | "closed",
      openedAt: input.openedAt ? new Date(String(input.openedAt)) : undefined,
      closedAt: input.closedAt ? new Date(String(input.closedAt)) : undefined,
    };
    if (data.status === "closed" && !data.closedAt)
      throw createError(400, "Closed campuses require a closure date");
    return id
      ? CampusModel.findByIdAndUpdate(
          id,
          { $set: { ...data, updatedBy: actorId } },
          { returnDocument: "after", runValidators: true },
        ).lean()
      : CampusModel.create({ ...data, createdBy: actorId });
  },
  bindDepartment: async (departmentId: string, campusId: string, actorId: string) => {
    const [campus, department] = await Promise.all([
      CampusModel.findOne({ _id: campusId, status: { $ne: "closed" } }).lean(),
      DepartmentModel.findById(departmentId).lean(),
    ]);
    if (!campus || !department) throw createError(404, "Campus or department not found");
    const collision = await DepartmentModel.exists({
      _id: { $ne: departmentId },
      campusId,
      code: department.code,
    });
    if (collision)
      throw createError(409, "This department code already exists at the selected campus");
    return DepartmentModel.findByIdAndUpdate(
      departmentId,
      { $set: { campusId, updatedBy: actorId } },
      { returnDocument: "after" },
    ).lean();
  },
  assignments: (campusIds?: string[]) =>
    CampusUserAssignmentModel.find({
      status: "active",
      ...(campusIds ? { campusId: { $in: campusIds } } : {}),
    })
      .populate("campusId", "code name")
      .populate("userId", "name email roles")
      .sort({ createdAt: -1 })
      .lean(),
  assignmentById: async (id: string) => {
    const item = await CampusUserAssignmentModel.findById(id).lean();
    if (!item) throw createError(404, "Campus assignment not found");
    return item;
  },
  assignUser: async (
    actorId: string,
    input: {
      campusId: string;
      userId: string;
      scopeRole: "leader" | "academic" | "finance" | "operations" | "viewer";
      isPrimary?: boolean;
      startsAt: string;
      endsAt?: string;
    },
  ) => {
    const [campus, user] = await Promise.all([
      CampusModel.exists({ _id: input.campusId, status: { $ne: "closed" } }),
      UserModel.exists({ _id: input.userId, status: "active" }),
    ]);
    if (!campus || !user) throw createError(404, "Active campus or user not found");
    const startsAt = new Date(input.startsAt),
      endsAt = input.endsAt ? new Date(input.endsAt) : undefined;
    if (!Number.isFinite(startsAt.getTime()) || (endsAt && endsAt <= startsAt))
      throw createError(400, "Campus assignment dates are invalid");
    if (input.isPrimary)
      await CampusUserAssignmentModel.updateMany(
        { userId: input.userId, isPrimary: true, status: "active" },
        { $set: { isPrimary: false, updatedBy: actorId } },
      );
    return CampusUserAssignmentModel.create({
      ...input,
      startsAt,
      endsAt,
      assignedBy: actorId,
      createdBy: actorId,
    });
  },
  revokeAssignment: async (id: string, actorId: string) => {
    const item = await CampusUserAssignmentModel.findOneAndUpdate(
      { _id: id, status: "active" },
      {
        $set: { status: "revoked", revokedAt: new Date(), revokedBy: actorId, updatedBy: actorId },
      },
      { returnDocument: "after" },
    ).lean();
    if (!item) throw createError(409, "Campus assignment is no longer active");
    return item;
  },
  calendars: (campusIds?: string[]) =>
    CampusCalendarModel.find({ ...(campusIds ? { campusId: { $in: campusIds } } : {}) })
      .populate("campusId", "code name")
      .sort({ academicYear: -1 })
      .lean(),
  calendarById: async (id: string) => {
    const item = await CampusCalendarModel.findById(id).lean();
    if (!item) throw createError(404, "Campus calendar not found");
    return item;
  },
  saveCalendar: async (actorId: string, input: Record<string, unknown>) => {
    const campusId = String(input.campusId);
    if (!/^\d{4}-\d{2}$/.test(String(input.academicYear))) {
      throw createError(400, "Academic year must use YYYY-YY format");
    }
    if (!(await CampusModel.exists({ _id: campusId, status: { $ne: "closed" } }))) {
      throw createError(404, "Active or planned campus not found");
    }
    return CampusCalendarModel.create({
      campusId,
      academicYear: String(input.academicYear),
      name: String(input.name),
      events: validateEvents((input.events ?? []) as Array<{ startAt: string; endAt: string }>),
      createdBy: actorId,
    });
  },
  publishCalendar: async (id: string, actorId: string) => {
    const item = await CampusCalendarModel.findOneAndUpdate(
      { _id: id, status: "draft", createdBy: { $ne: actorId } },
      { $set: { status: "published", publishedAt: new Date(), publishedBy: actorId } },
      { returnDocument: "after" },
    ).lean();
    if (!item) throw createError(409, "Publication requires a draft and an independent approver");
    return item;
  },
  effectiveCalendar: async (campusId: string, academicYear: string) => {
    const campus = await CampusModel.findById(campusId).select("parentCampusId").lean();
    if (!campus) throw createError(404, "Campus not found");
    const ids = [new Types.ObjectId(campusId)];
    let parentId = campus.parentCampusId;
    let depth = 0;
    while (parentId && depth++ < 10) {
      ids.push(parentId);
      const parent = await CampusModel.findById(parentId).select("parentCampusId").lean();
      if (!parent) break;
      parentId = parent.parentCampusId;
    }
    const rows = await CampusCalendarModel.find({
      campusId: { $in: ids },
      academicYear,
      status: "published",
    }).lean();
    return rows
      .flatMap((row) =>
        row.events.map((event) => ({
          ...event,
          inheritedFromParent: String(row.campusId) !== campusId,
        })),
      )
      .sort((left, right) => left.startAt.getTime() - right.startAt.getTime());
  },
  sharedServices: (campusIds?: string[]) =>
    CampusSharedServiceModel.find({
      ...(campusIds
        ? {
            $or: [
              { providerCampusId: { $in: campusIds } },
              { consumerCampusIds: { $in: campusIds } },
            ],
          }
        : {}),
    })
      .populate("providerCampusId consumerCampusIds", "code name")
      .populate("ownerId", "name email")
      .sort({ code: 1 })
      .lean(),
  createSharedService: async (actorId: string, input: Record<string, unknown>) => {
    const provider = String(input.providerCampusId),
      ownerId = String(input.ownerId),
      consumers = [...new Set((input.consumerCampusIds as string[]).map(String))].filter(
        (id) => id !== provider,
      );
    if (!consumers.length) throw createError(400, "Select at least one different consumer campus");
    const [count, owner] = await Promise.all([
      CampusModel.countDocuments({
        _id: { $in: [provider, ...consumers] },
        status: { $ne: "closed" },
      }),
      UserModel.exists({ _id: ownerId, status: "active" }),
    ]);
    if (count !== consumers.length + 1)
      throw createError(400, "Every shared-service campus must be active or planned");
    if (!owner) throw createError(404, "Active shared-service owner not found");
    const startsAt = new Date(String(input.startsAt)),
      endsAt = input.endsAt ? new Date(String(input.endsAt)) : undefined;
    if (!Number.isFinite(startsAt.getTime()) || (endsAt && endsAt <= startsAt))
      throw createError(400, "Shared-service dates are invalid");
    return CampusSharedServiceModel.create({
      code: String(input.code),
      name: String(input.name),
      serviceType: input.serviceType as
        | "library"
        | "transport"
        | "procurement"
        | "finance"
        | "hr"
        | "it"
        | "admissions"
        | "other",
      providerCampusId: provider,
      consumerCampusIds: consumers,
      allocationMethod: input.allocationMethod as "equal" | "headcount" | "usage" | "fixed",
      annualBudget: input.annualBudget === undefined ? undefined : Number(input.annualBudget),
      startsAt,
      endsAt,
      status: input.status as "draft" | "active" | "suspended" | "ended",
      ownerId,
      createdBy: actorId,
    });
  },
  metrics: async (campusIds?: string[]) => {
    const campuses = await CampusModel.find({ ...(campusIds ? { _id: { $in: campusIds } } : {}) })
      .select("_id code name status")
      .lean();
    if (!campuses.length) return [];

    const allCampusIds = campuses.map((c) => c._id);
    const departments = await DepartmentModel.find({ campusId: { $in: allCampusIds } })
      .select("_id campusId")
      .lean();

    const campusDeptMap = new Map<string, string[]>();
    const allDeptIds: Types.ObjectId[] = [];
    departments.forEach((dept) => {
      const cId = String(dept.campusId);
      if (!campusDeptMap.has(cId)) campusDeptMap.set(cId, []);
      campusDeptMap.get(cId)!.push(String(dept._id));
      allDeptIds.push(dept._id as unknown as Types.ObjectId);
    });

    const [studentsByDept, facultyByDept, feesByDept] = await Promise.all([
      allDeptIds.length
        ? StudentProfileModel.aggregate<{ _id: Types.ObjectId; count: number }>([
            { $match: { department: { $in: allDeptIds }, status: StudentStatus.ACTIVE } },
            { $group: { _id: "$department", count: { $sum: 1 } } },
          ])
        : [],
      allDeptIds.length
        ? FacultyProfileModel.aggregate<{ _id: Types.ObjectId; count: number }>([
            { $match: { department: { $in: allDeptIds }, status: FacultyStatus.ACTIVE } },
            { $group: { _id: "$department", count: { $sum: 1 } } },
          ])
        : [],
      allDeptIds.length
        ? FeeRecordModel.aggregate<{
            _id: Types.ObjectId;
            assessed: number;
            collected: number;
            outstanding: number;
          }>([
            { $match: { departmentId: { $in: allDeptIds } } },
            {
              $group: {
                _id: "$departmentId",
                assessed: { $sum: "$netDue" },
                collected: { $sum: "$totalPaid" },
                outstanding: { $sum: "$balanceDue" },
              },
            },
          ])
        : [],
    ]);

    const studentMap = new Map<string, number>(studentsByDept.map((r) => [String(r._id), r.count]));
    const facultyMap = new Map<string, number>(facultyByDept.map((r) => [String(r._id), r.count]));
    const feeMap = new Map<string, { assessed: number; collected: number; outstanding: number }>(
      feesByDept.map((r) => [
        String(r._id),
        { assessed: r.assessed, collected: r.collected, outstanding: r.outstanding },
      ]),
    );

    return campuses.map((campus) => {
      const cId = String(campus._id);
      const deptIds = campusDeptMap.get(cId) ?? [];
      let totalStudents = 0;
      let totalFaculty = 0;
      const finance = { assessed: 0, collected: 0, outstanding: 0 };

      deptIds.forEach((dId) => {
        totalStudents += studentMap.get(dId) ?? 0;
        totalFaculty += facultyMap.get(dId) ?? 0;
        const f = feeMap.get(dId);
        if (f) {
          finance.assessed += f.assessed;
          finance.collected += f.collected;
          finance.outstanding += f.outstanding;
        }
      });

      return {
        campus,
        departments: deptIds.length,
        students: totalStudents,
        faculty: totalFaculty,
        finance,
      };
    });
  },
};
