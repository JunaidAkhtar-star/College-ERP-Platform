/**
 * @file ClubHeadDashboard.tsx
 * @description Standalone club-head dashboard scoped to clubs led or advised by the user.
 * @module features/dashboard/role-dashboards
 */
'use client';

import { Activity, CalendarDays, Layers3, Users } from 'lucide-react';
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
  fmt,
  fmtDate,
  type IStatCard,
  PIE_COLORS,
  RowItem,
  Section,
  StatCard,
  useRolePath,
} from '../views/shared';

interface IClubStat {
  _id?: string;
  name: string;
  category: string;
  description?: string;
  members: number;
  activities: number;
}
interface ICategoryStat {
  name: string;
  clubs: number;
  members: number;
  activities: number;
}
interface IMembershipPoint {
  label: string;
  joined: number;
}
interface IClubActivity {
  title?: string;
  description?: string;
  date?: string;
  participantCount?: number;
  clubId?: string;
  clubName?: string;
}

export default function ClubHeadDashboard({ d }: { d: AnyRecord }) {
  const path = useRolePath();
  const clubs = (d.clubStats as IClubStat[] | undefined) ?? [];
  const categories = (d.categoryStats as ICategoryStat[] | undefined) ?? [];
  const membership = (d.membershipTrend as IMembershipPoint[] | undefined) ?? [];
  const recent = (d.recentActivities as IClubActivity[] | undefined) ?? [];
  const upcoming = (d.upcomingActivities as IClubActivity[] | undefined) ?? [];

  const cards: IStatCard[] = [
    {
      label: 'Total Members',
      value: fmt(d.totalMembers),
      icon: <Users className="h-5 w-5" />,
      bg: 'bg-violet-50',
      fg: 'text-violet-600',
      href: path('clubs'),
    },
    {
      label: 'Activities Organized',
      value: fmt(d.totalActivities),
      icon: <CalendarDays className="h-5 w-5" />,
      bg: 'bg-emerald-50',
      fg: 'text-emerald-600',
      href: path('clubs'),
    },
    {
      label: 'Active Clubs Led',
      value: fmt(d.totalClubs),
      icon: <Layers3 className="h-5 w-5" />,
      bg: 'bg-blue-50',
      fg: 'text-blue-600',
      href: path('clubs'),
    },
    {
      label: 'Upcoming Activities',
      value: fmt(upcoming.length),
      icon: <Activity className="h-5 w-5" />,
      bg: 'bg-orange-50',
      fg: 'text-orange-600',
      href: path('clubs'),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, index) => (
          <StatCard key={card.label} {...card} index={index} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Section title="Club Category Overview" href={path('clubs')}>
          <div className="relative h-64">
            {categories.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={categories}
                    dataKey="members"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={86}
                    paddingAngle={2}
                  >
                    {categories.map((category, index) => (
                      <Cell key={category.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-xs text-slate-600">
                No clubs are assigned to this account.
              </p>
            )}
            {categories.length > 0 && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <strong className="text-xl text-slate-900">{fmt(d.totalMembers)}</strong>
                <span className="text-[10px] text-slate-500">Members</span>
              </div>
            )}
          </div>
        </Section>

        <Section title="Club Activity & Membership" className="xl:col-span-2" href={path('clubs')}>
          <div className="h-72">
            {clubs.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={clubs} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="members" fill="#6D4AFF" radius={[5, 5, 0, 0]} />
                  <Bar dataKey="activities" fill="#16A36A" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-xs text-slate-600">
                No club activity records.
              </p>
            )}
          </div>
        </Section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Section title="Upcoming Activities" href={path('clubs')}>
          <div className="space-y-2">
            {upcoming.length ? (
              upcoming.map((activity, index) => (
                <RowItem
                  key={`${activity.clubId}-${activity.title}-${index}`}
                  icon={<CalendarDays className="h-4 w-4" />}
                  primary={activity.title ?? 'Untitled activity'}
                  secondary={`${activity.clubName ?? 'Club'} · ${fmtDate(activity.date)}${activity.participantCount == null ? '' : ` · ${fmt(activity.participantCount)} participants`}`}
                  href={path('clubs')}
                />
              ))
            ) : (
              <p className="py-10 text-center text-xs text-slate-600">
                No upcoming club activities.
              </p>
            )}
          </div>
        </Section>

        <Section title="Recent Activities" href={path('clubs')}>
          <div className="space-y-2">
            {recent.length ? (
              recent.map((activity, index) => (
                <RowItem
                  key={`${activity.clubId}-${activity.title}-${index}`}
                  icon={<Activity className="h-4 w-4" />}
                  primary={activity.title ?? 'Untitled activity'}
                  secondary={`${activity.clubName ?? 'Club'} · ${fmtDate(activity.date)}${activity.participantCount == null ? '' : ` · ${fmt(activity.participantCount)} participants`}`}
                  href={path('clubs')}
                />
              ))
            ) : (
              <p className="py-10 text-center text-xs text-slate-600">No recent club activities.</p>
            )}
          </div>
        </Section>

        <Section title="Membership Growth" href={path('clubs')}>
          <div className="h-64">
            {membership.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <LineChart data={membership} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="joined"
                    stroke="#6D4AFF"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-xs text-slate-600">
                No membership history.
              </p>
            )}
          </div>
        </Section>
      </div>

      <Section title="My Clubs" href={path('clubs')}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {clubs.length ? (
            clubs.map((club) => (
              <div key={club._id ?? club.name} className="rounded-xl bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <strong className="truncate text-sm text-slate-800">{club.name}</strong>
                  <span className="rounded-full bg-white px-2 py-1 text-[10px] capitalize text-slate-500">
                    {club.category}
                  </span>
                </div>
                {club.description && (
                  <p className="mt-2 line-clamp-2 text-xs text-slate-500">{club.description}</p>
                )}
                <div className="mt-4 flex items-center gap-4 text-[11px] text-slate-600">
                  <span>{fmt(club.members)} members</span>
                  <span>{fmt(club.activities)} activities</span>
                </div>
              </div>
            ))
          ) : (
            <p className="col-span-full py-10 text-center text-xs text-slate-600">
              This account is not assigned as a club head or faculty advisor.
            </p>
          )}
        </div>
      </Section>
    </div>
  );
}
