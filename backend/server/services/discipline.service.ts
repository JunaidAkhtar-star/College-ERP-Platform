import createError from "http-errors";
import mongoose, { Types } from "mongoose";
import { nextSeq } from "../models/counter.model";
import {
  DisciplineCategoryModel,
  DisciplineEventModel,
  DisciplineIncidentModel,
  DisciplineSanctionModel,
  type IDisciplineIncident,
} from "../models/discipline.model";
import { UserModel } from "../models/user.model";
import { NotificationType } from "../models/notification.model";
import { notifyUsers } from "./helpers/notify.helper";

const managerRoles = new Set([
  "super_admin",
  "admin",
  "principal",
  "dean_academic",
  "hod",
  "administration_office",
]);
const transitions: Record<IDisciplineIncident["status"], IDisciplineIncident["status"][]> = {
  reported: ["triage", "dismissed"],
  triage: ["investigation", "hearing", "dismissed"],
  investigation: ["hearing", "decided", "dismissed"],
  hearing: ["decided", "dismissed"],
  decided: ["appealed", "closed"],
  appealed: ["hearing", "decided", "closed"],
  closed: [],
  dismissed: [],
};
export const canTransitionDisciplineStatus = (
  from: IDisciplineIncident["status"],
  to: IDisciplineIncident["status"],
) => transitions[from].includes(to);

interface IIdentity {
  id: string;
  name: string;
  roles: string[];
}
const isManager = (roles: string[]) => roles.some((role) => managerRoles.has(role));
function validId(id: string, label: string) {
  if (!Types.ObjectId.isValid(id)) throw createError(400, `Invalid ${label}`);
}
async function accessibleIncident(id: string, user: IIdentity) {
  validId(id, "incident identifier");
  const scope = isManager(user.roles)
    ? { _id: id }
    : {
        _id: id,
        $or: [
          { reportedBy: user.id },
          { accusedUserIds: user.id },
          { witnessUserIds: user.id },
          { assignedTo: user.id },
        ],
      };
  const row = await DisciplineIncidentModel.findOne(scope)
    .populate("categoryId", "name code")
    .populate("accusedUserIds", "name email roles")
    .populate("witnessUserIds", "name email")
    .populate("assignedTo", "name email")
    .lean();
  if (!row) throw createError(404, "Discipline incident not found");
  return row;
}

