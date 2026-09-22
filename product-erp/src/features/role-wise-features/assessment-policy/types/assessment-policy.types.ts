export type TPolicyStatus = 'draft' | 'published' | 'retired';
export type TAssessmentSource =
  | 'manual'
  | 'quiz'
  | 'assignment'
  | 'attendance'
  | 'lab_activity'
  | 'examination'
  | 'import';
export type TCalculationMethod =
  | 'sum'
  | 'average'
  | 'best_n'
  | 'drop_lowest'
  | 'weighted'
  | 'scale';
export interface IAssessmentComponent {
  key: string;
  name: string;
  category: string;
  source: TAssessmentSource;
  deliveryMode: 'online' | 'offline' | 'hybrid' | 'not_applicable';
  maximumMarks: number;
  minimumPassMarks: number;
  attemptCount: number;
  method: TCalculationMethod;
  bestCount?: number;
  weight?: number;
  scaleFrom?: number;
  rounding: 'none' | 'nearest_integer' | 'nearest_half' | 'floor' | 'ceil';
  attendanceRequired: boolean;
  allowMakeup: boolean;
  isRequired: boolean;
  displayOrder: number;
}
export interface IAssessmentPolicy {
  _id: string;
  name: string;
  code: string;
  version: number;
  curriculumId?: string;
  program?: string;
  regulationYear?: string;
  semester?: number;
  subjectId?: string;
  subjectType?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  status: TPolicyStatus;
  components: IAssessmentComponent[];
  maximumMarks: number;
  resultTarget: 'internal' | 'external' | 'standalone';
  minimumTotalMarks: number;
  gradeScale: Array<{ letter: string; minimumPercentage: number; point: number }>;
}
export interface IAssessmentActivity {
  _id: string;
  policyId: string;
  componentKey: string;
  subjectId: string;
  sectionId?: string;
  semester: number;
  academicYear: string;
  sequence: number;
  title: string;
  scheduledAt: string;
  maximumMarks: number;
  attendanceRecordId?: string;
  status: 'planned' | 'open' | 'completed' | 'cancelled';
}
export interface IScoreLedger {
  _id: string;
  policyId: string;
  policyCode: string;
  policyVersion: number;
  studentId: string | { _id: string; name?: string; email?: string; studentId?: string };
  subjectId: string | { _id: string; name?: string; code?: string };
  sectionId?:
    | string
    | {
        _id: string;
        sectionName?: string;
        academicYear?: string;
        semesterNo?: number;
        program?: string;
        departmentCode?: string;
      };
  semester: number;
  academicYear: string;
  totalMarks: number;
  maximumMarks: number;
  percentage: number;
  gradeLetter: string;
  gradePoint: number;
  passed: boolean;
  status: 'draft' | 'returned' | 'submitted' | 'verified' | 'frozen';
  reviewNote?: string;
  attempts: Array<{
    componentKey: string;
    rawMarks: number;
    activityId?: string;
    attended?: boolean;
  }>;
}
export interface ISubject {
  _id: string;
  code: string;
  name: string;
  type: string;
}
export interface ICurriculum {
  _id: string;
  program: string;
  regulationYear: string;
  totalSemesters: number;
}
