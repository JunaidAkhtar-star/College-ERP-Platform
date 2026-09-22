type Ref<T extends Record<string, unknown> = Record<string, unknown>> =
  | string
  | ({ _id: string } & T);

export interface IBatch {
  _id: string;
  name: string;
  curriculumId: Ref<{ program?: string; regulationYear?: string; totalSemesters?: number }>;
  departmentId: Ref<{ name?: string; code?: string }>;
  program: string;
  departmentCode: string;
  admissionYear: number;
  regulationYear: string;
  expectedGraduationYear: number;
  intake: number;
  status: string;
  [key: string]: unknown;
}

export interface ISection {
  _id: string;
  academicYear: string;
  batchId: Ref<{ name?: string; admissionYear?: number }>;
  curriculumId: Ref<{ program?: string; regulationYear?: string }>;
  departmentId: Ref<{ name?: string; code?: string }>;
  program: string;
  departmentCode: string;
  semesterNo: number;
  sectionName: string;
  capacity: number;
  classTeacherName?: string;
  status: string;
  [key: string]: unknown;
}

export interface IStudentSectionAllotment {
  _id: string;
  studentId: Ref<{ name?: string; email?: string }>;
  studentProfileId?: Ref<{ rollNumber?: string; firstName?: string; lastName?: string }>;
  sectionId: Ref<{ sectionName?: string; semesterNo?: number; academicYear?: string }>;
  batchId: Ref<{ name?: string; admissionYear?: number }>;
  academicYear: string;
  semesterNo: number;
  rollNo: string;
  status: string;
  transferHistory?: Array<{ reason: string; changedAt: string }>;
  [key: string]: unknown;
}
