/**
 * @file AsyncSelect.tsx
 * @description Reusable async select-field for forms across the app. Pulls
 *   options live from GET /search/options?type=:type&q=:query so dropdowns
 *   always show real backend data (students, faculty, departments, subjects,
 *   sections, batches, academic years, programs, semesters, users).
 *
 *   Usage:
 *     <AsyncSelect
 *       label="Student"
 *       type="students"
 *       value={values.studentId}
 *       onChange={(v) => setFieldValue('studentId', v)}
 *     />
 *
 *     <AsyncSelect
 *       label="Subjects"
 *       type="subjects"
 *       multiple
 *       value={values.subjectIds}
 *       onChange={(v) => setFieldValue('subjectIds', v)}
 *     />
 *
 * @module shared/core
 */
'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, X, Check, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import useSwr from '@/shared/hooks/useSwr';

export type TAsyncSelectType =
  | 'students'
  | 'studentProfiles'
  | 'faculty'
  | 'users'
  | 'departments'
  | 'subjects'
  | 'curricula'
  | 'sections'
  | 'batches'
  | 'academicYears'
  | 'programs'
  | 'semesters'
  | 'books'
  | 'alumni'
  | 'visitors'
  | 'facilitySpaces'
  | 'campuses'
  | 'roles'
  | 'feeRecords';

export interface IAsyncOption {
  value: string;
  label: string;
  sub?: string;
  meta?: Record<string, string | number | boolean | null>;
}

interface ICommonProps {
  /** Entity type to load options for. */
  type: TAsyncSelectType;
  /** Optional label rendered above the field. */
  label?: string;
  /** Placeholder when nothing is selected. */
  placeholder?: string;
  /** Disables the trigger. */
  disabled?: boolean;
  /** Show a red asterisk after the label. */
  required?: boolean;
  /** Inline error message rendered below the field. */
  error?: string;
  /** Extra wrapper className. */
  className?: string;
  /** Max options pulled per request (default 20). */
  limit?: number;
  /** Extra query params sent to the options endpoint. */
  params?: Record<string, string | number | boolean | null | undefined>;
  /** Contextual message shown when the backend returns no options. */
  emptyMessage?: string;
  /** Loads and selects every available option without requiring the menu to open. */
  autoSelectAll?: boolean;
}

interface ISingleProps extends ICommonProps {
  multiple?: false;
  value: string | null | undefined;
  onChange: (value: string | null, option?: IAsyncOption) => void;
}

interface IMultiProps extends ICommonProps {
  multiple: true;
  value: string[];
  onChange: (value: string[], options?: IAsyncOption[]) => void;
}

type IProps = ISingleProps | IMultiProps;

function useDebounced<T>(value: T, delay = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

/** Determine if the dropdown should open upward based on available space below the trigger. */
function useDropdownPosition(wrapperRef: React.RefObject<HTMLDivElement | null>, open: boolean) {
  const [openUp, setOpenUp] = useState(false);
  const [openLeft, setOpenLeft] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!open || !wrapperRef.current) return;

    const wrapper = wrapperRef.current;

    const updateDirection = () => {
      const rect = wrapper.getBoundingClientRect();
      // The menu is portalled to document.body, so viewport space—not a modal's
      // scroll container—is the real available area.
      const visibleTop = 8;
      const visibleBottom = window.innerHeight - 8;
      const spaceBelow = Math.max(0, visibleBottom - rect.bottom);
      const spaceAbove = Math.max(0, rect.top - visibleTop);
      const shouldOpenUp = spaceBelow < 360 && spaceAbove > spaceBelow;
      const width = Math.max(320, rect.width);
      const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8));
      setOpenUp(shouldOpenUp);
      setOpenLeft(window.innerWidth - rect.left < 340);
      setMenuStyle({
        position: 'fixed',
        left,
        top: shouldOpenUp ? undefined : rect.bottom + 4,
        bottom: shouldOpenUp ? window.innerHeight - rect.top + 4 : undefined,
        width,
        maxHeight: Math.min(420, Math.max(260, (shouldOpenUp ? spaceAbove : spaceBelow) - 8)),
      });
    };

    updateDirection();
    window.addEventListener('resize', updateDirection);
    window.addEventListener('scroll', updateDirection, true);
    return () => {
      window.removeEventListener('resize', updateDirection);
      window.removeEventListener('scroll', updateDirection, true);
    };
  }, [open, wrapperRef]);
  return { openUp, openLeft, menuStyle };
}

