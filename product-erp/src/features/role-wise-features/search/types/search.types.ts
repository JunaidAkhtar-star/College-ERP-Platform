export type TSearchIndex = 'users' | 'students' | 'faculty';

export interface ISearchResult {
  _id: string;
  name?: string;
  email?: string;
  rollNumber?: string;
  employeeId?: string;
  department?: string | { _id: string; name: string };
  [key: string]: unknown;
}

export interface ISearchResponse {
  success: boolean;
  data: ISearchResult[];
}
