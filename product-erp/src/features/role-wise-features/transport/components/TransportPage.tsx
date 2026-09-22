'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import {
  Bus,
  CalendarClock,
  IndianRupee,
  Edit2,
  LocateFixed,
  MapPin,
  Navigation,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react';
import { AnimatePresence, motion } from '@/shared/utils/motion';
import AsyncSelect from '@/shared/core/AsyncSelect';
import CustomButton from '@/shared/core/CustomButton';
import Empty from '@/shared/core/Empty';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import { useAuthStore } from '@/shared/store/authStore';
import { useSocket } from '@/shared/hooks/useSocket';
import type { IBusRoute } from '../types/transport.types';
import LiveTransportMap, { type ILiveBus } from './LiveTransportMap';

type Tab = 'routes' | 'drivers' | 'allocations' | 'fees' | 'tracking';
type Stop = IBusRoute['stops'][number];
type Populated = {
  _id?: string;
  name?: string;
  rollNo?: string;
  routeNo?: string;
  routeName?: string;
};
interface Driver {
  _id: string;
  name: string;
  phone: string;
  licenseNo: string;
  licenseExpiry: string;
  experience: number;
  address?: string;
  assignedRoute?: string | Populated;
  isActive: boolean;
}
interface Allocation {
  _id: string;
  studentId: string | Populated;
  routeId: string | Populated;
  stopName: string;
  academicYear: string;
  monthlyFee: number;
  status: 'active' | 'cancelled';
}
interface Fee {
  _id: string;
  allocationId: string | Allocation;
  studentId: string | Populated;
  academicYear: string;
  month: string;
  totalDue: number;
  paidAmount: number;
  dueDate: string;
  status: 'unpaid' | 'partial' | 'paid' | 'overdue';
  payments: Array<{ receiptNo: string; amount: number; paidDate: string }>;
}

const field =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10';
const label = 'mb-1 block text-xs font-semibold text-slate-600';
const unwrap = <T,>(raw: unknown): T[] => {
  const response = raw as { data?: T[] | { data?: T[] } } | undefined;
  return Array.isArray(response?.data) ? response.data : (response?.data?.data ?? []);
};
const idOf = (value: string | Populated) => (typeof value === 'string' ? value : (value._id ?? ''));
const nameOf = (value: string | Populated) =>
  typeof value === 'string' ? value : (value.name ?? value.routeName ?? '—');
const money = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);

function Modal({
  title,
  subtitle,
  children,
  onClose,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-200/80 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 "
      >
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <p className="mb-5 mt-1 text-sm text-slate-500">{subtitle}</p>
        {children}
        <button type="button" onClick={onClose} className="sr-only">
          Close
        </button>
      </motion.div>
    </div>
  );
}

