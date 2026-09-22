import createError from "http-errors";
import mongoose, { Types } from "mongoose";
import { nextSeq } from "../models/counter.model";
import {
  ProcurementGoodsReceiptModel,
  ProcurementPurchaseOrderModel,
  ProcurementRfqModel,
  ProcurementSupplierInvoiceModel,
  ProcurementVendorModel,
  type IProcurementQuote,
} from "../models/procure-to-pay.model";
import { RequisitionModel } from "../models/requisition.model";
import { StoreItemModel, StoreStockMovementModel } from "../models/store.model";
import { generalLedgerService } from "./general-ledger.service";
import { AccountsTransactionModel } from "../models/accounts.model";

const COMPETITIVE_QUOTE_THRESHOLD = 50_000;
const MIN_COMPETITIVE_QUOTES = 3;

function money(value: unknown, label: string): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0)
    throw createError(400, `${label} must be a non-negative amount`);
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function validateQuoteTotals(input: {
  subtotal: unknown;
  taxAmount: unknown;
  totalAmount: unknown;
}) {
  const subtotal = money(input.subtotal, "Quote subtotal");
  const taxAmount = money(input.taxAmount, "Quote tax");
  const totalAmount = money(input.totalAmount, "Quote total");
  if (Math.abs(subtotal + taxAmount - totalAmount) > 0.01)
    throw createError(400, "Quote subtotal and tax must equal the total amount");
  return { subtotal, taxAmount, totalAmount };
}

export function invoiceMatch(input: {
  invoiceTotal: number;
  remainingPoAmount: number;
  acceptedQuantity: number;
  poQuantity: number;
}) {
  const tolerance = Math.max(1, Math.round(input.remainingPoAmount * 0.01 * 100) / 100);
  const variance = Math.round((input.invoiceTotal - input.remainingPoAmount) * 100) / 100;
  return {
    variance,
    matched:
      input.acceptedQuantity >= input.poQuantity &&
      input.invoiceTotal <= input.remainingPoAmount + tolerance,
  };
}

async function procurementNumber(prefix: string, sequenceKey: string) {
  const year = new Date().getFullYear();
  const sequence = await nextSeq(`${sequenceKey}:${year}`);
  return `${prefix}-${year}-${String(sequence).padStart(6, "0")}`;
}

