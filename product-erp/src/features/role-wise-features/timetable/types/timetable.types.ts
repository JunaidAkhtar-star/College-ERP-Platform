/**
 * @file timetable.types.ts
 * @description TypeScript interfaces for the Timetable module.
 * @module features/role-wise-features/timetable/types
 */

export type TDay = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
export type TSemesterType = 'odd' | 'even';
export type TClassType = 'theory' | 'lab' | 'tutorial';
export type TSlotKind = 'teaching' | 'break' | 'activity';

export interface ITimetableSlot {
  _id?: string;
  day: TDay;
  periodNo: number;
  startTime: string;
  endTime: string;
  slotKind?: TSlotKind;
  title?: string;
  subjectId?: string;
  subjectCode: string;
  subjectShortName?: string;
  subjectName: string;
  facultyId?: string;
  facultyName: string;
  facultyCode?: string;
  facultyDepartmentId?: string;
  roomId?: string;
  roomNo: string;
  roomName?: string;
  roomBuilding?: string;
  roomFloor?: string;
  classType: TClassType;
  labBatch?: string;
  branches?: string[];
  isCombined?: boolean;
  branch?: string;
  branchDepartmentId?: string;
  branchDepartmentIds?: string[];
}

export interface ITimetable {
  [key: string]: unknown;
  _id: string;
  sectionId?:
    | string
    | { _id: string; sectionName: string; semesterNo: number; academicYear: string };
  batchId?: string | { _id: string; name: string; admissionYear: number };
  curriculumId?: string | { _id: string; program: string; regulationYear: string };
  academicYear: string;
  scheduleStartTime?: string;
  scheduleEndTime?: string;
  title?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  documentNo?: string;
  semesterType: TSemesterType;
  departmentId: string | { _id: string; name: string; code: string };
  program: string;
  branches?: string[];
  branchDepartmentIds?: string[];
  semester: number;
  section: string;
  slots: ITimetableSlot[];
  isActive: boolean;
  isApproved: boolean;
  approvedBy?: string | { _id: string; name: string };
  approvedAt?: string;
  substituteLog?: Array<{
    _id: string;
    slotIndex: number;
    substituteFacultyId: string | { _id: string; name: string };
    date: string;
    reason: string;
    status?: 'active' | 'cancelled';
    cancelledAt?: string;
    cancellationReason?: string;
  }>;
  createdBy: string | { _id: string; name: string };
  updatedBy?: string | { _id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface ICreateTimetableDto {
  sectionId?: string;
  academicYear: string;
  scheduleStartTime?: string;
  scheduleEndTime?: string;
  title?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  documentNo?: string;
  semesterType: TSemesterType;
  departmentId: string;
  program: string;
  branches?: string[];
  branchDepartmentIds?: string[];
  semester: number;
  section: string;
  slots: ITimetableSlot[];
}

export interface IDepartmentOption {
  _id: string;
  name: string;
  code: string;
}
