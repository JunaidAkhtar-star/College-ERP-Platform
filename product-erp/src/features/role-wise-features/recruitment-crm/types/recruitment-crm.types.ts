export type TRecruitmentStage =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'application_started'
  | 'applied'
  | 'enrolled'
  | 'lost';
export type TRecruitmentSource =
  | 'website'
  | 'walk_in'
  | 'referral'
  | 'campaign'
  | 'school_visit'
  | 'other';
export interface IRecruitmentLead extends Record<string, unknown> {
  _id: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone: string;
  source: TRecruitmentSource;
  stage: TRecruitmentStage;
  score: number;
  programInterest?: { _id: string; name: string; code?: string };
  ownerId?: { _id: string; name: string; email: string };
  nextFollowUpAt?: string;
  consentToContact: boolean;
}
export interface IRecruitmentList {
  data: IRecruitmentLead[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
export interface IRecruitmentDashboard {
  stages: Partial<Record<TRecruitmentStage, number>>;
  overdue: number;
  dueToday: number;
  unassigned: number;
}
