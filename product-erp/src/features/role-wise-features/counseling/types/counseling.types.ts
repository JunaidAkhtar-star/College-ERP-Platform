export type TCounselingType =
  | 'academic'
  | 'personal'
  | 'career'
  | 'disciplinary'
  | 'medical'
  | 'financial';
export type TCounselingStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'follow_up_required'
  | 'parent_meeting_required';
export type TCounselingMode = 'in_person' | 'online' | 'phone';

export interface IFollowUpAction {
  action: string;
  dueDate?: string;
  completedAt?: string;
  isCompleted: boolean;
}

export interface ICounselingSession {
  _id: string;
  sessionNumber: string;
  student: string | { _id: string; name?: string; rollNumber?: string };
  counselor: string | { _id: string; name?: string };
  studentName?: string;
  counselorName?: string;
  type: TCounselingType;
  scheduledAt: string;
  conductedAt?: string;
  durationMinutes?: number;
  mode: TCounselingMode;
  venue?: string;
  issueDescription: string;
  counselorNotes?: string;
  followUpActions: IFollowUpAction[];
  parentMeetingRequired: boolean;
  parentMeetingDate?: string;
  parentMeetingNotes?: string;
  parentNotified: boolean;
  status: TCounselingStatus;
  outcome?: string;
  nextSessionDate?: string;
  academicYear: string;
  semester?: number;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export interface ICreateSessionDto {
  studentId: string;
  type: TCounselingType;
  scheduledAt: string;
  mode: TCounselingMode;
  issueDescription: string;
  academicYear: string;
  semester?: number;
  venue?: string;
}

export interface IConductSessionDto {
  conductedAt?: string;
  durationMinutes?: number;
  counselorNotes?: string;
  followUpActions?: { action: string; dueDate?: string }[];
  outcome?: string;
  nextSessionDate?: string;
  parentMeetingRequired?: boolean;
  parentMeetingDate?: string;
  parentMeetingNotes?: string;
}

export interface ICounselingStats {
  totalSessions: number;
  completedSessions: number;
  pendingSessions: number;
  followUpRequired: number;
}
