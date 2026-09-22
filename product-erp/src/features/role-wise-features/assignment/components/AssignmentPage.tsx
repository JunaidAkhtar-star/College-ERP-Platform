'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import {
  CheckCircle2,
  ClipboardList,
  Edit2,
  Eye,
  FileText,
  Lock,
  Plus,
  Search,
  Send,
  Award,
  Building2,
  GraduationCap,
  Upload,
} from 'lucide-react';
import { AnimatePresence } from '@/shared/utils/motion';
import AsyncSelect from '@/shared/core/AsyncSelect';
import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { Action, Column } from '@/shared/core/CustomTable';
import DataViewSwitcher from '@/shared/core/DataViewSwitcher';
import FileViewer, { IViewerFile } from '@/shared/core/FileViewer';
import InlineFileUpload from '@/shared/core/InlineFileUpload';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import { useAuthStore } from '@/shared/store/authStore';
import UseProtectedRoutes from '@/shared/hooks/UseProtectedRoutes';

type TAssignmentStatus = 'draft' | 'published' | 'closed' | 'evaluated';
type TAssignmentWorkspace = 'mine' | 'department';

interface IEntityRef {
  _id: string;
  name?: string;
  code?: string;
}

interface ISubmission {
  studentId: string;
  studentName?: string;
  submittedAt: string;
  fileUrl?: string;
  textContent?: string;
  marks?: number;
  rawMarks?: number;
  grade?: string;
  feedback?: string;
  isLate: boolean;
}

interface IAssignment {
  _id: string;
  title: string;
  description: string;
  sectionId: string | IEntityRef;
  subjectId: string | IEntityRef;
  subjectCode: string;
  subjectName?: string;
  program: string;
  semester: number;
  section: string;
  academicYear: string;
  dueDate: string;
  maxMarks: number;
  allowLateSubmission: boolean;
  latePenaltyPercent: number;
  attachmentUrl?: string;
  submissions?: ISubmission[];
  totalSubmissions: number;
  mySubmission?: ISubmission;
  status: TAssignmentStatus;
  isActive: boolean;
  createdAt: string;
  [key: string]: unknown;
}

interface IApiResponse<T> {
  success: boolean;
  data: T;
  total?: number;
  page?: number;
  limit?: number;
  pages?: number;
  statusCounts?: Partial<Record<TAssignmentStatus, number>>;
}

const STAFF_ROLES = ['super_admin', 'admin', 'principal', 'dean_academic', 'hod', 'faculty'];
const inputClass =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20';

const statusStyle: Record<TAssignmentStatus, string> = {
  draft: 'bg-amber-50 text-amber-700',
  published: 'bg-green-50 text-green-700',
  closed: 'bg-slate-100 text-slate-600',
  evaluated: 'bg-blue-50 text-blue-700',
};

function idOf(value: string | IEntityRef | undefined) {
  return typeof value === 'string' ? value : (value?._id ?? '');
}

