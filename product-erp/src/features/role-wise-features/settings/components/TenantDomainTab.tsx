'use client';

import { useState } from 'react';
import { CheckCircle2, Copy, Globe2, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import CustomButton from '@/shared/core/CustomButton';

interface IDomainSettings {
  defaultDomain: string;
  customDomain?: string;
  status?: 'pending' | 'verified' | 'active' | 'failed';
  sslStatus?: 'pending' | 'active' | 'failed';
  verifiedAt?: string;
  cnameTarget: string;
  verificationHost?: string;
  verificationToken?: string;
}

export default function TenantDomainTab() {
  const {
    data: response,
    isLoading,
    error,
    mutate,
  } = useSwr<{ data?: IDomainSettings }>('tenant-domain');
  const settings = response?.data;
  const [domainDraft, setDomainDraft] = useState<string | null>(null);
  const { mutation, isLoading: isMutating } = useMutation();
  const domain = domainDraft ?? settings?.customDomain ?? '';

  const copy = async (value?: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success('DNS value copied');
    } catch {
      toast.error('The browser could not copy this value. Select and copy it manually.');
    }
  };

  const save = async () => {
    const normalized = domain
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/[/:].*$/, '')
      .replace(/\.$/, '');
    if (
      !/^(?=.{4,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(normalized)
    ) {
      toast.error('Enter a domain such as erp.yourinstitution.edu.in without a page path.');
      return;
    }
    const response = await mutation('tenant-domain', {
      method: 'PUT',
      body: { customDomain: normalized },
    });
    if (response?.results?.success) {
      toast.success('Domain saved. Add both DNS records before verification.');
      await mutate();
      setDomainDraft(null);
    }
  };

  const verify = async () => {
    const response = await mutation('tenant-domain/verify', { method: 'POST', body: {} });
    if (response?.results?.success) {
      toast.success('Custom domain verified');
      await mutate();
      setDomainDraft(null);
    }
  };

  const remove = async () => {
    const confirmation = await Swal.fire({
      title: 'Remove the custom domain?',
      text: 'Users will return to the managed institution address. Existing DNS records will no longer be used.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Remove domain',
      confirmButtonColor: '#dc2626',
    });
    if (!confirmation.isConfirmed) return;
    const response = await mutation('tenant-domain', { method: 'DELETE' });
    if (response?.results?.success) {
      toast.success('Custom domain removed');
      await mutate();
      setDomainDraft('');
    }
  };

  if (isLoading) return <div className="h-64 animate-pulse rounded-xl bg-slate-50" />;
  if (error || !settings) {
    return (
      <div className="rounded-2xl bg-rose-50 p-5 text-sm text-rose-700">
        <p className="font-semibold">Domain settings could not be loaded</p>
        <p className="mt-1 text-xs">Refresh before changing the institution web address.</p>
        <CustomButton variant="secondary" className="mt-4 w-fit!" onClick={() => void mutate()}>
          Try again
        </CustomButton>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Institution domain</h2>
        <p className="mt-1 text-sm text-slate-500">
          Keep the managed recovery address or connect an institution-owned domain.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {['Save your domain', 'Add both DNS records', 'Verify and provision SSL'].map(
          (step, index) => (
            <div key={step} className="rounded-xl bg-primary/5 px-3 py-3 text-xs text-slate-600">
              <span className="mr-2 font-semibold text-primary">{index + 1}.</span>
              {step}
            </div>
          ),
        )}
      </div>

      <div className="rounded-xl bg-slate-50 p-4">
        <div className="flex items-start gap-3">
          <Globe2 className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-600">
              Managed domain
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-800">{settings?.defaultDomain}</p>
            <p className="mt-1 text-xs text-slate-500">
              Always available as your recovery address.
            </p>
          </div>
        </div>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">Custom domain</span>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input
            value={domain}
            onChange={(event) => setDomainDraft(event.target.value)}
            placeholder="erp.yourinstitution.edu.in"
            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
          <CustomButton onClick={save} loading={isMutating} disabled={!domain.trim()}>
            Save domain
          </CustomButton>
        </div>
      </label>

      {settings?.customDomain && (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <DnsRecord
              label="CNAME record"
              host={settings.customDomain}
              value={settings.cnameTarget}
              onCopy={copy}
            />
            <DnsRecord
              label="TXT verification"
              host={settings.verificationHost || ''}
              value={settings.verificationToken || ''}
              onCopy={copy}
            />
          </div>

          <div
            className={`flex flex-col justify-between gap-4 rounded-xl p-4 sm:flex-row sm:items-center ${
              settings.status === 'active'
                ? 'bg-emerald-50/90 border border-emerald-200 '
                : 'bg-blue-50/90 border border-blue-200'
            }`}
          >
            <div className="flex items-start gap-3">
              {settings.status === 'active' ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" />
              ) : (
                <ShieldCheck className="h-5 w-5 text-primary mt-0.5" />
              )}
              <div>
                <p className="text-sm capitalize font-semibold text-slate-800">
                  Domain status: {settings.status || 'pending'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  SSL status: {settings.sslStatus || 'pending'}
                  {settings.verifiedAt
                    ? ` · verified ${new Date(settings.verifiedAt).toLocaleDateString('en-IN')}`
                    : ''}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <CustomButton
                variant="secondary"
                onClick={async () => {
                  await mutate();
                  toast.success('Domain status refreshed');
                }}
                loading={isLoading || isMutating}
                startIcon={<RefreshCw className="h-4 w-4" />}
              >
                Refresh Status
              </CustomButton>
              {settings.status !== 'active' && (
                <CustomButton
                  onClick={verify}
                  loading={isMutating}
                  startIcon={<ShieldCheck className="h-4 w-4" />}
                >
                  Verify DNS
                </CustomButton>
              )}
              <CustomButton
                variant="cancel"
                onClick={remove}
                loading={isMutating}
                startIcon={<Trash2 className="h-4 w-4" />}
              >
                Remove
              </CustomButton>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function DnsRecord({
  label,
  host,
  value,
  onCopy,
}: {
  label: string;
  host: string;
  value: string;
  onCopy: (value: string) => void;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</p>
      <p className="mt-3 text-xs text-slate-500">Host</p>
      <p className="mt-1 break-all font-mono text-xs text-slate-800">{host}</p>
      <p className="mt-3 text-xs text-slate-500">Value</p>
      <div className="mt-1 flex items-start gap-2">
        <p className="min-w-0 flex-1 break-all font-mono text-xs text-slate-800">{value}</p>
        <button
          type="button"
          onClick={() => onCopy(value)}
          className="rounded-md p-1.5 text-slate-600 hover:bg-white hover:text-primary"
          aria-label={`Copy ${label}`}
        >
          <Copy className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
