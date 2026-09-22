/**
 * @file LeadsTab.tsx
 * @description CRM Lead tracking display grid showing prospective institutions requests.
 * @module features/super-admin/components
 */

'use client';

import React, { useState } from 'react';
import { motion } from '@/shared/utils/motion';
import { Table, LayoutGrid } from 'lucide-react';
import CustomTable, { Column } from '@/shared/core/CustomTable';
import { ILead } from '../types/super-admin.types';
import CustomButton from '@/shared/core/CustomButton';

interface ILeadsTabProps {
  leads: ILead[];
  searchQuery: string;
  isLoading: boolean;
  onProcess: (lead: ILead) => void;
  onRefresh?: () => void;
  isValidating?: boolean;
}

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
} as const;

export default function LeadsTab({
  leads,
  searchQuery,
  isLoading,
  onProcess,
  onRefresh,
  isValidating,
}: ILeadsTabProps) {
  const [view, setView] = useState<'table' | 'grid'>('table');
  const filtered = leads.filter(
    (l) =>
      l.collegeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.email.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const columns: Column<ILead>[] = [
    { field: 'name', title: 'Contact Person', sortable: true },
    { field: 'collegeName', title: 'College', sortable: true },
    { field: 'designation', title: 'Designation' },
    { field: 'email', title: 'Email' },
    { field: 'phone', title: 'Phone' },
    { field: 'studentCount', title: 'Students', sortable: true },
    {
      field: 'status',
      title: 'Status',
      render: (row) => (
        <span
          className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
            row.status === 'pending'
              ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
              : row.status === 'contacted'
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : row.status === 'converted'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
          }`}
        >
          {row.status}
        </span>
      ),
    },
  ];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <div className="w-full flex items-center justify-between">
        <div className="w-full">
          <h2 className="text-2xl font-bold text-slate-800">Commercial pipeline</h2>
          <p className="mt-1 text-sm text-slate-500">
            Move qualified institutions from first contact to a deployment-ready tenant with clear
            ownership.
          </p>
        </div>

        <div className="flex w-fit justify-end">
          <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100/80 p-1 border border-slate-200/60 shadow-xs">
            <div className="relative group flex items-center justify-center">
              <button
                type="button"
                onClick={() => setView('table')}
                aria-label="Table view"
                className={`relative cursor-pointer inline-flex items-center justify-center rounded-lg p-2 text-xs font-medium transition-colors duration-200 ${
                  view === 'table'
                    ? 'text-primary-600 font-semibold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {view === 'table' && (
                  <motion.div
                    layoutId="leadsViewActivePill"
                    className="absolute inset-0 rounded-lg bg-white shadow-xs border border-slate-200/50"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <Table className="relative z-10 h-4 w-4" />
              </button>
              <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 z-30 shadow-md">
                Table view
              </span>
            </div>

            <div className="relative group flex items-center justify-center">
              <button
                type="button"
                onClick={() => setView('grid')}
                aria-label="Grid view"
                className={`relative cursor-pointer inline-flex items-center justify-center rounded-lg p-2 text-xs font-medium transition-colors duration-200 ${
                  view === 'grid'
                    ? 'text-primary-600 font-semibold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {view === 'grid' && (
                  <motion.div
                    layoutId="leadsViewActivePill"
                    className="absolute inset-0 rounded-lg bg-white shadow-xs border border-slate-200/50"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <LayoutGrid className="relative z-10 h-4 w-4" />
              </button>
              <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 z-30 shadow-md">
                Grid view
              </span>
            </div>
          </div>
        </div>
      </div>
      {view === 'table' ? (
        <CustomTable
          data={filtered as unknown as Record<string, unknown>[]}
          columns={columns as unknown as Column<Record<string, unknown>>[]}
          isLoading={isLoading}
          onRefresh={onRefresh}
          isValidating={isValidating}
          title="Institution inquiries"
          description="Track and qualify incoming demo requests from the public site."
          actions={[
            {
              icon: (
                <span className="text-xs text-blue-600 font-semibold hover:underline cursor-pointer">
                  Process
                </span>
              ),
              tooltip: 'Update Status',
              onClick: (row) => onProcess(row as unknown as ILead),
            },
          ]}
          options={{ pagination: true, search: false, sorting: true }}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((lead) => (
            <article key={lead._id} className="admin-surface p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900">{lead.collegeName}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {lead.name} · {lead.designation}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-600">
                  {lead.status}
                </span>
              </div>
              <div className="mt-5 space-y-2 text-sm text-slate-600">
                <p>{lead.email}</p>
                <p>{lead.phone}</p>
                <p>{lead.studentCount.toLocaleString('en-IN')} students</p>
              </div>
              <div className="mt-5">
                <CustomButton variant="primary" size="small" onClick={() => onProcess(lead)}>
                  Process lead
                </CustomButton>
              </div>
            </article>
          ))}
        </div>
      )}
    </motion.div>
  );
}
