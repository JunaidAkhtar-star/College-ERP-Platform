/** @file PolicyEditor.tsx @description Full-screen guided dialog for creating or editing a versioned assessment policy draft. @module features/assessment-policy */
'use client';
import { useEffect, useRef } from 'react';
import { useFormik } from 'formik';
import { AlertCircle, BookOpen, GraduationCap, Info, ListChecks, Plus, Save, X } from 'lucide-react';
import { toast } from 'react-toastify';
import CustomButton from '@/shared/core/CustomButton';
import useMutation from '@/shared/hooks/useMutation';
import { assessmentPolicySchema } from '../validations/assessment-policy.schema';
import type {
  IAssessmentComponent,
  IAssessmentPolicy,
  ICurriculum,
  ISubject,
} from '../types/assessment-policy.types';
import AssessmentComponentEditor from './AssessmentComponentEditor';
import GradeScaleEditor from './GradeScaleEditor';

// ─── Style tokens ─────────────────────────────────────────────────────────────
const inp =
  'w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary';
const lbl = 'mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600';
const hint = 'mt-1 text-[11px] leading-4 text-slate-400';
const err = 'mt-1 text-[11px] text-rose-600 font-medium';

// ─── Section heading ──────────────────────────────────────────────────────────
function SH({
  icon: Icon,
  step,
  title,
  description,
}: {
  icon: React.ElementType;
  step: number;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-slate-200 pb-3.5">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-white font-bold text-xs shadow-xs">
        {step}
      </span>
      <div>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <p className="text-sm font-bold text-slate-900">{title}</p>
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{description}</p>
      </div>
    </div>
  );
}

// ─── Empty component factory ──────────────────────────────────────────────────
const emptyComponent = (order: number): IAssessmentComponent => ({
  key: '', name: '', category: 'internal', source: 'manual', deliveryMode: 'not_applicable',
  maximumMarks: 1, minimumPassMarks: 0, attemptCount: 1, method: 'sum', rounding: 'none',
  attendanceRequired: false, allowMakeup: false, isRequired: true, displayOrder: order,
});

