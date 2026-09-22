'use client';

import AsyncSelect from '@/shared/core/AsyncSelect';
import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { Action, Column } from '@/shared/core/CustomTable';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import { CalendarPlus, CheckCircle2, X, XCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';

interface IEngagement extends Record<string, unknown> {
  _id: string;
  type: string;
  title: string;
  description: string;
  scheduledAt: string;
  venue?: string;
  alumniIds: { _id: string; fullName: string; email: string }[];
  capacity?: number;
  status: 'planned' | 'completed' | 'cancelled';
  outcome?: string;
}
const fieldClass =
  'min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15';

export default function EngagementTab() {
  const canCreate = useHasPermission('alumni', 'create');
  const canEdit = useHasPermission('alumni', 'edit');
  const { data, error, isLoading, isValidating, mutate } = useSwr('alumni/engagements');
  const records = (data as { data?: IEngagement[] })?.data ?? [];
  const { mutation, isLoading: acting } = useMutation();
  const [open, setOpen] = useState(false);
  const close = async (row: IEngagement, status: 'completed' | 'cancelled') => {
    const result = await Swal.fire({
      title: status === 'completed' ? 'Complete engagement' : 'Cancel engagement',
      input: 'textarea',
      inputPlaceholder:
        status === 'completed'
          ? 'Participation, outcome and next action'
          : 'Reason for cancellation',
      inputValidator: (value) => (value.trim().length < 5 ? 'Add a meaningful note' : undefined),
      showCancelButton: true,
      confirmButtonText: status === 'completed' ? 'Complete' : 'Cancel activity',
    });
    if (!result.isConfirmed) return;
    const response = await mutation(`alumni/engagements/${row._id}/close`, {
      method: 'PUT',
      body: { status, outcome: result.value },
    });
    if (!response?.results?.success) return;
    toast.success(status === 'completed' ? 'Engagement completed' : 'Engagement cancelled');
    mutate();
  };
  const columns: Column<IEngagement>[] = [
    { field: 'title', title: 'Engagement' },
    { field: 'type', title: 'Type', render: (row) => row.type.replace('_', ' ') },
    {
      field: 'scheduledAt',
      title: 'Scheduled',
      render: (row) => new Date(row.scheduledAt).toLocaleString('en-IN'),
    },
    { field: 'venue', title: 'Venue', render: (row) => row.venue || 'Online / to be decided' },
    { field: 'alumniIds', title: 'Alumni', render: (row) => row.alumniIds.length },
    {
      field: 'status',
      title: 'Status',
      render: (row) => (
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize">
          {row.status}
        </span>
      ),
    },
  ];
  const actions: Action<IEngagement>[] = canEdit
    ? [
        {
          icon: <CheckCircle2 size={15} />,
          tooltip: 'Complete with outcome',
          onClick: (row) => close(row, 'completed'),
          hidden: (row) => row.status !== 'planned',
        },
        {
          icon: <XCircle size={15} />,
          tooltip: 'Cancel with reason',
          onClick: (row) => close(row, 'cancelled'),
          hidden: (row) => row.status !== 'planned',
          className: 'text-red-500',
        },
      ]
    : [];
  return (
    <div className="space-y-4">
      {error && (
        <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
          Engagement records could not be loaded. Refresh and try again.
        </div>
      )}
      <div className="flex justify-end">
        {canCreate && (
          <CustomButton
            startIcon={<CalendarPlus className="h-4 w-4" />}
            onClick={() => setOpen(true)}
          >
            Plan engagement
          </CustomButton>
        )}
      </div>
      <CustomTable
        data={records}
        columns={columns}
        actions={actions}
        isLoading={isLoading}
        isValidating={isValidating}
        title="Engagement register"
        description="Reunions, mentoring, guest talks, referrals and networking with recorded outcomes."
        onRefresh={() => mutate()}
        options={{ search: true, refresh: true, pagination: true }}
      />
      {open && (
        <EngagementModal
          saving={acting}
          onClose={() => setOpen(false)}
          onSaved={async (body) => {
            const response = await mutation('alumni/engagements', { method: 'POST', body });
            if (!response?.results?.success) return;
            toast.success('Engagement planned');
            await mutate();
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function EngagementModal({
  saving,
  onClose,
  onSaved,
}: {
  saving: boolean;
  onClose: () => void;
  onSaved: (body: Record<string, unknown>) => void;
}) {
  const [type, setType] = useState('mentorship');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [venue, setVenue] = useState('');
  const [alumniIds, setAlumniIds] = useState<string[]>([]);
  const [capacity, setCapacity] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-200/80 p-4 backdrop-blur-sm">
      <div className="max-h-[92dvh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="font-black text-slate-900">Plan alumni engagement</h2>
            <p className="text-xs text-slate-500">
              Choose verified alumni by name—technical IDs stay hidden.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-slate-100 p-2">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-4">
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
            className={fieldClass}
          >
            {['mentorship', 'reunion', 'guest_talk', 'referral', 'networking', 'other'].map(
              (value) => (
                <option key={value} value={value}>
                  {value.replace('_', ' ')}
                </option>
              ),
            )}
          </select>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Engagement title"
            className={fieldClass}
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Purpose, audience and expected outcome"
            className={fieldClass}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className={fieldClass}
            />
            <input
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="Venue or online mode"
              className={fieldClass}
            />
          </div>
          <AsyncSelect
            type="alumni"
            multiple
            label="Participating alumni"
            required
            value={alumniIds}
            onChange={setAlumniIds}
            placeholder="Search verified alumni"
          />
          <input
            type="number"
            min={Math.max(1, alumniIds.length)}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            placeholder="Total participant capacity (optional)"
            className={fieldClass}
          />
          <div className="flex justify-end gap-2">
            <CustomButton variant="cancel" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton
              loading={saving}
              onClick={() => {
                if (
                  title.trim().length < 3 ||
                  description.trim().length < 10 ||
                  !scheduledAt ||
                  !alumniIds.length
                )
                  return toast.error('Complete the title, purpose, schedule and alumni selection');
                onSaved({
                  type,
                  title: title.trim(),
                  description: description.trim(),
                  scheduledAt,
                  venue: venue.trim() || undefined,
                  alumniIds,
                  capacity: capacity ? Number(capacity) : undefined,
                });
              }}
            >
              Plan engagement
            </CustomButton>
          </div>
        </div>
      </div>
    </div>
  );
}
