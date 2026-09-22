export interface IRiskSignal {
  key: string;
  label: string;
  value: number;
  threshold: number;
  score: number;
  severity: 'low' | 'medium' | 'high';
  explanation: string;
}

export interface IStudentSuccessCase {
  _id: string;
  title: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'contacted' | 'in_progress' | 'monitoring' | 'resolved' | 'closed';
  assignedAdvisorId: string;
  dueAt?: string;
  summary: string;
  interventions: Array<{
    _id: string;
    type: string;
    action: string;
    outcome?: string;
    nextFollowUpAt?: string;
    recordedAt: string;
  }>;
}

export interface IRiskSnapshot {
  _id: string;
  studentProfileId:
    | string
    | {
        _id: string;
        firstName: string;
        middleName?: string;
        lastName: string;
        rollNumber: string;
        program: string;
        currentSemester: number;
      };
  studentId: string;
  departmentId: string;
  mentorId?: string | { _id: string; name: string; email: string };
  academicYear: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  signals: IRiskSignal[];
  calculatedAt: string;
  activeCase?: IStudentSuccessCase;
}
