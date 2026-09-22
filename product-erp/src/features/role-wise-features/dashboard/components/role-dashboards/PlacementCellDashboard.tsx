/**
 * @file PlacementCellDashboard.tsx
 * @description Standalone placement-cell outcomes and drive dashboard.
 * @module features/dashboard/role-dashboards
 */
'use client';

import {
  Award,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  IndianRupee,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  type AnyRecord,
  Badge,
  fmt,
  fmtDate,
  type IStatCard,
  PIE_COLORS,
  RowItem,
  Section,
  StatCard,
  useRolePath,
} from '../views/shared';

interface INameValue {
  name: string;
  value: number;
}
interface IPlacementTrend {
  label: string;
  offers: number;
  accepted: number;
}
interface IDepartmentPlacement {
  name: string;
  placed: number;
  averagePackage: number;
}
interface IPackageBucket {
  range: string;
  students: number;
}
interface ICompany {
  name: string;
  studentsPlaced: number;
  highestPackage: number;
}
interface IDrive {
  _id?: string;
  companyName: string;
  jobRole: string;
  package: number;
  packageMax?: number;
  status: string;
  driveDate: string;
  venue?: string;
}
interface IApplication {
  _id?: string;
  studentName: string;
  rollNumber: string;
  branch: string;
  status: string;
  currentRound?: number;
  offeredPackage?: number;
  updatedAt?: string;
  driveId?: { companyName?: string; jobRole?: string; driveDate?: string };
}

/** Maps placement workflow states to status badge tones. */
function placementTone(status: string): 'green' | 'blue' | 'amber' | 'red' | 'slate' {
  if (['accepted', 'offered', 'completed'].includes(status)) return 'green';
  if (['selected', 'round_ongoing', 'ongoing'].includes(status)) return 'blue';
  if (['registered', 'shortlisted', 'upcoming'].includes(status)) return 'amber';
  if (['rejected', 'declined', 'withdrawn', 'cancelled'].includes(status)) return 'red';
  return 'slate';
}

