/** @file AccountsDepartmentDashboard.tsx @description Standalone accounts ledger dashboard. */
'use client';

import {
  Banknote,
  Landmark,
  ReceiptIndianRupee,
  Scale,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  type AnyRecord,
  Badge,
  fmt,
  fmtDate,
  fmtRupees,
  type IStatCard,
  PIE_COLORS,
  RowItem,
  Section,
  StatCard,
  useRolePath,
} from '../views/shared';

interface ICashFlow {
  year: number;
  month: number;
  income: number;
  expense: number;
  net: number;
}
interface ICategory {
  category: string;
  transactionType: string;
  total: number;
  count: number;
}
interface ITransaction {
  _id?: string;
  transactionType: string;
  category: string;
  amount: number;
  paymentMode: string;
  description: string;
  date: string;
  referenceNo?: string;
}
interface IBudget {
  approvedAmount: number;
  encumberedAmount: number;
  consumedAmount: number;
}
interface IBudgetHead extends IBudget {
  _id?: string;
  budgetHead: string;
  status: string;
}
interface IBank {
  accountCode: string;
  credits: number;
  debits: number;
  balance: number;
  lines: number;
  matched: number;
}
interface IReconciliation {
  name: string;
  count: number;
  amount: number;
}

const monthLabel = (month: number) =>
  new Date(2020, Math.max(month - 1, 0), 1).toLocaleDateString('en-IN', { month: 'short' });
const transactionTone = (type: string): 'green' | 'red' => (type === 'income' ? 'green' : 'red');

