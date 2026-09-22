/**
 * @file HrDepartmentDashboard.tsx
 * @description Standalone workforce, attendance, leave, and payroll dashboard.
 */
'use client';

import {
  Banknote,
  BriefcaseBusiness,
  CalendarCheck,
  CalendarDays,
  UserCheck,
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
  fmtRupees,
  type IStatCard,
  PIE_COLORS,
  RowItem,
  Section,
  StatCard,
  useRolePath,
} from '../views/shared';

interface IAttendanceDay {
  date: string;
  present: number;
  absent: number;
  onLeave: number;
  attendancePercentage: number;
}
interface ILeaveStatus {
  name: string;
  count: number;
  days: number;
}
interface IDepartmentStrength {
  name: string;
  count: number;
}
interface IRecentJoiner {
  _id?: string;
  employeeId: string;
  name: string;
  designation: string;
  department: string;
  dateOfJoining: string;
}
interface IEmploymentType {
  name: string;
  count: number;
}
interface IPayrollSummary {
  grossPay: number;
  deductions: number;
  netPay: number;
  paid: number;
  total: number;
}
interface IEvent {
  _id?: string;
  title: string;
  eventType?: string;
  startDate: string;
  venue?: string;
}

function leaveTone(status: string): 'green' | 'amber' | 'red' | 'slate' {
  if (status === 'approved') return 'green';
  if (status === 'pending') return 'amber';
  if (status === 'rejected') return 'red';
  return 'slate';
}