export default function PlacementCellDashboard({ d }: { d: AnyRecord }) {
  const path = useRolePath();
  const status = (d.placementStatus as INameValue[] | undefined) ?? [];
  const trend = (d.placementTrend as IPlacementTrend[] | undefined) ?? [];
  const departments = (d.departmentPlacement as IDepartmentPlacement[] | undefined) ?? [];
  const packages = (d.packageDistribution as IPackageBucket[] | undefined) ?? [];
  const companies = (d.topCompanies as ICompany[] | undefined) ?? [];
  const upcoming = (d.upcomingDrives as IDrive[] | undefined) ?? [];
  const awaiting = (d.awaitingOffers as IApplication[] | undefined) ?? [];
  const activities = (d.recentApplications as IApplication[] | undefined) ?? [];
  const eligible = Number(d.eligibleStudents ?? 0);
  const placed = Number(d.placedStudents ?? 0);
  const placementRate = eligible ? (placed / eligible) * 100 : 0;

  const cards: IStatCard[] = [
    {
      label: 'Eligible Students',
      value: fmt(eligible),
      icon: <Users className="h-5 w-5" />,
      bg: 'bg-violet-50',
      fg: 'text-violet-600',
      href: path('placement'),
    },
    {
      label: 'Placed Students',
      value: fmt(placed),
      icon: <Award className="h-5 w-5" />,
      bg: 'bg-emerald-50',
      fg: 'text-emerald-600',
      sub: `${placementRate.toFixed(1)}% placement rate`,
      href: path('placement'),
    },
    {
      label: 'Companies Visited',
      value: fmt(d.companiesVisited),
      icon: <Building2 className="h-5 w-5" />,
      bg: 'bg-blue-50',
      fg: 'text-blue-600',
      href: path('placement'),
    },
    {
      label: 'Placement Drives',
      value: fmt(d.totalDrives),
      icon: <CalendarDays className="h-5 w-5" />,
      bg: 'bg-orange-50',
      fg: 'text-orange-600',
      href: path('placement'),
    },
    {
      label: 'Offers Made',
      value: fmt(d.offersMade),
      icon: <BriefcaseBusiness className="h-5 w-5" />,
      bg: 'bg-rose-50',
      fg: 'text-rose-600',
      href: path('placement'),
    },
    {
      label: 'Highest Package',
      value: `₹ ${Number(d.highestPackage ?? 0).toFixed(2)} LPA`,
      icon: <IndianRupee className="h-5 w-5" />,
      bg: 'bg-sky-50',
      fg: 'text-sky-600',
      href: path('placement'),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {cards.map((card, index) => (
          <StatCard key={card.label} {...card} index={index} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Section title="Placement Trend" className="xl:col-span-2" href={path('placement')}>
          <div className="h-72">
            {trend.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <LineChart data={trend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="offers"
                    stroke="#6D4AFF"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="accepted"
                    stroke="#16A36A"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-xs text-slate-600">
                No offer history found.
              </p>
            )}
          </div>
        </Section>

        <Section title="Placement Status" href={path('placement')}>
          <div className="relative h-64">
            {status.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={status}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={62}
                    outerRadius={88}
                    paddingAngle={2}
                  >
                    {status.map((row, index) => (
                      <Cell key={row.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-xs text-slate-600">
                No placement profiles.
              </p>
            )}
            {status.length > 0 && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <strong className="text-xl text-slate-900">{fmt(d.totalStudents)}</strong>
                <span className="text-[10px] text-slate-500">Students</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {status.map((row, index) => (
              <div key={row.name} className="flex items-center gap-2 text-[10px]">
                <svg viewBox="0 0 8 8" className="h-2 w-2">
                  <circle cx="4" cy="4" r="4" fill={PIE_COLORS[index % PIE_COLORS.length]} />
                </svg>
                <span className="min-w-0 flex-1 truncate capitalize">
                  {row.name.replaceAll('_', ' ')}
                </span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Section title="Top Recruiting Companies" href={path('placement')}>
          <div className="space-y-2">
            {companies.length ? (
              companies.map((company) => (
                <div
                  key={company.name}
                  className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-xl bg-slate-50 p-3 text-xs"
                >
                  <strong className="truncate text-slate-800">{company.name}</strong>
                  <span className="text-slate-500">{fmt(company.studentsPlaced)} placed</span>
                  <span className="font-semibold text-emerald-700">
                    ₹ {Number(company.highestPackage ?? 0).toFixed(2)} LPA
                  </span>
                </div>
              ))
            ) : (
              <p className="py-10 text-center text-xs text-slate-600">
                No verified placement companies.
              </p>
            )}
          </div>
        </Section>

        <Section title="Placement by Department" href={path('placement')}>
          <div className="h-64">
            {departments.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart
                  data={departments}
                  layout="vertical"
                  margin={{ top: 5, right: 8, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef2f7" />
                  <XAxis type="number" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={92}
                    tick={{ fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip />
                  <Bar dataKey="placed" fill="#2563EB" radius={[0, 5, 5, 0]} barSize={13} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-xs text-slate-600">
                No placed-student departments.
              </p>
            )}
          </div>
        </Section>

        <Section title="Package Distribution" href={path('placement')}>
          <div className="h-64">
            {packages.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart
                  data={packages}
                  layout="vertical"
                  margin={{ top: 5, right: 8, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef2f7" />
                  <XAxis type="number" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="range"
                    width={50}
                    tick={{ fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip />
                  <Bar dataKey="students" fill="#6D4AFF" radius={[0, 5, 5, 0]} barSize={13} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-xs text-slate-600">
                No package records.
              </p>
            )}
          </div>
        </Section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Section title="Upcoming Drives" href={path('placement')}>
          <div className="space-y-2">
            {upcoming.length ? (
              upcoming.map((drive) => (
                <RowItem
                  key={drive._id ?? `${drive.companyName}-${drive.driveDate}`}
                  icon={<Building2 className="h-4 w-4" />}
                  primary={`${drive.companyName} · ${drive.jobRole}`}
                  secondary={`${fmtDate(drive.driveDate)} · ${drive.venue ?? 'Venue pending'} · ₹ ${drive.package}${drive.packageMax ? `–${drive.packageMax}` : ''} LPA`}
                  end={<Badge label={drive.status} color={placementTone(drive.status)} />}
                  href={path('placement')}
                />
              ))
            ) : (
              <p className="py-10 text-center text-xs text-slate-600">No upcoming drives.</p>
            )}
          </div>
        </Section>

        <Section title="Students Awaiting Offers" href={path('placement')}>
          <div className="space-y-2">
            {awaiting.length ? (
              awaiting.map((application) => (
                <RowItem
                  key={
                    application._id ??
                    `${application.rollNumber}-${application.driveId?.companyName}`
                  }
                  icon={<Users className="h-4 w-4" />}
                  primary={`${application.studentName} · ${application.branch}`}
                  secondary={`${application.driveId?.companyName ?? 'Company'} · ${application.driveId?.jobRole ?? 'Role'} · round ${fmt(application.currentRound)}`}
                  end={
                    <Badge
                      label={application.status.replaceAll('_', ' ')}
                      color={placementTone(application.status)}
                    />
                  }
                  href={path('placement')}
                />
              ))
            ) : (
              <p className="py-10 text-center text-xs text-slate-600">
                No students awaiting outcomes.
              </p>
            )}
          </div>
        </Section>

        <Section title="Recent Placement Activity" href={path('placement')}>
          <div className="space-y-2">
            {activities.length ? (
              activities
                .slice(0, 6)
                .map((application) => (
                  <RowItem
                    key={application._id ?? `${application.rollNumber}-${application.updatedAt}`}
                    icon={<BriefcaseBusiness className="h-4 w-4" />}
                    primary={`${application.studentName} · ${application.driveId?.companyName ?? 'Company'}`}
                    secondary={`${application.driveId?.jobRole ?? application.branch}${application.offeredPackage ? ` · ₹ ${application.offeredPackage} LPA` : ''}`}
                    end={
                      <Badge
                        label={application.status.replaceAll('_', ' ')}
                        color={placementTone(application.status)}
                      />
                    }
                    href={path('placement')}
                  />
                ))
            ) : (
              <p className="py-10 text-center text-xs text-slate-600">
                No placement application activity.
              </p>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}
