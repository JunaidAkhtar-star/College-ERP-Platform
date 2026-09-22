/**
 * @file AdministrationOfficeDashboard.tsx
 * @description Administration Officer dashboard matching the supplied reference.
 * @module features/dashboard/role-dashboards
 */
'use client';

import React from 'react';
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
import { Boxes, GraduationCap, Landmark, Users, Wallet } from 'lucide-react';
import type { AnyRecord } from '../views/shared';
import {
  ReferenceEmpty,
  ReferenceHeading,
  ReferencePanel,
  ReferenceStat,
  referenceCurrency,
  referenceNumber,
} from './reference-ui';

interface IStudents {
  total?: number;
  verified?: number;
  unverified?: number;
}
interface IAdmissions {
  total?: number;
  pending?: number;
  verified?: number;
  rejected?: number;
}
interface IHr {
  total?: number;
  active?: number;
  pendingLeaves?: number;
}
interface IAccounts {
  collected?: number;
  outstanding?: number;
}
interface IStore {
  items?: number;
  available?: number;
  lowStock?: number;
  pendingRequests?: number;
}
interface ITrend {
  label?: string;
  applications?: number;
  approved?: number;
  feeCollected?: number;
}
interface IAoo {
  _id?: string;
  name?: string;
  verifiedStudents?: number;
  verifiedAdmissions?: number;
  totalVerifications?: number;
}

const tooltipStyle = { border: '1px solid #e7e9f3', borderRadius: 8, fontSize: 10 };

/** Renders live institution administration oversight. */
export default function AdministrationOfficeDashboard({ d }: { d: AnyRecord }) {
  const students = (d.students as IStudents | undefined) ?? {};
  const admissions = (d.admissions as IAdmissions | undefined) ?? {};
  const hr = (d.hr as IHr | undefined) ?? {};
  const accounts = (d.accounts as IAccounts | undefined) ?? {};
  const store = (d.store as IStore | undefined) ?? {};
  const trends = (d.monthlyTrends as ITrend[] | undefined) ?? [];
  const activity = (d.aooActivity as IAoo[] | undefined) ?? [];
  return (
    <div className="space-y-3">
      <ReferenceHeading
        title="Administration Officer (AO) Dashboard"
        subtitle="Institution administration, staffing, finance and asset overview."
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
        <ReferenceStat
          label="Total Students"
          value={referenceNumber(students.total)}
          detail={`${referenceNumber(students.verified)} verified`}
          icon={<GraduationCap className="h-6 w-6" />}
          tone="violet"
        />
        <ReferenceStat
          label="Total Staff"
          value={referenceNumber(hr.total)}
          detail={`${referenceNumber(hr.active)} active`}
          icon={<Users className="h-6 w-6" />}
          tone="blue"
        />
        <ReferenceStat
          label="Active Employees"
          value={referenceNumber(hr.active)}
          detail={`${referenceNumber(hr.pendingLeaves)} pending leaves`}
          icon={<Users className="h-6 w-6" />}
          tone="amber"
        />
        <ReferenceStat
          label="Total Fee Collection"
          value={referenceCurrency(accounts.collected)}
          detail="Collected fees"
          icon={<Landmark className="h-6 w-6" />}
          tone="amber"
        />
        <ReferenceStat
          label="Pending Payments"
          value={referenceCurrency(accounts.outstanding)}
          detail="Outstanding balance"
          icon={<Wallet className="h-6 w-6" />}
          tone="rose"
        />
        <ReferenceStat
          label="Total Assets"
          value={referenceNumber(store.items)}
          detail={`${referenceNumber(store.lowStock)} low stock`}
          icon={<Boxes className="h-6 w-6" />}
          tone="violet"
        />
      </div>
      <div className="grid gap-3 xl:grid-cols-12">
        <ReferencePanel title="Administrative Overview" className="xl:col-span-5">
          <div className="grid grid-cols-[1fr_150px] gap-3">
            <div className="h-[245px]">
              {trends.length ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <AreaChart data={trends} margin={{ left: -28, right: 6 }}>
                    <CartesianGrid vertical={false} stroke="#edf0f6" />
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 9 }}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area
                      type="monotone"
                      dataKey="applications"
                      stroke="#6a48e7"
                      fill="#6a48e71a"
                    />
                    <Area type="monotone" dataKey="approved" stroke="#10a873" fill="#10a87312" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <ReferenceEmpty label="No application trend." />
              )}
            </div>
            <div className="space-y-2">
              {[
                ['Total Applications', admissions.total],
                ['Approved', admissions.verified],
                [
                  'Completed Verifications',
                  activity.reduce((sum, item) => sum + Number(item.totalVerifications ?? 0), 0),
                ],
                ['Pending', admissions.pending],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg bg-[#f8f9fd] p-3">
                  <p className="text-[9px] text-[#69708f]">{String(label)}</p>
                  <strong className="mt-1 block text-lg">{referenceNumber(value)}</strong>
                </div>
              ))}
            </div>
          </div>
        </ReferencePanel>
        <ReferencePanel title="Officer Verification Activity" className="xl:col-span-4">
          <div className="h-[245px]">
            {activity.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={activity} margin={{ left: -28, right: 5 }}>
                  <CartesianGrid vertical={false} stroke="#edf0f6" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 8 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="totalVerifications" fill="#407ae8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ReferenceEmpty label="No officer activity." />
            )}
          </div>
        </ReferencePanel>
        <ReferencePanel title="Quick Actions" className="xl:col-span-3">
          <div className="grid grid-cols-2 gap-2">
            {[
              'Add Staff',
              'Add Student',
              'Create Circular',
              'Approve Leave',
              'Allocate Asset',
              'Generate Report',
            ].map((label) => (
              <button
                key={label}
                type="button"
                className="min-h-20 rounded-lg bg-violet-50 px-2 text-[9px] font-semibold text-violet-700"
              >
                <Users className="mx-auto mb-2 h-5 w-5" />
                {label}
              </button>
            ))}
          </div>
        </ReferencePanel>
      </div>
      <div className="grid gap-3 xl:grid-cols-12">
        <ReferencePanel title="Inventory & Assets Overview" className="xl:col-span-6">
          <div className="grid grid-cols-4 gap-2">
            {[
              ['Total Items', store.items],
              ['Available Items', store.available],
              ['Low Stock Items', store.lowStock],
              ['Pending Requests', store.pendingRequests],
            ].map(([label, value], index) => (
              <div
                key={String(label)}
                className={`rounded-lg p-4 ${index === 2 ? 'bg-amber-50' : index === 3 ? 'bg-rose-50' : 'bg-[#f8f9fd]'}`}
              >
                <p className="text-[9px] text-[#69708f]">{String(label)}</p>
                <strong className="mt-2 block text-lg">{referenceNumber(value)}</strong>
              </div>
            ))}
          </div>
        </ReferencePanel>
        <ReferencePanel
          title="Recent Officer Activity"
          actionLabel="View All"
          className="xl:col-span-6"
        >
          <div className="space-y-1.5">
            {activity.length ? (
              activity.slice(0, 6).map((item, index) => (
                <div
                  key={item._id ?? index}
                  className="grid grid-cols-[1fr_auto_auto] border-b border-[#edf0f6] py-2 text-[10px] last:border-0"
                >
                  <strong>{item.name}</strong>
                  <span>{referenceNumber(item.verifiedStudents)} students</span>
                  <span>{referenceNumber(item.verifiedAdmissions)} admissions</span>
                </div>
              ))
            ) : (
              <ReferenceEmpty label="No recent officer activity." />
            )}
          </div>
        </ReferencePanel>
      </div>
    </div>
  );
}