export default function HrDepartmentDashboard({ d }: { d: AnyRecord }) {
  const path = useRolePath();
  const attendance = (d.attendanceOverview as IAttendanceDay[] | undefined) ?? [];
  const leaveStatus = (d.leaveStatus as ILeaveStatus[] | undefined) ?? [];
  const departments = (d.departmentStrength as IDepartmentStrength[] | undefined) ?? [];
  const joiners = (d.recentJoiners as IRecentJoiner[] | undefined) ?? [];
  const employmentTypes = (d.employmentTypes as IEmploymentType[] | undefined) ?? [];
  const payroll = (d.payrollSummary as IPayrollSummary | undefined) ?? {
    grossPay: 0,
    deductions: 0,
    netPay: 0,
    paid: 0,
    total: 0,
  };
  const events = (d.upcomingEvents as IEvent[] | undefined) ?? [];
  const cards: IStatCard[] = [
    {
      label: 'Total Employees',
      value: fmt(d.totalEmployees),
      sub: `${fmt(d.activeEmployees)} active`,
      icon: <Users className="h-5 w-5" />,
      bg: 'bg-violet-50',
      fg: 'text-violet-600',
      href: path('human-resource'),
    },
    {
      label: 'Present Today',
      value: fmt(d.presentToday),
      icon: <CalendarCheck className="h-5 w-5" />,
      bg: 'bg-emerald-50',
      fg: 'text-emerald-600',
      href: path('faculty-attendance'),
    },
    {
      label: 'On Leave Today',
      value: fmt(d.onLeave),
      icon: <BriefcaseBusiness className="h-5 w-5" />,
      bg: 'bg-blue-50',
      fg: 'text-blue-600',
      href: path('leave'),
    },
    {
      label: 'New Joiners',
      value: fmt(d.newJoiners),
      sub: 'This month',
      icon: <UserCheck className="h-5 w-5" />,
      bg: 'bg-orange-50',
      fg: 'text-orange-600',
      href: path('human-resource'),
    },
    {
      label: 'Pending Leave Requests',
      value: fmt(d.pendingLeaves),
      icon: <CalendarDays className="h-5 w-5" />,
      bg: 'bg-rose-50',
      fg: 'text-rose-600',
      href: path('leave'),
    },
    {
      label: 'Pending Payslips',
      value: fmt(d.pendingPayslips),
      icon: <Banknote className="h-5 w-5" />,
      bg: 'bg-sky-50',
      fg: 'text-sky-600',
      href: path('payroll'),
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
        <Section title="Attendance Overview" href={path('faculty-attendance')}>
          <div className="h-72">
            {attendance.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <LineChart data={attendance} margin={{ left: -20, right: 8, top: 12 }}>
                  <CartesianGrid stroke="#eef2f7" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value: string) => fmtDate(value).slice(0, 6)}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip labelFormatter={(value) => fmtDate(String(value))} />
                  <Line
                    type="monotone"
                    dataKey="attendancePercentage"
                    name="Attendance %"
                    stroke="#16a34a"
                    strokeWidth={3}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="absent"
                    name="Absent"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="onLeave"
                    name="On leave"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-xs text-slate-600">
                No attendance records for this week.
              </p>
            )}
          </div>
        </Section>
        <Section title="Leave Status" href={path('leave')}>
          <div className="relative h-72">
            {leaveStatus.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={leaveStatus}
                    dataKey="count"
                    nameKey="name"
                    innerRadius={62}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {leaveStatus.map((row, index) => (
                      <Cell key={row.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-xs text-slate-600">
                No leave requests this month.
              </p>
            )}
            {leaveStatus.length > 0 && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <strong className="text-2xl text-slate-900">
                  {fmt(leaveStatus.reduce((sum, row) => sum + row.count, 0))}
                </strong>
                <span className="text-xs text-slate-600">Requests</span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {leaveStatus.map((row) => (
              <Badge
                key={row.name}
                label={`${row.name}: ${row.count}`}
                color={leaveTone(row.name)}
              />
            ))}
          </div>
        </Section>
        <Section title="Workforce Composition" href={path('human-resource')}>
          <div className="h-72">
            {employmentTypes.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={employmentTypes}
                    dataKey="count"
                    nameKey="name"
                    innerRadius={58}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {employmentTypes.map((row, index) => (
                      <Cell key={row.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-xs text-slate-600">
                No employee composition data.
              </p>
            )}
          </div>
        </Section>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Section title="Recent Employees" href={path('human-resource')}>
          <div className="space-y-2">
            {joiners.length ? (
              joiners.map((employee) => (
                <RowItem
                  key={employee._id ?? employee.employeeId}
                  icon={<UserCheck className="h-4 w-4" />}
                  primary={employee.name}
                  secondary={`${employee.designation} · ${employee.department}`}
                  end={
                    <span className="text-xs text-slate-600">
                      {fmtDate(employee.dateOfJoining)}
                    </span>
                  }
                  href={path('human-resource')}
                />
              ))
            ) : (
              <p className="py-12 text-center text-xs text-slate-600">
                No active employee records.
              </p>
            )}
          </div>
        </Section>
        <Section title="Department Strength" href={path('human-resource')}>
          <div className="h-72">
            {departments.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={departments.slice(0, 8)} margin={{ left: -20, top: 12 }}>
                  <CartesianGrid stroke="#eef2f7" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Employees" fill="#6545e8" radius={[7, 7, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-xs text-slate-600">
                No department assignments.
              </p>
            )}
          </div>
        </Section>
        <Section title="Upcoming Events" href={path('events')}>
          <div className="space-y-2">
            {events.length ? (
              events.map((event) => (
                <RowItem
                  key={event._id ?? `${event.title}-${event.startDate}`}
                  icon={<CalendarDays className="h-4 w-4" />}
                  primary={event.title}
                  secondary={[fmtDate(event.startDate), event.venue].filter(Boolean).join(' · ')}
                  end={
                    event.eventType ? <Badge label={event.eventType} color="violet" /> : undefined
                  }
                  href={path('events')}
                />
              ))
            ) : (
              <p className="py-12 text-center text-xs text-slate-600">
                No upcoming approved events.
              </p>
            )}
          </div>
        </Section>
      </div>
      <Section title="Payroll Summary" href={path('payroll')}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ['Gross Payroll', fmtRupees(payroll.grossPay)],
            ['Deductions', fmtRupees(payroll.deductions)],
            ['Net Payroll', fmtRupees(payroll.netPay)],
            ['Payslips Paid', fmt(payroll.paid)],
            ['Payslips Generated', fmt(payroll.total)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-medium text-slate-600">{label}</p>
              <p className="mt-2 text-xl font-bold text-slate-900">{value}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