export default function AccountsDepartmentDashboard({ d }: { d: AnyRecord }) {
  const path = useRolePath();
  const cashFlow = (d.monthlyCashFlow as ICashFlow[] | undefined) ?? [];
  const categories = (d.categorySummary as ICategory[] | undefined) ?? [];
  const transactions = (d.recentTransactions as ITransaction[] | undefined) ?? [];
  const budget = (d.budgetSummary as IBudget | undefined) ?? {
    approvedAmount: 0,
    encumberedAmount: 0,
    consumedAmount: 0,
  };
  const budgetHeads = (d.budgetHeads as IBudgetHead[] | undefined) ?? [];
  const banks = (d.bankSummary as IBank[] | undefined) ?? [];
  const reconciliation = (d.reconciliationStatus as IReconciliation[] | undefined) ?? [];
  const budgetUsage = budget.approvedAmount
    ? (budget.consumedAmount / budget.approvedAmount) * 100
    : 0;
  const cards: IStatCard[] = [
    {
      label: 'Total Receipts',
      value: fmtRupees(d.totalIncome),
      icon: <ReceiptIndianRupee className="h-5 w-5" />,
      bg: 'bg-blue-50',
      fg: 'text-blue-600',
      href: path('accounts'),
    },
    {
      label: 'Total Payments',
      value: fmtRupees(d.totalExpense),
      icon: <Banknote className="h-5 w-5" />,
      bg: 'bg-emerald-50',
      fg: 'text-emerald-600',
      href: path('accounts'),
    },
    {
      label: 'Closing Balance',
      value: fmtRupees(d.closingBalance),
      icon: <Landmark className="h-5 w-5" />,
      bg: 'bg-violet-50',
      fg: 'text-violet-600',
      href: path('accounts'),
    },
    {
      label: 'Outstanding Receivables',
      value: fmtRupees(d.totalPending),
      icon: <TrendingUp className="h-5 w-5" />,
      bg: 'bg-orange-50',
      fg: 'text-orange-600',
      href: path('fees'),
    },
    {
      label: 'Overdue Fee Records',
      value: fmt(d.overdueCount),
      icon: <TrendingDown className="h-5 w-5" />,
      bg: 'bg-rose-50',
      fg: 'text-rose-600',
      href: path('fees'),
    },
    {
      label: "This Month's Receipts",
      value: fmtRupees(d.thisMonthCollection),
      icon: <Scale className="h-5 w-5" />,
      bg: 'bg-sky-50',
      fg: 'text-sky-600',
      href: path('accounts'),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {cards.map((card, index) => (
          <StatCard key={card.label} {...card} index={index} />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Section
          title="Cash Flow Overview"
          sub={String(d.financialYear ?? '')}
          className="xl:col-span-1"
          href={path('accounts')}
        >
          <div className="h-72">
            {cashFlow.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <AreaChart data={cashFlow} margin={{ left: -10, top: 12 }}>
                  <CartesianGrid stroke="#eef2f7" vertical={false} />
                  <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 10 }} />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickFormatter={(value: number) => fmtRupees(value)}
                  />
                  <Tooltip
                    labelFormatter={(value) => monthLabel(Number(value))}
                    formatter={(value) => fmtRupees(value)}
                  />
                  <Area
                    type="monotone"
                    dataKey="income"
                    name="Receipts"
                    stroke="#2563eb"
                    fill="#dbeafe"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="expense"
                    name="Payments"
                    stroke="#f97316"
                    fill="#ffedd5"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-xs text-slate-600">
                No posted cash-flow transactions.
              </p>
            )}
          </div>
        </Section>
        <Section title="Income & Expense by Category" href={path('accounts')}>
          <div className="h-72">
            {categories.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={categories}
                    dataKey="total"
                    nameKey="category"
                    innerRadius={58}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {categories.map((row, index) => (
                      <Cell
                        key={`${row.transactionType}-${row.category}`}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => fmtRupees(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-xs text-slate-600">
                No category ledger data.
              </p>
            )}
          </div>
        </Section>
        <Section title="Bank Accounts Summary" href={path('finance-control')}>
          <div className="space-y-2">
            {banks.length ? (
              banks.map((bank) => (
                <RowItem
                  key={bank.accountCode}
                  icon={<Landmark className="h-4 w-4" />}
                  primary={bank.accountCode}
                  secondary={`${bank.matched}/${bank.lines} statement lines reconciled`}
                  end={
                    <strong className={bank.balance >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                      {fmtRupees(bank.balance)}
                    </strong>
                  }
                  href={path('finance-control')}
                />
              ))
            ) : (
              <p className="py-12 text-center text-xs text-slate-600">
                No bank statement lines this month.
              </p>
            )}
          </div>
        </Section>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Section title="Recent Transactions" className="xl:col-span-2" href={path('accounts')}>
          <div className="space-y-2">
            {transactions.length ? (
              transactions.map((row) => (
                <RowItem
                  key={row._id ?? `${row.date}-${row.description}`}
                  icon={
                    row.transactionType === 'income' ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )
                  }
                  primary={row.description}
                  secondary={`${fmtDate(row.date)} · ${row.category} · ${row.paymentMode.replaceAll('_', ' ')}`}
                  end={
                    <Badge
                      label={fmtRupees(row.amount)}
                      color={transactionTone(row.transactionType)}
                    />
                  }
                  href={path('accounts')}
                />
              ))
            ) : (
              <p className="py-12 text-center text-xs text-slate-600">No account transactions.</p>
            )}
          </div>
        </Section>
        <Section title="Bank Reconciliation" href={path('finance-control')}>
          <div className="space-y-3">
            {reconciliation.length ? (
              reconciliation.map((row) => (
                <div
                  key={row.name}
                  className="flex items-center justify-between rounded-xl bg-slate-50 p-3"
                >
                  <div>
                    <p className="text-sm font-semibold capitalize text-slate-700">{row.name}</p>
                    <p className="text-xs text-slate-600">{fmtRupees(row.amount)}</p>
                  </div>
                  <Badge
                    label={fmt(row.count)}
                    color={
                      row.name === 'matched' ? 'green' : row.name === 'exception' ? 'red' : 'amber'
                    }
                  />
                </div>
              ))
            ) : (
              <p className="py-12 text-center text-xs text-slate-600">No reconciliation records.</p>
            )}
          </div>
        </Section>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Section
          title="Budget vs Actual"
          sub={`${budgetUsage.toFixed(1)}% utilized`}
          href={path('finance-control')}
        >
          <div className="grid grid-cols-3 gap-3">
            {[
              ['Approved', budget.approvedAmount],
              ['Consumed', budget.consumedAmount],
              ['Encumbered', budget.encumberedAmount],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-600">{label}</p>
                <p className="mt-2 text-lg font-bold text-slate-900">{fmtRupees(value)}</p>
              </div>
            ))}
          </div>
        </Section>
        <Section title="Budget Heads" href={path('finance-control')}>
          <div className="h-48">
            {budgetHeads.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={budgetHeads} layout="vertical" margin={{ left: 18 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="budgetHead" width={100} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value) => fmtRupees(value)} />
                  <Bar
                    dataKey="consumedAmount"
                    name="Consumed"
                    fill="#6545e8"
                    radius={[0, 6, 6, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-xs text-slate-600">
                No approved budget heads.
              </p>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}
