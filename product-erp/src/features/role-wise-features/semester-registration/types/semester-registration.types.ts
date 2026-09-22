export type TRegStatus = 'draft' | 'submitted' | 'approved' | 'frozen' | 'rejected' | 'withdrawn';

export type TSubjectType =
  | 'theory'
  | 'lab'
  | 'elective'
  | 'open_elective'
  | 'project'
  | 'seminar'
  | 'audit';

export interface IRegisteredSubject {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  credits: number;
  type: TSubjectType;
  isBacklog?: boolean;
}

export interface ISemesterRegistration {
  _id: string;
  studentId: string;
  rollNumber: string;
  studentName: string;
  program: string;
  branch: string;
  departmentId: string | { _id: string; name: string };
  targetSemester: number;
  academicYear: string;
  registeredSubjects: IRegisteredSubject[];
  totalCredits: number;
  status: TRegStatus;
  submittedAt?: string;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  frozenAt?: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}
