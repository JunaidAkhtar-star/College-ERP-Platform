'use client';

import React from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Layers,
  Users,
  UserCheck,
  GraduationCap,
  Activity,
  Award,
  Banknote,
  Rocket,
  ShieldCheck,
  AlertCircle,
  Clock,
  Package,
} from 'lucide-react';
import { motion } from '@/shared/utils/motion';
import {
  AnyRecord,
  IStatCard,
  useRolePath,
  fmt,
  fmtRupees,
  Badge,
  Section,
  RowItem,
  StaffDashboardView,
  PIE_COLORS,
} from './shared';

export function CommonStaffView({ d, roleLabel }: { d: AnyRecord; roleLabel: string }) {
  const profile = (d.profileSummary ?? {}) as { name?: string; idCode?: string };
  const firstName = (profile.name ?? '').trim().split(/\s+/)[0] || 'there';
  const upcomingEvents = (d.upcomingEvents ?? []) as Array<{
    title: string;
    startDate: string;
    venue?: string;
  }>;
  const notices = (d.notices ?? []) as Array<{ title: string; publishedAt?: string }>;
  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-primary-50 px-6 py-5"
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">{roleLabel}</p>
        <h2 className="mt-1 text-2xl font-bold text-slate-900">Welcome Back, {firstName}</h2>
        <p className="mt-1 text-sm text-slate-600">
          Your workspace is ready. Use the sidebar to access your tools.
        </p>
      </motion.div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Upcoming Events</h3>
          {upcomingEvents.length === 0 ? (
            <p className="text-xs text-slate-600">No upcoming events.</p>
          ) : (
            <ul className="space-y-2">
              {upcomingEvents.slice(0, 5).map((e, i) => (
                <li key={i} className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="text-sm font-medium text-slate-800">{e.title}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(e.startDate).toLocaleDateString('en-IN')}
                    {e.venue ? ` · ${e.venue}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Recent Notices</h3>
          {notices.length === 0 ? (
            <p className="text-xs text-slate-600">No recent notices.</p>
          ) : (
            <ul className="space-y-2">
              {notices.slice(0, 5).map((n, i) => (
                <li key={i} className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="text-sm font-medium text-slate-800">{n.title}</p>
                  {n.publishedAt && (
                    <p className="text-xs text-slate-500">
                      {new Date(n.publishedAt).toLocaleDateString('en-IN')}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export function HostelWardenView({ d }: { d: AnyRecord }) {
  const path = useRolePath();
  const complaints =
    (d.recentComplaints as
      | Array<{
          _id: string;
          studentId?: { name?: string };
          hostelName: string;
          roomNo: string;
          category: string;
          status: string;
        }>
      | undefined) ?? [];
  const visitors =
    (d.currentVisitors as
      | Array<{
          _id: string;
          studentName: string;
          roomNo: string;
          visitorName: string;
          relation: string;
          checkIn: string;
        }>
      | undefined) ?? [];

  const cards: IStatCard[] = [
    {
      label: 'Active Residents',
      value: fmt(d.activeResidents),
      icon: <Users className="h-5 w-5" />,
      bg: 'bg-primary-50',
      fg: 'text-primary',
      sub: `${fmt(d.occupancyPercentage)}% occupancy`,
      href: path('hostel'),
    },
    {
      label: 'Available Beds',
      value: fmt(d.availableBeds),
      icon: <Layers className="h-5 w-5" />,
      bg: 'bg-emerald-50',
      fg: 'text-emerald-700',
      sub: `${fmt(d.occupiedBeds)} of ${fmt(d.totalCapacity)} occupied`,
      href: path('hostel'),
    },
    {
      label: 'Open Complaints',
      value: fmt(d.openComplaints),
      icon: <AlertCircle className="h-5 w-5" />,
      bg: 'bg-amber-50',
      fg: 'text-amber-700',
      sub: 'Open and in-progress cases',
      href: path('hostel'),
    },
    {
      label: 'Visitors Inside',
      value: fmt(d.visitorsInside),
      icon: <UserCheck className="h-5 w-5" />,
      bg: 'bg-sky-50',
      fg: 'text-sky-700',
      sub: 'Awaiting checkout',
      href: path('hostel'),
    },
    {
      label: 'Outstanding Hostel Fees',
      value: fmtRupees(d.outstandingFeeAmount),
      icon: <Banknote className="h-5 w-5" />,
      bg: 'bg-rose-50',
      fg: 'text-rose-700',
      sub: `${fmt(d.outstandingFeeRecords)} pending record${Number(d.outstandingFeeRecords ?? 0) === 1 ? '' : 's'}`,
      href: path('hostel'),
    },
  ];

  return (
    <StaffDashboardView
      d={d}
      role="hostel_warden"
      roleLabel="Hostel Warden"
      stats={cards}
      extras={
        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Resident service queue" sub="Complaints requiring attention">
            <div className="space-y-2">
              {complaints.length > 0 ? (
                complaints.map((complaint) => (
                  <RowItem
                    key={complaint._id}
                    icon={<AlertCircle className="h-4 w-4" />}
                    primary={`${complaint.category.replaceAll('_', ' ')} · Room ${complaint.roomNo}`}
                    secondary={`${complaint.studentId?.name ?? 'Resident'} · ${complaint.hostelName}`}
                    end={<Badge label={complaint.status.replaceAll('_', ' ')} color="amber" />}
                    href={path('hostel')}
                  />
                ))
              ) : (
                <p className="py-8 text-center text-xs text-slate-600">
                  No open resident complaints.
                </p>
              )}
            </div>
          </Section>
          <Section title="Current visitors" sub="People who have not checked out">
            <div className="space-y-2">
              {visitors.length > 0 ? (
                visitors.map((visitor) => (
                  <RowItem
                    key={visitor._id}
                    icon={<ShieldCheck className="h-4 w-4" />}
                    primary={`${visitor.visitorName} · ${visitor.relation}`}
                    secondary={`Visiting ${visitor.studentName}, room ${visitor.roomNo}`}
                    end={
                      <span className="text-[11px] text-slate-600">
                        {new Date(visitor.checkIn).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    }
                    href={path('hostel')}
                  />
                ))
              ) : (
                <p className="py-8 text-center text-xs text-slate-600">
                  No visitors are currently inside.
                </p>
              )}
            </div>
          </Section>
        </div>
      }
    />
  );
}

export function TransportationView({ d }: { d: AnyRecord }) {
  const path = useRolePath();
  const routeStats =
    (d.routeStats as Array<{
      routeNo: string;
      routeName: string;
      capacity: number;
      occupiedCount: number;
    }>) ?? [];
  const recent =
    (d.recentAllocations as Array<{
      studentId?: { name: string; email: string; avatar?: string };
      stopName: string;
      createdAt: string;
    }>) ?? [];

  const totalCapacity = routeStats.reduce((s, r) => s + Number(r.capacity ?? 0), 0);
  const totalOccupied = routeStats.reduce((s, r) => s + Number(r.occupiedCount ?? 0), 0);
  const fleetUtilization =
    totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0;

  const cards: IStatCard[] = [
    {
      label: 'Active Routes',
      value: fmt(d.totalRoutes),
      icon: <Layers className="h-5 w-5" />,
      bg: 'bg-primary-50',
      fg: 'text-primary',
      sub: `${fmt(routeStats.length)} route${routeStats.length !== 1 ? 's' : ''} tracked`,
      href: path('transport'),
    },
    {
      label: 'Allocated Students',
      value: fmt(d.allocatedStudents),
      icon: <Users className="h-5 w-5" />,
      bg: 'bg-emerald-50',
      fg: 'text-emerald-600',
      sub: `${fleetUtilization}% fleet utilization`,
      href: path('transport'),
    },
    {
      label: 'Active Drivers',
      value: fmt(d.totalDrivers),
      icon: <UserCheck className="h-5 w-5" />,
      bg: 'bg-amber-50',
      fg: 'text-amber-600',
      href: path('transport'),
    },
  ];

  const utilizationData = routeStats.map((r) => ({
    name: `R#${r.routeNo}`,
    Utilized: r.occupiedCount,
    Capacity: r.capacity,
  }));

  return (
    <StaffDashboardView
      d={d}
      role="transportation"
      roleLabel="Transportation Cell"
      stats={cards}
      extras={
        <div className="grid gap-4 lg:grid-cols-3">
          <Section title="Route Capacity Utilization" className="lg:col-span-2">
            <div className="h-56">
              {utilizationData.length ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <BarChart data={utilizationData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip />
                    <Bar dataKey="Capacity" fill="#E2E8F0" radius={[4, 4, 0, 0]} barSize={12} />
                    <Bar dataKey="Utilized" fill="#0178D7" radius={[4, 4, 0, 0]} barSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="flex h-full items-center justify-center text-xs text-slate-600">
                  No route data
                </p>
              )}
            </div>
          </Section>
          <Section title="Recent Allocations" className="lg:col-span-1">
            <div className="space-y-2">
              {recent.length ? (
                recent.map((r, i) => (
                  <RowItem
                    key={i}
                    icon={<GraduationCap className="h-4 w-4" />}
                    primary={r.studentId?.name ?? 'Student'}
                    secondary={`Stop: ${r.stopName} · ${new Date(r.createdAt).toLocaleDateString('en-IN')}`}
                    href={path('transport')}
                  />
                ))
              ) : (
                <p className="py-6 text-center text-xs text-slate-600">No recent allocations</p>
              )}
            </div>
          </Section>
        </div>
      }
    />
  );
}

export function ResearchDevelopmentView({ d }: { d: AnyRecord }) {
  const path = useRolePath();
  const publicationsTrend =
    (d.publicationsTrend as { label: string; value: number }[] | undefined) ?? [];
  const projects =
    (d.recentProjects as Array<{
      title: string;
      status: string;
      principalInvestigator?: { name: string };
    }>) ?? [];
  const publications =
    (d.recentPublications as Array<{ title: string; kind: string; year: number }>) ?? [];

  const cards: IStatCard[] = [
    {
      label: 'Ongoing Projects',
      value: fmt(d.ongoingProjects),
      icon: <Activity className="h-5 w-5" />,
      bg: 'bg-primary-50',
      fg: 'text-primary',
      sub: `Total: ${fmt(d.totalProjects)}`,
      href: path('research-development'),
    },
    {
      label: 'Research Patents',
      value: fmt(d.totalPatents),
      icon: <Award className="h-5 w-5" />,
      bg: 'bg-amber-50',
      fg: 'text-amber-600',
      sub: `Publications: ${fmt(d.totalPublications)}`,
      href: path('research-development'),
    },
    {
      label: 'Total R&D Funding Grants',
      value: fmtRupees(d.totalGrants),
      icon: <Banknote className="h-5 w-5" />,
      bg: 'bg-emerald-50',
      fg: 'text-emerald-600',
      href: path('research-development'),
    },
  ];

  return (
    <StaffDashboardView
      d={d}
      role="research_development"
      roleLabel="Research & Development Cell"
      stats={cards}
      extras={
        <div className="grid gap-4 lg:grid-cols-3">
          <Section title="Publications Trend" className="lg:col-span-1">
            <div className="h-48">
              {publicationsTrend.length ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <AreaChart data={publicationsTrend}>
                    <defs>
                      <linearGradient id="rdPub" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#8B5CF6"
                      strokeWidth={2}
                      fill="url(#rdPub)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="flex h-full items-center justify-center text-xs text-slate-600">
                  No publications data
                </p>
              )}
            </div>
          </Section>
          <Section title="R&D Activities" className="lg:col-span-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-semibold text-slate-500">Recent Projects</p>
                <div className="space-y-2">
                  {projects.length ? (
                    projects.map((p, i) => (
                      <div key={i} className="rounded-xl bg-slate-50 p-2 text-xs">
                        <p className="font-semibold text-slate-700 truncate">{p.title}</p>
                        <p className="text-[10px] text-slate-600 mt-0.5">
                          PI: {p.principalInvestigator?.name ?? 'Faculty'}
                        </p>
                        <div className="mt-1 flex items-center justify-between">
                          <Badge
                            label={p.status}
                            color={p.status === 'ongoing' ? 'blue' : 'green'}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-[11px] text-slate-600">No project records found</p>
                  )}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold text-slate-500">Recent Publications</p>
                <div className="space-y-2">
                  {publications.length ? (
                    publications.map((pb, i) => (
                      <div key={i} className="rounded-xl bg-slate-50 p-2 text-xs">
                        <p className="font-semibold text-slate-700 truncate">{pb.title}</p>
                        <p className="text-[10px] text-slate-600 mt-0.5">
                          Kind: {pb.kind} · Year: {pb.year}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-[11px] text-slate-600">No publication records found</p>
                  )}
                </div>
              </div>
            </div>
          </Section>
        </div>
      }
    />
  );
}

export function ClubHeadView({ d }: { d: AnyRecord }) {
  const path = useRolePath();
  const clubStats =
    (d.clubStats as Array<{
      name: string;
      category: string;
      members: number;
      activities: number;
    }>) ?? [];

  const cards: IStatCard[] = [
    {
      label: 'Active Student Clubs',
      value: fmt(d.totalClubs),
      icon: <Users className="h-5 w-5" />,
      bg: 'bg-primary-50',
      fg: 'text-primary',
      href: path('clubs'),
    },
    {
      label: 'Registered Club Members',
      value: fmt(d.totalMembers),
      icon: <GraduationCap className="h-5 w-5" />,
      bg: 'bg-secondary-50',
      fg: 'text-secondary',
      href: path('clubs'),
    },
  ];

  return (
    <StaffDashboardView
      d={d}
      role="club_head"
      roleLabel="Student Clubs Office"
      stats={cards}
      extras={
        <Section
          title="Club Activities & Enrolments"
          sub="Clubs metrics overview"
          href={path('clubs')}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-64">
              {clubStats.length ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <BarChart data={clubStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} />
                    <Tooltip />
                    <Bar dataKey="members" fill="#0178D7" name="Members" radius={[3, 3, 0, 0]} />
                    <Bar
                      dataKey="activities"
                      fill="#F59E0B"
                      name="Activities"
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="flex h-full items-center justify-center text-xs text-slate-600">
                  No active club statistics
                </p>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500">Club Standings</p>
              {clubStats.map((c, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl bg-slate-50 p-2.5 text-xs"
                >
                  <div>
                    <p className="font-semibold text-slate-700">{c.name}</p>
                    <p className="text-[10px] text-slate-600 uppercase tracking-wider">
                      {c.category}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-700">{c.members} Members</p>
                    <p className="text-[10px] text-slate-500">{c.activities} Events</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Section>
      }
    />
  );
}

export function IicView({ d }: { d: AnyRecord }) {
  const path = useRolePath();
  const categoryStats = (d.categoryStats as { name: string; value: number }[] | undefined) ?? [];
  const recent =
    (d.recentActivities as Array<{
      title: string;
      kind: string;
      startDate: string;
      participantCount?: number;
    }>) ?? [];

  const cards: IStatCard[] = [
    {
      label: 'Innovation Activities',
      value: fmt(d.totalActivities),
      icon: <Activity className="h-5 w-5" />,
      bg: 'bg-primary-50',
      fg: 'text-primary',
      href: path('iic'),
    },
    {
      label: 'Reported to MoE (MIC)',
      value: fmt(d.reportedToMic),
      icon: <ShieldCheck className="h-5 w-5" />,
      bg: 'bg-emerald-50',
      fg: 'text-emerald-600',
      sub: `${fmt(d.pendingMicReport)} Pending`,
      href: path('iic'),
    },
    {
      label: 'Total Seminar Attendees',
      value: fmt(d.totalParticipants),
      icon: <Users className="h-5 w-5" />,
      bg: 'bg-amber-50',
      fg: 'text-amber-600',
      href: path('iic'),
    },
  ];

  return (
    <StaffDashboardView
      d={d}
      role="iic"
      roleLabel="Institution Innovation Council (IIC)"
      stats={cards}
      extras={
        <div className="grid gap-4 lg:grid-cols-3">
          <Section title="Activity Categories" className="lg:col-span-1">
            <div className="h-48">
              {categoryStats.length ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <PieChart>
                    <Pie
                      data={categoryStats}
                      innerRadius={36}
                      outerRadius={54}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {categoryStats.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="flex h-full items-center justify-center text-xs text-slate-600">
                  No activity data
                </p>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
              {categoryStats.map((s, i) => (
                <span key={s.name} className="flex items-center gap-1 uppercase">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  {s.name.replace(/_/g, ' ')} ({s.value})
                </span>
              ))}
            </div>
          </Section>
          <Section title="Recent Innovation Events" className="lg:col-span-2">
            <div className="space-y-2">
              {recent.length ? (
                recent.map((r, i) => (
                  <RowItem
                    key={i}
                    icon={<Rocket className="h-4 w-4" />}
                    primary={r.title}
                    secondary={`Kind: ${r.kind.replace(/_/g, ' ')} · Date: ${new Date(r.startDate).toLocaleDateString('en-IN')}`}
                    href={path('iic')}
                    end={
                      <Badge
                        label={r.participantCount ? `${r.participantCount} Attended` : '—'}
                        color="blue"
                      />
                    }
                  />
                ))
              ) : (
                <p className="py-6 text-center text-xs text-slate-600">
                  No innovation activities registered
                </p>
              )}
            </div>
          </Section>
        </div>
      }
    />
  );
}

export function StoreView({ d }: { d: AnyRecord }) {
  const path = useRolePath();
  const reqStats = (d.reqStats as { name: string; value: number }[] | undefined) ?? [];
  const recent =
    (d.recentRequests as Array<{
      requestNumber: string;
      itemName: string;
      quantity: number;
      requestedByName: string;
      status: string;
    }>) ?? [];

  const cards: IStatCard[] = [
    {
      label: 'Low Stock Warnings',
      value: fmt(d.lowStockCount),
      icon: <AlertCircle className="h-5 w-5" />,
      bg: 'bg-red-50',
      fg: 'text-red-500',
      href: path('store'),
    },
    {
      label: 'Pending Requisitions',
      value: fmt(d.pendingRequests),
      icon: <Clock className="h-5 w-5" />,
      bg: 'bg-amber-50',
      fg: 'text-amber-600',
      href: path('store'),
    },
    {
      label: 'Total Catalogued Items',
      value: fmt(d.totalItems),
      icon: <Package className="h-5 w-5" />,
      bg: 'bg-primary-50',
      fg: 'text-primary',
      href: path('store'),
    },
  ];

  return (
    <StaffDashboardView
      d={d}
      role="store"
      roleLabel="Store Department"
      stats={cards}
      extras={
        <div className="grid gap-4 lg:grid-cols-3">
          <Section title="Requisitions Breakdown" className="lg:col-span-1">
            <div className="h-48">
              {reqStats.length ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <PieChart>
                    <Pie
                      data={reqStats}
                      innerRadius={36}
                      outerRadius={54}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {reqStats.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="flex h-full items-center justify-center text-xs text-slate-600">
                  No data
                </p>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
              {reqStats.map((s, i) => (
                <span key={s.name} className="flex items-center gap-1">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  {s.name} ({s.value})
                </span>
              ))}
            </div>
          </Section>
          <Section title="Recent Requests" className="lg:col-span-2">
            <div className="space-y-2">
              {recent.length ? (
                recent.map((r, i) => (
                  <RowItem
                    key={i}
                    icon={<Package className="h-4 w-4" />}
                    primary={`Req #${r.requestNumber} · ${r.itemName}`}
                    secondary={`Requested by: ${r.requestedByName} · Qty: ${r.quantity}`}
                    href={path('store')}
                    end={
                      <Badge
                        label={r.status}
                        color={
                          r.status === 'pending'
                            ? 'amber'
                            : r.status === 'approved'
                              ? 'blue'
                              : r.status === 'issued'
                                ? 'green'
                                : 'red'
                        }
                      />
                    }
                  />
                ))
              ) : (
                <p className="py-6 text-center text-xs text-slate-600">No requests log found</p>
              )}
            </div>
          </Section>
        </div>
      }
    />
  );
}
