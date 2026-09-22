/**
 * @file HostelWardenDashboard.tsx
 * @description Standalone hostel occupancy and resident-operations dashboard.
 * @module features/dashboard/role-dashboards
 */
'use client';

import {
  AlertTriangle,
  BedDouble,
  Building2,
  DoorOpen,
  IndianRupee,
  LogIn,
  LogOut,
  Users,
  Utensils,
} from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import {
  type AnyRecord,
  Badge,
  fmt,
  fmtDate,
  fmtRupees,
  type IStatCard,
  RowItem,
  Section,
  StatCard,
  useRolePath,
} from '../views/shared';

interface IRoomTypeStat {
  name: string;
  rooms: number;
  capacity: number;
  occupied: number;
  vacant: number;
}
interface IHostelStat {
  name: string;
  rooms: number;
  capacity: number;
  occupied: number;
  vacant: number;
}
interface IComplaint {
  _id?: string;
  studentId?: { name?: string };
  hostelName: string;
  roomNo: string;
  category: string;
  description: string;
  status: string;
  createdAt?: string;
}
interface IVisitor {
  _id?: string;
  studentName: string;
  roomNo: string;
  visitorName: string;
  relation: string;
  checkIn: string;
}
interface IAllocation {
  _id?: string;
  studentId?: { name?: string; email?: string };
  roomId?: { hostelName?: string; blockName?: string; roomNumber?: string; roomType?: string };
  allocationDate: string;
}
interface IFeeSummary {
  totalDue?: number;
  paidAmount?: number;
  messCharges?: number;
  otherCharges?: number;
  studentsPaid?: number;
  records?: number;
}

/** Maps hostel complaint states to shared badge colors. */
function complaintTone(status: string): 'green' | 'blue' | 'amber' | 'red' | 'slate' {
  if (['resolved', 'closed'].includes(status)) return 'green';
  if (status === 'in_progress') return 'amber';
  if (status === 'open') return 'red';
  return 'slate';
}

