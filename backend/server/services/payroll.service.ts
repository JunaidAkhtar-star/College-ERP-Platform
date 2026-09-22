import { payrollRepository, userRepository } from "../repositories";
import { PayslipModel, type IPayslip } from "../models/payroll.model";
import { emailService } from "../email/email.service";
import createError from "http-errors";
import { PayrollPolicyModel, type IPayrollPolicy } from "../models/payroll-policy.model";
import mongoose from "mongoose";
import { generalLedgerService } from "./general-ledger.service";
import { FacultyProfileModel, FacultyStatus } from "../models/faculty-profile.model";
import { LeaveRequestModel } from "../models/leave.model";
import { formatIndiaDate } from "../utils/date.util";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type TPayrollCalculationPolicy = Pick<
  IPayrollPolicy,
  | "daPercent"
  | "hraPercent"
  | "transportAllowance"
  | "employeePfPercent"
  | "pfWageCeiling"
  | "professionalTax"
  | "standardDeduction"
  | "taxSlabs"
>;

const DEFAULT_POLICY: TPayrollCalculationPolicy & { name: string } = {
  name: "Default payroll policy",
  daPercent: 53,
  hraPercent: 24,
  transportAllowance: 1600,
  employeePfPercent: 12,
  pfWageCeiling: undefined,
  professionalTax: 200,
  standardDeduction: 0,
  taxSlabs: [],
};

function progressiveTax(annualTaxableIncome: number, policy: Pick<IPayrollPolicy, "taxSlabs">) {
  return Math.round(
    [...policy.taxSlabs]
      .sort((a, b) => a.from - b.from)
      .reduce((tax, slab) => {
        if (annualTaxableIncome <= slab.from) return tax;
        const upper = slab.to ?? annualTaxableIncome;
        const taxable = Math.max(0, Math.min(annualTaxableIncome, upper) - slab.from);
        return tax + taxable * (slab.ratePercent / 100);
      }, 0),
  );
}

async function activePolicy(payDate: Date) {
  return (
    (await PayrollPolicyModel.findOne({
      isActive: true,
      effectiveFrom: { $lte: payDate },
      $or: [{ effectiveTo: { $exists: false } }, { effectiveTo: { $gte: payDate } }],
    })
      .sort({ effectiveFrom: -1 })
      .lean()) ?? DEFAULT_POLICY
  );
}

export async function calculatePayrollAmounts(
  basicPay: number,
  payableDays: number,
  month: number,
  year: number,
) {
  const policy = await activePolicy(new Date(year, month - 1, 1));
  return calculatePayrollFromPolicy(basicPay, payableDays, month, year, policy);
}

export function calculatePayrollFromPolicy(
  basicPay: number,
  payableDays: number,
  month: number,
  year: number,
  policy: TPayrollCalculationPolicy,
) {
  if (basicPay <= 0) throw createError(400, "Basic pay must be greater than zero");
  const calendarDays = new Date(year, month, 0).getDate();
  if (payableDays < 0 || payableDays > calendarDays) {
    throw createError(400, `Payable days must be between 0 and ${calendarDays}`);
  }
  const ratio = payableDays / calendarDays;
  const earnedBasic = Math.round(basicPay * ratio);
  const da = Math.round(earnedBasic * (policy.daPercent / 100));
  const hra = Math.round(earnedBasic * (policy.hraPercent / 100));
  const ta = Math.round(policy.transportAllowance * ratio);
  const grossPay = earnedBasic + da + hra + ta;
  const pfBase = policy.pfWageCeiling ? Math.min(earnedBasic, policy.pfWageCeiling) : earnedBasic;
  const pf = Math.round(pfBase * (policy.employeePfPercent / 100));
  const pt = payableDays > 0 ? policy.professionalTax : 0;
  const annualTaxableIncome = Math.max(0, grossPay * 12 - policy.standardDeduction);
  const annualTax = progressiveTax(annualTaxableIncome, policy);
  const tds = Math.round(annualTax / 12);
  const totalDeductions = pf + pt + tds;
  const netPay = grossPay - totalDeductions;
  const components = [
    { component: "Basic Pay", type: "earning", amount: earnedBasic, isPercentage: false },
    {
      component: "Dearness Allowance (DA)",
      type: "earning",
      amount: da,
      isPercentage: true,
      percentageBase: "Basic Pay",
      percentageValue: policy.daPercent,
    },
    {
      component: "House Rent Allowance (HRA)",
      type: "earning",
      amount: hra,
      isPercentage: true,
      percentageBase: "Basic Pay",
      percentageValue: policy.hraPercent,
    },
    { component: "Transport Allowance (TA)", type: "earning", amount: ta, isPercentage: false },
    {
      component: "Provident Fund (PF)",
      type: "deduction",
      amount: pf,
      isPercentage: true,
      percentageBase: "Basic Pay",
      percentageValue: policy.employeePfPercent,
    },
    { component: "Professional Tax (PT)", type: "deduction", amount: pt, isPercentage: false },
    { component: "TDS (Income Tax)", type: "deduction", amount: tds, isPercentage: false },
  ];
  return { components, earnedBasic, da, hra, ta, grossPay, pf, pt, tds, totalDeductions, netPay };
}

