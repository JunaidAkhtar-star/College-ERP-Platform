/**
 * @file AcademicSetupJourney.tsx
 * @description Guided, API-backed academic setup journey that explains dependencies
 * and directs administrators to the next incomplete configuration step.
 * @module features/role-wise-features/academic-structure
 */
'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  BookMarked,
  BookOpen,
  Building2,
  CalendarCheck2,
  Check,
  ChevronRight,
  Clock3,
  Layers3,
  LockKeyhole,
  Users,
} from 'lucide-react';
import useSwr from '@/shared/hooks/useSwr';

interface IListPayload {
  data?: unknown[] | { data?: unknown[] };
}

interface ISetupStep {
  label: string;
  description: string;
  route: string;
  count: number;
  icon: React.ComponentType<{ className?: string }>;
  dependency?: string;
}

function countRows(raw: unknown): number {
  const payload = (raw as IListPayload | undefined)?.data;
  if (Array.isArray(payload)) return payload.length;
  return Array.isArray(payload?.data) ? payload.data.length : 0;
}

function countPlannedCurricula(raw: unknown): number {
  const payload = (raw as IListPayload | undefined)?.data;
  const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
  return rows.filter((row) => {
    const plans = (row as { semesterPlans?: Array<{ subjects?: unknown[] }> }).semesterPlans ?? [];
    return plans.some((plan) => (plan.subjects?.length ?? 0) > 0);
  }).length;
}

/**
 * Shows the actual master-data dependency chain and live completion counts.
 */
export default function AcademicSetupJourney() {
  const params = useParams<{ tenant: string; role: string }>();
  const base = `/${params.tenant}/${params.role}`;
  const curricula = useSwr('curriculum');
  const departments = useSwr('department');
  const subjects = useSwr('subject');
  const batches = useSwr('batch?limit=500');
  const sections = useSwr('section?limit=500');
  const allotments = useSwr('student-section-allotment?limit=500');
  const timetables = useSwr('timetable');
  const requests = [curricula, departments, subjects, batches, sections, allotments, timetables];
  const isLoading = requests.some((request) => request.isLoading);
  const hasError = requests.some((request) => request.error);
  const curriculaRaw = curricula.data;
  const departmentsRaw = departments.data;
  const subjectsRaw = subjects.data;
  const batchesRaw = batches.data;
  const sectionsRaw = sections.data;
  const allotmentsRaw = allotments.data;
  const timetablesRaw = timetables.data;

  const steps: ISetupStep[] = [
    {
      label: 'Programs & Regulations',
      description: 'Define the programme duration, regulation year and required credits.',
      route: 'curriculum',
      count: countRows(curriculaRaw),
      icon: BookMarked,
    },
    {
      label: 'Departments / Branches',
      description: 'Create CSE, ECE and other branches, then connect offered programmes.',
      route: 'departments',
      count: countRows(departmentsRaw),
      icon: Building2,
      dependency: 'Create a programme first',
    },
    {
      label: 'Subject Catalogue',
      description: 'Create the subjects owned by each department.',
      route: 'subjects',
      count: countRows(subjectsRaw),
      icon: BookOpen,
      dependency: 'Requires a department',
    },
    {
      label: 'Curriculum Planning',
      description: 'Return to the curriculum and place subjects into the correct semesters.',
      route: 'curriculum',
      count: countPlannedCurricula(curriculaRaw),
      icon: CalendarCheck2,
      dependency: 'Requires subjects',
    },
    {
      label: 'Admission Batches',
      description: 'Create an admission cohort such as B.Tech CSE 2025–29.',
      route: 'academic-structure',
      count: countRows(batchesRaw),
      icon: Layers3,
      dependency: 'Requires curriculum and department',
    },
    {
      label: 'Classes & Sections',
      description: 'Create semester-wise class groups and set their capacity.',
      route: 'academic-structure',
      count: countRows(sectionsRaw),
      icon: Users,
      dependency: 'Requires a batch',
    },
    {
      label: 'Student Allotment',
      description: 'Place enrolled students into their active class section.',
      route: 'academic-structure',
      count: countRows(allotmentsRaw),
      icon: Users,
      dependency: 'Requires a section',
    },
    {
      label: 'Faculty & Timetable',
      description: 'Assign subjects, faculty, rooms and teaching periods.',
      route: 'timetable',
      count: countRows(timetablesRaw),
      icon: Clock3,
      dependency: 'Requires an active section',
    },
  ];

  const firstIncomplete = steps.findIndex((step) => step.count === 0);
  const completed = firstIncomplete === -1 ? steps.length : firstIncomplete;
  const progress = Math.round((completed / steps.length) * 100);

  return (
    <section id="academic-setup-guide" className="scroll-mt-24 rounded-2xl bg-white p-5">
      {hasError && (
        <div role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          Academic setup status is unavailable. Progress is hidden until every setup service can be
          verified.
        </div>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Guided academic setup
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">
            Configure academics in the correct order
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Each step unlocks reliable data for the next. Database IDs are handled automatically.
          </p>
        </div>
        <div className={`min-w-44 ${hasError ? 'invisible' : ''}`} aria-hidden={hasError}>
          <div className="mb-1.5 flex justify-between text-xs font-medium text-slate-500">
            <span>
              {completed} of {steps.length} ready
            </span>
            <span>{progress}%</span>
          </div>
          <progress
            value={progress}
            max={100}
            aria-label="Academic setup progress"
            className="h-2 w-full overflow-hidden rounded-full accent-secondary"
          />
        </div>
      </div>

      {isLoading && !hasError ? (
        <div
          className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4"
          aria-label="Loading academic setup status"
        >
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="h-36 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : (
        !hasError && (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const ready = step.count > 0;
              const next = index === firstIncomplete;
              const locked = firstIncomplete !== -1 && index > firstIncomplete;
              const content = (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                        locked
                          ? 'bg-slate-100 text-slate-600'
                          : ready
                            ? 'bg-secondary-50 text-secondary-600'
                            : 'bg-white text-slate-500'
                      }`}
                    >
                      {locked ? (
                        <LockKeyhole className="h-4 w-4" />
                      ) : ready ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Icon className="h-4 w-4" />
                      )}
                    </span>
                    <span className="text-xs font-semibold text-slate-600">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-slate-800">{step.label}</h3>
                  <p className="mt-1 min-h-10 text-xs leading-5 text-slate-500">
                    {step.description}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span
                      className={`text-xs font-medium ${
                        locked ? 'text-slate-600' : ready ? 'text-secondary-600' : 'text-amber-600'
                      }`}
                    >
                      {locked
                        ? `Locked · ${step.dependency ?? 'Complete the previous step'}`
                        : ready
                          ? `${step.count} configured`
                          : (step.dependency ?? 'Start here')}
                    </span>
                    {!locked && (
                      <ChevronRight className="h-4 w-4 text-slate-600 transition-transform group-hover:translate-x-0.5" />
                    )}
                  </div>
                </>
              );
              return locked ? (
                <div
                  key={`${step.label}-${index}`}
                  aria-disabled="true"
                  className="cursor-not-allowed rounded-xl bg-slate-50/70 p-4 opacity-70"
                >
                  {content}
                </div>
              ) : (
                <Link
                  key={`${step.label}-${index}`}
                  href={`${base}/${step.route}`}
                  className={`group rounded-xl p-4 transition-colors ${
                    next ? 'bg-primary-50' : 'bg-slate-50 hover:bg-slate-100'
                  }`}
                >
                  {content}
                </Link>
              );
            })}
          </div>
        )
      )}
    </section>
  );
}
