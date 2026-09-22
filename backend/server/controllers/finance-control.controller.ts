import type { NextFunction, Request, Response } from "express";
import { Module } from "../constants/permissions";
import { auditLogRepository } from "../repositories/audit-log.repository";
import { financeControlService } from "../services/finance-control.service";

async function audit(req: Request, action: string, targetModel: string, targetId: string) {
  await auditLogRepository.create({
    user: req.user,
    action,
    module: Module.ACCOUNTS,
    targetModel,
    targetId,
    description: action.replace(/_/g, " ").toLowerCase(),
    reason: typeof req.body.reason === "string" ? req.body.reason : undefined,
    req,
  });
}

const run =
  (handler: (req: Request) => Promise<unknown>) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await handler(req) });
    } catch (error) {
      next(error);
    }
  };

export const financeControlController = {
  listPeriods: run((req) =>
    financeControlService.listPeriods(req.query.financialYear as string | undefined),
  ),
  createYear: run(async (req) => {
    const data = await financeControlService.createYear(req.body.financialYear);
    await audit(req, "FINANCE_PERIODS_CREATED", "AccountingPeriod", req.body.financialYear);
    return data;
  }),
  closePeriod: run(async (req) => {
    const data = await financeControlService.closePeriod(
      req.params.id,
      req.body.status,
      req.user!._id.toString(),
      req.body.reason,
    );
    await audit(req, "FINANCE_PERIOD_STATUS_CHANGED", "AccountingPeriod", req.params.id);
    return data;
  }),
  listBudgets: run((req) =>
    financeControlService.listBudgets(req.query.financialYear as string | undefined),
  ),
  createBudget: run(async (req) => {
    const data = await financeControlService.createBudget(req.body, req.user!._id.toString());
    await audit(req, "FINANCE_BUDGET_CREATED", "FinanceBudget", data._id.toString());
    return data;
  }),
  submitBudget: run(async (req) => {
    const data = await financeControlService.submitBudget(req.params.id, req.user!._id.toString());
    await audit(req, "FINANCE_BUDGET_SUBMITTED", "FinanceBudget", req.params.id);
    return data;
  }),
  approveBudget: run(async (req) => {
    const data = await financeControlService.approveBudget(req.params.id, req.user!._id.toString());
    await audit(req, "FINANCE_BUDGET_APPROVED", "FinanceBudget", req.params.id);
    return data;
  }),
  listBankLines: run((req) =>
    financeControlService.listBankLines(
      req.query.status as "unmatched" | "matched" | "exception" | undefined,
    ),
  ),
  importBankLines: run(async (req) => {
    const data = await financeControlService.importBankLines(
      req.body.lines,
      req.user!._id.toString(),
    );
    await audit(req, "FINANCE_BANK_STATEMENT_IMPORTED", "BankStatementLine", "batch");
    return data;
  }),
  matchBankLine: run(async (req) => {
    const data = await financeControlService.matchBankLine(
      req.params.id,
      req.body.journalEntryId,
      req.user!._id.toString(),
      req.body.note,
    );
    await audit(req, "FINANCE_BANK_LINE_MATCHED", "BankStatementLine", req.params.id);
    return data;
  }),
  receivableAging: run((req) =>
    financeControlService.receivableAging(
      req.query.asOf ? new Date(String(req.query.asOf)) : new Date(),
    ),
  ),
  listTaxConfigs: run(() => financeControlService.listTaxConfigs()),
  createTaxConfig: run(async (req) => {
    const data = await financeControlService.createTaxConfig(req.body, req.user!._id.toString());
    await audit(req, "FINANCE_TAX_CONFIG_CREATED", "FinanceTaxConfig", data._id.toString());
    return data;
  }),
  submitTaxConfig: run(async (req) => {
    const data = await financeControlService.submitTaxConfig(
      req.params.id,
      req.user!._id.toString(),
    );
    await audit(req, "FINANCE_TAX_CONFIG_SUBMITTED", "FinanceTaxConfig", req.params.id);
    return data;
  }),
  approveTaxConfig: run(async (req) => {
    const data = await financeControlService.approveTaxConfig(
      req.params.id,
      req.user!._id.toString(),
    );
    await audit(req, "FINANCE_TAX_CONFIG_APPROVED", "FinanceTaxConfig", req.params.id);
    return data;
  }),
};
