export type TFramework = string;
export type TFieldType = 'text' | 'number' | 'date' | 'boolean';
export type TComplianceStatus =
  | 'not_started'
  | 'in_progress'
  | 'submitted'
  | 'approved'
  | 'non_compliant';

export interface IRequirementField {
  key: string;
  label: string;
  type: TFieldType;
  required: boolean;
}

export interface IComplianceRequirement {
  _id: string;
  framework: TFramework;
  code: string;
  title: string;
  description?: string;
  category: string;
  frequency: 'once' | 'monthly' | 'quarterly' | 'half_yearly' | 'annual';
  applicablePrograms: string[];
  departmentIds: Array<string | { _id: string; name?: string; code?: string }>;
  ownerIds: Array<string | { _id: string; name?: string; email?: string }>;
  reviewerIds: Array<string | { _id: string; name?: string; email?: string }>;
  requiredFields: IRequirementField[];
  targetValue?: number;
  unit?: string;
  dueMonth?: number;
  evidenceValidityDays?: number;
  isActive: boolean;
  [key: string]: unknown;
}

export interface IComplianceSubmission {
  _id: string;
  requirementId: IComplianceRequirement;
  academicYear: string;
  period?: string;
  values: Record<string, string | number | boolean>;
  evidenceFiles: { url: string; name: string }[];
  status: TComplianceStatus;
  remarks?: string;
  evidenceValidUntil?: string;
  submittedBy?: string | { _id: string; name?: string; email?: string };
  updatedAt: string;
  [key: string]: unknown;
}

export interface IComplianceDashboard {
  frameworks: {
    framework: TFramework;
    name: string;
    shortName: string;
    color: string;
    total: number;
    completed: number;
    pending: number;
    score: number;
  }[];
  totalRequirements: number;
  totalSubmissions: number;
  inProgress: number;
  approved: number;
  submitted: number;
  nonCompliant: number;
}

export interface IComplianceFramework {
  _id: string;
  slug: string;
  name: string;
  shortName: string;
  authority?: string;
  country: string;
  region?: string;
  description?: string;
  version: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  institutionTypes: string[];
  terminology: {
    requirement: string;
    submission: string;
    reportingPeriod: string;
  };
  color: string;
  icon: string;
  revisions?: {
    version: string;
    name: string;
    authority?: string;
    archivedAt: string;
  }[];
  isSystem: boolean;
  isActive: boolean;
  [key: string]: unknown;
}

export interface ITallyConfiguration {
  _id?: string;
  companyName: string;
  companyGuid?: string;
  financialYear: string;
  ledgerMappings: { accountCode: string; tallyLedgerName: string }[];
  lastExportedAt?: string;
  isActive: boolean;
}

export interface IComplianceFinding {
  _id: string;
  findingNumber: string;
  submissionId: IComplianceSubmission;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  ownerId: string | { _id: string; name?: string; email?: string };
  dueAt: string;
  status: 'open' | 'remediation_in_progress' | 'pending_verification' | 'closed';
  remediationPlan?: string;
  evidenceFiles: { name: string; url: string }[];
  closureNote?: string;
  updatedAt: string;
  [key: string]: unknown;
}
