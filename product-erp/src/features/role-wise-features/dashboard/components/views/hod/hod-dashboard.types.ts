/**
 * @file hod-dashboard.types.ts
 * @description Typed API contract for the department operations dashboard.
 * @module features/dashboard
 */

export interface IHodDepartmentContext {
  name: string;
  code: string;
}

export interface IHodOperations {
  scheduledClassesToday: number;
  attendanceRecordedToday: number;
  attendancePendingToday: number;
  substitutionsToday: number;
  extraClassesToday: number;
  facultyAbsentToday: number;
  studentAttendanceToday: number | null;
}

export interface IHodAttentionSummary {
  attendanceShortage: number;
  subjectsBehind: number;
  pendingLessonPlans: number;
  pendingLeaves: number;
  uncoveredAttendance: number;
  facultyAbsent: number;
}

export interface IHodClass {
  timetableId: string;
  slotId?: string;
  subjectCode: string;
  subjectName: string;
  facultyName: string;
  roomNo: string;
  startTime: string;
  endTime: string;
  program: string;
  semester: number;
  section?: string;
  classType: string;
  isCombined: boolean;
}

export interface IHodExtraClass {
  subjectCode: string;
  subjectName: string;
  facultyName: string;
  roomNo?: string;
  startTime: string;
  endTime: string;
  reason?: string;
}

export interface IHodStudentRisk {
  studentId: string;
  name: string;
  rollNumber: string;
  attendancePercentage: number;
  missedClasses: number;
}

export interface IHodSectionAttendance {
  _id: { branch: string; semester: number; section: string };
  percentage: number;
}

export interface IHodSectionStrength {
  _id: { program: string; semester: number; section: string };
  studentCount: number;
}

export interface IHodAcademicPerformance {
  _id: { semester: number; academicYear: string };
  averageSgpa: number;
  passPercentage: number;
}

export interface IHodSubjectProgress {
  _id: string;
  subjectCode: string;
  subjectName: string;
  program: string;
  semester: number;
  section: string;
  completionPercentage: number;
  totalPlanedClasses: number;
  totalConductedClasses: number;
}

export interface IHodExam {
  title?: string;
  examType: string;
  program: string;
  semester: number;
  subjectCode: string;
  subjectName: string;
  examDate: string;
  startTime: string;
  venue: string;
}

export interface IHodAttendanceTrend {
  _id: string;
  avgPresent: number;
}

export interface IHodMeeting {
  title?: string;
  meetingType?: string;
  agenda?: string;
  scheduledAt?: string;
  mode?: string;
  venue?: string;
  meetingLink?: string;
}

export interface IHodEvent {
  title?: string;
  startDate?: string;
  endDate?: string;
  venue?: string;
}

export interface IHodDashboardData {
  department: IHodDepartmentContext | null;
  generatedAt?: string;
  academicContext?: {
    academicYear?: string;
    semesterType?: string;
  };
  facultyCount: number;
  studentCount: number;
  pendingLeaves: number;
  attendanceTrend: IHodAttendanceTrend[];
  courseCompletion?: {
    avgCompletion?: number;
    totalSubjects?: number;
    completedSubjects?: number;
    behindSchedule?: number;
  } | null;
  workloadStats?: {
    avgWeeklyHours?: number;
    maxWeeklyHours?: number;
    overloadedFaculty?: number;
  } | null;
  operations: IHodOperations;
  attentionSummary: IHodAttentionSummary;
  todayClasses: IHodClass[];
  extraClassesToday?: IHodExtraClass[];
  studentRisk: IHodStudentRisk[];
  sectionAttendance: IHodSectionAttendance[];
  sectionStrength: IHodSectionStrength[];
  academicPerformance: IHodAcademicPerformance[];
  subjectProgress: IHodSubjectProgress[];
  upcomingExams: IHodExam[];
  scheduledMeetings?: IHodMeeting[];
  upcomingEvents?: IHodEvent[];
  lessonPlans: {
    draft: number;
    submitted: number;
    approved: number;
    rejected: number;
  };
}
