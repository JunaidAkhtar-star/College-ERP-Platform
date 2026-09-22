import mongoose, { Schema, type Document, type Types } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";

export interface IProcurementVendor extends Document {
  _id: Types.ObjectId;
  vendorNumber: string;
  legalName: string;
  tradeName?: string;
  gstin?: string;
  pan?: string;
  email: string;
  phone: string;
  address: string;
  paymentTermsDays: number;
  status: "draft" | "pending_approval" | "approved" | "suspended";
  submittedBy?: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  suspensionReason?: string;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const procurementVendorSchema = new Schema<IProcurementVendor>(
  {
    vendorNumber: { type: String, required: true, unique: true, index: true },
    legalName: { type: String, required: true, trim: true, maxlength: 255 },
    tradeName: { type: String, trim: true, maxlength: 255 },
    gstin: { type: String, trim: true, uppercase: true, sparse: true, unique: true },
    pan: { type: String, trim: true, uppercase: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true, maxlength: 1000 },
    paymentTermsDays: { type: Number, min: 0, max: 365, default: 30 },
    status: {
      type: String,
      enum: ["draft", "pending_approval", "approved", "suspended"],
      default: "draft",
      index: true,
    },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    suspensionReason: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true },
);
procurementVendorSchema.plugin(auditPlugin);

export interface IProcurementQuote {
  vendorId: Types.ObjectId;
  quoteNumber: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  deliveryDays: number;
  validUntil: Date;
  attachmentUrl?: string;
  submittedAt: Date;
}

export interface IProcurementRfq extends Document {
  _id: Types.ObjectId;
  rfqNumber: string;
  requisitionId: Types.ObjectId;
  invitedVendorIds: Types.ObjectId[];
  quotes: IProcurementQuote[];
  status: "open" | "evaluation" | "awarded" | "cancelled";
  closesAt: Date;
  awardedVendorId?: Types.ObjectId;
  awardedQuoteNumber?: string;
  awardReason?: string;
  createdBy: Types.ObjectId;
  awardedBy?: Types.ObjectId;
  awardedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const quoteSchema = new Schema<IProcurementQuote>(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: "ProcurementVendor", required: true },
    quoteNumber: { type: String, required: true, trim: true },
    subtotal: { type: Number, required: true, min: 0 },
    taxAmount: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    deliveryDays: { type: Number, required: true, min: 0, max: 365 },
    validUntil: { type: Date, required: true },
    attachmentUrl: { type: String, trim: true },
    submittedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const procurementRfqSchema = new Schema<IProcurementRfq>(
  {
    rfqNumber: { type: String, required: true, unique: true, index: true },
    requisitionId: {
      type: Schema.Types.ObjectId,
      ref: "Requisition",
      required: true,
      unique: true,
      index: true,
    },
    invitedVendorIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "ProcurementVendor" }],
      validate: {
        validator: (value: Types.ObjectId[]) => value.length >= 1,
        message: "At least one approved vendor is required",
      },
    },
    quotes: { type: [quoteSchema], default: [] },
    status: {
      type: String,
      enum: ["open", "evaluation", "awarded", "cancelled"],
      default: "open",
      index: true,
    },
    closesAt: { type: Date, required: true, index: true },
    awardedVendorId: { type: Schema.Types.ObjectId, ref: "ProcurementVendor" },
    awardedQuoteNumber: { type: String },
    awardReason: { type: String, trim: true, maxlength: 1000 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    awardedBy: { type: Schema.Types.ObjectId, ref: "User" },
    awardedAt: { type: Date },
  },
  { timestamps: true },
);
procurementRfqSchema.plugin(auditPlugin);