export const payrollService = {
  getPayslips: (filter: Record<string, unknown>, page: number, limit: number) =>
    payrollRepository.list(filter, page, limit),

  getPayslipById: (id: string) => payrollRepository.findById(id),

  getPayslipByEmployeeMonthYear: (employeeId: string, month: number, year: number) =>
    payrollRepository.findByEmployeeMonthYear(employeeId, month, year),

  generatePayslip: async (
    employeeId: string,
    employeeName: string,
    designation: string,
    departmentId: string,
    month: number,
    year: number,
    basicPay: number,
    presentDays: number,
    absentDays: number,
    lopDays: number,
    payableDays: number,
    generatedBy: string,
  ) => {
    const { components, grossPay, pf, pt, tds, totalDeductions, netPay } =
      await calculatePayrollAmounts(basicPay, payableDays, month, year);

    return payrollRepository.create({
      employeeId,
      employeeName,
      designation,
      departmentId,
      month,
      year,
      presentDays,
      absentDays,
      lopDays,
      payableDays,
      components,
      grossPay,
      totalDeductions,
      netPay,
      pfAmount: pf,
      ptAmount: pt,
      tdsAmount: tds,
      isGenerated: true,
      generatedBy,
    });
  },

  generateMonthlyPayroll: async (month: number, year: number, generatedBy: string) => {
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw createError(400, "Month must be between 1 and 12");
    }
    if (!Number.isInteger(year) || year < 2000 || year > 2200) {
      throw createError(400, "Year is invalid");
    }
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0, 23, 59, 59, 999);
    const calendarDays = periodEnd.getDate();
    const faculty = await FacultyProfileModel.find({
      status: FacultyStatus.ACTIVE,
      "salaryDetails.basicPay": { $gt: 0 },
    })
      .select("userId firstName middleName lastName designation department salaryDetails.basicPay")
      .lean();

    const userIds = faculty.map((profile) => profile.userId);
    const [existing, lopLeaves] = await Promise.all([
      payrollRepository.list(
        { employeeId: { $in: userIds }, month, year },
        1,
        Math.max(userIds.length, 1),
      ),
      LeaveRequestModel.find({
        employeeId: { $in: userIds },
        leaveType: "loss_of_pay",
        status: "approved",
        fromDate: { $lte: periodEnd },
        toDate: { $gte: periodStart },
      })
        .select("employeeId fromDate toDate")
        .lean(),
    ]);
    const existingIds = new Set(existing.data.map((item) => item.employeeId.toString()));
    const lopByEmployee = new Map<string, number>();
    for (const leave of lopLeaves) {
      const start = new Date(Math.max(new Date(leave.fromDate).getTime(), periodStart.getTime()));
      const end = new Date(Math.min(new Date(leave.toDate).getTime(), periodEnd.getTime()));
      const days = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
      const key = leave.employeeId.toString();
      lopByEmployee.set(key, (lopByEmployee.get(key) ?? 0) + Math.max(days, 0));
    }

    const generated = [];
    let skippedExisting = 0;
    let skippedMissingAccount = 0;
    for (const profile of faculty) {
      if (!profile.userId) {
        skippedMissingAccount++;
        continue;
      }
      const employeeId = profile.userId.toString();
      if (existingIds.has(employeeId)) {
        skippedExisting++;
        continue;
      }
      const lopDays = Math.min(lopByEmployee.get(employeeId) ?? 0, calendarDays);
      const payableDays = calendarDays - lopDays;
      const name = [profile.firstName, profile.middleName, profile.lastName]
        .filter(Boolean)
        .join(" ");
      generated.push(
        await payrollService.generatePayslip(
          employeeId,
          name,
          String(profile.designation),
          profile.department.toString(),
          month,
          year,
          Number(profile.salaryDetails?.basicPay),
          payableDays,
          0,
          lopDays,
          payableDays,
          generatedBy,
        ),
      );
    }
    return {
      generated: generated.length,
      skippedExisting,
      skippedMissingAccount,
      payslips: generated,
    };
  },

  reviewPayslip: async (id: string, reviewedBy: string) => {
    const payslip = await PayslipModel.findOne({ _id: id, status: { $in: ["draft", null] } });
    if (!payslip) throw createError(409, "Only a draft payroll can be reviewed");
    if (payslip.generatedBy.toString() === reviewedBy)
      throw createError(409, "Payroll generator cannot review the same payslip");
    payslip.status = "reviewed";
    payslip.reviewedBy = new mongoose.Types.ObjectId(reviewedBy);
    payslip.reviewedAt = new Date();
    return payslip.save();
  },

  approvePayslip: async (id: string, approvedBy: string) => {
    const payslip = await PayslipModel.findOne({ _id: id, status: "reviewed" });
    if (!payslip) throw createError(409, "Payroll requires HR review before approval");
    if (payslip.reviewedBy?.toString() === approvedBy)
      throw createError(409, "Payroll reviewer cannot approve the same payslip");
    payslip.status = "approved";
    payslip.approvedBy = new mongoose.Types.ObjectId(approvedBy);
    payslip.approvedAt = new Date();
    return payslip.save();
  },

  markPaid: async (id: string, paymentDate: Date, paymentMode: string, postedBy: string) => {
    if (Number.isNaN(paymentDate.getTime())) throw createError(400, "Payment date is invalid");
    const payslip = await payrollRepository.findById(id);
    if (!payslip) throw createError(404, "Payslip not found");
    if (payslip.isPaid) throw createError(409, "Payslip is already paid");
    if (payslip.status !== "approved")
      throw createError(409, "Payroll must be reviewed and approved before payment");
    const financialYear =
      payslip.month >= 4
        ? `${payslip.year}-${String(payslip.year + 1).slice(-2)}`
        : `${payslip.year - 1}-${String(payslip.year).slice(-2)}`;

    const session = await mongoose.startSession();
    let paid = null;
    try {
      await session.withTransaction(async () => {
        paid = await payrollRepository.markPaid(id, paymentDate, paymentMode, session);
        if (!paid) throw createError(409, "Payslip was paid by another request");
        await generalLedgerService.postPayrollPayment(
          {
            payslipId: payslip._id,
            employeeId: payslip.employeeId,
            employeeName: payslip.employeeName,
            netPay: payslip.netPay,
            paymentMode,
            paymentDate,
            financialYear,
            postedBy,
          },
          session,
        );
      });
    } finally {
      await session.endSession();
    }
    return paid;
  },

  sendPayslipEmail: async (id: string) => {
    const payslip = await payrollRepository.findById(id);
    if (!payslip) throw new Error("Payslip not found");
    const employee = await userRepository.findById(payslip.employeeId as unknown as string);
    if (!employee?.email) throw new Error("Employee email not found");
    await emailService.sendPayslip(employee.email, {
      employeeName: payslip.employeeName,
      designation: (payslip as unknown as { designation?: string }).designation ?? "",
      monthName: MONTH_NAMES[(payslip.month as number) - 1] ?? "",
      year: payslip.year,
      payableDays: (payslip as unknown as { payableDays?: number }).payableDays ?? 0,
      grossPay: (payslip.grossPay as number)?.toLocaleString("en-IN") ?? 0,
      totalDeductions: (
        (payslip as unknown as { totalDeductions?: number }).totalDeductions ?? 0
      ).toLocaleString("en-IN"),
      netPay: (payslip.netPay as number)?.toLocaleString("en-IN") ?? 0,
      isPaid: (payslip as unknown as { isPaid?: boolean }).isPaid ?? false,
      paymentDate: (payslip as unknown as { paymentDate?: Date }).paymentDate
        ? formatIndiaDate((payslip as unknown as { paymentDate: Date }).paymentDate)
        : "",
      components: payslip.components ?? [],
    });
    return { sent: true, to: employee.email };
  },

  getMonthlySummary: (month: number, year: number) => payrollRepository.getSummary(month, year),
  getPolicy: () => PayrollPolicyModel.find({ isActive: true }).sort({ effectiveFrom: -1 }).lean(),
  createPolicy: async (data: Record<string, unknown>, updatedBy: string) => {
    const effectiveFrom = new Date(String(data["effectiveFrom"]));
    if (Number.isNaN(effectiveFrom.getTime())) throw createError(400, "effectiveFrom is invalid");
    const slabs = data["taxSlabs"];
    if (!Array.isArray(slabs)) throw createError(400, "taxSlabs must be an array");
    const normalizedSlabs = slabs
      .map((raw) => {
        const slab = raw as { from?: unknown; to?: unknown; ratePercent?: unknown };
        return {
          from: Number(slab.from),
          to:
            slab.to === undefined || slab.to === null || slab.to === ""
              ? undefined
              : Number(slab.to),
          ratePercent: Number(slab.ratePercent),
        };
      })
      .sort((a, b) => a.from - b.from);
    if (
      normalizedSlabs.length === 0 ||
      normalizedSlabs[0].from !== 0 ||
      normalizedSlabs.some(
        (slab, index) =>
          !Number.isFinite(slab.from) ||
          !Number.isFinite(slab.ratePercent) ||
          slab.ratePercent < 0 ||
          slab.ratePercent > 100 ||
          (slab.to !== undefined && (!Number.isFinite(slab.to) || slab.to <= slab.from)) ||
          (index < normalizedSlabs.length - 1 && slab.to !== normalizedSlabs[index + 1].from) ||
          (index === normalizedSlabs.length - 1 && slab.to !== undefined),
      )
    ) {
      throw createError(
        400,
        "Tax slabs must be continuous from zero and the final slab must have no upper limit",
      );
    }
    const paidAfterEffectiveDate = await PayslipModel.exists({
      status: "paid",
      $expr: {
        $gte: [{ $dateFromParts: { year: "$year", month: "$month", day: 1 } }, effectiveFrom],
      },
    });
    if (paidAfterEffectiveDate)
      throw createError(409, "A payroll policy cannot be backdated into a paid payroll period");
    return PayrollPolicyModel.create({
      ...data,
      taxSlabs: normalizedSlabs,
      effectiveFrom,
      updatedBy,
    });
  },
  generateForm16: async (employeeId: string, financialYear: string) => {
    // Financial year e.g. "2024-25" => April 2024 – March 2025
    const [startYr] = financialYear.split("-").map(Number);
    const startDate = new Date(startYr, 3, 1); // April 1
    const endDate = new Date(startYr + 1, 2, 31); // March 31
    const filter: Record<string, unknown> = {
      employeeId,
      status: "paid",
      $expr: {
        $and: [
          { $gte: [{ $dateFromParts: { year: "$year", month: "$month", day: 1 } }, startDate] },
          { $lte: [{ $dateFromParts: { year: "$year", month: "$month", day: 1 } }, endDate] },
        ],
      },
    };
    const { data: payslips } = await payrollRepository.list(filter, 1, 12);
    const totals = (payslips as unknown as IPayslip[]).reduce(
      (acc: Record<string, number>, p: IPayslip) => {
        for (const c of p.components ?? []) {
          if (c.type === "earning") acc.grossEarnings = (acc.grossEarnings ?? 0) + c.amount;
          if (c.type === "deduction") acc.totalDeductions = (acc.totalDeductions ?? 0) + c.amount;
        }
        acc.taxWithheld = (acc.taxWithheld ?? 0) + Number(p.tdsAmount || 0);
        return acc;
      },
      { grossEarnings: 0, totalDeductions: 0, taxWithheld: 0 },
    );
    totals.netIncome = totals.grossEarnings - totals.totalDeductions;
    // Tax is calculated by the effective payroll policy during each payroll run.
    // Annual reporting sums the actually withheld TDS instead of applying a second,
    // potentially inconsistent hard-coded slab calculation.
    totals.estimatedTax = totals.taxWithheld;
    return {
      employeeId,
      financialYear,
      ...totals,
      payslipCount: (payslips as unknown as IPayslip[]).length,
      payslips,
    };
  },
};
