/**
 * @file DocumentPage.tsx
 * @description Document management — role-aware:
 *   All users: My Documents (GET document/my), Upload (POST document/upload), Re-upload (PUT document/:id/reupload)
 *   Staff: All Documents (GET document), Verify (PUT /:id/verify), Reject (PUT /:id/reject), Expiring Soon (GET /expiring/soon)
 * @module features/role-wise-features/document
 */
'use client';

import React, { useState, useMemo, useRef } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import {
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Upload,
  AlertTriangle,
  Eye,
  Search,
  Files,
  HardDrive,
  ShieldCheck,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import CustomButton from '@/shared/core/CustomButton';
import FileViewer, { type IViewerFile } from '@/shared/core/FileViewer';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import { useHasPermission } from '@/shared/hooks/useHasPermission';

// ─── Types ─────────────────────────────────────────────────────────────────────

type TDocStatus = 'pending' | 'under_review' | 'verified' | 'rejected' | 'expired';

interface IDocument {
  _id: string;
  owner?: string;
  ownerModel?: 'User' | 'AdmissionApplication';
  type: string;
  name: string;
  url: string;
  publicId?: string;
  fileSize?: number;
  format?: string;
  status: TDocStatus;
  expiresAt?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  rejectionReason?: string;
  versions?: unknown[];
  createdAt?: string;
  updatedAt?: string;
  ownerName?: string;
  [key: string]: unknown;
}

const DOC_TYPES = [
  'aadhaar',
  'tenth_marksheet',
  'twelfth_marksheet',
  'diploma_marksheet',
  'transfer_certificate',
  'migration_certificate',
  'income_certificate',
  'caste_certificate',
  'scholarship_doc',
  'passport_photo',
  'birth_certificate',
  'character_certificate',
  'qualifying_exam_scorecard',
  'employee_experience',
  'employee_qualification',
  'other',
];

const inputCls =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-primary focus:ring-4 focus:ring-primary/10';
const labelCls = 'mb-1.5 block text-xs font-semibold text-slate-700';

function prettyType(t: string) {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Upload Modal ──────────────────────────────────────────────────────────────

function UploadModal({
  reuploadDoc,
  onClose,
  onSaved,
}: {
  reuploadDoc?: IDocument | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const isReupload = !!reuploadDoc;
  const { mutation } = useMutation();

  const formik = useFormik({
    initialValues: {
      type: reuploadDoc?.type ?? 'other',
      name: reuploadDoc?.name ?? '',
      ownerModel: 'User',
      expiresAt: reuploadDoc?.expiresAt ? String(reuploadDoc.expiresAt).slice(0, 10) : '',
    },
    validationSchema: Yup.object({
      type: Yup.string().required(),
      name: Yup.string().trim().required('Name is required'),
    }),
    onSubmit: async (values) => {
      const file = fileRef.current?.files?.[0];
      if (!file) {
        toast.error('Please select a file');
        return;
      }
      const fd = new FormData();
      fd.append('document', file);
      if (!isReupload) {
        fd.append('type', values.type);
        fd.append('name', values.name);
        fd.append('ownerModel', values.ownerModel);
        if (values.expiresAt) fd.append('expiresAt', values.expiresAt);
      }
      setSubmitting(true);
      try {
        const path = isReupload ? `document/${reuploadDoc!._id}/reupload` : `document/upload`;
        const method = isReupload ? 'PUT' : 'POST';
        const res = await mutation(path, { method, body: fd, isFormData: true });
        const json = (
          res as { results?: { success?: boolean; error?: { message?: string } } } | undefined
        )?.results;
        if (res && json?.success !== false) {
          toast.success(isReupload ? 'Document re-uploaded' : 'Document uploaded');
          onSaved();
        } else if (res) {
          toast.error(json?.error?.message || 'Upload failed');
        }
      } finally {
        setSubmitting(false);
      }
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-upload-title"
        className="relative z-10 max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-5 sm:p-7"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
              {isReupload ? 'Replace rejected or expired file' : 'Add to document library'}
            </p>
            <h2 id="document-upload-title" className="mt-1 text-xl font-bold text-slate-900">
              {isReupload ? 'Upload a new document version' : 'Upload a document'}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Choose a clear document category and name so reviewers can identify it quickly.
              Uploaded files enter the verification workflow automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            aria-label="Close upload dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={formik.handleSubmit} className="grid gap-5 sm:grid-cols-2">
          <div className="rounded-xl bg-blue-50 p-4 text-sm text-blue-800 sm:col-span-2">
            <span className="font-semibold">File checklist:</span> use a readable scan, include
            every page, avoid password-protected files and do not upload unrelated sensitive
            records.
          </div>
          {!isReupload && (
            <>
              <div>
                <label className={labelCls}>Document Type *</label>
                <select
                  name="type"
                  value={formik.values.type}
                  onChange={formik.handleChange}
                  className={inputCls}
                >
                  {DOC_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {prettyType(t)}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-400">
                  Select the category used for validation and expiry tracking.
                </p>
              </div>
              <div>
                <label className={labelCls}>Display Name *</label>
                <input
                  name="name"
                  value={formik.values.name}
                  onChange={formik.handleChange}
                  placeholder="e.g. Aadhaar Card"
                  className={inputCls}
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Use a recognizable title such as “Aadhaar Card” or “Degree Certificate”.
                </p>
                {formik.touched.name && formik.errors.name && (
                  <p className="mt-1 text-xs text-red-500">{formik.errors.name}</p>
                )}
              </div>
              <div>
                <label className={labelCls}>Expires On (optional)</label>
                <input
                  type="date"
                  name="expiresAt"
                  value={formik.values.expiresAt}
                  onChange={formik.handleChange}
                  className={inputCls}
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Leave blank when the document has no printed expiry date.
                </p>
              </div>
            </>
          )}
          <div className="sm:col-span-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-5 transition hover:border-primary/40 hover:bg-primary-50/30 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
            <label className={labelCls}>File *</label>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              className="block w-full cursor-pointer rounded-xl border border-slate-300 bg-white p-2 text-xs text-slate-600 outline-none transition file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-primary hover:border-slate-400 focus:border-primary focus:ring-4 focus:ring-primary/10"
            />
            <p className="mt-2 text-xs text-slate-500">
              PDF, JPG, PNG, DOC or DOCX up to 5 MB. The selected file becomes the current version.
            </p>
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-5 sm:col-span-2">
            <CustomButton variant="tertiary" type="button" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton variant="primary" type="submit" loading={submitting}>
              {submitting
                ? isReupload
                  ? 'Re-uploading…'
                  : 'Uploading…'
                : isReupload
                  ? 'Re-upload'
                  : 'Upload document'}
            </CustomButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function DocumentPage() {
  const canUpload = useHasPermission('document_management', 'view');
  const canReview = useHasPermission('document_management', 'approve');
  const [tab, setTab] = useState<'mine' | 'all' | 'expiring'>(canReview ? 'all' : 'mine');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [reuploadDoc, setReuploadDoc] = useState<IDocument | null>(null);
  const [viewerDocument, setViewerDocument] = useState<IDocument | null>(null);

  const apiUrl = useMemo(() => {
    if (tab === 'mine') return 'document/my';
    if (tab === 'expiring') return 'document/expiring/soon';
    const q = new URLSearchParams();
    if (filterStatus) q.set('status', filterStatus);
    return `document${q.toString() ? '?' + q.toString() : ''}`;
  }, [tab, filterStatus]);

  const { data: raw, isLoading, mutate } = useSwr(apiUrl);
  const records = useMemo(() => {
    const r = raw as { data?: IDocument[] | { data?: IDocument[] } } | undefined;
    if (Array.isArray(r?.data)) return r!.data as IDocument[];
    return (r?.data as { data?: IDocument[] } | undefined)?.data ?? [];
  }, [raw]);

  const { mutation } = useMutation();

  const handleVerify = async (row: IDocument) => {
    const r = await Swal.fire({
      title: 'Verify Document?',
      text: row.name,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Verify',
      confirmButtonColor: '#0178D7',
    });
    if (!r.isConfirmed) return;
    const res = await mutation(`document/${row._id}/verify`, { method: 'PUT', isAlert: true });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Verified');
      mutate();
    }
  };

  const handleReject = async (row: IDocument) => {
    const r = await Swal.fire({
      title: 'Reject Document?',
      input: 'textarea',
      inputLabel: 'Reason',
      inputPlaceholder: 'Reason for rejection',
      inputValidator: (v) => (!v ? 'Reason is required' : null),
      showCancelButton: true,
      confirmButtonText: 'Reject',
      confirmButtonColor: '#d33',
    });
    if (!r.isConfirmed) return;
    const res = await mutation(`document/${row._id}/reject`, {
      method: 'PUT',
      body: { reason: r.value },
      isAlert: true,
    });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Rejected');
      mutate();
    }
  };

  const stats = useMemo(
    () => ({
      total: records.length,
      pending: records.filter((r) => r.status === 'pending' || r.status === 'under_review').length,
      verified: records.filter((r) => r.status === 'verified').length,
      rejected: records.filter((r) => r.status === 'rejected').length,
    }),
    [records],
  );
  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return records;
    return records.filter((record) =>
      [record.name, record.type, record.ownerName, record.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [records, search]);

  return (
    <div className="space-y-5">
      {records.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Documents</h1>
            <p className="mt-1 text-sm text-slate-500">
              Upload, verify and manage personal documents
            </p>
          </div>
          {canUpload && records.length > 0 && (
            <CustomButton
              variant="primary"
              startIcon={<Upload className="h-4 w-4" />}
              onClick={() => {
                setReuploadDoc(null);
                setShowUpload(true);
              }}
              className="w-fit!"
            >
              Upload
            </CustomButton>
          )}
        </motion.div>
      )}

      {records.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              label: 'Total',
              value: stats.total,
              icon: <FileText className="h-4.5 w-4.5" />,
              color: 'bg-primary-50 text-primary',
            },
            {
              label: 'Pending',
              value: stats.pending,
              icon: <Clock className="h-4.5 w-4.5" />,
              color: 'bg-amber-50 text-amber-600',
            },
            {
              label: 'Verified',
              value: stats.verified,
              icon: <CheckCircle className="h-4.5 w-4.5" />,
              color: 'bg-green-50 text-green-600',
            },
            {
              label: 'Rejected',
              value: stats.rejected,
              icon: <XCircle className="h-4.5 w-4.5" />,
              color: 'bg-red-50 text-red-500',
            },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.07 }}
              className="flex items-center gap-3 rounded-xl bg-white p-4"
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${s.color}`}
              >
                {s.icon}
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900">{isLoading ? '—' : s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {canReview && (
        <div className="flex w-fit max-w-full flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2">
          <button
            type="button"
            onClick={() => setTab('mine')}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${tab === 'mine' ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            My Documents
          </button>
          <>
            <button
              type="button"
              onClick={() => setTab('all')}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${tab === 'all' ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              All Documents
            </button>
            <button
              type="button"
              onClick={() => setTab('expiring')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${tab === 'expiring' ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Expiring Soon
            </button>
          </>
          {tab === 'all' && (
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="ml-auto rounded-lg bg-slate-50 px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="under_review">Under Review</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
              <option value="expired">Expired</option>
            </select>
          )}
        </div>
      )}

      {records.length > 0 && <DocumentHealth records={records} />}

      {records.length > 0 && (
        <div className="relative max-w-xl">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by document, owner, category or status"
            aria-label="Search documents"
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-700 outline-none transition focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
          />
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="h-64 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      ) : records.length === 0 ? (
        <DocumentEmptyState
          canUpload={canUpload}
          isOrganizationView={tab !== 'mine'}
          onUpload={() => {
            setReuploadDoc(null);
            setShowUpload(true);
          }}
        />
      ) : filteredRecords.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
          <Search className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-bold text-slate-700">No matching documents</p>
          <p className="mt-1 text-xs text-slate-500">Try a different name, category or status.</p>
          <button
            type="button"
            onClick={() => setSearch('')}
            className="mt-4 text-xs font-bold text-primary hover:underline"
          >
            Clear search
          </button>
        </div>
      ) : (
        <motion.div layout className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {filteredRecords.map((d, index) => {
              const statusStyle =
                d.status === 'verified'
                  ? 'bg-green-50 text-green-600'
                  : d.status === 'rejected'
                    ? 'bg-red-50 text-red-500'
                    : d.status === 'expired'
                      ? 'bg-slate-100 text-slate-500'
                      : 'bg-amber-50 text-amber-600';
              return (
                <motion.div
                  key={d._id}
                  layout
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.22, delay: Math.min(index * 0.025, 0.2) }}
                  whileHover={{ y: -2 }}
                  className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-primary/30"
                >
                  <div className="flex flex-1 flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setViewerDocument(d)}
                          className="shrink-0 rounded-xl bg-slate-50 p-1 transition-colors hover:bg-primary-50"
                          aria-label={`Preview ${d.name}`}
                        >
                          <DocumentFormatPreview document={d} />
                        </button>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-800">{d.name}</p>
                          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            {prettyType(d.type)}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${statusStyle}`}
                      >
                        {d.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    {d.ownerName && <p className="text-xs text-slate-500">Owner · {d.ownerName}</p>}
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl bg-slate-50 p-3 text-[10px]">
                      <div>
                        <dt className="text-slate-400">File size</dt>
                        <dd className="mt-0.5 font-bold text-slate-600">
                          {formatBytes(d.fileSize)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-400">Version</dt>
                        <dd className="mt-0.5 font-bold text-slate-600">
                          v{Math.max(1, d.versions?.length ?? 0)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-400">Uploaded</dt>
                        <dd className="mt-0.5 font-bold text-slate-600">
                          {formatDocumentDate(d.createdAt)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-400">Format</dt>
                        <dd className="mt-0.5 font-bold uppercase text-slate-600">
                          {normalizeFormat(d)}
                        </dd>
                      </div>
                    </dl>
                    {d.expiresAt && (
                      <p className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                        <Clock className="h-3 w-3 text-slate-600" /> Expires{' '}
                        {formatDocumentDate(d.expiresAt)}
                      </p>
                    )}
                    {d.status === 'rejected' && d.rejectionReason && (
                      <div className="rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] text-red-600">
                        <span className="font-semibold">Rejected:</span> {d.rejectionReason}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3 text-xs">
                      {d.url && (
                        <button
                          type="button"
                          onClick={() => setViewerDocument(d)}
                          className="inline-flex items-center gap-1 font-medium text-slate-500 hover:text-primary"
                        >
                          <Eye className="h-3 w-3" /> Preview
                        </button>
                      )}
                      {canReview &&
                        tab !== 'mine' &&
                        d.status !== 'verified' &&
                        d.status !== 'rejected' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleVerify(d)}
                              className="inline-flex items-center gap-1 font-medium text-green-600 hover:underline"
                            >
                              <CheckCircle className="h-3 w-3" /> Verify
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReject(d)}
                              className="inline-flex items-center gap-1 font-medium text-red-500 hover:underline"
                            >
                              <XCircle className="h-3 w-3" /> Reject
                            </button>
                          </>
                        )}
                      {tab === 'mine' && ['rejected', 'expired'].includes(d.status) && (
                        <button
                          type="button"
                          onClick={() => {
                            setReuploadDoc(d);
                            setShowUpload(true);
                          }}
                          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                        >
                          <Upload className="h-3 w-3" /> Re-upload
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      <AnimatePresence>
        {showUpload && (
          <UploadModal
            reuploadDoc={reuploadDoc}
            onClose={() => {
              setShowUpload(false);
              setReuploadDoc(null);
            }}
            onSaved={() => {
              mutate();
              setShowUpload(false);
              setReuploadDoc(null);
            }}
          />
        )}
      </AnimatePresence>
      <FileViewer
        open={Boolean(viewerDocument)}
        onClose={() => setViewerDocument(null)}
        files={viewerDocument ? [toViewerFile(viewerDocument)] : []}
        title={viewerDocument?.name}
        allowExternalOpen={false}
      />
    </div>
  );
}

function DocumentFormatPreview({ document }: { document: IDocument }) {
  const format = normalizeFormat(document);
  const config: { label: string; color: string; deep: string; pale: string; kind: string } =
    format === 'PDF'
      ? { label: 'PDF', color: '#ef4444', deep: '#b91c1c', pale: '#fff1f2', kind: 'pdf' }
      : ['DOC', 'DOCX', 'WORD'].includes(format)
        ? { label: 'DOC', color: '#3b82f6', deep: '#1d4ed8', pale: '#eff6ff', kind: 'word' }
        : ['XLS', 'XLSX', 'CSV'].includes(format)
          ? { label: 'XLS', color: '#10b981', deep: '#047857', pale: '#ecfdf5', kind: 'sheet' }
          : ['JPG', 'JPEG', 'PNG', 'WEBP'].includes(format)
            ? { label: 'IMG', color: '#8b5cf6', deep: '#6d28d9', pale: '#f5f3ff', kind: 'image' }
            : {
                label: format.slice(0, 4) || 'FILE',
                color: '#64748b',
                deep: '#334155',
                pale: '#f8fafc',
                kind: 'file',
              };

  return (
    <motion.div
      whileHover={{ scale: 1.04, rotate: -1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 18 }}
      className="relative h-16 w-14"
    >
      <svg
        viewBox="0 0 96 116"
        role="img"
        aria-label={`${config.label} file preview`}
        className="h-full w-full"
      >
        <defs>
          <linearGradient id={`file-accent-${config.kind}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={config.color} />
            <stop offset="1" stopColor={config.deep} />
          </linearGradient>
        </defs>
        <path
          d="M15 3h45l23 23v77c0 5.5-4.5 10-10 10H15c-5.5 0-10-4.5-10-10V13C5 7.5 9.5 3 15 3Z"
          fill="white"
          stroke={config.color}
          strokeWidth="2.5"
        />
        <path
          d="M60 3v17c0 5.5 4.5 10 10 10h13"
          fill={config.pale}
          stroke={config.color}
          strokeWidth="2.5"
        />
        <rect
          x="12"
          y="43"
          width="64"
          height="40"
          rx="10"
          fill={`url(#file-accent-${config.kind})`}
        />
        {config.kind === 'pdf' && (
          <path
            d="M26 69c8-13 12-20 15-19 4 1 1 17 8 19 5 1 9-9 14-8"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
          />
        )}
        {config.kind === 'word' && (
          <>
            <path d="M25 54l5 18 6-13 6 13 5-18" fill="none" stroke="white" strokeWidth="3" />
            <path
              d="M52 56h13M52 63h13M52 70h9"
              stroke="#dbeafe"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </>
        )}
        {config.kind === 'sheet' && (
          <>
            <rect
              x="25"
              y="51"
              width="38"
              height="24"
              rx="3"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
            />
            <path d="M38 51v24M51 51v24M25 59h38M25 67h38" stroke="#d1fae5" strokeWidth="2" />
          </>
        )}
        {config.kind === 'image' && (
          <>
            <circle cx="57" cy="54" r="4" fill="#fde68a" />
            <path d="M22 73l13-14 9 9 7-6 15 11H22Z" fill="white" />
          </>
        )}
        {config.kind === 'file' && (
          <path
            d="M27 55h34M27 63h34M27 71h22"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
          />
        )}
        <text x="44" y="101" textAnchor="middle" fontSize="11" fontWeight="900" fill={config.deep}>
          {config.label}
        </text>
      </svg>
    </motion.div>
  );
}

function normalizeFormat(document: IDocument) {
  const explicit = document.format?.replace('.', '').trim().toUpperCase();
  if (explicit) return explicit;
  const urlPath = document.url?.split('?')[0] ?? '';
  const extension = urlPath.includes('.') ? urlPath.split('.').pop() : '';
  return extension?.toUpperCase() || 'FILE';
}

function toViewerFile(document: IDocument): IViewerFile {
  const format = normalizeFormat(document);
  const mimeType =
    format === 'PDF'
      ? 'application/pdf'
      : ['JPG', 'JPEG'].includes(format)
        ? 'image/jpeg'
        : format === 'PNG'
          ? 'image/png'
          : format === 'WEBP'
            ? 'image/webp'
            : format === 'DOC'
              ? 'application/msword'
              : format === 'DOCX'
                ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                : undefined;
  return {
    url: document.url,
    name: `${document.name}.${format.toLowerCase()}`,
    mimeType,
  };
}

function formatDocumentDate(value?: string) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

function DocumentHealth({ records }: { records: IDocument[] }) {
  const totalBytes = records.reduce((total, record) => total + (record.fileSize ?? 0), 0);
  const verified = records.filter((record) => record.status === 'verified').length;
  const attention = records.filter((record) =>
    ['rejected', 'expired'].includes(record.status),
  ).length;
  const review = records.filter((record) =>
    ['pending', 'under_review'].includes(record.status),
  ).length;
  const total = Math.max(records.length, 1);
  const segments = [
    { label: 'Verified', count: verified, color: '#10b981' },
    { label: 'In review', count: review, color: '#f59e0b' },
    { label: 'Needs action', count: attention, color: '#f43f5e' },
  ];

  return (
    <section className="grid gap-5 rounded-2xl border border-slate-100 bg-white p-5 lg:grid-cols-[1fr_auto] lg:items-center">
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Document readiness</h2>
            <p className="mt-1 text-xs text-slate-500">
              Verification coverage for the documents in this view.
            </p>
          </div>
          <ShieldCheck className="h-5 w-5 text-emerald-500" />
        </div>
        <svg
          viewBox="0 0 640 56"
          role="img"
          aria-label="Document verification status distribution"
          className="mt-3 h-14 w-full"
        >
          <rect x="10" y="17" width="620" height="18" rx="9" fill="#f1f5f9" />
          {
            segments.reduce(
              (items, segment) => {
                const width = (segment.count / total) * 620;
                items.elements.push(
                  <rect
                    key={segment.label}
                    x={10 + items.offset}
                    y="17"
                    width={width}
                    height="18"
                    rx="9"
                    fill={segment.color}
                  />,
                );
                items.offset += width;
                return items;
              },
              { elements: [] as React.ReactNode[], offset: 0 },
            ).elements
          }
        </svg>
        <div className="flex flex-wrap gap-4 text-[11px] text-slate-500">
          {segments.map((segment) => (
            <span key={segment.label} className="flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  segment.label === 'Verified'
                    ? 'bg-emerald-500'
                    : segment.label === 'In review'
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                }`}
              />
              {segment.label} · {segment.count}
            </span>
          ))}
        </div>
      </div>
      <div className="border-t border-slate-100 pt-4 lg:min-w-64 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
            <HardDrive className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-semibold text-slate-500">Files in current view</p>
            <p className="mt-1 text-xl font-black text-slate-900">{formatBytes(totalBytes)}</p>
            <p className="mt-1 text-[11px] text-slate-400">
              Across {records.length} current document versions
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function DocumentEmptyState({
  canUpload,
  isOrganizationView,
  onUpload,
}: {
  canUpload: boolean;
  isOrganizationView: boolean;
  onUpload: () => void;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, ease: 'easeOut' }}
      className="overflow-hidden rounded-3xl border border-slate-200 bg-white"
    >
      <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
        <div className="flex flex-col justify-center px-6 py-8 sm:px-9 lg:py-10">
          <motion.span
            initial={{ scale: 0.85, rotate: -6 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.12, type: 'spring', stiffness: 180 }}
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary"
          >
            <Files className="h-6 w-6" />
          </motion.span>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-primary">
            Secure document workspace
          </p>
          <h1 className="mt-1 text-2xl font-black text-slate-900 sm:text-3xl">
            {isOrganizationView ? 'No documents need attention' : 'Your records, ready when needed'}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">
            {isOrganizationView
              ? 'This workspace is clear. Change the view or status filter to inspect another document group.'
              : 'Upload academic and identity records once, follow verification clearly, and replace rejected or expired files without losing version history.'}
          </p>
          {!isOrganizationView && canUpload && (
            <div className="mt-6 flex">
              <CustomButton
                variant="primary"
                startIcon={<Upload className="h-4 w-4" />}
                onClick={onUpload}
                className="w-fit!"
              >
                Upload first document
              </CustomButton>
            </div>
          )}
        </div>

        <div className="relative hidden min-h-80 overflow-hidden bg-gradient-to-br from-primary-50 via-blue-50 to-violet-50 p-8 lg:flex lg:items-center lg:justify-center">
          <div className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-2xl" />
          <div className="absolute -bottom-20 -left-10 h-52 w-52 rounded-full bg-violet-300/20 blur-2xl" />
          <motion.div
            initial={{ opacity: 0, y: 18, rotate: -2 }}
            animate={{ opacity: 1, y: [0, -5, 0], rotate: 0 }}
            transition={{ opacity: { delay: 0.18 }, y: { duration: 4, repeat: Infinity } }}
            className="relative w-full max-w-sm rounded-2xl border border-primary/15 bg-white/90 p-5 backdrop-blur"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-500">
                  <FileText className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-800">Academic certificate</p>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">PDF document</p>
                </div>
              </div>
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">
                In review
              </span>
            </div>
            <div className="mt-5 space-y-4">
              {[
                ['Upload received', 'Complete', 'bg-emerald-500'],
                ['Identity verification', 'In progress', 'bg-amber-500'],
                ['Ready for records', 'Next', 'bg-slate-300'],
              ].map(([label, state, color], index) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.28 + index * 0.1 }}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                    <span className={`h-2 w-2 rounded-full ${color}`} />
                    {label}
                  </span>
                  <span className="text-[10px] text-slate-400">{state}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {!isOrganizationView && (
        <div className="grid gap-3 border-t border-slate-100 bg-slate-50/70 px-6 py-5 sm:grid-cols-3 sm:px-9">
          {[
            ['1', 'Choose the right category', 'Keeps records organized'],
            ['2', 'Upload a readable file', 'PDF or image up to 5 MB'],
            ['3', 'Follow verification', 'See decisions and next steps'],
          ].map(([step, label, detail]) => (
            <div key={step} className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-[10px] font-bold text-primary">
                {step}
              </span>
              <span>
                <span className="block text-xs font-bold text-slate-700">{label}</span>
                <span className="mt-0.5 block text-[10px] text-slate-400">{detail}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </motion.section>
  );
}

function formatBytes(value?: number) {
  if (!value) return '—';
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
