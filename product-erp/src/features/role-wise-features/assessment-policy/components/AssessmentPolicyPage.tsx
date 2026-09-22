/** @file AssessmentPolicyPage.tsx @description Policy governance workspace for tenant academic administrators. @module features/assessment-policy */
'use client';
import { useState } from 'react';
import { Archive, Copy, FileCheck2, Pencil, Plus, ShieldCheck } from 'lucide-react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { motion } from '@/shared/utils/motion';
import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { type Column } from '@/shared/core/CustomTable';
import ExaminationWorkflowBar from '@/shared/components/ExaminationWorkflowBar';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import type { IAssessmentPolicy, ICurriculum, ISubject } from '../types/assessment-policy.types';
import PolicyEditor from './PolicyEditor';
import GradebookPanel from './GradebookPanel';
export default function AssessmentPolicyPage() {
  const [tab, setTab] = useState<'policies' | 'gradebook'>('policies');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<IAssessmentPolicy>();

  // Permission gates — backend also enforces these; UI gates remove confusion
  const canCreate = useHasPermission('internal_assessment', 'create');
  const canApprove = useHasPermission('internal_assessment', 'approve');

  const { data: raw, isLoading, error: policiesError, mutate } = useSwr('assessment-policy');
  const { data: curriculaRaw, error: curriculaError } = useSwr('curriculum');
  const { data: subjectsRaw, error: subjectsError } = useSwr('subject');
  const { mutation } = useMutation();
  const policies = (raw as { data?: IAssessmentPolicy[] })?.data ?? [];
  const curriculaPayload = (curriculaRaw as { data?: { data?: ICurriculum[] } | ICurriculum[] })
    ?.data;
  const curricula = Array.isArray(curriculaPayload)
    ? curriculaPayload
    : (curriculaPayload?.data ?? []);
  const subjects = (subjectsRaw as { data?: { data?: ISubject[] } })?.data?.data ?? [];
  const action = async (policy: IAssessmentPolicy, type: 'publish' | 'clone' | 'retire') => {
    if (type === 'publish' || type === 'retire') {
      const confirmation = await Swal.fire({
        title: type === 'publish' ? 'Publish this policy version?' : 'Retire this policy?',
        text:
          type === 'publish'
            ? 'Published policies are immutable and must be cloned for future changes.'
            : 'Historical results remain unchanged, but this policy cannot be used for new activities.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#0178D7',
      });
      if (!confirmation.isConfirmed) return;
    }
    const response = await mutation(`assessment-policy/${policy._id}/${type}`, { method: 'POST' });
    if ((response as { results?: { success?: boolean } })?.results?.success) {
      toast.success(
        type === 'publish'
          ? 'Policy published'
          : type === 'retire'
            ? 'Policy retired'
            : 'New draft version created',
      );
      mutate();
    }
  };
  const columns: Column<IAssessmentPolicy>[] = [
    {
      field: 'name',
      title: 'Policy',
      render: (row) => (
        <div>
          <p className="text-sm font-semibold text-slate-900">{row.name}</p>
          <p className="text-xs text-slate-500">
            {row.code} · Version {row.version}
          </p>
        </div>
      ),
    },
    {
      field: 'program',
      title: 'Scope',
      render: (row) => (
        <span className="text-xs text-slate-600">
          {[row.program, row.regulationYear, row.semester ? `Term ${row.semester}` : null]
            .filter(Boolean)
            .join(' · ') || 'Institution default'}
        </span>
      ),
    },
    {
      field: 'maximumMarks',
      title: 'Total',
      render: (row) => <span className="font-semibold">{row.maximumMarks}</span>,
    },
    {
      field: 'components',
      title: 'Components',
      render: (row) => (
        <span className="text-xs text-slate-600">{row.components.length} configured</span>
      ),
    },
    {
      field: 'status',
      title: 'Status',
      render: (row) => (
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${row.status === 'published' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}
        >
          {row.status}
        </span>
      ),
    },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5 p-2 mb-10"
    >
      <ExaminationWorkflowBar />
      {(policiesError || curriculaError || subjectsError) && (
        <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          Assessment policies or their academic selectors could not be loaded. Editing is disabled
          until the data is available.
        </div>
      )}
      <header className="rounded-3xl bg-white p-5 sm:p-7 space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                Multi-Framework Academic Governance
              </span>
              <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                Continuous Evaluation & Labs
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">Assessment Policy & Governed Gradebook</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              Configure institution-specific assessment structures without hardcoded constraints. Build custom evaluation schemes, capture attendance-verified marks, and freeze official semester ledgers.
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100/80 p-1 shadow-inner shrink-0">
            <button
              type="button"
              onClick={() => setTab('policies')}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                tab === 'policies'
                  ? 'bg-white text-primary shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <span>Policies</span>
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                tab === 'policies' ? 'bg-primary/10 text-primary' : 'bg-slate-200 text-slate-600'
              }`}>
                {policies.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setTab('gradebook')}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                tab === 'gradebook'
                  ? 'bg-white text-primary shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <span>Gradebook</span>
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                tab === 'gradebook' ? 'bg-primary/10 text-primary' : 'bg-slate-200 text-slate-600'
              }`}>
                Live
              </span>
            </button>
          </div>
        </div>

        {/* Informative Universal Governance Workflow Banner */}
        <div className="rounded-xl border border-blue-100 bg-linear-to-r from-blue-50/80 via-white to-slate-50 p-3.5 text-xs text-blue-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-white font-bold text-[10px]">i</span>
            <p>
              <strong>Universal Policy Governance:</strong> Define custom institutional schemes (theory tests, lab evaluations, quizzes, assignments) with your own mark weights and passing formulas. Then record and freeze scores in the <strong>Gradebook</strong>.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 text-[11px] font-semibold text-slate-500">
            <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-emerald-500"></span> Draft</span>
            <span>➔</span>
            <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-blue-500"></span> Submitted</span>
            <span>➔</span>
            <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-indigo-500"></span> Verified</span>
            <span>➔</span>
            <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-slate-900"></span> Frozen</span>
          </div>
        </div>
      </header>
      {tab === 'gradebook' ? (
        <GradebookPanel policies={policies} subjects={subjects} />
      ) : (
        <>
          {/* PolicyEditor renders as a full-screen <dialog> overlay — mount it whenever open */}
          {editorOpen && !curriculaError && !subjectsError && (
            <PolicyEditor
              curricula={curricula}
              subjects={subjects}
              policy={editingPolicy}
              onClose={() => {
                setEditorOpen(false);
                setEditingPolicy(undefined);
              }}
              onSaved={() => {
                setEditorOpen(false);
                setEditingPolicy(undefined);
                mutate();
              }}
            />
          )}
          <section>
            <CustomTable
              title="Configured Assessment Policies"
              description="Manage autonomous, multi-framework continuous evaluation rules, rubrics, and weightage schemes."
              onRefresh={() => mutate()}
              isRefreshing={isLoading}
              customActions={
                canCreate && !policiesError && !curriculaError && !subjectsError ? (
                  <CustomButton
                    variant="primary"
                    startIcon={<Plus size={16} />}
                    onClick={() => {
                      setEditingPolicy(undefined);
                      setEditorOpen(true);
                    }}
                  >
                    New assessment policy
                  </CustomButton>
                ) : undefined
              }
              data={policies as unknown as Record<string, unknown>[]}
              columns={columns as unknown as Column<Record<string, unknown>>[]}
              isLoading={isLoading}
              actions={[
                {
                  // Edit draft — anyone who can create can edit their own draft
                  tooltip: 'Edit draft',
                  icon: <Pencil size={15} />,
                  hidden: (row) =>
                    !canCreate ||
                    (row as unknown as IAssessmentPolicy).status !== 'draft',
                  onClick: (row) => {
                    setEditingPolicy(row as unknown as IAssessmentPolicy);
                    setEditorOpen(true);
                  },
                },
                {
                  // Clone — needs create permission to start a new draft
                  tooltip: 'Clone version',
                  icon: <Copy size={15} />,
                  hidden: () => !canCreate,
                  onClick: (row) => action(row as unknown as IAssessmentPolicy, 'clone'),
                },
                {
                  // Publish — requires approve permission (HOD, Dean Academic)
                  tooltip: 'Publish',
                  icon: <FileCheck2 size={15} />,
                  hidden: (row) =>
                    !canApprove ||
                    (row as unknown as IAssessmentPolicy).status !== 'draft',
                  onClick: (row) => action(row as unknown as IAssessmentPolicy, 'publish'),
                },
                {
                  // Retire — requires approve permission
                  tooltip: 'Retire policy',
                  icon: <Archive size={15} />,
                  hidden: (row) =>
                    !canApprove ||
                    (row as unknown as IAssessmentPolicy).status !== 'published',
                  onClick: (row) => action(row as unknown as IAssessmentPolicy, 'retire'),
                },
              ]}
              options={{ search: true, sorting: true, pagination: true, export: false, refresh: true }}
            />
          </section>
          <div className="grid gap-3.5 sm:grid-cols-3">
            <article className="rounded-xl border border-blue-100 bg-linear-to-b from-blue-50/70 to-white p-4 shadow-xs">
              <div className="flex size-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
                <ShieldCheck size={18} />
              </div>
              <h4 className="mt-3 text-sm font-bold text-slate-900">1. Autonomous Scheme Definition</h4>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Design custom assessment structures (Midterms, Assignments, Practical Labs, Quizzes) with automated scaling rules and passing thresholds.
              </p>
            </article>
            <article className="rounded-xl border border-indigo-100 bg-linear-to-b from-indigo-50/70 to-white p-4 shadow-xs">
              <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
                <FileCheck2 size={18} />
              </div>
              <h4 className="mt-3 text-sm font-bold text-slate-900">2. Versioning & Immutability</h4>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Draft policies can be refined and validated. Once published by the Dean, policies become immutable to guarantee historical academic integrity.
              </p>
            </article>
            <article className="rounded-xl border border-emerald-100 bg-linear-to-b from-emerald-50/70 to-white p-4 shadow-xs">
              <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs">
                <Copy size={18} />
              </div>
              <h4 className="mt-3 text-sm font-bold text-slate-900">3. Continuous Gradebook Scoring</h4>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Switch to the Gradebook tab to schedule lab/theory activities, record attendance-gated marks, and freeze verified semester grades.
              </p>
            </article>
          </div>
        </>
      )}
    </motion.div>
  );
}