function RouteForm({
  route,
  drivers,
  onClose,
  onSaved,
}: {
  route?: IBusRoute;
  drivers: Driver[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mutation, isLoading } = useMutation();
  const [stops, setStops] = useState<Stop[]>(
    route?.stops.length ? route.stops : [{ stopName: '', stopTime: '', fareFromOrigin: 0 }],
  );
  const form = useFormik({
    initialValues: {
      routeNo: route?.routeNo ?? '',
      routeName: route?.routeName ?? '',
      driverName: route?.driverName ?? '',
      driverPhone: route?.driverPhone ?? '',
      vehicleNo: route?.vehicleNo ?? '',
      vehicleType: route?.vehicleType ?? 'Bus',
      capacity: route?.capacity ?? 40,
      isActive: route?.isActive ?? true,
    },
    validationSchema: Yup.object({
      routeNo: Yup.string().required('Route number is required'),
      routeName: Yup.string().required('Route name is required'),
      driverName: Yup.string().required('Driver name is required'),
      driverPhone: Yup.string().min(7).required('Driver phone is required'),
      vehicleNo: Yup.string().required('Vehicle number is required'),
      vehicleType: Yup.string().required('Vehicle type is required'),
      capacity: Yup.number().min(1).max(200).required(),
    }),
    onSubmit: async (values) => {
      if (stops.some((stop) => !stop.stopName || !stop.stopTime || stop.fareFromOrigin < 0)) {
        toast.error('Complete the name, pickup time and monthly fee for every stop');
        return;
      }
      const result = await mutation(route ? `transport/routes/${route._id}` : 'transport/routes', {
        method: route ? 'PUT' : 'POST',
        body: { ...values, stops },
        isAlert: true,
      });
      if (result) {
        onSaved();
        onClose();
      }
    },
  });
  const updateStop = (index: number, key: keyof Stop, value: string | number) =>
    setStops((current) =>
      current.map((stop, stopIndex) => (stopIndex === index ? { ...stop, [key]: value } : stop)),
    );
  return (
    <Modal
      title={route ? 'Edit route' : 'Create a transport route'}
      subtitle="Add stops in travel order. The selected stop fee is applied automatically during student allocation."
      onClose={onClose}
    >
      <form onSubmit={form.handleSubmit} className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ['routeNo', 'Route number', 'R-01'],
            ['routeName', 'Route name', 'North City'],
            ['vehicleNo', 'Vehicle number', 'KA 01 AB 1234'],
            ['vehicleType', 'Vehicle type', 'Bus / Van'],
          ].map(([key, text, placeholder]) => (
            <div key={key}>
              <label className={label}>{text} *</label>
              <input className={field} placeholder={placeholder} {...form.getFieldProps(key)} />
            </div>
          ))}
          <div>
            <label className={label}>Driver *</label>
            <select
              className={field}
              value={`${form.values.driverName}|${form.values.driverPhone}`}
              onChange={(event) => {
                const selected = drivers.find(
                  (driver) => `${driver.name}|${driver.phone}` === event.target.value,
                );
                form.setFieldValue('driverName', selected?.name ?? '');
                form.setFieldValue('driverPhone', selected?.phone ?? '');
              }}
            >
              <option value="|">Select an active driver</option>
              {drivers
                .filter((driver) => driver.isActive)
                .map((driver) => (
                  <option key={driver._id} value={`${driver.name}|${driver.phone}`}>
                    {driver.name} · {driver.phone}
                  </option>
                ))}
            </select>
            {drivers.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">
                Add a driver in step 1 before creating a route.
              </p>
            )}
          </div>
          <div>
            <label className={label}>Passenger capacity *</label>
            <input
              type="number"
              min={1}
              max={200}
              className={field}
              {...form.getFieldProps('capacity')}
            />
          </div>
          <label className="flex items-center gap-2 pt-6 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.values.isActive}
              onChange={(event) => form.setFieldValue('isActive', event.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Route is active
          </label>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Pickup stops</h3>
              <p className="text-xs text-slate-500">Listed in the order the vehicle travels.</p>
            </div>
            <CustomButton
              variant="tertiary"
              onClick={() =>
                setStops((current) => [
                  ...current,
                  { stopName: '', stopTime: '', fareFromOrigin: 0 },
                ])
              }
              startIcon={<Plus className="h-4 w-4" />}
            >
              Add stop
            </CustomButton>
          </div>
          <div className="space-y-2">
            {stops.map((stop, index) => (
              <div
                key={index}
                className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_130px_150px_auto]"
              >
                <input
                  aria-label={`Stop ${index + 1} name`}
                  className={field}
                  value={stop.stopName}
                  onChange={(event) => updateStop(index, 'stopName', event.target.value)}
                  placeholder={`Stop ${index + 1} name`}
                />
                <input
                  aria-label={`Stop ${index + 1} time`}
                  type="time"
                  className={field}
                  value={stop.stopTime}
                  onChange={(event) => updateStop(index, 'stopTime', event.target.value)}
                />
                <input
                  aria-label={`Stop ${index + 1} monthly fee`}
                  type="number"
                  min={0}
                  className={field}
                  value={stop.fareFromOrigin}
                  onChange={(event) =>
                    updateStop(index, 'fareFromOrigin', Number(event.target.value))
                  }
                  placeholder="Monthly fee"
                />
                <button
                  type="button"
                  disabled={stops.length === 1}
                  onClick={() => setStops((current) => current.filter((_, i) => i !== index))}
                  className="px-2 text-xs font-medium text-red-500 disabled:opacity-30"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <CustomButton variant="cancel" onClick={onClose}>
            Cancel
          </CustomButton>
          <CustomButton type="submit" loading={isLoading}>
            {route ? 'Save route' : 'Create route'}
          </CustomButton>
        </div>
      </form>
    </Modal>
  );
}

function DriverForm({
  driver,
  routes,
  onClose,
  onSaved,
}: {
  driver?: Driver;
  routes: IBusRoute[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mutation, isLoading } = useMutation();
  const form = useFormik({
    initialValues: {
      name: driver?.name ?? '',
      phone: driver?.phone ?? '',
      licenseNo: driver?.licenseNo ?? '',
      licenseExpiry: driver?.licenseExpiry?.slice(0, 10) ?? '',
      experience: driver?.experience ?? 0,
      address: driver?.address ?? '',
      assignedRoute: driver?.assignedRoute ? idOf(driver.assignedRoute) : '',
      isActive: driver?.isActive ?? true,
    },
    validationSchema: Yup.object({
      name: Yup.string().required(),
      phone: Yup.string().min(7).required(),
      licenseNo: Yup.string().required(),
      licenseExpiry: Yup.date().min(new Date(), 'Licence must be valid').required(),
    }),
    onSubmit: async (values) => {
      const body = { ...values, assignedRoute: values.assignedRoute || null };
      const result = await mutation(
        driver ? `transport/drivers/${driver._id}` : 'transport/drivers',
        {
          method: driver ? 'PUT' : 'POST',
          body,
          isAlert: true,
        },
      );
      if (result) {
        onSaved();
        onClose();
      }
    },
  });
  return (
    <Modal
      title={driver ? 'Edit driver' : 'Add a driver'}
      subtitle="Keep licence and route assignment current so operations remain safe."
      onClose={onClose}
    >
      <form onSubmit={form.handleSubmit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={label}>Full name *</label>
            <input className={field} {...form.getFieldProps('name')} />
          </div>
          <div>
            <label className={label}>Phone *</label>
            <input className={field} {...form.getFieldProps('phone')} />
          </div>
          <div>
            <label className={label}>Licence number *</label>
            <input className={field} {...form.getFieldProps('licenseNo')} />
          </div>
          <div>
            <label className={label}>Licence expiry *</label>
            <input type="date" className={field} {...form.getFieldProps('licenseExpiry')} />
          </div>
          <div>
            <label className={label}>Experience (years)</label>
            <input type="number" min={0} className={field} {...form.getFieldProps('experience')} />
          </div>
          <div>
            <label className={label}>Assigned route</label>
            <select className={field} {...form.getFieldProps('assignedRoute')}>
              <option value="">Not assigned</option>
              {routes
                .filter((route) => route.isActive)
                .map((route) => (
                  <option key={route._id} value={route._id}>
                    {route.routeNo} · {route.routeName}
                  </option>
                ))}
            </select>
          </div>
        </div>
        <div>
          <label className={label}>Address</label>
          <textarea className={field} rows={2} {...form.getFieldProps('address')} />
        </div>
        {driver && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.values.isActive}
              onChange={(event) => form.setFieldValue('isActive', event.target.checked)}
            />{' '}
            Active driver
          </label>
        )}
        <div className="flex justify-end gap-2">
          <CustomButton variant="cancel" onClick={onClose}>
            Cancel
          </CustomButton>
          <CustomButton type="submit" loading={isLoading}>
            Save driver
          </CustomButton>
        </div>
      </form>
    </Modal>
  );
}

function AllocationForm({
  routes,
  onClose,
  onSaved,
}: {
  routes: IBusRoute[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mutation, isLoading } = useMutation();
  const form = useFormik({
    initialValues: { studentId: '', routeId: '', stopName: '', academicYear: '' },
    validationSchema: Yup.object({
      studentId: Yup.string().required(),
      routeId: Yup.string().required(),
      stopName: Yup.string().required(),
      academicYear: Yup.string().required(),
    }),
    onSubmit: async (values) => {
      const result = await mutation('transport/allocations', {
        method: 'POST',
        body: values,
        isAlert: true,
      });
      if (result) {
        onSaved();
        onClose();
      }
    },
  });
  const route = routes.find((item) => item._id === form.values.routeId);
  return (
    <Modal
      title="Allocate transport"
      subtitle="Choose the student, route and pickup stop. The monthly fee comes from the route automatically."
      onClose={onClose}
    >
      <form onSubmit={form.handleSubmit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <AsyncSelect
            type="students"
            label="Student"
            required
            value={form.values.studentId || null}
            onChange={(value) => form.setFieldValue('studentId', value ?? '')}
            placeholder="Search students"
          />
          <AsyncSelect
            type="academicYears"
            label="Academic year"
            required
            value={form.values.academicYear || null}
            onChange={(value) => form.setFieldValue('academicYear', value ?? '')}
            placeholder="Select academic year"
          />
          <div>
            <label className={label}>Route *</label>
            <select
              className={field}
              value={form.values.routeId}
              onChange={(event) => {
                form.setFieldValue('routeId', event.target.value);
                form.setFieldValue('stopName', '');
              }}
            >
              <option value="">Select route</option>
              {routes
                .filter((item) => item.isActive && item.occupiedCount < item.capacity)
                .map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.routeNo} · {item.routeName} ({item.capacity - item.occupiedCount} seats)
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className={label}>Pickup stop *</label>
            <select className={field} disabled={!route} {...form.getFieldProps('stopName')}>
              <option value="">Select stop</option>
              {route?.stops.map((stop) => (
                <option key={stop.stopName} value={stop.stopName}>
                  {stop.stopTime} · {stop.stopName} · {money(stop.fareFromOrigin)}/month
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <CustomButton variant="cancel" onClick={onClose}>
            Cancel
          </CustomButton>
          <CustomButton type="submit" loading={isLoading}>
            Allocate seat
          </CustomButton>
        </div>
      </form>
    </Modal>
  );
}

function FeeForm({
  allocations,
  onClose,
  onSaved,
}: {
  allocations: Allocation[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mutation, isLoading } = useMutation();
  const form = useFormik({
    initialValues: { allocationId: '', month: '', dueDate: '' },
    onSubmit: async (values) => {
      const result = await mutation('transport/fees', {
        method: 'POST',
        body: values,
        isAlert: true,
      });
      if (result) {
        onSaved();
        onClose();
      }
    },
  });
  return (
    <Modal
      title="Generate monthly transport fee"
      subtitle="The amount is taken from the student’s selected pickup stop; no manual amount entry is needed."
      onClose={onClose}
    >
      <form onSubmit={form.handleSubmit} className="space-y-4">
        <div>
          <label className={label}>Active allocation *</label>
          <select required className={field} {...form.getFieldProps('allocationId')}>
            <option value="">Select student allocation</option>
            {allocations
              .filter((item) => item.status === 'active')
              .map((item) => (
                <option key={item._id} value={item._id}>
                  {nameOf(item.studentId)} · {item.stopName} · {money(item.monthlyFee)}
                </option>
              ))}
          </select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={label}>Fee month *</label>
            <input required type="month" className={field} {...form.getFieldProps('month')} />
          </div>
          <div>
            <label className={label}>Due date *</label>
            <input required type="date" className={field} {...form.getFieldProps('dueDate')} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <CustomButton variant="cancel" onClick={onClose}>
            Cancel
          </CustomButton>
          <CustomButton type="submit" loading={isLoading}>
            Generate fee
          </CustomButton>
        </div>
      </form>
    </Modal>
  );
}

function PaymentForm({
  fee,
  onClose,
  onSaved,
}: {
  fee: Fee;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mutation, isLoading } = useMutation();
  const remaining = fee.totalDue - fee.paidAmount;
  const form = useFormik({
    initialValues: { amount: remaining, paymentMode: 'upi' },
    onSubmit: async (values) => {
      const result = await mutation(`transport/fees/${fee._id}/payments`, {
        method: 'POST',
        body: values,
        isAlert: true,
      });
      if (result) {
        toast.success('Payment recorded and receipt generated');
        onSaved();
        onClose();
      }
    },
  });
  return (
    <Modal
      title="Record transport payment"
      subtitle={`Remaining balance: ${money(remaining)}. A receipt and ledger entry are generated automatically.`}
      onClose={onClose}
    >
      <form onSubmit={form.handleSubmit} className="space-y-4">
        <div>
          <label className={label}>Amount received *</label>
          <input
            type="number"
            min={0.01}
            max={remaining}
            step="0.01"
            className={field}
            {...form.getFieldProps('amount')}
          />
        </div>
        <div>
          <label className={label}>Payment mode *</label>
          <select className={field} {...form.getFieldProps('paymentMode')}>
            <option value="upi">UPI</option>
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="cheque">Cheque</option>
            <option value="dd">Demand draft</option>
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <CustomButton variant="cancel" onClick={onClose}>
            Cancel
          </CustomButton>
          <CustomButton type="submit" loading={isLoading}>
            Confirm payment
          </CustomButton>
        </div>
      </form>
    </Modal>
  );
}

export default function TransportPage() {
  const activeRole = useAuthStore(
    (state) => state.activeRole?.baseRole ?? state.activeRole?.name ?? state.role,
  );
  const canView = useHasPermission('transport', 'view');
  const canCreate = useHasPermission('transport', 'create');
  const canEdit = useHasPermission('transport', 'edit');
  const canDelete = useHasPermission('transport', 'delete');
  const canManage =
    ['super_admin', 'admin', 'principal', 'administration_office', 'transportation'].includes(
      activeRole ?? '',
    ) &&
    (canCreate || canEdit || canDelete);
  const [tab, setTab] = useState<Tab>('routes');
  const [routeEdit, setRouteEdit] = useState<IBusRoute | null | undefined>();
  const [driverEdit, setDriverEdit] = useState<Driver | null | undefined>();
  const [allocationOpen, setAllocationOpen] = useState(false);
  const [feeOpen, setFeeOpen] = useState(false);
  const [payment, setPayment] = useState<Fee>();
  const routesQuery = useSwr(canView ? 'transport/routes?limit=200' : null);
  const driversQuery = useSwr(canManage ? 'transport/drivers?limit=200' : null);
  const allocationsQuery = useSwr(
    canManage ? 'transport/allocations?limit=500' : 'transport/allocations/my',
  );
  const feesQuery = useSwr(canView ? 'transport/fees?limit=500' : null);
  const routes = unwrap<IBusRoute>(routesQuery.data);
  const drivers = unwrap<Driver>(driversQuery.data);
  const allocations = canManage
    ? unwrap<Allocation>(allocationsQuery.data)
    : (allocationsQuery.data as { data?: Allocation } | undefined)?.data
      ? [(allocationsQuery.data as { data: Allocation }).data]
      : [];
  const fees = unwrap<Fee>(feesQuery.data);
  const { mutation } = useMutation();

  if (!canView) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Transport access unavailable</h1>
        <p className="mt-2 text-sm text-slate-500">
          Your active role cannot view transport services.
        </p>
      </div>
    );
  }

  const pageError = routesQuery.error ?? allocationsQuery.error ?? feesQuery.error;
  if (pageError) {
    return (
      <div className="rounded-2xl border border-red-100 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">
          Transport services could not be loaded
        </h1>
        <p className="mt-2 text-sm text-red-600">{pageError.message}</p>
        <CustomButton
          className="mx-auto mt-4 w-fit!"
          onClick={() => {
            void routesQuery.mutate();
            void allocationsQuery.mutate();
            void feesQuery.mutate();
          }}
        >
          Try again
        </CustomButton>
      </div>
    );
  }

  const cancelAllocation = async (item: Allocation) => {
    const confirm = await Swal.fire({
      title: 'Cancel this allocation?',
      text: 'The seat will become available again.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Cancel allocation',
    });
    if (!confirm.isConfirmed) return;
    if (
      await mutation(`transport/allocations/${item._id}/cancel`, { method: 'PUT', isAlert: true })
    )
      allocationsQuery.mutate();
  };
  const deactivateDriver = async (driver: Driver) => {
    const confirm = await Swal.fire({
      title: 'Deactivate driver?',
      text: 'Unassign the route first if one is currently assigned.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Deactivate',
    });
    if (!confirm.isConfirmed) return;
    if (
      await mutation(`transport/drivers/${driver._id}`, {
        method: 'PUT',
        body: { assignedRoute: null, isActive: false },
        isAlert: true,
      })
    )
      driversQuery.mutate();
  };

  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode }> = canManage
    ? [
        { id: 'drivers', label: '1. Drivers', icon: <UserCheck className="h-4 w-4" /> },
        { id: 'routes', label: '2. Routes & stops', icon: <MapPin className="h-4 w-4" /> },
        { id: 'allocations', label: '3. Student allocation', icon: <Users className="h-4 w-4" /> },
        { id: 'fees', label: '4. Fees', icon: <IndianRupee className="h-4 w-4" /> },
        { id: 'tracking', label: '5. Live tracking', icon: <Navigation className="h-4 w-4" /> },
      ]
    : [
        { id: 'routes', label: 'Routes & stops', icon: <MapPin className="h-4 w-4" /> },
        { id: 'allocations', label: 'My allocation', icon: <Users className="h-4 w-4" /> },
        { id: 'fees', label: 'My fees', icon: <IndianRupee className="h-4 w-4" /> },
        { id: 'tracking', label: 'Live tracking', icon: <Navigation className="h-4 w-4" /> },
      ];
  const action =
    tab === 'routes'
      ? () => setRouteEdit(null)
      : tab === 'drivers'
        ? () => setDriverEdit(null)
        : tab === 'allocations'
          ? () => setAllocationOpen(true)
          : tab === 'fees'
            ? () => setFeeOpen(true)
            : undefined;
  const actionLabel =
    tab === 'routes'
      ? 'Create route'
      : tab === 'drivers'
        ? 'Add driver'
        : tab === 'allocations'
          ? 'Allocate student'
          : tab === 'fees'
            ? 'Generate fee'
            : '';

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Transport operations</h1>
          <p className="mt-1 text-sm text-slate-500">
            Set up each step in order, then monitor vehicles from one live workspace.
          </p>
        </div>
        {canCreate && action && (
          <CustomButton onClick={action} startIcon={<Plus className="h-4 w-4" />}>
            {actionLabel}
          </CustomButton>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            ['Active routes', routes.filter((r) => r.isActive).length, Bus],
            ['Allocated students', allocations.filter((a) => a.status === 'active').length, Users],
            ['Active drivers', drivers.filter((d) => d.isActive).length, UserCheck],
            ['Outstanding fees', fees.filter((f) => f.status !== 'paid').length, CalendarClock],
          ] as const
        ).map(([text, value, Icon]) => (
          <div key={String(text)} className="flex items-center gap-3 rounded-xl bg-white p-4">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">{String(text)}</p>
              <p className="text-xl font-bold text-slate-900">{String(value)}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl bg-slate-100 p-1">
        <div className="flex min-w-max gap-1">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold ${tab === item.id ? 'bg-white text-primary ' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'routes' && (
        <section className="rounded-2xl bg-white p-4">
          <div className="mb-4">
            <h2 className="font-bold text-slate-900">Routes and pickup stops</h2>
            <p className="text-sm text-slate-500">
              Capacity, timings and stop fees are the foundation for every later step.
            </p>
          </div>
          {routes.length === 0 ? (
            <Empty
              title="No transport routes yet"
              subTitle="Create the first route with pickup times and monthly fees."
              pathName={canCreate ? 'Create first route' : undefined}
              onClick={canCreate ? () => setRouteEdit(null) : undefined}
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {routes.map((route) => (
                <div
                  key={route._id}
                  className="grid gap-3 py-4 lg:grid-cols-[1.3fr_1fr_1fr_auto] lg:items-center"
                >
                  <div>
                    <p className="font-semibold text-slate-900">
                      {route.routeNo} · {route.routeName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {route.stops.map((stop) => stop.stopName).join(' → ')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600">Vehicle & driver</p>
                    <p className="text-sm text-slate-700">
                      {route.vehicleNo} · {route.driverName}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600">Seats</p>
                    <p className="text-sm text-slate-700">
                      {route.occupiedCount} / {route.capacity} occupied
                    </p>
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => setRouteEdit(route)}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-primary"
                    >
                      <Edit2 className="h-4 w-4" /> Edit
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      {tab === 'drivers' && (
        <section className="rounded-2xl bg-white p-4">
          <h2 className="font-bold text-slate-900">Drivers and assignments</h2>
          <p className="mb-4 text-sm text-slate-500">
            One driver record, one route assignment—no duplicate driver entry.
          </p>
          {drivers.length === 0 ? (
            <Empty
              title="No drivers added"
              subTitle="Add verified driver and licence details before assigning a route."
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {drivers.map((driver) => (
                <div
                  key={driver._id}
                  className="grid gap-3 py-4 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-center"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{driver.name}</p>
                    <p className="text-xs text-slate-500">{driver.phone}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600">Licence</p>
                    <p className="text-sm">
                      {driver.licenseNo} · expires{' '}
                      {new Date(driver.licenseExpiry).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600">Assigned route</p>
                    <p className="text-sm">
                      {driver.assignedRoute ? nameOf(driver.assignedRoute) : 'Not assigned'}
                    </p>
                  </div>
                  {canEdit && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => setDriverEdit(driver)}
                        className="text-sm font-semibold text-primary"
                      >
                        Edit
                      </button>
                      {driver.isActive && (
                        <button
                          onClick={() => deactivateDriver(driver)}
                          className="text-sm font-semibold text-red-500"
                        >
                          Deactivate
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      {tab === 'allocations' && (
        <section className="rounded-2xl bg-white p-4">
          <h2 className="font-bold text-slate-900">Student transport allocation</h2>
          <p className="mb-4 text-sm text-slate-500">
            The pickup stop determines the monthly fee and reserves one route seat.
          </p>
          {allocations.length === 0 ? (
            <Empty
              title="No transport allocations"
              subTitle="Allocate an active student to an available route and pickup stop."
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {allocations.map((item) => (
                <div
                  key={item._id}
                  className="grid gap-3 py-4 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-center"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{nameOf(item.studentId)}</p>
                    <p className="text-xs text-slate-500">
                      {typeof item.studentId === 'object' ? item.studentId.rollNo : ''}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600">Route & stop</p>
                    <p className="text-sm">
                      {nameOf(item.routeId)} · {item.stopName}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600">Academic year & fee</p>
                    <p className="text-sm">
                      {item.academicYear} · {money(item.monthlyFee)}/month
                    </p>
                  </div>
                  {canEdit && item.status === 'active' && (
                    <button
                      onClick={() => cancelAllocation(item)}
                      className="text-sm font-semibold text-red-500"
                    >
                      Cancel allocation
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      {tab === 'fees' && (
        <section className="rounded-2xl bg-white p-4">
          <h2 className="font-bold text-slate-900">Transport fees and receipts</h2>
          <p className="mb-4 text-sm text-slate-500">
            Generate monthly dues, collect payments, and track balances without manual fee entry.
          </p>
          {fees.length === 0 ? (
            <Empty
              title="No transport fees generated"
              subTitle="Generate the first monthly fee from an active allocation."
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {fees.map((item) => (
                <div
                  key={item._id}
                  className="grid gap-3 py-4 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-center"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{nameOf(item.studentId)}</p>
                    <p className="text-xs text-slate-500">
                      {item.month} · due {new Date(item.dueDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600">Paid</p>
                    <p className="text-sm">
                      {money(item.paidAmount)} of {money(item.totalDue)}
                    </p>
                  </div>
                  <div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === 'paid' ? 'bg-green-50 text-green-700' : item.status === 'overdue' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}
                    >
                      {item.status}
                    </span>
                    {item.payments.at(-1)?.receiptNo && (
                      <p className="mt-1 text-xs text-slate-600">
                        Receipt {item.payments.at(-1)?.receiptNo}
                      </p>
                    )}
                  </div>
                  {canCreate && item.status !== 'paid' && (
                    <button
                      onClick={() => setPayment(item)}
                      className="text-sm font-semibold text-primary"
                    >
                      Record payment
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      {tab === 'tracking' && <TrackingPanel routes={routes} canManage={canCreate} />}

      <AnimatePresence>
        {routeEdit !== undefined && (
          <RouteForm
            route={routeEdit ?? undefined}
            drivers={drivers}
            onClose={() => setRouteEdit(undefined)}
            onSaved={routesQuery.mutate}
          />
        )}
        {driverEdit !== undefined && (
          <DriverForm
            driver={driverEdit ?? undefined}
            routes={routes}
            onClose={() => setDriverEdit(undefined)}
            onSaved={driversQuery.mutate}
          />
        )}
        {allocationOpen && (
          <AllocationForm
            routes={routes}
            onClose={() => setAllocationOpen(false)}
            onSaved={() => {
              allocationsQuery.mutate();
              routesQuery.mutate();
            }}
          />
        )}
        {feeOpen && (
          <FeeForm
            allocations={allocations}
            onClose={() => setFeeOpen(false)}
            onSaved={feesQuery.mutate}
          />
        )}
        {payment && (
          <PaymentForm
            fee={payment}
            onClose={() => setPayment(undefined)}
            onSaved={feesQuery.mutate}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function TrackingPanel({ routes, canManage }: { routes: IBusRoute[]; canManage: boolean }) {
  const query = useSwr<{ data?: ILiveBus[] }>('transport/gps/live', { refreshInterval: 60000 });
  const [buses, setBuses] = useState<ILiveBus[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [shareRoute, setShareRoute] = useState('');
  const [sharing, setSharing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [lastPos, setLastPos] = useState<{
    lat: number;
    lng: number;
    speed: number;
    updatedAt: Date;
  } | null>(null);
  const [now, setNow] = useState(0);
  const watchId = useRef<number | undefined>(undefined);
  const sessionId = useRef<string | undefined>(undefined);
  const lastSentTime = useRef<number>(0);
  const { mutation } = useMutation();
  const { socket, isConnected } = useSocket();
  const selectBus = useCallback((id: string) => setSelectedId(id), []);
  const selected = buses.find((bus) => bus._id === selectedId);

  useEffect(() => {
    // SWR is an external cache; copy refreshed snapshots into the live socket-backed list.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (query.data?.data) setBuses(query.data.data);
  }, [query.data]);

  useEffect(() => {
    if (!socket) return;
    const onPosition = (bus: ILiveBus) => {
      setBuses((current) => {
        const found = current.some((item) => item._id === bus._id);
        return found
          ? current.map((item) => (item._id === bus._id ? bus : item))
          : [...current, bus].sort((a, b) => a.routeNo.localeCompare(b.routeNo));
      });
    };
    const subscribe = () => socket.emit('subscribe_transport');
    socket.on('transport_position', onPosition);
    socket.on('connect', subscribe);
    subscribe();
    return () => {
      socket.off('transport_position', onPosition);
      socket.off('connect', subscribe);
    };
  }, [socket]);

  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const interval = window.setInterval(update, 15000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      if (
        watchId.current !== undefined &&
        typeof navigator !== 'undefined' &&
        navigator.geolocation
      ) {
        navigator.geolocation.clearWatch(watchId.current);
      }
      if (sessionId.current) {
        void mutation(`transport/tracking/sessions/${sessionId.current}`, {
          method: 'DELETE',
          isAlert: false,
          dedupe: false,
        });
      }
    };
  }, [mutation]);

  const handleGeoError = useCallback(
    (error: GeolocationPositionError) => {
      if (
        watchId.current !== undefined &&
        typeof navigator !== 'undefined' &&
        navigator.geolocation
      ) {
        navigator.geolocation.clearWatch(watchId.current);
      }
      watchId.current = undefined;
      const activeSessionId = sessionId.current;
      sessionId.current = undefined;
      if (activeSessionId) {
        void mutation(`transport/tracking/sessions/${activeSessionId}`, {
          method: 'DELETE',
          isAlert: false,
          dedupe: false,
        });
      }
      setSharing(false);
      setStarting(false);

      let message = 'Unable to access device location.';
      if (error.code === error.PERMISSION_DENIED) {
        message =
          'Location permission was denied by your browser. Please allow location access in your browser settings and try again.';
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        message =
          'Location position unavailable. Please ensure GPS / Location Services are turned ON on your device.';
      } else if (error.code === error.TIMEOUT) {
        message = 'Location request timed out. Please check your GPS signal and try again.';
      }
      setGeoError(message);
      toast.error(message);
    },
    [mutation],
  );

  const sendPosition = useCallback(
    async (position: GeolocationPosition, trackingSessionId: string) => {
      const nowMs = Date.now();
      // Throttle API posts to once every 3 seconds
      if (nowMs - lastSentTime.current < 3000) return;
      lastSentTime.current = nowMs;

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const speed = Math.round(Math.max(0, (position.coords.speed ?? 0) * 3.6));
      setLastPos({ lat, lng, speed, updatedAt: new Date() });

      await mutation(`transport/tracking/sessions/${trackingSessionId}/positions`, {
        method: 'POST',
        body: {
          lat,
          lng,
          speed,
          heading: position.coords.heading ?? undefined,
          accuracy: position.coords.accuracy,
          recordedAt: new Date(position.timestamp).toISOString(),
        },
        isAlert: false,
        dedupe: false,
      });
    },
    [mutation],
  );

  const stopSharing = useCallback(async () => {
    if (
      watchId.current !== undefined &&
      typeof navigator !== 'undefined' &&
      navigator.geolocation
    ) {
      navigator.geolocation.clearWatch(watchId.current);
    }
    watchId.current = undefined;
    const activeSessionId = sessionId.current;
    sessionId.current = undefined;
    if (activeSessionId) {
      await mutation(`transport/tracking/sessions/${activeSessionId}`, {
        method: 'DELETE',
        isAlert: false,
        dedupe: false,
      });
    }
    setSharing(false);
    setStarting(false);
    setLastPos(null);
  }, [mutation]);

  const shareLocation = () => {
    setGeoError(null);
    if (sharing || starting) {
      void stopSharing().then(() => toast.info('Live location sharing stopped'));
      return;
    }

    if (!shareRoute) {
      toast.error('Select an active route first');
      return;
    }

    if (typeof window !== 'undefined' && !navigator.geolocation) {
      toast.error('Geolocation is not supported by this browser');
      return;
    }

    if (
      typeof window !== 'undefined' &&
      !window.isSecureContext &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      const msg =
        'Browser Security Error: Live geolocation sharing requires HTTPS or localhost access.';
      setGeoError(msg);
      toast.error(msg);
      return;
    }

    setStarting(true);
    toast.info('Requesting location permission...');

    // Request initial position fix first to verify permission and GPS availability
    navigator.geolocation.getCurrentPosition(
      async (initialPosition) => {
        const started = await mutation('transport/tracking/sessions', {
          method: 'POST',
          body: { routeId: shareRoute },
          isAlert: false,
          dedupe: false,
        });
        const trackingSessionId = started?.results?.data?._id as string | undefined;
        if (!trackingSessionId) {
          setStarting(false);
          return;
        }
        sessionId.current = trackingSessionId;
        setStarting(false);
        setSharing(true);
        toast.success('Secure live tracking started');
        await sendPosition(initialPosition, trackingSessionId);

        // Start continuous position watch
        watchId.current = navigator.geolocation.watchPosition(
          (pos) => void sendPosition(pos, trackingSessionId),
          handleGeoError,
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 },
        );
      },
      handleGeoError,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );
  };

  return (
    <section className="space-y-4">
      <div className="rounded-2xl bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-bold text-slate-900">
              <LocateFixed className="h-5 w-5 text-primary" /> Live vehicle map
            </h2>
            <p className="text-sm text-slate-500">
              {isConnected
                ? 'Connected live. Vehicle positions update instantly.'
                : 'Reconnecting live updates; the map will recover automatically.'}
            </p>
          </div>
          <CustomButton
            variant="tertiary"
            onClick={() => query.mutate()}
            startIcon={<RefreshCw className="h-4 w-4" />}
          >
            Refresh
          </CustomButton>
        </div>

        {canManage && (
          <div className="mt-4 flex flex-col gap-3 rounded-xl bg-primary/5 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className={label}>Authorized driver device</label>
                <select
                  className={field}
                  value={shareRoute}
                  disabled={sharing || starting}
                  onChange={(event) => setShareRoute(event.target.value)}
                >
                  <option value="">Select active route</option>
                  {routes
                    .filter((route) => route.isActive)
                    .map((route) => (
                      <option key={route._id} value={route._id}>
                        {route.routeNo} · {route.vehicleNo} ({route.driverName})
                      </option>
                    ))}
                </select>
              </div>
              <CustomButton
                onClick={shareLocation}
                disabled={starting}
                startIcon={<Navigation className={`h-4 w-4 ${sharing ? 'animate-spin' : ''}`} />}
              >
                {starting
                  ? 'Requesting permission...'
                  : sharing
                    ? 'Stop live sharing'
                    : 'Start live sharing'}
              </CustomButton>
            </div>

            {/* Live GPS Broadcast Status Info */}
            {sharing && lastPos && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800 border border-emerald-200/70">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                  </span>
                  <span className="font-bold">Secure session active:</span>
                  <span>
                    Lat: {lastPos.lat.toFixed(5)}, Lng: {lastPos.lng.toFixed(5)} ({lastPos.speed}{' '}
                    km/h)
                  </span>
                </div>
                <span className="font-mono text-[11px] text-emerald-600">
                  Last updated: {lastPos.updatedAt.toLocaleTimeString()}
                </span>
              </div>
            )}

            {/* Location Error Banner */}
            {geoError && (
              <div className="rounded-xl bg-rose-50 p-4 text-xs text-rose-800 border border-rose-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-rose-700 text-sm">
                  <LocateFixed className="h-4 w-4 text-rose-600" />
                  Browser Location Access Needed
                </div>
                <p>{geoError}</p>
                <div className="mt-2 rounded-lg bg-white p-3.5 border border-rose-200/80 space-y-2 text-slate-700 ">
                  <p className="font-bold text-slate-900 text-xs">
                    How to enable location permission in your browser:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-xs text-slate-600 leading-relaxed">
                    <li>
                      Look at the browser URL bar at the top of your screen (where it shows{' '}
                      <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-800">
                        {typeof window !== 'undefined' ? window.location.host : 'localhost'}
                      </code>
                      ).
                    </li>
                    <li>
                      Click the <strong>Tune / Lock / Settings icon 🔒</strong> located right next
                      to the URL.
                    </li>
                    <li>
                      Find <strong>Location</strong> in the dropdown menu.
                    </li>
                    <li>
                      Switch the setting from <strong className="text-rose-600">Block</strong> to{' '}
                      <strong className="text-emerald-600">Allow</strong> (or click{' '}
                      <em>Reset permissions</em>).
                    </li>
                    <li>
                      Click <strong>&quot;Start live sharing&quot;</strong> again.
                    </li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {buses.length === 0 ? (
        <div className="rounded-2xl bg-white">
          <Empty
            title="No vehicles are reporting yet"
            subTitle="On the authorized driver device, select the assigned route and start a secure tracking session."
          />
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <div className="overflow-hidden rounded-2xl bg-white p-2">
            <LiveTransportMap buses={buses} selectedId={selectedId} onSelect={selectBus} />
          </div>
          <div className="space-y-2 rounded-2xl bg-white p-3">
            {buses.map((bus) => {
              const age = bus.gps ? now - new Date(bus.gps.lastSeen).getTime() : Infinity;
              const live = age < 120000;
              return (
                <button
                  key={bus._id}
                  onClick={() => setSelectedId(bus._id)}
                  className={`w-full rounded-xl border p-3 text-left transition-colors ${selectedId === bus._id ? 'border-primary bg-primary/5' : 'border-slate-100 hover:bg-slate-50'}`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-900">
                      {bus.routeNo} · {bus.vehicleNo}
                    </p>
                    <span
                      className={`text-xs font-semibold ${live ? 'text-green-600' : 'text-amber-600'}`}
                    >
                      {live ? 'Live' : 'Last known'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {bus.driverName} · {Math.round(bus.gps?.speed ?? 0)} km/h
                  </p>
                </button>
              );
            })}
            {selected && (
              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                <ShieldCheck className="mb-1 h-4 w-4 text-primary" />
                Location shown is the latest authenticated update for {selected.routeName}.
              </div>
            )}
          </div>
        </div>
      )}
      <p className="text-center text-[11px] text-slate-600">
        Map rendered with MapLibre and OpenFreeMap · Map data © OpenStreetMap contributors
      </p>
    </section>
  );
}
