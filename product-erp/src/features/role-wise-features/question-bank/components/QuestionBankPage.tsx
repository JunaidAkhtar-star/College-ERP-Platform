/**
 * @file QuestionBankPage.tsx
 * @description Question bank — faculty/HOD/exam-cell CRUD.
 *   List, filter, create (single or bulk), edit, delete questions.
 *   Options stored per-question for MCQ; correct answer flagged.
 * @module features/role-wise-features/question-bank
 */
'use client';

import React, { useState, useMemo } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import {
  BookOpen,
  Plus,
  Trash2,
  Edit2,
  Filter,
  X,
  CheckCircle2,
  Circle,
  Upload,
} from 'lucide-react';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { Column, Action } from '@/shared/core/CustomTable';
import AsyncSelect from '@/shared/core/AsyncSelect';
import ExaminationWorkflowBar from '@/shared/components/ExaminationWorkflowBar';
import DataViewSwitcher from '@/shared/core/DataViewSwitcher';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import { useAuthStore } from '@/shared/store/authStore';

type QType = 'mcq' | 'true_false' | 'short_answer';
type QDiff = 'easy' | 'medium' | 'hard';

interface IOption {
  optionText: string;
  isCorrect: boolean;
}
interface IQuestion {
  _id: string;
  questionText: string;
  questionType: QType;
  subjectId: string;
  subjectCode?: string;
  unitNo: number;
  coCode?: string;
  explanation?: string;
  difficultyLevel: QDiff;
  marks: number;
  options?: IOption[];
  correctAnswer?: string;
  createdAt: string;
  status?: 'draft' | 'approved' | 'retired';
  [key: string]: unknown;
}

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm placeholder-slate-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20';
const labelCls = 'mb-1 block text-xs font-medium text-slate-600';

const DIFF_CFG: Record<QDiff, { bg: string; text: string }> = {
  easy: { bg: 'bg-green-50', text: 'text-green-600' },
  medium: { bg: 'bg-amber-50', text: 'text-amber-600' },
  hard: { bg: 'bg-red-50', text: 'text-red-500' },
};

const schema = Yup.object({
  questionText: Yup.string().trim().required('Question is required'),
  questionType: Yup.string().required(),
  subjectId: Yup.string().trim().required('Select a subject'),
  unitNo: Yup.number().min(1).max(20).required(),
  difficultyLevel: Yup.string().required(),
  marks: Yup.number().min(1).required(),
  correctAnswer: Yup.string().when('questionType', {
    is: (t: string) => t === 'true_false' || t === 'short_answer',
    then: (s) => s.required('Correct answer required'),
    otherwise: (s) => s.nullable(),
  }),
});

