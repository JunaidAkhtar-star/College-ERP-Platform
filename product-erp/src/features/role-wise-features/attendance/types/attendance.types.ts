/**
 * @file attendance.types.ts
 * @description Typed domain interfaces and models for the attendance feature.
 * @module features/attendance
 */

export type AttendanceStatus = 'P' | 'A' | 'L' | 'M' | 'OD' | 'H';
export type ClassType = 'Lecture' | 'Tutorial' | 'Practical' | 'Extra Class';

export interface IAttendanceEntry {
  studentId: string;
  studentName?: string;
  rollNumber: string;
  departmentCode?: string;
  program?: string;
  semester?: number;
  status: AttendanceStatus;
  remarks?: string;
}

export interface IAttendanceRecord {
  _id: string;
  sectionId?: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  facultyId?: string;
  facultyName?: string;
  departmentId?: string;
  classType: ClassType;
  program: string;
  branch: string;
  semester: number;
  section: string;
  academicYear: string;
  date: string;
  startTime: string;
  endTime: string;
  periodNumber: number;
  entries: IAttendanceEntry[];
  totalPresent: number;
  totalAbsent: number;
  totalStrength: number;
  isLocked: boolean;
  correctionRequests?: ICorrectionRequest[];
  [key: string]: unknown;
}

export interface ICorrectionRequest {
  studentId: string | { _id: string; name?: string; email?: string };
  studentName?: string;
  rollNumber?: string;
  requestedStatus: AttendanceStatus;
  reason: string;
  status?: 'pending' | 'approved' | 'rejected';
  createdAt?: string;
}

export interface IAttendanceSummary {
  subjectId: string;
  subjectCode: string;
  subjectName?: string;
  totalClasses: number;
  attended: number;
  absent: number;
  late: number;
  percentage: number;
  [key: string]: unknown;
}

export interface IShortage {
  studentId: string;
  studentName?: string;
  rollNo?: string;
  program?: string;
  branch?: string;
  subjectCode?: string;
  subjectName?: string;
  percentage: number;
  totalClasses: number;
  attended: number;
  [key: string]: unknown;
}

export interface ITimetableSlotApi {
  _id: string;
  day: string;
  periodNo: number;
  startTime: string;
  endTime: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  facultyId?: string;
  facultyName?: string;
  roomNo: string;
  roomName?: string;
  roomBuilding?: string;
  roomFloor?: string;
  branchDepartmentId?: string;
  branchDepartmentIds?: string[];
  classType: 'theory' | 'lab' | 'tutorial';
  slotKind?: 'teaching' | 'break' | 'activity';
  branch?: string | null;
  branches?: string[];
  isCombined?: boolean;
}

export interface ITimetableApi {
  _id: string;
  sectionId?:
    | string
    | { _id: string; sectionName: string; semesterNo: number; academicYear: string };
  academicYear: string;
  semesterType: 'odd' | 'even';
  departmentId: string | { _id: string };
  program: string;
  semester: number;
  section: string;
  slots: ITimetableSlotApi[];
}

export interface ISelectedClass {
  scheduledDate?: string;
  sectionId?: string;
  timetableId?: string;
  timetableSlotId?: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  departmentId: string;
  program: string;
  branch: string;
  semester: number;
  section: string;
  academicYear: string;
  startTime: string;
  endTime: string;
  periodNumber: number;
  classType: ClassType;
  roomNo?: string;
}

export interface IStudentLite {
  _id: string;
  userId?: string | { _id: string; name?: string; email?: string };
  rollNumber: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  name?: string;
  fullName?: string;
  avatar?: string;
  program?: string;
  currentSemester?: number;
  branch?: string;
  section?: string;
}

export interface IAllotmentLite {
  _id: string;
  rollNo: string;
  studentId: string | { _id: string; name?: string; email?: string };
  studentProfileId?:
    | string
    | { _id: string; rollNumber?: string; firstName?: string; lastName?: string };
}
