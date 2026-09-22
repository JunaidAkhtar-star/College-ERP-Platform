/**
 * @file LibraryStaffDashboard.tsx
 * @description Standalone library circulation and collection dashboard.
 * @module features/dashboard/role-dashboards
 */
'use client';

import {
  BookOpen,
  BookOpenCheck,
  CircleDollarSign,
  Clock3,
  Library,
  RotateCcw,
  UserRound,
} from 'lucide-react';
import {
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

interface ICategoryStat {
  name: string;
  titles: number;
  totalCopies: number;
  availableCopies: number;
}
interface ICirculationPoint {
  label: string;
  issued: number;
  returned: number;
}
interface IBookSummary {
  _id?: string;
  title: string;
  authors?: string[];
  category?: string;
  issueCount?: number;
  isbn?: string;
  totalCopies?: number;
  availableCopies?: number;
  createdAt?: string;
}
interface IIssueRow {
  _id?: string;
  bookId?: IBookSummary;
  memberId?: { name?: string; email?: string };
  issueDate?: string;
  dueDate?: string;
  status?: string;
  fineAmount?: number;
  finePaid?: number;
}

/** Returns the number of overdue calendar days for a due date. */
function overdueDays(date?: string) {
  if (!date) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000));
}

export default function LibraryStaffDashboard({ d }: { d: AnyRecord }) {
  const path = useRolePath();
  const categories = (d.categoryStats as ICategoryStat[] | undefined) ?? [];
  const trend = (d.circulationTrend as ICirculationPoint[] | undefined) ?? [];
  const topBooks = (d.topIssuedBooks as IBookSummary[] | undefined) ?? [];
  const overdue = (d.overdueRows as IIssueRow[] | undefined) ?? [];
  const issues = (d.recentIssues as IIssueRow[] | undefined) ?? [];
  const arrivals = (d.newArrivals as IBookSummary[] | undefined) ?? [];

  const cards: IStatCard[] = [
    {
      label: 'Total Books',
      value: fmt(d.totalBooks),
      icon: <BookOpen className="h-5 w-5" />,
      bg: 'bg-violet-50',
      fg: 'text-violet-600',
      href: path('library'),
    },
    {
      label: 'Books Issued',
      value: fmt(d.booksIssued),
      icon: <RotateCcw className="h-5 w-5" />,
      bg: 'bg-emerald-50',
      fg: 'text-emerald-600',
      href: path('library'),
    },
    {
      label: 'Active Members',
      value: fmt(d.activeMembers),
      icon: <UserRound className="h-5 w-5" />,
      bg: 'bg-blue-50',
      fg: 'text-blue-600',
      href: path('library'),
    },
    {
      label: 'Pending Returns',
      value: fmt(d.booksIssued),
      icon: <Clock3 className="h-5 w-5" />,
      bg: 'bg-orange-50',
      fg: 'text-orange-600',
      href: path('library'),
    },
    {
      label: 'Overdue Fines',
      value: fmtRupees(d.overdueFineAmount),
      icon: <CircleDollarSign className="h-5 w-5" />,
      bg: 'bg-rose-50',
      fg: 'text-rose-600',
      href: path('library'),
    },
    {
      label: "Today's Circulation",
      value: fmt(Number(d.todaysIssued ?? 0) + Number(d.todaysReturned ?? 0)),
      icon: <Library className="h-5 w-5" />,
      bg: 'bg-sky-50',
      fg: 'text-sky-600',
      href: path('library'),
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
        <Section
          title="Issue / Return Overview"
          sub="This month"
          className="xl:col-span-2"
          href={path('library')}
        >
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
                    dataKey="issued"
                    stroke="#6D4AFF"
                    strokeWidth={2.5}
                    dot={{ r: 2.5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="returned"
                    stroke="#16A36A"
                    strokeWidth={2.5}
                    dot={{ r: 2.5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-xs text-slate-600">
                No circulation this month.
              </p>
            )}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              ['Issued', d.booksIssued, 'text-violet-700 bg-violet-50'],
              ['Returned Today', d.todaysReturned, 'text-emerald-700 bg-emerald-50'],
              ['Overdue', d.overdueBooks, 'text-orange-700 bg-orange-50'],
              ['Available', d.availableCopies, 'text-blue-700 bg-blue-50'],
            ].map(([label, value, tone]) => (
              <div key={String(label)} className={`rounded-lg p-3 text-center ${tone}`}>
                <strong className="block text-sm">{fmt(value)}</strong>
                <span className="mt-1 block text-[9px]">{String(label)}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Collection by Category" href={path('library')}>
          <div className="relative h-64">
            {categories.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={categories}
                    dataKey="totalCopies"
                    nameKey="name"
                    innerRadius={62}
                    outerRadius={88}
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
                No collection categories.
              </p>
            )}
            {categories.length > 0 && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <strong className="text-xl text-slate-900">{fmt(d.totalBooks)}</strong>
                <span className="text-[10px] text-slate-500">Total Books</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {categories.slice(0, 6).map((category, index) => (
              <div key={category.name} className="flex items-center gap-2 text-[10px]">
                <svg viewBox="0 0 8 8" className="h-2 w-2">
                  <circle cx="4" cy="4" r="4" fill={PIE_COLORS[index % PIE_COLORS.length]} />
                </svg>
                <span className="min-w-0 flex-1 truncate">{category.name}</span>
                <strong>{category.totalCopies}</strong>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Section title="Top Most Issued Books" href={path('library')}>
          <div className="space-y-2">
            {topBooks.length ? (
              topBooks.map((book, index) => (
                <RowItem
                  key={book._id ?? book.title}
                  icon={<span className="text-xs font-bold">{index + 1}</span>}
                  primary={book.title}
                  secondary={`${book.authors?.join(', ') || book.category || 'Author unavailable'}`}
                  end={<strong className="text-xs text-slate-800">{fmt(book.issueCount)}</strong>}
                  href={path('library')}
                />
              ))
            ) : (
              <p className="py-10 text-center text-xs text-slate-600">No issue rankings yet.</p>
            )}
          </div>
        </Section>

        <Section title="Overdue Books" href={path('library')}>
          <div className="space-y-2">
            {overdue.length ? (
              overdue.map((issue) => (
                <RowItem
                  key={issue._id ?? `${issue.memberId?.email}-${issue.dueDate}`}
                  icon={<Clock3 className="h-4 w-4" />}
                  primary={`${issue.memberId?.name ?? issue.memberId?.email ?? 'Unlinked member'} · ${issue.bookId?.title ?? 'Unknown book'}`}
                  secondary={`Due ${fmtDate(issue.dueDate)} · fine ${fmtRupees(Math.max(Number(issue.fineAmount ?? 0) - Number(issue.finePaid ?? 0), 0))}`}
                  end={<Badge label={`${overdueDays(issue.dueDate)} days`} color="red" />}
                  href={path('library')}
                />
              ))
            ) : (
              <p className="py-10 text-center text-xs text-slate-600">No overdue books.</p>
            )}
          </div>
        </Section>

        <Section title="New Arrivals" href={path('library')}>
          <div className="space-y-2">
            {arrivals.length ? (
              arrivals.map((book) => (
                <RowItem
                  key={book._id ?? book.isbn ?? book.title}
                  icon={<BookOpenCheck className="h-4 w-4" />}
                  primary={book.title}
                  secondary={`${book.authors?.join(', ') || book.category || 'Author unavailable'} · ${fmt(book.availableCopies)}/${fmt(book.totalCopies)} available`}
                  href={path('library')}
                />
              ))
            ) : (
              <p className="py-10 text-center text-xs text-slate-600">
                No recent catalogue additions.
              </p>
            )}
          </div>
        </Section>
      </div>

      <Section title="Recent Circulation Activity" href={path('library')}>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {issues.length ? (
            issues
              .slice(0, 6)
              .map((issue) => (
                <RowItem
                  key={issue._id ?? `${issue.memberId?.email}-${issue.issueDate}`}
                  icon={<BookOpen className="h-4 w-4" />}
                  primary={`${issue.bookId?.title ?? 'Unknown book'} · ${issue.memberId?.name ?? issue.memberId?.email ?? 'Unlinked member'}`}
                  secondary={`Issued ${fmtDate(issue.issueDate)} · due ${fmtDate(issue.dueDate)}`}
                  end={
                    <Badge
                      label={issue.status ?? 'issued'}
                      color={issue.status === 'overdue' ? 'red' : 'blue'}
                    />
                  }
                  href={path('library')}
                />
              ))
          ) : (
            <p className="col-span-full py-10 text-center text-xs text-slate-600">
              No active circulation records.
            </p>
          )}
        </div>
      </Section>
    </div>
  );
}