export interface IProcurementPurchaseOrder extends Document {
  _id: Types.ObjectId;
  poNumber: string;
  requisitionId: Types.ObjectId;
  rfqId?: Types.ObjectId;
  vendorId: Types.ObjectId;
  itemName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  deliveryDueDate: Date;
  paymentTermsDays: number;
  status: "issued" | "partially_received" | "received" | "invoiced" | "closed" | "cancelled";
  receivedQuantity: number;
  invoicedAmount: number;
  issuedBy: Types.ObjectId;
  issuedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const procurementPurchaseOrderSchema = new Schema<IProcurementPurchaseOrder>(
  {
    poNumber: { type: String, required: true, unique: true, index: true },
    requisitionId: {
      type: Schema.Types.ObjectId,
      ref: "Requisition",
      required: true,
      unique: true,
      index: true,
    },
    rfqId: { type: Schema.Types.ObjectId, ref: "ProcurementRfq", sparse: true },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "ProcurementVendor",
      required: true,
      index: true,
    },
    itemName: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
    taxAmount: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    deliveryDueDate: { type: Date, required: true },
    paymentTermsDays: { type: Number, min: 0, max: 365, default: 30 },
    status: {
      type: String,
      enum: ["issued", "partially_received", "received", "invoiced", "closed", "cancelled"],
      default: "issued",
      index: true,
    },
    receivedQuantity: { type: Number, default: 0, min: 0 },
    invoicedAmount: { type: Number, default: 0, min: 0 },
    issuedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    issuedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
procurementPurchaseOrderSchema.plugin(auditPlugin);

export interface IProcurementGoodsReceipt extends Document {
  _id: Types.ObjectId;
  grnNumber: string;
  purchaseOrderId: Types.ObjectId;
  quantityReceived: number;
  quantityAccepted: number;
  quantityRejected: number;
  inspectionNotes?: string;
  status: "received" | "accepted" | "partially_rejected" | "rejected" | "returned";
  receivedBy: Types.ObjectId;
  inspectedBy?: Types.ObjectId;
  rejectedQuantityReturned: boolean;
  returnReason?: string;
  returnedBy?: Types.ObjectId;
  returnedAt?: Date;
  receivedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const procurementGoodsReceiptSchema = new Schema<IProcurementGoodsReceipt>(
  {
    grnNumber: { type: String, required: true, unique: true, index: true },
    purchaseOrderId: {
      type: Schema.Types.ObjectId,
      ref: "ProcurementPurchaseOrder",
      required: true,
      index: true,
    },
    quantityReceived: { type: Number, required: true, min: 1 },
    quantityAccepted: { type: Number, required: true, min: 0 },
    quantityRejected: { type: Number, required: true, min: 0 },
    inspectionNotes: { type: String, trim: true, maxlength: 1000 },
    status: {
      type: String,
      enum: ["received", "accepted", "partially_rejected", "rejected", "returned"],
      required: true,
      index: true,
    },
    receivedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    inspectedBy: { type: Schema.Types.ObjectId, ref: "User" },
    rejectedQuantityReturned: { type: Boolean, default: false },
    returnReason: { type: String, trim: true, maxlength: 1000 },
    returnedBy: { type: Schema.Types.ObjectId, ref: "User" },
    returnedAt: { type: Date },
    receivedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
procurementGoodsReceiptSchema.plugin(auditPlugin);

export interface IProcurementSupplierInvoice extends Document {
  _id: Types.ObjectId;
  invoiceNumber: string;
  vendorId: Types.ObjectId;
  purchaseOrderId: Types.ObjectId;
  grnIds: Types.ObjectId[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  dueDate: Date;
  status: "pending_match" | "matched" | "approved" | "rejected" | "paid";
  matchVariance: number;
  submittedBy: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  rejectionReason?: string;
  approvalJournalEntryId?: Types.ObjectId;
  paymentJournalEntryId?: Types.ObjectId;
  paymentReference?: string;
  paidBy?: Types.ObjectId;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const procurementSupplierInvoiceSchema = new Schema<IProcurementSupplierInvoice>(
  {
    invoiceNumber: { type: String, required: true, trim: true },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "ProcurementVendor",
      required: true,
      index: true,
    },
    purchaseOrderId: {
      type: Schema.Types.ObjectId,
      ref: "ProcurementPurchaseOrder",
      required: true,
      index: true,
    },
    grnIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "ProcurementGoodsReceipt" }],
      required: true,
    },
    subtotal: { type: Number, required: true, min: 0 },
    taxAmount: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    dueDate: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ["pending_match", "matched", "approved", "rejected", "paid"],
      default: "pending_match",
      index: true,
    },
    matchVariance: { type: Number, default: 0 },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    rejectionReason: { type: String, trim: true, maxlength: 1000 },
    approvalJournalEntryId: { type: Schema.Types.ObjectId, ref: "JournalEntry" },
    paymentJournalEntryId: { type: Schema.Types.ObjectId, ref: "JournalEntry" },
    paymentReference: { type: String, trim: true, maxlength: 100 },
    paidBy: { type: Schema.Types.ObjectId, ref: "User" },
    paidAt: Date,
  },
  { timestamps: true },
);
procurementSupplierInvoiceSchema.index({ vendorId: 1, invoiceNumber: 1 }, { unique: true });
procurementSupplierInvoiceSchema.plugin(auditPlugin);

export const ProcurementVendorModel = mongoose.model<IProcurementVendor>(
  "ProcurementVendor",
  procurementVendorSchema,
);
export const ProcurementRfqModel = mongoose.model<IProcurementRfq>(
  "ProcurementRfq",
  procurementRfqSchema,
);
export const ProcurementPurchaseOrderModel = mongoose.model<IProcurementPurchaseOrder>(
  "ProcurementPurchaseOrder",
  procurementPurchaseOrderSchema,
);
export const ProcurementGoodsReceiptModel = mongoose.model<IProcurementGoodsReceipt>(
  "ProcurementGoodsReceipt",
  procurementGoodsReceiptSchema,
);
export const ProcurementSupplierInvoiceModel = mongoose.model<IProcurementSupplierInvoice>(
  "ProcurementSupplierInvoice",
  procurementSupplierInvoiceSchema,
);
