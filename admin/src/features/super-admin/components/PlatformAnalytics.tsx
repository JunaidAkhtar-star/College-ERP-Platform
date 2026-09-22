/**
 * @file PlatformAnalytics.tsx
 * @description Responsive charts derived exclusively from tenant and CRM API records.
 * @module features/super-admin/components
 */

'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { IMonthlyPlatformMetric, ITenant } from '../types/super-admin.types';

interface IPlatformAnalyticsProps {
  timeline: IMonthlyPlatformMetric[];
  tenants: ITenant[];
}

export default function PlatformAnalytics({ timeline, tenants }: IPlatformAnalyticsProps) {
  const capacity = tenants.slice(0, 8).map((tenant) => ({
    name: tenant.tenantId,
    students: tenant.maxStudents ?? 0,
    employees: tenant.maxEmployees ?? 0,
  }));

  return (
    <div className="grid gap-5 xl:grid-cols-5">
      <section className="admin-surface p-5 sm:p-6 xl:col-span-3">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-slate-800">Platform growth</h2>
          <p className="mt-1 text-sm text-slate-500">
            Tenant onboarding and CRM activity over the last six months.
          </p>
        </div>
        <div className="h-72 min-h-72 min-w-0" aria-label="Platform growth chart">
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            minHeight={288}
            initialDimension={{ width: 640, height: 288 }}
          >
            <AreaChart data={timeline} margin={{ left: -22, right: 8 }}>
              <defs>
                <linearGradient id="tenantGrowth" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#0178d7" stopOpacity={0.24} />
                  <stop offset="100%" stopColor="#0178d7" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="4 4" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} fontSize={11} />
              <YAxis allowDecimals={false} axisLine={false} tickLine={false} fontSize={11} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="leads"
                stroke="#9bb94f"
                strokeWidth={2}
                fill="transparent"
              />
              <Area
                type="monotone"
                dataKey="tenants"
                stroke="#0178d7"
                strokeWidth={3}
                fill="url(#tenantGrowth)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="admin-surface p-5 sm:p-6 xl:col-span-2">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-slate-800">Licensed capacity</h2>
          <p className="mt-1 text-sm text-slate-500">Current limits for recently added tenants.</p>
        </div>
        <div className="h-72 min-h-72 min-w-0" aria-label="Tenant capacity chart">
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            minHeight={288}
            initialDimension={{ width: 480, height: 288 }}
          >
            <BarChart data={capacity} margin={{ left: -18, right: 8 }}>
              <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="4 4" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={10} />
              <YAxis axisLine={false} tickLine={false} fontSize={10} />
              <Tooltip />
              <Bar dataKey="students" fill="#0178d7" radius={[6, 6, 0, 0]} />
              <Bar dataKey="employees" fill="#9bb94f" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
