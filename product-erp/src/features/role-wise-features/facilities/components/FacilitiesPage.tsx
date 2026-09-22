'use client';

import AsyncSelect from '@/shared/core/AsyncSelect';
import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { type Action, type Column } from '@/shared/core/CustomTable';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import UseProtectedRoutes from '@/shared/hooks/UseProtectedRoutes';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import { ErrorMessage, Field, FieldArray, Form, Formik } from 'formik';
import {
  Activity,
  Building2,
  CalendarCheck,
  ClipboardCheck,
  Gauge,
  History,
  LayoutDashboard,
  PackageCheck,
  Plus,
  Wrench,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'react-toastify';
import * as Yup from 'yup';
import { useAuthStore } from '@/shared/store/authStore';

interface Api<T> {
  success: boolean;
  data: T;
}
interface Campus {
  _id: string;
  code: string;
  name: string;
}
interface Space extends Record<string, unknown> {
  _id: string;
  campusId: string | Campus;
  code: string;
  name: string;
  building: string;
  floor?: string;
  type: string;
  capacity: number;
  status: string;
}
interface Asset extends Record<string, unknown> {
  _id: string;
  campusId: string | Campus;
  spaceId?: string | Space;
  assetTag: string;
  name: string;
  category: string;
  condition: string;
  status: string;
  nextMaintenanceAt?: string;
  custodianId?: string | { name: string };
}
interface WorkOrder extends Record<string, unknown> {
  _id: string;
  number: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  dueAt: string;
  spaceId?: string | Space;
  assetId?: string | Asset;
  assignedTo?: string | { _id: string; name: string };
}
interface Booking extends Record<string, unknown> {
  _id: string;
  title: string;
  spaceId: string | Space;
  startsAt: string;
  endsAt: string;
  attendees: number;
  status: string;
  bookedBy: string | { name: string };
}
interface Inspection extends Record<string, unknown> {
  _id: string;
  spaceId: string | Space;
  score: number;
  outcome: string;
  inspectedAt: string;
  inspectedBy: string | { name: string };
}
interface Dashboard {
  spaces: number;
  assets: number;
  openWorkOrders: number;
  overdueWorkOrders: number;
  dueMaintenance: number;
  bookingsToday: number;
  acquisitionValue: number;
}
type Modal = 'space' | 'asset' | 'work' | 'booking' | 'inspection' | 'transition' | null;
const field =
  'mt-1 w-full rounded-xl bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20';
const idOf = (v: string | { _id: string }) => (typeof v === 'string' ? v : v._id);
const nameOf = (v: string | { name: string }) => (typeof v === 'string' ? 'Not linked' : v.name);
const formatDate = (v: string) =>
  new Date(v).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
const money = (v: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(v);

function FacilitiesPage() {
  const userId = useAuthStore((state) => state.user?._id ?? '');
  const canCreate = useHasPermission('store', 'create');
  const canEdit = useHasPermission('store', 'edit');
  const canExport = useHasPermission('store', 'export');
  const [tab, setTab] = useState<
    'overview' | 'spaces' | 'assets' | 'work' | 'bookings' | 'inspections'
  >('overview');
  const [modal, setModal] = useState<Modal>(null);
  const [selected, setSelected] = useState<WorkOrder | null>(null);
  const { mutation, isLoading } = useMutation();
  const {
    data: dashRaw,
    mutate: refreshDash,
    error: dashError,
  } = useSwr<Api<Dashboard>>('facilities/dashboard');
  const { data: campusRaw, error: campusError } = useSwr<Api<Campus[]>>(
    'campus-governance/campuses',
  );
  const {
    data: spaceRaw,
    mutate: refreshSpaces,
    error: spaceError,
    isLoading: spacesLoading,
    isValidating: spacesValidating,
  } = useSwr<Api<Space[]>>('facilities/spaces');
  const {
    data: assetRaw,
    mutate: refreshAssets,
    error: assetError,
    isLoading: assetsLoading,
    isValidating: assetsValidating,
  } = useSwr<Api<Asset[]>>('facilities/assets');
  const {
    data: workRaw,
    mutate: refreshWork,
    error: workError,
    isLoading: workLoading,
    isValidating: workValidating,
  } = useSwr<Api<WorkOrder[]>>('facilities/work-orders');
  const {
    data: bookingRaw,
    mutate: refreshBookings,
    error: bookingError,
    isLoading: bookingsLoading,
    isValidating: bookingsValidating,
  } = useSwr<Api<Booking[]>>('facilities/bookings');
  const {
    data: inspectionRaw,
    mutate: refreshInspections,
    error: inspectionError,
    isLoading: inspectionsLoading,
    isValidating: inspectionsValidating,
  } = useSwr<Api<Inspection[]>>('facilities/inspections');
  const d = dashRaw?.data,
    campuses = campusRaw?.data ?? [],
    spaces = spaceRaw?.data ?? [],
    assets = assetRaw?.data ?? [],
    work = workRaw?.data ?? [],
    bookings = bookingRaw?.data ?? [],
    inspections = inspectionRaw?.data ?? [];
  const save = async (
    path: string,
    body: unknown,
    message: string,
    refresh: () => Promise<unknown>,
    method: 'POST' | 'PATCH' = 'POST',
  ) => {
    const response = await mutation(path, { method, body });
    if (!response?.results?.success) return;
    toast.success(message);
    setModal(null);
    setSelected(null);
    await Promise.all([refresh(), refreshDash()]);
  };
  const spaceCols: Column<Space>[] = [
    {
      field: 'code',
      title: 'Space',
      render: (r) => (
        <div>
          <p className="font-semibold">
            {r.code} · {r.name}
          </p>
          <p className="text-xs text-slate-600">
            {r.building}
            {r.floor ? ` · Floor ${r.floor}` : ''}
          </p>
        </div>
      ),
    },
    { field: 'campusId', title: 'Campus', render: (r) => nameOf(r.campusId) },
    { field: 'type', title: 'Type', render: (r) => <Badge v={r.type} /> },
    { field: 'capacity', title: 'Capacity' },
    { field: 'status', title: 'Status', render: (r) => <Badge v={r.status} /> },
  ];
  const assetCols: Column<Asset>[] = [
    {
      field: 'assetTag',
      title: 'Asset',
      render: (r) => (
        <div>
          <p className="font-semibold">
            {r.assetTag} · {r.name}
          </p>
          <p className="text-xs text-slate-600">{r.category}</p>
        </div>
      ),
    },
    {
      field: 'spaceId',
      title: 'Location',
      render: (r) => (r.spaceId ? nameOf(r.spaceId) : 'Unassigned'),
    },
    { field: 'condition', title: 'Condition', render: (r) => <Badge v={r.condition} /> },
    { field: 'status', title: 'Lifecycle', render: (r) => <Badge v={r.status} /> },
    {
      field: 'nextMaintenanceAt',
      title: 'Next service',
      render: (r) =>
        r.nextMaintenanceAt
          ? new Date(r.nextMaintenanceAt).toLocaleDateString('en-IN')
          : 'Not scheduled',
    },
  ];
  const workCols: Column<WorkOrder>[] = [
    {
      field: 'number',
      title: 'Work order',
      render: (r) => (
        <div>
          <p className="font-semibold">{r.number}</p>
          <p className="text-xs text-slate-500">{r.title}</p>
        </div>
      ),
    },
    { field: 'priority', title: 'Priority', render: (r) => <Badge v={r.priority} /> },
    { field: 'status', title: 'Status', render: (r) => <Badge v={r.status} /> },
    {
      field: 'dueAt',
      title: 'SLA due',
      render: (r) => (
        <span
          className={
            new Date(r.dueAt) < new Date() && !['completed', 'cancelled'].includes(r.status)
              ? 'font-semibold text-red-600'
              : ''
          }
        >
          {formatDate(r.dueAt)}
        </span>
      ),
    },
    {
      field: 'assignedTo',
      title: 'Assigned',
      render: (r) => (r.assignedTo ? nameOf(r.assignedTo) : 'Unassigned'),
    },
  ];
  const workActions: Action<WorkOrder>[] = [
    {
      tooltip: 'Update work order',
      icon: <Activity className="h-4 w-4" />,
      hidden: (r) =>
        ['completed', 'cancelled'].includes(r.status) ||
        (!canEdit && idOf(r.assignedTo ?? '') !== userId),
      onClick: (r) => {
        setSelected(r);
        setModal('transition');
      },
    },
  ];
  const bookingCols: Column<Booking>[] = [
    { field: 'title', title: 'Reservation' },
    { field: 'spaceId', title: 'Space', render: (r) => nameOf(r.spaceId) },
    { field: 'startsAt', title: 'Starts', render: (r) => formatDate(r.startsAt) },
    { field: 'endsAt', title: 'Ends', render: (r) => formatDate(r.endsAt) },
    { field: 'attendees', title: 'Attendees' },
    { field: 'status', title: 'Status', render: (r) => <Badge v={r.status} /> },
  ];
  const inspectionCols: Column<Inspection>[] = [
    { field: 'spaceId', title: 'Space', render: (r) => nameOf(r.spaceId) },
    { field: 'score', title: 'Score', render: (r) => `${r.score}%` },
    { field: 'outcome', title: 'Outcome', render: (r) => <Badge v={r.outcome} /> },
    { field: 'inspectedAt', title: 'Inspected', render: (r) => formatDate(r.inspectedAt) },
    { field: 'inspectedBy', title: 'Inspector', render: (r) => nameOf(r.inspectedBy) },
  ];
  const tabs = [
    {
      id: 'overview' as const,
      label: 'Overview',
      description: 'Operational health',
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
    {
      id: 'spaces' as const,
      label: 'Spaces',
      description: 'Buildings and capacity',
      icon: <Building2 className="h-4 w-4" />,
    },
    {
      id: 'assets' as const,
      label: 'Assets',
      description: 'Lifecycle and custody',
      icon: <PackageCheck className="h-4 w-4" />,
    },
    {
      id: 'work' as const,
      label: 'Work orders',
      description: 'Maintenance and SLA',
      icon: <Wrench className="h-4 w-4" />,
    },
    {
      id: 'bookings' as const,
      label: 'Reservations',
      description: 'Space availability',
      icon: <CalendarCheck className="h-4 w-4" />,
    },
    {
      id: 'inspections' as const,
      label: 'Inspections',
      description: 'Safety and condition',
      icon: <ClipboardCheck className="h-4 w-4" />,
    },
  ];
  const open = () =>
    setModal(
      tab === 'spaces'
        ? 'space'
        : tab === 'assets'
          ? 'asset'
          : tab === 'work'
            ? 'work'
            : tab === 'bookings'
              ? 'booking'
              : tab === 'inspections'
                ? 'inspection'
                : 'work',
    );
  const createLabel = {
    overview: 'work order',
    spaces: 'facility space',
    assets: 'asset',
    work: 'work order',
    bookings: 'reservation',
    inspections: 'inspection',
  }[tab];
  const cards: Array<[React.ElementType, string, number]> = [
    [Building2, 'Managed spaces', d?.spaces ?? 0],
    [PackageCheck, 'Registered assets', d?.assets ?? 0],
    [Wrench, 'Open work orders', d?.openWorkOrders ?? 0],
    [Activity, 'Overdue SLA', d?.overdueWorkOrders ?? 0],
    [CalendarCheck, 'Bookings next 24h', d?.bookingsToday ?? 0],
    [ClipboardCheck, 'Maintenance due', d?.dueMaintenance ?? 0],
  ];
  const operationalHealth = (() => {
    const activeSpaces = spaces.filter((space) => space.status === 'active').length;
    const serviceableAssets = assets.filter((asset) =>
      ['excellent', 'good', 'fair'].includes(asset.condition),
    ).length;
    const openOrders = work.filter((order) => !['completed', 'cancelled'].includes(order.status));
    const overdueOrders = openOrders.filter((order) => new Date(order.dueAt) < new Date()).length;
    const passedInspections = inspections.filter(
      (inspection) => inspection.outcome === 'pass',
    ).length;
    return {
      spaceReadiness: spaces.length ? Math.round((activeSpaces / spaces.length) * 100) : 0,
      assetHealth: assets.length ? Math.round((serviceableAssets / assets.length) * 100) : 0,
      slaHealth: openOrders.length
        ? Math.round(((openOrders.length - overdueOrders) / openOrders.length) * 100)
        : 100,
      inspectionHealth: inspections.length
        ? Math.round((passedInspections / inspections.length) * 100)
        : 0,
    };
  })();
  return (
    <div className="w-full flex flex-col gap-5">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            Campus operations
          </p>
          <h1 className="text-2xl font-black text-slate-950">Facilities & Asset Lifecycle</h1>
          <p className="text-sm text-slate-500">
            Know what you own, where it is, who maintains it, and whether spaces are safe and
            available.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tab === 'work' && canEdit && (
            <CustomButton
              variant="secondary"
              onClick={async () => {
                const r = await mutation('facilities/work-orders/generate-preventive', {
                  method: 'POST',
                });
                if (r?.results?.success) {
                  toast.success('Preventive maintenance queue refreshed');
                  await Promise.all([refreshWork(), refreshDash()]);
                }
              }}
            >
              Generate preventive work
            </CustomButton>
          )}
          {canCreate && (
            <CustomButton onClick={open}>
              <Plus className="mr-2 h-4 w-4" />
              Add {createLabel}
            </CustomButton>
          )}
        </div>
      </header>
      <nav
        className="flex w-fit max-w-full gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2"
        role="tablist"
        aria-label="Facilities workspace sections"
      >
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            aria-controls={`facilities-${item.id}-panel`}
            onClick={() => setTab(item.id)}
            className={`flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-colors ${tab === item.id ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tab === item.id ? 'bg-white/15' : 'bg-slate-100'}`}
            >
              {item.icon}
            </span>
            <span>
              <span className="block text-xs font-bold">{item.label}</span>
              <span
                className={`mt-0.5 block text-[10px] ${tab === item.id ? 'text-white/75' : 'text-slate-400'}`}
              >
                {item.description}
              </span>
            </span>
          </button>
        ))}
      </nav>
      {tab === 'overview' && (
        <div id="facilities-overview-panel" role="tabpanel" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map(([Icon, label, value]) => (
              <article key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <span className="rounded-xl bg-primary-50 p-2.5 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="text-2xl font-black text-slate-900">{value}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-900">
              <div className="flex items-start gap-3">
                <span className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700">
                  <Gauge className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-sm font-bold">Operational readiness</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Live health signals calculated from facility records.
                  </p>
                </div>
              </div>
              <div className="mt-5 space-y-4">
                {[
                  ['Space availability', operationalHealth.spaceReadiness, '#3b82f6'],
                  ['Asset condition', operationalHealth.assetHealth, '#10b981'],
                  ['Work-order SLA', operationalHealth.slaHealth, '#8b5cf6'],
                  ['Inspection pass rate', operationalHealth.inspectionHealth, '#f59e0b'],
                ].map(([label, value, color]) => (
                  <div key={String(label)}>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-600">{label}</span>
                      <strong className="text-slate-900">{value}%</strong>
                    </div>
                    <svg
                      viewBox="0 0 100 8"
                      className="h-2 w-full overflow-hidden rounded-full"
                      role="img"
                      aria-label={`${label}: ${value}%`}
                    >
                      <rect width="100" height="8" rx="4" className="fill-slate-100" />
                      <rect width={Number(value)} height="8" rx="4" fill={String(color)} />
                    </svg>
                  </div>
                ))}
              </div>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-900">
              <div className="flex items-start gap-3">
                <span className="rounded-xl bg-violet-50 p-2.5 text-violet-700">
                  <History className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs text-slate-500">Recorded acquisition value</p>
                  <p className="mt-1 text-3xl font-black">{money(d?.acquisitionValue ?? 0)}</p>
                </div>
              </div>
              <p className="mt-5 rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-600">
                Based on registered serialized assets. Consumable inventory valuation remains in the
                Store workspace to prevent double counting.
              </p>
            </article>
          </div>
          <FacilitiesAnalytics
            spaces={spaces}
            assets={assets}
            workOrders={work}
            bookings={bookings}
            inspections={inspections}
          />
        </div>
      )}
      {(dashError ||
        campusError ||
        spaceError ||
        assetError ||
        workError ||
        bookingError ||
        inspectionError) && (
        <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
          Some facilities data could not be loaded. Refresh and try again; no placeholder data is
          shown.
        </div>
      )}
      {tab === 'spaces' && (
        <CustomTable
          key="facilities-spaces-table"
          title="Facility registry"
          description="Review campus spaces, building locations, capacity, type and operating availability."
          data={spaces}
          columns={spaceCols}
          options={{ responsive: true, export: canExport, refresh: true, pagination: true }}
          isLoading={spacesLoading}
          isValidating={spacesValidating}
          onRefresh={() => void refreshSpaces()}
        />
      )}
      {tab === 'assets' && (
        <CustomTable
          key="facilities-assets-table"
          title="Asset register"
          description="Track asset identity, assigned location, condition, lifecycle state and next service date."
          data={assets}
          columns={assetCols}
          options={{ responsive: true, export: canExport, refresh: true, pagination: true }}
          isLoading={assetsLoading}
          isValidating={assetsValidating}
          onRefresh={() => void refreshAssets()}
        />
      )}
      {tab === 'work' && (
        <CustomTable
          key="facilities-work-table"
          title="Maintenance work orders"
          description="Monitor maintenance ownership, priority, workflow status and SLA commitments."
          data={work}
          columns={workCols}
          actions={workActions}
          options={{ responsive: true, export: canExport, refresh: true, pagination: true }}
          isLoading={workLoading}
          isValidating={workValidating}
          onRefresh={() => void refreshWork()}
        />
      )}
      {tab === 'bookings' && (
        <CustomTable
          key="facilities-bookings-table"
          title="Space reservations"
          description="Review confirmed facility use, schedules, attendance and potential capacity pressure."
          data={bookings}
          columns={bookingCols}
          options={{ responsive: true, export: canExport, refresh: true, pagination: true }}
          isLoading={bookingsLoading}
          isValidating={bookingsValidating}
          onRefresh={() => void refreshBookings()}
        />
      )}
      {tab === 'inspections' && (
        <CustomTable
          key="facilities-inspections-table"
          title="Safety & condition inspections"
          description="Review inspection coverage, scored outcomes, inspection dates and accountable inspectors."
          data={inspections}
          columns={inspectionCols}
          options={{ responsive: true, export: canExport, refresh: true, pagination: true }}
          isLoading={inspectionsLoading}
          isValidating={inspectionsValidating}
          onRefresh={() => void refreshInspections()}
        />
      )}
      {modal === 'space' && (
        <SpaceForm
          campuses={campuses}
          loading={isLoading}
          close={() => setModal(null)}
          submit={(v) => save('facilities/spaces', v, 'Facility space created', refreshSpaces)}
        />
      )}{' '}
      {modal === 'asset' && (
        <AssetForm
          campuses={campuses}
          spaces={spaces}
          loading={isLoading}
          close={() => setModal(null)}
          submit={(v) => save('facilities/assets', v, 'Asset registered', refreshAssets)}
        />
      )}{' '}
      {modal === 'work' && (
        <WorkForm
          campuses={campuses}
          spaces={spaces}
          assets={assets}
          loading={isLoading}
          close={() => setModal(null)}
          submit={(v) => save('facilities/work-orders', v, 'Work order created', refreshWork)}
        />
      )}{' '}
      {modal === 'booking' && (
        <BookingForm
          campuses={campuses}
          spaces={spaces}
          loading={isLoading}
          close={() => setModal(null)}
          submit={(v) => save('facilities/bookings', v, 'Facility reserved', refreshBookings)}
        />
      )}{' '}
      {modal === 'inspection' && (
        <InspectionForm
          campuses={campuses}
          spaces={spaces}
          loading={isLoading}
          close={() => setModal(null)}
          submit={(v) =>
            save('facilities/inspections', v, 'Inspection recorded', refreshInspections)
          }
        />
      )}{' '}
      {modal === 'transition' && selected && (
        <TransitionForm
          item={selected}
          canManage={canEdit}
          loading={isLoading}
          close={() => {
            setModal(null);
            setSelected(null);
          }}
          submit={(v) =>
            save(
              `facilities/work-orders/${selected._id}/status`,
              v,
              'Work order updated',
              refreshWork,
              'PATCH',
            )
          }
        />
      )}
    </div>
  );
}

const CHART_COLORS = ['#2563eb', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#64748b'];

function readableLabel(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function FacilitiesAnalytics({
  spaces,
  assets,
  workOrders,
  bookings,
  inspections,
}: {
  spaces: Space[];
  assets: Asset[];
  workOrders: WorkOrder[];
  bookings: Booking[];
  inspections: Inspection[];
}) {
  const countBy = <T,>(rows: T[], valueOf: (row: T) => string) => {
    const counts = new Map<string, number>();
    rows.forEach((row) => {
      const value = valueOf(row);
      counts.set(value, (counts.get(value) ?? 0) + 1);
    });
    return Array.from(counts, ([label, value]) => ({ label, value })).sort(
      (left, right) => right.value - left.value,
    );
  };
  const workStatus = countBy(workOrders, (order) => order.status);
  const assetCondition = countBy(assets, (asset) => asset.condition);
  const capacityByType = Array.from(
    spaces.reduce((totals, space) => {
      totals.set(space.type, (totals.get(space.type) ?? 0) + space.capacity);
      return totals;
    }, new Map<string, number>()),
    ([label, value]) => ({ label, value }),
  )
    .sort((left, right) => right.value - left.value)
    .slice(0, 7);
  const now = new Date();
  const bookingDemand = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + index);
    const end = new Date(date);
    end.setDate(end.getDate() + 1);
    return {
      label: date.toLocaleDateString('en-IN', { weekday: 'short' }),
      value: bookings.filter((booking) => {
        const startsAt = new Date(booking.startsAt);
        return booking.status === 'confirmed' && startsAt >= date && startsAt < end;
      }).length,
    };
  });
  const activeOrders = workOrders.filter(
    (order) => !['completed', 'cancelled'].includes(order.status),
  );
  const averageInspectionScore = inspections.length
    ? Math.round(
        inspections.reduce((total, inspection) => total + inspection.score, 0) / inspections.length,
      )
    : 0;
  const criticalOrders = activeOrders.filter((order) => order.priority === 'critical').length;
  const unassignedOrders = activeOrders.filter((order) => !order.assignedTo).length;
  const overdueOrders = activeOrders.filter((order) => new Date(order.dueAt) < now).length;

  return (
    <section aria-label="Detailed facilities analytics" className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [
            'Average inspection score',
            `${averageInspectionScore}%`,
            `${inspections.length} inspections assessed`,
          ],
          [
            'Critical work orders',
            criticalOrders.toLocaleString('en-IN'),
            `${activeOrders.length} active work orders`,
          ],
          [
            'Unassigned maintenance',
            unassignedOrders.toLocaleString('en-IN'),
            'Open orders without an owner',
          ],
          [
            'Overdue commitments',
            overdueOrders.toLocaleString('en-IN'),
            'Active orders beyond SLA due time',
          ],
        ].map(([label, value, detail]) => (
          <article key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-black tracking-tight text-slate-900">{value}</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <DonutAnalytics
          title="Work-order distribution"
          description="Current maintenance workload by workflow stage"
          rows={workStatus}
          centerValue={workOrders.length}
          centerLabel="orders"
        />
        <HorizontalBarAnalytics
          title="Asset condition profile"
          description="Registered assets grouped by latest assessed condition"
          rows={assetCondition}
        />
        <VerticalBarAnalytics
          title="Capacity by space type"
          description="Configured seating or occupancy capacity across active facility types"
          rows={capacityByType}
          valueLabel="capacity"
        />
        <VerticalBarAnalytics
          title="Reservation demand"
          description="Confirmed facility reservations beginning in the next seven days"
          rows={bookingDemand}
          valueLabel="reservations"
        />
      </div>
    </section>
  );
}

interface IChartRow {
  label: string;
  value: number;
}

function AnalyticsShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <h2 className="text-sm font-bold text-slate-900">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      {children}
    </article>
  );
}

