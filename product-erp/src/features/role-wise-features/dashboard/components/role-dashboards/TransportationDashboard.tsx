/**
 * @file TransportationDashboard.tsx
 * @description Standalone live transportation operations dashboard.
 * @module features/dashboard/role-dashboards
 */
'use client';

import Image from 'next/image';
import {
  Bus,
  CalendarClock,
  CircleGauge,
  Clock3,
  MapPin,
  Route,
  ShieldAlert,
  UserRoundCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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

interface IRouteRow {
  _id?: string;
  routeNo: string;
  routeName: string;
  vehicleNo: string;
  vehicleType: string;
  driverName: string;
  capacity: number;
  occupiedCount: number;
  status: 'on_route' | 'in_depot';
  gps?: { lat: number; lng: number; speed?: number; lastSeen?: string } | null;
}

interface IAllocationRow {
  _id?: string;
  studentId?: { name?: string; email?: string };
  routeId?: { routeNo?: string; routeName?: string; vehicleNo?: string };
  stopName: string;
  createdAt: string;
}

interface IExpiringDriver {
  _id?: string;
  name: string;
  licenseNo: string;
  licenseExpiry: string;
}

interface ITransportFeeSummary {
  totalDue?: number;
  paidAmount?: number;
  outstandingAmount?: number;
  overdueRecords?: number;
}

/** Projects live GPS coordinates into the local SVG map viewport. */
function mapPoint(routes: IRouteRow[], route: IRouteRow) {
  const located = routes.filter((item) => item.gps);
  const latitudes = located.map((item) => item.gps?.lat ?? 0);
  const longitudes = located.map((item) => item.gps?.lng ?? 0);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const xRange = maxLng - minLng || 1;
  const yRange = maxLat - minLat || 1;
  return {
    x: 70 + (((route.gps?.lng ?? minLng) - minLng) / xRange) * 860,
    y: 430 - (((route.gps?.lat ?? minLat) - minLat) / yRange) * 360,
  };
}

export default function TransportationDashboard({ d }: { d: AnyRecord }) {
  const path = useRolePath();
  const buses = (d.activeBuses as IRouteRow[] | undefined) ?? [];
  const allocations = (d.recentAllocations as IAllocationRow[] | undefined) ?? [];
  const expiringDrivers = (d.expiringDrivers as IExpiringDriver[] | undefined) ?? [];
  const fees = (d.feeSummary as ITransportFeeSummary | undefined) ?? {};
  const capacity = (d.capacity as { capacity?: number; occupied?: number } | undefined) ?? {};
  const fleetUtilization = Number(capacity.capacity)
    ? (Number(capacity.occupied) / Number(capacity.capacity)) * 100
    : 0;

  const cards: IStatCard[] = [
    {
      label: 'Total Buses',
      value: fmt(d.totalBuses),
      icon: <Bus className="h-5 w-5" />,
      bg: 'bg-blue-50',
      fg: 'text-blue-600',
      href: path('transport'),
    },
    {
      label: 'On Routes',
      value: fmt(d.onRouteCount),
      icon: <MapPin className="h-5 w-5" />,
      bg: 'bg-emerald-50',
      fg: 'text-emerald-600',
      href: path('transport'),
    },
    {
      label: 'In Depot',
      value: fmt(d.inDepotCount),
      icon: <Bus className="h-5 w-5" />,
      bg: 'bg-orange-50',
      fg: 'text-orange-600',
      href: path('transport'),
    },
    {
      label: 'Active Drivers',
      value: fmt(d.totalDrivers),
      icon: <UserRoundCheck className="h-5 w-5" />,
      bg: 'bg-rose-50',
      fg: 'text-rose-600',
      href: path('transport'),
    },
    {
      label: 'Students Transported',
      value: fmt(d.allocatedStudents),
      icon: <Users className="h-5 w-5" />,
      bg: 'bg-violet-50',
      fg: 'text-violet-600',
      href: path('transport'),
    },
    {
      label: 'On-time Performance',
      value: `${Number(d.onTimePerformance ?? 0).toFixed(1)}%`,
      icon: <Clock3 className="h-5 w-5" />,
      bg: 'bg-sky-50',
      fg: 'text-sky-600',
      href: path('transport'),
    },
    {
      label: 'Total Routes',
      value: fmt(d.totalRoutes),
      icon: <Route className="h-5 w-5" />,
      bg: 'bg-purple-50',
      fg: 'text-purple-600',
      href: path('transport'),
    },
    {
      label: "Today's Trips",
      value: fmt(d.todaysTrips),
      icon: <CalendarClock className="h-5 w-5" />,
      bg: 'bg-pink-50',
      fg: 'text-pink-600',
      href: path('transport'),
    },
  ];

  const capacityRows = buses.map((bus) => ({
    route: bus.routeNo,
    occupied: bus.occupiedCount,
    available: Math.max(bus.capacity - bus.occupiedCount, 0),
  }));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
        {cards.map((card, index) => (
          <StatCard key={card.label} {...card} index={index} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <Section
          title="Live Bus Tracking"
          sub={`${fmt(d.onRouteCount)} routes broadcasting`}
          href={path('transport')}
        >
          <div className="relative min-h-80 overflow-hidden rounded-2xl bg-slate-50">
            <Image
              src="/dashboard/transport-route-map.svg"
              alt="Transportation route map"
              fill
              className="object-cover"
              sizes="(min-width: 1280px) 65vw, 100vw"
            />
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 1000 500"
              role="img"
              aria-label="Current vehicle locations"
            >
              {buses
                .filter((bus) => bus.gps)
                .map((bus) => {
                  const point = mapPoint(buses, bus);
                  return (
                    <g key={bus._id ?? bus.routeNo} transform={`translate(${point.x} ${point.y})`}>
                      <circle
                        r="22"
                        fill={bus.status === 'on_route' ? '#16A36A' : '#F59E0B'}
                        opacity=".2"
                      />
                      <circle
                        r="12"
                        fill={bus.status === 'on_route' ? '#16A36A' : '#F59E0B'}
                        stroke="white"
                        strokeWidth="5"
                      />
                      <text
                        y="-22"
                        textAnchor="middle"
                        fontSize="15"
                        fontWeight="700"
                        fill="#172554"
                      >
                        {bus.vehicleNo}
                      </text>
                    </g>
                  );
                })}
            </svg>
            {!buses.some((bus) => bus.gps) && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="rounded-xl bg-white/90 px-4 py-2 text-xs text-slate-500">
                  No vehicles are currently broadcasting GPS.
                </p>
              </div>
            )}
          </div>
        </Section>

        <Section
          title="Route Capacity"
          sub={`${fleetUtilization.toFixed(1)}% occupied`}
          href={path('transport')}
        >
          <div className="h-80">
            {capacityRows.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={capacityRows} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                  <XAxis
                    dataKey="route"
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="occupied" stackId="capacity" fill="#2563EB" radius={[0, 0, 4, 4]} />
                  <Bar
                    dataKey="available"
                    stackId="capacity"
                    fill="#DDE5F1"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-xs text-slate-600">
                No active route capacity records.
              </p>
            )}
          </div>
        </Section>
      </div>

      <Section title="Active Buses" href={path('transport')}>
        <div className="overflow-x-auto">
          <div className="min-w-[720px] text-xs">
            <div className="grid grid-cols-[1fr_2fr_1.3fr_1fr_1fr_1fr] bg-slate-50 px-3 py-2.5 font-medium text-slate-500">
              <span>Bus</span>
              <span>Route</span>
              <span>Driver</span>
              <span>Status</span>
              <span>Occupancy</span>
              <span>Speed</span>
            </div>
            {buses.slice(0, 8).map((bus) => (
              <div
                key={bus._id ?? bus.routeNo}
                className="grid grid-cols-[1fr_2fr_1.3fr_1fr_1fr_1fr] items-center border-b border-slate-100 px-3 py-2.5 last:border-0"
              >
                <strong className="text-slate-800">{bus.vehicleNo}</strong>
                <span>
                  {bus.routeNo} · {bus.routeName}
                </span>
                <span>{bus.driverName}</span>
                <span>
                  <Badge
                    label={bus.status.replaceAll('_', ' ')}
                    color={bus.status === 'on_route' ? 'green' : 'amber'}
                  />
                </span>
                <span>
                  {bus.occupiedCount}/{bus.capacity}
                </span>
                <span>{bus.gps?.speed == null ? '—' : `${bus.gps.speed} km/h`}</span>
              </div>
            ))}
          </div>
          {!buses.length && (
            <p className="py-10 text-center text-xs text-slate-600">No buses configured.</p>
          )}
        </div>
      </Section>

      <div className="grid gap-4 xl:grid-cols-3">
        <Section title="Recent Student Allocations" href={path('transport')}>
          <div className="space-y-2">
            {allocations.length ? (
              allocations.map((row) => (
                <RowItem
                  key={row._id ?? `${row.studentId?.email}-${row.createdAt}`}
                  icon={<Users className="h-4 w-4" />}
                  primary={row.studentId?.name ?? row.studentId?.email ?? 'Unlinked student'}
                  secondary={`${row.routeId?.routeNo ?? 'Route'} · ${row.stopName} · ${fmtDate(row.createdAt)}`}
                  href={path('transport')}
                />
              ))
            ) : (
              <p className="py-10 text-center text-xs text-slate-600">No recent allocations.</p>
            )}
          </div>
        </Section>

        <Section title="Driver Compliance" href={path('transport')}>
          <div className="space-y-2">
            {expiringDrivers.length ? (
              expiringDrivers.map((driver) => (
                <RowItem
                  key={driver._id ?? driver.licenseNo}
                  icon={<ShieldAlert className="h-4 w-4" />}
                  primary={driver.name}
                  secondary={`${driver.licenseNo} · expires ${fmtDate(driver.licenseExpiry)}`}
                  end={<Badge label="Due soon" color="amber" />}
                  href={path('transport')}
                />
              ))
            ) : (
              <p className="py-10 text-center text-xs text-slate-600">
                No licences expire within 30 days.
              </p>
            )}
          </div>
        </Section>

        <Section title="Transport Fee Summary" href={path('transport')}>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-emerald-50 p-4">
              <Wallet className="h-5 w-5 text-emerald-600" />
              <p className="mt-3 text-[10px] text-slate-500">Collected</p>
              <p className="mt-1 font-bold text-slate-900">{fmtRupees(fees.paidAmount)}</p>
            </div>
            <div className="rounded-xl bg-rose-50 p-4">
              <CircleGauge className="h-5 w-5 text-rose-600" />
              <p className="mt-3 text-[10px] text-slate-500">Outstanding</p>
              <p className="mt-1 font-bold text-slate-900">{fmtRupees(fees.outstandingAmount)}</p>
            </div>
            <div className="col-span-2 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-xs">
              <span className="text-slate-500">Overdue records</span>
              <strong className="text-rose-600">{fmt(fees.overdueRecords)}</strong>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
