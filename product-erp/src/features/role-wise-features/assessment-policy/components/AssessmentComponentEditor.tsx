/** @file AssessmentComponentEditor.tsx @description Edits one configurable assessment component. @module features/assessment-policy */
'use client';
import { Trash2 } from 'lucide-react';
import type { IAssessmentComponent } from '../types/assessment-policy.types';
const input =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary';
const lbl = 'mb-1 block text-xs font-bold text-slate-700';
interface IProps {
  value: IAssessmentComponent;
  index: number;
  onChange: (index: number, value: IAssessmentComponent) => void;
  onRemove: (index: number) => void;
}
export default function AssessmentComponentEditor({ value, index, onChange, onRemove }: IProps) {
  const set = <K extends keyof IAssessmentComponent>(key: K, next: IAssessmentComponent[K]) =>
    onChange(index, { ...value, [key]: next });
  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition-all">
      {/* Card header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex size-5 items-center justify-center rounded bg-slate-200 text-xs font-bold text-slate-800">
            {index + 1}
          </span>
          <div>
            <p className="text-sm font-bold text-slate-800">{value.name || `Component #${index + 1}`}</p>
            <p className="text-[11px] leading-4 text-slate-500">
              Configure score weighting, attempt rules, and passing thresholds.
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Remove component"
          onClick={() => onRemove(index)}
          className="flex items-center gap-1.5 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
        >
          <Trash2 size={13} />
          Remove
        </button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <label className={lbl}>Component name *</label>
          <input
            className={input}
            placeholder="e.g. Mid-semester exam"
            value={value.name}
            onChange={(e) => {
              const name = e.target.value;
              onChange(index, {
                ...value,
                name,
                key: name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
              });
            }}
          />
        </div>
        <div>
          <label className={lbl}>Score source *</label>
          <select className={input} value={value.source}
            onChange={(e) => set('source', e.target.value as IAssessmentComponent['source'])}>
            <option value="manual">Manual marks</option>
            <option value="quiz">Quiz</option>
            <option value="assignment">Assignment</option>
            <option value="attendance">Attendance derived</option>
            <option value="lab_activity">Lab / activity</option>
            <option value="examination">Examination</option>
            <option value="import">Imported score</option>
          </select>
        </div>
        <div>
          <label className={lbl}>Delivery method</label>
          <select className={input} value={value.deliveryMode}
            onChange={(e) => set('deliveryMode', e.target.value as IAssessmentComponent['deliveryMode'])}>
            <option value="not_applicable">Not applicable</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="hybrid">Online or offline</option>
          </select>
        </div>
        <div>
          <label className={lbl}>Maximum marks *</label>
          <input className={input} type="number" min="0.01" step="0.01"
            aria-label="Maximum marks" value={value.maximumMarks}
            onChange={(e) => set('maximumMarks', Number(e.target.value))} />
        </div>
        <div>
          <label className={lbl}>Pass marks</label>
          <input className={input} type="number" min="0" step="0.01"
            aria-label="Pass marks" value={value.minimumPassMarks}
            onChange={(e) => set('minimumPassMarks', Number(e.target.value))} />
        </div>
        <div>
          <label className={lbl}>Attempts</label>
          <input className={input} type="number" min="1" max="100"
            aria-label="Attempt count" value={value.attemptCount}
            onChange={(e) => set('attemptCount', Number(e.target.value))} />
        </div>
        <div>
          <label className={lbl}>Combine attempts</label>
          <select className={input} value={value.method}
            onChange={(e) => set('method', e.target.value as IAssessmentComponent['method'])}>
            <option value="sum">Sum attempts</option>
            <option value="average">Average attempts</option>
            <option value="best_n">Best N attempts</option>
            <option value="drop_lowest">Drop lowest</option>
            <option value="weighted">Weighted score</option>
            <option value="scale">Scale score</option>
          </select>
        </div>
        {value.method === 'best_n' && (
          <div>
            <label className={lbl}>Best N count</label>
            <input className={input} type="number" min="1" max={value.attemptCount}
              value={value.bestCount ?? 1}
              onChange={(e) => set('bestCount', Number(e.target.value))} />
          </div>
        )}
        <div>
          <label className={lbl}>Scale from (optional)</label>
          <input className={input} type="number" min="0.01" step="0.01"
            placeholder="e.g. 100" value={value.scaleFrom ?? ''}
            onChange={(e) => set('scaleFrom', e.target.value ? Number(e.target.value) : undefined)} />
        </div>
        <div>
          <label className={lbl}>Score rounding</label>
          <select className={input} value={value.rounding}
            onChange={(e) => set('rounding', e.target.value as IAssessmentComponent['rounding'])}>
            <option value="none">No rounding</option>
            <option value="nearest_integer">Nearest integer</option>
            <option value="nearest_half">Nearest 0.5</option>
            <option value="floor">Round down</option>
            <option value="ceil">Round up</option>
          </select>
        </div>
        <div>
          <label className={lbl}>Report group (optional)</label>
          <input className={input} placeholder="e.g. Internal assessment"
            value={value.category}
            onChange={(e) => set('category', e.target.value)} />
        </div>
      </div>

      {/* Toggles */}
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3 border-t border-slate-100 pt-3">
        {[
          { label: 'Required for submission', field: 'isRequired' as const, checked: value.isRequired },
          { label: 'Require attendance before marks', field: 'attendanceRequired' as const, checked: value.attendanceRequired },
          { label: 'Allow authorised makeup', field: 'allowMakeup' as const, checked: value.allowMakeup },
        ].map(({ label, field, checked }) => (
          <label key={field} className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => set(field, e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-primary"
            />
            {label}
          </label>
        ))}
      </div>
    </article>
  );
}

