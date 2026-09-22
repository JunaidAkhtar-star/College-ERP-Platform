'use client';

import React, { FormEvent, useState } from 'react';
import { toast } from 'react-toastify';
import { CalendarClock, Landmark, Plus, RefreshCw, Scale } from 'lucide-react';
import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { Column } from '@/shared/core/CustomTable';
import WorkflowActionDialog from '@/shared/core/WorkflowActionDialog';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import type {
  IAccountingPeriod,
  IBankStatementLine,
  IFinanceBudget,
  IJournalEntry,
} from '../types/accounts.types';

type View = 'periods' | 'budgets' | 'reconciliation' | 'journals' | 'tax' | 'aging';
type TaxConfig = {
  _id: string;
  code: string;
  name: string;
  taxType: 'gst' | 'tds';
  rate: number;
  effectiveFrom: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'retired';
  [key: string]: unknown;
};
type Aging = { bucket: string; amount: number; invoices: number; [key: string]: unknown };
interface IBankImportRow {
  bankAccountCode: string;
  statementReference: string;
  transactionDate: string;
  valueDate: string;
  amount: number;
  direction: 'credit' | 'debit';
  description: string;
}
const money = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);
const data = <T,>(raw: unknown): T[] => (raw as { data?: T[] } | undefined)?.data ?? [];
const resultData = <T,>(raw: unknown): T[] =>
  (raw as { data?: T[]; success?: boolean } | undefined)?.data ?? [];
const field =
  'w-full rounded-xl bg-slate-50 px-3 py-2.5 text-sm outline-none ring-1 ring-slate-200 focus:bg-white focus:ring-2 focus:ring-primary/30';

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && quoted && line[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) {
      values.push(value.trim());
      value = '';
    } else value += character;
  }
  values.push(value.trim());
  return values;
}

function parseBankCsv(text: string): IBankImportRow[] {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (lines.length < 2) throw new Error('The CSV file has no transaction rows');
  const headers = parseCsvLine(lines[0]);
  const required = [
    'bankAccountCode',
    'statementReference',
    'transactionDate',
    'valueDate',
    'amount',
    'direction',
    'description',
  ];
  const positions = new Map(headers.map((header, index) => [header.trim(), index]));
  const missing = required.filter((header) => !positions.has(header));
  if (missing.length) throw new Error(`Missing columns: ${missing.join(', ')}`);
  return lines.slice(1).map((line, rowIndex) => {
    const values = parseCsvLine(line);
    const get = (key: string) => values[positions.get(key) ?? -1]?.trim() ?? '';
    const amount = Number(get('amount'));
    const direction = get('direction').toLowerCase();
    if (!Number.isFinite(amount) || amount <= 0 || !['credit', 'debit'].includes(direction))
      throw new Error(`Row ${rowIndex + 2} has an invalid amount or direction`);
    return {
      bankAccountCode: get('bankAccountCode'),
      statementReference: get('statementReference'),
      transactionDate: get('transactionDate'),
      valueDate: get('valueDate'),
      amount,
      direction: direction as 'credit' | 'debit',
      description: get('description'),
    };
  });
}

function Badge({ value }: { value: string }) {
  const tone =
    value === 'open' || value === 'approved' || value === 'matched' || value === 'posted'
      ? 'bg-emerald-50 text-emerald-700'
      : value === 'closed' || value === 'exception' || value === 'reversed'
        ? 'bg-rose-50 text-rose-700'
        : 'bg-amber-50 text-amber-700';
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {value.replaceAll('_', ' ')}
    </span>
  );
}

