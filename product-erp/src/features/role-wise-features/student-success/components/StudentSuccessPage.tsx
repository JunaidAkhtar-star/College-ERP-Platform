/**
 * @file StudentSuccessPage.tsx
 * @description Explainable early-warning, advisor caseload and intervention workspace.
 * @module features/role-wise-features/student-success
 */
'use client';

import StudentWorkflowBar from '@/shared/components/StudentWorkflowBar';
import AsyncSelect from '@/shared/core/AsyncSelect';
import CustomButton from '@/shared/core/CustomButton';
import CustomTable from '@/shared/core/CustomTable';
import Empty from '@/shared/core/Empty';
import WorkflowActionDialog from '@/shared/core/WorkflowActionDialog';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import { useAuthStore } from '@/shared/store/authStore';
import { Activity, CircleAlert, HeartHandshake, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import type { IRiskSnapshot, IStudentSuccessCase } from '../types/student-success.types';

interface IApiResponse<T> {
  success: boolean;
  data: T;
}
type ICaseloadRow = IRiskSnapshot & Record<string, unknown>;
interface ICaseload {
  data: ICaseloadRow[];
  total: number;
}

const riskTone = {
  low: 'bg-emerald-50 text-emerald-700',
  medium: 'bg-amber-50 text-amber-700',
  high: 'bg-orange-50 text-orange-700',
  critical: 'bg-red-50 text-red-700',
};
const profileId = (snapshot: IRiskSnapshot) =>
  typeof snapshot.studentProfileId === 'string'
    ? snapshot.studentProfileId
    : snapshot.studentProfileId._id;
const studentName = (snapshot: IRiskSnapshot) =>
  typeof snapshot.studentProfileId === 'string'
    ? 'Student'
    : [
        snapshot.studentProfileId.firstName,
        snapshot.studentProfileId.middleName,
        snapshot.studentProfileId.lastName,
      ]
        .filter(Boolean)
        .join(' ');

export default function StudentSuccessPage() {
  const activeRole = useAuthStore((state) => state.activeRole);
  const role = activeRole?.baseRole ?? activeRole?.name ?? '';
  const studentMode = role === 'student';
  const canRefresh = useHasPermission('mentor', 'edit');
  const canOpenCase = useHasPermission('mentor', 'create');
  const canResolve = useHasPermission('mentor', 'edit');
  const [riskLevel, setRiskLevel] = useState('');
  const url = studentMode
    ? 'student-success/mine'
    : `student-success/caseload?limit=100${riskLevel ? `&riskLevel=${riskLevel}` : ''}`;
  const {
    data: raw,
    isLoading,
    error,
    mutate,
  } = useSwr<
    IApiResponse<ICaseload | { snapshot: IRiskSnapshot; activeCase?: IStudentSuccessCase }>
  >(url);
  const { mutation, isLoading: acting } = useMutation();
  const studentData = studentMode
    ? (raw?.data as { snapshot: IRiskSnapshot; activeCase?: IStudentSuccessCase } | undefined)
    : undefined;
  const caseload = useMemo(
    () => (studentMode ? [] : ((raw?.data as ICaseload | undefined)?.data ?? [])),
    [raw?.data, studentMode],
  );
  const [selected, setSelected] = useState<IRiskSnapshot | null>(null);
  const [advisorId, setAdvisorId] = useState<string | null>(null);
  const [caseTitle, setCaseTitle] = useState('Student success intervention');
  const [caseSummary, setCaseSummary] = useState('');
  const [casePriority, setCasePriority] = useState<'low' | 'medium' | 'high' | 'critical'>(
    'medium',
  );
  const [dueAt, setDueAt] = useState('');
  const [actionCase, setActionCase] = useState<IStudentSuccessCase | null>(null);
  const [actionMode, setActionMode] = useState<'intervention' | 'resolve'>('intervention');
  const summary = useMemo(
    () => ({
      critical: caseload.filter((row) => row.riskLevel === 'critical').length,
      high: caseload.filter((row) => row.riskLevel === 'high').length,
      activeCases: caseload.filter((row) => row.activeCase).length,
    }),
    [caseload],
  );

  const refreshAll = async () => {
    const response = await mutation('student-success/refresh', {
      method: 'POST',
      body: {},
      isAlert: true,
    });
    if (response) await mutate();
  };

  const openCase = async () => {
    if (!selected || !advisorId || caseSummary.trim().length < 10) {
      toast.error('Select an advisor and enter a clear intervention summary');
      return;
    }
    const response = await mutation('student-success/cases', {
      method: 'POST',
      body: {
        studentProfileId: profileId(selected),
        assignedAdvisorId: advisorId,
        title: caseTitle,
        summary: caseSummary,
        priority: casePriority,
        dueAt: dueAt || undefined,
      },
      isAlert: true,
    });
    if (response) {
      setSelected(null);
      setAdvisorId(null);
      setCaseSummary('');
      setDueAt('');
      await mutate();
    }
  };

  const completeCaseAction = async (reason: string) => {
    if (!actionCase) return;
    const resolving = actionMode === 'resolve';
    const response = await mutation(
      resolving
        ? `student-success/cases/${actionCase._id}/resolve`
        : `student-success/cases/${actionCase._id}/interventions`,
      {
        method: 'PATCH',
        body: resolving
          ? { resolution: reason }
          : { type: 'academic', action: reason, status: 'monitoring' },
        isAlert: true,
      },
    );
    if (response) {
      setActionCase(null);
      await mutate();
    }
  };

  return (
    <div className="space-y-5">
      <StudentWorkflowBar />
      <header className="rounded-2xl bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary">
              Retention & intervention
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Student Success Centre</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Explainable indicators combine attendance, academic progress, fee balance and advisor
              follow-up. Scores guide human review; they never make automatic decisions.
            </p>
          </div>
        </div>
      </header>

      {!studentMode && (
        <section className="grid gap-3 sm:grid-cols-3">
          <Metric label="Critical" value={summary.critical} icon={<CircleAlert />} />
          <Metric label="High risk" value={summary.high} icon={<Activity />} />
          <Metric label="Active cases" value={summary.activeCases} icon={<HeartHandshake />} />
        </section>
      )}

      {isLoading ? (
        <div className="h-52 animate-pulse rounded-2xl bg-white" />
      ) : error || (!studentMode && !caseload.length) ? (
        <Empty
          title={error ? 'Student success data unavailable' : 'No students in this risk view'}
          subTitle={
            error
              ? 'Retry after checking the academic data services.'
              : 'Refresh indicators or choose another risk level.'
          }
        />
      ) : studentMode && studentData ? (
        <RiskDetail snapshot={studentData.snapshot} activeCase={studentData.activeCase} />
      ) : (
        <>
          {/* ── Risk Indicators Table ─────────────────────────────────────── */}
          {!studentMode && (
            <CustomTable<ICaseloadRow>
              title="Caseload Risk Registry"
              description="Early warning indicators evaluated across active student records."
              onRefresh={canRefresh ? refreshAll : undefined}
              isValidating={acting}
              data={caseload}
              columns={[
                {
                  field: 'studentProfileId',
                  title: 'Student Detail',
                  render: (row) => (
                    <div>
                      <p className="font-semibold text-slate-800">{studentName(row)}</p>
                      <p className="text-xs text-slate-600">
                        {typeof row.studentProfileId === 'object'
                          ? `${row.studentProfileId.rollNumber} · ${row.studentProfileId.program} · Sem ${row.studentProfileId.currentSemester}`
                          : row.academicYear}
                      </p>
                    </div>
                  ),
                },
                {
                  field: 'riskScore',
                  title: 'Risk Index',
                  cellClassName: '!text-center',
                  render: (row) => (
                    <div className="flex justify-center">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${riskTone[row.riskLevel]}`}
                      >
                        {row.riskScore} · {row.riskLevel}
                      </span>
                    </div>
                  ),
                },
                {
                  field: 'calculatedAt',
                  title: 'Last Calculated',
                  cellClassName: '!text-center',
                  render: (row) => (
                    <div className="flex justify-center">
                      <span className="text-xs text-slate-500">
                        {new Date(row.calculatedAt).toLocaleString('en-IN')}
                      </span>
                    </div>
                  ),
                },
                {
                  field: 'activeCase',
                  title: 'Support Status',
                  cellClassName: '!text-center',
                  render: (row) => (
                    <div className="flex justify-center">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          row.activeCase
                            ? 'bg-primary/10 text-primary'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {row.activeCase
                          ? row.activeCase.status.replaceAll('_', ' ')
                          : 'No Active Case'}
                      </span>
                    </div>
                  ),
                },
              ]}
              actions={[
                {
                  tooltip: 'View Risk indicators',
                  icon: <Activity className="h-4 w-4 text-primary" />,
                  onClick: (row) => setSelected(row),
                },
                {
                  tooltip: 'Record support intervention',
                  icon: <HeartHandshake className="h-4 w-4 text-emerald-600" />,
                  hidden: (row) => !row.activeCase || !canResolve,
                  onClick: (row) => {
                    setActionMode('intervention');
                    setActionCase(row.activeCase ?? null);
                  },
                },
                {
                  tooltip: 'Resolve case',
                  icon: <ShieldCheck className="h-4 w-4 text-sky-600" />,
                  hidden: (row) => !row.activeCase || !canResolve,
                  onClick: (row) => {
                    setActionMode('resolve');
                    setActionCase(row.activeCase ?? null);
                  },
                },
              ]}
              options={{
                bordered: false,
                responsive: true,
                export: true,
                actionsType: 'dropdown',
              }}
              customActions={
                <div className="flex items-center gap-2">
                  <select
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                    value={riskLevel}
                    onChange={(event) => setRiskLevel(event.target.value)}
                  >
                    <option value="">All risk levels</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              }
            />
          )}
        </>
      )}

      {/* ── Indicators Detail Dialog ── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-200/80 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="flex max-h-[85vh] h-fit w-full max-w-3xl flex-col rounded-t-3xl bg-white  sm:rounded-3xl transition-all duration-200 border border-slate-100">
            {/* Fixed Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Student Early Warning Indicators
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Review risk highlights and configure support caseload assignment for{' '}
                  {studentName(selected)}.
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                type="button"
                className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-700 transition"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-6 text-left">
                <RiskDetail snapshot={selected} activeCase={selected.activeCase} />

                {/* If no active case, allow case assignment inside the dialog body */}
                {!selected.activeCase && (
                  <div className="rounded-2xl bg-slate-50/60 border border-slate-150 p-5 space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                      Assign Intervention Caseload
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block text-sm font-semibold text-slate-700">
                        Intervention Title
                        <input
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
                          value={caseTitle}
                          onChange={(event) => setCaseTitle(event.target.value)}
                          placeholder="e.g. Attendance counseling"
                        />
                      </label>
                      <label className="block text-sm font-semibold text-slate-700">
                        Priority Level
                        <select
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
                          value={casePriority}
                          onChange={(event) =>
                            setCasePriority(event.target.value as typeof casePriority)
                          }
                        >
                          <option value="low">Low priority</option>
                          <option value="medium">Medium priority</option>
                          <option value="high">High priority</option>
                          <option value="critical">Critical priority</option>
                        </select>
                      </label>
                      <div className="block text-sm font-semibold text-slate-700">
                        <AsyncSelect
                          type="faculty"
                          label="Assigned Advisor"
                          value={advisorId}
                          params={{ departmentId: selected.departmentId }}
                          onChange={(val) => setAdvisorId(val)}
                        />
                      </div>
                      <label className="block text-sm font-semibold text-slate-700">
                        Target Due Date
                        <input
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
                          type="date"
                          value={dueAt}
                          onChange={(event) => setDueAt(event.target.value)}
                        />
                      </label>
                      <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">
                        Case Summary & Expectations
                        <textarea
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
                          rows={3}
                          value={caseSummary}
                          onChange={(event) => setCaseSummary(event.target.value)}
                          placeholder="Detail the advisor actions expected to support the student..."
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Fixed Footer */}
            <div className="border-t border-slate-100 px-6 py-4 bg-slate-50 rounded-b-3xl flex justify-end gap-3">
              <CustomButton variant="secondary" onClick={() => setSelected(null)}>
                Close
              </CustomButton>
              {!selected.activeCase && canOpenCase && (
                <CustomButton onClick={openCase} loading={acting}>
                  Open Support Case
                </CustomButton>
              )}
            </div>
          </div>
        </div>
      )}

      <WorkflowActionDialog
        open={Boolean(actionCase)}
        title={actionMode === 'resolve' ? 'Resolve student success case' : 'Record intervention'}
        description={
          actionMode === 'resolve'
            ? 'Record the measurable outcome before resolving this case.'
            : 'Describe the action taken; the case will move to monitoring.'
        }
        confirmLabel={actionMode === 'resolve' ? 'Resolve case' : 'Record intervention'}
        reasonLabel={actionMode === 'resolve' ? 'Resolution and outcome' : 'Action taken'}
        loading={acting}
        onClose={() => setActionCase(null)}
        onConfirm={async ({ reason }) => completeCaseAction(reason)}
      />
    </div>
  );
}

function RiskDetail({
  snapshot,
  activeCase,
}: {
  snapshot: IRiskSnapshot;
  activeCase?: IStudentSuccessCase;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">{studentName(snapshot)}</h2>
          <p className="mt-1 text-xs text-slate-500">
            Calculated {new Date(snapshot.calculatedAt).toLocaleString('en-IN')}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${riskTone[snapshot.riskLevel]}`}
        >
          {snapshot.riskScore}/100 · {snapshot.riskLevel}
        </span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {snapshot.signals.map((signal) => (
          <article key={signal.key} className="rounded-xl bg-slate-50 p-4">
            <div className="flex justify-between gap-3">
              <p className="text-sm font-semibold text-slate-800">{signal.label}</p>
              <span className="text-xs font-bold text-slate-500">+{signal.score}</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-600">{signal.explanation}</p>
            <p className="mt-1 text-[11px] text-slate-600">Support threshold: {signal.threshold}</p>
          </article>
        ))}
      </div>
      {activeCase && (
        <div className="mt-4 rounded-xl bg-primary-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-primary">
            <ShieldCheck className="h-4 w-4" /> Active support case ·{' '}
            {activeCase.status.replaceAll('_', ' ')}
          </p>
          <p className="mt-2 text-xs leading-5 text-primary/80">{activeCase.summary}</p>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-4">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-50 text-primary [&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </span>
      <div>
        <p className="text-xl font-bold text-slate-900">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}
