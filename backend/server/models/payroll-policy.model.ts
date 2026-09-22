import mongoose, { Schema, type Document, type Types } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";

export interface ITaxSlab {
  from: number;
  to?: number;
  ratePercent: number;
}

export interface IPayrollPolicy extends Document {
  _id: Types.ObjectId;
  name: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
  daPercent: number;
  hraPercent: number;
  transportAllowance: number;
  employeePfPercent: number;
  pfWageCeiling?: number;
  professionalTax: number;
  standardDeduction: number;
  taxSlabs: ITaxSlab[];
  isActive: boolean;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TaxSlabSchema = new Schema<ITaxSlab>(
  {
    from: { type: Number, required: true, min: 0 },
    to: { type: Number, min: 0 },
    ratePercent: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false },
);

const PayrollPolicySchema = new Schema<IPayrollPolicy>(
  {
    name: { type: String, required: true, trim: true },
    effectiveFrom: { type: Date, required: true, index: true },
    effectiveTo: { type: Date },
    daPercent: { type: Number, required: true, min: 0, max: 500 },
    hraPercent: { type: Number, required: true, min: 0, max: 100 },
    transportAllowance: { type: Number, required: true, min: 0 },
    employeePfPercent: { type: Number, required: true, min: 0, max: 100 },
    pfWageCeiling: { type: Number, min: 0 },
    professionalTax: { type: Number, required: true, min: 0 },
    standardDeduction: { type: Number, required: true, min: 0 },
    taxSlabs: { type: [TaxSlabSchema], required: true },
    isActive: { type: Boolean, default: true, index: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

PayrollPolicySchema.index({ isActive: 1, effectiveFrom: -1 });
PayrollPolicySchema.plugin(auditPlugin);

export const PayrollPolicyModel = mongoose.model<IPayrollPolicy>(
  "PayrollPolicy",
  PayrollPolicySchema,
);
