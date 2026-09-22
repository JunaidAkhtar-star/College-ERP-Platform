'use client';

import CustomButton from '@/shared/core/CustomButton';
import Empty from '@/shared/core/Empty';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import { Download, Link2, Save, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'react-toastify';
import type { ITallyConfiguration } from '../types/compliance.types';

interface IApiResponse<T> {
  success: boolean;
  data: T;
}

const emptyConfig: ITallyConfiguration = {
  companyName: '',
  companyGuid: '',
  financialYear: '',
  ledgerMappings: [],
  isActive: true,
};

export default function TallyIntegrationPanel() {
  const canEdit = useHasPermission('compliance', 'edit');
  const canExport = useHasPermission('compliance', 'export');
  const { data, error, isLoading, mutate } = useSwr<IApiResponse<ITallyConfiguration | null>>(
    'compliance-workspace/tally/config',
  );
  if (isLoading) {
    return <div className="h-72 animate-pulse rounded-2xl bg-white" />;
  }
  if (error) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 p-5">
        <p className="text-sm font-semibold text-red-800">
          Tally configuration could not be loaded
        </p>
        <button
          type="button"
          onClick={() => mutate()}
          className="min-h-10 rounded-xl border border-red-200 bg-white px-3.5 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
        >
          Retry
        </button>
      </div>
    );
  }
  return (
    <TallyConfigurationForm
      key={data?.data?._id ?? 'new-tally-configuration'}
      initialConfig={data?.data ?? emptyConfig}
      onSaved={() => mutate()}
      canEdit={canEdit}
      canExport={canExport}
    />
  );
}

function TallyConfigurationForm({
  initialConfig,
  onSaved,
  canEdit,
  canExport,
}: {
  initialConfig: ITallyConfiguration;
  onSaved: () => void;
  canEdit: boolean;
  canExport: boolean;
}) {
  const { mutation, isLoading } = useMutation();
  const [config, setConfig] = useState<ITallyConfiguration>(initialConfig);

  const save = async () => {
    if (!config.companyName.trim() || !config.financialYear.trim()) {
      toast.error('Company name and financial year are required');
      return;
    }
    const response = await mutation('compliance-workspace/tally/config', {
      method: 'PUT',
      body: config,
    });
    if (!response?.results?.success) return;
    toast.success('Tally configuration saved');
    onSaved();
  };

  const exportVouchers = async () => {
    if (!config.companyName.trim() || !config.financialYear.trim()) {
      toast.error('Save a company and financial year before exporting');
      return;
    }
    const response = await mutation('compliance-workspace/tally/export', {
      method: 'POST',
      body: { financialYear: config.financialYear },
    });
    const output = response?.results?.data as { xml?: string; count?: number } | undefined;
    if (!output?.xml) return;
    const blob = new Blob([output.xml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `tally-vouchers-${config.financialYear}.xml`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success(`${output.count ?? 0} vouchers exported for Tally Prime`);
  };

  const addMapping = () =>
    setConfig((value) => ({
      ...value,
      ledgerMappings: [...value.ledgerMappings, { accountCode: '', tallyLedgerName: '' }],
    }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <section className="rounded-2xl bg-white p-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl bg-violet-50 p-3 text-violet-600">
              <Link2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">Tally Prime connection</h2>
              <p className="text-sm text-slate-500">
                Map ERP ledgers and create import-ready voucher XML.
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-semibold text-slate-700">
              <span>Company name</span>
              <input
                value={config.companyName}
                disabled={!canEdit}
                onChange={(event) => setConfig({ ...config, companyName: event.target.value })}
                className="w-full rounded-xl bg-slate-100 px-4 py-3 font-normal outline-none"
              />
            </label>
            <label className="space-y-1.5 text-sm font-semibold text-slate-700">
              <span>Financial year</span>
              <input
                value={config.financialYear}
                disabled={!canEdit}
                onChange={(event) => setConfig({ ...config, financialYear: event.target.value })}
                className="w-full rounded-xl bg-slate-100 px-4 py-3 font-normal outline-none"
                placeholder="2026-27"
              />
            </label>
            <label className="space-y-1.5 text-sm font-semibold text-slate-700 sm:col-span-2">
              <span>Tally company GUID (optional)</span>
              <input
                value={config.companyGuid ?? ''}
                disabled={!canEdit}
                onChange={(event) => setConfig({ ...config, companyGuid: event.target.value })}
                className="w-full rounded-xl bg-slate-100 px-4 py-3 font-normal outline-none"
              />
            </label>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            {canEdit && (
              <CustomButton
                variant="primary"
                onClick={save}
                loading={isLoading}
                startIcon={<Save className="h-4 w-4" />}
              >
                Save configuration
              </CustomButton>
            )}
            {canExport && (
              <button
                type="button"
                onClick={exportVouchers}
                disabled={!config.companyName}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="h-4 w-4" /> Export vouchers
              </button>
            )}
          </div>
        </section>
        <aside className="rounded-2xl bg-violet-50 p-5 text-slate-900">
          <ShieldCheck className="h-8 w-8 text-violet-600" />
          <h3 className="mt-5 text-xl font-black">Safe, reviewable export</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            The ERP remains the source of truth. Posted, balanced journals are converted to Tally
            Prime XML; no finance record is modified during export.
          </p>
          {config.lastExportedAt && (
            <p className="mt-5 text-xs font-semibold text-violet-700">
              Last export: {new Date(config.lastExportedAt).toLocaleString('en-IN')}
            </p>
          )}
        </aside>
      </div>

      <section className="rounded-2xl bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-black text-slate-900">Ledger mappings</h3>
            <p className="text-sm text-slate-500">
              Unmapped accounts automatically use their ERP ledger name.
            </p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={addMapping}
              className="min-h-9 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Add mapping
            </button>
          )}
        </div>
        <div className="mt-4 space-y-3">
          {config.ledgerMappings.map((mapping, index) => (
            <div
              key={`${index}-${mapping.accountCode}`}
              className="grid gap-3 rounded-2xl bg-slate-50 p-3 sm:grid-cols-2"
            >
              <input
                placeholder="ERP account code"
                value={mapping.accountCode}
                disabled={!canEdit}
                onChange={(event) =>
                  setConfig((value) => ({
                    ...value,
                    ledgerMappings: value.ledgerMappings.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, accountCode: event.target.value } : item,
                    ),
                  }))
                }
                className="rounded-xl bg-white px-4 py-3 text-sm outline-none"
              />
              <input
                placeholder="Tally ledger name"
                value={mapping.tallyLedgerName}
                disabled={!canEdit}
                onChange={(event) =>
                  setConfig((value) => ({
                    ...value,
                    ledgerMappings: value.ledgerMappings.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, tallyLedgerName: event.target.value } : item,
                    ),
                  }))
                }
                className="rounded-xl bg-white px-4 py-3 text-sm outline-none"
              />
            </div>
          ))}
          {!config.ledgerMappings.length && (
            <Empty
              title="No custom ledger mappings"
              subTitle="ERP ledger names will be used automatically. Add a mapping only when the corresponding Tally ledger uses a different name."
              pathName={canEdit ? 'Add first mapping' : undefined}
              onClick={canEdit ? addMapping : undefined}
            />
          )}
        </div>
      </section>
    </div>
  );
}
