/**
 * @file AuditLogPage.tsx
 * @description System-wide audit log for tracking all user activities.
 * @module features/role-wise-features/audit-log
 */

'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { toast } from 'react-toastify';
import {
  Search,
  Filter,
  X,
  User,
  Activity,
  Eye,
  Pencil,
  Trash2,
  Plus,
  Download,
  AlertTriangle,
  ChevronRight,
  Clock3,
  FileClock,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import CustomTable, { Action, Column } from '@/shared/core/CustomTable';
import CustomButton from '@/shared/core/CustomButton';
import useSwr from '@/shared/hooks/useSwr';
import Empty from '@/shared/core/Empty';

interface IAuditLog {
  _id: string;
  userId: {
    _id: string;
    name: string;
    email: string;
  };
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT';
  module: string;
  resourceId?: string;
  resourceName?: string;
  rawAction?: string;
  description?: string;
  reason?: string;
  userName?: string;
  userRole?: string;
  targetModel?: string;
  changes?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  eventHash?: string;
  risk?: 'low' | 'medium' | 'high';
  securityContextRestricted?: boolean;
  timestamp: string;
  [key: string]: unknown;
}

function humanize(value?: string) {
  if (!value) return 'System activity';
  return value
    .replace(/^BUSINESS_(POST|PUT|PATCH|DELETE)_/i, '')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function safeValue(value: unknown) {
  if (value === undefined || value === null || value === '') return 'Not set';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

const ACTION_CONFIG: Record<
  IAuditLog['action'],
  { label: string; color: string; icon: React.ReactNode }
> = {
  CREATE: {
    label: 'Create',
    color: 'bg-secondary-50 text-secondary',
    icon: <Plus className="h-3 w-3" />,
  },
  READ: { label: 'View', color: 'bg-blue-50 text-blue-600', icon: <Eye className="h-3 w-3" /> },
  UPDATE: {
    label: 'Update',
    color: 'bg-yellow-50 text-yellow-600',
    icon: <Pencil className="h-3 w-3" />,
  },
  DELETE: {
    label: 'Delete',
    color: 'bg-red-50 text-red-500',
    icon: <Trash2 className="h-3 w-3" />,
  },
  LOGIN: {
    label: 'Login',
    color: 'bg-primary-50 text-primary',
    icon: <User className="h-3 w-3" />,
  },
  LOGOUT: {
    label: 'Logout',
    color: 'bg-slate-100 text-slate-500',
    icon: <User className="h-3 w-3" />,
  },
};

function AuditLogPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [localSearch, setLocalSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<IAuditLog | null>(null);
  const [filters, setFilters] = useState<{
    action?: IAuditLog['action'];
    module?: string;
    startDate?: string;
    endDate?: string;
  }>({});

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(localSearch);
      setPage(0);
    }, 400);
    return () => clearTimeout(handler);
  }, [localSearch]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.append('page', String(page + 1));
    params.append('limit', String(pageSize));
    if (filters.action) params.append('action', filters.action);
    if (filters.module) params.append('module', filters.module);
    if (filters.startDate) params.append('from', filters.startDate);
    if (filters.endDate) params.append('to', filters.endDate);
    if (searchQuery) params.append('search', searchQuery);
    return params.toString() ? `?${params.toString()}` : '';
  }, [filters, searchQuery, page, pageSize]);

  const {
    data: auditLogsRaw,
    error,
    isLoading,
    isValidating,
    mutate,
  } = useSwr(`audit-log${queryString}`);

  const logs = useMemo(() => auditLogsRaw?.data?.logs ?? [], [auditLogsRaw]);
  const pagination = useMemo(() => auditLogsRaw?.data?.pagination, [auditLogsRaw]);
  const modules = useMemo(
    () => Array.from(new Set<string>(logs.map((log: IAuditLog) => String(log.module)))).sort(),
    [logs],
  );

  const clearFilters = () => {
    setFilters({});
    setSearchQuery('');
    setLocalSearch('');
    setPage(0);
  };

  const handleExport = () => {
    if (!logs.length) {
      toast.info('Nothing to export');
      return;
    }
    const headers = [
      'Timestamp',
      'User',
      'Email',
      'Action',
      'Module',
      'Resource',
      'Description',
      'Risk',
      'IP Address',
      'User Agent',
    ];
    const escape = (v: unknown) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = logs.map((l: IAuditLog) =>
      [
        new Date(l.timestamp).toISOString(),
        l.userId?.name ?? '',
        l.userId?.email ?? '',
        l.action,
        l.module,
        l.resourceName ?? l.resourceId ?? '',
        l.description ?? '',
        l.risk ?? '',
        l.ipAddress,
        l.userAgent,
      ]
        .map(escape)
        .join(','),
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${logs.length} record${logs.length === 1 ? '' : 's'}`);
  };

  const columns: Column<IAuditLog>[] = [
    {
      field: 'timestamp',
      title: 'Timestamp',
      render: (log) => (
        <div>
          <p className="text-sm text-nowrap font-medium text-slate-800">
            {new Date(log.timestamp).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </p>
          <p className="text-xs text-slate-500">
            {new Date(log.timestamp).toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </p>
        </div>
      ),
    },
    {
      field: 'userId',
      title: 'User',
      render: (log) => (
        <div>
          <p className="text-sm font-medium text-slate-800">{log.userId.name}</p>
          <p className="text-xs text-slate-500">{log.userId.email}</p>
        </div>
      ),
    },
    {
      field: 'action',
      title: 'Action',
      render: (log) => {
        const config = ACTION_CONFIG[log.action];
        return (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.color}`}
          >
            {config.icon}
            {config.label}
          </span>
        );
      },
    },
    {
      field: 'module',
      title: 'Module',
      render: (log) => (
        <span className="inline-block rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium capitalize text-primary">
          {log.module.replace(/-/g, ' ')}
        </span>
      ),
    },
    {
      field: 'resourceName',
      title: 'Resource',
      render: (log) => (
        <span className="text-sm text-slate-600">{log.resourceName ?? log.resourceId ?? '—'}</span>
      ),
    },
    {
      field: 'risk',
      title: 'Risk',
      render: (log) => (
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${
            log.risk === 'high'
              ? 'bg-red-50 text-red-700'
              : log.risk === 'medium'
                ? 'bg-amber-50 text-amber-700'
                : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          {log.risk ?? 'low'}
        </span>
      ),
    },
  ];
  const actions: Action<IAuditLog>[] = [
    {
      tooltip: 'Review activity',
      icon: <ChevronRight className="h-4 w-4" />,
      onClick: setSelected,
    },
  ];

  const stats = [
    {
      label: 'Total Activities',
      value: pagination?.total ?? logs.length,
      icon: <Activity className="h-4.5 w-4.5" />,
      color: 'bg-primary-50 text-primary',
    },
    {
      label: 'Creates',
      value: logs.filter((l: IAuditLog) => l.action === 'CREATE').length,
      icon: <Plus className="h-4.5 w-4.5" />,
      color: 'bg-secondary-50 text-secondary',
    },
    {
      label: 'Updates',
      value: logs.filter((l: IAuditLog) => l.action === 'UPDATE').length,
      icon: <Pencil className="h-4.5 w-4.5" />,
      color: 'bg-yellow-50 text-yellow-600',
    },
    {
      label: 'High-risk events',
      value: logs.filter((l: IAuditLog) => l.risk === 'high').length,
      icon: <AlertTriangle className="h-4.5 w-4.5" />,
      color: 'bg-red-50 text-red-500',
    },
  ];

  return (
    <div className="space-y-5">
      {error && (
        <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
          Audit records could not be loaded. No activity totals are inferred from missing data.
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-2xl bg-white p-4"
          >
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${stat.color}`}>
              {stat.icon}
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900">{stat.value}</p>
            <p className="mt-0.5 text-xs text-slate-500">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-3">
        {[
          {
            icon: ShieldCheck,
            title: 'Tamper-resistant history',
            copy: 'Every event is append-only and protected by an integrity hash.',
          },
          {
            icon: FileClock,
            title: 'Trace business changes',
            copy: 'Review the request, resulting record and supplied decision reason.',
          },
          {
            icon: LockKeyhole,
            title: 'Role-safe security context',
            copy: 'Device and network details appear only to authorized administrators.',
          },
        ].map((item) => (
          <div key={item.title} className="flex gap-3">
            <span className="h-fit rounded-xl bg-primary-50 p-2 text-primary">
              <item.icon className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-bold text-slate-900">{item.title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{item.copy}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Search & Filters */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-2xl bg-white p-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
            <input
              type="text"
              placeholder="Search by user, module, action..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-50"
            />
          </div>

          <CustomButton
            variant="secondary"
            startIcon={<Filter className="h-4 w-4" />}
            onClick={() => setShowFilters(!showFilters)}
            className="w-fit!"
          >
            Filters {Object.keys(filters).length > 0 && `(${Object.keys(filters).length})`}
          </CustomButton>

          {Object.keys(filters).length > 0 && (
            <CustomButton
              variant="tertiary"
              startIcon={<X className="h-4 w-4" />}
              onClick={clearFilters}
              className="w-fit!"
            >
              Clear
            </CustomButton>
          )}
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-3 overflow-hidden border-t border-slate-200 pt-3"
            >
              <div className="grid gap-3 sm:grid-cols-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">Action</label>
                  <select
                    value={filters.action ?? ''}
                    onChange={(e) => {
                      setFilters((prev) => ({
                        ...prev,
                        action: e.target.value as IAuditLog['action'],
                      }));
                      setPage(0);
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-50"
                  >
                    <option value="">All Actions</option>
                    {Object.entries(ACTION_CONFIG).map(([value, config]) => (
                      <option key={value} value={value}>
                        {config.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">Module</label>
                  <select
                    value={filters.module ?? ''}
                    onChange={(e) => {
                      setFilters((prev) => ({ ...prev, module: e.target.value || undefined }));
                      setPage(0);
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-50"
                  >
                    <option value="">All modules</option>
                    {modules.map((module) => (
                      <option key={module} value={module}>
                        {humanize(module)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={filters.startDate ?? ''}
                    onChange={(e) => {
                      setFilters((prev) => ({ ...prev, startDate: e.target.value }));
                      setPage(0);
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-50"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={filters.endDate ?? ''}
                    onChange={(e) => {
                      setFilters((prev) => ({ ...prev, endDate: e.target.value }));
                      setPage(0);
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-50"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {!isLoading && logs.length === 0 ? (
          <div className="rounded-2xl bg-white">
            <Empty
              title="No matching audit activity"
              subTitle="Try a broader date range, another module, or clear the active filters."
              pathName={searchQuery || Object.keys(filters).length ? 'Clear filters' : undefined}
              onClick={searchQuery || Object.keys(filters).length ? clearFilters : undefined}
            />
          </div>
        ) : (
          <CustomTable
            title="Audit Log"
            description="Investigate who changed what, when it happened, and why."
            onRefresh={() => mutate()}
            isRefreshing={isValidating}
            data={logs}
            columns={columns}
            actions={actions}
            isLoading={isLoading}
            page={page}
            pageSize={pageSize}
            totalCount={pagination?.total ?? logs.length}
            onPageChange={setPage}
            onRowsPerPageChange={setPageSize}
            customActions={
              <CustomButton
                variant="secondary"
                startIcon={<Download className="h-4 w-4" />}
                onClick={handleExport}
                disabled={logs.length === 0}
                className="w-fit!"
              >
                Export CSV
              </CustomButton>
            }
            options={{ search: false, pagination: true, pageSize: pageSize, export: false }}
          />
        )}
      </motion.div>
      <AnimatePresence>
        {selected && <AuditDetail log={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </div>
  );
}

function AuditDetail({ log, onClose }: { log: IAuditLog; onClose: () => void }) {
  const requested = (log.changes?.requestedChanges ?? {}) as Record<string, unknown>;
  const after = (log.changes?.after ?? {}) as Record<string, unknown>;
  const keys = Array.from(new Set([...Object.keys(requested), ...Object.keys(after)])).filter(
    (key) => !/^(_id|__v|createdAt|updatedAt)$/i.test(key),
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex justify-end bg-slate-200/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.aside
        initial={{ x: 40 }}
        animate={{ x: 0 }}
        exit={{ x: 40 }}
        onClick={(event) => event.stopPropagation()}
        className="h-full w-full max-w-2xl overflow-y-auto bg-slate-50 p-5 "
        aria-label="Audit activity details"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
              Activity review
            </p>
            <h2 className="mt-2 text-xl font-black text-slate-950">{humanize(log.rawAction)}</h2>
            <p className="mt-1 text-sm text-slate-500">{log.description}</p>
          </div>
          <button onClick={onClose} className="rounded-full bg-white p-2" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Info
            label="Performed by"
            value={`${log.userId?.name ?? 'System'}${log.userRole ? ` · ${humanize(log.userRole)}` : ''}`}
          />
          <Info label="When" value={new Date(log.timestamp).toLocaleString('en-IN')} />
          <Info label="Module" value={humanize(log.module)} />
          <Info label="Risk level" value={humanize(log.risk)} />
          {log.reason && <Info label="Decision reason" value={log.reason} wide />}
        </div>

        <section className="mt-5 rounded-2xl bg-white p-4">
          <h3 className="text-sm font-black text-slate-900">What changed</h3>
          <p className="mt-1 text-xs text-slate-500">
            Requested values are compared with the resulting saved record.
          </p>
          {keys.length ? (
            <div className="mt-4 space-y-2">
              {keys.map((key) => (
                <div
                  key={key}
                  className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[140px_1fr_1fr]"
                >
                  <p className="text-xs font-bold text-slate-700">{humanize(key)}</p>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-600">Requested</p>
                    <pre className="mt-1 whitespace-pre-wrap break-all font-sans text-xs text-slate-600">
                      {safeValue(requested[key])}
                    </pre>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-600">Saved result</p>
                    <pre className="mt-1 whitespace-pre-wrap break-all font-sans text-xs text-slate-700">
                      {safeValue(after[key])}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
              This event recorded activity context but no field-level comparison.
            </p>
          )}
        </section>

        <section className="mt-5 rounded-2xl bg-white p-4">
          <h3 className="flex items-center gap-2 text-sm font-black text-slate-900">
            <Clock3 className="h-4 w-4 text-primary" /> Security and integrity
          </h3>
          {log.securityContextRestricted ? (
            <p className="mt-3 text-sm text-slate-500">
              Network and device details are restricted to authorized security administrators.
            </p>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Info label="IP address" value={log.ipAddress ?? 'Not recorded'} />
              <Info label="Device" value={log.userAgent ?? 'Not recorded'} />
            </div>
          )}
          <p className="mt-3 break-all text-xs text-slate-600">
            Integrity reference: {log.eventHash ? `${log.eventHash.slice(0, 16)}…` : 'Unavailable'}
          </p>
        </section>
      </motion.aside>
    </motion.div>
  );
}

function Info({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`rounded-xl bg-white p-3 ${wide ? 'sm:col-span-2' : ''}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-700">{value}</p>
    </div>
  );
}

export default AuditLogPage;
