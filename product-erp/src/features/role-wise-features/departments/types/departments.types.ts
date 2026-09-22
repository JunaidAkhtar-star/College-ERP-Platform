export type TDepartmentStatus = 'Active' | 'Inactive';

export interface ICurriculumRef {
  _id: string;
  program: string;
  regulationYear?: string;
  totalSemesters?: number;
}

export interface IDepartment {
  _id: string;
  code: string;
  name: string;
  shortName: string;
  hodId?: string;
  hodName?: string;
  curriculumIds: Array<string | ICurriculumRef>;
  programs: string[];
  vision?: string;
  mission?: string;
  email?: string;
  phone?: string;
  location?: string;
  naacCode?: string;
  aicteCode?: string;
  intake: number;
  status: TDepartmentStatus;
  establishedYear?: number;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export interface ICreateDepartmentDto {
  code: string;
  name: string;
  shortName: string;
  hodName?: string;
  curriculumIds: string[];
  programs: string[];
  email?: string;
  phone?: string;
  location?: string;
  intake: number;
  status: TDepartmentStatus;
  establishedYear?: number;
  vision?: string;
  mission?: string;
  naacCode?: string;
  aicteCode?: string;
}

export interface IDepartmentListResponse {
  success: boolean;
  data: IDepartment[];
  total: number;
}
