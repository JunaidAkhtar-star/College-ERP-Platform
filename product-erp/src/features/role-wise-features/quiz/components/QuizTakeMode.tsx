/** Secure, resumable student quiz runner. Server owns presentation, deadline and grading. */
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cloud,
  CloudOff,
  Expand,
  LoaderCircle,
  ShieldCheck,
  Trophy,
} from 'lucide-react';
import CustomButton from '@/shared/core/CustomButton';
import useMutation from '@/shared/hooks/useMutation';
import { IQuiz, IQuizQuestion } from '../types/quiz.types';

interface IStudentAnswer {
  questionId: string;
  selectedOption?: number;
  textAnswer?: string;
}

interface IAttemptEnvelope {
  quiz: IQuiz & { questions: IQuizQuestion[] };
  attempt: {
    startedAt: string;
    expiresAt: string;
    answers: IStudentAnswer[];
    revision: number;
    lastSavedAt?: string;
    serverTime: string;
  };
}

interface ICompletedAttemptEnvelope {
  completed: true;
  result: ISubmissionResult;
}

interface IResultAnswer {
  questionId: string;
  isCorrect: boolean;
  marksAwarded: number;
}

interface ISubmissionResult {
  score?: number;
  maxScore?: number;
  percentage?: number;
  answers?: IResultAnswer[];
  resultReleased: boolean;
}

interface IApiResult<T> {
  success: boolean;
  data: T;
}

interface IProps {
  quiz: IQuiz;
  onClose: () => void;
}

type TPhase = 'instructions' | 'starting' | 'active' | 'submitting' | 'result';