export default function AsyncSelect(props: IProps) {
  const {
    type,
    label,
    placeholder,
    disabled,
    required,
    error,
    className,
    limit = 20,
    params,
    emptyMessage,
    autoSelectAll = false,
  } = props;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query.trim(), 300);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [triggerWidth, setTriggerWidth] = useState(0);
  const { openUp, openLeft, menuStyle } = useDropdownPosition(wrapperRef, open);

  // Cache of options we've seen — so already-selected values can display a
  // proper label even before the user opens the dropdown.
  const [optionCache, setOptionCache] = useState<Record<string, IAsyncOption>>({});

  const extraQuery = useMemo(() => {
    const qs = new URLSearchParams();
    Object.entries(params ?? {}).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') qs.set(key, String(value));
    });
    return qs.toString();
  }, [params]);

  const url = useMemo(() => {
    if (!open && !autoSelectAll) return null;
    const qs = new URLSearchParams({ type, limit: String(limit) });
    if (debounced) qs.set('q', debounced);
    if (extraQuery) {
      new URLSearchParams(extraQuery).forEach((value, key) => qs.set(key, value));
    }
    return `search/options?${qs.toString()}`;
  }, [open, autoSelectAll, type, limit, debounced, extraQuery]);

  const { data, isLoading } = useSwr<{ success: boolean; data: IAsyncOption[] }>(url);
  const options = useMemo(() => data?.data ?? [], [data]);

  // Keep cache fresh as new results come in.
  useEffect(() => {
    if (options.length === 0) return;
    // Selected IDs need labels even after the dropdown closes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOptionCache((prev) => {
      const next = { ...prev };
      for (const o of options) next[o.value] = o;
      return next;
    });
  }, [options]);

  useEffect(() => {
    if (!autoSelectAll || open || !props.multiple || options.length === 0) return;
    const allValues = options.map((option) => option.value);
    const current = props.value ?? [];
    if (
      current.length === allValues.length &&
      allValues.every((value) => current.includes(value))
    ) {
      return;
    }
    props.onChange(allValues, options);
  }, [autoSelectAll, open, options, props]);

  // Fetch labels for any pre-selected values not yet in cache.
  const selectedValues = useMemo(() => {
    if (props.multiple) return props.value ?? [];
    return props.value ? [props.value] : [];
  }, [props]);

  const missingValues = useMemo(
    () => selectedValues.filter((v) => v && !optionCache[v]),
    [selectedValues, optionCache],
  );

  // Lazy fetch for missing labels (e.g. on form edit). We pass the value as
  // the query and pick the matching option if returned.
  const hydrateUrl =
    missingValues.length > 0
      ? `search/options?type=${type}&q=${encodeURIComponent(missingValues[0])}&limit=5${
          extraQuery ? `&${extraQuery}` : ''
        }`
      : null;
  const { data: hydrateData, isLoading: isHydrating } = useSwr<{
    success: boolean;
    data: IAsyncOption[];
  }>(hydrateUrl);
  useEffect(() => {
    const hits = hydrateData?.data ?? [];
    if (hits.length === 0) return;
    // Selected IDs need labels even before the user opens the dropdown.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOptionCache((prev) => {
      const next = { ...prev };
      for (const o of hits) next[o.value] = o;
      return next;
    });
  }, [hydrateData]);

  // Close on outside click / Esc.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node) &&
        !menuRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
        setQuery('');
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // ── Display label(s) on the trigger ────────────────────────────────────
  function labelFor(value: string): string {
    if (optionCache[value]?.meta?.shortLabel) return String(optionCache[value].meta?.shortLabel);
    if (optionCache[value]?.label) return optionCache[value].label;
    if (missingValues[0] === value && isHydrating) return 'Loading…';
    if (missingValues[0] === value && hydrateData) return 'Record unavailable';
    return value ? 'Record unavailable' : 'Loading…';
  }

  const isSelected = (value: string) =>
    props.multiple ? props.value?.includes(value) : props.value === value;

  const handleSelect = useCallback(
    (option: IAsyncOption) => {
      if (option.meta?.busy === true) return;
      setOptionCache((current) => ({ ...current, [option.value]: option }));
      if (props.multiple) {
        const current = props.value ?? [];
        const exists = current.includes(option.value);
        const next = exists
          ? current.filter((v) => v !== option.value)
          : [...current, option.value];
        const nextOptions = next
          .map((v) => (v === option.value ? option : optionCache[v]))
          .filter(Boolean) as IAsyncOption[];
        props.onChange(next, nextOptions);
      } else {
        props.onChange(option.value, option);
        setOpen(false);
        setQuery('');
      }
    },
    // deps are stable — optionCache is included intentionally to read latest labels
    [props, optionCache],
  );

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (props.multiple) props.onChange([], []);
    else props.onChange(null, undefined);
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen((o) => !o);
    }
  };

  const hasValue = props.multiple ? (props.value?.length ?? 0) > 0 : !!props.value;
  const multiCount = props.multiple ? (props.value?.length ?? 0) : 0;
  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) return;
    const updateWidth = () => setTriggerWidth(element.getBoundingClientRect().width);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const visibleMultiValues = useMemo(() => {
    if (!props.multiple) return [];
    if (!triggerWidth) return props.value.slice(0, 1);
    const available = Math.max(80, triggerWidth - 76);
    let used = 0;
    let visible = 0;
    for (const value of props.value) {
      const label = optionCache[value]?.label ?? value;
      const chipWidth = Math.min(160, Math.max(72, label.length * 7 + 34));
      const remainingAfter = props.value.length - (visible + 1);
      const overflowBadgeWidth = remainingAfter > 0 ? 68 : 0;
      if (used + chipWidth + overflowBadgeWidth > available && visible > 0) break;
      used += chipWidth + 6;
      visible += 1;
    }
    return props.value.slice(0, Math.max(1, visible));
  }, [optionCache, props, triggerWidth]);

  return (
    <div className={`flex flex-col gap-1 ${className ?? ''}`}>
      {label && (
        <label className="text-xs font-semibold text-slate-600">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      <div ref={wrapperRef} className={`relative ${open ? 'z-[200]' : 'z-0'}`}>
        {/* ── Trigger ─────────────────────────────────────────────────── */}
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
          aria-expanded={open}
          onClick={() => !disabled && setOpen((o) => !o)}
          onKeyDown={handleTriggerKeyDown}
          className={[
            'flex w-full min-w-0 items-center gap-2 rounded-lg border bg-white px-3 py-2.5 text-left text-sm transition-all focus:outline-none',
            open
              ? 'border-primary ring-2 ring-primary/10'
              : error
                ? 'border-red-300 ring-1 ring-red-100'
                : 'border-slate-200 hover:border-slate-300',
            disabled ? 'cursor-not-allowed bg-slate-50 opacity-60' : 'cursor-pointer',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {/* Value display area */}
          <div className="min-w-0 flex-1 overflow-hidden">
            {!hasValue ? (
              <span className="text-slate-600">{placeholder ?? `Select ${type}…`}</span>
            ) : props.multiple ? (
              // Multi: show first tag + overflow count badge — no wrapping
              <div className="flex min-w-0 items-center gap-1.5">
                {visibleMultiValues.map((v) => (
                  <span
                    key={v}
                    className="inline-flex max-w-40 shrink-0 items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                  >
                    <span className="truncate">{labelFor(v)}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const next = props.value.filter((x) => x !== v);
                        const nextOptions = next
                          .map((x) => optionCache[x])
                          .filter(Boolean) as IAsyncOption[];
                        props.onChange(next, nextOptions);
                      }}
                      className="shrink-0 cursor-pointer rounded hover:bg-primary/20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {multiCount > visibleMultiValues.length && (
                  <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                    +{multiCount - visibleMultiValues.length} more
                  </span>
                )}
              </div>
            ) : (
              <span className="block truncate text-slate-800">
                {labelFor(props.value as string)}
              </span>
            )}
          </div>

          {/* Right-side controls */}
          <div className="flex shrink-0 items-center gap-1">
            {hasValue && !disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="cursor-pointer rounded p-0.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-600"
                aria-label="Clear selection"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <ChevronDown
              className={`h-4 w-4 text-slate-600 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
            />
          </div>
        </div>

        {/* ── Dropdown ────────────────────────────────────────────────── */}
        {typeof document !== 'undefined' &&
          createPortal(
            <AnimatePresence>
              {open && (
                <motion.div
                  ref={menuRef}
                  initial={{ opacity: 0, y: openUp ? 4 : -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: openUp ? 4 : -4, scale: 0.98 }}
                  transition={{ duration: 0.12 }}
                  className={[
                    'z-[9999] flex min-w-[320px] flex-col overflow-hidden rounded-xl border border-slate-300 bg-white',
                    openLeft ? 'origin-right' : 'origin-left',
                  ].join(' ')}
                  style={menuStyle}
                >
                  {/* Search */}
                  <div className="shrink-0 border-b border-slate-100 bg-white px-3 py-3">
                    <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
                      <Search className="h-4 w-4 shrink-0 text-slate-600" />
                      <input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Type to search…"
                        style={{ outline: 'none', boxShadow: 'none' }}
                        className="flex-1 bg-transparent text-base text-slate-700 placeholder:text-slate-600"
                      />
                      {isLoading && (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                      )}
                    </div>
                  </div>

                  {/* Options list */}
                  <div className="flex-1 overflow-y-auto py-1">
                    {isLoading && options.length === 0 && (
                      <div className="space-y-1.5 px-2.5 py-2">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="h-7 animate-pulse rounded-lg bg-slate-100" />
                        ))}
                      </div>
                    )}

                    {/* Empty */}
                    {!isLoading && options.length === 0 && (
                      <p className="px-4 py-4 text-center text-xs leading-5 text-slate-600">
                        {emptyMessage ?? 'No results found'}
                      </p>
                    )}

                    {/* Items */}
                    {options.map((opt) => {
                      const selected = isSelected(opt.value);
                      const unavailable = opt.meta?.busy === true;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => handleSelect(opt)}
                          disabled={unavailable}
                          className={[
                            'flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors',
                            unavailable
                              ? 'cursor-not-allowed bg-red-50/60 text-slate-600 opacity-75'
                              : selected
                                ? 'bg-primary/8 text-primary'
                                : 'text-slate-700 hover:bg-slate-50',
                          ].join(' ')}
                        >
                          {/* Checkbox for multi */}
                          {props.multiple && (
                            <span
                              className={[
                                'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                                selected
                                  ? 'border-primary bg-primary text-white'
                                  : 'border-slate-300 bg-white',
                              ].join(' ')}
                            >
                              {selected && <Check className="h-3 w-3" />}
                            </span>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                              <p className="min-w-0 font-medium leading-snug">{opt.label}</p>
                              {(opt.meta?.branchCode || opt.meta?.designationLabel) && (
                                <div className="flex shrink-0 flex-wrap items-center gap-1">
                                  {opt.meta?.branchCode && (
                                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                                      {String(opt.meta.branchCode)}
                                    </span>
                                  )}
                                  {opt.meta?.designationLabel && (
                                    <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                                      {String(opt.meta.designationLabel)}
                                    </span>
                                  )}
                                  {unavailable && (
                                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                                      Busy
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            {opt.sub && (
                              <p className="mt-0.5 text-xs leading-snug text-slate-600">
                                {opt.sub}
                              </p>
                            )}
                          </div>

                          {/* Single-select checkmark */}
                          {!props.multiple && selected && (
                            <Check className="h-4 w-4 shrink-0 text-primary" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Multi footer — count + done */}
                  {props.multiple && multiCount > 0 && (
                    <div className="flex shrink-0 items-center justify-between border-t border-slate-100 px-3 py-2">
                      <span className="text-xs text-slate-500">{multiCount} selected</span>
                      <button
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          setQuery('');
                        }}
                        className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-white transition-all hover:brightness-110 active:scale-95"
                      >
                        Done
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>,
            document.body,
          )}
      </div>

      {error && (
        <p className="flex items-center gap-1 text-xs text-red-500">
          <span className="inline-block h-1 w-1 shrink-0 rounded-full bg-red-400" />
          {error}
        </p>
      )}
    </div>
  );
}