export const disciplineService = {
  metadata: async () => ({
    categories: await DisciplineCategoryModel.find({ isActive: true }).sort({ name: 1 }).lean(),
    severities: ["minor", "moderate", "major", "critical"],
    sanctionTypes: [
      "warning",
      "community_service",
      "fine",
      "suspension",
      "restriction",
      "rustication",
      "other",
    ],
    statuses: Object.keys(transitions),
  }),
  createCategory: async (
    data: {
      name: string;
      code: string;
      description?: string;
      defaultSeverity: "minor" | "moderate" | "major" | "critical";
    },
    userId: string,
  ) => DisciplineCategoryModel.create({ ...data, createdBy: userId }),
  people: async (query: string) => {
    const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (escaped.length < 2) return [];
    return UserModel.find({
      status: "active",
      $or: [
        { name: { $regex: escaped, $options: "i" } },
        { email: { $regex: escaped, $options: "i" } },
        { studentId: { $regex: escaped, $options: "i" } },
        { employeeId: { $regex: escaped, $options: "i" } },
      ],
    })
      .select("name email roles studentId employeeId")
      .limit(30)
      .lean();
  },
  list: (user: IIdentity, filter: { status?: string; severity?: string }) => {
    const scope: Record<string, unknown> = {};
    if (filter.status) scope["status"] = filter.status;
    if (filter.severity) scope["severity"] = filter.severity;
    if (!isManager(user.roles)) {
      scope["$or"] = [
        { reportedBy: user.id },
        { accusedUserIds: user.id },
        { witnessUserIds: user.id },
        { assignedTo: user.id },
      ];
    }
    return DisciplineIncidentModel.find(scope)
      .populate("categoryId", "name code")
      .populate("assignedTo", "name")
      .sort({ createdAt: -1 })
      .limit(1000)
      .lean();
  },
  get: async (id: string, user: IIdentity) => {
    const incident = await accessibleIncident(id, user);
    const eventFilter: Record<string, unknown> = { incidentId: id };
    if (!isManager(user.roles)) eventFilter["private"] = false;
    const [events, sanctions] = await Promise.all([
      DisciplineEventModel.find(eventFilter).sort({ eventAt: 1 }).lean(),
      DisciplineSanctionModel.find({
        incidentId: id,
        ...(isManager(user.roles) ? {} : { userId: user.id }),
      })
        .populate("userId", "name email")
        .lean(),
    ]);
    return { incident, events, sanctions };
  },
  report: async (
    data: {
      title: string;
      description: string;
      categoryId: string;
      severity?: IDisciplineIncident["severity"];
      occurredAt: string;
      location?: string;
      accusedUserIds: string[];
      witnessUserIds?: string[];
      evidence?: Array<{ name: string; url: string; publicId?: string }>;
      confidential?: boolean;
    },
    user: IIdentity,
  ) => {
    const category = await DisciplineCategoryModel.findOne({
      _id: data.categoryId,
      isActive: true,
    }).lean();
    if (!category) throw createError(404, "Discipline category not found");
    if (!data.accusedUserIds.length) throw createError(400, "Select at least one involved person");
    const people = Array.from(new Set([...data.accusedUserIds, ...(data.witnessUserIds ?? [])]));
    if (people.some((id) => !Types.ObjectId.isValid(id)))
      throw createError(400, "One or more people identifiers are invalid");
    const activeCount = await UserModel.countDocuments({ _id: { $in: people }, status: "active" });
    if (activeCount !== people.length)
      throw createError(400, "One or more selected people are inactive");
    const year = new Date().getFullYear();
    const sequence = await nextSeq(`discipline-incident-${year}`);
    const incidentNumber = `DISC-${year}-${String(sequence).padStart(6, "0")}`;
    const incident = await DisciplineIncidentModel.create({
      ...data,
      incidentNumber,
      severity: data.severity ?? category.defaultSeverity,
      occurredAt: new Date(data.occurredAt),
      reportedBy: user.id,
    });
    await DisciplineEventModel.create({
      incidentId: incident._id,
      type: "status_change",
      content: "Incident reported",
      toStatus: "reported",
      private: false,
      createdBy: user.id,
      createdByName: user.name,
    });
    void notifyUsers(data.accusedUserIds, {
      title: `Discipline case ${incidentNumber}`,
      body: "A discipline incident involving your account has been registered for review.",
      type: NotificationType.ALERT,
      actionUrl: "/discipline",
      createdBy: user.id,
      createdByName: user.name,
    });
    return incident;
  },
  assign: async (id: string, assigneeId: string, user: IIdentity) => {
    if (!isManager(user.roles)) throw createError(403, "Discipline manager access required");
    validId(assigneeId, "assignee identifier");
    const assignee = await UserModel.findOne({ _id: assigneeId, status: "active" })
      .select("name")
      .lean();
    if (!assignee) throw createError(404, "Active assignee not found");
    const row = await DisciplineIncidentModel.findOneAndUpdate(
      { _id: id, status: { $nin: ["closed", "dismissed"] } },
      { $set: { assignedTo: assigneeId, updatedBy: user.id } },
      { returnDocument: "after" },
    ).lean();
    if (!row) throw createError(409, "Closed incidents cannot be reassigned");
    await DisciplineEventModel.create({
      incidentId: id,
      type: "note",
      content: `Assigned to ${assignee.name}`,
      private: true,
      createdBy: user.id,
      createdByName: user.name,
    });
    void notifyUsers([assigneeId], {
      title: `Assigned discipline case ${row.incidentNumber}`,
      body: row.title,
      type: NotificationType.ALERT,
      actionUrl: "/discipline",
      createdBy: user.id,
      createdByName: user.name,
    });
    return row;
  },
  transition: async (
    id: string,
    data: {
      status: IDisciplineIncident["status"];
      note: string;
      finding?: string;
      decision?: string;
    },
    user: IIdentity,
  ) => {
    if (!isManager(user.roles)) throw createError(403, "Discipline manager access required");
    const current = await DisciplineIncidentModel.findById(id).lean();
    if (!current) throw createError(404, "Incident not found");
    if (!canTransitionDisciplineStatus(current.status, data.status))
      throw createError(409, `Cannot move an incident from ${current.status} to ${data.status}`);
    if (data.status === "decided" && String(data.decision ?? "").trim().length < 5)
      throw createError(400, "A written decision is required");
    const session = await mongoose.startSession();
    try {
      let updated = null;
      await session.withTransaction(async () => {
        updated = await DisciplineIncidentModel.findOneAndUpdate(
          { _id: id, status: current.status },
          {
            $set: {
              status: data.status,
              finding: data.finding,
              decision: data.decision,
              updatedBy: user.id,
              ...(data.status === "decided" ? { decidedBy: user.id, decidedAt: new Date() } : {}),
              ...(["closed", "dismissed"].includes(data.status) ? { closedAt: new Date() } : {}),
            },
          },
          { returnDocument: "after", session, runValidators: true },
        );
        if (!updated) throw createError(409, "Incident status changed concurrently");
        await DisciplineEventModel.create(
          [
            {
              incidentId: id,
              type: data.status === "decided" ? "decision" : "status_change",
              content: data.note,
              fromStatus: current.status,
              toStatus: data.status,
              private: false,
              createdBy: user.id,
              createdByName: user.name,
            },
          ],
          { session },
        );
      });
      return updated;
    } finally {
      await session.endSession();
    }
  },
  addEvent: async (
    id: string,
    data: { type: "note" | "hearing"; content: string; eventAt?: string; private?: boolean },
    user: IIdentity,
  ) => {
    if (!isManager(user.roles)) throw createError(403, "Discipline manager access required");
    await accessibleIncident(id, user);
    return DisciplineEventModel.create({
      incidentId: id,
      type: data.type,
      content: data.content,
      eventAt: data.eventAt ? new Date(data.eventAt) : new Date(),
      private: data.private ?? true,
      createdBy: user.id,
      createdByName: user.name,
    });
  },
  sanction: async (
    id: string,
    data: {
      userId: string;
      type:
        | "warning"
        | "community_service"
        | "fine"
        | "suspension"
        | "restriction"
        | "rustication"
        | "other";
      description: string;
      startsAt: string;
      endsAt?: string;
      amount?: number;
    },
    user: IIdentity,
  ) => {
    if (!isManager(user.roles)) throw createError(403, "Discipline manager access required");
    const incident = await DisciplineIncidentModel.findOne({
      _id: id,
      status: { $in: ["decided", "appealed", "closed"] },
      accusedUserIds: data.userId,
    }).lean();
    if (!incident)
      throw createError(409, "Sanctions require a decided case and an involved person");
    const sanction = await DisciplineSanctionModel.create({
      ...data,
      incidentId: id,
      startsAt: new Date(data.startsAt),
      endsAt: data.endsAt ? new Date(data.endsAt) : undefined,
      imposedBy: user.id,
    });
    await DisciplineEventModel.create({
      incidentId: id,
      type: "sanction",
      content: data.description,
      private: false,
      createdBy: user.id,
      createdByName: user.name,
    });
    void notifyUsers([data.userId], {
      title: `Sanction issued — ${incident.incidentNumber}`,
      body: data.description,
      type: NotificationType.ALERT,
      actionUrl: "/discipline",
      createdBy: user.id,
      createdByName: user.name,
    });
    return sanction;
  },
  appeal: async (id: string, reason: string, user: IIdentity) => {
    if (reason.trim().length < 10) throw createError(400, "Provide a detailed appeal reason");
    const incident = await DisciplineIncidentModel.findOneAndUpdate(
      { _id: id, status: "decided", accusedUserIds: user.id },
      { $set: { status: "appealed", updatedBy: user.id } },
      { returnDocument: "after" },
    ).lean();
    if (!incident) throw createError(409, "Only an involved person can appeal a decided case");
    await DisciplineEventModel.create({
      incidentId: id,
      type: "appeal",
      content: reason.trim(),
      fromStatus: "decided",
      toStatus: "appealed",
      private: false,
      createdBy: user.id,
      createdByName: user.name,
    });
    return incident;
  },
};