function toAnswerMap(values: IStudentAnswer[]) {
  return Object.fromEntries(values.map((answer) => [answer.questionId, answer]));
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export default function QuizTakeMode({ quiz: metadata, onClose }: IProps) {
  const { mutation } = useMutation();
  const [phase, setPhase] = useState<TPhase>('instructions');
  const [quiz, setQuiz] = useState<(IQuiz & { questions: IQuizQuestion[] }) | null>(null);
  const [answers, setAnswers] = useState<Record<string, IStudentAnswer>>({});
  const [current, setCurrent] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [expiresAtMs, setExpiresAtMs] = useState(0);
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const [revision, setRevision] = useState(0);
  const [savedRevision, setSavedRevision] = useState(0);
  const [saveFailed, setSaveFailed] = useState(false);
  const [violations, setViolations] = useState(0);
  const [result, setResult] = useState<ISubmissionResult | null>(null);
  const answersRef = useRef(answers);
  const revisionRef = useRef(revision);
  const savedRevisionRef = useRef(savedRevision);
  const submitLockRef = useRef(false);
  const activeRef = useRef(false);
  const popGuardRef = useRef(false);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);
  useEffect(() => {
    revisionRef.current = revision;
  }, [revision]);
  useEffect(() => {
    savedRevisionRef.current = savedRevision;
  }, [savedRevision]);
  useEffect(() => {
    activeRef.current = phase === 'active' || phase === 'submitting';
  }, [phase]);

  const answerList = useCallback(() => Object.values(answersRef.current), []);

  const saveAnswers = useCallback(
    async (silent = true) => {
      const nextRevision = revisionRef.current;
      if (!quiz || nextRevision <= savedRevisionRef.current) return true;
      const response = await mutation(`quiz/${quiz._id}/answers`, {
        method: 'PATCH',
        body: { answers: answerList(), revision: nextRevision },
        silentError: silent,
        dedupe: false,
      });
      const payload = response?.results as IApiResult<{ revision: number }> | undefined;
      if (!payload?.success) {
        setSaveFailed(true);
        return false;
      }
      setSavedRevision((current) => Math.max(current, payload.data.revision));
      setSaveFailed(false);
      return true;
    },
    [answerList, mutation, quiz],
  );

  const submit = useCallback(
    async (automatic = false) => {
      if (!quiz || submitLockRef.current) return;
      submitLockRef.current = true;
      setPhase('submitting');
      await saveAnswers(true);
      const response = await mutation(`quiz/${quiz._id}/submit`, {
        method: 'POST',
        body: { answers: answerList() },
        isAlert: false,
        dedupe: false,
      });
      const payload = response?.results as IApiResult<ISubmissionResult> | undefined;
      if (!payload?.success) {
        submitLockRef.current = false;
        setPhase('active');
        toast.error('Submission was not confirmed. Your saved answers are safe; please retry.');
        return;
      }
      setResult(payload.data);
      setPhase('result');
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
      toast.success(
        automatic ? 'Time ended. Your quiz was submitted.' : 'Quiz submitted successfully.',
      );
    },
    [answerList, mutation, quiz, saveAnswers],
  );

  const begin = async () => {
    setPhase('starting');
    if (metadata.proctoringEnabled && metadata.proctoringConfig?.fullscreenRequired) {
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        setPhase('instructions');
        toast.error('Fullscreen permission is required to start this assessment.');
        return;
      }
    }
    const response = await mutation(`quiz/${metadata._id}/start`, {
      method: 'POST',
      isAlert: false,
      dedupe: false,
    });
    const payload = response?.results as
      | IApiResult<IAttemptEnvelope | ICompletedAttemptEnvelope>
      | undefined;
    if (!payload?.success) {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
      setPhase('instructions');
      return;
    }
    if ('completed' in payload.data) {
      setResult(payload.data.result);
      setPhase('result');
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
      return;
    }
    const attempt = payload.data.attempt;
    setQuiz(payload.data.quiz);
    setAnswers(toAnswerMap(attempt.answers ?? []));
    setRevision(attempt.revision ?? 0);
    setSavedRevision(attempt.revision ?? 0);
    const offset = new Date(attempt.serverTime).getTime() - Date.now();
    setClockOffsetMs(offset);
    setExpiresAtMs(new Date(attempt.expiresAt).getTime());
    setPhase('active');
  };

  // Debounced server autosave, plus a periodic safety flush for unreliable networks.
  useEffect(() => {
    if (phase !== 'active' || revision <= savedRevision) return;
    const debounce = window.setTimeout(() => void saveAnswers(true), 800);
    return () => window.clearTimeout(debounce);
  }, [phase, revision, savedRevision, saveAnswers]);
  useEffect(() => {
    if (phase !== 'active') return;
    const interval = window.setInterval(() => void saveAnswers(true), 10_000);
    return () => window.clearInterval(interval);
  }, [phase, saveAnswers]);

  // Timer is derived from the immutable server deadline, so refresh/background throttling cannot reset it.
  useEffect(() => {
    if (phase !== 'active' || !expiresAtMs) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((expiresAtMs - (Date.now() + clockOffsetMs)) / 1000));
      setRemainingSeconds(left);
      if (left === 0) void submit(true);
    };
    tick();
    const interval = window.setInterval(tick, 500);
    return () => window.clearInterval(interval);
  }, [clockOffsetMs, expiresAtMs, phase, submit]);

  // Warn on browser back/refresh. Browsers cannot be made impossible to leave, so answers are server-saved too.
  useEffect(() => {
    if (phase !== 'active') return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const onPopState = () => {
      if (popGuardRef.current) return;
      popGuardRef.current = true;
      history.pushState({ quizGuard: true }, '', window.location.href);
      toast.warning('Submit the assessment before leaving this page.');
      window.setTimeout(() => {
        popGuardRef.current = false;
      }, 250);
    };
    history.pushState({ quizGuard: true }, '', window.location.href);
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('popstate', onPopState);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== 'active' || !quiz?.proctoringEnabled) return;
    const record = async (eventType: 'tab_switch' | 'fullscreen_exit') => {
      const response = await mutation(`quiz/${quiz._id}/proctor-event`, {
        method: 'POST',
        body: { eventType },
        silentError: true,
        dedupe: false,
      });
      const payload = response?.results as IApiResult<{ autoSubmitted: boolean }> | undefined;
      if (payload?.data.autoSubmitted) {
        submitLockRef.current = false;
        await submit(true);
      }
    };
    const onVisibility = () => {
      if (!document.hidden || !activeRef.current) return;
      setViolations((value) => value + 1);
      toast.warning('Leaving the assessment was recorded.');
      void saveAnswers(true).then(() => record('tab_switch'));
    };
    const onFullscreen = () => {
      if (
        !document.fullscreenElement &&
        quiz.proctoringConfig?.fullscreenRequired &&
        activeRef.current
      ) {
        toast.error('Fullscreen exited. Return to fullscreen to continue securely.');
        void record('fullscreen_exit');
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('fullscreenchange', onFullscreen);
    };
  }, [mutation, phase, quiz, saveAnswers, submit]);

  useEffect(() => {
    if (phase !== 'active' || !quiz?.proctoringConfig?.copyPasteDisabled) return;
    const block = (event: ClipboardEvent | MouseEvent) => {
      event.preventDefault();
      toast.warning('Copy, paste and context menu are disabled for this assessment.');
    };
    document.addEventListener('copy', block);
    document.addEventListener('paste', block);
    document.addEventListener('contextmenu', block);
    return () => {
      document.removeEventListener('copy', block);
      document.removeEventListener('paste', block);
      document.removeEventListener('contextmenu', block);
    };
  }, [phase, quiz]);

  const setAnswer = (question: IQuizQuestion, value: Omit<IStudentAnswer, 'questionId'>) => {
    const questionId = question._id ?? question.questionId;
    if (!questionId || phase !== 'active') return;
    setAnswers((previous) => ({ ...previous, [questionId]: { questionId, ...value } }));
    setRevision((value) => value + 1);
  };

  const questions = useMemo(() => quiz?.questions ?? [], [quiz]);
  const question = questions[current];
  const questionId = question?._id ?? question?.questionId ?? '';
  const currentAnswer = answers[questionId];
  const answeredCount = Object.keys(answers).length;

  if (phase === 'instructions' || phase === 'starting') {
    return (
      <div className="fixed inset-0 z-100 flex min-h-dvh items-center justify-center bg-slate-50 p-4 text-slate-900">
        <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6  sm:p-8">
          <ShieldCheck className="mb-5 h-12 w-12 text-primary" />
          <h1 className="text-2xl font-bold">{metadata.title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Your timer begins only after the server securely creates your attempt. Answers are
            autosaved, and reopening this assessment resumes the same deadline.
          </p>
          <div className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <Clock className="mb-2 h-5 w-5" />
              {metadata.durationMinutes} minutes
            </div>
            <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <ShieldCheck className="mb-2 h-5 w-5" />
              Server-side grading
            </div>
          </div>
          {metadata.proctoringEnabled && (
            <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-200">
              Tab changes and fullscreen exits are recorded. Reaching the configured violation limit
              automatically submits your saved answers.
            </div>
          )}
          <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <CustomButton variant="tertiary" onClick={onClose} disabled={phase === 'starting'}>
              Cancel
            </CustomButton>
            <CustomButton
              variant="primary"
              onClick={() => void begin()}
              disabled={phase === 'starting'}
            >
              {phase === 'starting' ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" /> Starting securely…
                </>
              ) : (
                <>
                  <Expand className="h-4 w-4" /> Begin assessment
                </>
              )}
            </CustomButton>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'result' && result) {
    return (
      <div className="fixed inset-0 z-100 flex min-h-dvh items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-7 text-center">
          {result.resultReleased ? (
            <Trophy className="mx-auto h-14 w-14 text-amber-500" />
          ) : (
            <CheckCircle2 className="mx-auto h-14 w-14 text-green-500" />
          )}
          <h2 className="mt-4 text-2xl font-bold text-slate-900">Submission confirmed</h2>
          {result.resultReleased ? (
            <>
              <p className="mt-4 text-5xl font-black text-primary">
                {Math.round(result.percentage ?? 0)}%
              </p>
              <p className="mt-2 text-sm text-slate-500">
                {result.score ?? 0} / {result.maxScore ?? 0} marks
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              Your faculty will release the result after review.
            </p>
          )}
          <CustomButton variant="primary" onClick={onClose} className="mt-7 w-full">
            Return to quizzes
          </CustomButton>
        </div>
      </div>
    );
  }

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  return (
    <div className="fixed inset-0 z-100 flex min-h-dvh flex-col bg-slate-50 text-slate-900 select-none">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-3 py-3 sm:px-5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{quiz?.title}</p>
          <p className="text-xs text-slate-500">
            Question {current + 1} of {questions.length}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          {saveFailed ? (
            <CloudOff className="h-4 w-4 text-red-400" />
          ) : savedRevision < revision ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Cloud className="h-4 w-4 text-green-400" />
          )}
          <span className="hidden sm:inline">
            {saveFailed ? 'Save interrupted' : savedRevision < revision ? 'Saving…' : 'Saved'}
          </span>
        </div>
        <div
          className={`rounded-lg px-3 py-2 font-mono text-sm font-bold ${remainingSeconds < 120 ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-700'}`}
        >
          <Clock className="mr-2 inline h-4 w-4" />
          {pad(minutes)}:{pad(seconds)}
        </div>
        <CustomButton
          variant="primary"
          onClick={() => void submit(false)}
          disabled={phase === 'submitting'}
        >
          {phase === 'submitting' ? 'Submitting…' : 'Submit'}
        </CustomButton>
      </header>
      {violations > 0 && (
        <div className="flex items-center gap-2 bg-amber-100 px-4 py-2 text-xs font-semibold text-amber-900">
          <AlertTriangle className="h-4 w-4" />
          {violations} assessment interruption{violations === 1 ? '' : 's'} recorded
        </div>
      )}
      <main className="flex min-h-0 flex-1">
        <aside className="hidden w-56 overflow-y-auto border-r border-slate-200 bg-white p-4 md:block">
          <p className="mb-3 text-xs font-semibold uppercase text-slate-500">
            Questions · {answeredCount}/{questions.length} answered
          </p>
          <div className="grid grid-cols-5 gap-2">
            {questions.map((item, index) => {
              const id = item._id ?? item.questionId ?? '';
              return (
                <button
                  type="button"
                  key={id}
                  onClick={() => setCurrent(index)}
                  className={`h-8 rounded-lg text-xs font-bold ${index === current ? 'bg-primary text-white' : answers[id] ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
        </aside>
        <section className="flex-1 overflow-y-auto p-4 sm:p-8">
          {question && (
            <div className="mx-auto max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Question {current + 1} · {question.marks} mark{question.marks === 1 ? '' : 's'}
              </p>
              <h2 className="mt-3 text-lg font-semibold leading-8 sm:text-xl">
                {question.questionText}
              </h2>
              {question.questionType === 'mcq' && (
                <div className="mt-7 space-y-3">
                  {(question.options ?? []).map((option, index) => (
                    <button
                      type="button"
                      key={`${questionId}-${index}`}
                      onClick={() => setAnswer(question, { selectedOption: index })}
                      className={`flex w-full items-center gap-3 rounded-xl p-4 text-left text-sm ring-1 ring-inset ${currentAnswer?.selectedOption === index ? 'bg-primary text-white ring-primary' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'}`}
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100/80 font-bold text-slate-700">
                        {String.fromCharCode(65 + index)}
                      </span>
                      {option.optionText}
                    </button>
                  ))}
                </div>
              )}
              {question.questionType === 'true_false' && (
                <div className="mt-7 grid grid-cols-2 gap-3">
                  {['true', 'false'].map((value) => (
                    <button
                      type="button"
                      key={value}
                      onClick={() => setAnswer(question, { textAnswer: value })}
                      className={`rounded-xl p-4 font-semibold capitalize ring-1 ring-inset ${currentAnswer?.textAnswer === value ? 'bg-primary text-white ring-primary' : 'bg-white text-slate-700 ring-slate-200'}`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              )}
              {question.questionType === 'short_answer' && (
                <textarea
                  rows={6}
                  value={currentAnswer?.textAnswer ?? ''}
                  onChange={(event) => setAnswer(question, { textAnswer: event.target.value })}
                  className="mt-7 w-full resize-none rounded-xl bg-white p-4 text-sm text-slate-800 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-primary"
                  placeholder="Type your answer…"
                />
              )}
              <div className="mt-8 flex justify-between gap-3">
                <CustomButton
                  variant="tertiary"
                  onClick={() => setCurrent((value) => Math.max(0, value - 1))}
                  disabled={current === 0}
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </CustomButton>
                <CustomButton
                  variant="secondary"
                  onClick={() => setCurrent((value) => Math.min(questions.length - 1, value + 1))}
                  disabled={current === questions.length - 1}
                >
                  Next <ChevronRight className="h-4 w-4" />
                </CustomButton>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