export default function HostelWardenDashboard({ d }: { d: AnyRecord }) {
  const path = useRolePath();
  const roomTypes = (d.roomTypeStats as IRoomTypeStat[] | undefined) ?? [];
  const hostels = (d.hostelStats as IHostelStat[] | undefined) ?? [];
  const complaints = (d.recentComplaints as IComplaint[] | undefined) ?? [];
  const visitors = (d.currentVisitors as IVisitor[] | undefined) ?? [];
  const allocations = (d.recentAllocations as IAllocation[] | undefined) ?? [];
  const fees = (d.feeSummary as IFeeSummary | undefined) ?? {};
  const occupied = Number(d.occupiedBeds ?? 0);
  const available = Number(d.availableBeds ?? 0);
  const totalCapacity = Number(d.totalCapacity ?? 0);
  const collectionRate = Number(fees.totalDue)
    ? (Number(fees.paidAmount) / Number(fees.totalDue)) * 100
    : 0;

  const cards: IStatCard[] = [
    {
      label: 'Total Residents',
      value: fmt(d.activeResidents),
      icon: <Users className="h-5 w-5" />,
      bg: 'bg-violet-50',
      fg: 'text-violet-600',
      href: path('hostel'),
    },
    {
      label: 'Rooms Occupied',
      value: `${fmt(occupied)} / ${fmt(totalCapacity)}`,
      icon: <BedDouble className="h-5 w-5" />,
      bg: 'bg-emerald-50',
      fg: 'text-emerald-600',
      href: path('hostel'),
    },
    {
      label: 'Students Checked In',
      value: fmt(d.activeResidents),
      icon: <DoorOpen className="h-5 w-5" />,
      bg: 'bg-blue-50',
      fg: 'text-blue-600',
      href: path('hostel'),
    },
    {
      label: 'New Check-ins Today',
      value: fmt(d.newCheckIns),
      icon: <LogIn className="h-5 w-5" />,
      bg: 'bg-orange-50',
      fg: 'text-orange-600',
      href: path('hostel'),
    },
    {
      label: 'Open Complaints',
      value: fmt(d.openComplaints),
      icon: <AlertTriangle className="h-5 w-5" />,
      bg: 'bg-rose-50',
      fg: 'text-rose-600',
      href: path('hostel'),
    },
    {
      label: 'Outstanding Hostel Fees',
      value: fmtRupees(d.outstandingFeeAmount),
      icon: <IndianRupee className="h-5 w-5" />,
      bg: 'bg-sky-50',
      fg: 'text-sky-600',
      href: path('hostel'),
    },
  ];

  const occupancyData = [
    { name: 'Occupied', value: occupied },
    { name: 'Vacant', value: available },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {cards.map((card, index) => (
          <StatCard key={card.label} {...card} index={index} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Section title="Hostel Occupancy Overview" href={path('hostel')}>
          <div className="relative h-64">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <PieChart>
                <Pie
                  data={occupancyData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={62}
                  outerRadius={88}
                  paddingAngle={2}
                >
                  <Cell fill="#4F5EF7" />
                  <Cell fill="#20B486" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <strong className="text-xl text-slate-900">
                {fmt(occupied)} / {fmt(totalCapacity)}
              </strong>
              <span className="text-[10px] text-slate-500">Beds Occupied</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-violet-50 p-3">
              <span className="text-slate-500">Occupied</span>
              <strong className="mt-1 block text-violet-700">{fmt(occupied)}</strong>
            </div>
            <div className="rounded-lg bg-emerald-50 p-3">
              <span className="text-slate-500">Vacant</span>
              <strong className="mt-1 block text-emerald-700">{fmt(available)}</strong>
            </div>
          </div>
        </Section>

        <Section title="Room Type-wise Occupancy" className="xl:col-span-2" href={path('hostel')}>
          <div className="min-w-[620px] overflow-x-auto text-xs">
            <div className="grid grid-cols-5 bg-slate-50 px-3 py-2.5 font-medium text-slate-500">
              <span>Room Type</span>
              <span>Total Rooms</span>
              <span>Capacity</span>
              <span>Occupied</span>
              <span>Occupancy</span>
            </div>
            {roomTypes.map((room) => {
              const rate = room.capacity ? (room.occupied / room.capacity) * 100 : 0;
              return (
                <div
                  key={room.name}
                  className="grid grid-cols-5 items-center border-b border-slate-100 px-3 py-3 last:border-0"
                >
                  <strong className="capitalize text-slate-800">{room.name}</strong>
                  <span>{fmt(room.rooms)}</span>
                  <span>{fmt(room.capacity)}</span>
                  <span>{fmt(room.occupied)}</span>
                  <Badge
                    label={`${rate.toFixed(1)}%`}
                    color={rate >= 80 ? 'green' : rate >= 60 ? 'blue' : 'amber'}
                  />
                </div>
              );
            })}
          </div>
          {!roomTypes.length && (
            <p className="py-12 text-center text-xs text-slate-600">No active room records.</p>
          )}
        </Section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Section title="Today's Summary">
          <div className="space-y-2">
            {[
              {
                label: 'Active residents',
                value: d.activeResidents,
                icon: Users,
                tone: 'text-emerald-600',
              },
              {
                label: 'Visitors today',
                value: d.visitorsToday,
                icon: Users,
                tone: 'text-blue-600',
              },
              {
                label: 'New check-ins',
                value: d.newCheckIns,
                icon: LogIn,
                tone: 'text-violet-600',
              },
              { label: 'Check-outs', value: d.checkOuts, icon: LogOut, tone: 'text-orange-600' },
            ].map(({ label, value, icon: Icon, tone }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5"
              >
                <Icon className={`h-4 w-4 ${tone}`} />
                <span className="flex-1 text-xs text-slate-600">{label}</span>
                <strong className="text-sm text-slate-900">{fmt(value)}</strong>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Recent Complaints / Issues" href={path('hostel')}>
          <div className="space-y-2">
            {complaints.length ? (
              complaints.map((complaint) => (
                <RowItem
                  key={complaint._id ?? `${complaint.roomNo}-${complaint.createdAt}`}
                  icon={<AlertTriangle className="h-4 w-4" />}
                  primary={complaint.description}
                  secondary={`${complaint.studentId?.name ?? 'Resident'} · ${complaint.hostelName} room ${complaint.roomNo}`}
                  end={
                    <Badge
                      label={complaint.status.replaceAll('_', ' ')}
                      color={complaintTone(complaint.status)}
                    />
                  }
                  href={path('hostel')}
                />
              ))
            ) : (
              <p className="py-10 text-center text-xs text-slate-600">
                No open resident complaints.
              </p>
            )}
          </div>
        </Section>

        <Section title="Hostel Fee Overview" href={path('hostel')}>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-emerald-50 p-4">
              <IndianRupee className="h-5 w-5 text-emerald-600" />
              <p className="mt-3 text-[10px] text-slate-500">Collected</p>
              <strong className="mt-1 block text-slate-900">{fmtRupees(fees.paidAmount)}</strong>
            </div>
            <div className="rounded-xl bg-violet-50 p-4">
              <Utensils className="h-5 w-5 text-violet-600" />
              <p className="mt-3 text-[10px] text-slate-500">Mess Charges</p>
              <strong className="mt-1 block text-slate-900">{fmtRupees(fees.messCharges)}</strong>
            </div>
            <div className="col-span-2 rounded-xl bg-slate-50 p-4">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Collection rate</span>
                <strong>{collectionRate.toFixed(1)}%</strong>
              </div>
              <div className="mt-3 flex justify-between text-xs">
                <span className="text-slate-500">Students paid</span>
                <strong>
                  {fmt(fees.studentsPaid)} / {fmt(fees.records)}
                </strong>
              </div>
            </div>
          </div>
        </Section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Section title="Recent Allocations" href={path('hostel')}>
          <div className="space-y-2">
            {allocations.length ? (
              allocations.map((allocation) => (
                <RowItem
                  key={allocation._id ?? allocation.allocationDate}
                  icon={<BedDouble className="h-4 w-4" />}
                  primary={
                    allocation.studentId?.name ?? allocation.studentId?.email ?? 'Unlinked resident'
                  }
                  secondary={`${allocation.roomId?.hostelName ?? 'Hostel'} · ${allocation.roomId?.blockName ?? 'Block'} · room ${allocation.roomId?.roomNumber ?? '—'} · ${fmtDate(allocation.allocationDate)}`}
                  href={path('hostel')}
                />
              ))
            ) : (
              <p className="py-10 text-center text-xs text-slate-600">No active allocations.</p>
            )}
          </div>
        </Section>
        <Section title="Current Visitors" href={path('hostel')}>
          <div className="space-y-2">
            {visitors.length ? (
              visitors.map((visitor) => (
                <RowItem
                  key={visitor._id ?? `${visitor.visitorName}-${visitor.checkIn}`}
                  icon={<Users className="h-4 w-4" />}
                  primary={`${visitor.visitorName} · ${visitor.relation}`}
                  secondary={`Visiting ${visitor.studentName}, room ${visitor.roomNo} · ${fmtDate(visitor.checkIn)}`}
                  href={path('hostel')}
                />
              ))
            ) : (
              <p className="py-10 text-center text-xs text-slate-600">
                No visitors currently inside.
              </p>
            )}
          </div>
        </Section>
        <Section title="Hostel-wise Capacity" href={path('hostel')}>
          <div className="space-y-2">
            {hostels.length ? (
              hostels.map((hostel) => (
                <div key={hostel.name} className="rounded-xl bg-slate-50 p-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    <strong className="flex-1 truncate text-xs text-slate-800">
                      {hostel.name}
                    </strong>
                    <span className="text-xs text-slate-500">
                      {fmt(hostel.occupied)}/{fmt(hostel.capacity)}
                    </span>
                  </div>
                  <p className="mt-2 text-[10px] text-slate-500">
                    {fmt(hostel.rooms)} rooms · {fmt(hostel.vacant)} vacant beds
                  </p>
                </div>
              ))
            ) : (
              <p className="py-10 text-center text-xs text-slate-600">
                No hostel capacity records.
              </p>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}
