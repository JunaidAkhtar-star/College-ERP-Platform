/** @file MentorAnalytics.tsx @description API-record-driven mentor operation visualisations. */
'use client';

import { motion } from '@/shared/utils/motion';

interface IRecord {
  departmentName?: string;
  menteeIds: unknown[];
  maxMentees: number;
  totalMeetings: number;
  isActive: boolean;
}
interface IProps {
  records: IRecord[];
  isLoading: boolean;
}
const percent = (value: number, total: number) =>
  total > 0 ? Math.min(100, (value / total) * 100) : 0;

export default function MentorAnalytics({ records, isLoading }: IProps) {
  const assignments = records.length;
  const active = records.filter((record) => record.isActive).length;
  const mentees = records.reduce((sum, record) => sum + record.menteeIds.length, 0);
  const capacity = records.reduce((sum, record) => sum + Math.max(0, record.maxMentees), 0);
  const meetings = records.reduce((sum, record) => sum + Math.max(0, record.totalMeetings), 0);
  const activeRate = percent(active, assignments);
  const utilization = percent(mentees, capacity);
  const departments = Object.entries(
    records.reduce<Record<string, number>>((result, record) => {
      const name = record.departmentName || 'Unassigned';
      result[name] = (result[name] ?? 0) + 1;
      return result;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-1 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Mentoring operations</h2>
          <p className="text-xs text-slate-500">
            Live coverage, capacity and engagement from assignment records.
          </p>
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-500">
          {isLoading ? 'Loading' : `${assignments} assignments analysed`}
        </p>
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-[1fr_1fr_1.25fr]">
        <div className="grid min-h-36 grid-cols-[92px_1fr] items-center gap-2 border-b border-slate-100 p-4 md:border-r xl:border-b-0">
          <svg
            viewBox="0 0 84 84"
            className="h-20 w-20"
            role="img"
            aria-label={`${activeRate.toFixed(0)} percent active assignments`}
          >
            <circle cx="42" cy="42" r="29" fill="#ecfdf5" />
            <circle cx="42" cy="42" r="25" fill="none" stroke="#d1fae5" strokeWidth="7" />
            <motion.circle
              cx="42"
              cy="42"
              r="25"
              fill="none"
              stroke="#10b981"
              strokeWidth="7"
              strokeLinecap="round"
              pathLength="100"
              strokeDasharray={`${activeRate} ${100 - activeRate}`}
              transform="rotate(-90 42 42)"
              initial={{ strokeDashoffset: 100 }}
              animate={{ strokeDashoffset: 0 }}
              transition={{ duration: 0.7 }}
            />
            <text x="42" y="46" textAnchor="middle" fontSize="12" fontWeight="700" fill="#047857">
              {activeRate.toFixed(0)}%
            </text>
          </svg>
          <div>
            <p className="text-[10px] font-semibold uppercase text-slate-500">Active coverage</p>
            <p className="mt-1 text-xl font-bold text-slate-900">
              {active} / {assignments}
            </p>
            <p className="mt-1 text-[10px] text-slate-500">Assignments currently active</p>
          </div>
        </div>
        <div className="min-h-36 border-b border-slate-100 p-4 xl:border-b-0 xl:border-r">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase text-slate-500">Mentee capacity</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {mentees} / {capacity}
              </p>
            </div>
            <strong className="text-sm text-cyan-700">{utilization.toFixed(0)}%</strong>
          </div>
          <svg
            viewBox="0 0 220 54"
            className="mt-2 h-14 w-full"
            role="img"
            aria-label={`${utilization.toFixed(0)} percent capacity used`}
          >
            {Array.from({ length: 10 }, (_, index) => (
              <motion.rect
                key={index}
                x={4 + index * 21}
                y={12 + Math.abs(4.5 - index) * 2}
                width="15"
                height={34 - Math.abs(4.5 - index) * 4}
                rx="5"
                fill={index < Math.round(utilization / 10) ? '#06b6d4' : '#cffafe'}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.04 }}
              />
            ))}
          </svg>
        </div>
        <div className="min-h-36 p-4 md:col-span-2 xl:col-span-1">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase text-slate-500">
                Department distribution
              </p>
              <p className="mt-1 text-xs text-slate-500">Assignments by department</p>
            </div>
            <div className="text-right">
              <strong className="text-lg text-violet-700">{meetings}</strong>
              <p className="text-[9px] text-slate-500">meetings</p>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {departments.length ? (
              departments.map(([name, value], index) => (
                <div
                  key={name}
                  className="grid grid-cols-[minmax(0,1fr)_90px_20px] items-center gap-2"
                >
                  <span className="truncate text-[10px] text-slate-600" title={name}>
                    {name}
                  </span>
                  <svg viewBox="0 0 100 8" className="h-2 w-full" aria-hidden="true">
                    <rect width="100" height="8" rx="4" fill="#ede9fe" />
                    <motion.rect
                      width={percent(value, departments[0]?.[1] ?? value)}
                      height="8"
                      rx="4"
                      fill={['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'][index]}
                      initial={{ width: 0 }}
                      animate={{ width: percent(value, departments[0]?.[1] ?? value) }}
                      transition={{ duration: 0.6 }}
                    />
                  </svg>
                  <strong className="text-right text-[10px] text-slate-700">{value}</strong>
                </div>
              ))
            ) : (
              <p className="py-4 text-center text-xs text-slate-400">
                Assignment distribution will appear here.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
