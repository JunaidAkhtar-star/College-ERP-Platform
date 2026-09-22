export type TSubjectType =
  | 'Theory'
  | 'Practical'
  | 'Project'
  | 'Seminar'
  | 'Elective'
  | 'Open Elective';
export type TSubjectCategory =
  | 'Core'
  | 'Professional Elective'
  | 'Open Elective'
  | 'Mandatory'
  | 'Audit'
  | 'Extra-Curricular';

export interface ISubject {
  _id: string;
  code: string;
  name: string;
  shortName: string;
  departmentId: string;
  departmentCode: string;
  type: TSubjectType;
  category: TSubjectCategory;
  credits: number;
  lectureHours: number;
  tutorialHours: number;
  practicalHours: number;
  totalHours: number;
  semester?: number;
  program?: string;
  internalMarks: number;
  externalMarks: number;
  totalMarks: number;
  passMarksInternal: number;
  passMarksExternal: number;
  bputPaperCode?: string;
  syllabusPdfUrl?: string;
  hasLabComponent: boolean;
  isElective: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export interface ICreateSubjectDto {
  code: string;
  name: string;
  shortName: string;
  departmentId: string;
  departmentCode: string;
  type: TSubjectType;
  category: TSubjectCategory;
  credits: number;
  lectureHours: number;
  tutorialHours: number;
  practicalHours: number;
  internalMarks: number;
  externalMarks: number;
  passMarksInternal: number;
  passMarksExternal: number;
  hasLabComponent: boolean;
  isElective: boolean;
  bputPaperCode?: string;
}
