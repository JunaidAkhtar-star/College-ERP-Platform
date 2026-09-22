'use client';

import FinanceWorkflowBar from '@/shared/components/FinanceWorkflowBar';
import AsyncSelect from '@/shared/core/AsyncSelect';
import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { type Action, type Column } from '@/shared/core/CustomTable';
import Empty from '@/shared/core/Empty';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { useAuthStore } from '@/shared/store/authStore';
import { ErrorMessage, Field, FieldArray, Form, Formik } from 'formik';
import {
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  FilePlus2,
  Landmark,
  RefreshCw,
  Send,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import * as Yup from 'yup';
import type {
  IFinancialAidFund,
  IFinancialAidList,
  IFinancialAidPackage,
} from '../types/financial-aid.types';

interface IApiResponse<T> {
  success: boolean;
  data: T;
}
interface IPackageForm {
  studentProfileId: string;
  academicYear: string;
  studentContribution: number;
  indirectCost: number;
  notes: string;
  items: Array<{ fundId: string; amount: number }>;
}
const fieldClass =
  'mt-1 w-full rounded-xl bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20';
const money = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
const packageSchema = Yup.object({
  studentProfileId: Yup.string().required('Select a student'),
  academicYear: Yup.string().trim().required('Academic year is required'),
  studentContribution: Yup.number().min(0).required(),
  indirectCost: Yup.number().min(0).required(),
  notes: Yup.string().max(5000),
  items: Yup.array()
    .of(
      Yup.object({
        fundId: Yup.string().required('Select a fund'),
        amount: Yup.number().moreThan(0, 'Amount must be positive').required(),
      }),
    )
    .min(1)
    .max(20),
});

export default function FinancialAidPage() {
  const activeRole = useAuthStore(
    (state) => state.activeRole?.baseRole ?? state.activeRole?.name ?? state.role ?? '',
  );
  const isStudent = activeRole === 'student';
  const canView = useHasPermission('scholarship', 'view');
  const canCreate = useHasPermission('scholarship', 'create');
  const canApprove = useHasPermission('scholarship', 'approve');
  const canExport = useHasPermission('scholarship', 'export');
  const canDisburse = useHasPermission('accounts', 'approve');
  const [academicYear, setAcademicYear] = useState('');
  const [packageOpen, setPackageOpen] = useState(false);
  const [fundOpen, setFundOpen] = useState(false);
  const [disbursement, setDisbursement] = useState<{
    packageId: string;
    itemId: string;
    fundName: string;
  } | null>(null);
  const path = isStudent
    ? 'financial-aid/packages/mine?limit=100'
    : `financial-aid/packages?limit=100${academicYear ? `&academicYear=${encodeURIComponent(academicYear)}` : ''}`;
  const {
    data: packagesRaw,
    isLoading,
    isValidating,
    error,
    mutate,
  } = useSwr<IApiResponse<IFinancialAidList>>(canView ? path : null);
  const {
    data: fundsRaw,
    error: fundsError,
    mutate: refreshFunds,
  } = useSwr<IApiResponse<IFinancialAidFund[]>>(
    canView && !isStudent
      ? `financial-aid/funds${academicYear ? `?academicYear=${encodeURIComponent(academicYear)}` : ''}`
      : null,
  );
  const { mutation } = useMutation();
  const packages = useMemo(() => packagesRaw?.data?.data ?? [], [packagesRaw?.data?.data]);
  const funds = useMemo(() => fundsRaw?.data ?? [], [fundsRaw?.data]);
  const hasFinancialData = funds.length > 0 || packages.length > 0;
  const analytics = useMemo(() => {
    const totalBudget = funds.reduce((sum, fund) => sum + fund.budgetAmount, 0);
    const reserved = funds.reduce((sum, fund) => sum + fund.reservedAmount, 0);
    const disbursed = funds.reduce((sum, fund) => sum + fund.disbursedAmount, 0);
    const offered = packages.reduce(
      (sum, aidPackage) =>
        sum + aidPackage.items.reduce((itemSum, item) => itemSum + item.offeredAmount, 0),
      0,
    );
    const statusCounts = packages.reduce<Record<string, number>>((counts, aidPackage) => {
      counts[aidPackage.status] = (counts[aidPackage.status] ?? 0) + 1;
      return counts;
    }, {});
    return {
      totalBudget,
      reserved,
      disbursed,
      available: Math.max(0, totalBudget - reserved - disbursed),
      offered,
      statusCounts,
      beneficiaries: packagesRaw?.data?.total ?? packages.length,
    };
  }, [funds, packages, packagesRaw?.data?.total]);
  const act = async (path: string, body?: unknown, message?: string) => {
    const response = await mutation(path, { method: 'POST', body });
    if (!response?.results?.success) return false;
    if (message) toast.success(message);
    await mutate();
    return true;
  };
  const columns: Column<IFinancialAidPackage>[] = [
    {
      field: 'packageNumber',
      title: 'Package',
      render: (row) => (
        <div>
          <p className="font-semibold text-slate-800">{row.packageNumber}</p>
          <p className="text-xs text-slate-600">{row.academicYear}</p>
        </div>
      ),
    },
    {
      field: 'studentProfileId',
      title: 'Student',
      render: (row) =>
        typeof row.studentProfileId === 'string' ? (
          'My package'
        ) : (
          <div>
            <p className="font-medium">
              {row.studentProfileId.firstName} {row.studentProfileId.lastName}
            </p>
            <p className="text-xs text-slate-600">{row.studentProfileId.rollNumber}</p>
          </div>
        ),
    },
    {
      field: 'costOfAttendance',
      title: 'Cost / need',
      render: (row) => (
        <div>
          <p>{money(row.costOfAttendance)}</p>
          <p className="text-xs text-primary">Need {money(row.demonstratedNeed)}</p>
        </div>
      ),
    },
    {
      field: 'items',
      title: 'Aid offered',
      render: (row) => money(row.items.reduce((sum, item) => sum + item.offeredAmount, 0)),
    },
    {
      field: 'status',
      title: 'Status',
      render: (row) => (
        <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold capitalize text-primary">
          {row.status.replaceAll('_', ' ')}
        </span>
      ),
    },
  ];
  const actions: Action<IFinancialAidPackage>[] = isStudent
    ? [
        {
          tooltip: 'Accept all awards',
          icon: <CheckCircle2 className="h-4 w-4" />,
          hidden: (row) => row.status !== 'offered',
          onClick: (row) =>
            void act(
              `financial-aid/packages/${row._id}/respond`,
              { acceptedFundIds: row.items.map((item) => item.fundId) },
              'Financial-aid package accepted',
            ),
        },
        {
          tooltip: 'Decline package',
          icon: <X className="h-4 w-4" />,
          hidden: (row) => row.status !== 'offered',
          onClick: (row) =>
            void act(
              `financial-aid/packages/${row._id}/respond`,
              { declineAll: true },
              'Financial-aid package declined',
            ),
        },
      ]
    : [
        {
          tooltip: 'Release offer',
          icon: <Send className="h-4 w-4" />,
          hidden: (row) => !canApprove || row.status !== 'draft',
          onClick: (row) =>
            void act(
              `financial-aid/packages/${row._id}/offer`,
              undefined,
              'Financial-aid offer released',
            ),
        },
      ];
  return (
    <div className="space-y-5 ">
      <FinanceWorkflowBar />
      {!canView && (
        <Empty
          title="Financial Aid access unavailable"
          subTitle="Your active role does not have permission to view financial-aid records."
        />
      )}
      {canView && (
        <>
          <header className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-primary">
                  Award to reconciliation
                </p>
                <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">
                  Financial Aid
                </h1>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                  Package grants, scholarships, loans and work-study against verified student need.
                </p>
              </div>
              {!isStudent && (
                <div className="flex w-full flex-col gap-3 lg:w-auto lg:items-end">
                  <div className="w-full sm:w-72">
                    <AsyncSelect
                      type="academicYears"
                      label="Reporting session"
                      placeholder="All academic sessions"
                      value={academicYear || null}
                      onChange={(value) => setAcademicYear(value ?? '')}
                      emptyMessage="No configured academic sessions are available."
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canCreate && (
                      <CustomButton variant="secondary" onClick={() => setFundOpen(true)}>
                        New fund
                      </CustomButton>
                    )}
                    {canCreate && !fundsError && (
                      <CustomButton onClick={() => setPackageOpen(true)}>
                        <FilePlus2 className="mr-2 h-4 w-4" />
                        Build package
                      </CustomButton>
                    )}
                  </div>
                </div>
              )}
            </div>
          </header>
          {error && (
            <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {error.message}
            </p>
          )}
          {fundsError && (
            <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
              Financial-aid funds could not be loaded. Package creation remains unavailable until
              the governed balances are restored.
            </p>
          )}
          {!isStudent && hasFinancialData && (
            <FinancialAidAnalytics
              totalBudget={analytics.totalBudget}
              reserved={analytics.reserved}
              disbursed={analytics.disbursed}
              available={analytics.available}
              offered={analytics.offered}
              fundCount={funds.length}
              beneficiaries={analytics.beneficiaries}
              statusCounts={analytics.statusCounts}
            />
          )}
          {(packages.length > 0 || isLoading) && (
            <CustomTable
              columns={columns}
              data={packages}
              actions={actions}
              isLoading={isLoading}
              title={isStudent ? 'My aid packages' : 'Aid package register'}
              description={
                isStudent
                  ? 'Review your offered awards, acceptance status and completed disbursements.'
                  : 'Track student need, governed awards, approval status and disbursement progress.'
              }
              onRefresh={() => mutate()}
              isValidating={isValidating}
              options={{ bordered: false, responsive: true, export: canExport }}
              detailPanel={(row) => (
                <div className="grid gap-2 p-3 sm:grid-cols-2">
                  {row.items.map((item) => (
                    <div key={item._id} className="rounded-xl bg-slate-50 p-3">
                      <div className="flex justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-800">{item.fundName}</p>
                          <p className="text-xs capitalize text-slate-500">
                            {item.type.replace('_', ' ')} ·{' '}
                            {item.disbursementMode.replace('_', ' ')}
                          </p>
                        </div>
                        <span className="text-sm font-bold">
                          {money(item.acceptedAmount || item.offeredAmount)}
                        </span>
                      </div>
                      {canDisburse && item.status === 'accepted' && item.type !== 'work_study' && (
                        <button
                          onClick={() =>
                            setDisbursement({
                              packageId: row._id,
                              itemId: item._id,
                              fundName: item.fundName,
                            })
                          }
                          className="mt-3 text-xs font-semibold text-primary"
                        >
                          Reconcile disbursement
                        </button>
                      )}
                      {item.referenceNo && (
                        <p className="mt-2 text-xs text-emerald-700">
                          Reference: {item.referenceNo}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            />
          )}
          {!isLoading && packages.length === 0 && (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {isStudent ? 'My aid packages' : 'Aid package register'}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {academicYear
                      ? `No packages are recorded for ${academicYear}.`
                      : 'No financial-aid packages are recorded yet.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => mutate()}
                  className="flex w-fit items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-200"
                >
                  <RefreshCw className={`h-4 w-4 ${isValidating ? 'animate-spin' : ''}`} /> Refresh
                </button>
              </div>
              <Empty
                title="No aid packages to display"
                subTitle={
                  isStudent
                    ? 'Your financial-aid offers will appear here when they are released.'
                    : 'Create a governed fund first, then build the student’s draft aid package.'
                }
              />
            </section>
          )}
          {packageOpen && (
            <PackageModal
              funds={funds}
              onClose={() => setPackageOpen(false)}
              onSaved={async () => {
                setPackageOpen(false);
                await mutate();
              }}
            />
          )}
          {fundOpen && (
            <FundModal
              onClose={() => setFundOpen(false)}
              onSaved={async () => {
                setFundOpen(false);
                await refreshFunds();
              }}
            />
          )}
          {disbursement && (
            <ReferenceModal
              title={`Disburse ${disbursement.fundName}`}
              onClose={() => setDisbursement(null)}
              onSubmit={async (referenceNo) => {
                const ok = await act(
                  `financial-aid/packages/${disbursement.packageId}/items/${disbursement.itemId}/disburse`,
                  { referenceNo },
                  'Aid disbursement reconciled',
                );
                if (ok) setDisbursement(null);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

interface IFinancialAidAnalyticsProps {
  totalBudget: number;
  reserved: number;
  disbursed: number;
  available: number;
  offered: number;
  fundCount: number;
  beneficiaries: number;
  statusCounts: Record<string, number>;
}

function FinancialAidAnalytics({
  totalBudget,
  reserved,
  disbursed,
  available,
  offered,
  fundCount,
  beneficiaries,
  statusCounts,
}: IFinancialAidAnalyticsProps) {
  const safeTotal = totalBudget || 1;
  const reservedPercent = Math.min(100, (reserved / safeTotal) * 100);
  const disbursedPercent = Math.min(100, (disbursed / safeTotal) * 100);
  const availablePercent = Math.max(0, 100 - reservedPercent - disbursedPercent);
  const packageTotal = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
  const statuses = [
    ['draft', 'Draft', 'fill-slate-300'],
    ['offered', 'Offered', 'fill-blue-500'],
    ['accepted', 'Accepted', 'fill-emerald-500'],
    ['partially_disbursed', 'Partially disbursed', 'fill-amber-500'],
    ['disbursed', 'Disbursed', 'fill-violet-500'],
    ['declined', 'Declined', 'fill-rose-400'],
  ] as const;

  return (
    <section className="space-y-4" aria-label="Financial aid analytics">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Governed budget',
            value: money(totalBudget),
            detail: `${fundCount} governed fund${fundCount === 1 ? '' : 's'}`,
            icon: Landmark,
            iconClass: 'bg-blue-50 text-blue-600',
          },
          {
            label: 'Aid offered',
            value: money(offered),
            detail: `${beneficiaries} student package${beneficiaries === 1 ? '' : 's'}`,
            icon: WalletCards,
            iconClass: 'bg-violet-50 text-violet-600',
          },
          {
            label: 'Disbursed',
            value: money(disbursed),
            detail: totalBudget
              ? `${disbursedPercent.toFixed(1)}% of governed budget`
              : 'No budget configured',
            icon: Banknote,
            iconClass: 'bg-emerald-50 text-emerald-600',
          },
          {
            label: 'Beneficiaries',
            value: beneficiaries.toLocaleString('en-IN'),
            detail: `${statusCounts.accepted ?? 0} accepted · ${statusCounts.disbursed ?? 0} completed`,
            icon: Users,
            iconClass: 'bg-amber-50 text-amber-600',
          },
        ].map(({ label, value, detail, icon: Icon, iconClass }) => (
          <article key={label} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconClass}`}>
                <Icon className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Live
              </span>
            </div>
            <p className="mt-4 text-xs font-semibold text-slate-500">{label}</p>
            <p className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">{value}</p>
            <p className="mt-1 text-xs text-slate-500">{detail}</p>
          </article>
        ))}
      </div>

      <div
        className={`grid gap-4 ${totalBudget > 0 && packageTotal > 0 ? 'xl:grid-cols-[1.25fr_0.75fr]' : ''}`}
      >
        {totalBudget > 0 && (
          <article className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Budget allocation</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Available, reserved and disbursed fund movement
                </p>
              </div>
              <p className="text-xs font-semibold text-slate-500">Available {money(available)}</p>
            </div>
            <>
              <svg
                viewBox="0 0 1000 130"
                className="mt-5 h-28 w-full"
                role="img"
                aria-label="Budget utilization chart"
              >
                <defs>
                  <linearGradient id="aidAvailable" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#dbeafe" />
                    <stop offset="100%" stopColor="#60a5fa" />
                  </linearGradient>
                  <linearGradient id="aidReserved" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#fde68a" />
                    <stop offset="100%" stopColor="#f59e0b" />
                  </linearGradient>
                  <linearGradient id="aidDisbursed" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#a7f3d0" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                  <clipPath id="aidBudgetClip">
                    <rect x="10" y="34" width="980" height="44" rx="22" />
                  </clipPath>
                </defs>
                <g clipPath="url(#aidBudgetClip)">
                  <rect
                    x="10"
                    y="34"
                    width={availablePercent * 9.8}
                    height="44"
                    fill="url(#aidAvailable)"
                  />
                  <rect
                    x={10 + availablePercent * 9.8}
                    y="34"
                    width={reservedPercent * 9.8}
                    height="44"
                    fill="url(#aidReserved)"
                  />
                  <rect
                    x={10 + (availablePercent + reservedPercent) * 9.8}
                    y="34"
                    width={disbursedPercent * 9.8}
                    height="44"
                    fill="url(#aidDisbursed)"
                  />
                </g>
                <line x1="10" y1="94" x2="990" y2="94" stroke="#e2e8f0" strokeWidth="2" />
                {[0, 25, 50, 75, 100].map((tick) => (
                  <g key={tick}>
                    <line
                      x1={10 + tick * 9.8}
                      y1="90"
                      x2={10 + tick * 9.8}
                      y2="100"
                      stroke="#cbd5e1"
                    />
                    <text
                      x={10 + tick * 9.8}
                      y="118"
                      textAnchor={tick === 0 ? 'start' : tick === 100 ? 'end' : 'middle'}
                      className="fill-slate-400 text-[18px]"
                    >
                      {tick}%
                    </text>
                  </g>
                ))}
              </svg>
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  ['Available', available, 'bg-blue-400'],
                  ['Reserved', reserved, 'bg-amber-500'],
                  ['Disbursed', disbursed, 'bg-emerald-500'],
                ].map(([label, value, color]) => (
                  <div key={String(label)} className="rounded-xl bg-slate-50 p-3">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
                      {label}
                    </div>
                    <p className="mt-1 text-sm font-bold text-slate-800">{money(Number(value))}</p>
                  </div>
                ))}
              </div>
            </>
          </article>
        )}

        {packageTotal > 0 && (
          <article className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <h2 className="text-sm font-bold text-slate-900">Package workflow</h2>
            <p className="mt-1 text-xs text-slate-500">Current package distribution by status</p>
            <div className="mt-5 space-y-3">
              {statuses.map(([key, label, color]) => {
                const count = statusCounts[key] ?? 0;
                const percent = packageTotal ? (count / packageTotal) * 100 : 0;
                return (
                  <div key={key}>
                    <div className="mb-1.5 flex justify-between text-xs">
                      <span className="font-medium text-slate-600">{label}</span>
                      <span className="font-bold text-slate-800">{count}</span>
                    </div>
                    <svg viewBox="0 0 100 6" className="h-2 w-full" aria-hidden="true">
                      <rect x="0" y="0" width="100" height="6" rx="3" className="fill-slate-100" />
                      <rect x="0" y="0" width={percent} height="6" rx="3" className={color} />
                    </svg>
                  </div>
                );
              })}
            </div>
          </article>
        )}
      </div>
    </section>
  );
}

function Shell({
  title,
  description,
  steps,
  activeStep = 0,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  steps?: string[];
  activeStep?: number;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-200/80 sm:items-center sm:p-4">
      <div className="max-h-[96dvh] w-full max-w-5xl overflow-y-auto rounded-t-3xl bg-white sm:rounded-3xl">
        <div className="border-b border-slate-100 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-900">{title}</h2>
              {description && (
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-xl bg-slate-100 p-2 text-slate-500 transition-colors hover:bg-slate-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {steps && (
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {steps.map((step, index) => (
                <div
                  key={step}
                  className={`rounded-xl px-3 py-2.5 text-xs font-semibold ${index === activeStep ? 'bg-primary text-white' : index < activeStep ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                >
                  <span className="mr-2">{index + 1}</span>
                  {step}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
function PackageModal({
  funds,
  onClose,
  onSaved,
}: {
  funds: IFinancialAidFund[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { mutation, isLoading } = useMutation();
  const [step, setStep] = useState(0);
  const initial: IPackageForm = {
    studentProfileId: '',
    academicYear: '',
    studentContribution: 0,
    indirectCost: 0,
    notes: '',
    items: [{ fundId: '', amount: 0 }],
  };
  return (
    <Shell
      title="Build financial-aid package"
      description="Create one governed offer from verified student need and available fund balances. The package remains a draft until an independent reviewer releases it."
      steps={['Student & need', 'Award allocation', 'Review & save']}
      activeStep={step}
      onClose={onClose}
    >
      <Formik
        initialValues={initial}
        validationSchema={packageSchema}
        onSubmit={async (values) => {
          const response = await mutation('financial-aid/packages', {
            method: 'POST',
            body: values,
          });
          if (!response?.results?.success) return;
          toast.success('Financial-aid package drafted');
          await onSaved();
        }}
      >
        {({ values, setFieldValue }) => (
          <Form className="space-y-5">
            {step === 0 && (
              <section className="space-y-5">
                <div className="rounded-2xl bg-blue-50 p-4 text-sm text-blue-800">
                  The backend calculates demonstrated need from invoiced fees, existing awards,
                  student contribution and approved indirect cost.
                </div>
                <div className="grid gap-5 lg:grid-cols-2">
                  <div>
                    <AsyncSelect
                      type="studentProfiles"
                      label="Student record"
                      required
                      value={values.studentProfileId}
                      onChange={(value) => setFieldValue('studentProfileId', value ?? '')}
                      placeholder="Search by student name or roll number"
                    />
                    <p className="mt-1.5 text-xs leading-5 text-slate-500">
                      Select the enrolled student whose verified fee and scholarship records will be
                      evaluated.
                    </p>
                    <ErrorMessage name="studentProfileId">
                      {(m) => <p className="text-xs text-red-500">{m}</p>}
                    </ErrorMessage>
                  </div>
                  <div>
                    <AsyncSelect
                      type="academicYears"
                      label="Academic session"
                      required
                      value={values.academicYear || null}
                      onChange={(value) => setFieldValue('academicYear', value ?? '')}
                      placeholder="Select configured session"
                    />
                    <p className="mt-1.5 text-xs leading-5 text-slate-500">
                      Funds, invoices and existing awards must belong to this same academic session.
                    </p>
                    <ErrorMessage name="academicYear">
                      {(m) => <p className="text-xs text-red-500">{m}</p>}
                    </ErrorMessage>
                  </div>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="text-sm font-semibold text-slate-700">
                    Student contribution *
                    <Field
                      name="studentContribution"
                      type="number"
                      min="0"
                      className={fieldClass}
                    />
                    <span className="mt-1.5 block text-xs font-normal leading-5 text-slate-500">
                      Expected student or family contribution used to reduce demonstrated need.
                    </span>
                    <ErrorMessage name="studentContribution">
                      {(m) => <p className="text-xs text-red-500">{m}</p>}
                    </ErrorMessage>
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Approved indirect cost *
                    <Field name="indirectCost" type="number" min="0" className={fieldClass} />
                    <span className="mt-1.5 block text-xs font-normal leading-5 text-slate-500">
                      Approved books, living or study expenses outside the direct fee invoice.
                    </span>
                    <ErrorMessage name="indirectCost">
                      {(m) => <p className="text-xs text-red-500">{m}</p>}
                    </ErrorMessage>
                  </label>
                </div>
              </section>
            )}
            {step === 1 && (
              <FieldArray name="items">
                {({ push, remove }) => (
                  <section className="space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-base font-bold text-slate-900">Package awards</h3>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          Allocate one or more active funds. The backend enforces available budget,
                          per-student limits and demonstrated need.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => push({ fundId: '', amount: 0 })}
                        className="w-fit rounded-lg bg-primary-50 px-3 py-2 text-xs font-semibold text-primary"
                      >
                        Add award
                      </button>
                    </div>
                    {values.items.map((item, index) => (
                      <div
                        key={index}
                        className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[1fr_190px_auto] sm:items-end"
                      >
                        <label className="text-xs font-semibold text-slate-600">
                          Governed fund
                          <Field as="select" name={`items.${index}.fundId`} className={fieldClass}>
                            <option value="">Select governed fund</option>
                            {funds
                              .filter(
                                (fund) =>
                                  !values.academicYear || fund.academicYear === values.academicYear,
                              )
                              .map((fund) => (
                                <option key={fund._id} value={fund._id}>
                                  {fund.code} · {fund.name} (
                                  {money(
                                    fund.budgetAmount - fund.reservedAmount - fund.disbursedAmount,
                                  )}{' '}
                                  available)
                                </option>
                              ))}
                          </Field>
                          <span className="mt-1 block text-[11px] font-normal text-slate-500">
                            Only funds matching the selected session are available.
                          </span>
                        </label>
                        <label className="text-xs font-semibold text-slate-600">
                          Offered amount
                          <Field
                            name={`items.${index}.amount`}
                            type="number"
                            min="0"
                            className={fieldClass}
                          />
                          <span className="mt-1 block text-[11px] font-normal text-slate-500">
                            Must remain within the fund limit.
                          </span>
                        </label>
                        <button
                          type="button"
                          disabled={values.items.length === 1}
                          onClick={() => remove(index)}
                          className="mb-1 rounded-lg px-3 py-2 text-xs font-semibold text-red-600 disabled:text-slate-300"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </section>
                )}
              </FieldArray>
            )}
            {step === 2 && (
              <section className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">Academic session</p>
                    <p className="mt-1 font-bold text-slate-900">
                      {values.academicYear || 'Not selected'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">Award lines</p>
                    <p className="mt-1 font-bold text-slate-900">{values.items.length}</p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-4">
                    <p className="text-xs text-emerald-700">Total offered</p>
                    <p className="mt-1 font-black text-emerald-800">
                      {money(values.items.reduce((sum, item) => sum + Number(item.amount || 0), 0))}
                    </p>
                  </div>
                </div>
                <label className="block text-sm font-semibold text-slate-700">
                  Internal package notes
                  <Field
                    as="textarea"
                    rows={5}
                    name="notes"
                    placeholder="Document eligibility review, supporting evidence or committee notes…"
                    className={fieldClass}
                  />
                  <span className="mt-1.5 block text-xs font-normal leading-5 text-slate-500">
                    These notes support audit review and are not a substitute for uploaded evidence.
                  </span>
                </label>
                <div className="rounded-2xl bg-amber-50 p-4 text-xs leading-5 text-amber-800">
                  Saving creates a draft only. A different authorized reviewer must release the
                  offer before the student can respond.
                </div>
              </section>
            )}
            <div className="flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-5">
              <CustomButton
                type="button"
                variant="secondary"
                onClick={() => (step === 0 ? onClose() : setStep((current) => current - 1))}
              >
                {step === 0 ? 'Cancel' : 'Previous'}
              </CustomButton>
              {step < 2 ? (
                <CustomButton
                  type="button"
                  disabled={
                    step === 0
                      ? !values.studentProfileId || !values.academicYear
                      : values.items.some((item) => !item.fundId || Number(item.amount) <= 0)
                  }
                  onClick={() => setStep((current) => current + 1)}
                >
                  Continue
                </CustomButton>
              ) : (
                <CustomButton type="submit" loading={isLoading}>
                  Save draft package
                </CustomButton>
              )}
            </div>
          </Form>
        )}
      </Formik>
    </Shell>
  );
}
function FundModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => Promise<void> }) {
  const { mutation, isLoading } = useMutation();
  const [step, setStep] = useState(0);
  const schema = Yup.object({
    code: Yup.string().required().max(40),
    name: Yup.string().required().max(200),
    type: Yup.string().required(),
    source: Yup.string().required(),
    academicYear: Yup.string().required(),
    disbursementMode: Yup.string().required(),
    budgetAmount: Yup.number().moreThan(0).required(),
    maxPerStudent: Yup.number().moreThan(0).required(),
  });
  return (
    <Shell
      title="Create financial-aid fund"
      description="Define the source, policy limits and controlled disbursement route for one academic-session budget."
      steps={['Fund identity', 'Budget & policy', 'Review & create']}
      activeStep={step}
      onClose={onClose}
    >
      <Formik
        initialValues={{
          code: '',
          name: '',
          type: 'grant',
          source: 'institutional',
          academicYear: '',
          disbursementMode: 'fee_credit',
          budgetAmount: 0,
          maxPerStudent: 0,
          isNeedBased: true,
        }}
        validationSchema={schema}
        onSubmit={async (values) => {
          const response = await mutation('financial-aid/funds', { method: 'POST', body: values });
          if (!response?.results?.success) return;
          toast.success('Financial-aid fund created');
          await onSaved();
        }}
      >
        {({ values, setFieldValue }) => (
          <Form className="space-y-5">
            {step === 0 && (
              <section className="space-y-5">
                <div className="rounded-2xl bg-blue-50 p-4 text-sm leading-6 text-blue-800">
                  Use a unique, recognizable code and bind the fund to one configured academic
                  session. Budgets cannot be shared silently across sessions.
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="text-sm font-semibold text-slate-700">
                    Fund code *
                    <Field name="code" placeholder="Example: INST-MERIT" className={fieldClass} />
                    <span className="mt-1.5 block text-xs font-normal leading-5 text-slate-500">
                      Short audit identifier. It is normalized to uppercase and must be unique
                      within the session.
                    </span>
                    <ErrorMessage name="code">
                      {(m) => <p className="text-xs text-red-500">{m}</p>}
                    </ErrorMessage>
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Fund name *
                    <Field
                      name="name"
                      placeholder="Institution Merit Assistance"
                      className={fieldClass}
                    />
                    <span className="mt-1.5 block text-xs font-normal leading-5 text-slate-500">
                      Full name shown to package builders, reviewers and students.
                    </span>
                    <ErrorMessage name="name">
                      {(m) => <p className="text-xs text-red-500">{m}</p>}
                    </ErrorMessage>
                  </label>
                  <div>
                    <AsyncSelect
                      type="academicYears"
                      label="Academic session"
                      required
                      value={values.academicYear || null}
                      onChange={(value) => setFieldValue('academicYear', value ?? '')}
                      placeholder="Select configured session"
                    />
                    <p className="mt-1.5 text-xs leading-5 text-slate-500">
                      The fund can be used only by packages created for this session.
                    </p>
                    <ErrorMessage name="academicYear">
                      {(m) => <p className="text-xs text-red-500">{m}</p>}
                    </ErrorMessage>
                  </div>
                  <label className="text-sm font-semibold text-slate-700">
                    Aid type *
                    <Field as="select" name="type" className={fieldClass}>
                      {['grant', 'scholarship', 'loan', 'work_study'].map((value) => (
                        <option key={value} value={value}>
                          {value.replace('_', ' ')}
                        </option>
                      ))}
                    </Field>
                    <span className="mt-1.5 block text-xs font-normal leading-5 text-slate-500">
                      Classifies whether assistance is gifted, repayable or earned through work.
                    </span>
                  </label>
                </div>
              </section>
            )}
            {step === 1 && (
              <section className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="text-sm font-semibold text-slate-700">
                    Funding source *
                    <Field as="select" name="source" className={fieldClass}>
                      {['government', 'institutional', 'private', 'bank'].map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </Field>
                    <span className="mt-1.5 block text-xs font-normal leading-5 text-slate-500">
                      Identifies the legal or institutional owner of the allocated budget.
                    </span>
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Disbursement route *
                    <Field as="select" name="disbursementMode" className={fieldClass}>
                      <option value="fee_credit">Fee credit</option>
                      <option value="bank_transfer">Bank transfer</option>
                    </Field>
                    <span className="mt-1.5 block text-xs font-normal leading-5 text-slate-500">
                      Fee credit reduces ERP invoices; bank transfer posts through Accounts
                      reconciliation.
                    </span>
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Governed budget amount *
                    <Field name="budgetAmount" type="number" min="1" className={fieldClass} />
                    <span className="mt-1.5 block text-xs font-normal leading-5 text-slate-500">
                      Maximum total value available for reservation and disbursement.
                    </span>
                    <ErrorMessage name="budgetAmount">
                      {(m) => <p className="text-xs text-red-500">{m}</p>}
                    </ErrorMessage>
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Maximum per student *
                    <Field name="maxPerStudent" type="number" min="1" className={fieldClass} />
                    <span className="mt-1.5 block text-xs font-normal leading-5 text-slate-500">
                      Hard ceiling for one student package allocation from this fund.
                    </span>
                    <ErrorMessage name="maxPerStudent">
                      {(m) => <p className="text-xs text-red-500">{m}</p>}
                    </ErrorMessage>
                  </label>
                </div>
                <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <Field type="checkbox" name="isNeedBased" className="mt-1 h-4 w-4" />
                  <span>
                    <span className="block font-semibold text-slate-700">
                      Apply demonstrated-need controls
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                      When enabled, non-loan awards cannot exceed the student’s calculated financial
                      need.
                    </span>
                  </span>
                </label>
              </section>
            )}
            {step === 2 && (
              <section className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ['Fund', `${values.code || '—'} · ${values.name || 'Unnamed'}`],
                    ['Session', values.academicYear || '—'],
                    ['Budget', money(Number(values.budgetAmount || 0))],
                    ['Student limit', money(Number(values.maxPerStudent || 0))],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs text-slate-500">{label}</p>
                      <p className="mt-1 wrap-break-word text-sm font-bold text-slate-900">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl bg-amber-50 p-4 text-xs leading-5 text-amber-800">
                  Confirm that the approved budget document supports this amount, source and
                  academic session. Creating the fund immediately makes it available to authorized
                  package builders.
                </div>
              </section>
            )}
            <div className="flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-5">
              <CustomButton
                type="button"
                variant="secondary"
                onClick={() => (step === 0 ? onClose() : setStep((current) => current - 1))}
              >
                {step === 0 ? 'Cancel' : 'Previous'}
              </CustomButton>
              {step < 2 ? (
                <CustomButton
                  type="button"
                  disabled={
                    step === 0
                      ? !values.code || !values.name || !values.academicYear
                      : Number(values.budgetAmount) <= 0 ||
                        Number(values.maxPerStudent) <= 0 ||
                        Number(values.maxPerStudent) > Number(values.budgetAmount)
                  }
                  onClick={() => setStep((current) => current + 1)}
                >
                  Continue
                </CustomButton>
              ) : (
                <CustomButton type="submit" loading={isLoading}>
                  Create governed fund
                </CustomButton>
              )}
            </div>
          </Form>
        )}
      </Formik>
    </Shell>
  );
}
function ReferenceModal({
  title,
  onClose,
  onSubmit,
}: {
  title: string;
  onClose: () => void;
  onSubmit: (reference: string) => Promise<void>;
}) {
  const schema = Yup.object({
    referenceNo: Yup.string()
      .trim()
      .min(3)
      .max(200)
      .required('Reconciliation reference is required'),
  });
  return (
    <Shell title={title} onClose={onClose}>
      <Formik
        initialValues={{ referenceNo: '' }}
        validationSchema={schema}
        onSubmit={(values) => onSubmit(values.referenceNo)}
      >
        {() => (
          <Form className="space-y-4">
            <label className="block text-sm font-medium">
              Bank or reconciliation reference *<Field name="referenceNo" className={fieldClass} />
              <ErrorMessage name="referenceNo">
                {(m) => <p className="text-xs text-red-500">{m}</p>}
              </ErrorMessage>
            </label>
            <div className="flex justify-end">
              <CustomButton type="submit">
                <CircleDollarSign className="mr-2 h-4 w-4" />
                Confirm disbursement
              </CustomButton>
            </div>
          </Form>
        )}
      </Formik>
    </Shell>
  );
}