export default function FinanceControlsTab({
  financialYear,
  canPrepare,
  canApprove,
}: {
  financialYear: string;
  canPrepare: boolean;
  canApprove: boolean;
}) {
  const [view, setView] = useState<View>('periods');
  const [showBudget, setShowBudget] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showTax, setShowTax] = useState(false);
  const [matchingLine, setMatchingLine] = useState<IBankStatementLine | null>(null);
  const [selectedJournalId, setSelectedJournalId] = useState('');
  const [matchNote, setMatchNote] = useState('');
  const [periodControl, setPeriodControl] = useState<IAccountingPeriod | null>(null);
  const [bankImport, setBankImport] = useState<{ name: string; rows: IBankImportRow[] } | null>(
    null,
  );
  const [bankImportError, setBankImportError] = useState('');
  const { mutation, isLoading: acting } = useMutation();
  const periodQuery = useSwr(`accounts/periods?financialYear=${financialYear}`);
  const budgetQuery = useSwr(`accounts/budgets?financialYear=${financialYear}`);
  const bankQuery = useSwr('accounts/bank-lines');
  const journalQuery = useSwr(`accounts/journals?financialYear=${financialYear}&limit=500`);
  const taxQuery = useSwr('accounts/tax-configs');
  const agingQuery = useSwr('accounts/receivable-aging');
  const periods = data<IAccountingPeriod>(periodQuery.data);
  const budgets = data<IFinanceBudget>(budgetQuery.data);
  const bankLines = data<IBankStatementLine>(bankQuery.data);
  const journals = resultData<IJournalEntry>(journalQuery.data);
  const taxConfigs = data<TaxConfig>(taxQuery.data);
  const aging = data<Aging>(agingQuery.data);

  const refresh = async () => {
    await Promise.all([
      periodQuery.mutate(),
      budgetQuery.mutate(),
      bankQuery.mutate(),
      journalQuery.mutate(),
      taxQuery.mutate(),
      agingQuery.mutate(),
    ]);
  };
  const perform = async (
    path: string,
    method: 'POST' | 'PATCH',
    body: unknown,
    message: string,
  ) => {
    const response = await mutation(path, { method, body });
    if (!response) return;
    toast.success(message);
    setShowBudget(false);
    setShowImport(false);
    setShowTax(false);
    await refresh();
  };
  const submit =
    (handler: (form: FormData) => Promise<void>) => async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      await handler(new FormData(event.currentTarget));
    };
  const changePeriod = (row: IAccountingPeriod) => {
    setPeriodControl(row);
  };
  const matchLine = (row: IBankStatementLine) => {
    setMatchingLine(row);
    setSelectedJournalId('');
    setMatchNote('');
  };

  const periodColumns: Column<IAccountingPeriod>[] = [
    { field: 'period', title: 'Period', render: (r) => `P${String(r.period).padStart(2, '0')}` },
    {
      field: 'startsAt',
      title: 'Range',
      render: (r) =>
        `${new Date(r.startsAt).toLocaleDateString('en-IN')} – ${new Date(r.endsAt).toLocaleDateString('en-IN')}`,
    },
    { field: 'status', title: 'Posting status', render: (r) => <Badge value={r.status} /> },
    {
      field: '_id',
      title: 'Control',
      render: (r) =>
        canApprove ? (
          <CustomButton
            variant="tertiary"
            className="px-2! py-1! text-xs!"
            onClick={() => changePeriod(r)}
          >
            Change status
          </CustomButton>
        ) : null,
    },
  ];
  const budgetColumns: Column<IFinanceBudget>[] = [
    {
      field: 'budgetHead',
      title: 'Budget head',
      render: (r) => (
        <div>
          <p className="font-semibold">{r.budgetHead}</p>
          <p className="text-xs text-slate-500">{r.departmentId?.name ?? 'Institution-wide'}</p>
        </div>
      ),
    },
    { field: 'approvedAmount', title: 'Approved', render: (r) => money(r.approvedAmount) },
    {
      field: 'encumberedAmount',
      title: 'Committed / spent',
      render: (r) => `${money(r.encumberedAmount)} / ${money(r.consumedAmount)}`,
    },
    {
      field: '_id',
      title: 'Available',
      render: (r) => money(r.approvedAmount - r.encumberedAmount - r.consumedAmount),
    },
    { field: 'status', title: 'Status', render: (r) => <Badge value={r.status} /> },
    {
      field: '_id',
      title: 'Action',
      render: (r) => (
        <div className="flex gap-2">
          {canPrepare && r.status === 'draft' && (
            <CustomButton
              variant="tertiary"
              className="px-2! py-1! text-xs!"
              onClick={() =>
                void perform(
                  `accounts/budgets/${r._id}/submit`,
                  'POST',
                  {},
                  'Budget submitted for independent approval',
                )
              }
            >
              Submit
            </CustomButton>
          )}
          {canApprove && r.status === 'pending_approval' && (
            <CustomButton
              variant="primary"
              className="px-2! py-1! text-xs!"
              onClick={() =>
                void perform(`accounts/budgets/${r._id}/approve`, 'POST', {}, 'Budget approved')
              }
            >
              Approve
            </CustomButton>
          )}
        </div>
      ),
    },
  ];
  const bankColumns: Column<IBankStatementLine>[] = [
    {
      field: 'statementReference',
      title: 'Statement entry',
      render: (r) => (
        <div>
          <p className="font-mono text-xs font-bold">{r.statementReference}</p>
          <p className="text-xs text-slate-500">{r.description}</p>
        </div>
      ),
    },
    {
      field: 'transactionDate',
      title: 'Date',
      render: (r) => new Date(r.transactionDate).toLocaleDateString('en-IN'),
    },
    {
      field: 'amount',
      title: 'Amount',
      render: (r) => `${r.direction === 'credit' ? '+' : '−'} ${money(r.amount)}`,
    },
    { field: 'status', title: 'Status', render: (r) => <Badge value={r.status} /> },
    {
      field: '_id',
      title: 'Action',
      render: (r) =>
        canPrepare && r.status === 'unmatched' ? (
          <CustomButton
            variant="primary"
            className="px-2! py-1! text-xs!"
            onClick={() => matchLine(r)}
          >
            Match
          </CustomButton>
        ) : (
          (r.journalEntryId?.voucherNumber ?? null)
        ),
    },
  ];
  const journalColumns: Column<IJournalEntry>[] = [
    {
      field: 'voucherNumber',
      title: 'Voucher',
      render: (r) => <span className="font-mono text-xs font-bold">{r.voucherNumber}</span>,
    },
    { field: 'date', title: 'Date', render: (r) => new Date(r.date).toLocaleDateString('en-IN') },
    { field: 'description', title: 'Narration' },
    { field: 'sourceType', title: 'Source' },
    { field: 'totalDebit', title: 'Value', render: (r) => money(r.totalDebit) },
    { field: 'status', title: 'Status', render: (r) => <Badge value={r.status} /> },
  ];
  const taxColumns: Column<TaxConfig>[] = [
    {
      field: 'code',
      title: 'Code',
      render: (r) => <span className="font-mono text-xs font-bold">{r.code}</span>,
    },
    { field: 'name', title: 'Configuration' },
    { field: 'taxType', title: 'Type', render: (r) => r.taxType.toUpperCase() },
    { field: 'rate', title: 'Rate', render: (r) => `${r.rate}%` },
    {
      field: 'effectiveFrom',
      title: 'Effective',
      render: (r) => new Date(r.effectiveFrom).toLocaleDateString('en-IN'),
    },
    { field: 'status', title: 'Status', render: (r) => <Badge value={r.status} /> },
    {
      field: '_id',
      title: 'Action',
      render: (r) => (
        <div className="flex gap-2">
          {canPrepare && r.status === 'draft' && (
            <CustomButton
              variant="tertiary"
              className="px-2! py-1! text-xs!"
              onClick={() =>
                void perform(
                  `accounts/tax-configs/${r._id}/submit`,
                  'POST',
                  {},
                  'Tax configuration submitted',
                )
              }
            >
              Submit
            </CustomButton>
          )}
          {canApprove && r.status === 'pending_approval' && (
            <CustomButton
              variant="primary"
              className="px-2! py-1! text-xs!"
              onClick={() =>
                void perform(
                  `accounts/tax-configs/${r._id}/approve`,
                  'POST',
                  {},
                  'Tax configuration approved',
                )
              }
            >
              Approve
            </CustomButton>
          )}
        </div>
      ),
    },
  ];
  const agingColumns: Column<Aging>[] = [
    {
      field: 'bucket',
      title: 'Age bucket',
      render: (r) => (
        <span className="font-semibold">
          {r.bucket === 'current' ? 'Current' : `${r.bucket} days`}
        </span>
      ),
    },
    { field: 'invoices', title: 'Open invoices' },
    { field: 'amount', title: 'Receivable', render: (r) => money(r.amount) },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 overflow-x-auto">
          {(
            [
              ['periods', 'Period close'],
              ['budgets', 'Budgets'],
              ['reconciliation', 'Bank reconciliation'],
              ['journals', 'Journals'],
              ['tax', 'GST / TDS'],
              ['aging', 'Receivable aging'],
            ] as [View, string][]
          ).map(([id, title]) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-semibold ${view === id ? 'border-primary bg-primary text-white ' : 'border-slate-200 bg-white text-slate-600 hover:border-primary-200 hover:bg-primary-50 hover:text-primary'}`}
            >
              {title}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <CustomButton
            variant="tertiary"
            onClick={() => void refresh()}
            startIcon={<RefreshCw className="h-4 w-4" />}
          >
            Refresh
          </CustomButton>
          {view === 'periods' && canPrepare && periods.length === 0 && (
            <CustomButton
              onClick={() =>
                void perform(
                  'accounts/periods',
                  'POST',
                  { financialYear },
                  'Accounting year opened',
                )
              }
              startIcon={<CalendarClock className="h-4 w-4" />}
            >
              Open year
            </CustomButton>
          )}
          {view === 'budgets' && canPrepare && (
            <CustomButton
              onClick={() => setShowBudget(true)}
              startIcon={<Plus className="h-4 w-4" />}
            >
              New budget
            </CustomButton>
          )}
          {view === 'reconciliation' && canPrepare && (
            <CustomButton
              onClick={() => setShowImport(true)}
              startIcon={<Landmark className="h-4 w-4" />}
            >
              Import lines
            </CustomButton>
          )}
          {view === 'tax' && canPrepare && (
            <CustomButton onClick={() => setShowTax(true)} startIcon={<Plus className="h-4 w-4" />}>
              New tax version
            </CustomButton>
          )}
        </div>
      </div>
      <section className="rounded-2xl bg-white p-4">
        {view === 'periods' && (
          <CustomTable data={periods} columns={periodColumns} isLoading={periodQuery.isLoading} />
        )}
        {view === 'budgets' && (
          <CustomTable data={budgets} columns={budgetColumns} isLoading={budgetQuery.isLoading} />
        )}
        {view === 'reconciliation' && (
          <CustomTable data={bankLines} columns={bankColumns} isLoading={bankQuery.isLoading} />
        )}
        {view === 'journals' && (
          <CustomTable
            data={journals}
            columns={journalColumns}
            isLoading={journalQuery.isLoading}
          />
        )}
        {view === 'tax' && (
          <CustomTable data={taxConfigs} columns={taxColumns} isLoading={taxQuery.isLoading} />
        )}
        {view === 'aging' && (
          <CustomTable data={aging} columns={agingColumns} isLoading={agingQuery.isLoading} />
        )}
      </section>

      {matchingLine && (
        <section className="rounded-2xl bg-white p-5">
          <h3 className="font-bold">Match bank line to a posted journal</h3>
          <p className="mt-1 text-xs text-slate-500">
            {matchingLine.statementReference} · {money(matchingLine.amount)}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select
              value={selectedJournalId}
              onChange={(event) => setSelectedJournalId(event.target.value)}
              className={field}
            >
              <option value="">Select journal voucher</option>
              {journals
                .filter((journal) => journal.status === 'posted')
                .map((journal) => (
                  <option key={journal._id} value={journal._id}>
                    {journal.voucherNumber} · {journal.description} · {money(journal.totalDebit)}
                  </option>
                ))}
            </select>
            <input
              value={matchNote}
              onChange={(event) => setMatchNote(event.target.value)}
              className={field}
              placeholder="Optional reconciliation note"
            />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <CustomButton variant="tertiary" onClick={() => setMatchingLine(null)}>
              Cancel
            </CustomButton>
            <CustomButton
              loading={acting}
              disabled={!selectedJournalId}
              onClick={() =>
                void perform(
                  `accounts/bank-lines/${matchingLine._id}/match`,
                  'PATCH',
                  { journalEntryId: selectedJournalId, note: matchNote || undefined },
                  'Bank line reconciled',
                ).then(() => setMatchingLine(null))
              }
            >
              Confirm match
            </CustomButton>
          </div>
        </section>
      )}

      {showBudget && (
        <form
          className="rounded-2xl bg-white p-5"
          onSubmit={submit(async (form) => {
            await perform(
              'accounts/budgets',
              'POST',
              {
                financialYear,
                budgetHead: String(form.get('budgetHead') ?? ''),
                approvedAmount: Number(form.get('approvedAmount')),
              },
              'Budget draft created',
            );
          })}
        >
          <div className="mb-4 flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            <h3 className="font-bold">New controlled budget</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              name="budgetHead"
              required
              minLength={2}
              className={field}
              placeholder="Budget head"
            />
            <input
              name="approvedAmount"
              required
              type="number"
              min="0.01"
              step="0.01"
              className={field}
              placeholder="Approved amount"
            />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <CustomButton type="button" variant="tertiary" onClick={() => setShowBudget(false)}>
              Cancel
            </CustomButton>
            <CustomButton type="submit" loading={acting}>
              Create draft
            </CustomButton>
          </div>
        </form>
      )}
      {showImport && (
        <form
          className="rounded-2xl bg-white p-5"
          onSubmit={submit(async () => {
            if (!bankImport?.rows.length) {
              setBankImportError('Choose a valid CSV file first');
              return;
            }
            await perform(
              'accounts/bank-lines/import',
              'POST',
              { lines: bankImport.rows },
              'Bank statement imported idempotently',
            );
            setBankImport(null);
          })}
        >
          <h3 className="font-bold">Import normalized bank statement lines</h3>
          <p className="mt-1 text-xs text-slate-500">
            Upload a CSV with bankAccountCode, statementReference, transactionDate, valueDate,
            amount, direction, and description columns.
          </p>
          <label className="mt-4 flex cursor-pointer items-center justify-between rounded-xl bg-slate-50 p-4 text-sm ring-1 ring-slate-200">
            <span>
              {bankImport
                ? `${bankImport.name} · ${bankImport.rows.length} valid rows`
                : 'Choose bank statement CSV'}
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                void file.text().then((text) => {
                  try {
                    const rows = parseBankCsv(text);
                    setBankImport({ name: file.name, rows });
                    setBankImportError('');
                  } catch (error) {
                    setBankImport(null);
                    setBankImportError(
                      error instanceof Error ? error.message : 'CSV could not be read',
                    );
                  }
                });
              }}
            />
          </label>
          {bankImportError && <p className="mt-2 text-xs text-red-600">{bankImportError}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <CustomButton type="button" variant="tertiary" onClick={() => setShowImport(false)}>
              Cancel
            </CustomButton>
            <CustomButton type="submit" loading={acting} disabled={!bankImport?.rows.length}>
              Validate and import
            </CustomButton>
          </div>
        </form>
      )}
      {showTax && (
        <form
          className="rounded-2xl bg-white p-5"
          onSubmit={submit(async (form) => {
            await perform(
              'accounts/tax-configs',
              'POST',
              {
                code: String(form.get('code') ?? ''),
                name: String(form.get('name') ?? ''),
                taxType: String(form.get('taxType') ?? ''),
                rate: Number(form.get('rate')),
                effectiveFrom: String(form.get('effectiveFrom') ?? ''),
                inputAccountCode: String(form.get('inputAccountCode') ?? '') || undefined,
                outputAccountCode: String(form.get('outputAccountCode') ?? ''),
              },
              'Tax configuration draft created',
            );
          })}
        >
          <h3 className="font-bold">New effective-dated GST/TDS configuration</h3>
          <p className="mt-1 text-xs text-slate-500">
            A different authorized user must approve this version before it becomes effective.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <input name="code" required className={field} placeholder="Code" />
            <input name="name" required className={field} placeholder="Name" />
            <select name="taxType" required className={field}>
              <option value="gst">GST</option>
              <option value="tds">TDS</option>
            </select>
            <input
              name="rate"
              required
              type="number"
              min="0"
              max="100"
              step="0.01"
              className={field}
              placeholder="Rate %"
            />
            <input name="effectiveFrom" required type="date" className={field} />
            <input name="inputAccountCode" className={field} placeholder="Input account (GST)" />
            <input
              name="outputAccountCode"
              required
              className={field}
              placeholder="Output / payable account"
            />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <CustomButton type="button" variant="tertiary" onClick={() => setShowTax(false)}>
              Cancel
            </CustomButton>
            <CustomButton type="submit" loading={acting}>
              Create draft
            </CustomButton>
          </div>
        </form>
      )}
      <WorkflowActionDialog
        open={Boolean(periodControl)}
        title={`Control accounting period ${periodControl?.period ?? ''}`}
        description="Changing a financial period affects posting controls and is recorded for audit."
        confirmLabel="Update period control"
        statusLabel="Period status"
        initialStatus={periodControl?.status ?? ''}
        statusOptions={[
          { value: 'open', label: 'Open — normal posting allowed' },
          { value: 'soft_closed', label: 'Soft closed — restricted posting' },
          { value: 'closed', label: 'Closed — posting blocked' },
        ]}
        loading={acting}
        onClose={() => setPeriodControl(null)}
        onConfirm={async ({ status, reason }) => {
          if (!periodControl || !status) return;
          await perform(
            `accounts/periods/${periodControl._id}/status`,
            'PATCH',
            { status, reason },
            'Accounting-period control updated',
          );
          setPeriodControl(null);
        }}
      />
    </div>
  );
}
