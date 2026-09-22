'use client';

import AcademicWorkflowBar from '@/shared/components/AcademicWorkflowBar';
import AsyncSelect from '@/shared/core/AsyncSelect';
import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { type Action, type Column } from '@/shared/core/CustomTable';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { useHasAnyRole } from '@/shared/hooks/useHasRole';
import { ErrorMessage, Field, Form, Formik } from 'formik';
import {
  Activity,
  AlertTriangle,
  Award,
  BookOpenCheck,
  Check,
  CloudCog,
  Play,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'react-toastify';
import * as Yup from 'yup';

interface IApiResponse<T> {
  success: boolean;
  data: T;
}
interface IConnector {
  _id: string;
  name: string;
  provider: 'canvas_lms' | 'moodle_lms' | 'oneroster_1_2' | 'coursera';
  enabled: boolean;
  status: string;
}
interface IMetadata {
  connectors: IConnector[];
  providers: string[];
  standards: string[];
}
interface IProfile extends Record<string, unknown> {
  _id: string;
  name: string;
  connectorId: string | IConnector;
  provider: string;
  standard: string;
  academicYear: string;
  departmentIds: string[];
  directions: { courses: string; rosters: string; assignments: string; grades: string };
  enabled: boolean;
  syncSchedule: 'manual' | 'hourly' | 'daily';
  nextSyncAt?: string;
  lti?: IProfileForm['lti'];
  lastSyncAt?: string;
}
interface ISyncRun extends Record<string, unknown> {
  _id: string;
  profileId: string;
  scope: string;
  direction: string;
  status: string;
  counts: { examined: number; succeeded: number; skipped: number; failed: number };
  startedAt: string;
  completedAt?: string;
  syncErrors?: Array<{ code: string; message: string }>;
}
interface IImportedGrade extends Record<string, unknown> {
  _id: string;
  assignmentId: string | { _id: string; title: string; subjectCode: string; maxMarks: number };
  studentId: string | { _id: string; name: string; email: string };
  externalGradeId: string;
  score: number;
  maximumScore: number;
  feedback?: string;
  status: string;
  importedAt: string;
}
interface ILmsCourse extends Record<string, unknown> {
  _id: string;
  profileId: string | { _id: string; name: string; provider: string };
  provider: string;
  externalCourseId: string;
  title: string;
  description?: string;
  courseUrl?: string;
  skills: string[];
  durationHours?: number;
  certificateAvailable: boolean;
}
interface ILmsEnrollment extends Record<string, unknown> {
  _id: string;
  courseId: string | { _id: string; title: string; provider: string };
  studentId: string | { _id: string; name: string; email: string };
  status: string;
  progressPercent: number;
  learningHours: number;
  lastSyncedAt?: string;
}
interface ILmsCredential extends Record<string, unknown> {
  _id: string;
  courseId: string | { _id: string; title: string; provider: string };
  studentId: string | { _id: string; name: string; email: string };
  type: 'certificate' | 'badge';
  title: string;
  issuedAt: string;
  credentialUrl?: string;
  verificationUrl?: string;
}
interface IProfileForm {
  name: string;
  connectorId: string;
  academicYear: string;
  departmentIds: string[];
  enabled: boolean;
  syncSchedule: 'manual' | 'hourly' | 'daily';
  directions: {
    courses: 'export' | 'disabled';
    rosters: 'export' | 'disabled';
    assignments: 'export' | 'disabled';
    grades: 'import' | 'export' | 'bidirectional' | 'disabled';
  };
  lti: {
    issuer: string;
    clientId: string;
    deploymentId: string;
    authorizationUrl: string;
    tokenUrl: string;
    jwksUrl: string;
  };
}

const fieldClass =
  'mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20 transition';

const profileSchema = Yup.object({
  name: Yup.string().trim().required().max(120),
  connectorId: Yup.string().required('Select a configured LMS connector'),
  academicYear: Yup.string().trim().required(),
  departmentIds: Yup.array().of(Yup.string()),
  enabled: Yup.boolean(),
  syncSchedule: Yup.string().oneOf(['manual', 'hourly', 'daily']).required(),
  directions: Yup.object({
    courses: Yup.string().required(),
    rosters: Yup.string().required(),
    assignments: Yup.string().required(),
    grades: Yup.string().required(),
  }),
  lti: Yup.object({
    issuer: Yup.string().url().nullable(),
    authorizationUrl: Yup.string().url().nullable(),
    tokenUrl: Yup.string().url().nullable(),
    jwksUrl: Yup.string().url().nullable(),
  }),
});

const blank: IProfileForm = {
  name: '',
  connectorId: '',
  academicYear: '',
  departmentIds: [],
  enabled: false,
  syncSchedule: 'manual',
  directions: { courses: 'export', rosters: 'export', assignments: 'export', grades: 'import' },
  lti: {
    issuer: '',
    clientId: '',
    deploymentId: '',
    authorizationUrl: '',
    tokenUrl: '',
    jwksUrl: '',
  },
};
const providerLabel = (provider: string) =>
  ({
    canvas_lms: 'Canvas',
    moodle_lms: 'Moodle',
    oneroster_1_2: 'OneRoster 1.2',
    coursera: 'Coursera for Campus',
  })[provider] ?? provider.replaceAll('_', ' ');

export default function LmsIntegrationPage() {
  const manager = useHasAnyRole(['super_admin', 'admin', 'principal', 'dean_academic']);
  const [profileOpen, setProfileOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<IProfile | null>(null);
  const [reviewing, setReviewing] = useState<IImportedGrade | null>(null);
  const [assigningCourse, setAssigningCourse] = useState<ILmsCourse | null>(null);
  const [courseSearch, setCourseSearch] = useState('');
  const { data: metadataRaw } = useSwr<IApiResponse<IMetadata>>(
    manager ? 'lms-integration/metadata' : null,
  );
  const {
    data: profilesRaw,
    isValidating: validatingProfiles,
    mutate: refreshProfiles,
  } = useSwr<IApiResponse<IProfile[]>>(manager ? 'lms-integration/profiles' : null);
  const { data: runsRaw, mutate: refreshRuns } = useSwr<IApiResponse<ISyncRun[]>>(
    manager ? 'lms-integration/runs' : null,
  );
  const { data: gradesRaw, mutate: refreshGrades } = useSwr<IApiResponse<IImportedGrade[]>>(
    'lms-integration/grades/pending',
  );
  const { data: coursesRaw, mutate: refreshCourses } = useSwr<IApiResponse<ILmsCourse[]>>(
    manager
      ? `lms-integration/courses${courseSearch.trim() ? `?search=${encodeURIComponent(courseSearch.trim())}` : ''}`
      : null,
  );
  const { data: enrollmentsRaw, mutate: refreshEnrollments } = useSwr<
    IApiResponse<ILmsEnrollment[]>
  >(manager ? 'lms-integration/enrollments' : null);
  const { data: credentialsRaw, mutate: refreshCredentials } = useSwr<
    IApiResponse<ILmsCredential[]>
  >(manager ? 'lms-integration/credentials' : null);
  const { mutation, isLoading } = useMutation();
  const profiles = profilesRaw?.data ?? [],
    runs = runsRaw?.data ?? [],
    grades = gradesRaw?.data ?? [],
    courses = coursesRaw?.data ?? [],
    enrollments = enrollmentsRaw?.data ?? [],
    credentials = credentialsRaw?.data ?? [];
  const healthyProfiles = profiles.filter(
    (profile) =>
      profile.enabled &&
      typeof profile.connectorId !== 'string' &&
      profile.connectorId.status === 'healthy',
  ).length;
  const failedRuns = runs.filter((run) =>
    ['failed', 'partially_succeeded'].includes(run.status),
  ).length;
  const metrics: Array<[string, number, LucideIcon, string]> = [
    ['Integration profiles', profiles.length, CloudCog, 'Configured academic connections'],
    ['Healthy connections', healthyProfiles, Activity, 'Enabled and provider-verified'],
    ['Pending grade reviews', grades.length, BookOpenCheck, 'No automatic official posting'],
    ['Runs requiring attention', failedRuns, AlertTriangle, 'Failed or partially completed'],
  ];

  type TTab = 'profiles' | 'sync' | 'courses' | 'progress' | 'grades';
  const [activeTab, setActiveTab] = useState<TTab>('profiles');

  const tabs: Array<{ key: TTab; label: string; icon: React.ReactNode; badge?: number }> = [
    {
      key: 'profiles',
      label: 'Integration Profiles',
      icon: <CloudCog className="h-4 w-4" />,
      badge: profiles.length,
    },
    {
      key: 'sync',
      label: 'Sync History',
      icon: <Activity className="h-4 w-4" />,
      badge: failedRuns || undefined,
    },
    {
      key: 'courses',
      label: 'Provider Courses',
      icon: <BookOpenCheck className="h-4 w-4" />,
      badge: courses.length,
    },
    {
      key: 'progress',
      label: 'Learning Progress',
      icon: <Users className="h-4 w-4" />,
      badge: enrollments.length,
    },
    {
      key: 'grades',
      label: 'Grade Review',
      icon: <Award className="h-4 w-4" />,
      badge: grades.length,
    },
  ];

  const sync = async (profile: IProfile, scope: string) => {
    const key = `lms:${profile._id}:${scope}:${new Date().toISOString().slice(0, 16)}`;
    const response = await mutation(`lms-integration/profiles/${profile._id}/sync`, {
      method: 'POST',
      body: { scope, idempotencyKey: key },
    });
    if (!response?.results?.success) return;
    toast.success(`${scope === 'full' ? 'Full' : scope} synchronization completed`);
    await Promise.all([refreshProfiles(), refreshRuns()]);
  };
  const retryRun = async (run: ISyncRun) => {
    const response = await mutation(`lms-integration/runs/${run._id}/retry`, { method: 'POST' });
    if (!response?.results?.success) return;
    toast.success('Synchronization retry completed');
    await refreshRuns();
  };
  const syncProviderData = async (profile: IProfile, kind: 'courses' | 'progress') => {
    const response = await mutation(`lms-integration/profiles/${profile._id}/${kind}/sync`, {
      method: 'POST',
    });
    if (!response?.results?.success) return;
    toast.success(
      kind === 'courses' ? 'Provider catalogue synchronized' : 'Learning progress synchronized',
    );
    await Promise.all([
      refreshCourses(),
      refreshEnrollments(),
      refreshCredentials(),
      refreshRuns(),
    ]);
  };
  const profileColumns: Column<IProfile>[] = [
    {
      field: 'name',
      title: 'Profile',
      render: (row) => (
        <div>
          <p className="font-semibold text-slate-800">{row.name}</p>
          <p className="text-xs text-slate-600">
            {row.academicYear} · {row.standard.replaceAll('_', ' ')} ·{' '}
            {row.syncSchedule ?? 'manual'}
          </p>
        </div>
      ),
    },
    {
      field: 'provider',
      title: 'Provider',
      cellClassName: '!text-center',
      render: (row) => (
        <div className="flex justify-center">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-[10px] font-black uppercase text-primary">
              {providerLabel(row.provider).slice(0, 3)}
            </span>
            <span className="font-medium text-slate-700">{providerLabel(row.provider)}</span>
          </div>
        </div>
      ),
    },
    {
      field: 'directions',
      title: 'Directions',
      cellClassName: '!text-center',
      render: (row) => (
        <div className="flex justify-center">
          <span className="text-xs text-slate-600">
            Courses ↑ · Rosters ↑ · Assignments ↑ · Grades{' '}
            {row.directions.grades === 'import'
              ? '↓'
              : row.directions.grades === 'bidirectional'
                ? '↕'
                : row.directions.grades === 'export'
                  ? '↑'
                  : 'off'}
          </span>
        </div>
      ),
    },
    {
      field: 'enabled',
      title: 'Status',
      cellClassName: '!text-center',
      render: (row) => (
        <div className="flex justify-center">
          <span
            className={`rounded-full px-2 py-1 text-xs font-semibold ${row.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
          >
            {row.enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      ),
    },
    {
      field: 'lastSyncAt',
      title: 'Last sync',
      cellClassName: '!text-center',
      render: (row) => (
        <div className="flex justify-center">
          <span className="text-xs text-slate-500">
            {row.lastSyncAt ? new Date(row.lastSyncAt).toLocaleString('en-IN') : 'Never'}
          </span>
        </div>
      ),
    },
  ];
  const profileActions: Action<IProfile>[] = [
    {
      tooltip: 'Edit integration profile',
      icon: <Pencil className="h-4 w-4 text-primary" />,
      onClick: (row) => {
        setEditingProfile(row);
        setProfileOpen(true);
      },
    },
    {
      tooltip: 'Synchronize provider course catalogue',
      icon: <BookOpenCheck className="h-4 w-4 text-violet-600" />,
      hidden: (row) => !row.enabled,
      onClick: (row) => void syncProviderData(row, 'courses'),
    },
    {
      tooltip: 'Synchronize progress and credentials',
      icon: <Activity className="h-4 w-4 text-teal-600" />,
      hidden: (row) => !row.enabled,
      onClick: (row) => void syncProviderData(row, 'progress'),
    },
    {
      tooltip: 'Run full synchronization',
      icon: <Play className="h-4 w-4 text-emerald-600" />,
      hidden: (row) => !row.enabled,
      onClick: (row) => void sync(row, 'full'),
    },
  ];
  const gradeColumns: Column<IImportedGrade>[] = [
    {
      field: 'assignmentId',
      title: 'Assignment',
      render: (row) =>
        typeof row.assignmentId === 'string' ? (
          'Mapped assignment'
        ) : (
          <div>
            <p className="font-medium">{row.assignmentId.title}</p>
            <p className="text-xs text-slate-600">{row.assignmentId.subjectCode}</p>
          </div>
        ),
    },
    {
      field: 'studentId',
      title: 'Student',
      render: (row) =>
        typeof row.studentId === 'string' ? (
          'Mapped student'
        ) : (
          <div>
            <p>{row.studentId.name}</p>
            <p className="text-xs text-slate-600">{row.studentId.email}</p>
          </div>
        ),
    },
    {
      field: 'score',
      title: 'Provider score',
      render: (row) => `${row.score} / ${row.maximumScore}`,
    },
    {
      field: 'importedAt',
      title: 'Imported',
      render: (row) => new Date(row.importedAt).toLocaleString('en-IN'),
    },
  ];
  return (
    <div className="mx-auto max-w-375 space-y-6 ">
      <AcademicWorkflowBar />

      <header className="relative overflow-hidden rounded-3xl border border-slate-200 bg-linear-to-br from-white via-slate-50 to-blue-50/60 p-6  sm:p-8">
        <div className="absolute -right-16 -top-16 size-56 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-0 left-0 size-40 rounded-full bg-blue-100/40 blur-2xl" />
        <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-primary">
              <ShieldCheck className="size-3.5" /> Standards-based interoperability
            </p>
            <h1 className="mt-4 text-2xl font-black text-slate-900 sm:text-3xl">
              LMS Integrations
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500 sm:text-base">
              Connect Canvas, Moodle, OneRoster and approved Coursera institutional accounts.
              Synchronizations remain traceable, retry-safe and review-controlled.
            </p>
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value, Icon, description]) => (
          <article
            key={String(label)}
            className="rounded-2xl border border-slate-200 bg-white p-5  transition "
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-600">{String(label)}</p>
                <p className="mt-2 text-3xl font-black text-slate-950">{String(value)}</p>
              </div>
              <span className="rounded-xl bg-primary/10 p-2.5 text-primary">
                <Icon className="size-5" />
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">{String(description)}</p>
          </article>
        ))}
      </section>

      {/* ── Tabbed content area ─────────────────────────────────────────── */}
      <div className="flex shrink-0 gap-2 rounded-xl bg-white p-2 border border-slate-100  w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all cursor-pointer ${
              activeTab === tab.key ? 'bg-primary text-white ' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  activeTab === tab.key
                    ? 'bg-white/20 text-white'
                    : tab.key === 'sync' && failedRuns > 0
                      ? 'bg-rose-100 text-rose-600'
                      : tab.key === 'grades' && grades.length > 0
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-100 text-slate-500'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {/* ── Profiles tab ── */}
        {activeTab === 'profiles' && (
          <div className="space-y-4">
            {manager ? (
              <CustomTable<IProfile>
                columns={profileColumns}
                data={profiles}
                actions={profileActions}
                title="Integration profiles"
                description="Configure LMS connections, Optional LTI 1.3 trust metadata, and Automatic synchronization policies"
                onRefresh={() => refreshProfiles()}
                isRefreshing={validatingProfiles}
                customActions={
                  <CustomButton
                    onClick={() => {
                      setEditingProfile(null);
                      setProfileOpen(true);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    New profile
                  </CustomButton>
                }
                options={{
                  bordered: false,
                  responsive: true,
                  export: false,
                  actionsType: 'dropdown',
                }}
              />
            ) : (
              <div className="rounded-2xl bg-white border border-slate-200 p-8 text-center ">
                <CloudCog className="mx-auto size-8 text-slate-300" />
                <p className="mt-3 font-semibold text-slate-700">No access</p>
                <p className="mt-1 text-sm text-slate-500">
                  Integration management requires an admin or principal role.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Sync History tab ── */}
        {activeTab === 'sync' && (
          <CustomTable
            columns={[
              { field: 'scope', title: 'Scope' },
              {
                field: 'status',
                title: 'Status',
                render: (row: ISyncRun) => (
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.status === 'succeeded' ? 'bg-emerald-50 text-emerald-700' : row.status === 'failed' ? 'bg-rose-50 text-rose-700' : row.status === 'partially_succeeded' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}
                  >
                    {row.status.replaceAll('_', ' ')}
                  </span>
                ),
              },
              {
                field: 'counts',
                title: 'Results',
                render: (row: ISyncRun) =>
                  `${row.counts?.succeeded ?? 0} succeeded · ${row.counts?.failed ?? 0} failed`,
              },
              {
                field: 'startedAt',
                title: 'Started',
                render: (row: ISyncRun) => new Date(row.startedAt).toLocaleString('en-IN'),
              },
              {
                field: 'syncErrors',
                title: 'Latest issue',
                render: (row: ISyncRun) => row.syncErrors?.[0]?.message ?? '—',
              },
            ]}
            data={runs}
            actions={[
              {
                tooltip: 'Retry failed synchronization',
                icon: <RotateCcw className="size-4" />,
                hidden: (row: ISyncRun) => !['failed', 'partially_succeeded'].includes(row.status),
                onClick: (row: ISyncRun) => void retryRun(row),
              },
            ]}
            title="Sync history"
            onRefresh={() => refreshRuns()}
            options={{ bordered: false, responsive: true, export: true }}
          />
        )}

        {/* ── Provider Courses tab ── */}
        {activeTab === 'courses' && (
          <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4  sm:p-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-primary">
                  Learning catalogue
                </p>
                <h2 className="mt-1 text-xl font-black text-slate-950">Provider courses</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Search synchronized courses and assign them through governed student selection.
                </p>
              </div>
              <label className="relative block w-full sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-600" />
                <input
                  value={courseSearch}
                  onChange={(event) => setCourseSearch(event.target.value)}
                  placeholder="Search title or skill"
                  className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                />
              </label>
            </div>
            {courses.length ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {courses.map((course) => (
                  <article
                    key={course._id}
                    className="flex flex-col rounded-2xl border border-slate-200 p-4 transition hover:border-primary/30 "
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
                        {providerLabel(course.provider)}
                      </span>
                      {course.certificateAvailable && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                          <Award className="size-3.5" /> Certificate
                        </span>
                      )}
                    </div>
                    <h3 className="mt-3 font-bold text-slate-900">{course.title}</h3>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
                      {course.description || 'No provider description supplied.'}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {course.skills.slice(0, 4).map((skill) => (
                        <span
                          key={skill}
                          className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] text-slate-600"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                    <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                      <span className="text-xs text-slate-500">
                        {course.durationHours
                          ? `${course.durationHours} learning hours`
                          : 'Self-paced'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setAssigningCourse(course)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white hover:bg-primary/90"
                      >
                        <Users className="size-3.5" /> Assign
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl bg-slate-50 p-8 text-center">
                <BookOpenCheck className="mx-auto size-8 text-slate-300" />
                <p className="mt-3 font-semibold text-slate-700">No synchronized courses yet</p>
                <p className="mt-1 text-sm text-slate-500">
                  Configure and verify a provider, then import its approved institutional catalogue.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Learning Progress tab ── */}
        {activeTab === 'progress' && (
          <div className="space-y-6">
            <CustomTable
              columns={[
                {
                  field: 'courseId',
                  title: 'Course',
                  render: (row: ILmsEnrollment) =>
                    typeof row.courseId === 'string' ? 'Course' : row.courseId.title,
                },
                {
                  field: 'studentId',
                  title: 'Student',
                  render: (row: ILmsEnrollment) =>
                    typeof row.studentId === 'string' ? (
                      'Student'
                    ) : (
                      <div>
                        <p className="font-medium">{row.studentId.name}</p>
                        <p className="text-xs text-slate-600">{row.studentId.email}</p>
                      </div>
                    ),
                },
                {
                  field: 'progressPercent',
                  title: 'Progress',
                  render: (row: ILmsEnrollment) => (
                    <div className="min-w-28">
                      <div className="flex justify-between text-xs">
                        <span className="capitalize">{row.status.replaceAll('_', ' ')}</span>
                        <span>{row.progressPercent}%</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${row.progressPercent}%` }}
                        />
                      </div>
                    </div>
                  ),
                },
                {
                  field: 'learningHours',
                  title: 'Hours',
                  render: (row: ILmsEnrollment) => row.learningHours.toFixed(1),
                },
              ]}
              data={enrollments}
              title="Student learning progress"
              subtitle="Provider progress synchronized against assigned students."
              onRefresh={() => refreshEnrollments()}
              options={{ bordered: false, responsive: true, export: true }}
            />
            <CustomTable
              columns={[
                {
                  field: 'title',
                  title: 'Credential',
                  render: (row: ILmsCredential) => (
                    <div>
                      <p className="font-medium">{row.title}</p>
                      <p className="text-xs capitalize text-slate-600">{row.type}</p>
                    </div>
                  ),
                },
                {
                  field: 'studentId',
                  title: 'Student',
                  render: (row: ILmsCredential) =>
                    typeof row.studentId === 'string' ? 'Student' : row.studentId.name,
                },
                {
                  field: 'issuedAt',
                  title: 'Issued',
                  render: (row: ILmsCredential) =>
                    new Date(row.issuedAt).toLocaleDateString('en-IN'),
                },
                {
                  field: 'verificationUrl',
                  title: 'Verification',
                  render: (row: ILmsCredential) =>
                    row.verificationUrl ? (
                      <a
                        href={row.verificationUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-primary hover:underline"
                      >
                        Verify
                      </a>
                    ) : (
                      '—'
                    ),
                },
              ]}
              data={credentials}
              title="Certificates & badges"
              subtitle="Verified credentials remain linked to the student and source course."
              onRefresh={() => refreshCredentials()}
              options={{ bordered: false, responsive: true, export: true }}
            />
          </div>
        )}

        {/* ── Grade Review tab ── */}
        {activeTab === 'grades' && (
          <CustomTable
            columns={gradeColumns}
            data={grades}
            actions={[
              {
                tooltip: 'Review imported grade',
                icon: <Check className="h-4 w-4" />,
                onClick: (row: IImportedGrade) => setReviewing(row),
              },
            ]}
            title="Imported grades awaiting review"
            subtitle="Provider scores never update official records until an authorized reviewer applies them. Apply through grading history so every decision remains traceable."
            onRefresh={() => refreshGrades()}
            options={{ bordered: false, responsive: true, export: false }}
          />
        )}
      </div>

      {profileOpen && (
        <ProfileModal
          metadata={metadataRaw?.data}
          profile={editingProfile}
          onClose={() => {
            setProfileOpen(false);
            setEditingProfile(null);
          }}
          onSaved={async () => {
            setProfileOpen(false);
            setEditingProfile(null);
            await refreshProfiles();
          }}
        />
      )}
      {reviewing && (
        <ReviewModal
          grade={reviewing}
          loading={isLoading}
          onClose={() => setReviewing(null)}
          onSubmit={async (decision, reason) => {
            const response = await mutation(`lms-integration/grades/${reviewing._id}/review`, {
              method: 'POST',
              body: { decision, reason },
            });
            if (!response?.results?.success) return;
            toast.success(`Imported grade ${decision === 'apply' ? 'applied' : 'rejected'}`);
            setReviewing(null);
            await refreshGrades();
          }}
        />
      )}
      {assigningCourse && (
        <AssignCourseModal
          course={assigningCourse}
          onClose={() => setAssigningCourse(null)}
          onAssigned={async () => {
            setAssigningCourse(null);
            await Promise.all([refreshCourses(), refreshEnrollments()]);
          }}
        />
      )}
    </div>
  );
}

