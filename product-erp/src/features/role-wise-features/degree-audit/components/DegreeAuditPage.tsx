/**
 * @file DegreeAuditPage.tsx
 * @description Student and advisor workspace for degree progress, multi-term planning,
 * transfer-credit intake and governed academic-plan review.
 * @module features/role-wise-features/degree-audit
 */
'use client';

import AcademicWorkflowBar from '@/shared/components/AcademicWorkflowBar';
import AsyncSelect from '@/shared/core/AsyncSelect';
import CustomButton from '@/shared/core/CustomButton';
import Empty from '@/shared/core/Empty';
import WorkflowActionDialog from '@/shared/core/WorkflowActionDialog';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { useAuthStore } from '@/shared/store/authStore';
import { CheckCircle2, CircleAlert, GraduationCap, Route, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import { toast } from 'react-toastify';
import type {
  IDegreeAudit,
  IDegreeRequirement,
  ITransferEvaluation,
} from '../types/degree-audit.types';

interface IApiResponse<T> {
  success: boolean;
  data: T;
}

interface IPlanRow {
  subjectId: string;
  plannedSemester: number;
}

interface ITransferRow {
  externalCourseCode: string;
  externalCourseName: string;
  externalCredits: string;
  grade: string;
  targetSubjectId: string;
}

const field =
  'w-full rounded-xl bg-slate-100 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/25';

const blankTransfer = (): ITransferRow => ({
  externalCourseCode: '',
  externalCourseName: '',
  externalCredits: '',
  grade: '',
  targetSubjectId: '',
});

export default function DegreeAuditPage() {
  const activeRole = useAuthStore((state) => state.activeRole);
  const role = activeRole?.baseRole ?? activeRole?.name ?? '';
  const studentMode = role === 'student';
  const facultyMode = role === 'faculty';
  const canReview = [
    'super_admin',
    'admin',
    'principal',
    'dean_academic',
    'hod',
    'examination_cell',
  ].includes(role);
  const [academicYear, setAcademicYear] = useState<string>('');
  const [program, setProgram] = useState<string | null>(null);
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [studentProfileId, setStudentProfileId] = useState<string | null>(null);

  const programParams = useMemo(() => ({ academicYear }), [academicYear]);
  const departmentParams = useMemo(() => ({ academicYear, program }), [academicYear, program]);
  const studentParams = useMemo(
    () => (facultyMode ? { assignedOnly: true } : { departmentId, academicYear, program }),
    [departmentId, academicYear, facultyMode, program],
  );
  const auditUrl = studentMode
    ? 'degree-audit/mine'
    : studentProfileId
      ? `degree-audit/students/${studentProfileId}`
      : null;
  const { data: raw, isLoading, error, mutate } = useSwr<IApiResponse<IDegreeAudit>>(auditUrl);
  const { mutation, isLoading: saving } = useMutation();
  const audit = raw?.data;
  const [planRows, setPlanRows] = useState<IPlanRow[]>([]);
  const [goalGraduationTerm, setGoalGraduationTerm] = useState('');
  const [notes, setNotes] = useState('');
  const [transferOpen, setTransferOpen] = useState(false);
  const [externalInstitution, setExternalInstitution] = useState('');
  const [externalProgramme, setExternalProgramme] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [transferRows, setTransferRows] = useState<ITransferRow[]>([blankTransfer()]);
  const [transferReview, setTransferReview] = useState<{
    evaluation: ITransferEvaluation;
    decision: 'approve_mapped' | 'reject';
  } | null>(null);

  useEffect(() => {
    if (!audit) return;
    const syncDraft = window.setTimeout(() => {
      setGoalGraduationTerm(audit.plan?.goalGraduationTerm ?? '');
      setNotes(audit.plan?.notes ?? '');
      setPlanRows(
        (audit.plan?.items ?? []).map((item) => ({
          subjectId: item.subjectId,
          plannedSemester: item.plannedSemester,
        })),
      );
    }, 0);
    return () => window.clearTimeout(syncDraft);
  }, [audit]);

  const planBySubject = useMemo(
    () => new Map(planRows.map((row) => [row.subjectId, row.plannedSemester])),
    [planRows],
  );

  const setPlannedSemester = (requirement: IDegreeRequirement, semester: number | null) => {
    setPlanRows((current) => {
      const remaining = current.filter((row) => row.subjectId !== requirement.subjectId);
      return semester
        ? [...remaining, { subjectId: requirement.subjectId, plannedSemester: semester }]
        : remaining;
    });
  };

  const savePlan = async (submit: boolean) => {
    if (!audit) return;
    const response = await mutation(`degree-audit/students/${audit.student._id}/plan`, {
      method: 'PUT',
      body: { goalGraduationTerm, notes, items: planRows, submit },
      isAlert: true,
    });
    if ((response?.results as { success?: boolean } | undefined)?.success) {
      toast.success(submit ? 'Academic plan submitted for review' : 'Academic plan saved');
      await mutate();
    }
  };

  const reviewPlan = async (decision: 'approved' | 'returned') => {
    if (!audit) return;
    const response = await mutation(`degree-audit/students/${audit.student._id}/plan/review`, {
      method: 'PATCH',
      body: {
        decision,
        remarks:
          decision === 'returned'
            ? 'Please revise the planned terms based on curriculum availability.'
            : undefined,
      },
      isAlert: true,
    });
    if (response) await mutate();
  };

  const submitTransfer = async () => {
    if (
      !audit ||
      !externalInstitution.trim() ||
      !externalProgramme.trim() ||
      !referenceNumber.trim()
    ) {
      toast.error('Enter the external institution, programme and transcript reference');
      return;
    }
    const courses = transferRows.map((row) => ({
      ...row,
      externalCredits: Number(row.externalCredits),
      targetSubjectId: row.targetSubjectId || undefined,
    }));
    if (
      courses.some(
        (row) =>
          !row.externalCourseCode.trim() ||
          !row.externalCourseName.trim() ||
          !Number.isFinite(row.externalCredits) ||
          row.externalCredits <= 0,
      )
    ) {
      toast.error('Complete every external course with a valid positive credit value');
      return;
    }
    const response = await mutation('degree-audit/transfer-credits', {
      method: 'POST',
      body: {
        studentProfileId: audit.student._id,
        externalInstitution,
        externalProgramme,
        referenceNumber,
        courses,
        submit: true,
      },
      isAlert: true,
    });
    if (response) {
      setTransferOpen(false);
      setExternalInstitution('');
      setExternalProgramme('');
      setReferenceNumber('');
      setTransferRows([blankTransfer()]);
      await mutate();
    }
  };

  const reviewTransfer = async (reason: string) => {
    if (!transferReview || !audit) return;
    const requirementByCode = new Map(
      audit.requirements.map((requirement) => [requirement.subjectCode, requirement]),
    );
    const courses = transferReview.evaluation.courses.map((course) => {
      const target = course.targetSubjectCode
        ? requirementByCode.get(course.targetSubjectCode)
        : undefined;
      const approved = transferReview.decision === 'approve_mapped' && Boolean(target);
      return {
        courseId: course._id,
        decision: approved ? ('approved' as const) : ('rejected' as const),
        approvedCredits: approved
          ? Math.min(course.externalCredits, target?.credits ?? course.externalCredits)
          : 0,
        remarks: approved
          ? `Accepted against ${target?.subjectCode} after academic review.`
          : reason,
      };
    });
    const response = await mutation(
      `degree-audit/transfer-credits/${transferReview.evaluation._id}/review`,
      { method: 'PATCH', body: { remarks: reason, courses }, isAlert: true },
    );
    if (response) {
      setTransferReview(null);
      await mutate();
    }
  };

  return (
    <div className="space-y-5">
      <AcademicWorkflowBar />
      <header className="rounded-2xl bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary">
              Academic completion
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Degree Audit & Planner</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              See completed, transferred, planned and remaining requirements from the authoritative
              curriculum and published results.
            </p>
          </div>
          {audit && (
            <CustomButton variant="primary" onClick={() => setTransferOpen((value) => !value)}>
              Transfer-credit evaluation
            </CustomButton>
          )}
        </div>
        {!studentMode && (
          <div
            className={`mt-5 grid grid-cols-1 gap-4 ${facultyMode ? 'sm:max-w-xl' : 'sm:grid-cols-4'}`}
          >
            {facultyMode ? (
              <AsyncSelect
                type="studentProfiles"
                label="Assigned advisee"
                placeholder="Search your assigned students"
                value={studentProfileId}
                onChange={setStudentProfileId}
                params={studentParams}
                emptyMessage="No active students are assigned to you for degree advising."
              />
            ) : (
              <>
                <AsyncSelect
                  type="academicYears"
                  label="Academic Year"
                  placeholder="Search academic year…"
                  value={academicYear || null}
                  onChange={(value) => {
                    setAcademicYear(value ?? '');
                    setProgram(null);
                    setDepartmentId(null);
                    setStudentProfileId(null);
                  }}
                />
                <AsyncSelect
                  type="programs"
                  label="Program"
                  placeholder="Search Program…"
                  value={program}
                  disabled={!academicYear}
                  onChange={(v) => {
                    setProgram(v);
                    setDepartmentId(null);
                    setStudentProfileId(null);
                  }}
                  params={programParams}
                />
                <AsyncSelect
                  type="departments"
                  label="Branch"
                  placeholder="All Branches"
                  value={departmentId}
                  disabled={!academicYear || !program}
                  onChange={(v) => {
                    setDepartmentId(v);
                    setStudentProfileId(null);
                  }}
                  params={departmentParams}
                />
                <AsyncSelect
                  type="studentProfiles"
                  label="Student"
                  placeholder="Search by name, roll or registration number"
                  value={studentProfileId}
                  disabled={!academicYear || !program || !departmentId}
                  onChange={setStudentProfileId}
                  params={studentParams}
                />
              </>
            )}
          </div>
        )}
      </header>

      {!auditUrl ? (
        <Empty
          title="Select a student"
          subTitle="Choose a student to review degree progress and planning."
        />
      ) : isLoading ? (
        <div className="h-52 animate-pulse rounded-2xl bg-white" />
      ) : error || !audit ? (
        <Empty
          title="Degree audit unavailable"
          subTitle="The student may not have an active curriculum assignment yet. Correct the academic setup and retry."
        />
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Progress"
              value={`${audit.summary.completionPercent}%`}
              icon={<Route />}
            />
            <Metric
              label="Credits earned"
              value={`${audit.summary.creditsEarned}`}
              icon={<GraduationCap />}
            />
            <Metric
              label="Credits remaining"
              value={`${audit.summary.remainingCredits}`}
              icon={<CircleAlert />}
            />
            <Metric
              label="Graduation readiness"
              value={audit.summary.graduationReady ? 'Ready' : `${audit.summary.backlogs} backlogs`}
              icon={<ShieldCheck />}
            />
          </section>

          <section className="rounded-2xl bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">{audit.student.name}</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {audit.student.rollNumber} · {audit.student.program} · Regulation{' '}
                  {audit.curriculum.regulationYear}
                </p>
              </div>
              <span className="rounded-full bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary">
                {audit.summary.completedRequirements}/{audit.summary.totalRequirements} requirements
              </span>
            </div>
            <progress
              className="mt-5 h-2 w-full overflow-hidden rounded-full accent-primary"
              value={audit.summary.completionPercent}
              max={100}
              aria-label={`${audit.summary.completionPercent}% degree completion`}
            />
          </section>

          <AnimatePresence>
            {transferOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div
                  className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setTransferOpen(false)}
                />
                <motion.div
                  initial={{ scale: 0.96, opacity: 0, y: 16 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.96, opacity: 0, y: 16 }}
                  transition={{ duration: 0.2 }}
                  className="relative z-10 flex max-h-[85vh] w-full max-w-4xl flex-col rounded-2xl bg-white "
                >
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                    <h2 className="text-base font-semibold text-slate-800">
                      Request transfer-credit evaluation
                    </h2>
                    <button
                      type="button"
                      onClick={() => setTransferOpen(false)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Body (scrollable) */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    <div className="grid gap-3 md:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          External Institution *
                        </label>
                        <input
                          className={field}
                          value={externalInstitution}
                          onChange={(event) => setExternalInstitution(event.target.value)}
                          placeholder="External institution"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          External Programme *
                        </label>
                        <input
                          className={field}
                          value={externalProgramme}
                          onChange={(event) => setExternalProgramme(event.target.value)}
                          placeholder="External programme"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          Transcript Reference *
                        </label>
                        <input
                          className={field}
                          value={referenceNumber}
                          onChange={(event) => setReferenceNumber(event.target.value)}
                          placeholder="Transcript reference"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="block text-xs font-medium text-slate-600">
                        External Courses
                      </label>
                      {transferRows.map((row, index) => (
                        <div
                          key={index}
                          className="grid gap-2 rounded-xl bg-slate-50 p-3 md:grid-cols-5 relative items-end"
                        >
                          <div>
                            <label className="mb-1 block text-[10px] font-medium text-slate-500">
                              External Code
                            </label>
                            <input
                              className={field}
                              value={row.externalCourseCode}
                              onChange={(event) =>
                                setTransferRows((rows) =>
                                  rows.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? { ...item, externalCourseCode: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                              placeholder="External code"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-[10px] font-medium text-slate-500">
                              External Course
                            </label>
                            <input
                              className={field}
                              value={row.externalCourseName}
                              onChange={(event) =>
                                setTransferRows((rows) =>
                                  rows.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? { ...item, externalCourseName: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                              placeholder="External course"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-[10px] font-medium text-slate-500">
                              Credits
                            </label>
                            <input
                              className={field}
                              type="number"
                              min="0.5"
                              step="0.5"
                              value={row.externalCredits}
                              onChange={(event) =>
                                setTransferRows((rows) =>
                                  rows.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? { ...item, externalCredits: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                              placeholder="Credits"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-[10px] font-medium text-slate-500">
                              Grade
                            </label>
                            <input
                              className={field}
                              value={row.grade}
                              onChange={(event) =>
                                setTransferRows((rows) =>
                                  rows.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? { ...item, grade: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                              placeholder="Grade"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-[10px] font-medium text-slate-500">
                              Target Subject
                            </label>
                            <div className="flex gap-2">
                              <select
                                className={`${field} flex-1`}
                                value={row.targetSubjectId}
                                onChange={(event) =>
                                  setTransferRows((rows) =>
                                    rows.map((item, itemIndex) =>
                                      itemIndex === index
                                        ? { ...item, targetSubjectId: event.target.value }
                                        : item,
                                    ),
                                  )
                                }
                              >
                                <option value="">Mapping pending</option>
                                {audit.requirements.map((requirement) => (
                                  <option key={requirement.subjectId} value={requirement.subjectId}>
                                    {requirement.subjectCode} · {requirement.subjectName}
                                  </option>
                                ))}
                              </select>
                              {transferRows.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setTransferRows((rows) => rows.filter((_, i) => i !== index))
                                  }
                                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-500 hover:bg-red-100"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
                    <CustomButton
                      variant="secondary"
                      onClick={() => setTransferRows((rows) => [...rows, blankTransfer()])}
                    >
                      Add external course
                    </CustomButton>
                    <div className="flex gap-2">
                      <CustomButton variant="cancel" onClick={() => setTransferOpen(false)}>
                        Cancel
                      </CustomButton>
                      <CustomButton variant="primary" onClick={submitTransfer} loading={saving}>
                        Submit evaluation
                      </CustomButton>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {audit.transferEvaluations.length > 0 && (
            <section className="rounded-2xl bg-white p-5">
              <h2 className="text-lg font-semibold text-slate-800">Transfer-credit evaluations</h2>
              <div className="mt-4 space-y-3">
                {audit.transferEvaluations.map((evaluation) => (
                  <article key={evaluation._id} className="rounded-xl bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {evaluation.externalInstitution} · {evaluation.externalProgramme}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Transcript {evaluation.referenceNumber} · {evaluation.courses.length}{' '}
                          courses
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold capitalize text-slate-600">
                        {evaluation.status.replaceAll('_', ' ')}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {evaluation.courses.map((course) => (
                        <div key={course._id} className="rounded-lg bg-white p-3 text-xs">
                          <p className="font-semibold text-slate-800">
                            {course.externalCourseCode} · {course.externalCourseName}
                          </p>
                          <p className="mt-1 text-slate-500">
                            {course.externalCredits} external credits →{' '}
                            {course.targetSubjectCode ?? 'mapping pending'}
                          </p>
                        </div>
                      ))}
                    </div>
                    {canReview && evaluation.status === 'submitted' && (
                      <div className="mt-3 flex flex-wrap justify-end gap-2">
                        <CustomButton
                          variant="tertiary"
                          onClick={() => setTransferReview({ evaluation, decision: 'reject' })}
                        >
                          Reject evaluation
                        </CustomButton>
                        <CustomButton
                          onClick={() =>
                            setTransferReview({ evaluation, decision: 'approve_mapped' })
                          }
                        >
                          Approve mapped courses
                        </CustomButton>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-2xl bg-white p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className={field}
                value={goalGraduationTerm}
                onChange={(event) => setGoalGraduationTerm(event.target.value)}
                placeholder="Goal graduation term, e.g. Spring 2030"
              />
              <input
                className={field}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Planning notes"
              />
            </div>
            <div className="mt-5 space-y-2">
              {audit.requirements.map((requirement) => {
                const completed = ['completed', 'transferred'].includes(requirement.status);
                return (
                  <div
                    key={requirement.subjectId}
                    className="grid items-center gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_auto_auto]"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {requirement.subjectCode} · {requirement.subjectName}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {requirement.credits} credits · Curriculum semester {requirement.semester}
                        {requirement.electiveGroup ? ` · ${requirement.electiveGroup}` : ''}
                      </p>
                    </div>
                    <span
                      className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${completed ? 'bg-emerald-50 text-emerald-700' : requirement.status === 'planned' ? 'bg-blue-50 text-primary' : 'bg-amber-50 text-amber-700'}`}
                    >
                      {completed && <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />}
                      {requirement.status}
                    </span>
                    {completed ? (
                      <span className="text-xs text-slate-500">
                        {requirement.grade ?? `${requirement.completedCredits} credits`}
                      </span>
                    ) : (
                      <select
                        className="rounded-lg bg-white px-3 py-2 text-xs"
                        value={planBySubject.get(requirement.subjectId) ?? ''}
                        onChange={(event) =>
                          setPlannedSemester(
                            requirement,
                            event.target.value ? Number(event.target.value) : null,
                          )
                        }
                      >
                        <option value="">Not planned</option>
                        {Array.from(
                          { length: audit.curriculum.totalSemesters },
                          (_, index) => index + 1,
                        ).map((semester) => (
                          <option key={semester} value={semester}>
                            Plan for semester {semester}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <CustomButton
                variant="tertiary"
                onClick={() => void savePlan(false)}
                loading={saving}
              >
                Save draft
              </CustomButton>
              <CustomButton onClick={() => void savePlan(true)} loading={saving}>
                Submit plan
              </CustomButton>
              {canReview && audit.plan?.status === 'submitted' && (
                <>
                  <CustomButton
                    variant="tertiary"
                    onClick={() => void reviewPlan('returned')}
                    loading={saving}
                  >
                    Return for revision
                  </CustomButton>
                  <CustomButton onClick={() => void reviewPlan('approved')} loading={saving}>
                    Approve plan
                  </CustomButton>
                </>
              )}
            </div>
          </section>
        </>
      )}
      <WorkflowActionDialog
        open={Boolean(transferReview)}
        title={
          transferReview?.decision === 'approve_mapped'
            ? 'Approve mapped transfer credits'
            : 'Reject transfer-credit evaluation'
        }
        description={
          transferReview?.decision === 'approve_mapped'
            ? 'Mapped courses will receive the lower of external and curriculum credits. Unmapped courses will be rejected.'
            : 'Every course in this evaluation will be rejected with the recorded reason.'
        }
        confirmLabel={transferReview?.decision === 'approve_mapped' ? 'Confirm review' : 'Reject'}
        reasonLabel="Academic review rationale"
        loading={saving}
        onClose={() => setTransferReview(null)}
        onConfirm={async ({ reason }) => reviewTransfer(reason)}
      />
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
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
