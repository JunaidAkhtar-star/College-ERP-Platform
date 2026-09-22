'use client';

import React, { useState } from 'react';
import { useFormik, type FormikProps } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import {
  Activity,
  CalendarCheck,
  CheckCircle2,
  Clock,
  ContactRound,
  LogOut,
  Plus,
  ShieldAlert,
  TimerReset,
  UsersRound,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import CustomButton from '@/shared/core/CustomButton';
import AsyncSelect from '@/shared/core/AsyncSelect';
import StudentSupportWorkflowBar from '@/shared/components/StudentSupportWorkflowBar';
import CustomTable, { Column } from '@/shared/core/CustomTable';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import { useAuthStore } from '@/shared/store/authStore';

interface IGatePassResponse {
  _id: string;
  passNumber: string;
  visitorName: string;
  visitorPhone: string;
  purpose: string;
  hostId?: {
    _id: string;
    name: string;
    email: string;
    department?: string;
  };
  checkInTime: string;
  checkOutTime?: string;
  status: 'checked_in' | 'checked_out';
  vehicleNumber?: string;
  remarks?: string;
  [key: string]: unknown;
}

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm placeholder-slate-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20';
const labelCls = 'mb-1 block text-xs font-medium text-slate-600';
type GateTab = 'overview' | 'on_campus' | 'history';
type Workspace = 'visitors' | 'outings';
type OutingStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'outside' | 'returned';
interface IStudentOuting {
  _id: string;
  outingNumber: string;
  studentId?: { _id: string; name: string; email: string };
  reason: string;
  destination: string;
  departureAt: string;
  expectedReturnAt: string;
  emergencyContact: string;
  status: OutingStatus;
  reviewNotes?: string;
  exitedAt?: string;
  returnedAt?: string;
  [key: string]: unknown;
}
interface OutingValues {
  reason: string;
  destination: string;
  departureAt: string;
  expectedReturnAt: string;
  emergencyContact: string;
}

export default function GatePassPage() {
  const canCheckIn = useHasPermission('gate_pass', 'edit');
  const canCheckOut = useHasPermission('gate_pass', 'approve');
  const canExport = useHasPermission('gate_pass', 'export');
  const activeRole = useAuthStore(
    (state) => state.activeRole?.baseRole ?? state.activeRole?.name ?? state.role ?? '',
  );
  const isStudent = activeRole === 'student';
  const isGateOperator = canCheckOut;
  const visitorQuery = useSwr(isStudent ? null : 'gatepass');
  const outingQuery = useSwr(isStudent || isGateOperator ? 'gatepass/outings' : null);
  const { data: raw, error, isLoading, mutate } = visitorQuery;
  const { mutation, isLoading: acting } = useMutation();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showOutingModal, setShowOutingModal] = useState(false);
  const [tab, setTab] = useState<GateTab>('overview');
  const [workspace, setWorkspace] = useState<Workspace>(isStudent ? 'outings' : 'visitors');

  const passes: IGatePassResponse[] = (raw as { data?: IGatePassResponse[] })?.data ?? [];
  const outings: IStudentOuting[] =
    (outingQuery.data as { data?: IStudentOuting[] } | undefined)?.data ?? [];
  const activePasses = passes.filter((pass) => pass.status === 'checked_in');
  const completedPasses = passes.filter((pass) => pass.status === 'checked_out');
  const visiblePasses =
    tab === 'on_campus' ? activePasses : tab === 'history' ? completedPasses : passes;
  const handleCheckout = async (id: string) => {
    const res = await mutation(`gatepass/${id}/checkout`, { method: 'PATCH', isAlert: true });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Visitor checked out successfully');
      mutate();
    }
  };

  const formik = useFormik({
    initialValues: {
      visitorName: '',
      visitorPhone: '',
      purpose: '',
      hostId: '',
      vehicleNumber: '',
      remarks: '',
    },
    validationSchema: Yup.object({
      visitorName: Yup.string().trim().required('Visitor name is required'),
      visitorPhone: Yup.string()
        .trim()
        .matches(/^[0-9+() -]{7,20}$/, 'Enter a valid phone number')
        .required('Visitor phone is required'),
      purpose: Yup.string().trim().required('Purpose of visit is required'),
      hostId: Yup.string().trim().required('Choose the person being visited'),
    }),
    onSubmit: async (values, { resetForm }) => {
      const res = await mutation('gatepass', { method: 'POST', body: values, isAlert: true });
      if ((res as { results?: { success?: boolean } })?.results?.success) {
        toast.success('Visitor registered and pass issued');
        resetForm();
        setShowAddModal(false);
        mutate();
      }
    },
  });

  const outingFormik = useFormik({
    initialValues: {
      reason: '',
      destination: '',
      departureAt: '',
      expectedReturnAt: '',
      emergencyContact: '',
    },
    validationSchema: Yup.object({
      reason: Yup.string().trim().min(5).required('Reason is required'),
      destination: Yup.string().trim().required('Destination is required'),
      departureAt: Yup.date().required('Departure date and time are required'),
      expectedReturnAt: Yup.date()
        .min(Yup.ref('departureAt'), 'Return must be after departure')
        .required('Expected return is required'),
      emergencyContact: Yup.string()
        .matches(/^[0-9+() -]{7,20}$/, 'Enter a valid contact number')
        .required('Emergency contact is required'),
    }),
    onSubmit: async (values, { resetForm }) => {
      const response = await mutation('gatepass/outings', {
        method: 'POST',
        body: values,
        isAlert: true,
      });
      if ((response as { results?: { success?: boolean } })?.results?.success) {
        toast.success('Outing request submitted for approval');
        resetForm();
        setShowOutingModal(false);
        await outingQuery.mutate();
      }
    },
  });

  const decideOuting = async (outing: IStudentOuting, decision: 'approve' | 'reject') => {
    let reviewNotes: string | undefined;
    if (decision === 'reject') {
      const answer = await Swal.fire({
        title: `Reject ${outing.outingNumber}?`,
        input: 'textarea',
        inputLabel: 'Decision reason',
        showCancelButton: true,
        inputValidator: (value) =>
          value.trim().length < 3 ? 'Enter at least 3 characters' : undefined,
      });
      if (!answer.isConfirmed) return;
      reviewNotes = answer.value;
    }
    const response = await mutation(`gatepass/outings/${outing._id}/decide`, {
      method: 'PATCH',
      body: { decision, reviewNotes },
      isAlert: true,
    });
    if (response) await outingQuery.mutate();
  };

  const moveOuting = async (outing: IStudentOuting, movement: 'exit' | 'return') => {
    const response = await mutation(`gatepass/outings/${outing._id}/movement`, {
      method: 'PATCH',
      body: { movement },
      isAlert: true,
    });
    if (response) await outingQuery.mutate();
  };

  const cancelOuting = async (outing: IStudentOuting) => {
    const answer = await Swal.fire({
      title: `Cancel ${outing.outingNumber}?`,
      text: 'The pending request will be closed and cannot be reviewed.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Cancel request',
    });
    if (!answer.isConfirmed) return;
    const response = await mutation(`gatepass/outings/${outing._id}/cancel`, {
      method: 'PATCH',
      isAlert: true,
    });
    if (response) await outingQuery.mutate();
  };

  const columns: Column<IGatePassResponse>[] = [
    {
      field: 'passNumber',
      title: 'Pass No',
      render: (r) => <span className="font-mono font-bold text-xs">{r.passNumber}</span>,
    },
    {
      field: 'visitorName',
      title: 'Visitor',
      render: (r) => (
        <div>
          <p className="text-sm font-semibold">{r.visitorName}</p>
          <p className="text-xs text-slate-600">{r.visitorPhone}</p>
        </div>
      ),
    },
    {
      field: 'purpose',
      title: 'Purpose',
      render: (r) => <span className="text-sm text-slate-600">{r.purpose}</span>,
    },
    {
      field: 'hostId',
      title: 'Host Person',
      render: (r) => <span className="text-sm">{r.hostId?.name || '—'}</span>,
    },
    {
      field: 'checkInTime',
      title: 'Check In',
      render: (r) => (
        <span className="text-xs text-slate-500">
          {new Date(r.checkInTime).toLocaleString('en-IN', {
            dateStyle: 'short',
            timeStyle: 'short',
          })}
        </span>
      ),
    },
    {
      field: 'status',
      title: 'Status',
      render: (r) => {
        const isCheckedIn = r.status === 'checked_in';
        return (
          <span
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${
              isCheckedIn ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'
            }`}
          >
            {isCheckedIn ? <Clock className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
            {isCheckedIn ? 'Checked In' : 'Checked Out'}
          </span>
        );
      },
    },
    {
      field: '_id',
      title: 'Actions',
      render: (r) => {
        if (r.status === 'checked_in' && canCheckOut) {
          return (
            <CustomButton
              variant="primary"
              onClick={() => handleCheckout(r._id)}
              loading={acting}
              startIcon={<LogOut className="h-3.5 w-3.5" />}
              className="py-1! px-2.5! text-xs! bg-red-500 hover:bg-red-600 text-white!"
            >
              Check Out
            </CustomButton>
          );
        }
        return <span className="text-xs text-slate-600">Checked Out</span>;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <StudentSupportWorkflowBar />
      {(workspace === 'visitors' ? canCheckIn && !isStudent : isStudent && canCheckIn) && (
        <div className="flex items-center justify-end gap-2">
          {workspace === 'visitors' && canCheckIn && !isStudent && (
            <CustomButton
              variant="primary"
              onClick={() => setShowAddModal(true)}
              startIcon={<Plus className="h-4 w-4" />}
              className="w-fit!"
            >
              New Pass
            </CustomButton>
          )}
          {workspace === 'outings' && isStudent && canCheckIn && (
            <CustomButton
              variant="primary"
              onClick={() => setShowOutingModal(true)}
              startIcon={<Plus className="h-4 w-4" />}
              className="w-fit!"
            >
              Apply for outing
            </CustomButton>
          )}
        </div>
      )}

      {(workspace === 'outings' ? outingQuery.error : error) && (
        <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
          {workspace === 'outings'
            ? 'Outing-pass records could not be loaded. Refresh and try again.'
            : 'Gate-pass records could not be loaded. Refresh and try again; no visitor data is estimated.'}
        </div>
      )}

      {isGateOperator && (
        <div
          className="flex w-fit rounded-xl bg-slate-100 p-1"
          role="tablist"
          aria-label="Gate workspace"
        >
          {(
            [
              ['visitors', 'Visitor passes'],
              ['outings', 'Student outings'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={workspace === id}
              onClick={() => setWorkspace(id)}
              className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
                workspace === id ? 'bg-white text-primary shadow-sm' : 'text-slate-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {workspace === 'visitors' && isGateOperator && <GatePassAnalytics passes={passes} />}

      {workspace === 'visitors' && isGateOperator && (
        <div
          role="tablist"
          aria-label="Gate pass views"
          className="flex w-fit max-w-full gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2"
        >
          {[
            {
              id: 'overview' as const,
              label: 'All passes',
              detail: 'Complete register',
              count: passes.length,
              icon: ContactRound,
            },
            {
              id: 'on_campus' as const,
              label: 'On campus',
              detail: 'Checkout required',
              count: activePasses.length,
              icon: Activity,
            },
            {
              id: 'history' as const,
              label: 'Visit history',
              detail: 'Completed visits',
              count: completedPasses.length,
              icon: CalendarCheck,
            },
          ].map(({ id, label, detail, count, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-colors ${
                tab === id ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                  tab === id ? 'bg-white/15' : 'bg-slate-100'
                }`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span>
                <span className="flex items-center gap-2 text-xs font-bold">
                  {label}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[9px] ${
                      tab === id ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                </span>
                <span className={`text-[10px] ${tab === id ? 'text-white/75' : 'text-slate-400'}`}>
                  {detail}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {workspace === 'visitors' && tab === 'on_campus' && activePasses.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {activePasses.slice(0, 6).map((pass) => (
            <GatePassTicket
              key={pass._id}
              pass={pass}
              canCheckOut={canCheckOut}
              acting={acting}
              onCheckOut={handleCheckout}
            />
          ))}
        </div>
      )}

      {workspace === 'visitors' && (
        <CustomTable<IGatePassResponse>
          key={`gate-pass-${tab}`}
          title={
            tab === 'on_campus'
              ? 'Visitors currently on campus'
              : tab === 'history'
                ? 'Completed visitor movements'
                : 'Gate-pass register'
          }
          description={
            tab === 'history'
              ? 'Completed visits with host, purpose, arrival and departure evidence.'
              : 'Visitor identity, responsible host, purpose, arrival and current access status.'
          }
          data={visiblePasses}
          columns={columns}
          isLoading={isLoading}
          isValidating={visitorQuery.isValidating}
          onRefresh={() => void mutate()}
          options={{ refresh: true, export: canExport, pagination: true, responsive: true }}
        />
      )}

      {workspace === 'outings' && (
        <StudentOutingRegister
          outings={outings}
          loading={outingQuery.isLoading}
          validating={outingQuery.isValidating}
          canReview={canCheckOut}
          selfService={isStudent}
          canExport={canExport}
          acting={acting}
          onRefresh={() => void outingQuery.mutate()}
          onDecide={decideOuting}
          onMove={moveOuting}
          onCancel={cancelOuting}
        />
      )}

      {/* Add Pass Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
              onClick={() => setShowAddModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="gate-pass-dialog-title"
              className="relative z-10 max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-5 sm:p-7"
            >
              <div className="mb-6 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary">
                    <ShieldAlert className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
                      Guided check-in
                    </p>
                    <h2 id="gate-pass-dialog-title" className="text-xl font-bold text-slate-900">
                      Issue a visitor gate pass
                    </h2>
                    <p className="mt-1 max-w-2xl text-sm text-slate-500">
                      Verify the visitor, select the responsible host and record why campus access
                      is required. The host is notified after the pass is issued.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                  aria-label="Close gate-pass form"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={formik.handleSubmit} className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2 rounded-xl bg-blue-50 p-4 text-sm text-blue-800">
                  <span className="font-semibold">Before issuing:</span> confirm a valid identity,
                  phone number and host availability. Do not use remarks for sensitive identity
                  document numbers.
                </div>

                <div>
                  <label className={labelCls}>Visitor Name</label>
                  <input
                    name="visitorName"
                    value={formik.values.visitorName}
                    onChange={formik.handleChange}
                    className={inputCls}
                    placeholder="Name shown on visitor ID"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Use the visitor’s complete identifiable name.
                  </p>
                  {formik.touched.visitorName && formik.errors.visitorName && (
                    <p className="mt-1 text-xs text-red-500">{formik.errors.visitorName}</p>
                  )}
                </div>

                <div>
                  <label className={labelCls}>Visitor Phone Number</label>
                  <input
                    type="tel"
                    name="visitorPhone"
                    value={formik.values.visitorPhone}
                    onChange={formik.handleChange}
                    className={inputCls}
                    placeholder="Enter phone number"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Used only for gate coordination and emergency contact.
                  </p>
                  {formik.touched.visitorPhone && formik.errors.visitorPhone && (
                    <p className="mt-1 text-xs text-red-500">{formik.errors.visitorPhone}</p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <AsyncSelect
                    type="users"
                    label="Person being visited"
                    required
                    value={formik.values.hostId || null}
                    onChange={(value) => formik.setFieldValue('hostId', value ?? '')}
                    placeholder="Search by name or email"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    The selected host receives an immediate visitor-arrival notification.
                  </p>
                  {formik.touched.hostId && formik.errors.hostId && (
                    <p className="mt-1 text-xs text-red-500">{formik.errors.hostId}</p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className={labelCls}>Purpose of Visit</label>
                  <input
                    name="purpose"
                    value={formik.values.purpose}
                    onChange={formik.handleChange}
                    className={inputCls}
                    placeholder="Example: Admissions meeting with the registrar"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    State the destination or expected activity clearly for security verification.
                  </p>
                  {formik.touched.purpose && formik.errors.purpose && (
                    <p className="mt-1 text-xs text-red-500">{formik.errors.purpose}</p>
                  )}
                </div>

                <div>
                  <label className={labelCls}>Vehicle Number (Optional)</label>
                  <input
                    name="vehicleNumber"
                    value={formik.values.vehicleNumber}
                    onChange={formik.handleChange}
                    className={inputCls}
                    placeholder="e.g. OD-02-1234"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Record only when the vehicle enters campus.
                  </p>
                </div>
                <div>
                  <label className={labelCls}>Remarks</label>
                  <input
                    name="remarks"
                    value={formik.values.remarks}
                    onChange={formik.handleChange}
                    className={inputCls}
                    placeholder="Escort, delivery location or access note"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Add operational instructions for gate personnel.
                  </p>
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-100 pt-5 sm:col-span-2">
                  <CustomButton
                    variant="tertiary"
                    onClick={() => setShowAddModal(false)}
                    type="button"
                  >
                    Cancel
                  </CustomButton>
                  <CustomButton variant="primary" type="submit" loading={acting}>
                    Register & Check In
                  </CustomButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showOutingModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.button
              type="button"
              aria-label="Close outing application"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
              onClick={() => setShowOutingModal(false)}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              className="relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-5 sm:p-7"
            >
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
                    Student self-service
                  </p>
                  <h2 className="text-xl font-bold text-slate-900">Apply for an outing pass</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Submit your destination and expected movement times. Approval does not record
                    your exit—security will verify the approved pass at the gate.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowOutingModal(false)}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={outingFormik.handleSubmit} className="grid gap-5 sm:grid-cols-2">
                <OutingField
                  name="destination"
                  title="Destination"
                  help="Give a specific place that an approver and security can verify."
                  placeholder="Example: City hospital, Bhubaneswar"
                  formik={outingFormik}
                />
                <OutingField
                  name="emergencyContact"
                  title="Emergency contact"
                  help="A reachable parent, guardian or emergency contact number."
                  placeholder="Enter contact number"
                  type="tel"
                  formik={outingFormik}
                />
                <OutingField
                  name="departureAt"
                  title="Planned departure"
                  help="Security can record exit only after approval."
                  type="datetime-local"
                  formik={outingFormik}
                />
                <OutingField
                  name="expectedReturnAt"
                  title="Expected return"
                  help="Late return can be identified as an exception."
                  type="datetime-local"
                  formik={outingFormik}
                />
                <div className="sm:col-span-2">
                  <OutingField
                    name="reason"
                    title="Reason for outing"
                    help="Explain why the outing is needed so the reviewer can make an informed decision."
                    placeholder="Describe the purpose of your outing"
                    formik={outingFormik}
                  />
                </div>
                <div className="flex justify-end gap-2 border-t border-slate-100 pt-5 sm:col-span-2">
                  <CustomButton
                    type="button"
                    variant="tertiary"
                    onClick={() => setShowOutingModal(false)}
                  >
                    Cancel
                  </CustomButton>
                  <CustomButton type="submit" variant="primary" loading={acting}>
                    Submit for approval
                  </CustomButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StudentOutingRegister({
  outings,
  loading,
  validating,
  canReview,
  selfService,
  canExport,
  acting,
  onRefresh,
  onDecide,
  onMove,
  onCancel,
}: {
  outings: IStudentOuting[];
  loading: boolean;
  validating: boolean;
  canReview: boolean;
  selfService: boolean;
  canExport: boolean;
  acting: boolean;
  onRefresh: () => void;
  onDecide: (outing: IStudentOuting, decision: 'approve' | 'reject') => Promise<void>;
  onMove: (outing: IStudentOuting, movement: 'exit' | 'return') => Promise<void>;
  onCancel: (outing: IStudentOuting) => Promise<void>;
}) {
  const columns: Column<IStudentOuting>[] = [
    {
      field: 'outingNumber',
      title: 'Outing pass',
      render: (row) => <span className="font-mono text-xs font-bold">{row.outingNumber}</span>,
    },
    ...(!selfService
      ? [
          {
            field: 'studentId' as const,
            title: 'Student',
            render: (row: IStudentOuting) => (
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {row.studentId?.name || 'Student'}
                </p>
                <p className="text-xs text-slate-500">{row.studentId?.email}</p>
              </div>
            ),
          },
        ]
      : []),
    {
      field: 'destination',
      title: 'Plan',
      render: (row) => (
        <div className="max-w-xs">
          <p className="text-sm font-semibold text-slate-700">{row.destination}</p>
          <p className="truncate text-xs text-slate-500">{row.reason}</p>
        </div>
      ),
    },
    {
      field: 'departureAt',
      title: 'Departure / return',
      render: (row) => (
        <div className="text-xs text-slate-600">
          <p>{formatTime(row.departureAt)}</p>
          <p className="text-slate-400">to {formatTime(row.expectedReturnAt)}</p>
        </div>
      ),
    },
    {
      field: 'status',
      title: 'Status',
      render: (row) => <OutingStatusBadge status={row.status} />,
    },
    {
      field: '_id',
      title: 'Actions',
      render: (row) => (
        <div className="flex flex-wrap gap-1.5">
          {canReview && row.status === 'pending' && (
            <>
              <button
                type="button"
                disabled={acting}
                onClick={() => void onDecide(row, 'approve')}
                className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={acting}
                onClick={() => void onDecide(row, 'reject')}
                className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
              >
                Reject
              </button>
            </>
          )}
          {canReview && row.status === 'approved' && (
            <button
              type="button"
              disabled={acting}
              onClick={() => void onMove(row, 'exit')}
              className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100"
            >
              Record exit
            </button>
          )}
          {canReview && row.status === 'outside' && (
            <button
              type="button"
              disabled={acting}
              onClick={() => void onMove(row, 'return')}
              className="rounded-lg bg-violet-50 px-2.5 py-1.5 text-xs font-bold text-violet-700 hover:bg-violet-100"
            >
              Record return
            </button>
          )}
          {selfService && row.status === 'pending' && (
            <button
              type="button"
              disabled={acting}
              onClick={() => void onCancel(row)}
              className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
            >
              Cancel request
            </button>
          )}
          {!canReview && !selfService && (
            <span className="text-xs text-slate-400">No action required</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <CustomTable<IStudentOuting>
      key="student-outing-register"
      title={selfService ? 'My outing applications' : 'Student outing-pass register'}
      description={
        selfService
          ? 'Track approval, verified departure and return for your own applications.'
          : 'Review applications and record verified student exits and returns.'
      }
      data={outings}
      columns={columns}
      isLoading={loading}
      isValidating={validating}
      onRefresh={onRefresh}
      options={{ refresh: true, export: canExport, pagination: true, responsive: true }}
    />
  );
}

function OutingStatusBadge({ status }: { status: OutingStatus }) {
  const tone =
    status === 'approved' || status === 'returned'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'rejected' || status === 'cancelled'
        ? 'bg-rose-50 text-rose-700'
        : status === 'outside'
          ? 'bg-violet-50 text-violet-700'
          : 'bg-amber-50 text-amber-700';
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${tone}`}>
      {status}
    </span>
  );
}

function OutingField({
  name,
  title,
  help,
  placeholder,
  type = 'text',
  formik,
}: {
  name: keyof OutingValues;
  title: string;
  help: string;
  placeholder?: string;
  type?: string;
  formik: FormikProps<OutingValues>;
}) {
  const error = formik.touched[name] && formik.errors[name];
  return (
    <div>
      <label className={labelCls} htmlFor={`outing-${name}`}>
        {title}
      </label>
      <input
        id={`outing-${name}`}
        name={name}
        type={type}
        value={formik.values[name]}
        onChange={formik.handleChange}
        onBlur={formik.handleBlur}
        placeholder={placeholder}
        className={inputCls}
      />
      <p className="mt-1 text-[11px] text-slate-400">{help}</p>
      {error && <p className="mt-1 text-xs text-rose-600">{String(error)}</p>}
    </div>
  );
}

function GatePassTicket({
  pass,
  canCheckOut,
  acting,
  onCheckOut,
}: {
  pass: IGatePassResponse;
  canCheckOut: boolean;
  acting: boolean;
  onCheckOut: (id: string) => Promise<void>;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between bg-slate-900 px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-emerald-300" />
          <span className="text-[10px] font-bold uppercase tracking-[0.18em]">
            Active gate pass
          </span>
        </div>
        <span className="font-mono text-xs font-bold">{pass.passNumber}</span>
      </div>
      <div className="relative p-4">
        <div className="absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-slate-50" />
        <div className="absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-slate-50" />
        <div className="flex items-start justify-between gap-3 border-b border-dashed border-slate-200 pb-4">
          <div>
            <p className="text-base font-bold text-slate-900">{pass.visitorName}</p>
            <p className="text-xs text-slate-500">{pass.visitorPhone}</p>
          </div>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">
            On campus
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 py-4 text-xs">
          <div>
            <dt className="text-slate-400">Host</dt>
            <dd className="mt-0.5 font-semibold text-slate-700">{pass.hostId?.name || '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Checked in</dt>
            <dd className="mt-0.5 font-semibold text-slate-700">{formatTime(pass.checkInTime)}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-slate-400">Purpose</dt>
            <dd className="mt-0.5 font-semibold text-slate-700">{pass.purpose}</dd>
          </div>
          {pass.vehicleNumber && (
            <div className="col-span-2">
              <dt className="text-slate-400">Vehicle</dt>
              <dd className="mt-0.5 font-mono font-semibold text-slate-700">
                {pass.vehicleNumber}
              </dd>
            </div>
          )}
        </dl>
        {canCheckOut && (
          <button
            type="button"
            onClick={() => void onCheckOut(pass._id)}
            disabled={acting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" />
            Record visitor exit
          </button>
        )}
      </div>
    </article>
  );
}

function GatePassAnalytics({ passes }: { passes: IGatePassResponse[] }) {
  const active = passes.filter((pass) => pass.status === 'checked_in');
  const completed = passes.filter((pass) => pass.status === 'checked_out');
  const todayKey = new Date().toDateString();
  const today = passes.filter((pass) => new Date(pass.checkInTime).toDateString() === todayKey);
  const withDuration = completed.filter((pass) => pass.checkOutTime);
  const averageMinutes = withDuration.length
    ? Math.round(
        withDuration.reduce(
          (total, pass) =>
            total +
            (new Date(pass.checkOutTime ?? pass.checkInTime).getTime() -
              new Date(pass.checkInTime).getTime()) /
              60000,
          0,
        ) / withDuration.length,
      )
    : 0;
  const hours = Array.from({ length: 6 }, (_, index) => {
    const point = new Date();
    point.setMinutes(0, 0, 0);
    point.setHours(point.getHours() - (5 - index));
    const next = new Date(point.getTime() + 60 * 60 * 1000);
    return {
      label: point.toLocaleTimeString('en-IN', { hour: 'numeric' }),
      arrivals: passes.filter((pass) => {
        const value = new Date(pass.checkInTime);
        return value >= point && value < next;
      }).length,
      exits: passes.filter((pass) => {
        if (!pass.checkOutTime) return false;
        const value = new Date(pass.checkOutTime);
        return value >= point && value < next;
      }).length,
    };
  });
  const peak = Math.max(1, ...hours.flatMap((hour) => [hour.arrivals, hour.exits]));

  const metrics = [
    {
      label: 'On campus now',
      value: active.length,
      detail: 'Require recorded exit',
      icon: UsersRound,
      tone: 'bg-amber-50 text-amber-700',
    },
    {
      label: 'Arrivals today',
      value: today.length,
      detail: 'Passes issued today',
      icon: ContactRound,
      tone: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'Completed visits',
      value: completed.length,
      detail: 'Recorded exits in view',
      icon: CheckCircle2,
      tone: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: 'Average visit',
      value: averageMinutes ? `${averageMinutes} min` : '—',
      detail: 'From completed visits',
      icon: TimerReset,
      tone: 'bg-violet-50 text-violet-700',
    },
  ];

  return (
    <section aria-labelledby="gate-activity-title" className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, detail, icon: Icon, tone }) => (
          <div key={label} className="rounded-2xl border border-slate-100 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
                <p className="mt-1 text-[11px] text-slate-400">{detail}</p>
              </div>
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
                <Icon className="h-5 w-5" />
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="gate-activity-title" className="text-sm font-bold text-slate-900">
              Gate movement · last 6 hours
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Live arrival and recorded-exit volume from the gate register.
            </p>
          </div>
          <div className="flex gap-3 text-[10px] font-semibold text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" /> Arrivals
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Exits
            </span>
          </div>
        </div>
        <svg
          viewBox="0 0 720 190"
          role="img"
          aria-label="Arrivals and exits during the last six hours"
          className="mt-5 h-auto w-full"
        >
          {[0, 1, 2, 3].map((line) => (
            <line
              key={line}
              x1="42"
              x2="700"
              y1={25 + line * 38}
              y2={25 + line * 38}
              stroke="#e2e8f0"
              strokeDasharray="4 5"
            />
          ))}
          {hours.map((hour, index) => {
            const x = 64 + index * 108;
            const arrivalHeight = (hour.arrivals / peak) * 105;
            const exitHeight = (hour.exits / peak) * 105;
            return (
              <g key={`${hour.label}-${index}`}>
                <rect
                  x={x}
                  y={140 - arrivalHeight}
                  width="24"
                  height={arrivalHeight}
                  rx="7"
                  fill="#4f46e5"
                />
                <rect
                  x={x + 29}
                  y={140 - exitHeight}
                  width="24"
                  height={exitHeight}
                  rx="7"
                  fill="#10b981"
                />
                <text x={x + 26} y="165" textAnchor="middle" className="fill-slate-400 text-[10px]">
                  {hour.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
