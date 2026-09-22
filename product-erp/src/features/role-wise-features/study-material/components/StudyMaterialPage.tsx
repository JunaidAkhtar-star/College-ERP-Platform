/**
 * @file StudyMaterialPage.tsx
 * @description Study Material — role-aware:
 *   Faculty/Admin: Upload / create material (POST study-material)
 *   All: Browse, filter by type, download (POST study-material/:id/download)
 * @module features/role-wise-features/study-material
 */
'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import {
  BookOpen,
  Plus,
  Download,
  FileText,
  Video,
  Link2,
  FileArchive,
  Edit2,
  Send,
  Archive,
  Folder,
  Search,
  X,
  ChevronRight,
  UploadCloud,
  Layers3,
  Grid2X2,
  List,
  MoreVertical,
  Home,
  ArrowUpDown,
  Eye,
  Check,
} from 'lucide-react';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import CustomButton from '@/shared/core/CustomButton';
import InlineFileUpload from '@/shared/core/InlineFileUpload';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import { useAuthStore } from '@/shared/store/authStore';
import AsyncSelect from '@/shared/core/AsyncSelect';
import FileViewer, { type IViewerFile } from '@/shared/core/FileViewer';

interface IStudyMaterial {
  _id: string;
  title: string;
  description?: string;
  subjectCode?: string;
  subjectId?: string;
  sectionIds?: string[];
  subjectName?: string;
  semester?: number;
  program?: string;
  materialType: 'pdf' | 'ppt' | 'video' | 'notes' | 'link' | 'other';
  fileUrl?: string;
  externalLink?: string;
  facultyName?: string;
  downloadCount?: number;
  unitNo?: number;
  tags?: string[];
  status: 'draft' | 'published' | 'archived';
  createdAt: string;
  [key: string]: unknown;
}

const AUTHOR_ROLES = ['hod', 'faculty'];
const MANAGE_ROLES = ['super_admin', 'hod', 'faculty'];
const inputCls =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm placeholder-slate-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20';
const labelCls = 'mb-1 block text-xs font-medium text-slate-600';

const TYPE_CFG: Record<
  string,
  { label: string; icon: React.ElementType; bg: string; text: string }
