'use client';

import AsyncSelect from '@/shared/core/AsyncSelect';
import CustomButton from '@/shared/core/CustomButton';
import Empty from '@/shared/core/Empty';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { motion } from '@/shared/utils/motion';
import {
  BadgeCheck,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileLock2,
  Globe2,
  ShieldAlert,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';

type TSetupView = 'classification' | 'frameworks' | 'readiness' | 'snapshots';
type TScopeType = 'institution' | 'campus' | 'programme';

interface IFrameworkScope {
  _id: string;
  frameworkSlug: string;
  frameworkVersion: string;
  authority: string;
  scopeType: TScopeType;
  campusIds: string[];
  departmentIds: string[];
  programIds: string[];
  cycleType: 'first' | 'subsequent' | 'renewal' | 'continuous';
  academicYear: string;
  submissionDueAt?: string;
  officialSourceUrl?: string;
  officialSourceChecksum?: string;
  trustState: string;
  status: 'draft' | 'pending_approval' | 'active' | 'rejected' | 'retired';
  ownerIds: string[];
  reviewerIds: string[];
}

type TTrustState =
  | 'draft_mapping'
  | 'institution_reviewed'
  | 'platform_verified'
  | 'official_template_mapped'
  | 'submitted'
  | 'provider_acknowledged';

const nextTrustState: Partial<Record<TTrustState, TTrustState>> = {
  institution_reviewed: 'platform_verified',
  platform_verified: 'official_template_mapped',
  official_template_mapped: 'submitted',
  submitted: 'provider_acknowledged',
};

interface IAccreditationSetup {
  country: string;
  region?: string;
  institutionType: string;
  universityType?: string;
  affiliatingUniversity?: string;
  isAutonomous: boolean;
  programmeDomains: string[];
  setupStatus: string;
  frameworks: IFrameworkScope[];
}

interface IRecommendation {
  key: string;
  slug: string;
  name: string;
  shortName: string;
  authority: string;
  country: string;
  description: string;
  officialSourceUrl?: string;
  alreadyConfigured: boolean;
  confidence: 'recommended' | 'optional';
  verificationRequired: boolean;
  reason: string;
}

interface IReadiness {
  setupRequired: boolean;
  setupStatus?: string;
  frameworks: IFrameworkScope[];
  tasks: Array<{ severity: 'blocker' | 'warning' | 'info'; code: string; message: string }>;
  summary?: {
    frameworks: number;
    requirements: number;
    submissions: number;
    approved: number;
    readiness: number;
  };
}

interface ISnapshot {
  _id: string;
  snapshotNumber: string;
  frameworkSlug: string;
  frameworkVersion: string;
  academicYear: string;
  payloadHash: string;
  trustState: string;
  createdAt: string;
}

const inputClass =
  'mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-primary';

const emptyScope = (academicYear: string) => ({
  frameworkSlug: '',
  frameworkVersion: '',
  authority: '',
  scopeType: 'institution' as TScopeType,
  campusIds: [] as string[],
  departmentIds: [] as string[],
  programIds: [] as string[],
  cycleType: 'first' as IFrameworkScope['cycleType'],
  academicYear,
  submissionDueAt: '',
  officialSourceUrl: '',
  officialSourceChecksum: '',
  ownerIds: [] as string[],
  reviewerIds: [] as string[],
});

export default function AccreditationSetupPanel({ academicYear }: { academicYear: string }) {
  const canView = useHasPermission('compliance', 'view');
  const canCreate = useHasPermission('compliance', 'create');
  const canEdit = useHasPermission('compliance', 'edit');
  const canApprove = useHasPermission('compliance', 'approve');
  const canExport = useHasPermission('compliance', 'export');
  const [view, setView] = useState<TSetupView>('classification');
  const [showScopeForm, setShowScopeForm] = useState(false);
  const [profileDraft, setProfileDraft] = useState<Partial<IAccreditationSetup> | null>(null);
  const [scopeDraft, setScopeDraft] = useState(() => emptyScope(academicYear));
  const { mutation, isLoading: mutating } = useMutation();
  const {
    data: setupResponse,
    isLoading: setupLoading,
    mutate: mutateSetup,
  } = useSwr<{ success: boolean; data: IAccreditationSetup | null }>(
    canView ? 'compliance-workspace/accreditation/setup' : null,
  );
  const setup = setupResponse?.data;
  const profile = profileDraft ??
    setup ?? {
      country: 'India',
      institutionType: 'affiliated_college',
      universityType: 'not_applicable',
      isAutonomous: false,
      programmeDomains: [],
    };
  const { data: recommendationResponse, mutate: mutateRecommendations } = useSwr<{
    success: boolean;
    data: IRecommendation[];
  }>(canView && setup ? 'compliance-workspace/accreditation/recommendations' : null);
  const { data: readinessResponse, mutate: mutateReadiness } = useSwr<{
    success: boolean;
    data: IReadiness;
  }>(
    canView
      ? `compliance-workspace/accreditation/readiness?academicYear=${encodeURIComponent(academicYear)}`
      : null,
  );
  const { data: snapshotResponse, mutate: mutateSnapshots } = useSwr<{
    success: boolean;
    data: ISnapshot[];
  }>(canView ? 'compliance-workspace/accreditation/snapshots' : null);
  const readiness = readinessResponse?.data;
  const recommendations = recommendationResponse?.data ?? [];
  const snapshots = snapshotResponse?.data ?? [];

  const domainsText = useMemo(
    () => (profile.programmeDomains ?? []).join(', '),
    [profile.programmeDomains],
  );
  const refreshAll = async () =>
    Promise.all([mutateSetup(), mutateRecommendations(), mutateReadiness(), mutateSnapshots()]);

  const saveProfile = async () => {
    const response = await mutation('compliance-workspace/accreditation/setup', {
      method: 'PUT',
      body: profile,
      isAlert: true,
    });
    if (!response?.results?.success) return;
    setProfileDraft(null);
    await refreshAll();
    setView('frameworks');
  };

  const selectRecommendation = (recommendation: IRecommendation) => {
    setScopeDraft({
      ...emptyScope(academicYear),
      frameworkSlug: recommendation.slug,
      authority: recommendation.authority,
      officialSourceUrl: recommendation.officialSourceUrl ?? '',
      scopeType:
        recommendation.key === 'nba' || recommendation.key === 'abet' ? 'programme' : 'institution',
    });
    setShowScopeForm(true);
  };

  const createScope = async () => {
    const response = await mutation('compliance-workspace/accreditation/scopes', {
      method: 'POST',
      body: scopeDraft,
      isAlert: true,
    });
    if (!response?.results?.success) return;
    setShowScopeForm(false);
    setScopeDraft(emptyScope(academicYear));
    await refreshAll();
  };

  const requestActivation = async (scopeId: string) => {
    const response = await mutation(
      `compliance-workspace/accreditation/scopes/${scopeId}/request-activation`,
      { method: 'POST', isAlert: true },
    );
    if (response?.results?.success) await refreshAll();
  };

  const decide = async (scopeId: string, approved: boolean) => {
    const result = await Swal.fire({
      title: approved ? 'Approve framework activation?' : 'Return framework for revision?',
      input: 'textarea',
      inputLabel: 'Independent review note',
      inputValidator: (value) => (value.trim().length < 5 ? 'Enter at least 5 characters' : null),
      showCancelButton: true,
      confirmButtonText: approved ? 'Approve activation' : 'Return for revision',
    });
    if (!result.isConfirmed) return;
    const response = await mutation(
      `compliance-workspace/accreditation/scopes/${scopeId}/decision`,
      { method: 'POST', body: { approved, note: String(result.value).trim() }, isAlert: true },
    );
    if (response?.results?.success) await refreshAll();
  };

  const advanceTrust = async (scope: IFrameworkScope) => {
    const state = nextTrustState[scope.trustState as TTrustState];
    if (!state) return;
    const result = await Swal.fire<{
      evidenceReference: string;
      evidenceSource: string;
      note: string;
    }>({
      title: `Record ${state.replaceAll('_', ' ')} evidence`,
      html: `
        <label class="swal2-label" for="trust-reference">Evidence or acknowledgement reference</label>
        <input id="trust-reference" class="swal2-input" placeholder="Official document, portal or API reference">
        <label class="swal2-label" for="trust-source">Evidence source</label>
        <select id="trust-source" class="swal2-select">
          <option value="official_document">Official document</option>
          <option value="verified_portal_evidence">Verified portal evidence</option>
          <option value="verified_api">Verified API response</option>
        </select>
        <label class="swal2-label" for="trust-note">Independent verification note</label>
        <textarea id="trust-note" class="swal2-textarea" placeholder="Explain what was checked"></textarea>
      `,
      showCancelButton: true,
      confirmButtonText: 'Record state',
      preConfirm: () => {
        const evidenceReference = (
          document.getElementById('trust-reference') as HTMLInputElement | null
        )?.value.trim();
        const evidenceSource = (document.getElementById('trust-source') as HTMLSelectElement | null)
          ?.value;
        const note = (
          document.getElementById('trust-note') as HTMLTextAreaElement | null
        )?.value.trim();
        if (!evidenceReference || evidenceReference.length < 3 || !note || note.length < 5) {
          Swal.showValidationMessage('Enter a valid reference and verification note.');
          return undefined;
        }
        if (
          state === 'provider_acknowledged' &&
          !['verified_portal_evidence', 'verified_api'].includes(evidenceSource ?? '')
        ) {
          Swal.showValidationMessage(
            'Provider acknowledgement requires verified portal evidence or an API response.',
          );
          return undefined;
        }
        return { evidenceReference, evidenceSource: evidenceSource ?? '', note };
      },
    });
    if (!result.isConfirmed || !result.value) return;
    const response = await mutation(
      `compliance-workspace/accreditation/scopes/${scope._id}/trust`,
      { method: 'PATCH', body: { state, ...result.value }, isAlert: true },
    );
    if (response?.results?.success) await refreshAll();
  };

  const createSnapshot = async (scopeId: string) => {
    const response = await mutation(
      `compliance-workspace/accreditation/scopes/${scopeId}/snapshots`,
      { method: 'POST', isAlert: true },
    );
    if (!response?.results?.success) return;
    toast.info('Snapshot is an immutable ERP preparation record, not provider acknowledgement.');
    await refreshAll();
    setView('snapshots');
  };

  const views = [
    { id: 'classification' as const, label: 'Institution profile', icon: Building2 },
    { id: 'frameworks' as const, label: 'Framework scopes', icon: Globe2 },
    { id: 'readiness' as const, label: 'Readiness tasks', icon: ClipboardCheck },
    { id: 'snapshots' as const, label: 'Frozen snapshots', icon: FileLock2 },
  ];

  if (!canView) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <Empty
          title="Accreditation setup is permission controlled"
          subTitle="Ask a compliance administrator for view access. NAAC or NBA reporting access does not automatically grant tenant-configuration access."
        />
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50/60 p-3 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">
            Tenant configuration
          </p>
          <h2 className="mt-1 text-lg font-bold text-slate-900">
            Accreditation setup and governance
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Classify the institution, verify applicable frameworks and activate each scope through
            independent review.
          </p>
        </div>
        <span className="w-fit rounded-full bg-white px-3 py-1.5 text-xs font-bold capitalize text-slate-600">
          Setup: {(setup?.setupStatus ?? 'not_started').replaceAll('_', ' ')}
        </span>
      </div>

      <nav
        aria-label="Accreditation setup steps"
        className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4"
      >
        {views.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setView(item.id)}
            aria-current={view === item.id ? 'step' : undefined}
            className={`flex min-h-14 items-center gap-3 rounded-xl border px-3 text-left ${view === item.id ? 'border-blue-200 bg-blue-50 text-primary' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200'}`}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white">
              <item.icon size={17} />
            </span>
            <span>
              <span className="block text-[9px] font-black uppercase tracking-wider opacity-60">
                Step {index + 1}
              </span>
              <span className="block text-xs font-bold">{item.label}</span>
            </span>
          </button>
        ))}
      </nav>

      {view === 'classification' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
        >
          <div className="mb-4">
            <h3 className="font-bold text-slate-900">Institution classification</h3>
            <p className="mt-1 text-xs text-slate-500">
              Used only to recommend candidates. No framework becomes active automatically.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="text-xs font-bold text-slate-600">
              Country
              <input
                className={inputClass}
                value={profile.country ?? ''}
                disabled={!canEdit}
                onChange={(event) => setProfileDraft({ ...profile, country: event.target.value })}
              />
            </label>
            <label className="text-xs font-bold text-slate-600">
              State or region
              <input
                className={inputClass}
                value={profile.region ?? ''}
                disabled={!canEdit}
                onChange={(event) => setProfileDraft({ ...profile, region: event.target.value })}
              />
            </label>
            <label className="text-xs font-bold text-slate-600">
              Institution type
              <select
                className={inputClass}
                value={profile.institutionType ?? ''}
                disabled={!canEdit}
                onChange={(event) =>
                  setProfileDraft({ ...profile, institutionType: event.target.value })
                }
              >
                {[
                  'university',
                  'deemed_university',
                  'autonomous_college',
                  'affiliated_college',
                  'standalone_institution',
                  'other',
                ].map((value) => (
                  <option key={value} value={value}>
                    {value.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-bold text-slate-600">
              University type
              <select
                className={inputClass}
                value={profile.universityType ?? 'not_applicable'}
                disabled={!canEdit}
                onChange={(event) =>
                  setProfileDraft({ ...profile, universityType: event.target.value })
                }
              >
                {['not_applicable', 'central', 'state', 'private', 'deemed', 'open'].map(
                  (value) => (
                    <option key={value} value={value}>
                      {value.replaceAll('_', ' ')}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className="text-xs font-bold text-slate-600">
              Affiliating university
              <input
                className={inputClass}
                value={profile.affiliatingUniversity ?? ''}
                disabled={!canEdit}
                onChange={(event) =>
                  setProfileDraft({ ...profile, affiliatingUniversity: event.target.value })
                }
              />
            </label>
            <label className="text-xs font-bold text-slate-600">
              Programme domains
              <input
                className={inputClass}
                value={domainsText}
                disabled={!canEdit}
                placeholder="engineering, management, pharmacy"
                onChange={(event) =>
                  setProfileDraft({
                    ...profile,
                    programmeDomains: event.target.value
                      .split(',')
                      .map((value) => value.trim().toLowerCase())
                      .filter(Boolean),
                  })
                }
              />
            </label>
          </div>
          <label className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs font-bold text-slate-700">
            <input
              type="checkbox"
              checked={profile.isAutonomous ?? false}
              disabled={!canEdit}
              onChange={(event) =>
                setProfileDraft({ ...profile, isAutonomous: event.target.checked })
              }
              className="h-4 w-4 accent-primary"
            />
            Institution has formally verified autonomous status
          </label>
          {canEdit && (
            <div className="mt-4 flex justify-end">
              <CustomButton onClick={() => void saveProfile()} loading={mutating}>
                Save and get recommendations
              </CustomButton>
            </div>
          )}
        </motion.div>
      )}

      {view === 'frameworks' && (
        <div className="space-y-4">
          {!setup ? (
            <Empty
              title="Classification required"
              subTitle="Complete the institution profile before selecting frameworks."
            />
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {recommendations.map((item) => (
                  <article
                    key={item.slug}
                    className="rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-primary">
                        <Globe2 size={17} />
                      </span>
                      <span
                        className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${item.confidence === 'recommended' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}
                      >
                        {item.confidence}
                      </span>
                    </div>
                    <h3 className="mt-3 text-sm font-bold text-slate-900">{item.name}</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>
                    <p className="mt-2 text-[10px] text-slate-400">Reason: {item.reason}</p>
                    <div className="mt-3 rounded-xl bg-amber-50 p-2 text-[10px] font-semibold text-amber-800">
                      Official version and applicability require institutional verification.
                    </div>
                    {canCreate && (
                      <CustomButton
                        className="mt-3 w-full"
                        variant="secondary"
                        disabled={item.alreadyConfigured}
                        onClick={() => selectRecommendation(item)}
                      >
                        {item.alreadyConfigured ? 'Already configured' : 'Configure scope'}
                      </CustomButton>
                    )}
                  </article>
                ))}
              </div>
              {showScopeForm && (
                <article className="rounded-2xl border border-blue-200 bg-white p-4 sm:p-5">
                  <div className="mb-4">
                    <h3 className="font-bold text-slate-900">Configure verified framework scope</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Use the exact version printed in the officially adopted manual.
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <label className="text-xs font-bold text-slate-600">
                      Framework slug
                      <input className={inputClass} value={scopeDraft.frameworkSlug} disabled />
                    </label>
                    <label className="text-xs font-bold text-slate-600">
                      Official framework version
                      <input
                        className={inputClass}
                        value={scopeDraft.frameworkVersion}
                        onChange={(event) =>
                          setScopeDraft({ ...scopeDraft, frameworkVersion: event.target.value })
                        }
                        placeholder="e.g. January 2025"
                      />
                    </label>
                    <label className="text-xs font-bold text-slate-600">
                      Scope type
                      <select
                        className={inputClass}
                        value={scopeDraft.scopeType}
                        onChange={(event) =>
                          setScopeDraft({
                            ...scopeDraft,
                            scopeType: event.target.value as TScopeType,
                          })
                        }
                      >
                        {['institution', 'campus', 'programme'].map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                    </label>
                    <AsyncSelect
                      type="academicYears"
                      label="Academic year"
                      value={scopeDraft.academicYear}
                      onChange={(value) =>
                        setScopeDraft({ ...scopeDraft, academicYear: value ?? academicYear })
                      }
                    />
                    <label className="text-xs font-bold text-slate-600">
                      Cycle
                      <select
                        className={inputClass}
                        value={scopeDraft.cycleType}
                        onChange={(event) =>
                          setScopeDraft({
                            ...scopeDraft,
                            cycleType: event.target.value as IFrameworkScope['cycleType'],
                          })
                        }
                      >
                        {['first', 'subsequent', 'renewal', 'continuous'].map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-bold text-slate-600">
                      Submission deadline
                      <input
                        type="date"
                        className={inputClass}
                        value={scopeDraft.submissionDueAt}
                        onChange={(event) =>
                          setScopeDraft({ ...scopeDraft, submissionDueAt: event.target.value })
                        }
                      />
                    </label>
                    {scopeDraft.scopeType === 'campus' && (
                      <AsyncSelect
                        type="campuses"
                        multiple
                        label="Campuses in scope"
                        value={scopeDraft.campusIds}
                        onChange={(value) => setScopeDraft({ ...scopeDraft, campusIds: value })}
                      />
                    )}
                    {scopeDraft.scopeType === 'programme' && (
                      <AsyncSelect
                        type="curricula"
                        multiple
                        label="Programmes in scope"
                        value={scopeDraft.programIds}
                        onChange={(value) => setScopeDraft({ ...scopeDraft, programIds: value })}
                      />
                    )}
                    <AsyncSelect
                      type="departments"
                      multiple
                      label="Departments in scope"
                      value={scopeDraft.departmentIds}
                      onChange={(value) => setScopeDraft({ ...scopeDraft, departmentIds: value })}
                    />
                    <AsyncSelect
                      type="users"
                      multiple
                      label="Evidence owners"
                      value={scopeDraft.ownerIds}
                      onChange={(value) => setScopeDraft({ ...scopeDraft, ownerIds: value })}
                    />
                    <AsyncSelect
                      type="users"
                      multiple
                      label="Independent reviewers"
                      value={scopeDraft.reviewerIds}
                      onChange={(value) => setScopeDraft({ ...scopeDraft, reviewerIds: value })}
                    />
                    <label className="text-xs font-bold text-slate-600 md:col-span-2">
                      Official source URL
                      <input
                        className={inputClass}
                        value={scopeDraft.officialSourceUrl}
                        onChange={(event) =>
                          setScopeDraft({ ...scopeDraft, officialSourceUrl: event.target.value })
                        }
                      />
                    </label>
                    <label className="text-xs font-bold text-slate-600">
                      Source checksum (optional)
                      <input
                        className={inputClass}
                        value={scopeDraft.officialSourceChecksum}
                        onChange={(event) =>
                          setScopeDraft({
                            ...scopeDraft,
                            officialSourceChecksum: event.target.value,
                          })
                        }
                        placeholder="SHA-256 or authority checksum"
                      />
                    </label>
                  </div>
                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <CustomButton variant="secondary" onClick={() => setShowScopeForm(false)}>
                      Cancel
                    </CustomButton>
                    <CustomButton onClick={() => void createScope()} loading={mutating}>
                      Create draft scope
                    </CustomButton>
                  </div>
                </article>
              )}
              <div className="space-y-3">
                {(setup.frameworks ?? []).map((scope) => (
                  <article
                    key={scope._id}
                    className="rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-black uppercase text-primary">
                            {scope.frameworkSlug}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold capitalize text-slate-600">
                            {scope.status.replaceAll('_', ' ')}
                          </span>
                          <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">
                            {scope.trustState.replaceAll('_', ' ')}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-bold text-slate-900">
                          {scope.authority} · {scope.frameworkVersion}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {scope.scopeType} scope · {scope.academicYear} · {scope.cycleType} cycle ·{' '}
                          {scope.ownerIds.length} owners · {scope.reviewerIds.length} reviewers
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {canEdit && ['draft', 'rejected'].includes(scope.status) && (
                          <CustomButton
                            variant="secondary"
                            onClick={() => void requestActivation(scope._id)}
                          >
                            Request activation
                          </CustomButton>
                        )}
                        {canApprove && scope.status === 'pending_approval' && (
                          <>
                            <CustomButton
                              variant="secondary"
                              onClick={() => void decide(scope._id, false)}
                            >
                              Return
                            </CustomButton>
                            <CustomButton onClick={() => void decide(scope._id, true)}>
                              Approve
                            </CustomButton>
                          </>
                        )}
                        {canExport && scope.status === 'active' && (
                          <CustomButton
                            variant="secondary"
                            onClick={() => void createSnapshot(scope._id)}
                          >
                            Freeze snapshot
                          </CustomButton>
                        )}
                        {canApprove &&
                          scope.status === 'active' &&
                          nextTrustState[scope.trustState as TTrustState] && (
                            <CustomButton onClick={() => void advanceTrust(scope)}>
                              Record next verification
                            </CustomButton>
                          )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {view === 'readiness' && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Active scopes', readiness?.summary?.frameworks ?? 0],
              ['Mapped requirements', readiness?.summary?.requirements ?? 0],
              ['Approved submissions', readiness?.summary?.approved ?? 0],
              ['Preparation readiness', `${readiness?.summary?.readiness ?? 0}%`],
            ].map(([label, value]) => (
              <article key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xl font-black text-slate-900">{value}</p>
                <p className="mt-1 text-xs font-bold text-slate-500">{label}</p>
              </article>
            ))}
          </div>
          <div className="space-y-2">
            {readiness?.tasks.length ? (
              readiness.tasks.map((task) => (
                <article
                  key={`${task.code}-${task.message}`}
                  className={`flex items-start gap-3 rounded-xl border p-3 ${task.severity === 'blocker' ? 'border-red-200 bg-red-50' : task.severity === 'warning' ? 'border-amber-200 bg-amber-50' : 'border-blue-200 bg-blue-50'}`}
                >
                  <ShieldAlert size={17} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider">
                      {task.code.replaceAll('_', ' ')}
                    </p>
                    <p className="mt-1 text-xs text-slate-700">{task.message}</p>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-bold text-emerald-800">
                <CheckCircle2 className="mr-2 inline" size={18} />
                No setup blockers for {academicYear}
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'snapshots' && (
        <div className="space-y-3">
          {snapshots.length ? (
            snapshots.map((snapshot) => (
              <article
                key={snapshot._id}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{snapshot.snapshotNumber}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {snapshot.frameworkSlug} · {snapshot.frameworkVersion} ·{' '}
                      {snapshot.academicYear}
                    </p>
                  </div>
                  <span className="w-fit rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold capitalize text-slate-600">
                    {snapshot.trustState.replaceAll('_', ' ')}
                  </span>
                </div>
                <p className="mt-3 break-all rounded-lg bg-slate-50 p-2 font-mono text-[10px] text-slate-500">
                  SHA-256: {snapshot.payloadHash}
                </p>
              </article>
            ))
          ) : (
            <Empty
              title="No frozen snapshots"
              subTitle="An authorized exporter can freeze an active, mapped framework preparation package."
            />
          )}
        </div>
      )}

      {setupLoading && (
        <p className="text-center text-xs text-slate-400">Loading accreditation setup…</p>
      )}
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-[11px] leading-5 text-blue-800">
        <BadgeCheck className="mr-2 inline" size={15} />
        <strong>Trust boundary:</strong> recommendations and snapshots support preparation. Only an
        authorized provider acknowledgement may use the provider-acknowledged state.
      </div>
    </section>
  );
}
