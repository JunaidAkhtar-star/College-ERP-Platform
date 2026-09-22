export interface ICourseOutcome {
  coCode: string;
  description: string;
  bloomsLevel: 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';
}

export interface ICurriculumSubjectEntry {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  credits: number;
  theoryHours: number;
  labHours: number;
  tutorialHours: number;
  isElective: boolean;
  electiveGroup?: string;
  courseOutcomes: ICourseOutcome[];
}

export interface ISemesterPlan {
  semesterNo: number;
  subjects: ICurriculumSubjectEntry[];
  totalCredits: number;
  totalTheoryHours: number;
  totalLabHours: number;
}

export interface ICurriculum {
  _id: string;
  program: string;
  academicLevel?: 'certificate' | 'diploma' | 'undergraduate' | 'postgraduate' | 'doctoral';
  openForAdmissions?: boolean;
  regulationYear: string;
  totalSemesters: number;
  totalCreditsRequired: number;
  semesterPlans: ISemesterPlan[];
  programOutcomes: { poCode: string; description: string }[];
  version: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export interface ICreateCurriculumDto {
  program: string;
  academicLevel: 'certificate' | 'diploma' | 'undergraduate' | 'postgraduate' | 'doctoral';
  openForAdmissions: boolean;
  regulationYear: string;
  totalSemesters: number;
  totalCreditsRequired: number;
  version: number;
  isActive: boolean;
}
