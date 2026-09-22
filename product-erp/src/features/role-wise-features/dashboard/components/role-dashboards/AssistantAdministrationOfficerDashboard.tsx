/**
 * @file AssistantAdministrationOfficerDashboard.tsx
 * @description Assistant AO dashboard matching the lower supplied administration reference.
 * @module features/dashboard/role-dashboards
 */
'use client';

import React from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Bell, ClipboardList, Database, FileCheck, FileText, UserCheck } from 'lucide-react';
import type { AnyRecord, INotice } from '../views/shared';
import { fmtDate } from '../views/shared';
import {
  ReferenceEmpty,
  ReferenceHeading,
  ReferencePanel,
  ReferenceStat,
  referenceNumber,
} from './reference-ui';

interface IStats {
  verifiedStudents?: number;
  verifiedAdmissions?: number;
  totalVerified?: number;
}
interface IStudent {
  id?: string;
  rollNumber?: string;
  name?: string;
  program?: string;
  semester?: number | string;
}
interface IAdmission {
  _id?: string;
  applicantName?: string;
  applicationNumber?: string;
  program?: string;
  createdAt?: string;
}
interface IQueues {
  totalUnverifiedStudents?: number;
  totalPendingAdmissions?: number;
  pendingStudents?: IStudent[];
  pendingAdmissions?: IAdmission[];
}

const tooltipStyle = { border: '1px solid #e7e9f3', borderRadius: 8, fontSize: 10 };

