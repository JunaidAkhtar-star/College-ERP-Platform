import { TaskModel } from "../models/task.model";
import { notifyUsers } from "./helpers/notify.helper";
import { NotificationType } from "../models/notification.model";
import { UserModel } from "../models/user.model";
import createError from "http-errors";
import { EMPLOYEE_ROLES, SystemRole } from "../constants/roles";

export const taskService = {
  createTask: async (
    data: {
      title: string;
      description: string;
      dueDate: string | Date;
      notes?: string;
      assignees: string[];
      attachments?: { url: string; publicId: string; name: string }[];
      priority?: "low" | "medium" | "high" | "critical";
      dependencyIds?: string[];
      sourceModule?: string;
      sourceRecordId?: string;
      recurrence?: { frequency: "daily" | "weekly" | "monthly"; interval: number; endsAt?: Date };
    },
    assignerId: string,
    assignerName: string,
    assignerRoles: string[] = [],
    assignerDepartment?: string,
  ) => {
    if (
      !data.title ||
      !data.description ||
      !data.dueDate ||
      !data.assignees ||
      data.assignees.length === 0
    ) {
      throw createError(400, "Missing required fields: title, description, dueDate, assignees");
    }
    const dueDate = new Date(data.dueDate);
    if (Number.isNaN(dueDate.getTime()) || dueDate <= new Date())
      throw createError(400, "Task due date must be in the future");
    const dependencyIds = Array.from(new Set(data.dependencyIds ?? []));
    if (dependencyIds.length) {
      const hasGlobalTaskAccess = assignerRoles.some((role) =>
        [SystemRole.SUPER_ADMIN, SystemRole.ADMIN].includes(role as SystemRole),
      );
      const dependencyCount = await TaskModel.countDocuments({
        _id: { $in: dependencyIds },
        ...(hasGlobalTaskAccess
          ? {}
          : { $or: [{ assigner: assignerId }, { assignees: assignerId }] }),
      });
      if (dependencyCount !== dependencyIds.length)
        throw createError(400, "One or more task dependencies do not exist");
    }
    const assigneeIds = Array.from(new Set(data.assignees));
    const validAssignees = await UserModel.countDocuments({
      _id: { $in: assigneeIds },
      roles: { $in: EMPLOYEE_ROLES },
      isDeleted: { $ne: true },
    });
    if (validAssignees !== assigneeIds.length)
      throw createError(400, "Every assignee must be an active staff member");
    if (assignerRoles.includes(SystemRole.HOD) && !assignerDepartment) {
      throw createError(403, "Department ownership is required for HOD task assignment");
    }
    if (assignerRoles.includes(SystemRole.HOD) && assignerDepartment) {
      const outsideDepartment = await UserModel.countDocuments({
        _id: { $in: assigneeIds },
        department: { $ne: assignerDepartment },
      });
      if (outsideDepartment)
        throw createError(403, "HODs can assign tasks only within their own department");
    }
    if (data.recurrence) {
      if (
        !["daily", "weekly", "monthly"].includes(data.recurrence.frequency) ||
        !Number.isInteger(data.recurrence.interval) ||
        data.recurrence.interval < 1 ||
        data.recurrence.interval > 365
      )
        throw createError(400, "Task recurrence is invalid");
      if (data.recurrence.endsAt && new Date(data.recurrence.endsAt) <= dueDate)
        throw createError(400, "Recurrence must end after the first due date");
    }

    const task = await TaskModel.create({
      title: data.title,
      description: data.description,
      dueDate,
      notes: data.notes || "",
      assignees: assigneeIds,
      assigner: assignerId,
      attachments: data.attachments || [],
      status: "todo",
      priority: data.priority ?? "medium",
      dependencyIds,
      sourceModule: data.sourceModule,
      sourceRecordId: data.sourceRecordId,
      recurrence: data.recurrence,
    });

    // Notify all assignees
    void notifyUsers(data.assignees, {
      title: "New Task Assigned",
      body: `You have been assigned a new task: "${data.title}" by ${assignerName}.`,
      type: NotificationType.INFO,
      actionUrl: "/task-management",
      createdBy: assignerId,
      createdByName: assignerName,
    });

    return task;
  },

  getTasks: async (userId: string, roles: string[] = []) => {
    const isAdmin = roles.includes("super_admin") || roles.includes("admin");
    const query = isAdmin ? {} : { $or: [{ assigner: userId }, { assignees: userId }] };
    await TaskModel.updateMany(
      {
        ...query,
        status: { $nin: ["completed", "approved"] },
        dueDate: { $lt: new Date() },
        escalatedAt: { $exists: false },
      },
      { $set: { escalatedAt: new Date() } },
    );
    return TaskModel.find(query)
      .populate("assigner", "name email avatar roles department")
      .populate("assignees", "name email avatar roles department")
      .populate("dependencyIds", "title status dueDate")
      .sort({ createdAt: -1 })
      .lean();
  },

  getTaskById: async (id: string, userId?: string, roles: string[] = []) => {
    const isAdmin = roles.includes("super_admin") || roles.includes("admin");
    const task = await TaskModel.findOne({
      _id: id,
      ...(isAdmin ? {} : { $or: [{ assigner: userId }, { assignees: userId }] }),
    })
      .populate("assigner", "name email avatar roles department")
      .populate("assignees", "name email avatar roles department")
      .populate("dependencyIds", "title status dueDate")
      .lean();
    if (!task) throw createError(404, "Task not found or access denied");
    return task;
  },

  updateTaskStatus: async (
    taskId: string,
    userId: string,
    status: "todo" | "in_progress" | "completed",
    completion?: {
      note?: string;
      evidence?: { url: string; publicId: string; name: string }[];
    },
  ) => {
    const task = await TaskModel.findById(taskId);
    if (!task) throw createError(404, "Task not found");

    // Ensure user is an assignee
    const isAssignee = task.assignees.some((id) => String(id) === String(userId));
    if (!isAssignee) {
      throw createError(403, "You are not assigned to this task");
    }
    const allowed: Record<string, string[]> = {
      todo: ["in_progress"],
      in_progress: ["completed"],
      completed: ["in_progress"],
    };
    if (status !== task.status && !allowed[task.status]?.includes(status))
      throw createError(409, `Task cannot move from ${task.status} to ${status}`);
    if (status === "in_progress" && task.dependencyIds?.length) {
      const incomplete = await TaskModel.countDocuments({
        _id: { $in: task.dependencyIds },
        status: { $ne: "approved" },
      });
      if (incomplete) throw createError(409, "Complete and approve all task dependencies first");
    }
    if (status === "completed") {
      const note = String(completion?.note ?? "").trim();
      const evidence = completion?.evidence ?? [];
      if (note.length < 10 && evidence.length === 0)
        throw createError(400, "Add a completion note or supporting evidence before submitting");
      task.completionNote = note || undefined;
      task.completionEvidence = evidence;
      task.completedAt = new Date();
    }
    task.status = status;
    await task.save();

    // Fetch user details for notification
    const user = await UserModel.findById(userId).select("name").lean();
    const assigneeName = user?.name || "A faculty member";

    // If marked completed, notify the assigner
    if (status === "completed") {
      void notifyUsers([task.assigner], {
        title: "Task Completed",
        body: `Task "${task.title}" has been completed by ${assigneeName} and is awaiting approval.`,
        type: NotificationType.SUCCESS,
        actionUrl: "/task-management",
        createdBy: userId,
        createdByName: assigneeName,
      });
    }

    return task;
  },

  approveOrRejectTask: async (
    taskId: string,
    userId: string,
    userName: string,
    action: "approve" | "reject",
    feedback?: string,
  ) => {
    const task = await TaskModel.findById(taskId);
    if (!task) throw createError(404, "Task not found");

    // Ensure user is the assigner
    if (String(task.assigner) !== String(userId)) {
      throw createError(403, "Only the task assigner can approve or reject it");
    }

    if (action === "approve") {
      if (task.status !== "completed")
        throw createError(409, "Only a completed task can be approved");
      task.status = "approved";
    } else {
      if (task.status !== "completed")
        throw createError(409, "Only a completed task can be returned for revision");
      if (!feedback || feedback.trim().length < 5)
        throw createError(400, "Revision feedback is required");
      task.status = "in_progress"; // Send back to in_progress
    }

    task.feedback = feedback || "";
    await task.save();

    if (action === "approve" && task.recurrence?.frequency) {
      const nextDueDate = new Date(task.dueDate);
      const interval = task.recurrence.interval || 1;
      if (task.recurrence.frequency === "daily")
        nextDueDate.setDate(nextDueDate.getDate() + interval);
      if (task.recurrence.frequency === "weekly")
        nextDueDate.setDate(nextDueDate.getDate() + interval * 7);
      if (task.recurrence.frequency === "monthly")
        nextDueDate.setMonth(nextDueDate.getMonth() + interval);
      if (!task.recurrence.endsAt || nextDueDate <= task.recurrence.endsAt) {
        await TaskModel.create({
          title: task.title,
          description: task.description,
          assigner: task.assigner,
          assignees: task.assignees,
          status: "todo",
          priority: task.priority,
          dueDate: nextDueDate,
          dependencyIds: [],
          sourceModule: task.sourceModule,
          sourceRecordId: task.sourceRecordId,
          recurrence: task.recurrence,
          notes: task.notes,
          attachments: task.attachments,
        });
      }
    }

    // Notify assignees about the review
    const title = action === "approve" ? "Task Approved" : "Task Revision Required";
    const body =
      action === "approve"
        ? `Your task "${task.title}" has been approved by ${userName}.`
        : `Your task "${task.title}" was sent back for revision by ${userName}. Feedback: ${feedback || "None"}`;

    void notifyUsers(task.assignees, {
      title,
      body,
      type: action === "approve" ? NotificationType.SUCCESS : NotificationType.WARNING,
      actionUrl: "/task-management",
      createdBy: userId,
      createdByName: userName,
    });

    return task;
  },

  addComment: async (taskId: string, userId: string, userName: string, message: string) => {
    const normalized = String(message ?? "").trim();
    if (normalized.length < 2 || normalized.length > 2000)
      throw createError(400, "Comment must contain between 2 and 2000 characters");
    const task = await TaskModel.findOne({
      _id: taskId,
      $or: [{ assigner: userId }, { assignees: userId }],
    });
    if (!task) throw createError(404, "Task not found or access denied");
    task.comments.push({
      author: userId as never,
      authorName: userName,
      message: normalized,
      createdAt: new Date(),
    });
    await task.save();
    const recipients = [task.assigner, ...task.assignees].filter(
      (id) => String(id) !== String(userId),
    );
    void notifyUsers(recipients, {
      title: `New comment: ${task.title}`,
      body: `${userName}: ${normalized.slice(0, 140)}`,
      type: NotificationType.INFO,
      actionUrl: "/task-management",
      createdBy: userId,
      createdByName: userName,
    });
    return task.comments.at(-1);
  },
};