function QuestionModal({
  question,
  onClose,
  onSaved,
}: {
  question?: IQuestion | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mutation, isLoading } = useMutation();
  const [options, setOptions] = useState<IOption[]>(
    question?.options?.length
      ? question.options
      : [
          { optionText: '', isCorrect: false },
          { optionText: '', isCorrect: false },
          { optionText: '', isCorrect: false },
          { optionText: '', isCorrect: false },
        ],
  );

  const formik = useFormik({
    initialValues: {
      questionText: question?.questionText ?? '',
      questionType: question?.questionType ?? ('mcq' as QType),
      subjectId: question?.subjectId ?? '',
      unitNo: question?.unitNo ?? 1,
      coCode: question?.coCode ?? '',
      explanation: question?.explanation ?? '',
      difficultyLevel: question?.difficultyLevel ?? ('medium' as QDiff),
      marks: question?.marks ?? 1,
      correctAnswer: question?.correctAnswer ?? '',
    },
    validationSchema: schema,
    onSubmit: async (values) => {
      const body: Record<string, unknown> = { ...values };
      if (values.questionType === 'mcq') {
        body.options = options;
        delete body.correctAnswer;
      }
      const isEdit = !!question?._id;
      const res = await mutation(isEdit ? `question-bank/${question!._id}` : 'question-bank', {
        method: isEdit ? 'PUT' : 'POST',
        body,
        isAlert: true,
      });
      if ((res as { results?: { success?: boolean } })?.results?.success) {
        toast.success(isEdit ? 'Question updated' : 'Question added');
        onSaved();
      } else toast.error('Failed');
    },
  });

  const qType = formik.values.questionType as QType;

  const setOptionText = (i: number, val: string) =>
    setOptions((prev) => prev.map((o, j) => (j === i ? { ...o, optionText: val } : o)));
  const setCorrect = (i: number) =>
    setOptions((prev) => prev.map((o, j) => ({ ...o, isCorrect: j === i })));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative z-10 w-full max-w-lg max-h-[92dvh] overflow-y-auto rounded-2xl bg-white "
      >
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-100 bg-white px-6 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary">
            <BookOpen className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {question?._id ? 'Edit Question' : 'Add Question'}
            </h2>
            <p className="text-xs text-slate-600">Fill in all required fields</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <form onSubmit={formik.handleSubmit} className="space-y-4 p-6">
          <div>
            <label className={labelCls}>Question *</label>
            <textarea
              name="questionText"
              rows={3}
              value={formik.values.questionText}
              onChange={formik.handleChange}
              placeholder="Enter question text…"
              className={inputCls + ' resize-none'}
            />
            {formik.touched.questionText && formik.errors.questionText && (
              <p className="mt-1 text-xs text-red-500">{formik.errors.questionText}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Type *</label>
              <select
                name="questionType"
                value={formik.values.questionType}
                onChange={formik.handleChange}
                className={inputCls}
              >
                <option value="mcq">MCQ</option>
                <option value="true_false">True / False</option>
                <option value="short_answer">Short Answer</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Difficulty *</label>
              <select
                name="difficultyLevel"
                value={formik.values.difficultyLevel}
                onChange={formik.handleChange}
                className={inputCls}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <AsyncSelect
              type="subjects"
              label="Subject"
              required
              value={formik.values.subjectId}
              onChange={(value) => formik.setFieldValue('subjectId', value ?? '')}
              placeholder="Search subject name or code"
              error={formik.touched.subjectId ? formik.errors.subjectId : undefined}
            />
            <div>
              <label className={labelCls}>Marks *</label>
              <input
                type="number"
                name="marks"
                min={1}
                value={formik.values.marks}
                onChange={formik.handleChange}
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Unit Number *</label>
              <input
                type="number"
                name="unitNo"
                min={1}
                max={20}
                value={formik.values.unitNo}
                onChange={formik.handleChange}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Course Outcome</label>
              <input
                name="coCode"
                value={formik.values.coCode}
                onChange={formik.handleChange}
                placeholder="CO1"
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Explanation</label>
            <input
              name="explanation"
              value={formik.values.explanation}
              onChange={formik.handleChange}
              placeholder="Optional answer explanation"
              className={inputCls}
            />
          </div>

          {/* MCQ Options */}
          {qType === 'mcq' && (
            <div>
              <p className="mb-2 text-xs font-medium text-slate-600">
                Options <span className="text-slate-600">(click circle to mark correct)</span>
              </p>
              <div className="space-y-2">
                {options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <button type="button" onClick={() => setCorrect(i)} className="shrink-0">
                      {opt.isCorrect ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <Circle className="h-5 w-5 text-slate-300 hover:text-slate-600" />
                      )}
                    </button>
                    <input
                      value={opt.optionText}
                      onChange={(e) => setOptionText(i, e.target.value)}
                      placeholder={`Option ${String.fromCharCode(65 + i)}`}
                      className={inputCls}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* True/False */}
          {qType === 'true_false' && (
            <div>
              <label className={labelCls}>Correct Answer *</label>
              <select
                name="correctAnswer"
                value={formik.values.correctAnswer}
                onChange={formik.handleChange}
                className={inputCls}
              >
                <option value="">Select</option>
                <option value="true">True</option>
                <option value="false">False</option>
              </select>
            </div>
          )}

          {/* Short Answer */}
          {qType === 'short_answer' && (
            <div>
              <label className={labelCls}>Model Answer *</label>
              <textarea
                name="correctAnswer"
                rows={2}
                value={formik.values.correctAnswer}
                onChange={formik.handleChange}
                placeholder="Expected answer…"
                className={inputCls + ' resize-none'}
              />
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <CustomButton variant="tertiary" type="button" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton variant="primary" type="submit" loading={isLoading}>
              {question?._id ? 'Update' : 'Add Question'}
            </CustomButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export default function QuestionBankPage() {
  const activeRole = useAuthStore(
    (state) => state.activeRole?.baseRole ?? state.activeRole?.name ?? state.role,
  );
  const canView = useHasPermission('question_bank', 'view');
  const canEdit =
    useHasPermission('question_bank', 'edit') &&
    ['hod', 'faculty', 'examination_cell'].includes(activeRole ?? '');
  const canApprove =
    useHasPermission('question_bank', 'approve') &&
    ['super_admin', 'dean_academic', 'hod', 'examination_cell'].includes(activeRole ?? '');
  const [showModal, setShowModal] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [editQ, setEditQ] = useState<IQuestion | null>(null);
  const [filterType, setFilterType] = useState('');
  const [filterDiff, setFilterDiff] = useState('');

  const qp = new URLSearchParams();
  if (filterType) qp.set('questionType', filterType);
  if (filterDiff) qp.set('difficultyLevel', filterDiff);
  const {
    data: raw,
    isLoading,
    mutate,
    error,
  } = useSwr(canView ? `question-bank${qp.toString() ? '?' + qp.toString() : ''}` : null);
  const questions = useMemo(() => (raw as { data?: IQuestion[] })?.data ?? [], [raw]);
  const { mutation } = useMutation();

  const handleDelete = async (q: IQuestion) => {
    const r = await Swal.fire({
      title: 'Delete question?',
      text: q.questionText.slice(0, 80),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      confirmButtonColor: '#d33',
    });
    if (!r.isConfirmed) return;
    const res = await mutation(`question-bank/${q._id}`, { method: 'DELETE', isAlert: true });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Deleted');
      mutate();
    } else toast.error('Failed');
  };

  const handleApprove = async (question: IQuestion) => {
    const res = await mutation(`question-bank/${question._id}/approve`, {
      method: 'POST',
      isAlert: true,
    });
    if (res) {
      toast.success('Question approved for governed use');
      mutate();
    }
  };

  const handleRetire = async (question: IQuestion) => {
    const result = await Swal.fire({
      title: 'Retire question?',
      input: 'textarea',
      inputLabel: 'Reason',
      inputValidator: (value) =>
        value.trim().length < 3 ? 'Provide a retirement reason' : undefined,
      showCancelButton: true,
      confirmButtonText: 'Retire',
    });
    if (!result.isConfirmed) return;
    const res = await mutation(`question-bank/${question._id}/retire`, {
      method: 'POST',
      body: { reason: result.value.trim() },
      isAlert: true,
    });
    if (res) {
      toast.success('Question retired');
      mutate();
    }
  };

  const columns: Column<IQuestion>[] = [
    {
      field: 'questionText',
      title: 'Question',
      render: (row) => (
        <div>
          <p className="text-sm font-medium text-slate-800 line-clamp-2">{row.questionText}</p>
          <p className="mt-0.5 text-xs text-slate-600">
            {row.subjectCode ?? 'Subject'} · Unit {row.unitNo}
          </p>
        </div>
      ),
    },
    {
      field: 'questionType',
      title: 'Type',
      render: (row) => (
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs capitalize text-slate-600">
          {row.questionType.replace('_', ' ')}
        </span>
      ),
    },
    {
      field: 'difficultyLevel',
      title: 'Difficulty',
      render: (row) => {
        const c = DIFF_CFG[row.difficultyLevel] ?? DIFF_CFG.medium;
        return (
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${c.bg} ${c.text}`}
          >
            {row.difficultyLevel}
          </span>
        );
      },
    },
    {
      field: 'marks',
      title: 'Marks',
      render: (row) => <span className="text-sm font-semibold text-slate-700">{row.marks}</span>,
    },
    {
      field: 'subjectCode',
      title: 'Subject',
      render: (row) => <span className="text-xs text-slate-500">{row.subjectCode ?? '—'}</span>,
    },
  ];

  const actions: Action<IQuestion>[] = [
    ...(canEdit
      ? [
          {
            tooltip: 'Edit',
            icon: <Edit2 className="h-4 w-4 text-slate-500" />,
            onClick: (q: IQuestion) => {
              setEditQ(q);
              setShowModal(true);
            },
          },
          {
            tooltip: 'Delete',
            icon: <Trash2 className="h-4 w-4 text-red-400" />,
            onClick: (q: IQuestion) => handleDelete(q),
            hidden: (q: IQuestion) => q.status !== 'draft',
          },
        ]
      : []),
    ...(canApprove
      ? [
          {
            tooltip: 'Approve',
            icon: <CheckCircle2 className="h-4 w-4 text-green-500" />,
            onClick: handleApprove,
            hidden: (question: IQuestion) => question.status !== 'draft',
          },
          {
            tooltip: 'Retire',
            icon: <X className="h-4 w-4 text-amber-500" />,
            onClick: handleRetire,
            hidden: (question: IQuestion) => question.status !== 'approved',
          },
        ]
      : []),
  ];

  if (!canView) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Question bank access unavailable</h1>
        <p className="mt-2 text-sm text-slate-500">
          Your active role cannot view governed questions.
        </p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Question bank could not be loaded</h1>
        <p className="mt-2 text-sm text-red-600">{error.message}</p>
        <CustomButton className="mx-auto mt-4 w-fit!" onClick={() => mutate()}>
          Try again
        </CustomButton>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ExaminationWorkflowBar />
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Question Bank</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Manage and organise questions for quizzes and exams
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <CustomButton
              variant="tertiary"
              startIcon={<Upload className="h-4 w-4" />}
              onClick={() => setShowBulk(true)}
              className="w-fit!"
            >
              Bulk Import
            </CustomButton>
            <CustomButton
              variant="primary"
              startIcon={<Plus className="h-4 w-4" />}
              onClick={() => {
                setEditQ(null);
                setShowModal(true);
              }}
              className="w-fit!"
            >
              Add Question
            </CustomButton>
          </div>
        )}
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total', value: questions.length, color: 'bg-primary-50 text-primary' },
          {
            label: 'MCQ',
            value: questions.filter((q) => q.questionType === 'mcq').length,
            color: 'bg-blue-50 text-blue-600',
          },
          {
            label: 'Easy',
            value: questions.filter((q) => q.difficultyLevel === 'easy').length,
            color: 'bg-green-50 text-green-600',
          },
          {
            label: 'Hard',
            value: questions.filter((q) => q.difficultyLevel === 'hard').length,
            color: 'bg-red-50 text-red-500',
          },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="flex items-center gap-3 rounded-xl bg-white p-4"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.color}`}>
              <BookOpen className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900">{isLoading ? '—' : s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-4">
        <Filter className="h-3.5 w-3.5 shrink-0 text-slate-600" />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm focus:outline-none"
        >
          <option value="">All Types</option>
          <option value="mcq">MCQ</option>
          <option value="true_false">True / False</option>
          <option value="short_answer">Short Answer</option>
        </select>
        <select
          value={filterDiff}
          onChange={(e) => setFilterDiff(e.target.value)}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm focus:outline-none"
        >
          <option value="">All Difficulties</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
        {(filterType || filterDiff) && (
          <button
            type="button"
            onClick={() => {
              setFilterType('');
              setFilterDiff('');
            }}
            className="text-xs text-slate-600 underline hover:text-slate-600"
          >
            Clear
          </button>
        )}
        <span className="ml-auto text-xs text-slate-600">
          {isLoading ? '…' : `${questions.length} questions`}
        </span>
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <DataViewSwitcher<IQuestion>
          data={questions}
          isLoading={isLoading}
          storageKey="question-bank.view"
          searchPlaceholder="Search questions…"
          searchFields={[
            'questionText',
            'subjectCode',
            'subjectCode',
            'coCode',
            'questionType',
            'difficultyLevel',
          ]}
          pageSize={16}
          renderCard={(q) => {
            const diffStyle =
              q.difficultyLevel === 'hard'
                ? 'bg-red-50 text-red-500'
                : q.difficultyLevel === 'medium'
                  ? 'bg-amber-50 text-amber-600'
                  : 'bg-green-50 text-green-600';
            return (
              <motion.div
                whileHover={{ y: -2 }}
                className="flex flex-col gap-3 rounded-2xl bg-white p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {q.difficultyLevel && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${diffStyle}`}
                      >
                        {q.difficultyLevel}
                      </span>
                    )}
                    {q.marks != null && (
                      <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-medium text-primary">
                        {q.marks}m
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-slate-700 line-clamp-3">{q.questionText}</p>
                <div className="space-y-1 text-xs text-slate-500">
                  {q.subjectCode && (
                    <p className="truncate">
                      {q.subjectCode} · Unit {q.unitNo}
                    </p>
                  )}
                  {q.coCode && <p className="text-[11px] text-slate-600">{q.coCode}</p>}
                  <p className="text-[11px] uppercase tracking-wide text-slate-600">
                    {q.questionType}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setEditQ(q);
                        setShowModal(true);
                      }}
                      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                    >
                      <Edit2 className="h-3 w-3" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(q)}
                      className="inline-flex items-center gap-1 font-medium text-red-500 hover:underline"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </div>
                )}
              </motion.div>
            );
          }}
          table={
            <div className="overflow-hidden rounded-2xl bg-white">
              <CustomTable
                data={questions}
                columns={columns}
                actions={actions}
                isLoading={isLoading}
                options={{ search: true, pagination: true, pageSize: 15 }}
                localization={{ toolbar: { searchPlaceholder: 'Search questions…' } }}
              />
            </div>
          }
        />
      </motion.div>

      <AnimatePresence>
        {showModal && (
          <QuestionModal
            question={editQ}
            onClose={() => {
              setShowModal(false);
              setEditQ(null);
            }}
            onSaved={() => {
              mutate();
              setShowModal(false);
              setEditQ(null);
            }}
          />
        )}
        {showBulk && (
          <BulkImportModal
            onClose={() => setShowBulk(false)}
            onSaved={() => {
              mutate();
              setShowBulk(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function BulkImportModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { mutation, isLoading } = useMutation();
  const [subjectId, setSubjectId] = useState('');
  const [questions, setQuestions] = useState<Array<Record<string, unknown>>>([]);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (questions.length === 0) {
      setError('Choose a completed CSV file before importing.');
      return;
    }
    if (!subjectId) {
      setError('Select the subject for this import');
      return;
    }
    const governedQuestions = questions.map((question) => ({ ...question, subjectId }));
    setError('');
    const res = await mutation('question-bank/bulk', {
      method: 'POST',
      body: { questions: governedQuestions },
      isAlert: true,
    });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success(`Imported ${questions.length} questions`);
      onSaved();
    }
  };

  const readCsv = async (file: File) => {
    try {
      const rows = parseQuestionCsv(await file.text());
      setQuestions(rows);
      setFileName(file.name);
      setError('');
    } catch (csvError) {
      setQuestions([]);
      setFileName('');
      setError(csvError instanceof Error ? csvError.message : 'The CSV file could not be read.');
    }
  };

  const downloadTemplate = () => {
    const template =
      'questionText,questionType,difficultyLevel,unitNo,marks,option1,option2,option3,option4,correctOption,correctAnswer\n"What is 2 + 2?",mcq,easy,1,1,3,4,,,2,\n"The earth is round",true_false,easy,1,1,,,,,,true';
    const url = URL.createObjectURL(new Blob([template], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'question-bank-import-template.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="relative z-10 w-full max-w-2xl rounded-2xl bg-white p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Bulk Import Questions</h2>
            <p className="text-xs text-slate-500">
              Upload a guided spreadsheet—no JSON or database IDs
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xl text-slate-600 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
        <div className="mb-4">
          <AsyncSelect
            type="subjects"
            label="Subject for all imported questions"
            required
            value={subjectId}
            onChange={(value) => setSubjectId(value ?? '')}
            placeholder="Search subject name or code"
          />
        </div>
        <div className="rounded-xl bg-slate-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">Question spreadsheet</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Download the template, complete one question per row, then upload the CSV file.
              </p>
            </div>
            <button
              type="button"
              onClick={downloadTemplate}
              className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-primary"
            >
              Download CSV template
            </button>
          </div>
          <label className="mt-4 flex min-h-20 cursor-pointer items-center justify-center rounded-lg bg-white px-4 text-center text-sm font-semibold text-slate-600">
            {fileName
              ? `${fileName} · ${questions.length} question${questions.length === 1 ? '' : 's'} ready`
              : 'Choose completed CSV file'}
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void readCsv(file);
              }}
            />
          </label>
        </div>
        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
        <div className="mt-4 flex justify-end gap-3">
          <CustomButton variant="tertiary" type="button" onClick={onClose}>
            Cancel
          </CustomButton>
          <CustomButton variant="primary" loading={isLoading} onClick={handleSubmit}>
            Import
          </CustomButton>
        </div>
      </motion.div>
    </div>
  );
}

function parseQuestionCsv(input: string): Array<Record<string, unknown>> {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === '"' && quoted && input[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && input[index + 1] === '\n') index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
    } else cell += character;
  }
  if (quoted) throw new Error('A quoted CSV value is not closed. Check the template formatting.');
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  const [headers, ...records] = rows;
  const required = ['questionText', 'questionType', 'difficultyLevel', 'unitNo', 'marks'];
  if (!headers || required.some((header) => !headers.includes(header))) {
    throw new Error('Use the provided CSV template so all required columns are present.');
  }
  const questions = records.map((values, rowIndex) => {
    const data = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
    if (!data.questionText) throw new Error(`Row ${rowIndex + 2}: question text is required.`);
    const correctIndex = Number(data.correctOption) - 1;
    const options = [data.option1, data.option2, data.option3, data.option4]
      .filter(Boolean)
      .map((optionText, index) => ({ optionText, isCorrect: index === correctIndex }));
    return {
      questionText: data.questionText,
      questionType: data.questionType,
      difficultyLevel: data.difficultyLevel,
      unitNo: Number(data.unitNo),
      marks: Number(data.marks),
      ...(options.length ? { options } : {}),
      ...(data.correctAnswer ? { correctAnswer: data.correctAnswer } : {}),
    };
  });
  if (!questions.length) throw new Error('The CSV file does not contain any question rows.');
  return questions;
}
