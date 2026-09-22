import createError from "http-errors";
import mongoose, { Types } from "mongoose";
import { RequisitionModel } from "../models/requisition.model";
import { StoreItemModel } from "../models/store.model";
import { notifyUsers } from "./helpers/notify.helper";
import { NotificationType } from "../models/notification.model";
import { nextSeq } from "../models/counter.model";
import { DepartmentModel } from "../models/department.model";

export const procurementService = {
  /** Raise a new requisition */
  createRequisition: async (data: {
    itemName: string;
    quantity: number;
    estimatedCost: number;
    purpose: string;
    departmentId: string;
    raisedBy: string;
    notes?: string;
  }) => {
    const departmentExists = await DepartmentModel.exists({ _id: data.departmentId });
    if (!departmentExists) throw createError(400, "A valid department is required");
    // Generate sequential request number: REQ-YYYY-XXXX
    const currentYear = new Date().getFullYear();
    const prefix = `REQ-${currentYear}-`;

    const seq = await nextSeq(`procurement-requisition:${currentYear}`);

    const requisitionNumber = `${prefix}${String(seq).padStart(4, "0")}`;

    const requisition = await RequisitionModel.create({
      ...data,
      requisitionNumber,
      status: "pending",
    });

    return requisition;
  },

  /** Approve or Reject a requisition */
  decideRequisition: async (
    id: string,
    action: "hod_approve" | "approve" | "reject",
    userId: string,
    notes?: string,
  ) => {
    const req = await RequisitionModel.findById(id);
    if (!req) throw createError(404, "Requisition not found");
    if (req.status === "approved" || req.status === "rejected") {
      throw createError(400, "Requisition is already finalized");
    }
    if (req.raisedBy.toString() === userId) {
      throw createError(409, "A requisition requester cannot approve their own request");
    }

    if (action === "hod_approve") {
      if (req.status !== "pending") {
        throw createError(409, "Only a pending requisition can be recommended");
      }
      req.status = "hod_approved";
      req.hodApprovedBy = new Types.ObjectId(userId);
    } else if (action === "reject") {
      if (!notes || notes.trim().length < 5) {
        throw createError(400, "A meaningful rejection reason is required");
      }
      req.status = "rejected";
    } else if (action === "approve") {
      if (req.status !== "hod_approved") {
        throw createError(409, "Final approval requires HOD approval first");
      }
      if (req.hodApprovedBy?.toString() === userId) {
        throw createError(409, "Final approval requires a different approver");
      }
      if (!req.hodApprovedBy) {
        throw createError(409, "A recorded HOD recommendation is required");
      }
      req.status = "approved";
      req.approvedBy = new Types.ObjectId(userId);

      // Generate PO number
      const currentYear = new Date().getFullYear();
      const prefix = `PO-${currentYear}-`;
      const seq = await nextSeq(`procurement-po:${currentYear}`);
      req.poNumber = `${prefix}${String(seq).padStart(4, "0")}`;
    }

    if (notes) req.notes = notes;
    await req.save();

    // Notify applicant of the decision
    setImmediate(() => {
      void notifyUsers([req.raisedBy.toString()], {
        title: "Requisition Update",
        body: `Your requisition for ${req.itemName} has been updated to status: ${req.status}.`,
        type: action === "reject" ? NotificationType.WARNING : NotificationType.SUCCESS,
        actionUrl: "/procurement",
      }).catch((err) => console.error("[Procurement Service] Notify failed", err));
    });

    return req;
  },

  /** Post physically received goods to stock. Approval alone never changes inventory. */
  receiveGoods: async (id: string, quantity: number, userId: string) => {
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw createError(400, "Received quantity must be a positive whole number");
    }

    const session = await mongoose.startSession();
    let result:
      | {
          requisition: InstanceType<typeof RequisitionModel>;
          storeItem: InstanceType<typeof StoreItemModel>;
        }
      | undefined;
    try {
      await session.withTransaction(async () => {
        const req = await RequisitionModel.findOne({
          _id: id,
          status: { $in: ["approved", "partially_received"] },
        }).session(session);
        if (!req) throw createError(409, "Only an approved purchase order can receive goods");

        const remaining = req.quantity - req.receivedQuantity;
        if (quantity > remaining) {
          throw createError(409, `Only ${remaining} item(s) remain to be received`);
        }

        const matchName = req.itemName.trim();
        const escapedName = matchName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const unitCost = req.quantity > 0 ? req.estimatedCost / req.quantity : 0;
        let storeItem = await StoreItemModel.findOneAndUpdate(
          { name: { $regex: new RegExp(`^${escapedName}$`, "i") } },
          { $inc: { currentStock: quantity }, $set: { unitCost } },
          { returnDocument: "after", session },
        );

        if (!storeItem) {
          const skuSeq = await nextSeq("store-auto-sku");
          [storeItem] = await StoreItemModel.create(
            [
              {
                sku: `AUTO-${String(skuSeq).padStart(6, "0")}`,
                name: matchName,
                category: "other",
                unit: "pcs",
                currentStock: quantity,
                minStock: 1,
                unitCost,
              },
            ],
            { session },
          );
        }

        req.receivedQuantity += quantity;
        req.receivedBy = new Types.ObjectId(userId);
        req.receivedAt = new Date();
        req.status = req.receivedQuantity === req.quantity ? "received" : "partially_received";
        await req.save({ session });
        result = { requisition: req, storeItem };
      });
    } finally {
      await session.endSession();
    }
    if (!result) throw createError(500, "Goods receipt transaction did not complete");
    return result;
  },

  /** Get requisitions based on user scope */
  getById: async (id: string) => {
    const requisition = await RequisitionModel.findById(id)
      .populate("departmentId", "name code")
      .lean();
    if (!requisition) throw createError(404, "Requisition not found");
    return requisition;
  },

  getAll: async (filter: Record<string, unknown> = {}) => {
    return RequisitionModel.find(filter)
      .populate("raisedBy", "name email")
      .populate("departmentId", "name")
      .sort({ createdAt: -1 })
      .lean();
  },
};