> = {
  pdf: { label: 'PDF document', icon: FileText, bg: 'bg-blue-50', text: 'text-blue-600' },
  ppt: { label: 'Presentation', icon: FileArchive, bg: 'bg-purple-50', text: 'text-purple-600' },
  video: { label: 'Video', icon: Video, bg: 'bg-red-50', text: 'text-red-500' },
  notes: { label: 'Notes', icon: BookOpen, bg: 'bg-amber-50', text: 'text-amber-600' },
  link: { label: 'External link', icon: Link2, bg: 'bg-green-50', text: 'text-green-600' },
  other: { label: 'Other', icon: Link2, bg: 'bg-slate-50', text: 'text-slate-500' },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Upload Modal ──────────────────────────────────────────────────────────────
function UploadModal({
  material,
  onClose,
  onSaved,
}: {
  material?: IStudyMaterial | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mutation, isLoading } = useMutation();
  const formik = useFormik({
    initialValues: {
      title: material?.title ?? '',
      description: material?.description ?? '',
      subjectId: material?.subjectId ?? '',
      sectionIds: material?.sectionIds ?? [],
      materialType: material?.materialType ?? 'notes',
      fileUrl: material?.fileUrl ?? '',
      externalLink: material?.externalLink ?? '',
      unitNo: material?.unitNo ?? '',
      tags: material?.tags?.join(', ') ?? '',
    },
    validationSchema: Yup.object({
      title: Yup.string()
        .trim()
        .min(3, 'Enter at least 3 characters')
        .max(200, 'Title cannot exceed 200 characters')
        .required('Enter a clear material title'),
      description: Yup.string().trim().max(2000, 'Description cannot exceed 2,000 characters'),
      subjectId: Yup.string().required('Select the subject you teach'),
      sectionIds: Yup.array()
        .of(Yup.string().required())
        .min(1, 'Select at least one assigned class')
        .max(20, 'Select no more than 20 classes'),
      materialType: Yup.string()
        .oneOf(Object.keys(TYPE_CFG), 'Select a valid resource type')
        .required('Select a resource type'),
      unitNo: Yup.number()
        .transform((value, original) => (original === '' ? undefined : value))
        .integer('Unit must be a whole number')
        .min(1, 'Unit must be 1 or more')
        .max(20, 'Unit cannot exceed 20')
        .optional(),
      tags: Yup.string().test('tag-count', 'Use no more than 20 tags', (value) =>
        value ? value.split(',').filter((tag) => tag.trim()).length <= 20 : true,
      ),
      externalLink: Yup.string().when('materialType', {
        is: 'link',
        then: (schema) =>
          schema.url('Enter a complete HTTPS link').required('External link required'),
        otherwise: (schema) => schema.optional(),
      }),
    }),
    onSubmit: async (values) => {
      const isEdit = !!material?._id;
      if (values.materialType !== 'link' && !values.fileUrl) {
        toast.error('Upload a learning material before saving');
        return;
      }
      const body = {
        ...values,
        fileUrl: values.materialType === 'link' ? undefined : values.fileUrl,
        externalLink: values.materialType === 'link' ? values.externalLink : undefined,
        unitNo: values.unitNo ? Number(values.unitNo) : undefined,
        tags: values.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      };
      const res = await mutation(isEdit ? `study-material/${material!._id}` : 'study-material', {
        method: isEdit ? 'PUT' : 'POST',
        body,
        silentError: true,
        returnError: true,
      });
      if ((res as { results?: { success?: boolean } })?.results?.success) {
        toast.success('Saved');
        onSaved();
      } else {
        const message = (res as { results?: { message?: string } })?.results?.message;
        toast.error(message || 'Material could not be saved');
      }
    },
  });
  const uploadMaterial = async (file: File): Promise<IViewerFile | null> => {
    const body = new FormData();
    body.append('file', file);
    const response = await mutation('upload', {
      method: 'POST',
      body,
      isFormData: true,
      dedupe: false,
      silentError: true,
      returnError: true,
    });
    const uploaded = response?.results?.data as
      | { url?: string; filename?: string; publicId?: string }
      | undefined;
    if (!uploaded?.url) {
      toast.error('The selected file could not be uploaded. Nothing was saved.');
      return null;
    }
    return {
      url: uploaded.url,
      name: uploaded.filename || file.name,
      mimeType: file.type,
    };
  };
  const uploadedFiles: IViewerFile[] = formik.values.fileUrl
    ? [{ url: formik.values.fileUrl, name: material?.title || 'Learning material' }]
    : [];

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
        className="relative z-10 max-h-[96dvh] w-full max-w-7xl overflow-y-auto rounded-3xl bg-white "
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-primary-50 text-primary">
              <UploadCloud className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {material?._id ? 'Edit learning material' : 'Add learning material'}
              </h2>
              <p className="text-xs text-slate-500">
                Choose an assigned class first, then attach the correct teaching resource.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close material form"
          >
            <X className="size-5" />
          </button>
        </div>
        <form
          onSubmit={formik.handleSubmit}
          className="grid gap-7 p-6 sm:p-8 lg:grid-cols-[minmax(25rem,0.9fr)_minmax(32rem,1.35fr)]"
        >
          <section className="space-y-4 rounded-2xl bg-slate-50 p-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-primary">
                1 · Audience
              </p>
              <h3 className="mt-1 font-bold text-slate-900">Who should receive this?</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Only active classes from your approved teaching timetable are available.
              </p>
            </div>
            <AsyncSelect
              type="sections"
              multiple
              label="Assigned classes"
              required
              limit={100}
              value={formik.values.sectionIds}
              onChange={(value) => {
                void formik.setFieldValue('sectionIds', value);
                void formik.setFieldValue('subjectId', '');
              }}
              error={formik.touched.sectionIds ? String(formik.errors.sectionIds ?? '') : undefined}
              placeholder="Select one or more sections"
              emptyMessage="No assigned active classes were found in your timetable."
            />
            <AsyncSelect
              type="subjects"
              label="Subject taught in this class"
              required
              disabled={!formik.values.sectionIds.length}
              params={{ sectionId: formik.values.sectionIds[0] }}
              value={formik.values.subjectId}
              onChange={(value) => formik.setFieldValue('subjectId', value ?? '')}
              error={formik.touched.subjectId ? formik.errors.subjectId : undefined}
              placeholder={
                formik.values.sectionIds.length ? 'Select assigned subject' : 'Choose a class first'
              }
              emptyMessage="No subject assigned to you for this class."
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Unit / module</label>
                <input
                  name="unitNo"
                  type="number"
                  min={1}
                  max={20}
                  value={formik.values.unitNo}
                  onChange={formik.handleChange}
                  placeholder="e.g. 3"
                  className={inputCls}
                />
                {formik.touched.unitNo && formik.errors.unitNo && (
                  <p className="mt-1 text-xs text-red-500">{formik.errors.unitNo}</p>
                )}
              </div>
              <div>
                <label className={labelCls}>Resource type *</label>
                <select
                  name="materialType"
                  value={formik.values.materialType}
                  onChange={formik.handleChange}
                  className={inputCls}
                >
                  {Object.entries(TYPE_CFG).map(([v, c]) => (
                    <option key={v} value={v}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>
          <section className="space-y-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-primary">2 · Content</p>
              <h3 className="mt-1 font-bold text-slate-900">Describe and attach the resource</h3>
            </div>
            <div>
              <label className={labelCls}>Title *</label>
              <input
                name="title"
                value={formik.values.title}
                onChange={formik.handleChange}
                placeholder="Material title…"
                className={inputCls}
              />
              {formik.touched.title && formik.errors.title && (
                <p className="mt-1 text-xs text-red-500">{formik.errors.title}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Description</label>
              <textarea
                name="description"
                rows={2}
                value={formik.values.description}
                onChange={formik.handleChange}
                placeholder="Brief description…"
                className={inputCls + ' resize-none'}
              />
              {formik.touched.description && formik.errors.description && (
                <p className="mt-1 text-xs text-red-500">{formik.errors.description}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Search tags</label>
              <input
                name="tags"
                value={formik.values.tags}
                onChange={formik.handleChange}
                placeholder="unit-3, exam-preparation, examples"
                className={inputCls}
              />
              {formik.touched.tags && formik.errors.tags && (
                <p className="mt-1 text-xs text-red-500">{formik.errors.tags}</p>
              )}
              <p className="mt-1 text-[11px] text-slate-600">Separate tags with commas.</p>
            </div>
            {formik.values.materialType !== 'link' && (
              <InlineFileUpload
                label="Learning material"
                required
                files={uploadedFiles}
                disabled={isLoading}
                hint="PDF or supported image · Maximum 5 MB"
                onUpload={async (file) => {
                  const uploaded = await uploadMaterial(file);
                  if (!uploaded) return false;
                  await formik.setFieldValue('fileUrl', uploaded.url);
                  return true;
                }}
                onRemove={async () => {
                  await formik.setFieldValue('fileUrl', '');
                }}
              />
            )}
            {formik.values.materialType === 'link' && (
              <div>
                <label className={labelCls}>Learning resource link *</label>
                <input
                  name="externalLink"
                  type="url"
                  value={formik.values.externalLink}
                  onChange={formik.handleChange}
                  placeholder="https://youtube.com/… or https://drive.google.com/…"
                  className={inputCls}
                />
                {formik.touched.externalLink && formik.errors.externalLink && (
                  <p className="mt-1 text-xs text-red-500">{formik.errors.externalLink}</p>
                )}
                <p className="mt-1 text-xs text-slate-500">
                  Use this only for a resource hosted by a trusted external provider.
                </p>
              </div>
            )}
            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <CustomButton variant="tertiary" type="button" onClick={onClose}>
                Cancel
              </CustomButton>
              <CustomButton variant="primary" type="submit" loading={isLoading}>
                Save material
              </CustomButton>
            </div>
          </section>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Material Card (grid view) ─────────────────────────────────────────────────
function MaterialCard({
  m,
  onPreview,
  onOpenResource,
  onEdit,
  canEdit,
  onPublish,
  onArchive,
  selected,
  onSelect,
  menuOpen,
  onToggleMenu,
}: {
  m: IStudyMaterial;
  onPreview: () => void;
  onOpenResource: () => void;
  onEdit: () => void;
  canEdit: boolean;
  onPublish: () => void;
  onArchive: () => void;
  selected: boolean;
  onSelect: () => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
}) {
  const cfg = TYPE_CFG[m.materialType] ?? TYPE_CFG.other;
  const Icon = cfg.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group relative flex min-h-64 w-full flex-col overflow-visible rounded-2xl border bg-slate-100 transition ${selected ? 'border-primary bg-primary-50 ring-2 ring-primary/20' : 'border-transparent hover:bg-slate-200/70'}`}
    >
      <button
        type="button"
        onClick={onSelect}
        className={`absolute left-3 top-3 z-10 flex size-6 items-center justify-center rounded-full border  transition ${selected ? 'border-primary bg-primary text-white' : 'border-white bg-white/90 text-transparent opacity-0 group-hover:opacity-100'}`}
        aria-label={selected ? `Deselect ${m.title}` : `Select ${m.title}`}
      >
        <Check className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={onPreview}
        className="mx-2 mt-2 flex h-36 items-center justify-center overflow-hidden rounded-xl bg-white"
      >
        {m.fileUrl && /\.(png|jpe?g|webp|gif|avif)(?:\?|$)/i.test(m.fileUrl) ? (
          <Image
            src={m.fileUrl}
            alt={m.title}
            width={640}
            height={420}
            className="h-full w-full object-cover"
            unoptimized
          />
        ) : m.fileUrl && m.materialType === 'pdf' ? (
          <iframe
            src={`${m.fileUrl}#toolbar=0&navpanes=0&page=1`}
            title={`${m.title} preview`}
            className="pointer-events-none h-full w-full border-0"
          />
        ) : (
          <span
            className={`flex size-16 items-center justify-center rounded-2xl ${cfg.bg} ${cfg.text}`}
          >
            <Icon className="size-8" />
          </span>
        )}
      </button>
      <div className="flex items-start gap-3 px-4 pt-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${cfg.bg} ${cfg.text}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 line-clamp-1">{m.title}</p>
          <p className="text-xs text-slate-600">
            {m.subjectCode} {m.subjectName ? `· ${m.subjectName}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleMenu}
          className="rounded-full p-1.5 text-slate-500 transition hover:bg-white hover:text-slate-900"
          aria-label={`More actions for ${m.title}`}
        >
          <MoreVertical className="size-4" />
        </button>
        {menuOpen && (
          <div className="absolute right-3 top-52 z-30 w-48 rounded-xl border border-slate-200 bg-white p-1.5 text-xs ">
            <button
              type="button"
              onClick={onPreview}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100"
            >
              <Eye className="size-3.5" /> Preview
            </button>
            {(m.fileUrl || m.externalLink) && (
              <button
                type="button"
                onClick={onOpenResource}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100"
              >
                <Download className="size-3.5" /> Open resource
              </button>
            )}
            {canEdit && m.status === 'draft' && (
              <button
                type="button"
                onClick={onEdit}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100"
              >
                <Edit2 className="size-3.5" /> Edit draft
              </button>
            )}
            {canEdit && m.status === 'draft' && (
              <button
                type="button"
                onClick={onPublish}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100"
              >
                <Send className="size-3.5" /> Publish
              </button>
            )}
            {canEdit && m.status === 'published' && (
              <button
                type="button"
                onClick={onArchive}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100"
              >
                <Archive className="size-3.5" /> Archive
              </button>
            )}
          </div>
        )}
      </div>
      {m.description && <p className="px-4 text-xs text-slate-500 line-clamp-2">{m.description}</p>}
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-200/70 px-4 py-3">
        <div className="min-w-0 truncate text-xs text-slate-600">
          {m.facultyName && <span>{m.facultyName} · </span>}
          {fmtDate(m.createdAt)}
          {m.downloadCount !== undefined && (
            <span className="ml-2">{m.downloadCount} downloads</span>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold capitalize ${m.status === 'published' ? 'bg-emerald-50 text-emerald-700' : m.status === 'archived' ? 'bg-slate-200 text-slate-600' : 'bg-amber-50 text-amber-700'}`}
        >
          {m.status}
        </span>
      </div>
    </motion.div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function StudyMaterialPage() {
  const activeRole = useAuthStore(
    (state) => state.activeRole?.baseRole ?? state.activeRole?.name ?? state.role,
  );
  const canView = useHasPermission('study_material', 'view');
  const hasEditPermission = useHasPermission('study_material', 'edit');
  const canAuthor = AUTHOR_ROLES.includes(activeRole ?? '') && hasEditPermission;
  const canManage = MANAGE_ROLES.includes(activeRole ?? '') && hasEditPermission;

  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<IStudyMaterial | null>(null);
  const [filterType, setFilterType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [openFolder, setOpenFolder] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [collection, setCollection] = useState<'all' | 'published' | 'draft' | 'archived'>('all');
  const [sortBy, setSortBy] = useState<'modified' | 'name'>('modified');
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [openMenuId, setOpenMenuId] = useState('');
  const [previewMaterial, setPreviewMaterial] = useState<IStudyMaterial | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;
  const filterSubject = openFolder;

  const handleFilterType = (v: string) => {
    setFilterType(v);
    setPage(1);
  };
  const apiUrl = useMemo(() => {
    const q = new URLSearchParams();
    q.set('page', String(page));
    q.set('limit', String(PAGE_SIZE));
    if (filterType) q.set('materialType', filterType);
    if (filterSubject) q.set('subjectId', filterSubject);
    return `study-material?${q.toString()}`;
  }, [page, filterType, filterSubject]);

  const { data: raw, error, isLoading, mutate } = useSwr(canView ? apiUrl : null);
  const { mutation } = useMutation();
  const records: IStudyMaterial[] = useMemo(
    () =>
      (raw as { data?: { data?: IStudyMaterial[] } })?.data?.data ??
      (raw as { data?: IStudyMaterial[] })?.data ??
      [],
    [raw],
  );
  const totalCount = (raw as { data?: { total?: number } })?.data?.total ?? records.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const collectionRecords =
      collection === 'all' ? records : records.filter((record) => record.status === collection);
    const folderRecords = openFolder
      ? collectionRecords.filter((record) => String(record.subjectId) === openFolder)
      : collectionRecords;
    const matching = !query
      ? folderRecords
      : folderRecords.filter((record) =>
          [record.title, record.description, record.subjectCode, record.subjectName, record.program]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(query)),
        );
    return [...matching].sort((left, right) =>
      sortBy === 'name'
        ? left.title.localeCompare(right.title)
        : new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );
  }, [collection, openFolder, records, searchQuery, sortBy]);
  const subjectFolders = useMemo(
    () =>
      Array.from(
        records
          .reduce((folders, record) => {
            const key = String(record.subjectId ?? record.subjectCode ?? 'general');
            const current = folders.get(key);
            if (current) current.count += 1;
            else
              folders.set(key, {
                id: key,
                name: record.subjectName || record.subjectCode || 'General resources',
                code: record.subjectCode || 'FILES',
                count: 1,
              });
            return folders;
          }, new Map<string, { id: string; name: string; code: string; count: number }>())
          .values(),
      ),
    [records],
  );

  const openMaterialInViewer = async (m: IStudyMaterial) => {
    const response = await mutation(`study-material/${m._id}/download`, {
      method: 'POST',
      body: {},
      silentError: true,
      returnError: true,
    });
    const url =
      (response as { results?: { data?: { url?: string } } })?.results?.data?.url ??
      m.fileUrl ??
      m.externalLink;
    if (!url) {
      const message = (response as { results?: { message?: string } })?.results?.message;
      toast.error(message || 'This material cannot be opened right now');
      return;
    }
    setPreviewMaterial({
      ...m,
      fileUrl: url,
    });
  };
  const openPreview = (material: IStudyMaterial) => {
    void openMaterialInViewer(material);
  };
  const handleLifecycle = async (m: IStudyMaterial, action: 'publish' | 'archive') => {
    const response = await mutation(`study-material/${m._id}/${action}`, { method: 'POST' });
    if (!response?.results?.success) return;
    toast.success(action === 'publish' ? 'Study material published' : 'Study material archived');
    await mutate();
  };

  if (!canView) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Study material access unavailable</h1>
        <p className="mt-2 text-sm text-slate-500">
          Your active role cannot view learning materials.
        </p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">
          Study materials could not be loaded
        </h1>
        <p className="mt-2 text-sm text-red-600">{error.message}</p>
        <CustomButton className="mx-auto mt-4 w-fit!" onClick={() => mutate()}>
          Try again
        </CustomButton>
      </div>
    );
  }

  const folderName = subjectFolders.find((folder) => folder.id === openFolder)?.name;
  const collections = [
    { id: 'all' as const, label: 'My materials', icon: Layers3, count: records.length },
    {
      id: 'published' as const,
      label: 'Published',
      icon: Send,
      count: records.filter((record) => record.status === 'published').length,
    },
    {
      id: 'draft' as const,
      label: 'Drafts',
      icon: FileText,
      count: records.filter((record) => record.status === 'draft').length,
    },
    {
      id: 'archived' as const,
      label: 'Archived',
      icon: Archive,
      count: records.filter((record) => record.status === 'archived').length,
    },
  ];

  return (
    <main className="min-w-0 space-y-5 rounded-3xl bg-white p-4 [&_button:not(:disabled)]:cursor-pointer sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-3xl font-medium text-slate-900">My Materials</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {canAuthor || canManage
              ? 'Upload and manage study materials'
              : 'Browse and download study materials'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canAuthor && (
            <CustomButton
              variant="primary"
              startIcon={<Plus className="size-4" />}
              onClick={() => {
                setEditItem(null);
                setShowModal(true);
              }}
              className="w-fit!"
            >
              New
            </CustomButton>
          )}
          <div
            className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-slate-100 p-1 "
            role="tablist"
            aria-label="Material view"
          >
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              role="tab"
              aria-selected={viewMode === 'grid'}
              className={`inline-flex h-8 items-center gap-2 rounded-lg px-3 text-xs font-semibold transition-all ${viewMode === 'grid' ? 'bg-white text-primary  ring-1 ring-slate-200' : 'text-slate-500 hover:bg-white/70 hover:text-slate-800'}`}
              aria-label="Grid view"
            >
              <Grid2X2 className="size-4" />
              <span>Grid</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              role="tab"
              aria-selected={viewMode === 'list'}
              className={`inline-flex h-8 items-center gap-2 rounded-lg px-3 text-xs font-semibold transition-all ${viewMode === 'list' ? 'bg-white text-primary  ring-1 ring-slate-200' : 'text-slate-500 hover:bg-white/70 hover:text-slate-800'}`}
              aria-label="List view"
            >
              <List className="size-4" />
              <span>List</span>
            </button>
          </div>
        </div>
      </motion.div>

      <section className="rounded-2xl bg-slate-100/80 p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-600" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search your files by title, subject, code or programme"
              className="h-12 w-full rounded-2xl border border-transparent bg-white pl-10 pr-4 text-sm  outline-none transition focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
            />
          </div>
        </div>
      </section>

      {selectedMaterialId && (
        <div className="flex h-14 items-center gap-2 rounded-full bg-slate-100 px-4 ">
          <button
            type="button"
            onClick={() => setSelectedMaterialId('')}
            className="rounded-full p-1.5 hover:bg-white"
          >
            <X className="size-5" />
          </button>
          <span className="mr-2 text-sm font-semibold text-slate-700">1 selected</span>
          <button
            type="button"
            onClick={() => {
              const item = records.find((record) => record._id === selectedMaterialId);
              if (item) openPreview(item);
            }}
            className="rounded-full p-2 text-slate-600 hover:bg-white"
            title="Preview"
          >
            <Eye className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => {
              const item = records.find((record) => record._id === selectedMaterialId);
              if (item) void openMaterialInViewer(item);
            }}
            className="rounded-full p-2 text-slate-600 hover:bg-white"
            title="Open resource"
          >
            <Download className="size-5" />
          </button>
          <MoreVertical className="size-5 text-slate-500" />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 text-sm text-slate-600">
          <button
            type="button"
            onClick={() => setOpenFolder('')}
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 font-semibold hover:bg-slate-100"
          >
            <Home className="size-4" /> My materials
          </button>
          {folderName && (
            <>
              <ChevronRight className="size-4 text-slate-300" />
              <span className="font-bold text-slate-800">{folderName}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSortBy((current) => (current === 'modified' ? 'name' : 'modified'))}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600"
          >
            <ArrowUpDown className="size-3.5" /> {sortBy === 'modified' ? 'Last modified' : 'Name'}
          </button>
        </div>
      </div>

      {!openFolder && subjectFolders.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Folder className="size-4 text-primary" />
            <h2 className="text-sm font-bold text-slate-800">Subject folders</h2>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(16rem,18rem))] justify-start gap-3">
            {subjectFolders.map((folder, index) => (
              <motion.button
                key={folder.id}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                onClick={() => setOpenFolder(folder.id)}
                className="group flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 text-left  transition hover:-translate-y-0.5 hover:border-primary-100 "
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <Folder className="size-5 fill-amber-100" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-slate-800">
                    {folder.name}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-600">
                    {folder.code} · {folder.count} {folder.count === 1 ? 'file' : 'files'}
                  </span>
                </span>
                <ChevronRight className="size-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-primary" />
              </motion.button>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-4">
        {collections.map(({ id, label, count }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setCollection(id);
              setOpenFolder('');
            }}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${collection === id ? 'border-primary bg-primary-50 text-primary' : 'border-slate-300 bg-white text-slate-600'}`}
          >
            {label} <span className="ml-1 text-slate-600">{count}</span>
          </button>
        ))}
        {Object.entries(TYPE_CFG).map(([t, c]) => {
          const Icon = c.icon;
          const count = records.filter((r) => r.materialType === t).length;
          return (
            <button
              key={t}
              type="button"
              onClick={() => handleFilterType(filterType === t ? '' : t)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 transition-colors ${filterType === t ? `${c.bg} ${c.text} border-current/20` : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium">{c.label}</span>
              <span className="rounded-full bg-white/70 px-1.5 text-[10px]">{count}</span>
            </button>
          );
        })}
      </div>

      {(filterType || searchQuery) && (
        <div className="flex justify-end">
          <CustomButton
            variant="tertiary"
            onClick={() => {
              handleFilterType('');
              setSearchQuery('');
            }}
            className="py-1.5! text-xs! w-fit!"
          >
            Clear
          </CustomButton>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      ) : filtered.length ? (
        <>
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-[repeat(auto-fill,minmax(16rem,18rem))] justify-start gap-4'
                : 'space-y-2'
            }
          >
            {filtered.map((m) =>
              viewMode === 'grid' ? (
                <MaterialCard
                  key={m._id}
                  m={m}
                  canEdit={canManage}
                  onPreview={() => {
                    setOpenMenuId('');
                    openPreview(m);
                  }}
                  onOpenResource={() => {
                    setOpenMenuId('');
                    void openMaterialInViewer(m);
                  }}
                  onEdit={() => {
                    setOpenMenuId('');
                    setEditItem(m);
                    setShowModal(true);
                  }}
                  onPublish={() => {
                    setOpenMenuId('');
                    void handleLifecycle(m, 'publish');
                  }}
                  onArchive={() => {
                    setOpenMenuId('');
                    void handleLifecycle(m, 'archive');
                  }}
                  selected={selectedMaterialId === m._id}
                  onSelect={() =>
                    setSelectedMaterialId((current) => (current === m._id ? '' : m._id))
                  }
                  menuOpen={openMenuId === m._id}
                  onToggleMenu={() => setOpenMenuId((current) => (current === m._id ? '' : m._id))}
                />
              ) : (
                <div
                  key={m._id}
                  className={`relative grid w-full grid-cols-[minmax(0,1fr)_7rem_8rem_2.5rem] items-center gap-4 rounded-xl border bg-white px-4 py-3 text-left text-sm transition hover:border-slate-300  ${selectedMaterialId === m._id ? 'border-primary bg-primary-50/40 ring-2 ring-primary/10' : 'border-slate-100'}`}
                >
                  <button
                    type="button"
                    onClick={() => openPreview(m)}
                    className="flex min-w-0 items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  >
                    <span
                      className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${(TYPE_CFG[m.materialType] ?? TYPE_CFG.other).bg} ${(TYPE_CFG[m.materialType] ?? TYPE_CFG.other).text}`}
                    >
                      <FileText className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-slate-800">{m.title}</span>
                      <span className="block truncate text-xs text-slate-600">
                        {m.subjectCode} · {m.subjectName}
                      </span>
                    </span>
                  </button>
                  <span
                    className={`w-fit rounded-full px-2 py-1 text-[10px] font-bold capitalize ${m.status === 'published' ? 'bg-emerald-50 text-emerald-700' : m.status === 'archived' ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-700'}`}
                  >
                    {m.status}
                  </span>
                  <span className="text-slate-500">{fmtDate(m.createdAt)}</span>
                  <button
                    type="button"
                    onClick={() => setOpenMenuId((current) => (current === m._id ? '' : m._id))}
                    className="flex size-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                    aria-label={`More actions for ${m.title}`}
                    aria-expanded={openMenuId === m._id}
                  >
                    <MoreVertical className="size-4" />
                  </button>
                  {openMenuId === m._id && (
                    <div className="absolute right-3 top-12 z-30 w-48 rounded-xl border border-slate-200 bg-white p-1.5 text-xs ">
                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenuId('');
                          openPreview(m);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100"
                      >
                        <Eye className="size-3.5" /> Preview
                      </button>
                      {(m.fileUrl || m.externalLink) && (
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId('');
                            void openMaterialInViewer(m);
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100"
                        >
                          <Download className="size-3.5" /> Open resource
                        </button>
                      )}
                      {canManage && m.status === 'draft' && (
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId('');
                            setEditItem(m);
                            setShowModal(true);
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100"
                        >
                          <Edit2 className="size-3.5" /> Edit draft
                        </button>
                      )}
                      {canManage && m.status === 'draft' && (
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId('');
                            void handleLifecycle(m, 'publish');
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100"
                        >
                          <Send className="size-3.5" /> Publish
                        </button>
                      )}
                      {canManage && m.status === 'published' && (
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId('');
                            void handleLifecycle(m, 'archive');
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100"
                        >
                          <Archive className="size-3.5" /> Archive
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ),
            )}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-600 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-slate-500">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-600 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-16">
          <BookOpen className="h-10 w-10 text-slate-200 mb-2" />
          <p className="text-sm text-slate-600">No materials found</p>
        </div>
      )}

      <AnimatePresence>
        {showModal && (editItem ? canManage : canAuthor) && (
          <UploadModal
            material={editItem}
            onClose={() => {
              setShowModal(false);
              setEditItem(null);
            }}
            onSaved={() => {
              mutate();
              setShowModal(false);
              setEditItem(null);
            }}
          />
        )}
      </AnimatePresence>
      <FileViewer
        open={Boolean(previewMaterial?.fileUrl)}
        onClose={() => setPreviewMaterial(null)}
        title={previewMaterial?.title}
        allowExternalOpen={false}
        files={
          previewMaterial?.fileUrl
            ? [{ url: previewMaterial.fileUrl, name: previewMaterial.title }]
            : []
        }
      />
    </main>
  );
}
