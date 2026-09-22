import createError from "http-errors";
import mongoose, { Types } from "mongoose";
import { nextSeq } from "../models/counter.model";
import {
  AssetModel,
  FacilityBookingModel,
  FacilityInspectionModel,
  FacilitySpaceModel,
  FacilityWorkOrderModel,
} from "../models/facilities.model";
import { StoreItemModel } from "../models/store.model";
import { UserModel } from "../models/user.model";

const asDate = (value: unknown, label: string) => {
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) throw createError(400, `${label} is invalid`);
  return date;
};
const scoped = (campusIds?: string[]) => (campusIds ? { campusId: { $in: campusIds } } : {});
const dueHours = { low: 120, medium: 72, high: 24, critical: 4 } as const;

export const facilitiesService = {
  spaces: (campusIds?: string[]) =>
    FacilitySpaceModel.find(scoped(campusIds))
      .populate("campusId", "code name")
      .sort({ building: 1, code: 1 })
      .lean(),
  spaceById: async (id: string) => {
    const item = await FacilitySpaceModel.findById(id).lean();
    if (!item) throw createError(404, "Facility space not found");
    return item;
  },
  createSpace: (actorId: string, input: Record<string, unknown>) =>
    FacilitySpaceModel.create({
      ...input,
      code: String(input.code).trim().toUpperCase(),
      createdBy: actorId,
    }),
  assets: (campusIds?: string[]) =>
    AssetModel.find(scoped(campusIds))
      .populate("campusId", "code name")
      .populate("spaceId", "code name building")
      .populate("custodianId", "name email")
      .sort({ assetTag: 1 })
      .lean(),
  assetById: async (id: string) => {
    const item = await AssetModel.findById(id).lean();
    if (!item) throw createError(404, "Asset not found");
    return item;
  },
  async createAsset(actorId: string, input: Record<string, unknown>) {
    const campusId = String(input.campusId),
      spaceId = input.spaceId ? String(input.spaceId) : undefined,
      storeItemId = input.storeItemId ? String(input.storeItemId) : undefined,
      custodianId = input.custodianId ? String(input.custodianId) : undefined;
    const [space, storeItem, custodian] = await Promise.all([
      spaceId ? FacilitySpaceModel.findOne({ _id: spaceId, campusId }) : null,
      storeItemId ? StoreItemModel.exists({ _id: storeItemId, isActive: true }) : null,
      custodianId ? UserModel.exists({ _id: custodianId, status: "active" }) : null,
    ]);
    if (spaceId && !space) throw createError(400, "Selected space does not belong to this campus");
    if (storeItemId && !storeItem) throw createError(404, "Active store item not found");
    if (custodianId && !custodian) throw createError(404, "Active asset custodian not found");
    const acquiredAt = input.acquiredAt ? asDate(input.acquiredAt, "Acquisition date") : undefined,
      interval = input.maintenanceIntervalDays ? Number(input.maintenanceIntervalDays) : undefined;
    const nextMaintenanceAt =
      acquiredAt && interval ? new Date(acquiredAt.getTime() + interval * 86_400_000) : undefined;
    return AssetModel.create({
      ...input,
      campusId,
      spaceId,
      storeItemId,
      custodianId,
      assetTag: String(input.assetTag).trim().toUpperCase(),
      acquiredAt,
      warrantyEndsAt: input.warrantyEndsAt
        ? asDate(input.warrantyEndsAt, "Warranty end")
        : undefined,
      nextMaintenanceAt,
      createdBy: actorId,
    });
  },
  workOrders: (campusIds?: string[]) =>
    FacilityWorkOrderModel.find(scoped(campusIds))
      .populate("campusId", "code name")
      .populate("spaceId", "code name")
      .populate("assetId", "assetTag name")
      .populate("assignedTo", "name email")
      .sort({ createdAt: -1 })
      .lean(),
  workOrderById: async (id: string) => {
    const item = await FacilityWorkOrderModel.findById(id).lean();
    if (!item) throw createError(404, "Work order not found");
    return item;
  },
  async createWorkOrder(actorId: string, input: Record<string, unknown>) {
    const campusId = String(input.campusId),
      assetId = input.assetId ? String(input.assetId) : undefined,
      spaceId = input.spaceId ? String(input.spaceId) : undefined,
      assignedTo = input.assignedTo ? String(input.assignedTo) : undefined;
    if (!assetId && !spaceId) throw createError(400, "Select an asset or facility space");
    const [asset, space, assignee] = await Promise.all([
      assetId ? AssetModel.findOne({ _id: assetId, campusId }) : null,
      spaceId ? FacilitySpaceModel.findOne({ _id: spaceId, campusId }) : null,
      assignedTo ? UserModel.exists({ _id: assignedTo, status: "active" }) : null,
    ]);
    if (assetId && !asset) throw createError(400, "Selected asset does not belong to this campus");
    if (spaceId && !space) throw createError(400, "Selected space does not belong to this campus");
    if (assignedTo && !assignee) throw createError(404, "Active assignee not found");
    const priority = input.priority as keyof typeof dueHours,
      number = `WO-${new Date().getFullYear()}-${String(await nextSeq(`facility-work-order:${new Date().getFullYear()}`)).padStart(6, "0")}`;
    const dueAt = input.dueAt
      ? asDate(input.dueAt, "Due date")
      : new Date(Date.now() + dueHours[priority] * 3_600_000);
    return FacilityWorkOrderModel.create({
      ...input,
      campusId,
      assetId,
      spaceId,
      assignedTo,
      number,
      dueAt,
      requestedBy: actorId,
      status: assignedTo ? "assigned" : "open",
      createdBy: actorId,
    });
  },
  async transitionWorkOrder(
    id: string,
    actorId: string,
    input: { status: string; resolution?: string; laborCost?: number; materialCost?: number },
  ) {
    const current = await FacilityWorkOrderModel.findById(id);
    if (!current) throw createError(404, "Work order not found");
    const allowed: Record<string, string[]> = {
      open: ["assigned", "cancelled"],
      assigned: ["in_progress", "cancelled"],
      in_progress: ["on_hold", "completed"],
      on_hold: ["in_progress", "cancelled"],
    };
    if (!allowed[current.status]?.includes(input.status))
      throw createError(409, `Work order cannot move from ${current.status} to ${input.status}`);
    if (input.status === "completed" && (!input.resolution || input.resolution.trim().length < 5))
      throw createError(400, "Completion requires a resolution summary");
    return mongoose.connection.transaction(async (session) => {
      current.status = input.status as typeof current.status;
      current.resolution = input.resolution;
      current.laborCost = input.laborCost;
      current.materialCost = input.materialCost;
      current.updatedBy = new Types.ObjectId(actorId);
      if (input.status === "completed") current.completedAt = new Date();
      await current.save({ session });
      if (input.status === "completed" && current.assetId) {
        const asset = await AssetModel.findById(current.assetId).session(session);
        if (asset) {
          asset.status = "in_service";
          asset.lastMaintainedAt = current.completedAt;
          if (asset.maintenanceIntervalDays)
            asset.nextMaintenanceAt = new Date(
              current.completedAt!.getTime() + asset.maintenanceIntervalDays * 86_400_000,
            );
          asset.updatedBy = new Types.ObjectId(actorId);
          await asset.save({ session });
        }
      }
      return current.toObject();
    });
  },
  async generatePreventiveWorkOrders(actorId: string, campusIds?: string[]) {
    const assets = await AssetModel.find({
      ...scoped(campusIds),
      status: "in_service",
      nextMaintenanceAt: { $lte: new Date() },
    }).lean();
    const activeOrders = assets.length
      ? await FacilityWorkOrderModel.find({
          assetId: { $in: assets.map((asset) => asset._id) },
          category: "preventive",
          status: { $nin: ["completed", "cancelled"] },
        })
          .select("assetId")
          .lean()
      : [];
    const assetsWithOrders = new Set(activeOrders.map((order) => String(order.assetId)));
    let created = 0;
    for (const asset of assets) {
      if (!assetsWithOrders.has(String(asset._id))) {
        await facilitiesService.createWorkOrder(actorId, {
          campusId: String(asset.campusId),
          assetId: String(asset._id),
          spaceId: asset.spaceId ? String(asset.spaceId) : undefined,
          title: `Preventive maintenance · ${asset.assetTag}`,
          description: `Scheduled preventive service for ${asset.name}`,
          category: "preventive",
          priority: "medium",
          dueAt: asset.nextMaintenanceAt,
        });
        created++;
      }
    }
    return { dueAssets: assets.length, created, skipped: assets.length - created };
  },
  bookings: (campusIds?: string[]) =>
    FacilityBookingModel.find(scoped(campusIds))
      .populate("spaceId", "code name building capacity")
      .populate("bookedBy", "name email")
      .sort({ startsAt: 1 })
      .lean(),
  async createBooking(actorId: string, input: Record<string, unknown>) {
    const campusId = String(input.campusId),
      spaceId = String(input.spaceId),
      startsAt = asDate(input.startsAt, "Start date"),
      endsAt = asDate(input.endsAt, "End date");
    if (endsAt <= startsAt) throw createError(400, "Booking end must be after its start");
    const space = await FacilitySpaceModel.findOne({
      _id: spaceId,
      campusId,
      status: "active",
    }).lean();
    if (!space) throw createError(404, "Active facility space not found");
    if (Number(input.attendees) > space.capacity)
      throw createError(409, `This space supports at most ${space.capacity} attendees`);
    const conflict = await FacilityBookingModel.exists({
      spaceId,
      status: "confirmed",
      startsAt: { $lt: endsAt },
      endsAt: { $gt: startsAt },
    });
    if (conflict)
      throw createError(409, "This facility is already reserved during the selected time");
    return FacilityBookingModel.create({
      ...input,
      campusId,
      spaceId,
      startsAt,
      endsAt,
      bookedBy: actorId,
      createdBy: actorId,
    });
  },
  inspections: (campusIds?: string[]) =>
    FacilityInspectionModel.find(scoped(campusIds))
      .populate("spaceId", "code name building")
      .populate("inspectedBy", "name")
      .sort({ inspectedAt: -1 })
      .lean(),
  async createInspection(actorId: string, input: Record<string, unknown>) {
    const campusId = String(input.campusId),
      spaceId = String(input.spaceId),
      space = await FacilitySpaceModel.findOne({ _id: spaceId, campusId }).lean();
    if (!space) throw createError(404, "Facility space not found at this campus");
    const checklist = input.checklist as Array<{ item: string; passed: boolean; note?: string }>;
    if (!checklist.length) throw createError(400, "Inspection checklist cannot be empty");
    const score = Math.round(
        (checklist.filter((item) => item.passed).length / checklist.length) * 100,
      ),
      outcome = score >= 90 ? "pass" : score >= 70 ? "conditional" : "fail";
    return FacilityInspectionModel.create({
      ...input,
      campusId,
      spaceId,
      checklist,
      score,
      outcome,
      inspectedBy: actorId,
      inspectedAt: new Date(),
      createdBy: actorId,
    });
  },
  async dashboard(campusIds?: string[]) {
    const scope = scoped(campusIds),
      now = new Date();
    const [
      spaces,
      assets,
      openWorkOrders,
      overdueWorkOrders,
      dueMaintenance,
      bookingsToday,
      acquisition,
    ] = await Promise.all([
      FacilitySpaceModel.countDocuments(scope),
      AssetModel.countDocuments(scope),
      FacilityWorkOrderModel.countDocuments({
        ...scope,
        status: { $nin: ["completed", "cancelled"] },
      }),
      FacilityWorkOrderModel.countDocuments({
        ...scope,
        status: { $nin: ["completed", "cancelled"] },
        dueAt: { $lt: now },
      }),
      AssetModel.countDocuments({
        ...scope,
        status: "in_service",
        nextMaintenanceAt: { $lte: now },
      }),
      FacilityBookingModel.countDocuments({
        ...scope,
        status: "confirmed",
        startsAt: { $lt: new Date(now.getTime() + 86_400_000) },
        endsAt: { $gt: now },
      }),
      AssetModel.aggregate([
        { $match: scope },
        { $group: { _id: null, value: { $sum: "$acquisitionCost" } } },
      ]),
    ]);
    return {
      spaces,
      assets,
      openWorkOrders,
      overdueWorkOrders,
      dueMaintenance,
      bookingsToday,
      acquisitionValue: acquisition[0]?.value ?? 0,
    };
  },
};
