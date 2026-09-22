/** @file GradeScaleEditor.tsx @description Configures letter-grade bands with proper visual borders, column headers, and buttons. @module features/assessment-policy */
'use client';
import { Plus, Trash2 } from 'lucide-react';
import CustomButton from '@/shared/core/CustomButton';

export interface IGradeBand {
  letter: string;
  minimumPercentage: number;
  point: number;
}

interface IProps {
  value: IGradeBand[];
  onChange: (value: IGradeBand[]) => void;
}

const input =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15';

export default function GradeScaleEditor({ value, onChange }: IProps) {
  const update = (index: number, patch: Partial<IGradeBand>) =>
    onChange(value.map((band, i) => (i === index ? { ...band, ...patch } : band)));

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/60 pb-3">
        <div>
          <p className="text-sm font-bold text-slate-800">Grade scale mapping</p>
          <p className="text-xs text-slate-500">
            Define grade letters and their minimum percentage cutoffs. (Optional)
          </p>
        </div>
        <CustomButton
          size="sm"
          variant="secondary"
          fullWidth={false}
          startIcon={<Plus size={14} />}
          onClick={() => onChange([...value, { letter: '', minimumPercentage: 0, point: 0 }])}
        >
          Add grade band
        </CustomButton>
      </div>

      {value.length > 0 && (
        <div className="mt-4 space-y-2">
          {/* Header Row */}
          <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <div>Grade Letter</div>
            <div>Min Percentage (%)</div>
            <div>Grade Points</div>
            <div className="w-9"></div> {/* spacing for delete button */}
          </div>

          {/* Value Rows */}
          {value.map((band, index) => (
            <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 items-center">
              <input
                className={input}
                aria-label="Grade letter"
                placeholder="e.g. A+"
                value={band.letter}
                onChange={(e) => update(index, { letter: e.target.value })}
              />
              <input
                className={input}
                aria-label="Minimum percentage"
                type="number"
                min="0"
                max="100"
                placeholder="e.g. 90"
                value={band.minimumPercentage || ''}
                onChange={(e) => update(index, { minimumPercentage: Number(e.target.value) })}
              />
              <input
                className={input}
                aria-label="Grade point"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 10.0"
                value={band.point || ''}
                onChange={(e) => update(index, { point: Number(e.target.value) })}
              />
              <button
                type="button"
                aria-label="Remove grade band"
                onClick={() => onChange(value.filter((_, i) => i !== index))}
                className="rounded-xl border border-slate-200 bg-white p-2.5 text-rose-500 hover:bg-rose-50 hover:border-rose-200 transition shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {value.length === 0 && (
        <p className="mt-3 text-xs italic text-slate-400 text-center py-4 bg-white/50 rounded-xl border border-dashed border-slate-200">
          No grade bands configured. Numeric marks will be reported as-is.
        </p>
      )}
    </section>
  );
}

