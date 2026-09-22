export type TTrainingMode = 'Offline' | 'Online' | 'Hybrid';
export type TTrainingStatus =
  | 'draft'
  | 'scheduled'
  | 'ongoing'
  | 'completed'
  | 'cancelled'
  | 'postponed';

export interface IRegisteredStudentDetail {
  studentId: string;
  rollNumber: string;
  name?: string;
}

export interface IAttendanceEntry {
  studentId: string;
  rollNumber: string;
  status: 'present' | 'absent' | 'late';
  score?: number;
  feedback?: string;
}

export interface ITrainingSession {
  _id: string;
  title: string;
  type: string;
  mode: TTrainingMode;
  description?: string;
  facilitator: string;
  facilitatorOrg?: string;
  facilitatorEmail?: string;
  targetPrograms: string[];
  targetBranches: string[];
  targetBatches: string[];
  targetSemesters?: number[];
  scheduledDate: string;
  registrationStart: string;
  registrationEnd: string;
  startTime: string;
  endTime: string;
  duration: number;
  venue: string;
  meetingLink?: string;
  maxParticipants?: number;
  registeredStudents: string[];
  registeredStudentDetails?: IRegisteredStudentDetail[];
  attendanceMarked: boolean;
  attendance: IAttendanceEntry[];
  totalPresent: number;
  totalAbsent: number;
  materialUrl?: string;
  recordingUrl?: string;
  assignmentGiven?: string;
  status: TTrainingStatus;
  averageRating?: number;
  feedbackCount?: number;
  eligible?: boolean;
  reasons?: string[];
  registeredCount?: number;
  isRegistered?: boolean;
  createdAt?: string;
  [key: string]: unknown;
}