/** Renders the authenticated assistant officer's personal verification queues. */
export default function AssistantAdministrationOfficerDashboard({ d }: { d: AnyRecord }) {
  const stats = (d.myStats as IStats | undefined) ?? {};
  const queues = (d.queues as IQueues | undefined) ?? {};
  const notices = (d.notices as INotice[] | undefined) ?? [];
  const pendingStudents = queues.pendingStudents ?? [];
  const pendingAdmissions = queues.pendingAdmissions ?? [];
  const totalTasks =
    Number(queues.totalUnverifiedStudents ?? 0) + Number(queues.totalPendingAdmissions ?? 0);
  const taskChart = [
    { name: 'Student Queue', value: Number(queues.totalUnverifiedStudents ?? 0), color: '#ffad25' },
    {
      name: 'Admission Queue',
      value: Number(queues.totalPendingAdmissions ?? 0),
      color: '#2f7af0',
    },
    { name: 'Completed', value: Number(stats.totalVerified ?? 0), color: '#10a873' },
  ].filter((item) => item.value > 0);
  return (
    <div className="space-y-3">
      <ReferenceHeading
        title="Assistant AO Dashboard"
        subtitle="Personal tasks, document verification and student-request processing."
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
        <ReferenceStat
          label="My Tasks"
          value={referenceNumber(totalTasks)}
          detail={`${referenceNumber(queues.totalPendingAdmissions)} pending`}
          icon={<ClipboardList className="h-6 w-6" />}
          tone="blue"
        />
        <ReferenceStat
          label="Documents Processed"
          value={referenceNumber(stats.verifiedStudents)}
          detail="Verified students"
          icon={<FileCheck className="h-6 w-6" />}
          tone="green"
        />
        <ReferenceStat
          label="Student Requests"
          value={referenceNumber(queues.totalUnverifiedStudents)}
          detail="Pending verification"
          icon={<UserCheck className="h-6 w-6" />}
          tone="amber"
        />
        <ReferenceStat
          label="Forms Issued"
          value={referenceNumber(stats.verifiedAdmissions)}
          detail="Approved admissions"
          icon={<FileText className="h-6 w-6" />}
          tone="violet"
        />
        <ReferenceStat
          label="Data Entries"
          value={referenceNumber(stats.totalVerified)}
          detail="Total verified"
          icon={<Database className="h-6 w-6" />}
          tone="cyan"
        />
        <ReferenceStat
          label="Recent Notices"
          value={referenceNumber(notices.length)}
          detail="Published updates"
          icon={<Bell className="h-6 w-6" />}
          tone="rose"
        />
      </div>
      <div className="grid gap-3 xl:grid-cols-12">
        <ReferencePanel
          title="My Task Overview"
          actionLabel="View All Tasks"
          className="xl:col-span-3"
        >
          <div className="relative h-[205px]">
            {taskChart.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie data={taskChart} dataKey="value" innerRadius={48} outerRadius={68}>
                    {taskChart.map((item) => (
                      <Cell key={item.name} fill={item.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <ReferenceEmpty label="No active tasks." />
            )}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <strong className="text-xl">{referenceNumber(totalTasks)}</strong>
              <span className="text-[9px]">Pending</span>
            </div>
          </div>
        </ReferencePanel>
        <ReferencePanel title="Queue Summary" className="xl:col-span-2">
          <div className="space-y-3">
            {[
              ['Pending Admissions', queues.totalPendingAdmissions, 'text-rose-600'],
              ['Unverified Students', queues.totalUnverifiedStudents, 'text-amber-600'],
              ['Completed', stats.totalVerified, 'text-emerald-600'],
            ].map(([label, value, tone]) => (
              <div
                key={String(label)}
                className="flex justify-between border-b border-[#edf0f6] py-2 text-[10px] last:border-0"
              >
                <span className={String(tone)}>{String(label)}</span>
                <strong>{referenceNumber(value)}</strong>
              </div>
            ))}
          </div>
        </ReferencePanel>
        <ReferencePanel
          title="Recent Student Requests"
          actionLabel="View All"
          className="xl:col-span-4"
        >
          <div className="space-y-1.5">
            {pendingStudents.length ? (
              pendingStudents.slice(0, 6).map((item, index) => (
                <div
                  key={item.id ?? index}
                  className="grid grid-cols-[1fr_auto] border-b border-[#edf0f6] py-2 last:border-0"
                >
                  <div>
                    <p className="text-[10px] font-semibold">Student verification · {item.name}</p>
                    <p className="text-[9px] text-[#858ba4]">
                      {item.rollNumber} · {item.program} · Sem {item.semester}
                    </p>
                  </div>
                  <span className="rounded-md bg-amber-50 px-2 py-1 text-[9px] text-amber-600">
                    Pending
                  </span>
                </div>
              ))
            ) : (
              <ReferenceEmpty label="No pending student requests." />
            )}
          </div>
        </ReferencePanel>
        <ReferencePanel title="Quick Actions" className="xl:col-span-3">
          <div className="grid grid-cols-2 gap-2">
            {[
              'New Verification',
              'Issue Certificate',
              'ID Card Request',
              'Receive Document',
              'Send Notification',
              'Student Search',
            ].map((label) => (
              <button
                key={label}
                type="button"
                className="min-h-16 rounded-lg bg-emerald-50 px-2 text-[9px] font-semibold text-emerald-700"
              >
                <FileCheck className="mx-auto mb-1.5 h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </ReferencePanel>
      </div>
      <div className="grid gap-3 xl:grid-cols-12">
        <ReferencePanel title="Pending Admissions" className="xl:col-span-4">
          <div className="space-y-1.5">
            {pendingAdmissions.length ? (
              pendingAdmissions.slice(0, 6).map((item, index) => (
                <div
                  key={item._id ?? index}
                  className="border-b border-[#edf0f6] py-2 last:border-0"
                >
                  <p className="text-[10px] font-semibold">{item.applicantName}</p>
                  <p className="text-[9px] text-[#858ba4]">
                    {item.applicationNumber} · {item.program} · {fmtDate(item.createdAt)}
                  </p>
                </div>
              ))
            ) : (
              <ReferenceEmpty label="No pending admissions." />
            )}
          </div>
        </ReferencePanel>
        <ReferencePanel title="Data Entry Summary" className="xl:col-span-3">
          <div className="space-y-2">
            {[
              ['Student Records', stats.verifiedStudents],
              ['Admission Records', stats.verifiedAdmissions],
              ['Pending Students', queues.totalUnverifiedStudents],
              ['Pending Admissions', queues.totalPendingAdmissions],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="flex justify-between rounded-lg bg-[#f8f9fd] p-3 text-[10px]"
              >
                <span>{String(label)}</span>
                <strong>{referenceNumber(value)}</strong>
              </div>
            ))}
          </div>
        </ReferencePanel>
        <ReferencePanel title="My Performance" className="xl:col-span-2">
          <div className="flex h-40 items-center justify-center rounded-full border-[12px] border-cyan-500 text-center">
            <div>
              <strong className="text-xl">{referenceNumber(stats.totalVerified)}</strong>
              <span className="block text-[9px]">Processed</span>
            </div>
          </div>
        </ReferencePanel>
        <ReferencePanel
          title="Important Notifications"
          actionLabel="View All"
          className="xl:col-span-3"
        >
          <div className="space-y-1.5">
            {notices.length ? (
              notices.slice(0, 5).map((notice) => (
                <div
                  key={notice._id}
                  className="flex gap-2 border-b border-[#edf0f6] py-2 last:border-0"
                >
                  <Bell className="h-4 w-4 text-blue-600" />
                  <div className="min-w-0">
                    <p className="truncate text-[10px] font-semibold">{notice.title}</p>
                    <p className="text-[9px] text-[#858ba4]">
                      {fmtDate(notice.publishedAt ?? notice.createdAt)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <ReferenceEmpty label="No notifications." />
            )}
          </div>
        </ReferencePanel>
      </div>
    </div>
  );
}
