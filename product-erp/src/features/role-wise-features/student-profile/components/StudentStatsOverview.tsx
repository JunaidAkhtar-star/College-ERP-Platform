/** @file StudentStatsOverview.tsx @description Aligned, API-driven student summary charts. */
'use client';

import { motion } from '@/shared/utils/motion';
import type { IStudentStats } from '../types/student-profile.types';

interface IProps {
  stats: IStudentStats;
}
interface IChartProps {
  value: number;
  total: number;
}

const safe = (value: number) => (Number.isFinite(value) ? Math.max(0, value) : 0);
const percent = (value: number, total: number) =>
  total > 0 ? Math.min(100, (safe(value) / total) * 100) : 0;

function TotalComposition({ stats }: { stats: IStudentStats }) {
  const total = safe(stats.total);
  const groups = [
    { label: 'Active', value: safe(stats.active), color: '#10b981' },
    { label: 'Detained', value: safe(stats.detained), color: '#f59e0b' },
    { label: 'Passed', value: safe(stats.passedOut), color: '#8b5cf6' },
  ];
  const known = groups.reduce((sum, group) => sum + group.value, 0);
  const segments = [
    ...groups,
    { label: 'Other', value: Math.max(0, total - known), color: '#cbd5e1' },
  ];
  let offset = 0;
  return (
    <svg
      viewBox="0 0 240 76"
      className="h-20 w-full"
      role="img"
      aria-label="Student status composition from API data"
    >
      <circle cx="40" cy="38" r="26" fill="none" stroke="#e2e8f0" strokeWidth="9" />
      {segments.map((group) => {
        const length = percent(group.value, total);
        const currentOffset = -offset;
        offset += length;
        return length > 0 ? (
          <circle
            key={group.label}
            cx="40"
            cy="38"
            r="26"
            fill="none"
            stroke={group.color}
            strokeWidth="9"
            pathLength="100"
            strokeDasharray={`${length} ${100 - length}`}
            strokeDashoffset={currentOffset}
            transform="rotate(-90 40 38)"
          />
        ) : null;
      })}
      <text x="40" y="41" textAnchor="middle" fontSize="10" fontWeight="700" fill="#334155">
        {total}
      </text>
      {groups.map((group, index) => (
        <g key={group.label} transform={`translate(88 ${19 + index * 20})`}>
          <circle cx="4" r="4" fill={group.color} />
          <text x="14" y="3" fontSize="9" fill="#64748b">
            {group.label}
          </text>
          <text x="142" y="3" textAnchor="end" fontSize="9" fontWeight="700" fill="#334155">
            {group.value}
          </text>
        </g>
      ))}
    </svg>
  );
}

function ActiveComparison({ value, total }: IChartProps) {
  const rawRatio = total > 0 ? (value / total) * 100 : 0;
  const scaleMaximum = Math.max(value, total, 1);
  const activeHeight = (value / scaleMaximum) * 46;
  const totalHeight = (total / scaleMaximum) * 46;
  const inconsistent = value > total;
  return (
    <svg
      viewBox="0 0 240 76"
      className="h-20 w-full"
      role="img"
      aria-label={`${value} active students compared with ${total} total students`}
    >
      <path d="M12 62 H112" stroke="#dbe7e2" strokeWidth="1" />
      <path d="M12 39 H112" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 4" />
      <path d="M12 16 H112" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 4" />
      <motion.rect
        x="25"
        width="28"
        rx="7"
        fill="#10b981"
        initial={{ y: 62, height: 0 }}
        animate={{ y: 62 - activeHeight, height: activeHeight }}
        transition={{ duration: 0.65, ease: 'easeOut' }}
      />
      <motion.rect
        x="70"
        width="28"
        rx="7"
        fill="#dbe7e2"
        initial={{ y: 62, height: 0 }}
        animate={{ y: 62 - totalHeight, height: totalHeight }}
        transition={{ duration: 0.65, delay: 0.08, ease: 'easeOut' }}
      />
      <text x="39" y="73" textAnchor="middle" fontSize="8" fontWeight="700" fill="#047857">
        Active
      </text>
      <text x="84" y="73" textAnchor="middle" fontSize="8" fill="#64748b">
        Total
      </text>
      <text x="129" y="25" fontSize="9" fill="#64748b">
        Active versus total
      </text>
      <text x="129" y="45" fontSize="18" fontWeight="700" fill="#047857">
        {total > 0 ? `${rawRatio.toFixed(1)}%` : '—'}
      </text>
      <text x="129" y="59" fontSize="8" fill="#475569">
        Active {value} · Total {total}
      </text>
      {inconsistent && <circle cx="218" cy="24" r="4" fill="#f59e0b" />}
    </svg>
  );
}

