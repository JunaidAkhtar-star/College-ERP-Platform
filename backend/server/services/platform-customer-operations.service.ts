import createError from "http-errors";
import { Types } from "mongoose";
import {
  ImplementationProjectModel,
  SupportTicketModel,
} from "../models/platform-customer-operations.model";
import { TenantModel } from "../models/tenant.model";
import { UserModel } from "../models/user.model";
import { nextSeq } from "../models/counter.model";
import { SystemRole } from "../constants/roles";
const SLA = { low: [24, 72], medium: [8, 24], high: [4, 12], critical: [1, 4] } as const;
const date = (v: unknown, l: string) => {
  const d = new Date(String(v));
  if (!Number.isFinite(d.getTime())) throw createError(400, `${l} is invalid`);
  return d;
};
const IMPLEMENTATION_STAGES = [
  "discovery",
  "configuration",
  "migration",
  "training",
  "go_live",
  "stabilization",
  "completed",
] as const;
function refreshProjectHealth(project: InstanceType<typeof ImplementationProjectModel>) {
  project.health =
    project.milestones.some((milestone) => milestone.status === "blocked") ||
    project.risks.some((risk) => risk.status === "open" && risk.severity === "high")
      ? "blocked"
      : project.milestones.some(
            (milestone) => milestone.status !== "completed" && milestone.dueAt < new Date(),
          ) || project.risks.some((risk) => risk.status === "open")
        ? "at_risk"
        : "on_track";
}
export const platformCustomerOperationsService = {
  owners: () =>
    UserModel.find({ roles: { $in: [SystemRole.SUPER_ADMIN] }, status: "active" })
      .select("name email")
      .sort({ name: 1 })
      .lean(),
  projects: () =>
    ImplementationProjectModel.find()
      .populate("tenantId", "tenantId name status billingStatus")
      .populate("ownerId", "name email")
      .sort({ targetGoLiveAt: 1 })
      .lean(),
  async createProject(actorId: string, input: Record<string, unknown>) {
    const tenantId = String(input.tenantId),
      ownerId = String(input.ownerId),
      [tenant, owner] = await Promise.all([
        TenantModel.exists({ _id: tenantId }),
        UserModel.exists({
          _id: ownerId,
          roles: { $in: [SystemRole.SUPER_ADMIN] },
          status: "active",
        }),
      ]);
    if (!tenant || !owner)
      throw createError(404, "Tenant or active implementation owner not found");
    const milestones = (input.milestones as Array<Record<string, unknown>>).map((m) => ({
      ...m,
      dueAt: date(m.dueAt, "Milestone due date"),
    }));
    return ImplementationProjectModel.create({
      ...input,
      tenantId,
      ownerId,
      targetGoLiveAt: date(input.targetGoLiveAt, "Target go-live"),
      milestones,
      createdBy: actorId,
    });
  },
  async updateMilestone(
    projectId: string,
    milestoneId: string,
    actorId: string,
    input: { status: string; note?: string },
  ) {
    const project = await ImplementationProjectModel.findById(projectId);
    if (!project) throw createError(404, "Implementation project not found");
    const milestone = project.milestones.find((item) => String(item._id) === milestoneId);
    if (!milestone) throw createError(404, "Implementation milestone not found");
    milestone.status = input.status as typeof milestone.status;
    milestone.note = input.note;
    if (input.status === "completed") milestone.completedAt = new Date();
    refreshProjectHealth(project);
    project.updatedBy = actorId as never;
    await project.save();
    return project.toObject();
  },
  async transitionProject(projectId: string, actorId: string, stage: string) {
    const project = await ImplementationProjectModel.findById(projectId);
    if (!project) throw createError(404, "Implementation project not found");
    if (stage === "on_hold") {
      project.stage = stage;
    } else {
      const current = IMPLEMENTATION_STAGES.indexOf(
          project.stage === "on_hold" ? "discovery" : project.stage,
        ),
        next = IMPLEMENTATION_STAGES.indexOf(stage as (typeof IMPLEMENTATION_STAGES)[number]);
      if (next < 0 || (next !== current && next !== current + 1))
        throw createError(409, "Implementation stages must advance in order");
      if (stage === "completed" && project.milestones.some((item) => item.status !== "completed"))
        throw createError(
          409,
          "Complete every implementation milestone before closing the project",
        );
      project.stage = stage as typeof project.stage;
      if (stage === "go_live" && !project.actualGoLiveAt) project.actualGoLiveAt = new Date();
    }
    project.updatedBy = actorId as never;
    refreshProjectHealth(project);
    await project.save();
    return project.toObject();
  },
  async addRisk(
    projectId: string,
    actorId: string,
    input: { summary: string; severity: string; mitigation: string; ownerId: string },
  ) {
    const [project, owner] = await Promise.all([
      ImplementationProjectModel.findById(projectId),
      UserModel.exists({
        _id: input.ownerId,
        roles: { $in: [SystemRole.SUPER_ADMIN] },
        status: "active",
      }),
    ]);
    if (!project) throw createError(404, "Implementation project not found");
    if (!owner) throw createError(404, "Active platform risk owner not found");
    project.risks.push({
      _id: new Types.ObjectId(),
      ...input,
      severity: input.severity as "low" | "medium" | "high",
      ownerId: input.ownerId as never,
      status: "open",
    });
    project.updatedBy = actorId as never;
    refreshProjectHealth(project);
    await project.save();
    return project.toObject();
  },
  async mitigateRisk(projectId: string, riskId: string, actorId: string) {
    const project = await ImplementationProjectModel.findById(projectId);
    if (!project) throw createError(404, "Implementation project not found");
    const risk = project.risks.find((item) => String(item._id) === riskId);
    if (!risk) throw createError(404, "Implementation risk not found");
    if (risk.status === "mitigated")
      throw createError(409, "Implementation risk is already mitigated");
    risk.status = "mitigated";
    project.updatedBy = actorId as never;
    refreshProjectHealth(project);
    await project.save();
    return project.toObject();
  },
  tickets: () =>
    SupportTicketModel.find()
      .populate("tenantId", "tenantId name")
      .populate("ownerId", "name email")
      .sort({ createdAt: -1 })
      .lean(),
  async createTicket(actorId: string, input: Record<string, unknown>) {
    const tenantId = String(input.tenantId),
      tenant = await TenantModel.exists({ _id: tenantId });
    if (!tenant) throw createError(404, "Tenant not found");
    const priority = input.priority as keyof typeof SLA,
      [responseHours, resolutionHours] = SLA[priority],
      now = new Date(),
      number = `SUP-${new Date().getFullYear()}-${String(await nextSeq(`support-ticket:${new Date().getFullYear()}`)).padStart(6, "0")}`;
    return SupportTicketModel.create({
      ...input,
      tenantId,
      number,
      firstResponseDueAt: new Date(now.getTime() + responseHours * 3600000),
      resolutionDueAt: new Date(now.getTime() + resolutionHours * 3600000),
      createdBy: actorId,
    });
  },
  async transitionTicket(
    id: string,
    actorId: string,
    input: { status: string; ownerId?: string; resolution?: string },
  ) {
    const ticket = await SupportTicketModel.findById(id);
    if (!ticket) throw createError(404, "Support ticket not found");
    const allowed: Record<string, string[]> = {
      open: ["triaged"],
      triaged: ["in_progress", "waiting_customer"],
      in_progress: ["waiting_customer", "resolved"],
      waiting_customer: ["in_progress", "resolved"],
      resolved: ["closed", "in_progress"],
    };
    if (!allowed[ticket.status]?.includes(input.status))
      throw createError(409, `Support ticket cannot move from ${ticket.status} to ${input.status}`);
    if (input.ownerId) {
      const owner = await UserModel.exists({
        _id: input.ownerId,
        roles: { $in: [SystemRole.SUPER_ADMIN] },
        status: "active",
      });
      if (!owner) throw createError(404, "Active support owner not found");
      ticket.ownerId = input.ownerId as never;
    }
    if (["triaged", "in_progress"].includes(input.status) && !ticket.ownerId)
      throw createError(400, "Assign an owner before work begins");
    if (input.status === "resolved" && (!input.resolution || input.resolution.trim().length < 10))
      throw createError(400, "Resolution evidence is required");
    if (!ticket.firstRespondedAt && input.status !== "open") ticket.firstRespondedAt = new Date();
    ticket.status = input.status as typeof ticket.status;
    ticket.resolution = input.resolution;
    if (input.status === "resolved") ticket.resolvedAt = new Date();
    if (input.status === "closed") ticket.closedAt = new Date();
    ticket.updatedBy = actorId as never;
    await ticket.save();
    return ticket.toObject();
  },
  async comment(
    id: string,
    actorId: string,
    input: { body: string; visibility: "internal" | "customer" },
  ) {
    const ticket = await SupportTicketModel.findOneAndUpdate(
      { _id: id, status: { $ne: "closed" } },
      {
        $push: {
          comments: {
            authorId: actorId,
            body: input.body,
            visibility: input.visibility,
            createdAt: new Date(),
          },
        },
        $set: { updatedBy: actorId },
      },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!ticket) throw createError(409, "Closed or missing ticket cannot accept comments");
    return ticket;
  },
  async dashboard() {
    const now = new Date(),
      [projects, atRisk, openTickets, breachedResponse, breachedResolution, critical] =
        await Promise.all([
          ImplementationProjectModel.countDocuments({ stage: { $ne: "completed" } }),
          ImplementationProjectModel.countDocuments({ health: { $in: ["at_risk", "blocked"] } }),
          SupportTicketModel.countDocuments({ status: { $nin: ["resolved", "closed"] } }),
          SupportTicketModel.countDocuments({ status: "open", firstResponseDueAt: { $lt: now } }),
          SupportTicketModel.countDocuments({
            status: { $nin: ["resolved", "closed"] },
            resolutionDueAt: { $lt: now },
          }),
          SupportTicketModel.countDocuments({
            priority: "critical",
            status: { $nin: ["resolved", "closed"] },
          }),
        ]);
    return {
      activeImplementations: projects,
      atRiskImplementations: atRisk,
      openTickets,
      breachedResponse,
      breachedResolution,
      criticalTickets: critical,
    };
  },
};
