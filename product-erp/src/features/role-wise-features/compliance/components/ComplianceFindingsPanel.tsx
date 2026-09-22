'use client';

import AsyncSelect from '@/shared/core/AsyncSelect';
import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { Action, Column } from '@/shared/core/CustomTable';
import Empty from '@/shared/core/Empty';
import InlineFileUpload from '@/shared/core/InlineFileUpload';
import type { IViewerFile } from '@/shared/core/FileViewer';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { AnimatePresence, motion } from '@/shared/utils/motion';
import { CheckCircle2, RotateCcw, ShieldAlert, Wrench, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import type { IComplianceFinding, IComplianceSubmission } from '../types/compliance.types';

interface IApiResponse<T> {
  success: boolean;
  data: T;
}

interface IProps {
  academicYear: string;
  userId?: string;
  canCreateFinding: boolean;
  canEdit: boolean;
  canVerify: boolean;
}

const entityId = (value: string | { _id: string }) =>
  typeof value === 'string' ? value : value._id;

export default function ComplianceFindingsPanel({
  academicYear,
  userId,
  canCreateFinding,
  canEdit,
  canVerify,
}: IProps) {
  const { mutation, isLoading: mutating } = useMutation();
  const [createOpen, setCreateOpen] = useState(false);
  const [remediating, setRemediating] = useState<IComplianceFinding | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const { data, isLoading, isValidating, mutate } = useSwr<IApiResponse<IComplianceFinding[]>>(
    `compliance-workspace/findings?academicYear=${encodeURIComponent(academicYear)}`,
  );
  const findings = useMemo(
    () => (data?.data ?? []).filter((item) => !statusFilter || item.status === statusFilter),
    [data, statusFilter],
  );

  const verify = async (finding: IComplianceFinding, accepted: boolean) => {
    const result = await Swal.fire({
      title: accepted ? 'Verify and close finding' : 'Return remediation',
      input: 'textarea',
      inputLabel: 'Verification note',
      inputPlaceholder: 'Record the evidence checked and the reason for this decision…',
      inputValidator: (value) =>
        !value || value.trim().length < 10 ? 'Enter at least 10 characters' : undefined,
      showCancelButton: true,
      confirmButtonText: accepted ? 'Close finding' : 'Return to owner',
      confirmButtonColor: '#0178D7',
    });
    if (!result.isConfirmed) return;
    const response = await mutation(`compliance-workspace/findings/${finding._id}/verify`, {
      method: 'PATCH',
      body: { accepted, closureNote: result.value },
    });
    if (!response?.results?.success) return;
    toast.success(accepted ? 'Finding closed' : 'Remediation returned to owner');
    mutate();
  };

  const columns: Column<IComplianceFinding>[] = [
    {
      field: 'findingNumber',
      title: 'Finding',
      render: (row) => (
        <div>
          <p className="font-semibold text-slate-800">{row.title}</p>
          <p className="text-xs text-slate-500">{row.findingNumber}</p>
        </div>
      ),
    },
    {
      field: 'submissionId',
      title: 'Requirement',
      render: (row) => row.submissionId?.requirementId?.code ?? '—',
    },
    { field: 'severity', title: 'Severity' },
    {
      field: 'dueAt',
      title: 'Due',
      render: (row) => new Date(row.dueAt).toLocaleDateString('en-IN'),
    },
    {
      field: 'status',
      title: 'Status',
      render: (row) => row.status.replaceAll('_', ' '),
    },
  ];
  const actions: Action<IComplianceFinding>[] = [
    {
      icon: <Wrench className="h-4 w-4" />,
      tooltip: 'Submit remediation',
      onClick: setRemediating,
      hidden: (row) =>
        !canEdit ||
        entityId(row.ownerId) !== userId ||
        !['open', 'remediation_in_progress'].includes(row.status),
    },
    {
      icon: <CheckCircle2 className="h-4 w-4" />,
      tooltip: 'Verify and close',
      onClick: (row) => verify(row, true),
      hidden: (row) => !canVerify || row.status !== 'pending_verification',
    },
    {
      icon: <RotateCcw className="h-4 w-4" />,
      tooltip: 'Return remediation',
      onClick: (row) => verify(row, false),
      hidden: (row) => !canVerify || row.status !== 'pending_verification',
    },
  ];

  const FindingEmpty = () => (
    <Empty
      title={statusFilter ? 'No findings match this status' : 'No compliance findings'}
      subTitle={
        statusFilter
          ? 'Choose another workflow status or clear the filter.'
          : 'Findings raised from evidence reviews will appear here with their owner, due date and remediation status.'
      }
      pathName={statusFilter ? 'Clear status filter' : undefined}
      onClick={statusFilter ? () => setStatusFilter('') : undefined}
    />
  );

  return (
    <>
      <section className="overflow-hidden rounded-2xl bg-white">
        <CustomTable
          data={findings}
          columns={columns}
          actions={actions}
          isLoading={isLoading || mutating}
          isValidating={isValidating}
          title="Compliance findings and remediation"
          description="Assign corrective action, collect remediation evidence and independently verify closure."
          onRefresh={() => mutate()}
          customActions={
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="min-h-9 w-44 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-600"
                aria-label="Finding status"
              >
                <option value="">All statuses</option>
                <option value="open">Open</option>
                <option value="remediation_in_progress">Remediation in progress</option>
                <option value="pending_verification">Pending verification</option>
                <option value="closed">Closed</option>
              </select>
              {canCreateFinding && (
                <CustomButton
                  onClick={() => setCreateOpen(true)}
                  className="w-fit! py-1.5! text-xs!"
                >
                  Raise finding
                </CustomButton>
              )}
            </div>
          }
          components={{ emptyState: FindingEmpty }}
          options={{ search: true, refresh: true, pagination: true, pageSize: 10 }}
        />
      </section>
      <FindingCreateModal
        open={createOpen}
        academicYear={academicYear}
        onClose={() => setCreateOpen(false)}
        onSaved={() => mutate()}
      />
      <RemediationModal
        finding={remediating}
        onClose={() => setRemediating(null)}
        onSaved={() => mutate()}
      />
    </>
  );
}

function FindingCreateModal({
  open,
  academicYear,
  onClose,
  onSaved,
}: {
  open: boolean;
  academicYear: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mutation, isLoading } = useMutation();
  const { data } = useSwr<IApiResponse<IComplianceSubmission[]>>(
    open
      ? `compliance-workspace/submissions?academicYear=${encodeURIComponent(academicYear)}`
      : null,
  );
  const [submissionId, setSubmissionId] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [dueAt, setDueAt] = useState('');
  const save = async () => {
    if (
      !submissionId ||
      !ownerId ||
      title.trim().length < 3 ||
      description.trim().length < 10 ||
      !dueAt
    ) {
      toast.error('Complete the evidence record, owner, finding details and due date');
      return;
    }
    const response = await mutation('compliance-workspace/findings', {
      method: 'POST',
      body: { submissionId, ownerId, title, description, severity, dueAt },
    });
    if (!response?.results?.success) return;
    toast.success('Compliance finding assigned');
    onSaved();
    onClose();
  };
  return (
    <SimpleModal open={open} title="Raise compliance finding" onClose={onClose}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2 text-sm font-semibold text-slate-700">
          Evidence record
          <select
            value={submissionId}
            onChange={(e) => setSubmissionId(e.target.value)}
            className="mt-1.5 w-full rounded-xl bg-slate-100 px-3 py-3 font-normal"
          >
            <option value="">Select reviewed evidence</option>
            {(data?.data ?? []).map((row) => (
              <option key={row._id} value={row._id}>
                {row.requirementId.code} — {row.requirementId.title}
              </option>
            ))}
          </select>
        </label>
        <div className="sm:col-span-2">
          <AsyncSelect
            type="users"
            label="Corrective-action owner"
            value={ownerId}
            onChange={(value) => setOwnerId(value ?? '')}
          />
        </div>
        <label className="sm:col-span-2 text-sm font-semibold text-slate-700">
          Finding title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1.5 w-full rounded-xl bg-slate-100 px-3 py-3 font-normal"
          />
        </label>
        <label className="sm:col-span-2 text-sm font-semibold text-slate-700">
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1.5 w-full rounded-xl bg-slate-100 px-3 py-3 font-normal"
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Severity
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="mt-1.5 w-full rounded-xl bg-slate-100 px-3 py-3 font-normal"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Due date
          <input
            type="date"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="mt-1.5 w-full rounded-xl bg-slate-100 px-3 py-3 font-normal"
          />
        </label>
      </div>
      <div className="mt-5 flex justify-end">
        <CustomButton onClick={save} loading={isLoading}>
          Assign finding
        </CustomButton>
      </div>
    </SimpleModal>
  );
}

function RemediationModal({
  finding,
  onClose,
  onSaved,
}: {
  finding: IComplianceFinding | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mutation, isLoading } = useMutation();
  const [plan, setPlan] = useState('');
  const [files, setFiles] = useState<IViewerFile[]>([]);
  const upload = async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    const response = await mutation('upload', {
      method: 'POST',
      body: form,
      isFormData: true,
      dedupe: false,
    });
    const uploaded = response?.results?.data as { url?: string; filename?: string } | undefined;
    if (!uploaded?.url) return false;
    setFiles((current) => [
      ...current,
      { url: uploaded.url!, name: uploaded.filename ?? file.name },
    ]);
    return true;
  };
  const save = async () => {
    if (!finding || plan.trim().length < 10 || !files.length) {
      toast.error('Add a corrective-action plan and supporting evidence');
      return;
    }
    const response = await mutation(`compliance-workspace/findings/${finding._id}/remediation`, {
      method: 'PATCH',
      body: { remediationPlan: plan, evidenceFiles: files.map(({ name, url }) => ({ name, url })) },
    });
    if (!response?.results?.success) return;
    toast.success('Remediation submitted for verification');
    onSaved();
    onClose();
  };
  return (
    <SimpleModal open={Boolean(finding)} title="Submit remediation evidence" onClose={onClose}>
      <label className="text-sm font-semibold text-slate-700">
        Corrective-action plan
        <textarea
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          rows={5}
          className="mt-1.5 w-full rounded-xl bg-slate-100 px-3 py-3 font-normal"
        />
      </label>
      <div className="mt-4">
        <InlineFileUpload
          label="Remediation evidence"
          multiple
          files={files}
          onUpload={upload}
          onRemove={async (_file, index) =>
            setFiles((current) => current.filter((_, i) => i !== index))
          }
        />
      </div>
      <div className="mt-5 flex justify-end">
        <CustomButton onClick={save} loading={isLoading}>
          Submit for verification
        </CustomButton>
      </div>
    </SimpleModal>
  );
}

function SimpleModal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-200/80 p-4 backdrop-blur-sm">
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6"
          >
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold text-slate-900">{title}</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-slate-100 p-2 text-slate-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {children}
          </motion.section>
        </div>
      )}
    </AnimatePresence>
  );
}
