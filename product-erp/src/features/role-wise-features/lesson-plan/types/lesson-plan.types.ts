/**
 * @file lesson-plan.types.ts
 * @description Frontend contracts matching the governed backend lesson-plan lifecycle.
 * @module features/role-wise-features/lesson-plan
 */

export type TLessonPlanStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export interface IUnitPlan {
  unitNo: number;
  unitTitle: string;
  plannedTopics: string[];
  plannedClasses: number;
  plannedStartDate: string;
  plannedEndDate: string;
  coMappings: string[];
  actualClasses: number;
  isComplete: boolean;
}

export interface ILessonPlan {
  _id: string;
  sectionId:
    | string
    | { _id: string; sectionName: string; semesterNo: number; academicYear: string };
  curriculumId: string;
  subjectId: string | { _id: string; name: string; code: string };
  subjectCode: string;
  subjectName: string;
  facultyId: string | { _id: string; name: string; email?: string };
  facultyName?: string;
  departmentId: string;
  program: string;
  semester: number;
  section: string;
  academicYear: string;
  semesterType: 'odd' | 'even';
  totalUnits: number;
  totalPlannedClasses: number;
  unitPlans: IUnitPlan[];
  status: TLessonPlanStatus;
  submittedAt?: string;
  approvedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export interface ICreateLessonPlanDto {
  sectionId: string;
  subjectId: string;
  unitPlans: Array<
    Pick<
      IUnitPlan,
      | 'unitNo'
      | 'unitTitle'
      | 'plannedTopics'
      | 'plannedClasses'
      | 'plannedStartDate'
      | 'plannedEndDate'
      | 'coMappings'
    >
  >;
}
