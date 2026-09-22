'use client';

import CustomButton from '@/shared/core/CustomButton';
import AsyncSelect from '@/shared/core/AsyncSelect';
import CustomTable, { Action, Column } from '@/shared/core/CustomTable';
import EngagementWorkflowBar from '@/shared/components/EngagementWorkflowBar';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { motion } from '@/shared/utils/motion';
import {
  CalendarClock,
  CheckCircle2,
  Eye,
  FileText,
  Info,
  Plus,
  RotateCcw,
  Send,
  ShieldBan,
  TriangleAlert,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { useAuthStore } from '@/shared/store/authStore';

type TChannel = 'in_app' | 'email' | 'push' | 'sms';
type TAudience = 'all' | 'students' | 'faculty' | 'parents' | 'admin' | 'specific_users';
interface IDepartment {
  _id: string;
  name: string;
  code: string;
}
interface IMetadata {
  channels: TChannel[];
  audiences: TAudience[];
  departments: IDepartment[];
  programs: string[];
  semesters: number[];
}
interface ITemplate {
  _id: string;
  name: string;
  category: string;
  subject: string;
  body: string;
  channels: TChannel[];
  variables: string[];
}
interface IChannelStat {
  channel: TChannel;
  queued: number;
  delivered: number;
  failed: number;
  status: string;
  message?: string;
}
interface ICampaign extends Record<string, unknown> {
  _id: string;
  title: string;
  audience: TAudience;
  channels: TChannel[];
  status: string;
  recipientCount: number;
  scheduledAt?: string;
  sentAt?: string;
  channelStats: IChannelStat[];
  createdAt: string;
  priority?: 'normal' | 'important' | 'emergency';
  requireAcknowledgement?: boolean;
  readCount?: number;
  unreadCount?: number;
  createdBy?: string | { _id?: string };
}
interface IAudiencePreview {
  matched: number;
  eligible: number;
  excluded: number;
  note: string;
}
interface IApiResponse<T> {
  success: boolean;
  data: T;
}
interface ISuppression {
  _id: string;
  channel: 'email' | 'sms';
  destinationHash: string;
  reason: string;
  active: boolean;
  createdAt: string;
}

const channelLabels: Record<TChannel, string> = {
  in_app: 'In-app',
  email: 'Email',
  push: 'Push',
  sms: 'SMS',
};
const fieldClass =
  'w-full rounded-xl bg-slate-100 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20';

export default function CommunicationHubPage() {
  const activeRole = useAuthStore(
    (state) => state.activeRole?.baseRole ?? state.activeRole?.name ?? state.role ?? '',
  );
  const userId = useAuthStore((state) => state.user?._id ?? '');
  const globalManagers = [
    'super_admin',
    'admin',
    'principal',
    'dean_academic',
    'administration_office',
  ];
  const canManageAll = globalManagers.includes(activeRole);
  const canManageSuppressions = ['super_admin', 'admin'].includes(activeRole);
  const idOf = (value?: string | { _id?: string }) =>
    typeof value === 'string' ? value : String(value?._id ?? '');
  const canMutateCampaign = (campaign: ICampaign) =>
    canManageAll || (!!userId && idOf(campaign.createdBy) === userId);
  const { data: metadataRaw, error: metadataError } = useSwr<IApiResponse<IMetadata>>(
    'communication-hub/metadata',
  );
  const {
    data: campaignsRaw,
    mutate: refreshCampaigns,
    isLoading: campaignsLoading,
    error: campaignsError,
  } = useSwr<IApiResponse<ICampaign[]>>('communication-hub/campaigns', {
    refreshInterval: 10000,
  });
  const {
    data: templatesRaw,
    error: templatesError,
    mutate: refreshTemplates,
  } = useSwr<IApiResponse<ITemplate[]>>('communication-hub/templates');
  const {
    data: suppressionsRaw,
    error: suppressionsError,
    mutate: refreshSuppressions,
  } = useSwr<IApiResponse<ISuppression[]>>(
    canManageSuppressions ? 'communication-hub/suppressions' : null,
  );
  const { mutation, isLoading } = useMutation();
  const metadata = metadataRaw?.data;
  const campaigns = useMemo(() => campaignsRaw?.data ?? [], [campaignsRaw]);
  const templates = useMemo(() => templatesRaw?.data ?? [], [templatesRaw]);
  const suppressions = useMemo(() => suppressionsRaw?.data ?? [], [suppressionsRaw]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<TAudience>('all');
  const [channels, setChannels] = useState<TChannel[]>(['in_app']);
  const [departments, setDepartments] = useState<string[]>([]);
  const [programs, setPrograms] = useState<string[]>([]);
  const [semesters, setSemesters] = useState<number[]>([]);
  const [scheduledAt, setScheduledAt] = useState('');
  const [targetUserIds, setTargetUserIds] = useState<string[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [category, setCategory] = useState('General');
  const [suppressionChannel, setSuppressionChannel] = useState<'email' | 'sms'>('email');
  const [suppressionDestination, setSuppressionDestination] = useState('');
  const [suppressionReason, setSuppressionReason] = useState('');
  const [priority, setPriority] = useState<'normal' | 'important' | 'emergency'>('normal');
  const [requireAcknowledgement, setRequireAcknowledgement] = useState(false);
  const [preview, setPreview] = useState<IAudiencePreview | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const { data: detailRaw, isLoading: detailLoading } = useSwr<IApiResponse<ICampaign>>(
    selectedCampaignId ? `communication-hub/campaigns/${selectedCampaignId}` : null,
    { refreshInterval: selectedCampaignId ? 5000 : 0 },
  );
  const campaignDetail = detailRaw?.data;

  const toggle = <T extends string | number>(
    items: T[],
    value: T,
    setter: (value: T[]) => void,
  ) => {
    setPreview(null);
    setter(items.includes(value) ? items.filter((item) => item !== value) : [...items, value]);
  };
  const applyTemplate = (template: ITemplate) => {
    setTitle(template.subject);
    setBody(template.body);
    setChannels(template.channels);
    setComposerOpen(true);
  };
  const sendCampaign = async () => {
    if (title.trim().length < 3 || body.trim().length < 3 || channels.length === 0) {
      toast.error('Add a title, message and delivery channel');
      return;
    }
    if (audience === 'specific_users' && targetUserIds.length === 0) {
      toast.error('Choose at least one recipient');
      return;
    }
    if (!preview) {
      toast.error(
        'Check the audience before sending so you can review the eligible recipient count',
      );
      return;
    }
    if (priority === 'emergency') {
      const confirmation = await Swal.fire({
        title: 'Send emergency communication?',
        text: `This interrupts normal communication for ${preview.eligible.toLocaleString('en-IN')} eligible recipients.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Send emergency message',
        confirmButtonColor: '#dc2626',
        focusCancel: true,
      });
      if (!confirmation.isConfirmed) return;
    }
    const response = await mutation('communication-hub/campaigns', {
      method: 'POST',
      body: {
        title,
        body,
        audience,
        channels,
        targetDepartments: departments,
        targetPrograms: programs,
        targetSemesters: semesters,
        targetUserIds: audience === 'specific_users' ? targetUserIds : undefined,
        scheduledAt: scheduledAt || undefined,
        priority,
        requireAcknowledgement,
      },
    });
    if (!response?.results?.success) return;
    toast.success(scheduledAt ? 'Campaign scheduled' : 'Campaign dispatched');
    await refreshCampaigns();
    setComposerOpen(false);
    setTitle('');
    setBody('');
    setScheduledAt('');
    setTargetUserIds([]);
    setPreview(null);
    setPriority('normal');
    setRequireAcknowledgement(false);
  };
  const previewAudience = async () => {
    if (!channels.length) {
      toast.error('Select at least one channel first');
      return;
    }
    const response = await mutation('communication-hub/audience-preview', {
      method: 'POST',
      body: {
        audience,
        channels,
        targetDepartments: departments,
        targetPrograms: programs,
        targetSemesters: semesters,
        targetUserIds: audience === 'specific_users' ? targetUserIds : undefined,
      },
    });
    const data = response?.results?.data as IAudiencePreview | undefined;
    if (response?.results?.success && data) setPreview(data);
  };
  const saveTemplate = async () => {
    if (templateName.trim().length < 2 || title.trim().length < 3 || body.trim().length < 3) {
      toast.error('Template name, subject and message are required');
      return;
    }
    const response = await mutation('communication-hub/templates', {
      method: 'POST',
      body: { name: templateName, category, subject: title, body, channels },
    });
    if (!response?.results?.success) return;
    toast.success('Template saved');
    await refreshTemplates();
    setTemplateOpen(false);
    setTemplateName('');
  };
  const cancel = async (campaign: ICampaign) => {
    const response = await mutation(`communication-hub/campaigns/${campaign._id}/cancel`, {
      method: 'POST',
    });
    if (!response?.results?.success) return;
    toast.success('Scheduled campaign cancelled');
    refreshCampaigns();
  };
  const addSuppression = async () => {
    if (suppressionDestination.trim().length < 3 || suppressionReason.trim().length < 10) {
      toast.error('Enter a destination and a reason of at least 10 characters');
      return;
    }
    const response = await mutation('communication-hub/suppressions', {
      method: 'POST',
      body: {
        channel: suppressionChannel,
        destination: suppressionDestination,
        reason: suppressionReason,
      },
    });
    if (!response?.results?.success) return;
    setSuppressionDestination('');
    setSuppressionReason('');
    await refreshSuppressions();
    toast.success('Destination added to the suppression list');
  };
  const releaseSuppression = async (entry: ISuppression) => {
    const response = await mutation(`communication-hub/suppressions/${entry._id}/release`, {
      method: 'POST',
    });
    if (!response?.results?.success) return;
    await refreshSuppressions();
    toast.success('Suppression released');
  };
  const retry = async (campaign: ICampaign) => {
    const result = await Swal.fire({
      title: 'Retry failed deliveries?',
      text: 'Explain why another delivery attempt is appropriate. Your reason is retained in the audit trail.',
      input: 'textarea',
      inputLabel: 'Reason for retry',
      inputPlaceholder:
        'For example: the provider outage is resolved and recipients still need this notice.',
      inputAttributes: { maxlength: '500', 'aria-label': 'Reason for retrying failed deliveries' },
      showCancelButton: true,
      confirmButtonText: 'Queue failed deliveries',
      confirmButtonColor: '#0178D7',
      inputValidator: (value) =>
        value.trim().length >= 10
          ? undefined
          : 'Enter a meaningful reason of at least 10 characters.',
    });
    if (!result.isConfirmed || typeof result.value !== 'string') return;
    const reason = result.value.trim();
    const response = await mutation(`communication-hub/campaigns/${campaign._id}/retry`, {
      method: 'POST',
      body: { reason },
    });
    if (!response?.results?.success) return;
    toast.success('Failed deliveries queued for retry');
    refreshCampaigns();
  };

  const columns: Column<ICampaign>[] = [
    {
      field: 'title',
      title: 'Campaign',
      render: (row) => (
        <div>
          <p className="font-semibold text-slate-900">{row.title}</p>
          {row.priority && row.priority !== 'normal' && (
            <p className="mt-0.5 text-[11px] font-bold uppercase text-amber-600">{row.priority}</p>
          )}
        </div>
      ),
    },
    {
      field: 'audience',
      title: 'Audience',
      render: (row) => <span className="capitalize">{row.audience.replace('_', ' ')}</span>,
    },
    {
      field: 'recipientCount',
      title: 'Recipients',
      render: (row) => row.recipientCount.toLocaleString('en-IN'),
    },
    {
      field: 'channels',
      title: 'Channels',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.channels.map((channel) => (
            <span
              key={channel}
              title={row.channelStats.find((stat) => stat.channel === channel)?.message}
              className={`rounded-lg px-2 py-1 text-xs font-semibold ${row.channelStats.find((stat) => stat.channel === channel)?.status === 'unavailable' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700'}`}
            >
              {channelLabels[channel]}
            </span>
          ))}
        </div>
      ),
    },
    { field: 'status', title: 'Status', render: (row) => <Status value={row.status} /> },
    {
      field: 'createdAt',
      title: 'Created',
      render: (row) => new Date(row.createdAt).toLocaleString('en-IN'),
    },
  ];
  const actions: Action<ICampaign>[] = [
    {
      icon: <Eye size={15} />,
      tooltip: 'View delivery report',
      onClick: (row) => setSelectedCampaignId(row._id),
    },
    {
      icon: <RotateCcw size={15} />,
      tooltip: 'Retry failed deliveries',
      onClick: retry,
      hidden: (row) =>
        !canMutateCampaign(row) || !row.channelStats.some((channel) => channel.failed > 0),
    },
    {
      icon: <XCircle size={15} />,
      tooltip: 'Cancel scheduled campaign',
      onClick: cancel,
      hidden: (row) => !canMutateCampaign(row) || row.status !== 'scheduled',
    },
  ];
  const delivered = campaigns.filter((row) => row.status === 'sent').length;
  const scheduled = campaigns.filter((row) => row.status === 'scheduled').length;
  const failedDeliveries = campaigns.reduce(
    (total, campaign) =>
      total + (campaign.channelStats ?? []).reduce((sum, channel) => sum + channel.failed, 0),
    0,
  );

  return (
    <div className="space-y-6 p-2 mb-10">
      <EngagementWorkflowBar />
      {(metadataError || templatesError || suppressionsError) && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          {metadataError?.message ||
            templatesError?.message ||
            suppressionsError?.message ||
            'Unable to load communication settings.'}
        </div>
      )}
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
            <Send className="h-4 w-4" /> Omnichannel communication
          </p>
          <h1 className="text-3xl font-black text-slate-950">Communication Hub</h1>
          <p className="mt-1 text-sm text-slate-500">
            Build the audience, review eligibility, deliver safely and follow every channel.
          </p>
        </div>
        <div className="flex gap-2">
          <CustomButton
            variant="secondary"
            onClick={() => setTemplateOpen(true)}
            startIcon={<FileText className="h-4 w-4" />}
          >
            New template
          </CustomButton>
          <CustomButton
            variant="primary"
            onClick={() => setComposerOpen(true)}
            startIcon={<Plus className="h-4 w-4" />}
          >
            New campaign
          </CustomButton>
        </div>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<Send />} label="All campaigns" value={campaigns.length} />
        <Metric icon={<CheckCircle2 />} label="Dispatched" value={delivered} />
        <Metric icon={<CalendarClock />} label="Scheduled" value={scheduled} />
        <Metric icon={<XCircle />} label="Delivery failures" value={failedDeliveries} />
      </div>
      <section className="grid gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 md:grid-cols-4">
        {[
          ['1', 'Choose audience', 'Use live people, programme and department data.'],
          ['2', 'Write & protect', 'Set priority, channel and acknowledgement.'],
          ['3', 'Verify reach', 'Preview opt-ins and suppressed recipients.'],
          ['4', 'Track delivery', 'Open any row for live channel and read progress.'],
        ].map(([step, heading, description]) => (
          <div key={step} className="flex gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-black text-white">
              {step}
            </span>
            <div>
              <p className="text-sm font-bold text-slate-900">{heading}</p>
              <p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p>
            </div>
          </div>
        ))}
      </section>
      {canManageSuppressions && (
        <section className="rounded-2xl bg-white p-5">
          <div className="mb-4 flex items-start gap-3">
            <div className="rounded-xl bg-rose-50 p-2 text-rose-600">
              <ShieldBan className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900">Delivery suppression</h2>
              <p className="text-xs text-slate-500">
                Block email or SMS destinations. Only one-way hashes are retained.
              </p>
            </div>
          </div>
          <div className="grid gap-2 lg:grid-cols-[120px_1fr_1fr_auto]">
            <select
              className={fieldClass}
              value={suppressionChannel}
              onChange={(event) => setSuppressionChannel(event.target.value as 'email' | 'sms')}
            >
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </select>
            <input
              className={fieldClass}
              value={suppressionDestination}
              onChange={(event) => setSuppressionDestination(event.target.value)}
              placeholder={suppressionChannel === 'email' ? 'person@example.com' : '+91…'}
            />
            <input
              className={fieldClass}
              value={suppressionReason}
              onChange={(event) => setSuppressionReason(event.target.value)}
              placeholder="Compliance or recipient request reason"
            />
            <CustomButton variant="secondary" onClick={addSuppression} loading={isLoading}>
              Suppress
            </CustomButton>
          </div>
          {suppressions.length > 0 && (
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {suppressions.slice(0, 8).map((entry) => (
                <div
                  key={entry._id}
                  className="flex items-center justify-between rounded-xl bg-slate-50 p-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase text-slate-500">
                      {entry.channel} · {entry.active ? 'Active' : 'Released'}
                    </p>
                    <p className="truncate text-sm text-slate-700">{entry.reason}</p>
                  </div>
                  {entry.active && (
                    <button
                      type="button"
                      aria-label="Release suppression"
                      onClick={() => releaseSuppression(entry)}
                      className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-primary"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      {templates.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-bold text-slate-700">Reusable templates</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {templates.map((template) => (
              <motion.button
                whileHover={{ y: -2 }}
                key={template._id}
                onClick={() => applyTemplate(template)}
                className="rounded-2xl bg-white p-4 text-left"
              >
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  {template.category}
                </span>
                <h3 className="mt-2 font-bold text-slate-900">{template.name}</h3>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">{template.subject}</p>
              </motion.button>
            ))}
          </div>
        </section>
      )}
      <section className="rounded-2xl bg-white p-4">
        {campaignsError ? (
          <GuidedState
            icon={<TriangleAlert />}
            title="Campaigns could not be loaded"
            message="Check the connection, then try loading the delivery workspace again."
            action="Try again"
            onAction={() => refreshCampaigns()}
          />
        ) : campaignsLoading ? (
          <div className="space-y-3 p-4">
            {[1, 2, 3].map((row) => (
              <div key={row} className="h-14 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : campaigns.length ? (
          <CustomTable<ICampaign> columns={columns} data={campaigns} actions={actions} />
        ) : (
          <GuidedState
            icon={<Send />}
            title="No campaigns yet"
            message="Create your first guided campaign. The audience is checked before anything is sent."
            action="Create campaign"
            onAction={() => setComposerOpen(true)}
          />
        )}
      </section>
      {composerOpen && (
        <Modal title="Compose campaign" onClose={() => setComposerOpen(false)}>
          <div className="grid gap-4">
            <SectionTitle
              step="1"
              title="Message"
              help="Keep the subject recognisable and the action clear."
            />
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Campaign title"
              className={fieldClass}
            />
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={6}
              placeholder="Message"
              className={fieldClass}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Priority</Label>
                <select
                  value={priority}
                  onChange={(event) =>
                    setPriority(event.target.value as 'normal' | 'important' | 'emergency')
                  }
                  className={fieldClass}
                >
                  <option value="normal">Normal — routine information</option>
                  <option value="important">Important — needs attention</option>
                  <option value="emergency">Emergency — urgent disruption</option>
                </select>
              </div>
              <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-3">
                <input
                  type="checkbox"
                  checked={requireAcknowledgement}
                  onChange={(event) => setRequireAcknowledgement(event.target.checked)}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-bold text-slate-800">
                    Request acknowledgement
                  </span>
                  <span className="text-xs text-slate-500">
                    Flag this message for explicit follow-up.
                  </span>
                </span>
              </label>
            </div>
            <SectionTitle
              step="2"
              title="Delivery"
              help="Recipients always follow their channel preferences."
            />
            <div>
              <Label>Delivery channels</Label>
              <ChoiceRow
                values={metadata?.channels ?? []}
                selected={channels}
                label={(value) => channelLabels[value]}
                onToggle={(value) => toggle(channels, value, setChannels)}
              />
            </div>
            <div>
              <SectionTitle
                step="3"
                title="Audience"
                help="Filters use current ERP records—not typed database IDs."
              />
              <Label>Audience</Label>
              <select
                value={audience}
                onChange={(event) => {
                  setAudience(event.target.value as TAudience);
                  setPreview(null);
                }}
                className={fieldClass}
              >
                {(metadata?.audiences ?? []).map((value) => (
                  <option key={value} value={value}>
                    {value === 'specific_users' ? 'Selected people' : value.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            {audience === 'specific_users' && (
              <AsyncSelect
                label="Recipients"
                type="users"
                multiple
                required
                value={targetUserIds}
                onChange={(value) => {
                  setTargetUserIds(value);
                  setPreview(null);
                }}
                placeholder="Search people by name or email"
              />
            )}
            {audience === 'students' && (
              <>
                <div>
                  <Label>Programs (optional)</Label>
                  <ChoiceRow
                    values={metadata?.programs ?? []}
                    selected={programs}
                    label={(value) => value}
                    onToggle={(value) => toggle(programs, value, setPrograms)}
                  />
                </div>
                <div>
                  <Label>Semesters (optional)</Label>
                  <ChoiceRow
                    values={metadata?.semesters ?? []}
                    selected={semesters}
                    label={(value) => `Sem ${value}`}
                    onToggle={(value) => toggle(semesters, value, setSemesters)}
                  />
                </div>
              </>
            )}
            <div>
              <Label>Departments (optional)</Label>
              <ChoiceRow
                values={metadata?.departments.map((department) => department._id) ?? []}
                selected={departments}
                label={(value) =>
                  metadata?.departments.find((department) => department._id === value)?.code ??
                  value
                }
                onToggle={(value) => toggle(departments, value, setDepartments)}
              />
            </div>
            <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <Users className="h-4 w-4 text-primary" /> Verify audience
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Check live eligibility, opt-ins and suppression before delivery.
                  </p>
                </div>
                <CustomButton variant="secondary" onClick={previewAudience} loading={isLoading}>
                  Check audience
                </CustomButton>
              </div>
              {preview && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <MiniStat label="Matched" value={preview.matched} />
                  <MiniStat label="Eligible" value={preview.eligible} tone="good" />
                  <MiniStat label="Excluded" value={preview.excluded} tone="warn" />
                  <p className="col-span-3 mt-1 text-xs text-slate-500">{preview.note}</p>
                </div>
              )}
            </div>
            <div>
              <Label>Schedule (leave empty to send now)</Label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(event) => setScheduledAt(event.target.value)}
                className={fieldClass}
              />
            </div>
            <div className="flex justify-end">
              <CustomButton variant="primary" onClick={sendCampaign} loading={isLoading}>
                {scheduledAt ? 'Schedule campaign' : 'Send campaign'}
              </CustomButton>
            </div>
          </div>
        </Modal>
      )}
      {selectedCampaignId && (
        <Modal title="Delivery report" onClose={() => setSelectedCampaignId(null)}>
          {detailLoading || !campaignDetail ? (
            <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
          ) : (
            <div className="space-y-5">
              <div className="rounded-2xl bg-white p-5 text-slate-900 ring-1 ring-slate-200">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-primary">
                      {campaignDetail.audience.replace('_', ' ')}
                    </p>
                    <h3 className="mt-1 text-xl font-black">{campaignDetail.title}</h3>
                  </div>
                  <Status value={campaignDetail.status} />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <MiniStat label="Recipients" value={campaignDetail.recipientCount} />
                  <MiniStat label="Read" value={campaignDetail.readCount ?? 0} />
                  <MiniStat label="Unread" value={campaignDetail.unreadCount ?? 0} />
                </div>
              </div>
              <div>
                <Label>Channel progress</Label>
                <div className="space-y-3">
                  {campaignDetail.channelStats.map((stat) => {
                    const finished = stat.delivered + stat.failed;
                    const percent = stat.queued
                      ? Math.min(100, Math.round((finished / stat.queued) * 100))
                      : 0;
                    return (
                      <div key={stat.channel} className="rounded-2xl border border-slate-100 p-4">
                        <div className="flex justify-between text-sm">
                          <span className="font-bold text-slate-800">
                            {channelLabels[stat.channel]}
                          </span>
                          <span className="text-slate-500">{percent}% complete</span>
                        </div>
                        <progress
                          className="my-2 h-2 w-full overflow-hidden rounded-full accent-primary"
                          value={percent}
                          max={100}
                        />
                        <p className="text-xs text-slate-500">
                          {stat.delivered.toLocaleString('en-IN')} delivered ·{' '}
                          {stat.failed.toLocaleString('en-IN')} failed
                        </p>
                        {stat.message && (
                          <p className="mt-1 text-xs text-amber-700">{stat.message}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              {campaignDetail.requireAcknowledgement && (
                <p className="flex gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                  <Info className="h-4 w-4 shrink-0" />
                  Acknowledgement was requested. Read progress identifies recipients who still need
                  follow-up.
                </p>
              )}
            </div>
          )}
        </Modal>
      )}
      {templateOpen && (
        <Modal title="Create reusable template" onClose={() => setTemplateOpen(false)}>
          <div className="grid gap-4">
            <input
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
              placeholder="Template name"
              className={fieldClass}
            />
            <input
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="Category"
              className={fieldClass}
            />
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Subject"
              className={fieldClass}
            />
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={6}
              placeholder="Message — variables may use {{student.name}}"
              className={fieldClass}
            />
            <ChoiceRow
              values={metadata?.channels ?? []}
              selected={channels}
              label={(value) => channelLabels[value]}
              onToggle={(value) => toggle(channels, value, setChannels)}
            />
            <div className="flex justify-end">
              <CustomButton variant="primary" onClick={saveTemplate} loading={isLoading}>
                Save template
              </CustomButton>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-4">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-primary [&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </span>
      <div>
        <p className="text-xl font-black text-slate-900">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}
function MiniStat({
  label,
  value,
  tone,
  dark,
}: {
  label: string;
  value: number;
  tone?: 'good' | 'warn';
  dark?: boolean;
}) {
  const colour = dark
    ? 'bg-white/10 text-white'
    : tone === 'good'
      ? 'bg-emerald-50 text-emerald-800'
      : tone === 'warn'
        ? 'bg-amber-50 text-amber-800'
        : 'bg-white text-slate-800';
  return (
    <div className={`rounded-xl p-3 ${colour}`}>
      <p className="text-lg font-black">{value.toLocaleString('en-IN')}</p>
      <p className={`text-[11px] ${dark ? 'text-slate-300' : 'text-slate-500'}`}>{label}</p>
    </div>
  );
}
function SectionTitle({ step, title, help }: { step: string; title: string; help: string }) {
  return (
    <div className="flex items-start gap-3 border-t border-slate-100 pt-4 first:border-0 first:pt-0">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-black text-white">
        {step}
      </span>
      <div>
        <p className="text-sm font-black text-slate-900">{title}</p>
        <p className="text-xs text-slate-500">{help}</p>
      </div>
    </div>
  );
}
function GuidedState({
  icon,
  title,
  message,
  action,
  onAction,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center">
      <div>
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-primary [&>svg]:h-5 [&>svg]:w-5">
          {icon}
        </span>
        <h3 className="mt-3 font-black text-slate-900">{title}</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{message}</p>
        <button
          type="button"
          onClick={onAction}
          className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white"
        >
          {action}
        </button>
      </div>
    </div>
  );
}
function Status({ value }: { value: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${value === 'sent' ? 'bg-emerald-50 text-emerald-700' : value === 'cancelled' || value === 'failed' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}
    >
      {value}
    </span>
  );
}
function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">{children}</p>
  );
}
function ChoiceRow<T extends string | number>({
  values,
  selected,
  label,
  onToggle,
}: {
  values: T[];
  selected: T[];
  label: (value: T) => string;
  onToggle: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <button
          type="button"
          key={String(value)}
          onClick={() => onToggle(value)}
          className={`rounded-xl px-3 py-2 text-xs font-semibold ${selected.includes(value) ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600'}`}
        >
          {label(value)}
        </button>
      ))}
    </div>
  );
}
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-200/80 p-4 backdrop-blur-sm">
      <div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-full bg-slate-100 p-2">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