function DonutAnalytics({
  title,
  description,
  rows,
  centerValue,
  centerLabel,
}: {
  title: string;
  description: string;
  rows: IChartRow[];
  centerValue: number;
  centerLabel: string;
}) {
  const circumference = 2 * Math.PI * 46;
  const segments = rows.map((row, index) => {
    const length = centerValue ? (row.value / centerValue) * circumference : 0;
    const precedingLength = rows
      .slice(0, index)
      .reduce(
        (total, preceding) =>
          total + (centerValue ? (preceding.value / centerValue) * circumference : 0),
        0,
      );
    return { ...row, length, dashOffset: -precedingLength };
  });
  return (
    <AnalyticsShell title={title} description={description}>
      {rows.length ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
          <div className="relative mx-auto h-44 w-44">
            <svg
              viewBox="0 0 120 120"
              className="h-full w-full -rotate-90"
              role="img"
              aria-label={title}
            >
              <circle cx="60" cy="60" r="46" fill="none" stroke="#f1f5f9" strokeWidth="14" />
              {segments.map((row, index) => {
                return (
                  <circle
                    key={row.label}
                    cx="60"
                    cy="60"
                    r="46"
                    fill="none"
                    stroke={CHART_COLORS[index % CHART_COLORS.length]}
                    strokeWidth="14"
                    strokeDasharray={`${row.length} ${circumference - row.length}`}
                    strokeDashoffset={row.dashOffset}
                    className="transition-opacity duration-200 hover:opacity-70"
                  >
                    <title>{`${readableLabel(row.label)}: ${row.value}`}</title>
                  </circle>
                );
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <strong className="text-2xl text-slate-900">{centerValue}</strong>
              <span className="text-[10px] font-medium text-slate-500">{centerLabel}</span>
            </div>
          </div>
          <div className="space-y-2.5">
            {rows.map((row, index) => (
              <div key={row.label} className="flex items-center gap-2 text-xs">
                <svg className="h-2.5 w-2.5" viewBox="0 0 10 10" aria-hidden="true">
                  <circle cx="5" cy="5" r="5" fill={CHART_COLORS[index % CHART_COLORS.length]} />
                </svg>
                <span className="min-w-0 flex-1 truncate text-slate-600">
                  {readableLabel(row.label)}
                </span>
                <strong className="text-slate-900">{row.value}</strong>
                <span className="w-10 text-right text-slate-400">
                  {Math.round((row.value / centerValue) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <ChartEmpty message="Work-order distribution will appear after orders are created." />
      )}
    </AnalyticsShell>
  );
}

function HorizontalBarAnalytics({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: IChartRow[];
}) {
  const maxValue = Math.max(1, ...rows.map((row) => row.value));
  return (
    <AnalyticsShell title={title} description={description}>
      {rows.length ? (
        <div className="mt-5 space-y-3">
          {rows.map((row, index) => (
            <div
              key={row.label}
              className="grid grid-cols-[92px_minmax(0,1fr)_32px] items-center gap-3 text-xs"
            >
              <span className="truncate font-medium text-slate-600">
                {readableLabel(row.label)}
              </span>
              <svg
                viewBox="0 0 100 10"
                className="h-2.5 w-full overflow-hidden rounded-full"
                role="img"
                aria-label={`${readableLabel(row.label)}: ${row.value} assets`}
              >
                <rect width="100" height="10" rx="5" fill="#f1f5f9" />
                <rect
                  width={(row.value / maxValue) * 100}
                  height="10"
                  rx="5"
                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                  className="transition-opacity hover:opacity-75"
                >
                  <title>{`${readableLabel(row.label)}: ${row.value}`}</title>
                </rect>
              </svg>
              <strong className="text-right text-slate-900">{row.value}</strong>
            </div>
          ))}
        </div>
      ) : (
        <ChartEmpty message="Asset condition analytics will appear after assets are registered." />
      )}
    </AnalyticsShell>
  );
}

function VerticalBarAnalytics({
  title,
  description,
  rows,
  valueLabel,
}: {
  title: string;
  description: string;
  rows: IChartRow[];
  valueLabel: string;
}) {
  const maxValue = Math.max(1, ...rows.map((row) => row.value));
  const hasValues = rows.some((row) => row.value > 0);
  return (
    <AnalyticsShell title={title} description={description}>
      {rows.length && hasValues ? (
        <div className="mt-5">
          <svg viewBox="0 0 560 210" className="h-52 w-full" role="img" aria-label={title}>
            {[0.25, 0.5, 0.75, 1].map((ratio) => (
              <line
                key={ratio}
                x1="24"
                x2="548"
                y1={180 - ratio * 150}
                y2={180 - ratio * 150}
                stroke="#e2e8f0"
                strokeDasharray="4 6"
              />
            ))}
            {rows.map((row, index) => {
              const slot = 520 / rows.length;
              const barWidth = Math.min(44, slot * 0.58);
              const barHeight = (row.value / maxValue) * 145;
              const barX = 28 + index * slot + (slot - barWidth) / 2;
              return (
                <g key={row.label} className="transition-opacity hover:opacity-75">
                  <rect
                    x={barX}
                    y={180 - barHeight}
                    width={barWidth}
                    height={barHeight}
                    rx="7"
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                  >
                    <title>{`${readableLabel(row.label)}: ${row.value} ${valueLabel}`}</title>
                  </rect>
                  <text
                    x={barX + barWidth / 2}
                    y="201"
                    textAnchor="middle"
                    fontSize="10"
                    fill="#64748b"
                  >
                    {readableLabel(row.label).slice(0, 10)}
                  </text>
                  <text
                    x={barX + barWidth / 2}
                    y={Math.max(20, 174 - barHeight)}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="700"
                    fill="#334155"
                  >
                    {row.value}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      ) : (
        <ChartEmpty
          message={`${title} will appear when matching facility records are available.`}
        />
      )}
    </AnalyticsShell>
  );
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="mt-5 flex h-44 items-center justify-center rounded-xl bg-slate-50 px-6 text-center text-xs leading-5 text-slate-500">
      {message}
    </div>
  );
}

function Badge({ v }: { v: string }) {
  return (
    <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold capitalize text-primary">
      {v.replaceAll('_', ' ')}
    </span>
  );
}
function Shell({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-200/80 sm:items-center sm:p-4">
      <div className="max-h-[94dvh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl">
        <div className="mb-4 flex justify-between">
          <h2 className="font-bold">{title}</h2>
          <button type="button" onClick={close}>
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Error({ name }: { name: string }) {
  return (
    <ErrorMessage name={name}>
      {(m) => <p className="mt-1 text-xs font-medium text-red-600">{m}</p>}
    </ErrorMessage>
  );
}
function RequiredMark() {
  return <span className="ml-0.5 text-red-500">*</span>;
}
function CampusField({ campuses }: { campuses: Campus[] }) {
  return (
    <label className="text-sm font-medium">
      Campus <RequiredMark />
      <Field as="select" name="campusId" className={field}>
        <option value="">Select campus</option>
        {campuses.map((c) => (
          <option key={c._id} value={c._id}>
            {c.code} · {c.name}
          </option>
        ))}
      </Field>
      <Error name="campusId" />
    </label>
  );
}
function SpaceField({
  spaces,
  campusId,
  required = false,
}: {
  spaces: Space[];
  campusId: string;
  required?: boolean;
}) {
  return (
    <label className="text-sm font-medium">
      Space {required ? '*' : ''}
      <Field as="select" name="spaceId" className={field}>
        <option value="">Select space</option>
        {spaces
          .filter((s) => idOf(s.campusId) === campusId)
          .map((s) => (
            <option key={s._id} value={s._id}>
              {s.code} · {s.name}
            </option>
          ))}
      </Field>
      <Error name="spaceId" />
    </label>
  );
}
function SpaceForm({
  campuses,
  loading,
  close,
  submit,
}: {
  campuses: Campus[];
  loading: boolean;
  close: () => void;
  submit: (v: Record<string, unknown>) => Promise<void>;
}) {
  const spaceSchema = Yup.object({
    campusId: Yup.string().required('Select the campus location'),
    code: Yup.string()
      .trim()
      .min(2, 'Min 2 characters')
      .max(30, 'Max 30 characters')
      .matches(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/, 'Alphanumeric, dashes, dots, or slashes only')
      .required('Space code is required'),
    name: Yup.string().trim().min(2, 'Min 2 characters').required('Space name is required'),
    building: Yup.string().trim().min(2, 'Min 2 characters').required('Building name is required'),
    floor: Yup.string().trim().max(50, 'Floor cannot exceed 50 characters'),
    type: Yup.string().required('Space type is required'),
    capacity: Yup.number()
      .typeError('Must be a number')
      .integer('Must be a whole number')
      .min(0, 'Cannot be negative')
      .required('Capacity is required'),
    amenities: Yup.string(),
    status: Yup.string().required('Status is required'),
  });

  return (
    <Shell title="Register Physical Facility Space" close={close}>
      <Formik
        initialValues={{
          campusId: '',
          code: '',
          name: '',
          building: '',
          floor: '',
          type: 'classroom',
          capacity: 40,
          status: 'active',
          amenities: '',
        }}
        validationSchema={spaceSchema}
        onSubmit={(v) =>
          submit({
            ...v,
            code: v.code.trim().toUpperCase(),
            name: v.name.trim(),
            building: v.building.trim(),
            floor: v.floor.trim() || undefined,
            capacity: Number(v.capacity),
            amenities: v.amenities
              .split(',')
              .map((x) => x.trim())
              .filter(Boolean),
          })
        }
      >
        {() => (
          <Form className="space-y-5">
            <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                1. Location & Identity
              </h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <CampusField campuses={campuses} />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Physical campus branch where this room or space is located.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Space Code *</label>
                  <Field name="code" className={field} placeholder="e.g. CSE-101, LAB-B2, AUD-01" />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Unique room code used in timetable scheduling and exam seating.
                  </p>
                  <Error name="code" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Space Name *</label>
                  <Field
                    name="name"
                    className={field}
                    placeholder="e.g. Software Engineering Lab, Main Auditorium"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Descriptive display name shown to faculty and students.
                  </p>
                  <Error name="name" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Building Block *
                  </label>
                  <Field
                    name="building"
                    className={field}
                    placeholder="e.g. Academic Block A, Science Complex"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Building or block identifier on campus map.
                  </p>
                  <Error name="building" />
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                2. Classification & Amenities
              </h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Floor Level</label>
                  <Field
                    name="floor"
                    className={field}
                    placeholder="e.g. Ground, 1st Floor, Basement"
                  />
                  <Error name="floor" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Space Type *</label>
                  <Field as="select" name="type" className={field}>
                    <option value="classroom">Classroom / Lecture Hall</option>
                    <option value="laboratory">Computer / Science Laboratory</option>
                    <option value="office">Faculty / Administrative Office</option>
                    <option value="auditorium">Auditorium / Seminar Hall</option>
                    <option value="library">Library / Reading Room</option>
                    <option value="sports">Sports Complex / Gymnasium</option>
                    <option value="hostel">Hostel Block / Dormitory</option>
                    <option value="utility">Utility / Server Room / Store</option>
                    <option value="other">Other Facility Space</option>
                  </Field>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Seating / Max Occupancy Capacity *
                  </label>
                  <Field
                    type="number"
                    name="capacity"
                    min={0}
                    className={field}
                    placeholder="e.g. 60"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Maximum allowed seating limit for timetable and reservation checks.
                  </p>
                  <Error name="capacity" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Status *</label>
                  <Field as="select" name="status" className={field}>
                    <option value="active">Active (Available)</option>
                    <option value="maintenance">Under Maintenance / Repair</option>
                    <option value="inactive">Inactive / Reserved</option>
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Amenities & Equipment
                  </label>
                  <Field
                    name="amenities"
                    className={field}
                    placeholder="Projector, Smart Board, AC, Audio System, Wi-Fi"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Comma-separated list of installed facilities for filter and search.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <CustomButton variant="tertiary" type="button" onClick={close}>
                Cancel
              </CustomButton>
              <CustomButton type="submit" loading={loading}>
                Register Facility Space
              </CustomButton>
            </div>
          </Form>
        )}
      </Formik>
    </Shell>
  );
}

function AssetForm({
  campuses,
  spaces,
  loading,
  close,
  submit,
}: {
  campuses: Campus[];
  spaces: Space[];
  loading: boolean;
  close: () => void;
  submit: (v: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <Shell title="Register Serialized Asset" close={close}>
      <Formik
        initialValues={{
          campusId: '',
          spaceId: '',
          assetTag: '',
          name: '',
          category: 'IT Hardware',
          serialNumber: '',
          manufacturer: '',
          modelName: '',
          condition: 'good',
          acquiredAt: '',
          acquisitionCost: '',
          warrantyEndsAt: '',
          maintenanceIntervalDays: '',
          custodianId: '',
        }}
        validationSchema={Yup.object({
          campusId: Yup.string().required('Campus is required'),
          assetTag: Yup.string().trim().required('Asset Tag is required'),
          name: Yup.string().trim().required('Asset Name is required'),
          category: Yup.string().required('Category is required'),
          condition: Yup.string().required('Condition is required'),
          acquisitionCost: Yup.number().min(0, 'Cost cannot be negative').nullable(),
          maintenanceIntervalDays: Yup.number()
            .min(1, 'Interval must be at least 1 day')
            .nullable(),
        })}
        onSubmit={submit}
      >
        {({ values, setFieldValue }) => (
          <Form className="space-y-5">
            <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                1. Asset Tagging & Location
              </h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <CampusField campuses={campuses} />
                  <Error name="campusId" />
                </div>
                <div>
                  <SpaceField spaces={spaces} campusId={values.campusId} />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Specific room or lab where asset is stationed.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Asset Tag / Barcode *
                  </label>
                  <Field name="assetTag" placeholder="e.g. AST-LAB1-042" className={field} />
                  <p className="mt-1 text-[11px] text-slate-500">Unique QR/Barcode sticker tag.</p>
                  <Error name="assetTag" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Asset Name *</label>
                  <Field
                    name="name"
                    placeholder="e.g. Epson 4K Projector, Dell Workstation 5820"
                    className={field}
                  />
                  <Error name="name" />
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                2. Serial & Specification Details
              </h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Category *</label>
                  <Field
                    name="category"
                    placeholder="e.g. IT Hardware, AV Equipment, Furniture, Generator"
                    className={field}
                  />
                  <Error name="category" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Serial Number
                  </label>
                  <Field name="serialNumber" placeholder="e.g. SN-8849204-X" className={field} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Manufacturer</label>
                  <Field
                    name="manufacturer"
                    placeholder="e.g. Dell, Epson, Daikin"
                    className={field}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Model Name / Number
                  </label>
                  <Field name="modelName" placeholder="e.g. PowerEdge R740" className={field} />
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                3. Financials, Warranty & Maintenance
              </h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Asset Condition *
                  </label>
                  <Field as="select" name="condition" className={field}>
                    <option value="excellent">Excellent (New / Fully Functional)</option>
                    <option value="good">Good (Operational)</option>
                    <option value="fair">Fair (Minor Wear)</option>
                    <option value="poor">Poor (Needs Repair)</option>
                    <option value="unserviceable">Unserviceable (Breakdown / Scrap)</option>
                  </Field>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Acquisition Cost (₹)
                  </label>
                  <Field
                    type="number"
                    name="acquisitionCost"
                    placeholder="e.g. 75000"
                    className={field}
                  />
                  <Error name="acquisitionCost" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Acquisition Date
                  </label>
                  <Field type="date" name="acquiredAt" className={field} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Warranty End Date
                  </label>
                  <Field type="date" name="warrantyEndsAt" className={field} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Maintenance Cycle (Days)
                  </label>
                  <Field
                    type="number"
                    name="maintenanceIntervalDays"
                    placeholder="e.g. 90 (Quarterly)"
                    className={field}
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Automates recurring preventive maintenance alerts.
                  </p>
                </div>
                <div>
                  <AsyncSelect
                    type="users"
                    label="Custodian Staff Member"
                    value={values.custodianId}
                    onChange={(v) => setFieldValue('custodianId', v ?? '')}
                    placeholder="Search custodian staff..."
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Employee responsible for asset upkeep.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <CustomButton variant="tertiary" type="button" onClick={close}>
                Cancel
              </CustomButton>
              <CustomButton type="submit" loading={loading}>
                Register Asset
              </CustomButton>
            </div>
          </Form>
        )}
      </Formik>
    </Shell>
  );
}

function WorkForm({
  campuses,
  spaces,
  assets,
  loading,
  close,
  submit,
}: {
  campuses: Campus[];
  spaces: Space[];
  assets: Asset[];
  loading: boolean;
  close: () => void;
  submit: (v: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <Shell title="Log Maintenance Work Order Ticket" close={close}>
      <Formik
        initialValues={{
          campusId: '',
          spaceId: '',
          assetId: '',
          title: '',
          description: '',
          category: 'corrective',
          priority: 'medium',
          dueAt: '',
          assignedTo: '',
        }}
        validationSchema={Yup.object({
          campusId: Yup.string().required('Campus selection is required'),
          spaceId: Yup.string(),
          assetId: Yup.string(),
          title: Yup.string().trim().required('Work order title is required'),
          description: Yup.string()
            .trim()
            .min(5, 'Provide at least 5 characters description')
            .required('Description is required'),
          category: Yup.string().required('Category is required'),
          priority: Yup.string().required('Priority level is required'),
        }).test('target', 'Select either a target asset or a facility space', (v) =>
          Boolean(v?.assetId || v?.spaceId),
        )}
        onSubmit={submit}
      >
        {({ values, setFieldValue, errors }) => (
          <Form className="space-y-5">
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-xs text-blue-800">
              Create a maintenance or breakdown ticket to dispatch technicians for facility repairs,
              IT support, or cleaning requests.
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                1. Target Location or Asset
              </h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <CampusField campuses={campuses} />
                  <Error name="campusId" />
                </div>
                <div>
                  <SpaceField spaces={spaces} campusId={values.campusId} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Specific Equipment / Asset
                  </label>
                  <Field as="select" name="assetId" className={field}>
                    <option value="">Select asset (optional if room issue)</option>
                    {assets
                      .filter((a) => idOf(a.campusId) === values.campusId)
                      .map((a) => (
                        <option key={a._id} value={a._id}>
                          {a.assetTag} · {a.name}
                        </option>
                      ))}
                  </Field>
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                2. Issue Description & Priority
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Work Order Title *
                  </label>
                  <Field
                    name="title"
                    placeholder="e.g. Projector Bulb Failure in Lab 102"
                    className={field}
                  />
                  <Error name="title" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Detailed Description *
                  </label>
                  <Field
                    as="textarea"
                    rows={3}
                    name="description"
                    placeholder="Describe the symptom, location, or repair needed..."
                    className={field}
                  />
                  <Error name="description" />
                </div>
                {typeof errors === 'string' && (
                  <p className="text-xs font-medium text-red-500">{errors}</p>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Maintenance Category *
                    </label>
                    <Field as="select" name="category" className={field}>
                      <option value="corrective">Corrective Repair (Breakdown)</option>
                      <option value="preventive">Preventive Maintenance (Routine)</option>
                      <option value="inspection">Safety Audit Finding</option>
                      <option value="safety">Hazard / Emergency</option>
                      <option value="cleaning">Sanitation / Deep Cleaning</option>
                    </Field>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Priority Level *
                    </label>
                    <Field as="select" name="priority" className={field}>
                      <option value="low">Low (Routine - 7 Days SLA)</option>
                      <option value="medium">Medium (Standard - 3 Days SLA)</option>
                      <option value="high">High (Urgent - 24 Hours SLA)</option>
                      <option value="critical">Critical (Emergency - Immediate SLA)</option>
                    </Field>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Target Resolution Due Date
                    </label>
                    <Field type="datetime-local" name="dueAt" className={field} />
                  </div>
                  <div>
                    <AsyncSelect
                      type="users"
                      label="Assign Technician / Worker"
                      value={values.assignedTo}
                      onChange={(v) => setFieldValue('assignedTo', v ?? '')}
                      placeholder="Search technician..."
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <CustomButton variant="tertiary" type="button" onClick={close}>
                Cancel
              </CustomButton>
              <CustomButton type="submit" loading={loading}>
                Create Work Order
              </CustomButton>
            </div>
          </Form>
        )}
      </Formik>
    </Shell>
  );
}

function BookingForm({
  campuses,
  spaces,
  loading,
  close,
  submit,
}: {
  campuses: Campus[];
  spaces: Space[];
  loading: boolean;
  close: () => void;
  submit: (v: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <Shell title="Reserve Facility Space" close={close}>
      <Formik
        initialValues={{
          campusId: '',
          spaceId: '',
          title: '',
          purpose: '',
          startsAt: '',
          endsAt: '',
          attendees: 1,
        }}
        validationSchema={Yup.object({
          campusId: Yup.string().required('Campus selection is required'),
          spaceId: Yup.string().required('Space selection is required'),
          title: Yup.string().trim().required('Event title is required'),
          purpose: Yup.string()
            .trim()
            .min(3, 'Purpose must be at least 3 chars')
            .required('Purpose is required'),
          startsAt: Yup.date().required('Start time is required'),
          endsAt: Yup.date()
            .min(Yup.ref('startsAt'), 'End time must be after start time')
            .required('End time is required'),
          attendees: Yup.number()
            .min(1, 'At least 1 attendee required')
            .required('Attendees count is required'),
        })}
        onSubmit={submit}
      >
        {({ values }) => (
          <Form className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <CampusField campuses={campuses} />
                <Error name="campusId" />
              </div>
              <div>
                <SpaceField spaces={spaces} campusId={values.campusId} required />
                <Error name="spaceId" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Reservation Title *
                </label>
                <Field
                  name="title"
                  placeholder="e.g. National Robotics Workshop 2026"
                  className={field}
                />
                <Error name="title" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Expected Attendees *
                </label>
                <Field type="number" name="attendees" min={1} className={field} />
                <Error name="attendees" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Event Purpose & Agenda *
                </label>
                <Field
                  name="purpose"
                  placeholder="Brief explanation of event and required equipment..."
                  className={field}
                />
                <Error name="purpose" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Reservation Start Time *
                </label>
                <Field type="datetime-local" name="startsAt" className={field} />
                <Error name="startsAt" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Reservation End Time *
                </label>
                <Field type="datetime-local" name="endsAt" className={field} />
                <Error name="endsAt" />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <CustomButton variant="tertiary" type="button" onClick={close}>
                Cancel
              </CustomButton>
              <CustomButton type="submit" loading={loading}>
                Check availability & reserve
              </CustomButton>
            </div>
          </Form>
        )}
      </Formik>
    </Shell>
  );
}

function InspectionForm({
  campuses,
  spaces,
  loading,
  close,
  submit,
}: {
  campuses: Campus[];
  spaces: Space[];
  loading: boolean;
  close: () => void;
  submit: (v: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <Shell title="Record Facility Audit & Safety Inspection" close={close}>
      <Formik
        initialValues={{
          campusId: '',
          spaceId: '',
          followUpDueAt: '',
          checklist: [
            { item: 'Emergency exits and fire doors are clear', passed: true, note: '' },
            { item: 'Electrical sockets and switches are intact', passed: true, note: '' },
            { item: 'Air conditioning and ventilation function properly', passed: true, note: '' },
          ],
        }}
        validationSchema={Yup.object({
          campusId: Yup.string().required('Campus selection is required'),
          spaceId: Yup.string().required('Space selection is required'),
          checklist: Yup.array()
            .of(
              Yup.object({
                item: Yup.string().required('Item title is required'),
                passed: Yup.boolean().required(),
              }),
            )
            .min(1, 'At least one checklist item is required'),
        })}
        onSubmit={submit}
      >
        {({ values }) => (
          <Form className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <CampusField campuses={campuses} />
                <Error name="campusId" />
              </div>
              <div>
                <SpaceField spaces={spaces} campusId={values.campusId} required />
                <Error name="spaceId" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Follow-Up Due Date
                </label>
                <Field type="date" name="followUpDueAt" className={field} />
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
              <FieldArray name="checklist">
                {({ push, remove }) => (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Safety & Quality Criteria ({values.checklist.length})
                      </h4>
                      <CustomButton
                        type="button"
                        variant="secondary"
                        onClick={() => push({ item: '', passed: true, note: '' })}
                        className="py-1! text-xs!"
                      >
                        + Add Check Criterion
                      </CustomButton>
                    </div>

                    {values.checklist.map((_, i) => (
                      <div
                        key={i}
                        className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 "
                      >
                        <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                          <div>
                            <Field
                              name={`checklist.${i}.item`}
                              placeholder="Inspection criterion (e.g. Fire extinguisher pressure ok)"
                              className={field}
                            />
                            <Error name={`checklist.${i}.item`} />
                          </div>
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                              <Field
                                type="checkbox"
                                name={`checklist.${i}.passed`}
                                className="h-4 w-4 text-primary rounded"
                              />
                              Passed
                            </label>
                            {values.checklist.length > 1 && (
                              <button
                                type="button"
                                onClick={() => remove(i)}
                                className="text-xs font-medium text-red-500 hover:underline"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                        <Field
                          name={`checklist.${i}.note`}
                          placeholder="Optional inspector finding or defect note..."
                          className={field}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </FieldArray>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <CustomButton variant="tertiary" type="button" onClick={close}>
                Cancel
              </CustomButton>
              <CustomButton type="submit" loading={loading}>
                Record Audit Inspection
              </CustomButton>
            </div>
          </Form>
        )}
      </Formik>
    </Shell>
  );
}

function TransitionForm({
  item,
  canManage,
  loading,
  close,
  submit,
}: {
  item: WorkOrder;
  canManage: boolean;
  loading: boolean;
  close: () => void;
  submit: (v: Record<string, unknown>) => Promise<void>;
}) {
  const managerOptions: Record<string, string[]> = {
    open: ['assigned', 'cancelled'],
    assigned: ['in_progress', 'cancelled'],
    in_progress: ['on_hold', 'completed'],
    on_hold: ['in_progress', 'cancelled'],
  };
  const workerOptions: Record<string, string[]> = {
    assigned: ['in_progress'],
    in_progress: ['on_hold', 'completed'],
    on_hold: ['in_progress'],
  };
  const options = canManage ? managerOptions : workerOptions;

  return (
    <Shell title={`Update Work Order: ${item.number}`} close={close}>
      <Formik
        initialValues={{
          status: options[item.status]?.[0] ?? '',
          resolution: '',
          laborCost: 0,
          materialCost: 0,
        }}
        validationSchema={Yup.object({
          status: Yup.string().required('Target status is required'),
          resolution: Yup.string().when('status', {
            is: 'completed',
            then: (s) =>
              s
                .trim()
                .min(5, 'Resolution summary is required to complete ticket')
                .required('Resolution summary is required'),
          }),
        })}
        onSubmit={submit}
      >
        {({ values }) => (
          <Form className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Next Status *</label>
              <Field as="select" name="status" className={field}>
                {(options[item.status] ?? []).map((v) => (
                  <option key={v} value={v}>
                    {v.replace(/_/g, ' ').toUpperCase()}
                  </option>
                ))}
              </Field>
            </div>

            {values.status === 'completed' && (
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Resolution Summary *
                  </label>
                  <Field
                    as="textarea"
                    rows={3}
                    name="resolution"
                    placeholder="Explain repair actions taken, parts replaced, or testing results..."
                    className={field}
                  />
                  <Error name="resolution" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Labor Cost (₹)
                    </label>
                    <Field type="number" name="laborCost" className={field} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Material Cost (₹)
                    </label>
                    <Field type="number" name="materialCost" className={field} />
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <CustomButton variant="tertiary" type="button" onClick={close}>
                Cancel
              </CustomButton>
              <CustomButton type="submit" loading={loading}>
                Update Work Order
              </CustomButton>
            </div>
          </Form>
        )}
      </Formik>
    </Shell>
  );
}

export default UseProtectedRoutes(FacilitiesPage);