export const procureToPayService = {
  listVendors: (filter: Record<string, unknown> = {}) =>
    ProcurementVendorModel.find(filter).sort({ legalName: 1 }).limit(500).lean().exec(),

  async createVendor(
    input: {
      legalName: string;
      tradeName?: string;
      gstin?: string;
      pan?: string;
      email: string;
      phone: string;
      address: string;
      paymentTermsDays?: number;
    },
    actorId: string,
  ) {
    if (!input.legalName?.trim() || !input.email?.trim() || !input.phone?.trim())
      throw createError(400, "Vendor legal name, email and phone are required");
    return ProcurementVendorModel.create({
      ...input,
      vendorNumber: await procurementNumber("VEN", "procurement-vendor"),
      status: "draft",
      createdBy: actorId,
    });
  },

  async submitVendor(id: string, actorId: string) {
    const vendor = await ProcurementVendorModel.findOneAndUpdate(
      { _id: id, status: "draft" },
      { $set: { status: "pending_approval", submittedBy: actorId, updatedBy: actorId } },
      { returnDocument: "after" },
    )
      .lean()
      .exec();
    if (!vendor) throw createError(409, "Only a draft vendor can be submitted");
    return vendor;
  },

  async decideVendor(id: string, action: "approve" | "suspend", actorId: string, reason?: string) {
    const vendor = await ProcurementVendorModel.findById(id).lean().exec();
    if (!vendor) throw createError(404, "Vendor not found");
    if (String(vendor.submittedBy) === actorId)
      throw createError(409, "Vendor submitter cannot approve or suspend the same vendor");
    if (action === "approve" && vendor.status !== "pending_approval")
      throw createError(409, "Only a submitted vendor can be approved");
    if (action === "suspend" && vendor.status !== "approved")
      throw createError(409, "Only an approved vendor can be suspended");
    if (action === "suspend" && (!reason || reason.trim().length < 5))
      throw createError(400, "A meaningful suspension reason is required");
    return ProcurementVendorModel.findOneAndUpdate(
      { _id: id, status: vendor.status },
      {
        $set: {
          status: action === "approve" ? "approved" : "suspended",
          approvedBy: action === "approve" ? actorId : vendor.approvedBy,
          approvedAt: action === "approve" ? new Date() : vendor.approvedAt,
          suspensionReason: action === "suspend" ? reason?.trim() : undefined,
          updatedBy: actorId,
        },
      },
      { returnDocument: "after" },
    )
      .lean()
      .exec();
  },

  async createRfq(
    input: { requisitionId: string; vendorIds: string[]; closesAt: string },
    actorId: string,
  ) {
    const requisition = await RequisitionModel.findOne({
      _id: input.requisitionId,
      status: "hod_approved",
    })
      .lean()
      .exec();
    if (!requisition)
      throw createError(409, "RFQ requires a requisition approved by the department head");
    const vendorIds = Array.from(new Set(input.vendorIds));
    const requiredQuotes =
      requisition.estimatedCost >= COMPETITIVE_QUOTE_THRESHOLD ? MIN_COMPETITIVE_QUOTES : 1;
    if (vendorIds.length < requiredQuotes)
      throw createError(400, `At least ${requiredQuotes} approved vendors must be invited`);
    const approved = await ProcurementVendorModel.countDocuments({
      _id: { $in: vendorIds },
      status: "approved",
    });
    if (approved !== vendorIds.length)
      throw createError(400, "Every invited vendor must be approved");
    const closesAt = new Date(input.closesAt);
    if (!Number.isFinite(closesAt.getTime()) || closesAt <= new Date())
      throw createError(400, "RFQ closing date must be in the future");
    return ProcurementRfqModel.create({
      rfqNumber: await procurementNumber("RFQ", "procurement-rfq"),
      requisitionId: requisition._id,
      invitedVendorIds: vendorIds,
      closesAt,
      createdBy: actorId,
    });
  },

  listRfqs: (filter: Record<string, unknown> = {}) =>
    ProcurementRfqModel.find(filter)
      .populate("invitedVendorIds", "vendorNumber legalName")
      .populate("awardedVendorId", "vendorNumber legalName")
      .sort({ createdAt: -1 })
      .limit(500)
      .lean()
      .exec(),

  async addQuote(
    rfqId: string,
    input: Omit<IProcurementQuote, "vendorId" | "submittedAt" | "validUntil"> & {
      vendorId: string;
      validUntil: string | Date;
    },
  ) {
    const totals = validateQuoteTotals(input);
    const validUntil = new Date(input.validUntil);
    if (!Number.isFinite(validUntil.getTime()) || validUntil <= new Date())
      throw createError(400, "Quote validity must be in the future");
    const rfq = await ProcurementRfqModel.findOneAndUpdate(
      {
        _id: rfqId,
        status: "open",
        closesAt: { $gt: new Date() },
        invitedVendorIds: input.vendorId,
        "quotes.vendorId": { $ne: new Types.ObjectId(input.vendorId) },
      },
      {
        $push: {
          quotes: {
            ...input,
            ...totals,
            vendorId: input.vendorId,
            validUntil,
            submittedAt: new Date(),
          },
        },
      },
      { returnDocument: "after", runValidators: true },
    )
      .lean()
      .exec();
    if (!rfq)
      throw createError(409, "RFQ is closed, vendor is not invited, or a quote already exists");
    return rfq;
  },

  async awardRfq(rfqId: string, quoteNumber: string, awardReason: string, actorId: string) {
    if (!awardReason?.trim() || awardReason.trim().length < 10)
      throw createError(400, "A meaningful award justification is required");
    const session = await mongoose.startSession();
    let purchaseOrder: unknown;
    try {
      await session.withTransaction(async () => {
        const rfq = await ProcurementRfqModel.findOne({
          _id: rfqId,
          status: { $in: ["open", "evaluation"] },
        }).session(session);
        if (!rfq) throw createError(409, "RFQ is unavailable or already awarded");
        if (String(rfq.createdBy) === actorId)
          throw createError(409, "RFQ creator cannot award the same RFQ");
        const requisition = await RequisitionModel.findById(rfq.requisitionId).session(session);
        if (!requisition || requisition.status !== "hod_approved")
          throw createError(409, "Requisition is no longer eligible for award");
        const requiredQuotes =
          requisition.estimatedCost >= COMPETITIVE_QUOTE_THRESHOLD ? MIN_COMPETITIVE_QUOTES : 1;
        if (rfq.quotes.length < requiredQuotes)
          throw createError(409, `At least ${requiredQuotes} valid quotes are required`);
        if (rfq.closesAt > new Date() && rfq.quotes.length < rfq.invitedVendorIds.length)
          throw createError(
            409,
            "RFQ cannot be awarded before closing unless every invited vendor has responded",
          );
        const quote = rfq.quotes.find((candidate) => candidate.quoteNumber === quoteNumber);
        if (!quote || quote.validUntil <= new Date())
          throw createError(400, "Quote is invalid or expired");
        const vendor = await ProcurementVendorModel.findOne({
          _id: quote.vendorId,
          status: "approved",
        }).session(session);
        if (!vendor) throw createError(409, "Awarded vendor is not active");

        const poNumber = await procurementNumber("PO", "procurement-po");
        const [created] = await ProcurementPurchaseOrderModel.create(
          [
            {
              poNumber,
              requisitionId: requisition._id,
              rfqId: rfq._id,
              vendorId: quote.vendorId,
              itemName: requisition.itemName,
              quantity: requisition.quantity,
              unitPrice: quote.subtotal / requisition.quantity,
              subtotal: quote.subtotal,
              taxAmount: quote.taxAmount,
              totalAmount: quote.totalAmount,
              deliveryDueDate: new Date(
                Date.now() + Math.max(1, quote.deliveryDays) * 24 * 60 * 60 * 1000,
              ),
              paymentTermsDays: vendor.paymentTermsDays,
              issuedBy: actorId,
            },
          ],
          { session },
        );
        rfq.status = "awarded";
        rfq.awardedVendorId = quote.vendorId;
        rfq.awardedQuoteNumber = quote.quoteNumber;
        rfq.awardReason = awardReason.trim();
        rfq.awardedBy = new Types.ObjectId(actorId);
        rfq.awardedAt = new Date();
        await rfq.save({ session });
        requisition.status = "approved";
        requisition.poNumber = poNumber;
        requisition.approvedBy = new Types.ObjectId(actorId);
        await requisition.save({ session });
        purchaseOrder = created.toObject();
      });
    } finally {
      await session.endSession();
    }
    if (!purchaseOrder) throw createError(500, "Purchase order transaction did not complete");
    return purchaseOrder;
  },

  listPurchaseOrders: (filter: Record<string, unknown> = {}) =>
    ProcurementPurchaseOrderModel.find(filter)
      .populate("vendorId", "vendorNumber legalName")
      .sort({ createdAt: -1 })
      .limit(500)
      .lean()
      .exec(),

  listGoodsReceipts: (filter: Record<string, unknown> = {}) =>
    ProcurementGoodsReceiptModel.find(filter)
      .populate("purchaseOrderId", "poNumber itemName vendorId")
      .sort({ receivedAt: -1 })
      .limit(500)
      .lean()
      .exec(),

  async receiveAndInspect(
    purchaseOrderId: string,
    input: {
      quantityReceived: number;
      quantityAccepted: number;
      quantityRejected: number;
      inspectionNotes?: string;
    },
    actorId: string,
  ) {
    if (
      !Number.isInteger(input.quantityReceived) ||
      input.quantityReceived < 1 ||
      !Number.isInteger(input.quantityAccepted) ||
      !Number.isInteger(input.quantityRejected) ||
      input.quantityAccepted + input.quantityRejected !== input.quantityReceived
    )
      throw createError(400, "Accepted and rejected quantities must equal received quantity");
    const session = await mongoose.startSession();
    let receipt: unknown;
    try {
      await session.withTransaction(async () => {
        const po = await ProcurementPurchaseOrderModel.findOne({
          _id: purchaseOrderId,
          status: { $in: ["issued", "partially_received"] },
        }).session(session);
        if (!po) throw createError(409, "Purchase order cannot receive goods");
        if (input.quantityReceived > po.quantity - po.receivedQuantity)
          throw createError(409, "Receipt exceeds the outstanding purchase-order quantity");
        const grnNumber = await procurementNumber("GRN", "procurement-grn");
        const status =
          input.quantityRejected === 0
            ? "accepted"
            : input.quantityAccepted === 0
              ? "rejected"
              : "partially_rejected";
        const [created] = await ProcurementGoodsReceiptModel.create(
          [
            {
              grnNumber,
              purchaseOrderId: po._id,
              ...input,
              status,
              receivedBy: actorId,
              inspectedBy: actorId,
            },
          ],
          { session },
        );
        po.receivedQuantity += input.quantityAccepted;
        po.status = po.receivedQuantity === po.quantity ? "received" : "partially_received";
        await po.save({ session });

        if (input.quantityAccepted > 0) {
          const escaped = po.itemName.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const item = await StoreItemModel.findOneAndUpdate(
            { name: { $regex: new RegExp(`^${escaped}$`, "i") } },
            {
              $inc: { currentStock: input.quantityAccepted },
              $set: { unitCost: po.unitPrice, updatedBy: actorId },
            },
            { returnDocument: "after", session },
          );
          if (!item)
            throw createError(409, "Create the approved store item before receiving this PO");
          await StoreStockMovementModel.create(
            [
              {
                itemId: item._id,
                delta: input.quantityAccepted,
                balanceAfter: item.currentStock,
                reason: `Goods receipt ${grnNumber} against ${po.poNumber}`,
                performedBy: actorId,
              },
            ],
            { session },
          );
        }
        receipt = created.toObject();
      });
    } finally {
      await session.endSession();
    }
    if (!receipt) throw createError(500, "Goods receipt transaction did not complete");
    return receipt;
  },

  async returnRejectedGoods(receiptId: string, reason: string, actorId: string) {
    const returnReason = String(reason ?? "").trim();
    if (returnReason.length < 5)
      throw createError(400, "A meaningful supplier-return reason is required");
    const receipt = await ProcurementGoodsReceiptModel.findOneAndUpdate(
      {
        _id: receiptId,
        quantityRejected: { $gt: 0 },
        rejectedQuantityReturned: false,
        status: { $in: ["rejected", "partially_rejected"] },
      },
      {
        $set: {
          rejectedQuantityReturned: true,
          returnReason,
          returnedBy: actorId,
          returnedAt: new Date(),
        },
      },
      { returnDocument: "after", runValidators: true },
    )
      .lean()
      .exec();
    if (!receipt) throw createError(409, "Rejected goods are unavailable or were already returned");
    return receipt;
  },

  async submitInvoice(
    input: {
      invoiceNumber: string;
      purchaseOrderId: string;
      grnIds: string[];
      subtotal: number;
      taxAmount: number;
      totalAmount: number;
      dueDate: string;
    },
    actorId: string,
  ) {
    const totals = validateQuoteTotals(input);
    const po = await ProcurementPurchaseOrderModel.findById(input.purchaseOrderId).lean().exec();
    if (!po || !["received", "partially_received"].includes(po.status))
      throw createError(409, "Supplier invoice requires received goods");
    const receipts = await ProcurementGoodsReceiptModel.find({
      _id: { $in: input.grnIds },
      purchaseOrderId: po._id,
      status: { $in: ["accepted", "partially_rejected"] },
    })
      .lean()
      .exec();
    if (!input.grnIds.length || receipts.length !== new Set(input.grnIds).size)
      throw createError(400, "Every invoice receipt must be an accepted GRN for this PO");
    const alreadyInvoiced = await ProcurementSupplierInvoiceModel.exists({
      grnIds: { $in: input.grnIds },
      status: { $ne: "rejected" },
    });
    if (alreadyInvoiced) throw createError(409, "A selected goods receipt is already invoiced");
    const acceptedQuantity = receipts.reduce((sum, row) => sum + row.quantityAccepted, 0);
    const match = invoiceMatch({
      invoiceTotal: totals.totalAmount,
      remainingPoAmount: po.totalAmount - po.invoicedAmount,
      acceptedQuantity,
      poQuantity: po.quantity,
    });
    const dueDate = new Date(input.dueDate);
    if (!Number.isFinite(dueDate.getTime()) || dueDate < new Date())
      throw createError(400, "Invoice due date cannot be in the past");
    return ProcurementSupplierInvoiceModel.create({
      ...input,
      ...totals,
      vendorId: po.vendorId,
      grnIds: Array.from(new Set(input.grnIds)),
      dueDate,
      status: match.matched ? "matched" : "pending_match",
      matchVariance: match.variance,
      submittedBy: actorId,
    });
  },

  listInvoices: (filter: Record<string, unknown> = {}) =>
    ProcurementSupplierInvoiceModel.find(filter)
      .populate("vendorId", "vendorNumber legalName")
      .populate("purchaseOrderId", "poNumber itemName totalAmount")
      .sort({ createdAt: -1 })
      .limit(500)
      .lean()
      .exec(),

  async decideInvoice(id: string, action: "approve" | "reject", actorId: string, reason?: string) {
    const invoice = await ProcurementSupplierInvoiceModel.findById(id);
    if (!invoice) throw createError(404, "Supplier invoice not found");
    if (String(invoice.submittedBy) === actorId)
      throw createError(409, "Invoice submitter cannot approve or reject the same invoice");
    if (action === "approve" && invoice.status !== "matched")
      throw createError(409, "Only a successfully matched invoice can be approved");
    if (action === "reject" && (!reason || reason.trim().length < 5))
      throw createError(400, "A meaningful rejection reason is required");
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const changed = await ProcurementSupplierInvoiceModel.findOneAndUpdate(
          { _id: id, status: invoice.status },
          {
            $set: {
              status: action === "approve" ? "approved" : "rejected",
              approvedBy: action === "approve" ? actorId : undefined,
              approvedAt: action === "approve" ? new Date() : undefined,
              rejectionReason: action === "reject" ? reason?.trim() : undefined,
              updatedBy: actorId,
            },
          },
          { returnDocument: "after", session },
        );
        if (!changed) throw createError(409, "Invoice was concurrently changed");
        if (action === "approve") {
          const po = await ProcurementPurchaseOrderModel.findById(changed.purchaseOrderId).session(
            session,
          );
          if (!po) throw createError(404, "Purchase order not found");
          if (
            po.invoicedAmount + changed.totalAmount >
            po.totalAmount + Math.max(1, po.totalAmount * 0.01)
          )
            throw createError(409, "Approved invoices would exceed the purchase order");
          const updated = await ProcurementPurchaseOrderModel.updateOne(
            { _id: po._id, invoicedAmount: po.invoicedAmount },
            {
              $inc: { invoicedAmount: changed.totalAmount },
              $set: { status: "invoiced" },
            },
            { session },
          );
          if (updated.modifiedCount !== 1)
            throw createError(409, "Purchase order was concurrently invoiced");
          const now = new Date();
          const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
          const journal = await generalLedgerService.postJournal(
            {
              date: now,
              financialYear: `${startYear}-${String(startYear + 1).slice(-2)}`,
              description: `Supplier invoice ${changed.invoiceNumber} approved`,
              sourceType: "ProcurementSupplierInvoice",
              sourceId: changed._id,
              sourceEvent: "invoice:approve",
              postedBy: actorId,
              lines: [
                {
                  accountCode: "5200-PROCUREMENT-EXPENSE",
                  accountName: "Procurement Expense",
                  accountType: "expense",
                  debit: changed.totalAmount,
                  partyId: changed.vendorId,
                },
                {
                  accountCode: "2000-ACCOUNTS-PAYABLE",
                  accountName: "Accounts Payable",
                  accountType: "liability",
                  credit: changed.totalAmount,
                  partyId: changed.vendorId,
                },
              ],
            },
            session,
          );
          changed.approvalJournalEntryId = journal._id;
          await changed.save({ session });
        }
      });
    } finally {
      await session.endSession();
    }
    return ProcurementSupplierInvoiceModel.findById(id).lean().exec();
  },

  async payInvoice(
    id: string,
    input: { paymentReference: string; paymentDate: string },
    actorId: string,
  ) {
    const invoice = await ProcurementSupplierInvoiceModel.findOne({ _id: id, status: "approved" });
    if (!invoice) throw createError(409, "Only an approved unpaid invoice can be paid");
    if (String(invoice.approvedBy) === actorId)
      throw createError(409, "Invoice approver cannot release payment for the same invoice");
    const paymentDate = new Date(input.paymentDate);
    if (!Number.isFinite(paymentDate.getTime()) || paymentDate > new Date())
      throw createError(400, "Payment date must be valid and cannot be in the future");
    if (!input.paymentReference?.trim())
      throw createError(400, "Bank payment reference is required");
    const startYear =
      paymentDate.getMonth() >= 3 ? paymentDate.getFullYear() : paymentDate.getFullYear() - 1;
    const financialYear = `${startYear}-${String(startYear + 1).slice(-2)}`;
    const session = await mongoose.startSession();
    let result: unknown;
    try {
      await session.withTransaction(async () => {
        const journal = await generalLedgerService.postJournal(
          {
            date: paymentDate,
            financialYear,
            description: `Supplier payment ${input.paymentReference.trim()} for ${invoice.invoiceNumber}`,
            sourceType: "ProcurementSupplierInvoice",
            sourceId: invoice._id,
            sourceEvent: `invoice:payment:${input.paymentReference.trim()}`,
            postedBy: actorId,
            lines: [
              {
                accountCode: "2000-ACCOUNTS-PAYABLE",
                accountName: "Accounts Payable",
                accountType: "liability",
                debit: invoice.totalAmount,
                partyId: invoice.vendorId,
              },
              {
                accountCode: "1010-BANK",
                accountName: "Bank Account",
                accountType: "asset",
                credit: invoice.totalAmount,
                partyId: invoice.vendorId,
              },
            ],
          },
          session,
        );
        const changed = await ProcurementSupplierInvoiceModel.findOneAndUpdate(
          { _id: id, status: "approved" },
          {
            $set: {
              status: "paid",
              paymentJournalEntryId: journal._id,
              paymentReference: input.paymentReference.trim(),
              paidBy: actorId,
              paidAt: paymentDate,
              updatedBy: actorId,
            },
          },
          { returnDocument: "after", session },
        );
        if (!changed) throw createError(409, "Invoice was concurrently paid");
        await AccountsTransactionModel.create(
          [
            {
              transactionType: "expense",
              category: "Supplier Payment",
              subCategory: "Procurement",
              amount: invoice.totalAmount,
              paymentMode: "bank_transfer",
              referenceNo: input.paymentReference.trim(),
              description: `Supplier payment for invoice ${invoice.invoiceNumber}`,
              relatedDocumentId: invoice._id,
              relatedDocumentType: "ProcurementSupplierInvoice",
              date: paymentDate,
              financialYear,
              approvedBy: actorId,
              createdBy: actorId,
              externalSourceKey: `supplier-payment:${invoice._id.toString()}`,
            },
          ],
          { session },
        );
        result = changed.toObject();
      });
    } finally {
      await session.endSession();
    }
    return result;
  },
};
