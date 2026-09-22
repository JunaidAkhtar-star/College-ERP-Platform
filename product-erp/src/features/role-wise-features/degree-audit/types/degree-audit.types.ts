export type TDegreeRequirementStatus = 'completed' | 'transferred' | 'planned' | 'remaining';

export interface IDegreeRequirement {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  credits: number;
  semester: number;
  isElective: boolean;
  electiveGroup?: string;
  status: TDegreeRequirementStatus;
  completedCredits: number;
  grade?: string;
  completedSemester?: number;
  plannedSemester?: number;
}

export interface IAcademicPlan {
  _id: string;
  goalGraduationTerm?: string;
  notes?: string;
  status: 'draft' | 'submitted' | 'approved' | 'returned';
  items: Array<{
    subjectId: string;
    subjectCode: string;
    subjectName: string;
    credits: number;
    plannedSemester: number;
    status: string;
  }>;
  reviewRemarks?: string;
}

export interface ITransferEvaluation {
  _id: string;
  externalInstitution: string;
  externalProgramme: string;
  referenceNumber: string;
  status: string;
  courses: Array<{
    _id: string;
    externalCourseCode: string;
    externalCourseName: string;
    externalCredits: number;
    targetSubjectCode?: string;
    targetSubjectName?: string;
    approvedCredits: number;
    decision: 'pending' | 'approved' | 'rejected';
  }>;
}

export interface IDegreeAudit {
  student: {
    _id: string;
    name: string;
    rollNumber: string;
    program: string;
    batch: string;
    currentSemester: number;
    departmentId: string;
  };
  curriculum: {
    _id: string;
    program: string;
    regulationYear: string;
    totalSemesters: number;
    totalCreditsRequired: number;
  };
  summary: {
    creditsEarned: number;
    remainingCredits: number;
    completionPercent: number;
    completedRequirements: number;
    totalRequirements: number;
    backlogs: number;
    graduationReady: boolean;
  };
  requirements: IDegreeRequirement[];
  plan?: IAcademicPlan;
  transferEvaluations: ITransferEvaluation[];
}