function DetainedMatrix({ value, total }: IChartProps) {
  const ratio = percent(value, total);
  const filled = Math.round(ratio / 10);
  return (
    <svg
      viewBox="0 0 240 76"
      className="h-20 w-full"
      role="img"
      aria-label={`${value} detained students, ${ratio.toFixed(1)} percent of total`}
    >
      {Array.from({ length: 10 }, (_, index) => (
        <rect
          key={index}
          x={12 + (index % 5) * 18}
          y={20 + Math.floor(index / 5) * 22}
          width="12"
          height="12"
          rx="4"
          fill={index < filled ? '#f59e0b' : '#fdecc8'}
        />
      ))}
      <text x="112" y="29" fontSize="9" fill="#64748b">
        Attention rate
      </text>
      <text x="112" y="49" fontSize="17" fontWeight="700" fill="#b45309">
        {ratio.toFixed(1)}%
      </text>
      <text x="218" y="48" textAnchor="end" fontSize="9" fill="#92400e">
        {value} of {total}
      </text>
    </svg>
  );
}

function PassedCompletion({ value, total }: IChartProps) {
  const ratio = percent(value, total);
  return (
    <svg
      viewBox="0 0 240 76"
      className="h-20 w-full"
      role="img"
      aria-label={`${value} passed out students, ${ratio.toFixed(1)} percent of total`}
    >
      <path
        d="M13 59 A35 35 0 0 1 83 59"
        fill="none"
        stroke="#ede9fe"
        strokeWidth="9"
        strokeLinecap="round"
        pathLength="100"
      />
      <path
        d="M13 59 A35 35 0 0 1 83 59"
        fill="none"
        stroke="#8b5cf6"
        strokeWidth="9"
        strokeLinecap="round"
        pathLength="100"
        strokeDasharray={`${ratio} ${100 - ratio}`}
      />
      <text x="48" y="57" textAnchor="middle" fontSize="11" fontWeight="700" fill="#6d28d9">
        {ratio.toFixed(0)}%
      </text>
      <text x="103" y="28" fontSize="9" fill="#64748b">
        Completion records
      </text>
      <text x="103" y="48" fontSize="17" fontWeight="700" fill="#6d28d9">
        {value}
      </text>
      <text x="218" y="47" textAnchor="end" fontSize="9" fill="#7c3aed">
        of {total} students
      </text>
    </svg>
  );
}

export default function StudentStatsOverview({ stats }: IProps) {
  const data = {
    total: safe(stats.total),
    active: safe(stats.active),
    detained: safe(stats.detained),
    passedOut: safe(stats.passedOut),
  };
  const cards = [
    {
      label: 'Total Students',
      value: data.total,
      note: 'Institution student records',
      accent: 'bg-indigo-500',
      visual: <TotalComposition stats={data} />,
    },
    {
      label: 'Active Students',
      value: data.active,
      note: 'Currently active enrolment',
      accent: 'bg-emerald-500',
      visual: <ActiveComparison value={data.active} total={data.total} />,
    },
    {
      label: 'Detained Students',
      value: data.detained,
      note: 'Requires academic attention',
      accent: 'bg-amber-500',
      visual: <DetainedMatrix value={data.detained} total={data.total} />,
    },
    {
      label: 'Passed Out',
      value: data.passedOut,
      note: 'Programme completion records',
      accent: 'bg-violet-500',
      visual: <PassedCompletion value={data.passedOut} total={data.total} />,
    },
  ];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card, index) => (
        <motion.section
          key={card.label}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.05 }}
          className="flex min-h-44 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white"
        >
          <div className="flex min-h-20 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${card.accent}`} />
                <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {card.label}
                </p>
              </div>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {card.value.toLocaleString('en-IN')}
              </p>
            </div>
            <p className="max-w-24 text-right text-[10px] leading-4 text-slate-500">{card.note}</p>
          </div>
          <div className="flex min-h-24 flex-1 items-center px-3 py-2">{card.visual}</div>
        </motion.section>
      ))}
    </div>
  );
}
