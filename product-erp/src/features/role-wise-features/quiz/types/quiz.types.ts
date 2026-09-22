/**
 * @file quiz.types.ts
 * @description Quiz domain types — aligned with backend IQuiz model.
 */

export type TQuizStatus = 'draft' | 'published' | 'closed';
export type TQuizType = 'scheduled' | 'surprise';
export type TQuestionType = 'mcq' | 'true_false' | 'short_answer';

export interface IQuizOption {
  optionText: string;
  isCorrect: boolean;
}

export interface IQuizQuestion {
  _id?: string;
  questionId?: string;
  questionText: string;
  questionType: TQuestionType;
  options?: IQuizOption[];
  correctAnswer?: string;
  marks: number;
}

export interface IAnswer {
  questionId: string;
  selectedOption?: number;
  textAnswer?: string;
  isCorrect: boolean;
  marksAwarded: number;
}

export interface IQuizAttempt {
  _id?: string;
  studentId: string;
  startedAt: string;
  expiresAt: string;
  submittedAt?: string;
  answers: IAnswer[];
  totalMarks: number;
  percentage: number;
  timeTakenSeconds: number;
  isSubmitted: boolean;
}

export interface IQuizAttemptSummary {
  startedAt: string;
  expiresAt: string;
  submittedAt?: string;
  isSubmitted: boolean;
  score?: number;
  maxScore?: number;
  percentage?: number;
}

export interface IProctoringConfig {
  fullscreenRequired: boolean;
  copyPasteDisabled: boolean;
  tabSwitchLimit: number;
  screenshotIntervalSec: number;
  webcamRequired: boolean;
}

export interface IQuiz {
  _id: string;
  title: string;
  description?: string;
  subjectId: string;
  subjectCode: string;
  subjectName?: string;
  facultyId: string;
  departmentId: string;
  program: string;
  semester: number;
  section: string;
  academicYear: string;
  quizType: TQuizType;
  questions?: IQuizQuestion[];
  questionCount?: number;
  totalMarks: number;
  durationMinutes: number;
  startDateTime?: string;
  endDateTime?: string;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showResultImmediately: boolean;
  attempts?: IQuizAttempt[];
  myAttempt?: IQuizAttemptSummary;
  status?: TQuizStatus;
  isActive: boolean;
  proctoringEnabled: boolean;
  proctoringConfig: IProctoringConfig;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export interface ICreateQuizDto {
  title: string;
  description?: string;
  subjectId: string;
  subjectCode: string;
  program: string;
  semester: number;
  section: string;
  academicYear: string;
  quizType: TQuizType;
  durationMinutes: number;
  startDateTime?: string;
  endDateTime?: string;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showResultImmediately: boolean;
  proctoringEnabled: boolean;
  proctoringConfig: IProctoringConfig;
  questions: IQuizQuestion[];
}
