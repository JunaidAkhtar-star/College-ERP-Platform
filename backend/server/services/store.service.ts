/**
 * @file store.service.ts
 * @description Inventory CRUD + requisition workflow.
 */
import createError from "http-errors";
import mongoose, { Types } from "mongoose";
import {
  StoreItemModel,
  StoreRequestModel,
  StoreStockMovementModel,
  type IStoreItem,
  type TStoreRequestStatus,
} from "../models/store.model";
import type { IUser } from "../models/user.model";
import { nextSeq } from "../models/counter.model";

async function nextRequestNo(): Promise<string> {
  const yy = new Date().getFullYear().toString().slice(-2);
  const seq = await nextSeq(`store-request:${yy}`);
  return `REQ${yy}${String(seq).padStart(4, "0")}`;
}

export const storeService = {
  // ── Items ────────────────────────────────────────────────────────────────
  listItems: async (filter: Record<string, unknown> = {}, page = 1, limit = 50) => {
    const q: Record<string, unknown> = {};
    if (filter["category"]) q["category"] = filter["category"];
    if (filter["search"]) {
      const re = new RegExp(String(filter["search"]), "i");
      q["$or"] = [{ name: re }, { sku: re }, { vendor: re }];
    }
    const [data, total] = await Promise.all([
      StoreItemModel.find(q)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      StoreItemModel.countDocuments(q),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  getItem: async (id: string) => {
    const doc = await StoreItemModel.findById(id).lean();
    if (!doc) throw createError(404, "Item not found");
    return doc;
  },

  createItem: async (data: Partial<IStoreItem>, actorId: string) => {
    if (!data.sku || !data.name) throw createError(400, "sku and name are required");
    const exists = await StoreItemModel.findOne({ sku: data.sku.toUpperCase() });
    if (exists) throw createError(409, "SKU already exists");
    const openingStock = Math.max(0, Number(data.currentStock ?? 0));
    return mongoose.connection.transaction(async (session) => {
      const [item] = await StoreItemModel.create(
        [
          {
            ...data,
            sku: data.sku!.toUpperCase(),
            currentStock: openingStock,
            createdBy: new Types.ObjectId(actorId),
          },
        ],
        { session },
      );
      if (openingStock > 0) {
        await StoreStockMovementModel.create(
          [
            {
              itemId: item._id,
              delta: openingStock,
              balanceAfter: openingStock,
              reason: "Governed opening inventory balance",
              sourceType: "OpeningBalance",
              sourceId: item._id,
              unitCost: item.unitCost,
              movementValue: item.unitCost ? openingStock * item.unitCost : undefined,
              performedBy: actorId,
            },
          ],
          { session },
        );
      }
      return item.toObject();
    });
  },

  updateItem: async (id: string, data: Partial<IStoreItem>, actorId: string) => {
    const { currentStock: _currentStock, sku: _sku, ...allowed } = data;
    const doc = await StoreItemModel.findByIdAndUpdate(
      id,
      { $set: { ...allowed, updatedBy: actorId } },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!doc) throw createError(404, "Item not found");
    return doc;
  },

  adjustStock: async (id: string, delta: number, note: string, actorId: string) => {
    if (!Number.isInteger(delta) || delta === 0)
      throw createError(400, "Stock delta must be a non-zero integer");
    if (!note?.trim() || note.trim().length < 5)
      throw createError(400, "A stock adjustment reason is required");
    return mongoose.connection.transaction(async (session) => {
      const doc = await StoreItemModel.findOneAndUpdate(
        { _id: id, ...(delta < 0 ? { currentStock: { $gte: Math.abs(delta) } } : {}) },
        { $inc: { currentStock: delta }, $set: { notes: note.trim(), updatedBy: actorId } },
        { returnDocument: "after", runValidators: true, session },
      );
      if (!doc) throw createError(409, "Item not found or stock would become negative");
      await StoreStockMovementModel.create(
        [
          {
            itemId: doc._id,
            delta,
            balanceAfter: doc.currentStock,
            reason: note.trim(),
            sourceType: "ControlledAdjustment",
            sourceId: doc._id,
            unitCost: doc.unitCost,
            movementValue: doc.unitCost ? Math.abs(delta) * doc.unitCost : undefined,
            performedBy: actorId,
          },
        ],
        { session },
      );
      return doc.toObject();
    });
  },

  deleteItem: async (id: string, actorId: string) => {
    const activeRequest = await StoreRequestModel.exists({
      itemId: id,
      status: { $in: ["pending", "approved"] },
    });
    if (activeRequest) throw createError(409, "Item has active requests and cannot be deactivated");
    const doc = await StoreItemModel.findByIdAndUpdate(
      id,
      { $set: { isActive: false, updatedBy: actorId } },
      { returnDocument: "after" },
    ).lean();
    if (!doc) throw createError(404, "Item not found");
    return { success: true };
  },

  stats: async () => {
    const [total, active, lowStock] = await Promise.all([
      StoreItemModel.countDocuments(),
      StoreItemModel.countDocuments({ isActive: true }),
      StoreItemModel.countDocuments({ $expr: { $lt: ["$currentStock", "$minStock"] } }),
    ]);
    const pendingRequests = await StoreRequestModel.countDocuments({ status: "pending" });
    return { total, active, lowStock, pendingRequests };
  },

  listMovements: async (itemId?: string, page = 1, limit = 100) => {
    const filter = itemId ? { itemId } : {};
    const [data, total] = await Promise.all([
      StoreStockMovementModel.find(filter)
        .populate("itemId", "sku name unit")
        .populate("performedBy", "name")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      StoreStockMovementModel.countDocuments(filter),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  reorderPlan: () =>
    StoreItemModel.aggregate([
      { $match: { isActive: true, $expr: { $lte: ["$currentStock", "$minStock"] } } },
      {
        $project: {
          sku: 1,
          name: 1,
          unit: 1,
          currentStock: 1,
          minStock: 1,
          leadTimeDays: 1,
          suggestedQuantity: {
            $max: [
              "$reorderQuantity",
              { $subtract: [{ $multiply: ["$minStock", 2] }, "$currentStock"] },
            ],
          },
          estimatedValue: {
            $multiply: [
              {
                $max: [
                  "$reorderQuantity",
                  { $subtract: [{ $multiply: ["$minStock", 2] }, "$currentStock"] },
                ],
              },
              { $ifNull: ["$unitCost", 0] },
            ],
          },
        },
      },
      { $sort: { leadTimeDays: -1, name: 1 } },
    ]),

  async reconcileInventory() {
    const rows = await StoreItemModel.aggregate<{
      _id: Types.ObjectId;
      sku: string;
      name: string;
      currentStock: number;
      movementBalance: number;
      variance: number;
    }>([
      {
        $lookup: {
          from: "storestockmovements",
          localField: "_id",
          foreignField: "itemId",
          as: "movements",
        },
      },
      {
        $project: {
          sku: 1,
          name: 1,
          currentStock: 1,
          movementBalance: { $sum: "$movements.delta" },
        },
      },
      {
        $addFields: {
          variance: { $subtract: ["$currentStock", "$movementBalance"] },
        },
      },
      { $sort: { variance: -1, sku: 1 } },
    ]);
    return {
      balanced: rows.every((row) => row.variance === 0),
      exceptions: rows.filter((row) => row.variance !== 0),
      checked: rows.length,
      checkedAt: new Date(),
    };
  },

  // ── Requests ─────────────────────────────────────────────────────────────
  listRequests: async (filter: Record<string, unknown> = {}, page = 1, limit = 50) => {
    const q: Record<string, unknown> = {};
    if (filter["status"]) q["status"] = filter["status"];
    if (filter["requestedBy"]) q["requestedBy"] = filter["requestedBy"];
    const [data, total] = await Promise.all([
      StoreRequestModel.find(q)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      StoreRequestModel.countDocuments(q),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  createRequest: async (
    actor: IUser,
    data: { itemId: string; quantity: number; purpose?: string; department?: string },
  ) => {
    const item = await StoreItemModel.findOne({ _id: data.itemId, isActive: true }).lean();
    if (!item) throw createError(404, "Active store item not found");
    if (!data.quantity || data.quantity < 1) throw createError(400, "Quantity must be at least 1");
    const requestNumber = await nextRequestNo();
    return StoreRequestModel.create({
      requestNumber,
      itemId: item._id,
      itemName: item.name,
      quantity: data.quantity,
      requestedBy: actor._id,
      requestedByName: actor.name,
      department: data.department ? new Types.ObjectId(data.department) : undefined,
      purpose: data.purpose,
      status: "pending",
      createdBy: actor._id,
    });
  },

  decideRequest: async (
    id: string,
    actor: IUser,
    decision: Exclude<TStoreRequestStatus, "pending">,
    remarks?: string,
  ) => {
    const req = await StoreRequestModel.findById(id);
    if (!req) throw createError(404, "Request not found");
    if (req.requestedBy.toString() === actor._id.toString())
      throw createError(409, "Requesters cannot approve or issue their own store requests");
    if (req.status !== "pending" && decision !== "issued") {
      throw createError(400, "Request has already been decided");
    }
    if (decision === "issued") {
      if (req.status !== "approved") {
        throw createError(400, "Only approved requests can be issued");
      }
      if (req.approvedBy?.toString() === actor._id.toString()) {
        throw createError(409, "The request approver cannot issue the same stock request");
      }
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const item = await StoreItemModel.findOneAndUpdate(
            { _id: req.itemId, currentStock: { $gte: req.quantity } },
            { $inc: { currentStock: -req.quantity } },
            { returnDocument: "after", session },
          );
          if (!item)
            throw createError(409, "Insufficient stock or stock changed; refresh and retry");

          const issued = await StoreRequestModel.findOneAndUpdate(
            { _id: req._id, status: "approved" },
            {
              $set: {
                status: "issued",
                issuedBy: actor._id,
                issuedAt: new Date(),
                ...(remarks ? { remarks } : {}),
              },
            },
            { returnDocument: "after", session },
          );
          if (!issued) throw createError(409, "Request was already issued or changed");
          await StoreStockMovementModel.create(
            [
              {
                itemId: req.itemId,
                requestId: req._id,
                delta: -req.quantity,
                balanceAfter: item.currentStock,
                reason: `Issued against ${req.requestNumber}`,
                performedBy: actor._id,
              },
            ],
            { session },
          );
        });
      } finally {
        await session.endSession();
      }
      const issued = await StoreRequestModel.findById(req._id).lean();
      if (!issued) throw createError(404, "Request not found after issue");
      return issued;
    }
    if (decision === "rejected" && (!remarks || remarks.trim().length < 5)) {
      throw createError(400, "A meaningful rejection reason is required");
    }
    req.status = decision;
    req.decidedBy = actor._id as unknown as Types.ObjectId;
    req.decidedAt = new Date();
    if (decision === "approved") {
      req.approvedBy = actor._id as unknown as Types.ObjectId;
      req.approvedAt = new Date();
    }
    if (remarks) req.remarks = remarks;
    await req.save();
    return req.toObject();
  },
};