function Shell({
  title,
  onClose,
  children,
  maxWidth = 'max-w-4xl',
  footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
  footer?: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-200/80 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        className={`flex max-h-[85vh] h-fit w-full ${maxWidth} flex-col rounded-t-3xl bg-white  sm:rounded-3xl transition-all duration-200 border border-slate-100`}
      >
        {/* Fixed Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            type="button"
            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>

        {/* Fixed Footer */}
        {footer && (
          <div className="border-t border-slate-100 px-6 py-4 bg-slate-50 rounded-b-3xl flex justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileModal({
  metadata,
  profile,
  onClose,
  onSaved,
}: {
  metadata?: IMetadata;
  profile?: IProfile | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { mutation, isLoading } = useMutation();
  const initialValues: IProfileForm = profile
    ? {
        name: profile.name,
        connectorId:
          typeof profile.connectorId === 'string' ? profile.connectorId : profile.connectorId._id,
        academicYear: profile.academicYear,
        departmentIds: profile.departmentIds ?? [],
        enabled: profile.enabled,
        syncSchedule: profile.syncSchedule ?? 'manual',
        directions: profile.directions as IProfileForm['directions'],
        lti: { ...blank.lti, ...(profile.lti ?? {}) },
      }
    : blank;
  return (
    <Formik
      initialValues={initialValues}
      enableReinitialize
      validationSchema={profileSchema}
      onSubmit={async (values) => {
        const lti = Object.values(values.lti).some(Boolean) ? values.lti : undefined;
        const response = await mutation(
          profile ? `lms-integration/profiles/${profile._id}` : 'lms-integration/profiles',
          {
            method: profile ? 'PUT' : 'POST',
            body: { ...values, lti },
          },
        );
        if (!response?.results?.success) return;
        toast.success(`LMS integration profile ${profile ? 'updated' : 'created'}`);
        await onSaved();
      }}
    >
      {({ values, setFieldValue }) => (
        <Shell
          title={profile ? 'Edit LMS Integration Profile' : 'Create LMS Integration Profile'}
          onClose={onClose}
          maxWidth="max-w-4xl"
          footer={
            <div className="flex justify-end gap-3 w-full">
              <CustomButton variant="secondary" onClick={onClose}>
                Cancel
              </CustomButton>
              <CustomButton type="submit" loading={isLoading}>
                <CloudCog className="mr-2 h-4 w-4" />
                {profile ? 'Update Integration' : 'Save Profile'}
              </CustomButton>
            </div>
          }
        >
          <Form className="space-y-6">
            {/* Form Section 1: Basic Config */}
            <div className="rounded-2xl bg-slate-50/50 border border-slate-100 p-5 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                General Configuration
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Profile name <span className="text-red-500">*</span>
                  <Field
                    name="name"
                    className={fieldClass}
                    placeholder="e.g. Canvas Academic Sync"
                  />
                  <ErrorMessage name="name">
                    {(m) => <p className="mt-1 text-xs text-red-500 font-medium">{m}</p>}
                  </ErrorMessage>
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  LMS Connector <span className="text-red-500">*</span>
                  <Field as="select" name="connectorId" className={fieldClass}>
                    <option value="">Select connector</option>
                    {(metadata?.connectors ?? []).map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name} ({providerLabel(c.provider)})
                      </option>
                    ))}
                  </Field>
                  <ErrorMessage name="connectorId">
                    {(m) => <p className="mt-1 text-xs text-red-500 font-medium">{m}</p>}
                  </ErrorMessage>
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Academic year <span className="text-red-500">*</span>
                  <AsyncSelect
                    type="academicYears"
                    value={values.academicYear || null}
                    onChange={(value) => setFieldValue('academicYear', value ?? '')}
                    placeholder="Select configured academic year"
                  />
                </label>
                <div className="block text-sm font-semibold text-slate-700">
                  <AsyncSelect
                    type="departments"
                    multiple
                    label="Target Departments (all if empty)"
                    value={values.departmentIds}
                    onChange={(value) => setFieldValue('departmentIds', value)}
                  />
                </div>
              </div>
            </div>

            {/* Form Section 2: Sync Directions */}
            <div className="rounded-2xl bg-slate-50/50 border border-slate-100 p-5 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                Data Synchronization Scope
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {(
                  [
                    ['courses', 'Course sync direction'],
                    ['rosters', 'Roster sync direction'],
                    ['assignments', 'Assignment sync direction'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="block text-sm font-semibold text-slate-700">
                    {label}
                    <Field as="select" name={`directions.${key}`} className={fieldClass}>
                      <option value="export">ERP → LMS (Export)</option>
                      <option value="disabled">Disabled</option>
                    </Field>
                  </label>
                ))}
                <label className="block text-sm font-semibold text-slate-700">
                  Grade Sync Mode
                  <Field as="select" name="directions.grades" className={fieldClass}>
                    <option value="import">LMS → ERP Review Queue (Import)</option>
                    <option value="export">ERP → LMS (Export)</option>
                    <option value="bidirectional">Bidirectional (Sync both ways)</option>
                    <option value="disabled">Disabled</option>
                  </Field>
                </label>
              </div>
            </div>

            {/* Form Section 3: Activation & Scheduling */}
            <div className="rounded-2xl bg-slate-50/50 border border-slate-100 p-5 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                Schedule & Lifecycle
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 items-start">
                <label className="block text-sm font-semibold text-slate-700">
                  Automatic Synchronization Run
                  <Field as="select" name="syncSchedule" className={fieldClass}>
                    <option value="manual">Manual only</option>
                    <option value="hourly">Every hour</option>
                    <option value="daily">Every day</option>
                  </Field>
                  <p className="mt-1.5 text-xs text-slate-600 font-normal leading-relaxed">
                    Scheduled runs execute in background tasks and stay completely traceable.
                  </p>
                </label>
                <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-4 py-2.75 mt-6 h-10.5">
                  <Field
                    type="checkbox"
                    id="enabled-checkbox"
                    name="enabled"
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/20 cursor-pointer"
                  />
                  <label
                    htmlFor="enabled-checkbox"
                    className="text-sm font-semibold text-slate-700 cursor-pointer select-none"
                  >
                    Enable profile after saving
                  </label>
                </div>
              </div>
            </div>

            {/* Form Section 4: LTI (Optional details) */}
            <details className="group rounded-2xl bg-slate-50/50 border border-slate-100 p-5 transition-all">
              <summary className="flex cursor-pointer items-center justify-between text-sm font-bold text-slate-700 select-none">
                <span>Optional LTI 1.3 trust metadata</span>
                <span className="text-slate-600 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
                {Object.keys(blank.lti).map((key) => (
                  <label
                    key={key}
                    className="block text-xs font-semibold text-slate-600 capitalize"
                  >
                    {key.replace(/([A-Z])/g, ' $1')}
                    <Field
                      name={`lti.${key}`}
                      className={fieldClass}
                      placeholder={`Enter ${key}`}
                    />
                  </label>
                ))}
              </div>
            </details>
          </Form>
        </Shell>
      )}
    </Formik>
  );
}

function AssignCourseModal({
  course,
  onClose,
  onAssigned,
}: {
  course: ILmsCourse;
  onClose: () => void;
  onAssigned: () => Promise<void>;
}) {
  const { mutation, isLoading } = useMutation();
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const submit = async () => {
    if (!studentIds.length) {
      toast.error('Select at least one student');
      return;
    }
    const response = await mutation(`lms-integration/courses/${course._id}/assign`, {
      method: 'POST',
      body: { studentIds },
    });
    if (!response?.results?.success) return;
    toast.success(`${course.title} assigned to ${studentIds.length} student(s)`);
    await onAssigned();
  };
  return (
    <Shell
      title="Assign Course to Students"
      onClose={onClose}
      maxWidth="max-w-2xl"
      footer={
        <div className="flex justify-end gap-3 w-full">
          <CustomButton variant="secondary" onClick={onClose}>
            Cancel
          </CustomButton>
          <CustomButton loading={isLoading} disabled={!studentIds.length} onClick={submit}>
            Assign to {studentIds.length ? `${studentIds.length} student(s)` : 'course'}
          </CustomButton>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-blue-100 bg-linear-to-br from-blue-50/50 to-blue-50/80 p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            LMS Source: {providerLabel(course.provider)}
          </p>
          <h3 className="mt-1.5 text-lg font-bold text-slate-900">{course.title}</h3>
          <p className="mt-1 text-sm text-slate-600 leading-relaxed">
            Enrollments will be synchronized to the LMS target system.
          </p>
        </div>
        <AsyncSelect
          type="students"
          multiple
          label="Select Target Students *"
          value={studentIds}
          onChange={(value) => setStudentIds(value)}
        />
      </div>
    </Shell>
  );
}

function ReviewModal({
  grade,
  loading,
  onClose,
  onSubmit,
}: {
  grade: IImportedGrade;
  loading: boolean;
  onClose: () => void;
  onSubmit: (decision: 'apply' | 'reject', reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  return (
    <Shell
      title="Review Imported Grade"
      onClose={onClose}
      maxWidth="max-w-xl"
      footer={
        <div className="flex justify-end gap-3 w-full">
          <CustomButton
            variant="secondary"
            disabled={loading || reason.trim().length < 3}
            onClick={() => onSubmit('reject', reason)}
          >
            Reject Grade
          </CustomButton>
          <CustomButton loading={loading} onClick={() => onSubmit('apply', reason)}>
            Apply to Grading Record
          </CustomButton>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
            Score Received
          </span>
          <p className="text-3xl font-black text-slate-900 mt-1">
            {grade.score} / {grade.maximumScore}
          </p>
          <p className="text-sm text-slate-500 mt-2 font-medium bg-white px-3 py-2 rounded-xl border border-slate-100">
            {grade.feedback || 'No feedback provided from LMS.'}
          </p>
        </div>
        <label className="block text-sm font-semibold text-slate-700">
          Review Rationale
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Provide a rationale for the grade review decision (required if rejecting)"
            className={fieldClass}
          />
        </label>
      </div>
    </Shell>
  );
}