function dateTimeInput(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: TAssignmentStatus }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusStyle[status]}`}
    >
      {status}
    </span>
  );
}

function useUpload() {
  const { mutation } = useMutation();
  return async (file: File): Promise<IViewerFile | null> => {
    const body = new FormData();
    body.append('file', file);
    const response = await mutation('upload', {
      method: 'POST',
      body,
      isFormData: true,
      dedupe: false,
    });
    const uploaded = response?.results?.data as
      | { url?: string; filename?: string; publicId?: string }
      | undefined;
    return uploaded?.url ? { url: uploaded.url, name: uploaded.filename ?? file.name } : null;
  };
}

function AssignmentForm({
  assignment,
  onClose,
  onSaved,
}: {
  assignment?: IAssignment | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mutation, isLoading } = useMutation();
  const upload = useUpload();
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, []);
  const [files, setFiles] = useState<IViewerFile[]>(
    assignment?.attachmentUrl
      ? [{ url: assignment.attachmentUrl, name: `${assignment.title} attachment` }]
      : [],
  );
  const formik = useFormik({
    initialValues: {
      title: assignment?.title ?? '',
      description: assignment?.description ?? '',
      sectionId: idOf(assignment?.sectionId),
      subjectId: idOf(assignment?.subjectId),
      dueDate: dateTimeInput(assignment?.dueDate),
      maxMarks: assignment?.maxMarks ?? 100,
      allowLateSubmission: assignment?.allowLateSubmission ?? false,
      latePenaltyPercent: assignment?.latePenaltyPercent ?? 0,
      attachmentUrl: assignment?.attachmentUrl ?? '',
    },
    validationSchema: Yup.object({
      title: Yup.string().trim().min(3).max(200).required('Enter an assignment title'),
      description: Yup.string().trim().min(1).max(20000).required('Enter instructions'),
      sectionId: Yup.string().required('Select a class'),
      subjectId: Yup.string().required('Select a subject'),
      dueDate: Yup.date()
        .min(new Date(), 'Due time must be in the future')
        .required('Select a due date and time'),
      maxMarks: Yup.number().min(1).max(1000).required('Enter maximum marks'),
      latePenaltyPercent: Yup.number().when('allowLateSubmission', {
        is: true,
        then: (schema) => schema.min(0).max(100).required('Enter the late penalty'),
        otherwise: (schema) => schema.default(0),
      }),
    }),
    onSubmit: async (values) => {
      const editing = Boolean(assignment?._id);
      const response = await mutation(editing ? `assignment/${assignment!._id}` : 'assignment', {
        method: editing ? 'PUT' : 'POST',
        body: {
          ...values,
          dueDate: new Date(values.dueDate).toISOString(),
          latePenaltyPercent: values.allowLateSubmission ? values.latePenaltyPercent : 0,
        },
      });
      if (!response?.results?.success) return;
      toast.success(editing ? 'Assignment updated' : 'Assignment draft created');
      onSaved();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-slate-200/80"
        onClick={onClose}
      />
      <div className="relative flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white ">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {assignment ? 'Edit Assignment Draft' : 'New Assignment'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Prepare the brief, select its academic audience and define submission rules.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-xl text-slate-600 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close assignment form"
          >
            ✕
          </button>
        </div>
        <form onSubmit={formik.handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="overscroll-contain space-y-5 overflow-y-auto bg-slate-50/50 p-5 sm:p-6">
            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4">
              <p className="text-sm font-semibold text-blue-900">How assignment publishing works</p>
              <p className="mt-1 text-xs leading-5 text-blue-700">
                Saving creates a private draft. Review it from the assignment list, then publish it
                when students should receive access. Class and subject cannot be guessed—select the
                exact academic records below.
              </p>
            </div>

            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Assignment Brief</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Give students a clear title and complete working instructions.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Title *</label>
                <input
                  name="title"
                  value={formik.values.title}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  className={inputClass}
                />
                {formik.touched.title && formik.errors.title && (
                  <p className="mt-1 text-xs text-red-500">{formik.errors.title}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Instructions *</label>
                <textarea
                  name="description"
                  rows={4}
                  value={formik.values.description}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  className={inputClass}
                />
                {formik.touched.description && formik.errors.description && (
                  <p className="mt-1 text-xs text-red-500">{formik.errors.description}</p>
                )}
              </div>
            </section>

            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Academic Assignment</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Choose the class first; the subject list is then limited to that section.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <AsyncSelect
                  type="sections"
                  label="Class / Section"
                  required
                  value={formik.values.sectionId}
                  params={{ assignedOnly: true }}
                  onChange={(value) => {
                    void formik.setFieldValue('sectionId', value ?? '');
                    void formik.setFieldValue('subjectId', '');
                  }}
                  error={formik.touched.sectionId ? formik.errors.sectionId : undefined}
                  placeholder="Search programme, semester or section"
                />
                <AsyncSelect
                  type="subjects"
                  label="Subject"
                  required
                  value={formik.values.subjectId}
                  params={{ sectionId: formik.values.sectionId, assignedOnly: true }}
                  disabled={!formik.values.sectionId}
                  onChange={(value) => void formik.setFieldValue('subjectId', value ?? '')}
                  error={formik.touched.subjectId ? formik.errors.subjectId : undefined}
                  placeholder="Search subject name or code"
                  emptyMessage="No eligible subjects found. Add subjects to this semester’s curriculum and publish the faculty timetable assignment."
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium">Due date and time *</label>
                  <input
                    type="datetime-local"
                    name="dueDate"
                    value={formik.values.dueDate}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    className={inputClass}
                  />
                  {formik.touched.dueDate && formik.errors.dueDate && (
                    <p className="mt-1 text-xs text-red-500">{String(formik.errors.dueDate)}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">Maximum marks *</label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    name="maxMarks"
                    value={formik.values.maxMarks}
                    onChange={formik.handleChange}
                    className={inputClass}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Submission Policy</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Decide whether work submitted after the deadline remains acceptable.
                </p>
              </div>
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                <input
                  type="checkbox"
                  name="allowLateSubmission"
                  checked={formik.values.allowLateSubmission}
                  onChange={formik.handleChange}
                />
                Accept late submissions
              </label>
              {formik.values.allowLateSubmission && (
                <div>
                  <label className="mb-1 block text-xs font-medium">
                    Late penalty percentage *
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    name="latePenaltyPercent"
                    value={formik.values.latePenaltyPercent}
                    onChange={formik.handleChange}
                    className={inputClass}
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    The server deducts this percentage when grading a late submission.
                  </p>
                </div>
              )}
            </section>

            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Reference Material</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Optionally attach one brief, question sheet or supporting image.
                </p>
              </div>
              <InlineFileUpload
                label="Reference attachment"
                files={files}
                onUpload={async (file) => {
                  const uploaded = await upload(file);
                  if (!uploaded) return false;
                  setFiles([uploaded]);
                  await formik.setFieldValue('attachmentUrl', uploaded.url);
                  return true;
                }}
                onRemove={async () => {
                  setFiles([]);
                  await formik.setFieldValue('attachmentUrl', '');
                }}
                hint="Optional assignment brief in PDF or image format"
              />
            </section>
          </div>
          <div className="flex shrink-0 justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4 ">
            <CustomButton type="button" variant="tertiary" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton type="submit" variant="primary" loading={isLoading}>
              Save draft
            </CustomButton>
          </div>
        </form>
      </div>
    </div>
  );
}

function SubmissionForm({
  assignment,
  onClose,
  onSaved,
}: {
  assignment: IAssignment;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mutation, isLoading } = useMutation();
  const upload = useUpload();
  const [files, setFiles] = useState<IViewerFile[]>([]);
  const [text, setText] = useState('');
  const submit = async () => {
    if (!text.trim() && !files[0]?.url) {
      toast.error('Write an answer or attach your work');
      return;
    }
    const response = await mutation(`assignment/${assignment._id}/submit`, {
      method: 'POST',
      body: { textContent: text.trim() || undefined, fileUrl: files[0]?.url },
    });
    if (!response?.results?.success) return;
    toast.success('Assignment submitted successfully');
    onSaved();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-slate-200/80"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6">
        <h2 className="text-lg font-bold">Submit assignment</h2>
        <p className="mt-1 text-sm text-slate-500">
          {assignment.title} · due {formatDate(assignment.dueDate)}
        </p>
        {new Date() > new Date(assignment.dueDate) && (
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
            This is a late submission
            {assignment.allowLateSubmission
              ? `; a ${assignment.latePenaltyPercent}% grading penalty applies.`
              : ' and the deadline is closed.'}
          </p>
        )}
        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium">Answer / notes</label>
            <textarea
              rows={6}
              value={text}
              onChange={(event) => setText(event.target.value)}
              className={inputClass}
              placeholder="Explain your work or add a note for the faculty member"
            />
          </div>
          <InlineFileUpload
            label="Your work"
            files={files}
            onUpload={async (file) => {
              const uploaded = await upload(file);
              if (!uploaded) return false;
              setFiles([uploaded]);
              return true;
            }}
            onRemove={async () => setFiles([])}
            hint="PDF or image · maximum 5 MB"
          />
          <div className="flex justify-end gap-3">
            <CustomButton variant="tertiary" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton
              variant="primary"
              onClick={() => void submit()}
              loading={isLoading}
              disabled={
                !assignment.allowLateSubmission && new Date() > new Date(assignment.dueDate)
              }
            >
              <Send className="h-4 w-4" />
              Submit once
            </CustomButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function GradeForm({
  assignment,
  submission,
  onClose,
  onSaved,
}: {
  assignment: IAssignment;
  submission: ISubmission;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mutation, isLoading } = useMutation();
  const formik = useFormik({
    initialValues: {
      marks: submission.rawMarks ?? submission.marks ?? 0,
      feedback: submission.feedback ?? '',
    },
    validationSchema: Yup.object({
      marks: Yup.number().min(0).max(assignment.maxMarks).required(),
      feedback: Yup.string().max(5000),
    }),
    onSubmit: async (values) => {
      const response = await mutation(
        `assignment/${assignment._id}/grade/${submission.studentId}`,
        { method: 'PUT', body: values },
      );
      if (!response?.results?.success) return;
      toast.success('Grade saved with audit history');
      onSaved();
    },
  });
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-slate-200/80"
        onClick={onClose}
      />
      <form
        onSubmit={formik.handleSubmit}
        className="relative w-full max-w-md space-y-4 rounded-2xl bg-white p-6"
      >
        <div>
          <h2 className="text-lg font-bold">Grade submission</h2>
          <p className="text-xs text-slate-500">
            {submission.studentName ?? 'Student'}
            {submission.isLate ? ` · ${assignment.latePenaltyPercent}% late penalty` : ''}
          </p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">
            Raw marks out of {assignment.maxMarks} *
          </label>
          <input
            type="number"
            name="marks"
            min={0}
            max={assignment.maxMarks}
            step="0.01"
            value={formik.values.marks}
            onChange={formik.handleChange}
            className={inputClass}
          />
          {formik.touched.marks && formik.errors.marks && (
            <p className="mt-1 text-xs text-red-500">{formik.errors.marks}</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Feedback</label>
          <textarea
            name="feedback"
            rows={4}
            value={formik.values.feedback}
            onChange={formik.handleChange}
            className={inputClass}
          />
        </div>
        <div className="flex justify-end gap-3">
          <CustomButton variant="tertiary" onClick={onClose}>
            Cancel
          </CustomButton>
          <CustomButton type="submit" variant="primary" loading={isLoading}>
            Save grade
          </CustomButton>
        </div>
      </form>
    </div>
  );
}

function SubmissionsDrawer({
  assignment,
  onClose,
  onGrade,
}: {
  assignment: IAssignment;
  onClose: () => void;
  onGrade?: (submission: ISubmission) => void;
}) {
  const { data, isLoading } = useSwr<IApiResponse<IAssignment>>(`assignment/${assignment._id}`);
  const submissions = data?.data.submissions ?? [];
  const [viewerFiles, setViewerFiles] = useState<IViewerFile[]>([]);
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-slate-200/80"
        onClick={onClose}
      />
      <div className="relative h-full w-full max-w-xl overflow-y-auto bg-white p-5">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="font-bold">{assignment.title}</h2>
            <p className="text-xs text-slate-500">{submissions.length} submissions</p>
          </div>
          <button type="button" onClick={onClose}>
            ✕
          </button>
        </div>
        {isLoading ? (
          <p className="text-sm text-slate-600">Loading submissions…</p>
        ) : submissions.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-600">
            No submissions yet
          </p>
        ) : (
          <div className="space-y-3">
            {submissions.map((submission) => (
              <div key={submission.studentId} className="rounded-xl bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{submission.studentName ?? 'Student'}</p>
                    <p className="text-xs text-slate-500">
                      {formatDate(submission.submittedAt)}
                      {submission.isLate ? ' · Late' : ''}
                    </p>
                  </div>
                  {submission.marks !== undefined && (
                    <span className="text-sm font-bold text-primary">
                      {submission.marks}/{assignment.maxMarks} · {submission.grade}
                    </span>
                  )}
                </div>
                {submission.textContent && (
                  <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
                    {submission.textContent}
                  </p>
                )}
                <div className="mt-3 flex justify-end gap-2">
                  {submission.fileUrl && (
                    <CustomButton
                      variant="tertiary"
                      onClick={() =>
                        setViewerFiles([
                          {
                            url: submission.fileUrl!,
                            name: `${submission.studentName ?? 'Student'} submission`,
                          },
                        ])
                      }
                    >
                      <FileText className="h-4 w-4" />
                      View work
                    </CustomButton>
                  )}
                  {onGrade && (
                    <CustomButton variant="secondary" onClick={() => onGrade(submission)}>
                      <Award className="h-4 w-4" />
                      {submission.marks === undefined ? 'Grade' : 'Regrade'}
                    </CustomButton>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <FileViewer
          open={viewerFiles.length > 0}
          onClose={() => setViewerFiles([])}
          files={viewerFiles}
          title="Assignment submission"
        />
      </div>
    </div>
  );
}

function StudentCard({
  assignment,
  onSubmit,
  onViewAttachment,
}: {
  assignment: IAssignment;
  onSubmit: () => void;
  onViewAttachment: () => void;
}) {
  const submitted = assignment.mySubmission;
  const overdue = new Date() > new Date(assignment.dueDate);
  const canSubmit =
    assignment.status === 'published' && (!overdue || assignment.allowLateSubmission);
  return (
    <div className="flex flex-col rounded-2xl bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-900">{assignment.title}</h3>
          <p className="text-xs text-slate-500">
            {assignment.subjectCode} · Sem {assignment.semester} · {assignment.section}
          </p>
        </div>
        <StatusBadge status={assignment.status} />
      </div>
      <p className="mt-3 line-clamp-3 text-sm text-slate-600">{assignment.description}</p>
      <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
        <p>Due {formatDate(assignment.dueDate)}</p>
        <p className="mt-1">
          Maximum {assignment.maxMarks} marks
          {assignment.allowLateSubmission
            ? ` · Late penalty ${assignment.latePenaltyPercent}%`
            : ''}
        </p>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {assignment.attachmentUrl && (
          <CustomButton variant="tertiary" onClick={onViewAttachment}>
            <Eye className="h-4 w-4" />
            Brief
          </CustomButton>
        )}
        {submitted ? (
          <div className="flex items-center gap-2 text-sm font-semibold text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            Submitted
            {submitted.marks !== undefined && (
              <span className="rounded-full bg-primary-50 px-2 py-1 text-primary">
                {submitted.marks}/{assignment.maxMarks} · {submitted.grade}
              </span>
            )}
          </div>
        ) : canSubmit ? (
          <CustomButton variant="primary" onClick={onSubmit}>
            <Upload className="h-4 w-4" />
            Submit work
          </CustomButton>
        ) : (
          <span className="text-xs font-semibold text-slate-600">Submission closed</span>
        )}
      </div>
    </div>
  );
}

function AssignmentPage() {
  const activeRole = useAuthStore(
    (state) => state.activeRole?.baseRole ?? state.activeRole?.name ?? state.role,
  );
  const canView = useHasPermission('assignment', 'view');
  const canEdit = useHasPermission('assignment', 'edit');
  const facultyView = STAFF_ROLES.includes(activeRole as (typeof STAFF_ROLES)[number]);
  const isHod = activeRole === 'hod';
  const [workspace, setWorkspace] = useState<TAssignmentWorkspace>('mine');
  const canManage = (activeRole === 'faculty' || (isHod && workspace === 'mine')) && canEdit;
  const canCloseDepartmentAssignment = isHod && workspace === 'department' && canEdit;
  const { mutation } = useMutation();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<TAssignmentStatus | ''>('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);
  const assignmentUrl = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: facultyView ? '12' : '100',
    });
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (status) params.set('status', status);
    if (sectionId) params.set('sectionId', sectionId);
    if (subjectId) params.set('subjectId', subjectId);
    if (isHod) params.set('scope', workspace);
    return `assignment?${params.toString()}`;
  }, [debouncedSearch, facultyView, isHod, page, sectionId, status, subjectId, workspace]);
  const { data, error, isLoading, isValidating, mutate } = useSwr<IApiResponse<IAssignment[]>>(
    canView ? assignmentUrl : null,
  );
  const assignments = useMemo(() => data?.data ?? [], [data]);
  const [editing, setEditing] = useState<IAssignment | null | undefined>();
  const [submitting, setSubmitting] = useState<IAssignment | null>(null);
  const [viewing, setViewing] = useState<IAssignment | null>(null);
  const [grading, setGrading] = useState<{
    assignment: IAssignment;
    submission: ISubmission;
  } | null>(null);
  const [viewerFiles, setViewerFiles] = useState<IViewerFile[]>([]);
  const totalCount = data?.total ?? assignments.length;
  const statusCounts = data?.statusCounts ?? {};

  const lifecycle = async (assignment: IAssignment, action: 'publish' | 'close') => {
    if (action === 'publish' && !canManage) return;
    if (action === 'close' && !canManage && !canCloseDepartmentAssignment) return;
    if (action === 'close') {
      const confirmation = await Swal.fire({
        title: 'Close assignment?',
        text: 'Students will no longer be able to submit work.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Close assignment',
      });
      if (!confirmation.isConfirmed) return;
    }
    const response = await mutation(`assignment/${assignment._id}/${action}`, { method: 'POST' });
    if (!response?.results?.success) return;
    toast.success(action === 'publish' ? 'Assignment published to students' : 'Assignment closed');
    await mutate();
  };

  if (!canView)
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Assignment access unavailable</h1>
        <p className="mt-2 text-sm text-slate-500">Your active role cannot view assignments.</p>
      </div>
    );

  if (error)
    return (
      <div className="rounded-2xl border border-red-100 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Assignments could not be loaded</h1>
        <p className="mt-2 text-sm text-red-600">{error.message}</p>
        <CustomButton className="mx-auto mt-4 w-fit!" onClick={() => mutate()}>
          Try again
        </CustomButton>
      </div>
    );

  if (!facultyView)
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold">Assignments</h1>
          <p className="text-sm text-slate-500">View instructions, submit work and track grading</p>
        </div>
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as TAssignmentStatus | '');
            setPage(1);
          }}
          className={inputClass + ' max-w-48'}
        >
          <option value="">All assignments</option>
          <option value="published">Open</option>
          <option value="closed">Closed</option>
          <option value="evaluated">Evaluated</option>
        </select>
        {isLoading ? (
          <div className="h-40 animate-pulse rounded-2xl bg-white" />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {assignments.map((assignment) => (
              <StudentCard
                key={assignment._id}
                assignment={assignment}
                onSubmit={() => setSubmitting(assignment)}
                onViewAttachment={() =>
                  setViewerFiles([
                    { url: assignment.attachmentUrl!, name: `${assignment.title} brief` },
                  ])
                }
              />
            ))}
          </div>
        )}
        <AnimatePresence>
          {submitting && (
            <SubmissionForm
              assignment={submitting}
              onClose={() => setSubmitting(null)}
              onSaved={() => {
                setSubmitting(null);
                void mutate();
              }}
            />
          )}
        </AnimatePresence>
        <FileViewer
          open={viewerFiles.length > 0}
          onClose={() => setViewerFiles([])}
          files={viewerFiles}
          title="Assignment brief"
        />
      </div>
    );

  const columns: Column<IAssignment>[] = [
    {
      field: 'title',
      title: 'Assignment',
      render: (item) => (
        <div>
          <p className="font-semibold">{item.title}</p>
          <p className="text-xs text-slate-500">
            {item.subjectCode} · {item.program} · Sem {item.semester} · {item.section}
          </p>
        </div>
      ),
    },
    {
      field: 'dueDate',
      title: 'Due',
      render: (item) => <span className="text-sm">{formatDate(item.dueDate)}</span>,
    },
    {
      field: 'totalSubmissions',
      title: 'Submissions',
      render: (item) => <span>{item.totalSubmissions ?? 0}</span>,
    },
    { field: 'status', title: 'Status', render: (item) => <StatusBadge status={item.status} /> },
  ];
  const actions: Action<IAssignment>[] = [
    { tooltip: 'Submissions', icon: <Eye className="h-4 w-4" />, onClick: setViewing },
    {
      tooltip: 'Edit draft',
      icon: <Edit2 className="h-4 w-4" />,
      onClick: (item) => setEditing(item),
      hidden: (item) => !canManage || item.status !== 'draft',
    },
    {
      tooltip: 'Publish',
      icon: <Send className="h-4 w-4 text-green-600" />,
      onClick: (item) => void lifecycle(item, 'publish'),
      hidden: (item) => !canManage || item.status !== 'draft',
    },
    {
      tooltip: 'Close',
      icon: <Lock className="h-4 w-4 text-amber-600" />,
      onClick: (item) => void lifecycle(item, 'close'),
      hidden: (item) =>
        (!canManage && !canCloseDepartmentAssignment) || item.status !== 'published',
    },
  ];
  const statusCards: Array<{
    value: TAssignmentStatus;
    label: string;
    description: string;
    icon: React.ReactNode;
    color: string;
    activeColor: string;
  }> = [
    {
      value: 'draft',
      label: 'Drafts',
      description: 'Being prepared',
      icon: <Edit2 className="h-5 w-5" />,
      color: 'bg-amber-50 text-amber-700',
      activeColor: 'border-amber-300 ring-2 ring-amber-100',
    },
    {
      value: 'published',
      label: 'Published',
      description: 'Open to students',
      icon: <Send className="h-5 w-5" />,
      color: 'bg-emerald-50 text-emerald-700',
      activeColor: 'border-emerald-300 ring-2 ring-emerald-100',
    },
    {
      value: 'closed',
      label: 'Closed',
      description: 'Submission ended',
      icon: <Lock className="h-5 w-5" />,
      color: 'bg-slate-100 text-slate-600',
      activeColor: 'border-slate-400 ring-2 ring-slate-100',
    },
    {
      value: 'evaluated',
      label: 'Evaluated',
      description: 'Grading completed',
      icon: <CheckCircle2 className="h-5 w-5" />,
      color: 'bg-blue-50 text-blue-700',
      activeColor: 'border-blue-300 ring-2 ring-blue-100',
    },
  ];
  return (
    <div className="space-y-5">
      {isHod && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 bg-gradient-to-r from-blue-50 via-white to-emerald-50 px-4 py-4 sm:px-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-white text-primary">
                <ClipboardList className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                  Assignment workspace
                </p>
                <h1 className="mt-0.5 text-lg font-bold text-slate-900 sm:text-xl">
                  Choose how you want to work
                </h1>
              </div>
            </div>
          </div>
          <div className="p-3 sm:p-4">
            <div
              className="grid gap-3 lg:grid-cols-2"
              role="tablist"
              aria-label="Assignment workspace"
            >
              {[
                {
                  value: 'mine' as const,
                  label: 'My teaching assignments',
                  shortLabel: 'Teaching workspace',
                  description: 'Create, publish and grade work for classes assigned to you.',
                  icon: GraduationCap,
                  iconClass: 'bg-blue-100 text-primary',
                },
                {
                  value: 'department' as const,
                  label: 'Department oversight',
                  shortLabel: 'HOD oversight',
                  description: 'Monitor assignment delivery across your entire department.',
                  icon: Building2,
                  iconClass: 'bg-emerald-100 text-emerald-700',
                },
              ].map((option) => {
                const Icon = option.icon;
                const selected = workspace === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => {
                      setWorkspace(option.value);
                      setSearch('');
                      setDebouncedSearch('');
                      setSectionId('');
                      setSubjectId('');
                      setStatus('');
                      setPage(1);
                    }}
                    className={`group flex min-h-24 cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition-colors sm:p-4 ${
                      selected
                        ? 'border-primary bg-blue-50/70'
                        : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${option.iconClass}`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                        {option.shortLabel}
                      </span>
                      <span className="mt-0.5 block text-sm font-bold text-slate-900 sm:text-base">
                        {option.label}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-600">
                        {option.description}
                      </span>
                    </span>
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                        selected
                          ? 'border-primary bg-primary text-white'
                          : 'border-slate-300 bg-white text-transparent group-hover:border-blue-300'
                      }`}
                      aria-hidden="true"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600 sm:px-4 sm:text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <p>
                {workspace === 'mine'
                  ? 'Authoring is limited to your approved active timetable, keeping every class and subject selection accurate.'
                  : 'Teacher-owned drafts and grades remain protected while you review delivery and close published department work.'}
              </p>
            </div>
          </div>
        </section>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statusCards.map((card) => (
          <button
            type="button"
            key={card.value}
            onClick={() => {
              setStatus(status === card.value ? '' : card.value);
              setPage(1);
            }}
            aria-pressed={status === card.value}
            className={`group rounded-2xl border bg-white p-4 text-left  transition hover:-translate-y-0.5  ${
              status === card.value ? card.activeColor : 'border-slate-200'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-2xl font-bold text-slate-900">{statusCounts[card.value] ?? 0}</p>
                <p className="mt-1 text-sm font-semibold text-slate-700">{card.label}</p>
                <p className="mt-0.5 text-xs text-slate-600">{card.description}</p>
              </div>
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.color}`}
              >
                {card.icon}
              </span>
            </div>
          </button>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4  sm:p-5">
        <div className="mb-4">
          <h2 className="text-sm font-bold text-slate-900">Find Assignments</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Search server records or narrow the directory by class and subject.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Title, subject code, programme…"
                className={`${inputClass} pl-9`}
              />
            </div>
          </div>
          <AsyncSelect
            type="sections"
            label="Class / Section"
            value={sectionId || null}
            params={workspace === 'mine' ? { assignedOnly: true } : { master: true }}
            onChange={(value) => {
              setSectionId(value ?? '');
              setSubjectId('');
              setPage(1);
            }}
            placeholder="All classes"
          />
          <AsyncSelect
            type="subjects"
            label="Subject"
            value={subjectId || null}
            params={
              sectionId
                ? { sectionId, ...(workspace === 'mine' ? { assignedOnly: true } : {}) }
                : workspace === 'mine'
                  ? { assignedOnly: true }
                  : undefined
            }
            onChange={(value) => {
              setSubjectId(value ?? '');
              setPage(1);
            }}
            placeholder="All subjects"
            emptyMessage="No subjects are configured for this section’s curriculum and semester."
          />
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Status</label>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as TAssignmentStatus | '');
                setPage(1);
              }}
              className={inputClass}
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="closed">Closed</option>
              <option value="evaluated">Evaluated</option>
            </select>
          </div>
        </div>
        {(search || sectionId || subjectId || status) && (
          <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
            <CustomButton
              type="button"
              variant="tertiary"
              onClick={() => {
                setSearch('');
                setDebouncedSearch('');
                setSectionId('');
                setSubjectId('');
                setStatus('');
                setPage(1);
              }}
            >
              Clear Filters
            </CustomButton>
          </div>
        )}
      </section>
      <DataViewSwitcher
        data={assignments}
        isLoading={isLoading}
        storageKey="assignment.view"
        defaultView="table"
        showSearch={false}
        searchPlaceholder="Search assignments…"
        searchFields={['title', 'subjectCode', 'program', 'section']}
        renderCard={(item) => (
          <div className="rounded-2xl bg-white p-4">
            <div className="flex justify-between gap-2">
              <ClipboardList className="h-6 w-6 text-primary" />
              <StatusBadge status={item.status} />
            </div>
            <h3 className="mt-3 font-bold">{item.title}</h3>
            <p className="text-xs text-slate-500">
              {item.subjectCode} · {item.program}
            </p>
            <p className="mt-3 text-xs">
              Due {formatDate(item.dueDate)} · {item.totalSubmissions ?? 0} submissions
            </p>
            <div className="mt-4 flex justify-end gap-2">
              {actions
                .filter((action) => !action.hidden?.(item))
                .map((action) => (
                  <button
                    type="button"
                    key={action.tooltip}
                    title={action.tooltip}
                    onClick={() => action.onClick(item)}
                    className="rounded-lg bg-slate-50 p-2"
                  >
                    {typeof action.icon === 'function' ? action.icon(item) : action.icon}
                  </button>
                ))}
            </div>
          </div>
        )}
        table={
          <div className="rounded-2xl bg-white">
            <CustomTable<IAssignment>
              data={assignments}
              columns={columns}
              actions={actions}
              title="Assignment Directory"
              description={
                isHod && workspace === 'department'
                  ? 'Review department delivery without changing teacher-owned drafts or grades.'
                  : 'Create, publish and grade work for your assigned classes.'
              }
              onRefresh={() => void mutate()}
              isValidating={isValidating}
              customActions={
                canManage ? (
                  <CustomButton variant="primary" onClick={() => setEditing(null)}>
                    <Plus className="h-4 w-4" />
                    Create for my class
                  </CustomButton>
                ) : undefined
              }
              isLoading={isLoading}
              page={page - 1}
              pageSize={12}
              totalCount={totalCount}
              onPageChange={(nextPage) => setPage(nextPage + 1)}
              queryPaginationEnabled
              options={{
                search: false,
                export: false,
                refresh: true,
                pagination: true,
                pageSize: 12,
              }}
            />
          </div>
        }
      />
      <AnimatePresence>
        {editing !== undefined && (
          <AssignmentForm
            assignment={editing}
            onClose={() => setEditing(undefined)}
            onSaved={() => {
              setEditing(undefined);
              void mutate();
            }}
          />
        )}
        {viewing && (
          <SubmissionsDrawer
            assignment={viewing}
            onClose={() => setViewing(null)}
            onGrade={
              canManage
                ? (submission) => setGrading({ assignment: viewing, submission })
                : undefined
            }
          />
        )}
        {grading && (
          <GradeForm
            assignment={grading.assignment}
            submission={grading.submission}
            onClose={() => setGrading(null)}
            onSaved={() => {
              setGrading(null);
              void mutate();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default UseProtectedRoutes(AssignmentPage, [
  'super_admin',
  'admin',
  'principal',
  'dean_academic',
  'hod',
  'faculty',
  'student',
]);
