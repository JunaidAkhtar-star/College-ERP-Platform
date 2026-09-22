import { eventRepository } from "../repositories";
import { notifyUsers } from "./helpers/notify.helper";
import { NotificationType } from "../models/notification.model";
import { UserModel } from "../models/user.model";
import { StudentProfileModel, StudentStatus } from "../models/student-profile.model";
import type { IEvent } from "../models/event.model";
import { logger } from "../utils/logger.util";
import createError from "http-errors";
import { Types } from "mongoose";

export function normalizeEvent(data: Record<string, unknown>) {
  const title = String(data.title ?? "").trim();
  const description = String(data.description ?? "").trim();
  const venue = String(data.venue ?? "").trim();
  const startDate = new Date(String(data.startDate ?? ""));
  const endDate = new Date(String(data.endDate ?? ""));
  if (!title || !description || !venue)
    throw createError(400, "Event title, description, and venue are required");
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate)
    throw createError(400, "Event dates are invalid");
  const maxRegistrations =
    data.maxRegistrations === undefined ? undefined : Number(data.maxRegistrations);
  if (
    maxRegistrations !== undefined &&
    (!Number.isInteger(maxRegistrations) || maxRegistrations < 1)
  )
    throw createError(400, "Maximum registrations must be positive");
  const targetAudience = [
    ...new Set((Array.isArray(data.targetAudience) ? data.targetAudience : []).map(String)),
  ];
  if (
    !targetAudience.length ||
    targetAudience.some((value) => !["all", "student", "faculty"].includes(value))
  )
    throw createError(400, "Event target audience is invalid");
  return {
    title,
    description,
    venue,
    startDate,
    endDate,
    eventType: data.eventType,
    organizingDepartment: data.organizingDepartment,
    coordinators: data.coordinators,
    targetAudience,
    maxRegistrations,
    attachments: data.attachments,
  };
}

async function broadcastEvent(event: IEvent | null | undefined): Promise<void> {
  if (!event) return;
  try {
    const audience = (event.targetAudience ?? []).map((a) => a.toLowerCase());
    const wantsAll = audience.length === 0 || audience.includes("all");
    const departmentId =
      event.organizingDepartment?._id?.toString() ?? event.organizingDepartment?.toString();
    let userIds: unknown[] = [];
    if (wantsAll) {
      const users = await UserModel.find({
        status: "active",
        ...(departmentId ? { department: departmentId } : {}),
      })
        .select("_id")
        .lean();
      userIds = users.map((u) => u._id);
      if (departmentId) {
        const students = await StudentProfileModel.find({
          department: departmentId,
          status: StudentStatus.ACTIVE,
        })
          .select("userId")
          .lean();
        userIds = userIds.concat(students.map((profile) => profile.userId));
      }
    } else {
      const wantsStudents = audience.includes("student") || audience.includes("students");
      const wantsFaculty = audience.includes("faculty");
      if (wantsStudents) {
        const profs = await StudentProfileModel.find({
          status: StudentStatus.ACTIVE,
          ...(departmentId ? { department: departmentId } : {}),
        })
          .select("userId")
          .lean();
        userIds = userIds.concat(profs.map((p) => p.userId));
      }
      if (wantsFaculty) {
        const facs = await UserModel.find({
          roles: { $in: ["faculty"] },
          status: "active",
          ...(departmentId ? { department: departmentId } : {}),
        } as Record<string, unknown>)
          .select("_id")
          .lean();
        userIds = userIds.concat(facs.map((u) => u._id));
      }
    }
    await notifyUsers([...new Set(userIds.map(String))] as Parameters<typeof notifyUsers>[0], {
      title: `New event: ${event.title}`,
      body: `${event.title} — starts ${new Date(event.startDate as unknown as string).toLocaleString()}.`,
      type: NotificationType.GENERAL,
      actionUrl: "/event",
    });
  } catch (err) {
    logger.error("[broadcastEvent] failed", { err, eventId: String(event._id) });
  }
}

export const eventService = {
  getAll: (filter: Record<string, unknown>, page: number, limit: number) =>
    eventRepository.list(filter, page, limit),

  getById: (id: string) => eventRepository.findById(id),

  create: async (data: Record<string, unknown>, createdBy: string) => {
    return eventRepository.create({
      ...normalizeEvent(data),
      isPublished: false,
      registrationCount: 0,
      registrations: [],
      isCancelled: false,
      createdBy: new Types.ObjectId(createdBy),
    });
  },

  update: async (id: string, data: Record<string, unknown>, updatedBy: string) => {
    const current = await eventRepository.findById(id);
    if (!current) throw createError(404, "Event not found");
    const updated = await eventRepository.updateById(id, {
      ...normalizeEvent({ ...current, ...data }),
      updatedBy,
    });
    if (!updated) throw createError(409, "Published events are immutable");
    return updated;
  },

  publish: async (id: string, publishedBy: string) => {
    const result = await eventRepository.publish(id, publishedBy);
    if (!result)
      throw createError(409, "Publishing requires a future draft and a different approver");
    void broadcastEvent(result as unknown as IEvent);
    return result;
  },

  cancel: async (id: string, reason: string, cancelledBy: string) => {
    const cleanReason = reason.trim();
    if (cleanReason.length < 3) throw createError(400, "Provide a cancellation reason");
    const result = await eventRepository.cancel(id, cleanReason, cancelledBy);
    if (!result) throw createError(409, "Only an active future or ongoing event can be cancelled");
    const participantIds = (result.registrations ?? []).map((entry) => entry.userId.toString());
    if (participantIds.length) {
      void notifyUsers(participantIds, {
        title: `Event cancelled: ${result.title}`,
        body: cleanReason,
        type: NotificationType.GENERAL,
        actionUrl: "/event",
      });
    }
    return result;
  },

  stats: (filter: Record<string, unknown>) => eventRepository.stats(filter),

  register: async (eventId: string, userId: string, activeRole: string, departmentId?: string) => {
    const event = await eventRepository.findById(eventId);
    if (!event) throw createError(404, "Event not found");
    const audience = activeRole === "student" ? "student" : "faculty";
    if (!event.targetAudience.includes("all") && !event.targetAudience.includes(audience)) {
      throw createError(403, "This event is not available for the active role");
    }
    const eventDepartment =
      event.organizingDepartment?._id?.toString() ?? event.organizingDepartment?.toString();
    if (eventDepartment && eventDepartment !== departmentId) {
      throw createError(403, "This event is limited to another department");
    }
    const result = await eventRepository.register(eventId, userId);
    if (!result)
      throw createError(409, "Event is closed, full, unpublished, or already registered");
    void notifyUsers([userId], {
      title: "Event registration confirmed",
      body: `You have successfully registered for "${event.title}".`,
      type: NotificationType.SUCCESS,
      actionUrl: "/event",
    });
    return result;
  },

  markAttendance: async (eventId: string, userId: string) => {
    const event = await eventRepository.findById(eventId);
    if (!event) throw createError(404, "Event not found");
    const now = new Date();
    if (
      !event.isPublished ||
      event.isCancelled ||
      now < event.startDate ||
      now > new Date(event.endDate.getTime() + 86400000)
    )
      throw createError(409, "Attendance can be marked only during the event or within 24 hours");
    const result = await eventRepository.markAttendance(eventId, userId);
    if (!result.modifiedCount)
      throw createError(409, "User is not registered or attendance is already marked");
    return result;
  },
};
