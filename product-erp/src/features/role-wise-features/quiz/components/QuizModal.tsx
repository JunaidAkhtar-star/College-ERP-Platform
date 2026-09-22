/**
 * @file QuizModal.tsx
 * @description Create / edit a quiz — faculty/HOD/admin.
 *   Step 1: Quiz metadata (title, subject, timing, proctoring options)
 *   Step 2: Add questions inline or pick from question bank
 * @module features/role-wise-features/quiz
 */
'use client';

import React, { useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import {
  BookOpen,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  X,
  ChevronRight,
  ChevronLeft,
  Shield,
} from 'lucide-react';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import CustomButton from '@/shared/core/CustomButton';
import AsyncSelect from '@/shared/core/AsyncSelect';
import useMutation from '@/shared/hooks/useMutation';
import { IQuiz, ICreateQuizDto, IQuizQuestion } from '../types/quiz.types';

interface Props {
  quiz?: IQuiz | null;
  onClose: () => void;
  onSaved: () => void;
}

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm placeholder-slate-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20';
const labelCls = 'mb-1 block text-xs font-medium text-slate-600';

const step1Schema = Yup.object({
  title: Yup.string().trim().required('Title is required'),
  subjectCode: Yup.string().trim().required('Subject code required'),
  program: Yup.string().trim().required('Program required'),
  semester: Yup.number().min(1).max(8).required(),
  section: Yup.string().trim().required('Section required'),
  academicYear: Yup.string().trim().required('Academic year required'),
  durationMinutes: Yup.number().min(1).required('Duration required'),
});

function emptyQuestion(): IQuizQuestion {
  return {
    questionText: '',
    questionType: 'mcq',
    marks: 1,
    options: [
      { optionText: '', isCorrect: false },
      { optionText: '', isCorrect: false },
      { optionText: '', isCorrect: false },
      { optionText: '', isCorrect: false },
    ],
  };
}

export default function QuizModal({ quiz, onClose, onSaved }: Props) {
  const { mutation, isLoading: saving } = useMutation();
  const [step, setStep] = useState(1);
  const [questions, setQuestions] = useState<IQuizQuestion[]>(
    quiz?.questions?.length ? quiz.questions : [emptyQuestion()],
  );

  const formik = useFormik({
    initialValues: {
      title: quiz?.title ?? '',
      description: quiz?.description ?? '',
      subjectCode: quiz?.subjectCode ?? '',
      program: quiz?.program ?? '',
      semester: quiz?.semester ?? 1,
      section: quiz?.section ?? '',
      academicYear:
        quiz?.academicYear ?? new Date().getFullYear() + '-' + (new Date().getFullYear() + 1),
      quizType: quiz?.quizType ?? 'scheduled',
      durationMinutes: quiz?.durationMinutes ?? 30,
      startDateTime: quiz?.startDateTime ? quiz.startDateTime.slice(0, 16) : '',
      endDateTime: quiz?.endDateTime ? quiz.endDateTime.slice(0, 16) : '',
      shuffleQuestions: quiz?.shuffleQuestions ?? false,
      shuffleOptions: quiz?.shuffleOptions ?? false,
      showResultImmediately: quiz?.showResultImmediately ?? true,
      proctoringEnabled: quiz?.proctoringEnabled ?? false,
      tabSwitchLimit: quiz?.proctoringConfig?.tabSwitchLimit ?? 3,
      fullscreenRequired: quiz?.proctoringConfig?.fullscreenRequired ?? true,
      copyPasteDisabled: quiz?.proctoringConfig?.copyPasteDisabled ?? true,
    },
    validationSchema: step1Schema,
    onSubmit: async (values) => {
      if (questions.length === 0) {
        toast.error('Add at least one question');
        return;
      }
      const body: ICreateQuizDto = {
        title: values.title,
        description: values.description || undefined,
        subjectId: '', // backend resolves by subjectCode if subjectId missing
        subjectCode: values.subjectCode,
        program: values.program,
        semester: values.semester,
        section: values.section,
        academicYear: values.academicYear,
        quizType: values.quizType as 'scheduled' | 'surprise',
        durationMinutes: values.durationMinutes,
        startDateTime: values.startDateTime || undefined,
        endDateTime: values.endDateTime || undefined,
        shuffleQuestions: values.shuffleQuestions,
        shuffleOptions: values.shuffleOptions,
        showResultImmediately: values.showResultImmediately,
        proctoringEnabled: values.proctoringEnabled,
        proctoringConfig: {
          fullscreenRequired: values.fullscreenRequired,
          copyPasteDisabled: values.copyPasteDisabled,
          tabSwitchLimit: values.tabSwitchLimit,
          screenshotIntervalSec: 0,
          webcamRequired: false,
        },
        questions,
      };
      const isEdit = !!quiz?._id;
      const res = await mutation(isEdit ? `quiz/${quiz!._id}` : 'quiz', {
        method: isEdit ? 'PUT' : 'POST',
        body,
        isAlert: true,
      });
      if ((res as { results?: { success?: boolean } })?.results?.success) {
        toast.success(isEdit ? 'Quiz updated' : 'Quiz created');
        onSaved();
      } else toast.error('Failed to save quiz');
    },
  });

  // question helpers
  const addQuestion = () => setQuestions((q) => [...q, emptyQuestion()]);
  const removeQuestion = (i: number) => setQuestions((q) => q.filter((_, j) => j !== i));
  const updateQuestion = (i: number, field: keyof IQuizQuestion, val: unknown) =>
    setQuestions((q) => q.map((item, j) => (j === i ? { ...item, [field]: val } : item)));
  const setOptionText = (qi: number, oi: number, val: string) =>
    setQuestions((q) =>
      q.map((item, j) =>
        j !== qi
          ? item
          : {
              ...item,
              options: (item.options ?? []).map((o, k) =>
                k === oi ? { ...o, optionText: val } : o,
              ),
            },
      ),
    );
  const setCorrect = (qi: number, oi: number) =>
    setQuestions((q) =>
      q.map((item, j) =>
        j !== qi
          ? item
          : {
              ...item,
              options: (item.options ?? []).map((o, k) => ({ ...o, isCorrect: k === oi })),
            },
      ),
    );

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
        className="relative z-10 flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white  max-h-[96dvh]"
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4 shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary">
            <BookOpen className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {quiz?._id ? 'Edit Quiz' : 'Create Quiz'}
            </h2>
            <p className="text-xs text-slate-600">
              Step {step} of 2 — {step === 1 ? 'Quiz Details' : 'Questions'}
            </p>
          </div>
          {/* Step indicator */}
          <div className="ml-auto flex items-center gap-2 mr-4">
            {[1, 2].map((s) => (
              <div
                key={s}
                className={`h-2 w-8 rounded-full transition-colors ${s <= step ? 'bg-primary' : 'bg-slate-200'}`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* STEP 1 — metadata */}
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4 p-6"
              >
                <div>
                  <label className={labelCls}>Quiz Title *</label>
                  <input
                    name="title"
                    value={formik.values.title}
                    onChange={formik.handleChange}
                    placeholder="e.g. Unit 2 Mid Test"
                    className={inputCls}
                  />
                  {formik.touched.title && formik.errors.title && (
                    <p className="mt-1 text-xs text-red-500">{formik.errors.title}</p>
                  )}
                </div>

                <div>
                  <label className={labelCls}>Description</label>
                  <textarea
                    name="description"
                    rows={2}
                    value={formik.values.description}
                    onChange={formik.handleChange}
                    placeholder="Instructions visible to students before starting…"
                    className={inputCls + ' resize-none'}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Quiz Type *</label>
                    <select
                      name="quizType"
                      value={formik.values.quizType}
                      onChange={formik.handleChange}
                      className={inputCls}
                    >
                      <option value="scheduled">Scheduled</option>
                      <option value="surprise">Surprise Test</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Duration (minutes) *</label>
                    <input
                      type="number"
                      name="durationMinutes"
                      min={1}
                      value={formik.values.durationMinutes}
                      onChange={formik.handleChange}
                      className={inputCls}
                    />
                    {formik.touched.durationMinutes && formik.errors.durationMinutes && (
                      <p className="mt-1 text-xs text-red-500">
                        {String(formik.errors.durationMinutes)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Subject Code *</label>
                    <input
                      name="subjectCode"
                      value={formik.values.subjectCode}
                      onChange={formik.handleChange}
                      placeholder="CS301"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Program *</label>
                    <input
                      name="program"
                      value={formik.values.program}
                      onChange={formik.handleChange}
                      placeholder="B.Tech"
                      className={inputCls}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>Semester *</label>
                    <input
                      type="number"
                      name="semester"
                      min={1}
                      max={8}
                      value={formik.values.semester}
                      onChange={formik.handleChange}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Section *</label>
                    <input
                      name="section"
                      value={formik.values.section}
                      onChange={formik.handleChange}
                      placeholder="A"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Academic Year *</label>
                    <AsyncSelect
                      type="academicYears"
                      value={formik.values.academicYear || null}
                      onChange={(value) => formik.setFieldValue('academicYear', value ?? '')}
                      placeholder="Select configured academic year"
                    />
                  </div>
                </div>

                {formik.values.quizType === 'scheduled' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Start Date & Time</label>
                      <input
                        type="datetime-local"
                        name="startDateTime"
                        value={formik.values.startDateTime}
                        onChange={formik.handleChange}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>End Date & Time</label>
                      <input
                        type="datetime-local"
                        name="endDateTime"
                        value={formik.values.endDateTime}
                        onChange={formik.handleChange}
                        className={inputCls}
                      />
                    </div>
                  </div>
                )}

                {/* Options */}
                <div className="rounded-xl bg-slate-50 p-4 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Quiz Options
                  </p>
                  {[
                    { name: 'shuffleQuestions', label: 'Shuffle questions' },
                    { name: 'shuffleOptions', label: 'Shuffle options (MCQ)' },
                    {
                      name: 'showResultImmediately',
                      label: 'Show result immediately after submission',
                    },
                  ].map((opt) => (
                    <label key={opt.name} className="flex cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        name={opt.name}
                        checked={formik.values[opt.name as keyof typeof formik.values] as boolean}
                        onChange={formik.handleChange}
                        className="h-4 w-4 rounded border-slate-300 text-primary accent-primary"
                      />
                      <span className="text-sm text-slate-700">{opt.label}</span>
                    </label>
                  ))}
                </div>

                {/* Proctoring */}
                <div className="rounded-xl bg-slate-50 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-slate-600" />
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Proctoring
                    </p>
                  </div>
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      name="proctoringEnabled"
                      checked={formik.values.proctoringEnabled}
                      onChange={formik.handleChange}
                      className="h-4 w-4 rounded accent-primary"
                    />
                    <span className="text-sm text-slate-700">Enable proctoring</span>
                  </label>
                  {formik.values.proctoringEnabled && (
                    <div className="ml-7 space-y-2">
                      {[
                        { name: 'fullscreenRequired', label: 'Require fullscreen mode' },
                        { name: 'copyPasteDisabled', label: 'Disable copy-paste' },
                      ].map((opt) => (
                        <label key={opt.name} className="flex cursor-pointer items-center gap-3">
                          <input
                            type="checkbox"
                            name={opt.name}
                            checked={
                              formik.values[opt.name as keyof typeof formik.values] as boolean
                            }
                            onChange={formik.handleChange}
                            className="h-4 w-4 rounded accent-primary"
                          />
                          <span className="text-sm text-slate-700">{opt.label}</span>
                        </label>
                      ))}
                      <div>
                        <label className={labelCls}>Tab-switch limit before auto-submit</label>
                        <input
                          type="number"
                          name="tabSwitchLimit"
                          min={0}
                          max={20}
                          value={formik.values.tabSwitchLimit}
                          onChange={formik.handleChange}
                          className={inputCls + ' max-w-24'}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* STEP 2 — questions */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="p-6 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-700">
                    {questions.length} Question{questions.length !== 1 ? 's' : ''} · Total{' '}
                    {questions.reduce((s, q) => s + (q.marks || 0), 0)} marks
                  </p>
                  <CustomButton
                    variant="secondary"
                    startIcon={<Plus className="h-4 w-4" />}
                    onClick={addQuestion}
                    className="w-fit!"
                  >
                    Add Question
                  </CustomButton>
                </div>

                {questions.map((q, qi) => (
                  <div key={qi} className="rounded-xl bg-slate-50 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white shrink-0 mt-0.5">
                        {qi + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeQuestion(qi)}
                        className="ml-auto shrink-0 text-slate-300 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <textarea
                      value={q.questionText}
                      rows={2}
                      onChange={(e) => updateQuestion(qi, 'questionText', e.target.value)}
                      placeholder="Question text…"
                      className={inputCls + ' resize-none'}
                    />

                    <div className="grid grid-cols-3 gap-3">
                      <select
                        value={q.questionType}
                        onChange={(e) => updateQuestion(qi, 'questionType', e.target.value)}
                        className={inputCls}
                      >
                        <option value="mcq">MCQ</option>
                        <option value="true_false">True/False</option>
                        <option value="short_answer">Short Answer</option>
                      </select>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Marks</span>
                        <input
                          type="number"
                          min={1}
                          value={q.marks}
                          onChange={(e) => updateQuestion(qi, 'marks', Number(e.target.value))}
                          className={inputCls + ' max-w-16'}
                        />
                      </div>
                    </div>

                    {q.questionType === 'mcq' && (
                      <div className="space-y-2">
                        {(q.options ?? []).map((opt, oi) => (
                          <div key={oi} className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setCorrect(qi, oi)}
                              className="shrink-0"
                            >
                              {opt.isCorrect ? (
                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                              ) : (
                                <Circle className="h-5 w-5 text-slate-300 hover:text-slate-600" />
                              )}
                            </button>
                            <input
                              value={opt.optionText}
                              onChange={(e) => setOptionText(qi, oi, e.target.value)}
                              placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                              className={inputCls}
                            />
                          </div>
                        ))}
                        <p className="text-xs text-slate-600">Click ○ to mark the correct option</p>
                      </div>
                    )}

                    {q.questionType === 'true_false' && (
                      <div className="flex gap-3">
                        {['true', 'false'].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => updateQuestion(qi, 'correctAnswer', val)}
                            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors capitalize ${q.correctAnswer === val ? 'bg-green-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    )}

                    {q.questionType === 'short_answer' && (
                      <textarea
                        value={q.correctAnswer ?? ''}
                        rows={2}
                        onChange={(e) => updateQuestion(qi, 'correctAnswer', e.target.value)}
                        placeholder="Model / expected answer…"
                        className={inputCls + ' resize-none'}
                      />
                    )}
                  </div>
                ))}

                {questions.length === 0 && (
                  <div className="flex flex-col items-center justify-center rounded-xl bg-slate-50 py-10 text-slate-300">
                    <BookOpen className="h-8 w-8 mb-2" />
                    <p className="text-sm">No questions added yet</p>
                    <CustomButton
                      variant="secondary"
                      className="mt-3 w-fit!"
                      onClick={addQuestion}
                      startIcon={<Plus className="h-4 w-4" />}
                    >
                      Add First Question
                    </CustomButton>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 shrink-0">
          <CustomButton
            variant="tertiary"
            onClick={step === 1 ? onClose : () => setStep(1)}
            startIcon={step === 2 ? <ChevronLeft className="h-4 w-4" /> : undefined}
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </CustomButton>
          {step === 1 ? (
            <CustomButton
              variant="primary"
              endIcon={<ChevronRight className="h-4 w-4" />}
              onClick={async () => {
                await formik.validateForm();
                if (Object.keys(formik.errors).length === 0) setStep(2);
                else formik.submitForm();
              }}
            >
              Next: Questions
            </CustomButton>
          ) : (
            <CustomButton variant="primary" loading={saving} onClick={() => formik.handleSubmit()}>
              {quiz?._id ? 'Update Quiz' : 'Create Quiz'}
            </CustomButton>
          )}
        </div>
      </motion.div>
    </div>
  );
}
