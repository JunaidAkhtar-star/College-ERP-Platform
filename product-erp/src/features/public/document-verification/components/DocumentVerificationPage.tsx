'use client';

import useSwr from '@/shared/hooks/useSwr';
import { BadgeCheck, CircleAlert, FileCheck2, Loader2, ShieldX } from 'lucide-react';
import { useParams } from 'next/navigation';

interface IVerification {
  valid: boolean;
  data?: {
    documentNumber: string;
    subjectType: string;
    issuedAt: string;
    revokedAt?: string;
    revocationReason?: string;
    templateVersion: number;
    templateId?: { name?: string; kind?: string };
  } | null;
}

export default function DocumentVerificationPage() {
  const params = useParams<{ code: string }>();
  const { data, isLoading, error } = useSwr<IVerification>(
    params.code ? `document-template/verify/${encodeURIComponent(params.code)}` : null,
  );

  if (isLoading) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-50 p-5">
        <div className="text-center text-slate-500">
          <Loader2 className="mx-auto size-8 animate-spin text-primary" />
          <p className="mt-3 text-sm">Checking the institution record…</p>
        </div>
      </main>
    );
  }

  const record = data?.data;
  const valid = Boolean(data?.valid && record && !record.revokedAt);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 p-5">
      <section className="w-full max-w-xl rounded-3xl bg-white p-6   sm:p-8">
        <div
          className={`flex size-14 items-center justify-center rounded-2xl ${
            valid ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
          }`}
        >
          {valid ? <BadgeCheck className="size-7" /> : <ShieldX className="size-7" />}
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-primary">
          Institution document verification
        </p>
        <h1 className="mt-2 text-2xl font-black text-slate-950">
          {valid ? 'This document is valid' : 'This document is not valid'}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {error || !record
            ? 'No matching issued-document record was found. Check the QR code or contact the institution.'
            : record.revokedAt
              ? 'The institution revoked this document. It must not be accepted as current evidence.'
              : 'The document number and issuance record match the institution register.'}
        </p>
        {record && (
          <dl className="mt-6 grid gap-4 rounded-2xl bg-slate-50 p-5 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-600">Document number</dt>
              <dd className="mt-1 font-bold text-slate-800">{record.documentNumber}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-600">Document</dt>
              <dd className="mt-1 font-bold text-slate-800">
                {record.templateId?.name ?? 'Official document'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-600">Issued</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-700">
                {new Date(record.issuedAt).toLocaleDateString('en-IN')}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-600">Template version</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-700">
                Version {record.templateVersion}
              </dd>
            </div>
          </dl>
        )}
        <div className="mt-6 flex items-start gap-3 rounded-2xl bg-blue-50 p-4 text-sm text-blue-700">
          {valid ? (
            <FileCheck2 className="size-5 shrink-0" />
          ) : (
            <CircleAlert className="size-5 shrink-0" />
          )}
          <p>
            Verification confirms registry status only. Personal information is intentionally not
            displayed on this public page.
          </p>
        </div>
      </section>
    </main>
  );
}
