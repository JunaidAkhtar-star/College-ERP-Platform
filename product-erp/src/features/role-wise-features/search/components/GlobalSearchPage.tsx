/**
 * @file GlobalSearchPage.tsx
 * @description Global full-text search across users, students and faculty.
 *   GET /search?q=:query&index=users|students|faculty&page=1&limit=10
 * @module features/role-wise-features/search
 */
'use client';

import React, { useState, useCallback } from 'react';
import { Search, Users, GraduationCap, UserCheck, X, ChevronRight, Building2 } from 'lucide-react';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import CustomButton from '@/shared/core/CustomButton';
import useSwr from '@/shared/hooks/useSwr';
import UseProtectedRoutes from '@/shared/hooks/UseProtectedRoutes';
import type { TSearchIndex, ISearchResult } from '../types/search.types';

// ─── Constants ────────────────────────────────────────────────────────────────
const INDEX_OPTIONS: { key: TSearchIndex; label: string; icon: React.ReactNode; color: string }[] =
  [
    {
      key: 'students',
      label: 'Students',
      icon: <GraduationCap className="h-4 w-4" />,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      key: 'faculty',
      label: 'Faculty',
      icon: <UserCheck className="h-4 w-4" />,
      color: 'text-green-600 bg-green-50',
    },
    {
      key: 'users',
      label: 'Users',
      icon: <Users className="h-4 w-4" />,
      color: 'text-purple-600 bg-purple-50',
    },
  ];

function deptLabel(d: ISearchResult['department']) {
  if (!d) return null;
  if (typeof d === 'string') return d;
  return d.name;
}

// ─── Result Row ───────────────────────────────────────────────────────────────
function ResultRow({ result, index }: { result: ISearchResult; index: TSearchIndex }) {
  const cfg = INDEX_OPTIONS.find((o) => o.key === index)!;
  const primaryLabel =
    result.name ??
    (result.rollNumber ? `Roll: ${result.rollNumber}` : (result.employeeId ?? result._id));
  const secondaryLabel = result.email;
  const badge = result.rollNumber ?? result.employeeId;
  const dept = deptLabel(result.department);

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-4 rounded-xl bg-white px-5 py-4 hover:bg-slate-50 transition-colors cursor-pointer"
    >
      {/* Icon badge */}
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${cfg.color}`}
      >
        {cfg.icon}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{primaryLabel}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {secondaryLabel && <p className="text-xs text-slate-500 truncate">{secondaryLabel}</p>}
          {dept && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-600">
              <Building2 className="h-3 w-3" /> {dept}
            </span>
          )}
        </div>
      </div>

      {/* Right badges */}
      <div className="flex items-center gap-2 shrink-0">
        {badge && (
          <span className="rounded-lg bg-slate-100 px-2.5 py-0.5 text-xs font-mono text-slate-600">
            {badge}
          </span>
        )}
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.color}`}>
          {cfg.label}
        </span>
        <ChevronRight className="h-4 w-4 text-slate-300" />
      </div>
    </motion.div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
function GlobalSearchPage() {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState<TSearchIndex>('students');
  const [page, setPage] = useState(1);
  const [inputVal, setInputVal] = useState('');

  const limit = 15;

  // Only fetch when query is non-empty
  const apiUrl =
    query.trim().length >= 2
      ? `search?q=${encodeURIComponent(query)}&index=${index}&page=${page}&limit=${limit}`
      : null;

  const { data, isLoading, error } = useSwr(apiUrl);
  const results: ISearchResult[] = data?.data ?? [];

  const handleSearch = useCallback((val: string) => {
    setQuery(val);
    setPage(1);
  }, []);

  const handleIndexChange = (i: TSearchIndex) => {
    setIndex(i);
    setPage(1);
  };

  const handleClear = () => {
    setInputVal('');
    setQuery('');
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Global Search</h1>
        <p className="mt-0.5 text-sm text-slate-500">Search across students, faculty and users</p>
      </div>

      {/* Search bar */}
      <div className="rounded-2xl bg-white p-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-600" />
          <input
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearch(inputVal);
            }}
            placeholder="Search by name, email, roll number or employee ID…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-28 text-sm text-slate-800 placeholder:text-slate-600 focus:border-primary focus:bg-white focus:outline-none transition-colors"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-2">
            {inputVal && (
              <button onClick={handleClear} className="rounded-lg p-1.5 hover:bg-slate-100">
                <X className="h-4 w-4 text-slate-600" />
              </button>
            )}
            <CustomButton
              variant="primary"
              className="py-1.5! text-sm!"
              onClick={() => handleSearch(inputVal)}
            >
              Search
            </CustomButton>
          </div>
        </div>

        {/* Index selector */}
        <div className="mt-4 flex gap-2 flex-wrap">
          {INDEX_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => handleIndexChange(opt.key)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                index === opt.key
                  ? `${opt.color} ring-2 ring-current ring-offset-1`
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div>
        {/* Status line */}
        <div className="mb-3 flex items-center justify-between px-1">
          {query.trim().length >= 2 ? (
            <p className="text-sm text-slate-500">
              {error
                ? 'Search is temporarily unavailable'
                : isLoading
                  ? 'Searching…'
                  : `${results.length} result${results.length !== 1 ? 's' : ''} for "${query}"`}
            </p>
          ) : (
            <p className="text-sm text-slate-600">Type at least 2 characters to search</p>
          )}

          {results.length > 0 && !isLoading && !error && (
            <div className="flex items-center gap-2">
              <CustomButton
                variant="tertiary"
                className="py-1! text-xs!"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Prev
              </CustomButton>
              <span className="text-xs text-slate-500">Page {page}</span>
              <CustomButton
                variant="tertiary"
                className="py-1! text-xs!"
                disabled={results.length < limit}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </CustomButton>
            </div>
          )}
        </div>

        {/* Empty state — landing */}
        {query.trim().length < 2 && (
          <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-20">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Search className="h-8 w-8 text-primary" />
            </div>
            <p className="text-base font-semibold text-slate-700">Start searching</p>
            <p className="mt-1 text-sm text-slate-600">
              Enter a name, email, roll number, or employee ID above
            </p>
            <div className="mt-6 flex gap-3">
              {INDEX_OPTIONS.map((opt) => (
                <div
                  key={opt.key}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium ${opt.color}`}
                >
                  {opt.icon} {opt.label}
                </div>
              ))}
            </div>
          </div>
        )}

        {error && query.trim().length >= 2 && (
          <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            Search results could not be loaded. Please retry your search.
          </div>
        )}

        {/* Loading */}
        {isLoading && query.trim().length >= 2 && (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-white" />
            ))}
          </div>
        )}

        {/* No results */}
        {!error && !isLoading && query.trim().length >= 2 && results.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-16">
            <Search className="mb-3 h-10 w-10 text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">No results found</p>
            <p className="mt-1 text-xs text-slate-600">Try a different search term or index</p>
          </div>
        )}

        {/* Results list */}
        <AnimatePresence>
          {!error && !isLoading && results.length > 0 && (
            <div className="flex flex-col gap-2">
              {results.map((r, i) => (
                <motion.div
                  key={`${r._id}-${i}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <ResultRow result={r} index={index} />
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default UseProtectedRoutes(GlobalSearchPage);
