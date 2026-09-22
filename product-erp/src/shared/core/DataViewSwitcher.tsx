/**
 * @file DataViewSwitcher.tsx
 * @description Generic grid/table view toggle. Wraps an existing CustomTable
 *   usage and lets the page expose a card-grid alternative for the same data.
 *
 *   Grid mode runs its own search + pagination; table mode delegates to the
 *   provided <CustomTable /> JSX. View mode is persisted in localStorage when
 *   a `storageKey` is supplied.
 *
 * @usage
 *   <DataViewSwitcher
 *     data={filtered}
 *     isLoading={isLoading}
 *     storageKey="faculty.view"
 *     renderCard={(f) => <FacultyCard f={f} />}
 *     table={
 *       <CustomTable data={filtered} columns={columns} actions={actions} ... />
 *     }
 *   />
 */
'use client';

import React, { useMemo, useState } from 'react';
import { LayoutGrid, Table as TableIcon, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from '@/shared/utils/motion';
import { getFromLocalStorage, saveToLocalStorage } from '@/shared/utils';
import Empty from '@/shared/core/Empty';

export type ViewMode = 'grid' | 'table';

interface IDataViewSwitcherProps<T> {
  /** Full (already filtered/sorted) dataset rendered in either view. */
  data: T[];
  /** Loading flag shared with the table side. */
  isLoading?: boolean;
  /** Cell renderer for the grid view. Should return a single card. */
  renderCard: (row: T, index: number) => React.ReactNode;
  /** The existing <CustomTable /> JSX to render in table mode. */
  table: React.ReactNode;
  /** Default view when no storage value exists. Defaults to 'grid'. */
  defaultView?: ViewMode;
  /** localStorage key for persisting the user's view choice. */
  storageKey?: string;
  /** Placeholder for the in-grid search box. */
  searchPlaceholder?: string;
  /**
   * Field accessor list for the in-grid search (case-insensitive substring).
   * If omitted, all string/number values on each row are searched.
   */
  searchFields?: (keyof T | string)[];
  /** Grid page size. Defaults to 12. */
  pageSize?: number;
  /** Tailwind grid-template-cols classes. */
  gridClassName?: string;
  /** Render this above the toggle if a custom toolbar is needed. */
  toolbarLeft?: React.ReactNode;
  /** Optional collapsible content that belongs to the toolbar. */
  toolbarPanel?: React.ReactNode;
  /** Empty-state message for the grid. */
  emptyMessage?: string;
  /** Supporting guidance shown when there are no records. */
  emptySubTitle?: string;
  /** Whether to show the local search input. Defaults to true. */
  showSearch?: boolean;
}

function pickInitialView(storageKey: string | undefined, fallback: ViewMode): ViewMode {
  if (!storageKey) return fallback;
  const stored = getFromLocalStorage(storageKey);
  return stored === 'grid' || stored === 'table' ? stored : fallback;
}

function matches<T>(row: T, q: string, fields?: (keyof T | string)[]): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  if (fields && fields.length) {
    return fields.some((f) => {
      const v = (row as Record<string, unknown>)[String(f)];
      return v != null && String(v).toLowerCase().includes(needle);
    });
  }
  for (const v of Object.values(row as Record<string, unknown>)) {
    if (v == null) continue;
    const t = typeof v;
    if ((t === 'string' || t === 'number') && String(v).toLowerCase().includes(needle)) {
      return true;
    }
  }
  return false;
}

export default function DataViewSwitcher<T>({
  data,
  isLoading,
  renderCard,
  table,
  defaultView = 'table',
  storageKey,
  searchPlaceholder = 'Search…',
  searchFields,
  pageSize = 12,
  gridClassName = 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  toolbarLeft,
  toolbarPanel,
  emptyMessage = 'No records to display',
  emptySubTitle = 'New records will appear here when they are available.',
  showSearch = true,
}: IDataViewSwitcherProps<T>) {
  const [view, setView] = useState<ViewMode>(() => pickInitialView(storageKey, defaultView));
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const setViewMode = (v: ViewMode) => {
    setView(v);
    setPage(0);
    if (storageKey) saveToLocalStorage(storageKey, v);
  };

  const filtered = useMemo(
    () => (view === 'grid' ? data.filter((r) => matches(r, search, searchFields)) : data),
    [data, search, view, searchFields],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows =
    view === 'grid' ? filtered.slice(safePage * pageSize, (safePage + 1) * pageSize) : filtered;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          {toolbarLeft}
          {showSearch && view === 'grid' && (
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder={searchPlaceholder}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 pl-9 text-sm placeholder-slate-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          )}
        </div>
        <div
          className="flex shrink-0 overflow-hidden rounded-lg border border-slate-200"
          role="group"
          aria-label="Toggle view mode"
        >
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            aria-pressed={view === 'grid'}
            title="Grid view"
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
              view === 'grid'
                ? 'bg-primary text-white'
                : 'bg-white text-slate-500 hover:bg-slate-50'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Grid
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            aria-pressed={view === 'table'}
            title="Table view"
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
              view === 'table'
                ? 'bg-primary text-white'
                : 'bg-white text-slate-500 hover:bg-slate-50'
            }`}
          >
            <TableIcon className="h-3.5 w-3.5" />
            Table
          </button>
        </div>
      </div>

      {toolbarPanel}

      {view === 'table' ? (
        <>{table}</>
      ) : isLoading && data.length === 0 ? (
        <div className={gridClassName}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : pageRows.length === 0 ? (
        <div className="rounded-2xl bg-white">
          <Empty
            title={search ? `No results for “${search}”` : emptyMessage}
            subTitle={search ? 'Try a different name, code, or keyword.' : emptySubTitle}
          />
        </div>
      ) : (
        <>
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={gridClassName}
          >
            {pageRows.map((row, i) => (
              <React.Fragment key={i}>{renderCard(row, safePage * pageSize + i)}</React.Fragment>
            ))}
          </motion.div>
          {filtered.length > pageSize && (
            <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-xs text-slate-500">
              <span>
                {safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, filtered.length)} of{' '}
                {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={safePage === 0}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="px-2 font-medium text-slate-600">
                  {safePage + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={safePage >= totalPages - 1}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
