/**
 * @file ResearchDevelopmentPage.tsx
 * @description Governed R&D workspace: proposal, ethics, grant execution,
 * milestones, IP, publications, evidence and closure.
 */
'use client';

import AsyncSelect from '@/shared/core/AsyncSelect';
import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { Action, Column } from '@/shared/core/CustomTable';
import Empty from '@/shared/core/Empty';
import InlineFileUpload from '@/shared/core/InlineFileUpload';
import type { IViewerFile } from '@/shared/core/FileViewer';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { motion } from '@/shared/utils/motion';
import {
  BookOpen,
  CheckCircle2,
  Edit2,
  FileCheck2,
  FlaskConical,
  Landmark,
  Plus,
  ShieldCheck,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';

type TProjectStatus =
  | 'proposed'
  | 'ethics_review'
  | 'approved'
  | 'ongoing'
  | 'on_hold'
  | 'completed'
  | 'rejected'
  | 'closed';

interface IMilestone {
  _id?: string;
  title: string;
  dueAt: string;
  status: 'pending' | 'completed' | 'overdue';
  completedAt?: string;
  evidenceUrl?: string;
}

interface IProject {
  _id: string;
  projectCode: string;
  title: string;
  abstractText?: string;
  fundingAgency?: string;
  grantAmount?: number;
  sanctionedAmount?: number;
  expenditureAmount: number;
  ethicsRequired: boolean;
  ethicsStatus: 'not_required' | 'pending' | 'approved' | 'rejected';
  ethicsReference?: string;
  status: TProjectStatus;
  startDate?: string;
  endDate?: string;
  outcomes?: string;
  principalInvestigator?: { _id?: string; name?: string } | string;
  department?: { _id?: string; name?: string; code?: string } | string;
  milestones: IMilestone[];
  utilizationCertificates: Array<{
    period: string;
    amount: number;
    certificateUrl: string;
    submittedAt?: string;
  }>;
  intellectualProperty: Array<{
    title: string;
    type: 'patent' | 'copyright' | 'trademark' | 'design';
    applicationNumber?: string;
    status: 'draft' | 'filed' | 'published' | 'granted' | 'abandoned';
  }>;
  documents: Array<{ name: string; url: string }>;
  [key: string]: unknown;
}

interface IPublication {
  _id: string;
  title: string;
  kind: 'journal' | 'conference' | 'patent' | 'book' | 'chapter';
  year: number;
  venue?: string;
  authorsText?: string;
  doi?: string;
  abstractText?: string;
  department?: { _id?: string; name?: string } | string;
  verificationStatus: 'draft' | 'submitted' | 'verified' | 'rejected';
  evidenceUrl?: string;
  [key: string]: unknown;
}

interface IStats {
  projectsTotal: number;
  ongoing: number;
  completed: number;
  publicationsTotal: number;
}

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15';
const labelClass = 'mb-1 block text-xs font-medium text-slate-600';
const statusClass: Record<string, string> = {
  proposed: 'bg-slate-100 text-slate-700',
  ethics_review: 'bg-violet-50 text-violet-700',
  approved: 'bg-blue-50 text-blue-700',
  ongoing: 'bg-emerald-50 text-emerald-700',
  on_hold: 'bg-amber-50 text-amber-700',
  completed: 'bg-teal-50 text-teal-700',
  closed: 'bg-slate-800 text-white',
  rejected: 'bg-red-50 text-red-600',
  draft: 'bg-slate-100 text-slate-700',
  submitted: 'bg-blue-50 text-blue-700',
  verified: 'bg-emerald-50 text-emerald-700',
};

function StatusBadge({ value }: { value: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
        statusClass[value] ?? 'bg-slate-100 text-slate-600'
      }`}
    >
      {value.replaceAll('_', ' ')}
    </span>
  );
}

function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-200/80 p-4">
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className={`max-h-[92dvh] w-full overflow-y-auto rounded-2xl bg-white ${
          wide ? 'max-w-4xl' : 'max-w-2xl'
        }`}
      >
        <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-slate-100 bg-white px-5 py-4">
          <div>
            <h2 className="font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="ml-auto text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </motion.div>
    </div>
  );
}

function ProjectForm({
  project,
  onClose,
  onSaved,
}: {
  project?: IProject;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mutation, isLoading } = useMutation();
  const [title, setTitle] = useState(project?.title ?? '');
  const [abstractText, setAbstractText] = useState(project?.abstractText ?? '');
  const [principalInvestigator, setPrincipalInvestigator] = useState(
    typeof project?.principalInvestigator === 'object'
      ? String(project.principalInvestigator?._id ?? '')
      : String(project?.principalInvestigator ?? ''),
  );
  const [department, setDepartment] = useState(
    typeof project?.department === 'object'
      ? String(project.department?._id ?? '')
      : String(project?.department ?? ''),
  );
  const [fundingAgency, setFundingAgency] = useState(project?.fundingAgency ?? '');
  const [grantAmount, setGrantAmount] = useState(String(project?.grantAmount ?? ''));
  const [startDate, setStartDate] = useState(project?.startDate?.slice(0, 10) ?? '');
  const [endDate, setEndDate] = useState(project?.endDate?.slice(0, 10) ?? '');
  const [ethicsRequired, setEthicsRequired] = useState(project?.ethicsRequired ?? false);

  const save = async () => {
    if (!title.trim() || !principalInvestigator) {
      toast.error('Project title and principal investigator are required');
      return;
    }
    const response = await mutation(
      project ? `research-development/projects/${project._id}` : 'research-development/projects',
      {
        method: project ? 'PATCH' : 'POST',
        body: {
          title: title.trim(),
          abstractText: abstractText.trim() || undefined,
          principalInvestigator,
          department: department || undefined,
          fundingAgency: fundingAgency.trim() || undefined,
          grantAmount: grantAmount ? Number(grantAmount) : undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          ethicsRequired,
        },
      },
    );
    if (!response?.results?.success) return;
    toast.success(project ? 'Project details updated' : 'Research proposal created');
    onSaved();
  };

  return (
    <Modal
      title={project ? 'Edit research proposal' : 'New research proposal'}
      subtitle="The project code and governance status are generated automatically."
      onClose={onClose}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelClass}>Project title *</label>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Clear, outcome-focused research title"
            className={inputClass}
          />
        </div>
        <AsyncSelect
          type="faculty"
          label="Principal Investigator"
          required
          value={principalInvestigator}
          onChange={(value) => setPrincipalInvestigator(value ?? '')}
          placeholder="Search faculty"
        />
        <AsyncSelect
          type="departments"
          label="Department"
          value={department}
          onChange={(value) => setDepartment(value ?? '')}
        />
        <div>
          <label className={labelClass}>Funding agency</label>
          <input
            value={fundingAgency}
            onChange={(event) => setFundingAgency(event.target.value)}
            placeholder="DST, SERB, UGC or internal"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Proposed grant (₹)</label>
          <input
            type="number"
            min={0}
            value={grantAmount}
            onChange={(event) => setGrantAmount(event.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Planned start</label>
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Planned completion</label>
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Research abstract</label>
          <textarea
            rows={4}
            value={abstractText}
            onChange={(event) => setAbstractText(event.target.value)}
            placeholder="Problem, method, expected outcomes and impact"
            className={inputClass}
          />
        </div>
        <label className="flex items-start gap-3 rounded-xl bg-violet-50 p-3 text-sm text-violet-800 sm:col-span-2">
          <input
            type="checkbox"
            checked={ethicsRequired}
            onChange={(event) => setEthicsRequired(event.target.checked)}
            className="mt-0.5"
          />
          <span>
            <strong className="block text-xs">Ethics review required</strong>
            <span className="text-xs text-violet-600">
              Select this for human participants, animals, sensitive personal data or controlled
              experimentation.
            </span>
          </span>
        </label>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <CustomButton variant="tertiary" onClick={onClose}>
          Cancel
        </CustomButton>
        <CustomButton variant="primary" onClick={save} loading={isLoading}>
          {project ? 'Save Changes' : 'Create Proposal'}
        </CustomButton>
      </div>
    </Modal>
  );
}

function PublicationForm({
  publication,
  onClose,
  onSaved,
}: {
  publication?: IPublication;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mutation, isLoading } = useMutation();
  const [title, setTitle] = useState(publication?.title ?? '');
  const [kind, setKind] = useState<IPublication['kind']>(publication?.kind ?? 'journal');
  const [year, setYear] = useState(String(publication?.year ?? new Date().getFullYear()));
  const [venue, setVenue] = useState(publication?.venue ?? '');
  const [authorsText, setAuthorsText] = useState(publication?.authorsText ?? '');
  const [doi, setDoi] = useState(publication?.doi ?? '');
  const [abstractText, setAbstractText] = useState(publication?.abstractText ?? '');
  const [department, setDepartment] = useState(
    typeof publication?.department === 'object'
      ? String(publication.department?._id ?? '')
      : String(publication?.department ?? ''),
  );
  const [evidence, setEvidence] = useState<IViewerFile[]>(
    publication?.evidenceUrl
      ? [{ name: 'Publication evidence', url: publication.evidenceUrl }]
      : [],
  );

  const uploadEvidence = async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    const response = await mutation('upload', {
      method: 'POST',
      body: form,
      isFormData: true,
      dedupe: false,
    });
    const data = response?.results?.data as
      | { url?: string; filename?: string; publicId?: string }
      | undefined;
    if (!data?.url) return false;
    setEvidence([{ name: data.filename ?? file.name, url: data.url }]);
    return true;
  };

  const save = async () => {
    if (!title.trim() || !year) {
      toast.error('Title and publication year are required');
      return;
    }
    const response = await mutation(
      publication
        ? `research-development/publications/${publication._id}`
        : 'research-development/publications',
      {
        method: publication ? 'PATCH' : 'POST',
        body: {
          title: title.trim(),
          kind,
          year: Number(year),
          venue: venue.trim() || undefined,
          authorsText: authorsText.trim() || undefined,
          doi: doi.trim() || undefined,
          abstractText: abstractText.trim() || undefined,
          department: department || undefined,
          evidenceUrl: evidence[0]?.url,
        },
      },
    );
    if (!response?.results?.success) return;
    toast.success(publication ? 'Publication updated' : 'Publication draft created');
    onSaved();
  };

  return (
    <Modal
      title={publication ? 'Edit publication record' : 'Add publication'}
      subtitle="Create a draft, attach evidence, then submit it for independent verification."
      onClose={onClose}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelClass}>Title *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Publication type *</label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as IPublication['kind'])}
            className={inputClass}
          >
            <option value="journal">Journal article</option>
            <option value="conference">Conference paper</option>
            <option value="book">Book</option>
            <option value="chapter">Book chapter</option>
            <option value="patent">Patent publication</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Year *</label>
          <input
            type="number"
            min={1900}
            max={new Date().getFullYear() + 1}
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className={inputClass}
          />
        </div>
        <AsyncSelect
          type="departments"
          label="Department"
          value={department}
          onChange={(value) => setDepartment(value ?? '')}
        />
        <div>
          <label className={labelClass}>Journal / conference / publisher</label>
          <input value={venue} onChange={(e) => setVenue(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Authors</label>
          <input
            value={authorsText}
            onChange={(e) => setAuthorsText(e.target.value)}
            placeholder="Author names in published order"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>DOI</label>
          <input
            value={doi}
            onChange={(e) => setDoi(e.target.value)}
            placeholder="10.xxxx/..."
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Abstract</label>
          <textarea
            rows={3}
            value={abstractText}
            onChange={(e) => setAbstractText(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-2">
          <InlineFileUpload
            label="Published paper / acceptance evidence"
            files={evidence}
            onUpload={uploadEvidence}
            onRemove={async () => setEvidence([])}
            hint="PDF or image, maximum 5 MB"
          />
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <CustomButton variant="tertiary" onClick={onClose}>
          Cancel
        </CustomButton>
        <CustomButton variant="primary" onClick={save} loading={isLoading}>
          Save Publication
        </CustomButton>
      </div>
    </Modal>
  );
}

function ProjectWorkspace({
  project,
  onClose,
  onSaved,
}: {
  project: IProject;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mutation, isLoading } = useMutation();
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneDue, setMilestoneDue] = useState('');
  const [ipTitle, setIpTitle] = useState('');
  const [ipType, setIpType] = useState<'patent' | 'copyright' | 'trademark' | 'design'>('patent');
  const [sanctionedAmount, setSanctionedAmount] = useState(String(project.sanctionedAmount ?? ''));
  const [expenditureAmount, setExpenditureAmount] = useState(
    String(project.expenditureAmount ?? 0),
  );
  const [outcomes, setOutcomes] = useState(project.outcomes ?? '');
  const [certificatePeriod, setCertificatePeriod] = useState('');
  const [certificateAmount, setCertificateAmount] = useState('');
  const [certificate, setCertificate] = useState<IViewerFile[]>([]);

  const patch = async (body: Record<string, unknown>, success: string) => {
    const response = await mutation(`research-development/projects/${project._id}`, {
      method: 'PATCH',
      body,
    });
    if (!response?.results?.success) return;
    toast.success(success);
    onSaved();
  };

  const uploadCertificate = async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    const response = await mutation('upload', {
      method: 'POST',
      body: form,
      isFormData: true,
      dedupe: false,
    });
    const data = response?.results?.data as { url?: string; filename?: string } | undefined;
    if (!data?.url) return false;
    setCertificate([{ name: data.filename ?? file.name, url: data.url }]);
    return true;
  };

  const transition = async (status: TProjectStatus) => {
    let body: Record<string, unknown> = { status };
    if (status === 'approved' && project.ethicsRequired) {
      const answer = await Swal.fire({
        title: 'Approve ethics review?',
        input: 'text',
        inputLabel: 'Ethics committee reference',
        inputValidator: (value) =>
          value.trim().length < 3 ? 'Enter the committee reference' : undefined,
        showCancelButton: true,
      });
      if (!answer.isConfirmed) return;
      body = {
        status,
        ethicsStatus: 'approved',
        ethicsReference: answer.value.trim(),
      };
    } else {
      const answer = await Swal.fire({
        title: `Move project to ${status.replaceAll('_', ' ')}?`,
        icon: status === 'rejected' ? 'warning' : 'question',
        showCancelButton: true,
        confirmButtonText: 'Confirm',
        confirmButtonColor: status === 'rejected' ? '#dc2626' : '#0178D7',
      });
      if (!answer.isConfirmed) return;
      if (status === 'rejected' && project.ethicsRequired && project.status === 'ethics_review') {
        body.ethicsStatus = 'rejected';
      }
    }
    await patch(body, `Project moved to ${status.replaceAll('_', ' ')}`);
  };

  const nextActions: Array<{ status: TProjectStatus; label: string }> =
    project.status === 'proposed'
      ? [
          { status: 'approved', label: 'Approve Proposal' },
          { status: 'rejected', label: 'Reject' },
        ]
      : project.status === 'ethics_review'
        ? [
            { status: 'approved', label: 'Approve Ethics & Project' },
            { status: 'rejected', label: 'Reject' },
          ]
        : project.status === 'approved'
          ? [{ status: 'ongoing', label: 'Start Project' }]
          : project.status === 'ongoing'
            ? [
                { status: 'on_hold', label: 'Put On Hold' },
                { status: 'completed', label: 'Complete Project' },
              ]
            : project.status === 'on_hold'
              ? [{ status: 'ongoing', label: 'Resume Project' }]
              : project.status === 'completed'
                ? [{ status: 'closed', label: 'Close Project' }]
                : [];

  return (
    <Modal
      title={project.title}
      subtitle={`${project.projectCode} · Governed project workspace`}
      onClose={onClose}
      wide
    >
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <StatusBadge value={project.status} />
        <StatusBadge value={project.ethicsStatus} />
        <span className="text-xs text-slate-500">
          PI:{' '}
          {typeof project.principalInvestigator === 'object'
            ? project.principalInvestigator?.name
            : 'Assigned investigator'}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          {nextActions.map((action) => (
            <CustomButton
              key={action.status}
              variant={action.status === 'rejected' ? 'tertiary' : 'primary'}
              onClick={() => transition(action.status)}
              loading={isLoading}
              className="w-fit!"
            >
              {action.label}
            </CustomButton>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-slate-800">Grant utilization</h3>
          <p className="mt-1 text-xs text-slate-500">
            Sanction and expenditure remain bounded by the approved grant.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Sanctioned amount (₹)</label>
              <input
                type="number"
                min={0}
                value={sanctionedAmount}
                onChange={(e) => setSanctionedAmount(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Expenditure to date (₹)</label>
              <input
                type="number"
                min={0}
                value={expenditureAmount}
                onChange={(e) => setExpenditureAmount(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <CustomButton
            variant="secondary"
            className="mt-3 w-fit!"
            onClick={() =>
              patch(
                {
                  sanctionedAmount: Number(sanctionedAmount || 0),
                  expenditureAmount: Number(expenditureAmount || 0),
                },
                'Grant utilization updated',
              )
            }
          >
            Save Grant Position
          </CustomButton>
          <div className="mt-4 border-t border-slate-200 pt-4">
            <p className="text-xs font-semibold text-slate-700">Utilization certificate</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input
                value={certificatePeriod}
                onChange={(e) => setCertificatePeriod(e.target.value)}
                placeholder="Period, e.g. Apr–Sep 2026"
                className={inputClass}
              />
              <input
                type="number"
                min={0}
                value={certificateAmount}
                onChange={(e) => setCertificateAmount(e.target.value)}
                placeholder="Certified amount"
                className={inputClass}
              />
            </div>
            <div className="mt-2">
              <InlineFileUpload
                files={certificate}
                onUpload={uploadCertificate}
                onRemove={async () => setCertificate([])}
                hint="Upload signed utilization certificate"
              />
            </div>
            <CustomButton
              variant="secondary"
              className="mt-2 w-fit!"
              onClick={() => {
                if (!certificatePeriod.trim() || !certificateAmount || !certificate[0]?.url) {
                  toast.error('Period, certified amount and certificate file are required');
                  return;
                }
                patch(
                  {
                    utilizationCertificates: [
                      ...(project.utilizationCertificates ?? []),
                      {
                        period: certificatePeriod.trim(),
                        amount: Number(certificateAmount),
                        certificateUrl: certificate[0].url,
                        submittedAt: new Date().toISOString(),
                      },
                    ],
                  },
                  'Utilization certificate recorded',
                );
              }}
            >
              Record Certificate
            </CustomButton>
          </div>
        </section>

        <section className="rounded-xl bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-slate-800">Milestones</h3>
          <div className="mt-3 space-y-2">
            {project.milestones?.map((milestone, index) => (
              <div
                key={milestone._id ?? `${milestone.title}-${index}`}
                className="rounded-lg bg-white p-3"
              >
                <div className="flex items-center gap-2">
                  <div>
                    <p className="text-xs font-medium text-slate-700">{milestone.title}</p>
                    <p className="text-[11px] text-slate-600">
                      Due {new Date(milestone.dueAt).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                  <StatusBadge value={milestone.status} />
                  {milestone.status !== 'completed' && (
                    <button
                      type="button"
                      className="ml-auto text-xs font-medium text-emerald-600"
                      onClick={() =>
                        patch(
                          {
                            milestones: project.milestones.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    status: 'completed',
                                    completedAt: new Date().toISOString(),
                                  }
                                : item,
                            ),
                          },
                          'Milestone completed',
                        )
                      }
                    >
                      Mark complete
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!project.milestones?.length && (
              <p className="py-3 text-center text-xs text-slate-600">No milestones added yet.</p>
            )}
          </div>
          <div className="mt-3 grid grid-cols-[1fr_150px_auto] gap-2">
            <input
              value={milestoneTitle}
              onChange={(e) => setMilestoneTitle(e.target.value)}
              placeholder="Milestone"
              className={inputClass}
            />
            <input
              type="date"
              value={milestoneDue}
              onChange={(e) => setMilestoneDue(e.target.value)}
              className={inputClass}
            />
            <CustomButton
              variant="secondary"
              className="w-fit!"
              onClick={() => {
                if (!milestoneTitle.trim() || !milestoneDue) {
                  toast.error('Milestone and due date are required');
                  return;
                }
                patch(
                  {
                    milestones: [
                      ...(project.milestones ?? []),
                      { title: milestoneTitle.trim(), dueAt: milestoneDue, status: 'pending' },
                    ],
                  },
                  'Milestone added',
                );
              }}
            >
              Add
            </CustomButton>
          </div>
        </section>

        <section className="rounded-xl bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-slate-800">Intellectual property</h3>
          <div className="mt-3 space-y-2">
            {project.intellectualProperty?.map((item, index) => (
              <div
                key={`${item.title}-${index}`}
                className="flex items-center rounded-lg bg-white p-3"
              >
                <div>
                  <p className="text-xs font-medium text-slate-700">{item.title}</p>
                  <p className="text-[11px] capitalize text-slate-600">{item.type}</p>
                </div>
                <StatusBadge value={item.status} />
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-[1fr_140px_auto] gap-2">
            <input
              value={ipTitle}
              onChange={(e) => setIpTitle(e.target.value)}
              placeholder="Invention / work title"
              className={inputClass}
            />
            <select
              value={ipType}
              onChange={(e) => setIpType(e.target.value as typeof ipType)}
              className={inputClass}
            >
              <option value="patent">Patent</option>
              <option value="copyright">Copyright</option>
              <option value="trademark">Trademark</option>
              <option value="design">Design</option>
            </select>
            <CustomButton
              variant="secondary"
              className="w-fit!"
              onClick={() => {
                if (!ipTitle.trim()) return;
                patch(
                  {
                    intellectualProperty: [
                      ...(project.intellectualProperty ?? []),
                      { title: ipTitle.trim(), type: ipType, status: 'draft' },
                    ],
                  },
                  'IP record added',
                );
              }}
            >
              Add
            </CustomButton>
          </div>
        </section>

        <section className="rounded-xl bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-slate-800">Outcomes and closure</h3>
          <p className="mt-1 text-xs text-slate-500">
            Record measurable outcomes before completing and closing the project.
          </p>
          <textarea
            rows={5}
            value={outcomes}
            onChange={(e) => setOutcomes(e.target.value)}
            placeholder="Research findings, publications, prototypes, social or industry impact"
            className={`${inputClass} mt-3`}
          />
          <CustomButton
            variant="secondary"
            className="mt-3 w-fit!"
            onClick={() => patch({ outcomes: outcomes.trim() }, 'Project outcomes updated')}
          >
            Save Outcomes
          </CustomButton>
          {!!project.sanctionedAmount && !project.utilizationCertificates?.length && (
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
              A utilization certificate is required before project completion.
            </p>
          )}
        </section>
      </div>
    </Modal>
  );
}

export default function ResearchDevelopmentPage() {
  const [tab, setTab] = useState<'projects' | 'publications'>('projects');
  const [projectForm, setProjectForm] = useState<IProject | null | undefined>(undefined);
  const [publicationForm, setPublicationForm] = useState<IPublication | null | undefined>(
    undefined,
  );
  const [workspace, setWorkspace] = useState<IProject | null>(null);
  const { mutation, isLoading: acting } = useMutation();
  const canCreate = useHasPermission('research', 'create');
  const canEdit = useHasPermission('research', 'edit');
  const canDelete = useHasPermission('research', 'delete');

  const {
    data: projectRaw,
    isLoading: projectLoading,
    mutate: refreshProjects,
  } = useSwr('research-development/projects');
  const {
    data: publicationRaw,
    isLoading: publicationLoading,
    mutate: refreshPublications,
  } = useSwr('research-development/publications');
  const { data: statsRaw } = useSwr('research-development/projects/stats');
  const projects: IProject[] = (projectRaw as { data?: IProject[] })?.data ?? [];
  const publications: IPublication[] = (publicationRaw as { data?: IPublication[] })?.data ?? [];
  const stats = (statsRaw as { data?: IStats })?.data;

  const workflow = [
    'Proposal',
    'Ethics & approval',
    'Grant execution',
    'Milestones',
    'Outputs & IP',
    'Closure',
  ];

  const remove = async (type: 'projects' | 'publications', row: IProject | IPublication) => {
    const answer = await Swal.fire({
      title: `Remove ${type === 'projects' ? 'project' : 'publication'} draft?`,
      text: row.title,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Remove Draft',
      confirmButtonColor: '#dc2626',
    });
    if (!answer.isConfirmed) return;
    const response = await mutation(`research-development/${type}/${row._id}`, {
      method: 'DELETE',
    });
    if (!response?.results?.success) return;
    toast.success('Draft removed and retained in the audit trail');
    if (type === 'projects') refreshProjects();
    else refreshPublications();
  };

  const publicationTransition = async (
    publication: IPublication,
    verificationStatus: IPublication['verificationStatus'],
  ) => {
    const response = await mutation(`research-development/publications/${publication._id}`, {
      method: 'PATCH',
      body: { verificationStatus },
    });
    if (!response?.results?.success) return;
    toast.success(`Publication ${verificationStatus}`);
    refreshPublications();
  };

  const projectColumns: Column<IProject>[] = [
    {
      field: 'projectCode',
      title: 'Project',
      render: (row) => (
        <div>
          <p className="text-sm font-semibold text-slate-800">{row.title}</p>
          <p className="text-xs text-slate-600">{row.projectCode}</p>
        </div>
      ),
    },
    {
      field: 'principalInvestigator',
      title: 'Principal Investigator',
      render: (row) =>
        typeof row.principalInvestigator === 'object'
          ? (row.principalInvestigator?.name ?? 'Assigned faculty')
          : 'Assigned faculty',
    },
    {
      field: 'fundingAgency',
      title: 'Grant',
      render: (row) => (
        <div>
          <p className="text-xs text-slate-700">{row.fundingAgency ?? 'Internal / unfunded'}</p>
          <p className="text-xs text-slate-600">
            {row.grantAmount ? `₹${row.grantAmount.toLocaleString('en-IN')}` : 'No grant recorded'}
          </p>
        </div>
      ),
    },
    {
      field: 'ethicsStatus',
      title: 'Ethics',
      render: (row) => <StatusBadge value={row.ethicsStatus} />,
    },
    {
      field: 'status',
      title: 'Project Status',
      render: (row) => <StatusBadge value={row.status} />,
    },
  ];

  const projectActions: Action<IProject>[] = [
    {
      tooltip: 'Open governed workspace',
      icon: <FileCheck2 className="h-4 w-4 text-primary" />,
      onClick: setWorkspace,
    },
    {
      tooltip: 'Edit proposal',
      icon: <Edit2 className="h-4 w-4 text-slate-500" />,
      onClick: (row) => setProjectForm(row),
      hidden: (row) => !canEdit || !['proposed', 'ethics_review', 'rejected'].includes(row.status),
    },
    {
      tooltip: 'Remove draft',
      icon: <Trash2 className="h-4 w-4 text-red-500" />,
      onClick: (row) => remove('projects', row),
      hidden: (row) => !canDelete || !['proposed', 'rejected'].includes(row.status),
    },
  ];

  const publicationColumns: Column<IPublication>[] = [
    {
      field: 'title',
      title: 'Publication',
      render: (row) => (
        <div>
          <p className="text-sm font-semibold text-slate-800">{row.title}</p>
          <p className="text-xs capitalize text-slate-600">
            {row.kind} · {row.year}
          </p>
        </div>
      ),
    },
    { field: 'authorsText', title: 'Authors', render: (row) => row.authorsText ?? '—' },
    { field: 'venue', title: 'Venue / Publisher', render: (row) => row.venue ?? '—' },
    { field: 'doi', title: 'DOI', render: (row) => row.doi ?? '—' },
    {
      field: 'verificationStatus',
      title: 'Verification',
      render: (row) => <StatusBadge value={row.verificationStatus} />,
    },
  ];

  const publicationActions: Action<IPublication>[] = [
    {
      tooltip: 'Edit',
      icon: <Edit2 className="h-4 w-4 text-slate-500" />,
      onClick: (row) => setPublicationForm(row),
      hidden: (row) => !canEdit || !['draft', 'rejected'].includes(row.verificationStatus),
    },
    {
      tooltip: 'Submit for verification',
      icon: <FileCheck2 className="h-4 w-4 text-blue-600" />,
      onClick: (row) => publicationTransition(row, 'submitted'),
      hidden: (row) => !canEdit || row.verificationStatus !== 'draft' || !row.evidenceUrl,
    },
    {
      tooltip: 'Verify publication',
      icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
      onClick: (row) => publicationTransition(row, 'verified'),
      hidden: (row) => !canEdit || row.verificationStatus !== 'submitted',
    },
    {
      tooltip: 'Reject verification',
      icon: <XCircle className="h-4 w-4 text-red-500" />,
      onClick: (row) => publicationTransition(row, 'rejected'),
      hidden: (row) => !canEdit || row.verificationStatus !== 'submitted',
    },
    {
      tooltip: 'Remove draft',
      icon: <Trash2 className="h-4 w-4 text-red-500" />,
      onClick: (row) => remove('publications', row),
      hidden: (row) => !canDelete || !['draft', 'rejected'].includes(row.verificationStatus),
    },
  ];

  const cards = [
    {
      label: 'Research Projects',
      value: stats?.projectsTotal ?? projects.length,
      icon: FlaskConical,
      tone: 'bg-primary-50 text-primary',
    },
    {
      label: 'Active Projects',
      value: stats?.ongoing ?? projects.filter((item) => item.status === 'ongoing').length,
      icon: Landmark,
      tone: 'bg-emerald-50 text-emerald-600',
    },
    {
      label: 'Completed',
      value: stats?.completed ?? projects.filter((item) => item.status === 'completed').length,
      icon: ShieldCheck,
      tone: 'bg-violet-50 text-violet-600',
    },
    {
      label: 'Publications',
      value: stats?.publicationsTotal ?? publications.length,
      icon: BookOpen,
      tone: 'bg-amber-50 text-amber-600',
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Research & Development</h1>
        <p className="mt-1 text-sm text-slate-500">
          Govern proposals, ethics, grants, progress, intellectual property and verified research
          outputs.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white p-3">
        <div className="flex min-w-max items-center">
          {workflow.map((label, index) => (
            <React.Fragment key={label}>
              <div className="flex items-center gap-2 px-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary">
                  {index + 1}
                </span>
                <span className="text-xs font-medium text-slate-600">{label}</span>
              </div>
              {index < workflow.length - 1 && <span className="h-px w-6 bg-slate-200" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="flex items-center gap-3 rounded-xl bg-white p-4">
            <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}>
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xl font-bold text-slate-900">{value}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl bg-white p-1">
          {(['projects', 'publications'] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`rounded-lg px-4 py-2 text-sm font-medium capitalize ${
                tab === item ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
        {canCreate && (
          <CustomButton
            variant="primary"
            startIcon={<Plus className="h-4 w-4" />}
            onClick={() => (tab === 'projects' ? setProjectForm(null) : setPublicationForm(null))}
            className="ml-auto w-fit!"
          >
            {tab === 'projects' ? 'New Research Proposal' : 'Add Publication'}
          </CustomButton>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl bg-white">
        {tab === 'projects' ? (
          !projectLoading && !projects.length ? (
            <Empty
              title="No research proposals yet"
              subTitle="Start with a principal investigator, department, project abstract and ethics requirement."
              pathName={canCreate ? 'Create Research Proposal' : undefined}
              onClick={canCreate ? () => setProjectForm(null) : undefined}
            />
          ) : (
            <CustomTable
              data={projects}
              columns={projectColumns}
              actions={projectActions}
              isLoading={projectLoading || acting}
              options={{ search: true, pagination: true, pageSize: 15 }}
              localization={{ toolbar: { searchPlaceholder: 'Search research projects…' } }}
            />
          )
        ) : !publicationLoading && !publications.length ? (
          <Empty
            title="No research publications yet"
            subTitle="Add a paper, book, chapter, conference output or patent and attach evidence for verification."
            pathName={canCreate ? 'Add Publication' : undefined}
            onClick={canCreate ? () => setPublicationForm(null) : undefined}
          />
        ) : (
          <CustomTable
            data={publications}
            columns={publicationColumns}
            actions={publicationActions}
            isLoading={publicationLoading || acting}
            options={{ search: true, pagination: true, pageSize: 15 }}
            localization={{ toolbar: { searchPlaceholder: 'Search publications…' } }}
          />
        )}
      </div>

      {projectForm !== undefined && (
        <ProjectForm
          project={projectForm ?? undefined}
          onClose={() => setProjectForm(undefined)}
          onSaved={() => {
            setProjectForm(undefined);
            refreshProjects();
          }}
        />
      )}
      {publicationForm !== undefined && (
        <PublicationForm
          publication={publicationForm ?? undefined}
          onClose={() => setPublicationForm(undefined)}
          onSaved={() => {
            setPublicationForm(undefined);
            refreshPublications();
          }}
        />
      )}
      {workspace && (
        <ProjectWorkspace
          project={workspace}
          onClose={() => setWorkspace(null)}
          onSaved={async () => {
            const refreshed = await mutation(`research-development/projects/${workspace._id}`, {
              method: 'GET',
            });
            const next = refreshed?.results?.data as IProject | undefined;
            if (next) setWorkspace(next);
            refreshProjects();
          }}
        />
      )}
    </div>
  );
}
