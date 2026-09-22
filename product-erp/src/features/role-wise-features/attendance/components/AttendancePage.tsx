/**
 * @file AttendancePage.tsx
 * @description Attendance feature orchestrator handling role-scoped tabs, records, marking, and shortage triage.
 * @module features/attendance
 */

'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  BarChart2,
  BookOpen,
  CheckCircle,
  RefreshCw,
} from 'lucide-react';
import { AnimatePresence, motion } from '@/shared/utils/motion';
import CustomButton from '@/shared/core/CustomButton';
import { useHasRole, useHasAnyRole } from '@/shared/hooks/useHasRole';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import { TSystemRole } from '@/shared/types';
import { ANALYTICS_ROLES, FACULTY_ROLES } from '../utils/attendance.constants';

// Subcomponents & Panels
import MarkAttendancePanel from './mark/MarkAttendancePanel';
import TodayRecordsPanel from './panels/TodayRecordsPanel';
import SubjectStatsPanel from './panels/SubjectStatsPanel';
import StudentLookupPanel from './panels/StudentLookupPanel';
import StudentSummaryPanel from './panels/StudentSummaryPanel';
import ShortageListPanel from './panels/ShortageListPanel';
import CorrectionsPanel from './panels/CorrectionsPanel';
import CorrectionModal from './modals/CorrectionModal';

type Tab = 'mark' | 'records' | 'summary' | 'shortage' | 'corrections' | 'subject' | 'lookup';

export default function AttendancePage() {
  const isAnalytics = useHasAnyRole(ANALYTICS_ROLES as TSystemRole[]);
  const isFaculty = useHasAnyRole(FACULTY_ROLES as TSystemRole[]);
  const isStudent = useHasRole('student');
  const isHod = useHasRole('hod');
  const isFacultyOnly = useHasRole('faculty');
  const canView = useHasPermission('student_attendance', 'view');
  const canCreate = useHasPermission('student_attendance', 'create');
  const canApprove = useHasPermission('student_attendance', 'approve');
  const canExport = useHasPermission('student_attendance', 'export');
  const canMark = isFaculty && canCreate;
  const canRequestCorrection = isStudent && canCreate;
  const canLockInstitutionAttendance = isAnalytics && canApprove;

  const [showCorrectionModal, setShowCorrectionModal] = useState(false);

  const tabDefs: { id: Tab; label: string; icon: React.ElementType; show: boolean }[] = [
    { id: 'mark', label: 'Mark', icon: CheckCircle, show: canMark },
    {
      id: 'records',
      label: isHod ? 'Department Register' : isAnalytics ? 'Institution Register' : 'My Records',
      icon: BookOpen,
      show: isFaculty && canView,
    },
    { id: 'subject', label: 'Subject Sessions', icon: BarChart2, show: isFaculty && canView },
    {
      id: 'lookup',
      label: 'Student Lookup',
      icon: AlertTriangle,
      show: (isAnalytics || isFaculty) && canView,
    },
    { id: 'summary', label: 'My Attendance', icon: BarChart2, show: isStudent && canView },
    {
      id: 'shortage',
      label: isHod ? 'Department Shortage' : 'Shortage',
      icon: AlertTriangle,
      show: (isAnalytics || isHod) && canView,
    },
    {
      id: 'corrections',
      label: 'Corrections',
      icon: RefreshCw,
      show: (isAnalytics || isHod) && canApprove,
    },
  ];
  const tabs = tabDefs.filter((t) => t.show);
  const [active, setActive] = useState<Tab>(tabs[0]?.id ?? 'summary');
  const resolvedActive = tabs.some((tab) => tab.id === active)
    ? active
    : (tabs[0]?.id ?? 'summary');

  return (
    <div className="attendance-page space-y-5">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {isStudent
              ? 'My Attendance'
              : isFacultyOnly
                ? 'Class Attendance Register'
                : isHod
                  ? 'Department Attendance Control'
                  : 'Attendance & Operations'}
          </h1>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            {isStudent
              ? 'Track your course attendance percentage and submit correction requests'
              : isFacultyOnly
                ? 'Choose an assigned class, confirm its roster, and record period attendance'
                : isHod
                  ? 'Monitor department-wide class coverage, student shortage thresholds, and approve correction requests'
                  : 'Monitor attendance trends, shortage registers, and lock semester records'}
          </p>
        </div>
        {canRequestCorrection && (
          <CustomButton
            variant="secondary"
            onClick={() => setShowCorrectionModal(true)}
            startIcon={<RefreshCw className="h-4 w-4" />}
            className="w-fit!"
          >
            Request Correction
          </CustomButton>
        )}
      </motion.div>

      {tabs.length > 1 && (
        <div className="max-w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 sm:w-fit">
          <div className="flex w-max gap-1 rounded-xl bg-slate-50 p-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActive(tab.id)}
                  className={`flex min-h-10 items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
                    resolvedActive === tab.id
                      ? 'bg-primary text-white'
                      : 'bg-transparent text-slate-500 hover:bg-white hover:text-slate-800'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={resolvedActive}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
        >
          {resolvedActive === 'mark' && <MarkAttendancePanel />}
          {resolvedActive === 'records' && <TodayRecordsPanel />}
          {resolvedActive === 'subject' && <SubjectStatsPanel />}
          {resolvedActive === 'lookup' && <StudentLookupPanel />}
          {resolvedActive === 'summary' && <StudentSummaryPanel />}
          {resolvedActive === 'shortage' && (
            <ShortageListPanel canLock={canLockInstitutionAttendance} canExport={canExport} />
          )}
          {resolvedActive === 'corrections' && <CorrectionsPanel />}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {showCorrectionModal && canRequestCorrection && (
          <CorrectionModal onClose={() => setShowCorrectionModal(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