// ─── Props ────────────────────────────────────────────────────────────────────
interface IProps {
  curricula: ICurriculum[];
  subjects: ISubject[];
  policy?: IAssessmentPolicy;
  onClose: () => void;
  onSaved: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function PolicyEditor({ curricula, subjects, policy, onClose, onSaved }: IProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { mutation, isLoading } = useMutation();

  useEffect(() => {
    const el = dialogRef.current;
    if (el && !el.open) el.showModal();
    // Lock body scroll while dialog is open
    document.documentElement.style.overflow = 'hidden';
    return () => {
      el?.close();
      document.documentElement.style.overflow = '';
    };
  }, []);

  const onBackdrop = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) onClose();
  };

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: policy
      ? {
          ...policy,
          curriculumId: policy.curriculumId ?? '',
          program: policy.program ?? '',
          regulationYear: policy.regulationYear ?? '',
          semester: policy.semester?.toString() ?? '',
          subjectId: policy.subjectId ?? '',
          subjectType: policy.subjectType ?? '',
          effectiveFrom: policy.effectiveFrom.slice(0, 10),
        }
      : {
          name: '', code: '', version: 1, curriculumId: '', program: '', regulationYear: '',
          semester: '', subjectId: '', subjectType: '',
          effectiveFrom: new Date().toISOString().slice(0, 10),
          maximumMarks: 1, resultTarget: 'internal' as const,
          minimumTotalMarks: 0, gradeScale: [], components: [emptyComponent(1)],
        },
    validationSchema: assessmentPolicySchema,
    onSubmit: async (values) => {
      const components = values.components.map((c, i) => ({ ...c, displayOrder: i + 1 }));
      const maximumMarks = components.reduce((s, c) => s + Number(c.maximumMarks), 0);
      const response = await mutation(
        policy ? `assessment-policy/${policy._id}` : 'assessment-policy',
        {
          method: policy ? 'PUT' : 'POST',
          body: {
            ...values,
            semester: values.semester ? Number(values.semester) : undefined,
            curriculumId: values.curriculumId || undefined,
            subjectId: values.subjectId || undefined,
            maximumMarks,
            components,
          },
        },
      );
      if ((response as { results?: { success?: boolean } })?.results?.success) {
        toast.success(policy ? 'Assessment policy draft updated' : 'Assessment policy draft created');
        onSaved();
      }
    },
  });

  const updateComponent = (index: number, value: IAssessmentComponent) => {
    const next = [...formik.values.components];
    next[index] = value;
    formik.setFieldValue('components', next);
  };
  const removeComponent = (index: number) =>
    formik.setFieldValue('components', formik.values.components.filter((_, i) => i !== index));

  const total = formik.values.components.reduce((s, c) => s + Number(c.maximumMarks || 0), 0);

  return (
    <dialog
      ref={dialogRef}
      onClick={onBackdrop}
      className="fixed inset-0 m-0 h-dvh w-dvw max-h-dvh max-w-dvw overflow-hidden bg-transparent p-0 backdrop:bg-slate-900/60 backdrop:backdrop-blur-sm"
    >
      <div className="flex h-full flex-col bg-slate-50">

        {/* ── Sticky header ─────────────────────────────────────────────── */}
        <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary-50">
              <GraduationCap className="h-5 w-5 text-primary" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
                {policy ? 'Edit draft policy' : 'New versioned policy'}
              </p>
              <h2 className="text-base font-bold text-slate-900">Assessment policy configuration</h2>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={20} />
          </button>
        </header>

        {/* ── Form (scroll area + sticky footer) ───────────────────────── */}
        <form onSubmit={formik.handleSubmit} className="flex flex-1 flex-col overflow-hidden">

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8">
            <div className="mx-auto max-w-5xl space-y-8">

              {/* Section 1 – Identity */}
              <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
                <SH
                  step={1}
                  icon={BookOpen}
                  title="Policy Identity & Versioning"
                  description="Name and version this policy so it can be referenced, tracked, and audited over time."
                />
                <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className={lbl}>Policy name *</label>
                    <input
                      name="name"
                      className={`${inp} ${formik.touched.name && formik.errors.name ? 'border-rose-400' : ''}`}
                      placeholder="e.g. B.Tech CSE Internal Assessment"
                      value={formik.values.name}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                    />
                    {formik.touched.name && formik.errors.name
                      ? <p className={err}>{formik.errors.name as string}</p>
                      : <p className={hint}>Descriptive name shown to faculty and administrators.</p>}
                  </div>
                  <div>
                    <label className={lbl}>Unique code *</label>
                    <input
                      name="code"
                      className={`${inp} ${formik.touched.code && formik.errors.code ? 'border-rose-400' : ''}`}
                      placeholder="e.g. BTECH-CSE-IA-R22"
                      value={formik.values.code}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                    />
                    {formik.touched.code && formik.errors.code
                      ? <p className={err}>{formik.errors.code as string}</p>
                      : <p className={hint}>Short code used to link this policy to grade templates.</p>}
                  </div>
                  <div>
                    <label className={lbl}>Version</label>
                    <input name="version" type="number" min="1" className={inp}
                      value={formik.values.version} onChange={formik.handleChange} />
                    <p className={hint}>Increment when creating a revised edition of an existing policy.</p>
                  </div>
                  <div>
                    <label className={lbl}>Effective from *</label>
                    <input name="effectiveFrom" type="date" className={inp}
                      value={formik.values.effectiveFrom} onChange={formik.handleChange} />
                    <p className={hint}>Date from which this policy governs new grade entries.</p>
                  </div>
                </div>
              </section>

              {/* Section 2 – Scope */}
              <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
                <SH
                  step={2}
                  icon={ListChecks}
                  title="Scope & Institutional Applicability"
                  description="Narrow this policy to a specific curriculum, semester, or subject. Leave fields empty to apply institution-wide."
                />
                <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <label className={lbl}>Curriculum</label>
                    <select
                      name="curriculumId"
                      className={inp}
                      value={formik.values.curriculumId}
                      onChange={(e) => {
                        formik.handleChange(e);
                        const sel = curricula.find((c) => c._id === e.target.value);
                        formik.setFieldValue('program', sel?.program ?? '');
                        formik.setFieldValue('regulationYear', sel?.regulationYear ?? '');
                      }}
                    >
                      <option value="">All curricula (institution-wide)</option>
                      {curricula.map((c) => (
                        <option key={c._id} value={c._id}>{c.program} · {c.regulationYear}</option>
                      ))}
                    </select>
                    <p className={hint}>Restricts the policy to one program regulation. Optional.</p>
                  </div>
                  {formik.values.curriculumId && (
                    <>
                      <div>
                        <label className={lbl}>Program</label>
                        <input className={`${inp} bg-slate-50`} value={formik.values.program} readOnly />
                        <p className={hint}>Auto-filled from the selected curriculum.</p>
                      </div>
                      <div>
                        <label className={lbl}>Regulation year</label>
                        <input className={`${inp} bg-slate-50`} value={formik.values.regulationYear} readOnly />
                        <p className={hint}>Auto-filled from the selected curriculum.</p>
                      </div>
                    </>
                  )}
                  <div>
                    <label className={lbl}>Semester / term</label>
                    <input name="semester" type="number" min="1" className={inp}
                      placeholder="e.g. 3" value={formik.values.semester} onChange={formik.handleChange} />
                    <p className={hint}>Leave blank to apply to all semesters.</p>
                  </div>
                  <div>
                    <label className={lbl}>Subject</label>
                    <select name="subjectId" className={inp} value={formik.values.subjectId}
                      onChange={(e) => {
                        formik.handleChange(e);
                        const sel = subjects.find((s) => s._id === e.target.value);
                        formik.setFieldValue('subjectType', sel?.type ?? '');
                      }}
                    >
                      <option value="">Any matching subject</option>
                      {subjects.map((s) => (
                        <option key={s._id} value={s._id}>{s.code} · {s.name}</option>
                      ))}
                    </select>
                    <p className={hint}>Pin to a single subject. Usually left blank for shared policies.</p>
                  </div>
                  <div>
                    <label className={lbl}>Result contribution</label>
                    <select name="resultTarget" className={inp}
                      value={formik.values.resultTarget} onChange={formik.handleChange}>
                      <option value="internal">Internal / continuous assessment</option>
                      <option value="external">External assessment</option>
                      <option value="standalone">Complete standalone subject result</option>
                    </select>
                    <p className={hint}>Determines how this policy feeds into the final subject result.</p>
                  </div>
                  <div>
                    <label className={lbl}>Overall pass marks</label>
                    <input name="minimumTotalMarks" type="number" min="0" max={total} step="0.01"
                      className={inp} placeholder="e.g. 18"
                      value={formik.values.minimumTotalMarks} onChange={formik.handleChange} />
                    <p className={hint}>Minimum total a student must score across all components to pass.</p>
                  </div>
                </div>
              </section>

              {/* Section 3 – Components */}
              <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <SH
                    step={3}
                    icon={ListChecks}
                    title="Assessment Components & Weightage"
                    description="Add each assessable part — tests, quizzes, lab records, attendance — and configure how each is scored and combined."
                  />
                  <div className="shrink-0 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Total marks ceiling</p>
                    <p className="text-xl font-black text-slate-900">{total}</p>
                  </div>
                </div>

                {formik.values.components.length === 0 && (
                  <div className="mt-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                    <p className="text-xs text-amber-700">Add at least one component before saving.</p>
                  </div>
                )}

                <div className="mt-4 space-y-3">
                  {formik.values.components.map((component, index) => (
                    <AssessmentComponentEditor
                      key={`${index}-${component.key}`}
                      value={component}
                      index={index}
                      onChange={updateComponent}
                      onRemove={removeComponent}
                    />
                  ))}
                </div>

                {typeof formik.errors.components === 'string' && (
                  <p className="mt-2 text-sm text-rose-600">{formik.errors.components}</p>
                )}

                <div className="mt-4">
                  <CustomButton
                    variant="secondary" size="small" fullWidth={false}
                    startIcon={<Plus size={14} />}
                    onClick={() =>
                      formik.setFieldValue('components', [
                        ...formik.values.components,
                        emptyComponent(formik.values.components.length + 1),
                      ])
                    }
                  >
                    Add assessment component
                  </CustomButton>
                </div>
              </section>

              {/* Section 4 – Grade scale */}
              <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
                <SH
                  step={4}
                  icon={Info}
                  title="Grade Scale & Letter Bands (Optional)"
                  description="Define letter-grade bands (O, A+, A, B, etc.). If left empty, raw numeric scores are reported."
                />
                <div className="mt-5">
                  <GradeScaleEditor
                    value={formik.values.gradeScale}
                    onChange={(value) => formik.setFieldValue('gradeScale', value)}
                  />
                </div>
              </section>

              <div className="h-4" />
            </div>
          </div>

          {/* ── Sticky footer ─────────────────────────────────────────────── */}
          <footer className="shrink-0 border-t border-slate-200 bg-white px-5 py-4 sm:px-8">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
              <p className="text-xs text-slate-500">
                Saving creates a <span className="font-semibold text-slate-700">draft</span>.
                Publish to make it active — published policies are immutable.
              </p>
              <div className="flex gap-3">
                <CustomButton variant="cancel" size="sm" fullWidth={false} onClick={onClose}>
                  Cancel
                </CustomButton>
                <CustomButton type="submit" loading={isLoading} fullWidth={false} startIcon={<Save size={16} />}>
                  Save draft
                </CustomButton>
              </div>
            </div>
          </footer>
        </form>
      </div>
    </dialog>
  );
}
