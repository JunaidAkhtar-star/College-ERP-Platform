'use client';

import { motion } from '@/shared/utils/motion';
import { MessageSquareText } from 'lucide-react';
import Empty from '@/shared/core/Empty';

interface IFeedbackDatum {
  criterion: string;
  averageScore: number;
  count: number;
}

function point(index: number, total: number, value: number, radius: number) {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  const scaled = radius * Math.min(1, Math.max(0, value / 5));
  return `${80 + Math.cos(angle) * scaled},${80 + Math.sin(angle) * scaled}`;
}

export default function IqacFeedbackInsights({ data }: { data: IFeedbackDatum[] }) {
  const visible = data.slice(0, 8);
  const responses = data.reduce((sum, item) => sum + item.count, 0);
  const weightedScore = responses
    ? data.reduce((sum, item) => sum + item.averageScore * item.count, 0) / responses
    : 0;
  const shape = visible
    .map((item, index) => point(index, visible.length, item.averageScore, 58))
    .join(' ');

  if (!data.length)
    return (
      <div className="rounded-2xl bg-white">
        <Empty
          title="No feedback analysis yet"
          subTitle="Submitted ratings for this audience and reporting period will appear here."
        />
      </div>
    );

  return (
    <section className="grid gap-4 lg:grid-cols-[1.05fr_1fr]" aria-label="Feedback analytics">
      <motion.article
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">Criterion quality map</p>
            <p className="mt-1 text-xs text-slate-500">
              Shape and balance of live average ratings.
            </p>
          </div>
          <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-600">
            {responses ? `${weightedScore.toFixed(1)}/5` : 'No score'}
          </span>
        </div>
        {visible.length >= 3 ? (
          <div className="mt-4 grid items-center gap-4 sm:grid-cols-[190px_1fr]">
            <svg viewBox="0 0 160 160" className="mx-auto h-44 w-44" role="img">
              <title>Feedback criterion radar</title>
              {[0.33, 0.66, 1].map((scale) => (
                <polygon
                  key={scale}
                  points={visible
                    .map((_, index) => point(index, visible.length, 5 * scale, 58))
                    .join(' ')}
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />
              ))}
              {visible.map((_, index) => (
                <line
                  key={index}
                  x1="80"
                  y1="80"
                  x2={point(index, visible.length, 5, 58).split(',')[0]}
                  y2={point(index, visible.length, 5, 58).split(',')[1]}
                  stroke="#f1f5f9"
                />
              ))}
              <motion.polygon
                points={shape}
                fill="#ede9fe"
                fillOpacity="0.8"
                stroke="#8b5cf6"
                strokeWidth="2"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.7 }}
              />
            </svg>
            <div className="space-y-2">
              {visible.map((item) => (
                <div
                  key={item.criterion}
                  className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2"
                >
                  <span className="truncate text-xs font-medium capitalize text-slate-600">
                    {item.criterion.replace(/_/g, ' ')}
                  </span>
                  <span className="shrink-0 text-sm font-bold text-slate-800">
                    {item.averageScore.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-4 flex min-h-44 items-center justify-center rounded-xl bg-slate-50 px-6 text-center text-sm text-slate-500">
            At least three rated criteria are needed to form a quality map.
          </div>
        )}
      </motion.article>
      <motion.article
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6"
      >
        <div>
          <p className="text-sm font-semibold text-slate-800">Response evidence</p>
          <p className="mt-1 text-xs text-slate-500">Participation behind each displayed score.</p>
        </div>
        {visible.length ? (
          <div className="mt-5 space-y-3">
            {visible.map((item, index) => {
              const max = Math.max(...visible.map((entry) => entry.count), 1);
              const bubble =
                item.count / max > 0.66
                  ? 'h-12 w-12'
                  : item.count / max > 0.33
                    ? 'h-10 w-10'
                    : 'h-8 w-8';
              return (
                <motion.div
                  key={item.criterion}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center gap-3 rounded-xl bg-slate-50 p-2.5"
                >
                  <span
                    className={`flex shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 ${bubble}`}
                  >
                    {item.count}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold capitalize text-slate-700">
                      {item.criterion.replace(/_/g, ' ')}
                    </p>
                    <p className="text-[11px] text-slate-500">rated responses</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 flex min-h-44 flex-col items-center justify-center rounded-xl bg-slate-50 px-6 text-center">
            <MessageSquareText className="h-7 w-7 text-slate-300" />
            <p className="mt-2 text-sm text-slate-500">
              Responses will appear after feedback is submitted.
            </p>
          </div>
        )}
      </motion.article>
    </section>
  );
}
