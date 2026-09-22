'use client';

import CustomButton from '@/shared/core/CustomButton';
import AsyncSelect, { TAsyncSelectType } from '@/shared/core/AsyncSelect';
import Empty from '@/shared/core/Empty';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { motion } from '@/shared/utils/motion';
import { Box } from '@mui/material';
import {
  BadgeCheck,
  CheckCircle2,
  Clock3,
  CircleAlert,
  Copy,
  ChevronDown,
  ChevronUp,
  Eye,
  FileBadge,
  History,
  Image as ImageIcon,
  Plus,
  QrCode,
  Redo2,
  RotateCw,
  Save,
  Send,
  Trash2,
  Type,
  Undo2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { getLocalStorageItem, removeFromLocalStorage, setLocalStorageItem } from '@/shared/utils';

type TElementType = 'text' | 'image' | 'line' | 'qr';
interface IElement {
  id: string;
  type: TElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  content?: string;
  source?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  align?: 'left' | 'center' | 'right';
  color?: string;
  backgroundColor?: string;
  borderRadius?: number;
  rotation?: number;
  opacity?: number;
}
interface ITemplate {
  _id: string;
  name: string;
  description?: string;
  category: string;
  tags: string[];
  kind: 'certificate' | 'id_card' | 'letter' | 'report' | 'poster';
  audience: 'student' | 'faculty' | 'visitor';
  page: { widthMm: number; heightMm: number; orientation: 'portrait' | 'landscape' };
  backgroundUrl?: string;
  elements: IElement[];
  version: number;
  status: 'draft' | 'pending_approval' | 'approved' | 'published' | 'retired';
  updatedAt: string;
}
interface IMetadata {
  audiences: Record<string, string[]>;
  institution: string[];
}
interface ITemplateVersion {
  _id: string;
  version: number;
  snapshotHash: string;
  createdAt: string;
}
interface IIssuedDocument {
  _id: string;
  documentNumber: string;
  templateVersion: number;
  subjectType: string;
  subjectId: string;
  issuedAt: string;
  revokedAt?: string;
  templateId?: { _id?: string; name?: string };
  pdfHash: string;
}
interface IApiResponse<T> {
  success: boolean;
  data: T;
}

const newElement = (type: TElementType): IElement => ({
  id: crypto.randomUUID(),
  type,
  x: 10,
  y: 10,
  width: type === 'text' ? 70 : 25,
  height: type === 'text' ? 12 : 25,
  content: type === 'text' ? 'New text' : undefined,
  source: type === 'image' ? '{{institution.logoUrl}}' : undefined,
  fontSize: 12,
  fontWeight: 'normal',
  align: 'left',
  color: '#111827',
  borderRadius: 0,
});

const friendlyField = (token: string) =>
  token
    .replace(/^\{\{(subject|institution|document)\./, '')
    .replace(/\}\}$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (letter) => letter.toUpperCase());

export default function DocumentDesignerPage() {
  const {
    data: templatesRaw,
    mutate: refreshTemplates,
    isLoading: templatesLoading,
    error: templatesError,
  } = useSwr<IApiResponse<ITemplate[]>>('document-template');
  const { data: metadataRaw } = useSwr<IApiResponse<IMetadata>>('document-template/metadata');
  const { data: issuedRaw, mutate: refreshIssued } = useSwr<IApiResponse<IIssuedDocument[]>>(
    'document-template/issued',
  );
  const { mutation, isLoading } = useMutation();
  const templates = useMemo(
    () =>
      (templatesRaw?.data ?? []).map((template) => ({
        ...template,
        status: template.status ?? ('draft' as const),
        category: template.category ?? 'General',
        tags: template.tags ?? [],
      })),
    [templatesRaw],
  );
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [tags, setTags] = useState('');
  const [kind, setKind] = useState<ITemplate['kind']>('certificate');
  const [audience, setAudience] = useState<ITemplate['audience']>('student');
  const [width, setWidth] = useState(210);
  const [height, setHeight] = useState(297);
  const [backgroundUrl, setBackgroundUrl] = useState('');
  const [elements, setElements] = useState<IElement[]>([]);
  const [undoStack, setUndoStack] = useState<IElement[][]>([]);
  const [redoStack, setRedoStack] = useState<IElement[][]>([]);
  const [zoom, setZoom] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [issueTemplate, setIssueTemplate] = useState<ITemplate | null>(null);
  const [historyTemplate, setHistoryTemplate] = useState<ITemplate | null>(null);
  const { data: versionsRaw } = useSwr<IApiResponse<ITemplateVersion[]>>(
    historyTemplate ? `document-template/${historyTemplate._id}/versions` : null,
  );
  const [subjectId, setSubjectId] = useState('');
  const dragOrigin = useRef<{ elements: IElement[]; id: string } | null>(null);
  const selected = elements.find((item) => item.id === selectedId) ?? null;
  const issuedDocuments = issuedRaw?.data ?? [];
  const versions = versionsRaw?.data ?? [];
  const tokens = [
    ...(metadataRaw?.data?.audiences[audience] ?? []).map((field) => `{{subject.${field}}}`),
    ...(metadataRaw?.data?.institution ?? []).map((field) => `{{institution.${field}}}`),
    '{{document.number}}',
    '{{document.issuedAt}}',
    '{{document.verificationCode}}',
  ];
  const issueSelectorType: TAsyncSelectType =
    issueTemplate?.audience === 'faculty'
      ? 'faculty'
      : issueTemplate?.audience === 'visitor'
        ? 'visitors'
        : 'students';
  const reset = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setCategory('General');
    setTags('');
    setKind('certificate');
    setAudience('student');
    setWidth(210);
    setHeight(297);
    setBackgroundUrl('');
    setElements([]);
    setUndoStack([]);
    setRedoStack([]);
    setSelectedId(null);
  };
  const createNew = () => {
    reset();
    const saved = getLocalStorageItem('document-designer-draft:new');
    if (saved) {
      try {
        const draft = saved as {
          name?: string;
          description?: string;
          category?: string;
          tags?: string;
          kind?: ITemplate['kind'];
          audience?: ITemplate['audience'];
          width?: number;
          height?: number;
          backgroundUrl?: string;
          elements?: IElement[];
        };
        setName(draft.name ?? '');
        setDescription(draft.description ?? '');
        setCategory(draft.category ?? 'General');
        setTags(draft.tags ?? '');
        setKind(draft.kind ?? 'certificate');
        setAudience(draft.audience ?? 'student');
        setWidth(draft.width ?? 210);
        setHeight(draft.height ?? 297);
        setBackgroundUrl(draft.backgroundUrl ?? '');
        setElements(draft.elements ?? []);
        toast.info('Recovered your local design draft');
      } catch {
        removeFromLocalStorage('document-designer-draft:new');
      }
    }
    setOpen(true);
  };
  const edit = (template: ITemplate) => {
    setEditingId(template._id);
    setName(template.name);
    setDescription(template.description ?? '');
    setCategory(template.category ?? 'General');
    setTags(template.tags?.join(', ') ?? '');
    setKind(template.kind);
    setAudience(template.audience);
    setWidth(template.page.widthMm);
    setHeight(template.page.heightMm);
    setBackgroundUrl(template.backgroundUrl ?? '');
    setElements(template.elements);
    setUndoStack([]);
    setRedoStack([]);
    setSelectedId(null);
    setOpen(true);
  };
  const applyElements = useCallback((updater: (current: IElement[]) => IElement[]) => {
    setElements((current) => {
      const next = updater(current);
      if (next === current) return current;
      setUndoStack((history) => [...history.slice(-39), current]);
      setRedoStack([]);
      return next;
    });
  }, []);
  const updateElement = (next: Partial<IElement>) =>
    applyElements((current) =>
      current.map((item) => (item.id === selectedId ? { ...item, ...next } : item)),
    );
  const undo = () => {
    const previous = undoStack.at(-1);
    if (!previous) return;
    setRedoStack((history) => [elements, ...history].slice(0, 40));
    setUndoStack((history) => history.slice(0, -1));
    setElements(previous);
  };
  const redo = () => {
    const next = redoStack[0];
    if (!next) return;
    setUndoStack((history) => [...history, elements].slice(-40));
    setRedoStack((history) => history.slice(1));
    setElements(next);
  };
  const beginPointerEdit = (
    event: React.PointerEvent<HTMLElement>,
    element: IElement,
    mode: 'move' | 'resize',
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(element.id);
    dragOrigin.current = { elements, id: element.id };
    const startX = event.clientX;
    const startY = event.clientY;
    const start = { ...element };
    const move = (pointerEvent: PointerEvent) => {
      const dx = (pointerEvent.clientX - startX) / (2 * zoom);
      const dy = (pointerEvent.clientY - startY) / (2 * zoom);
      setElements((current) =>
        current.map((item) =>
          item.id !== element.id
            ? item
            : mode === 'move'
              ? {
                  ...item,
                  x: Math.max(0, Math.min(width - item.width, start.x + dx)),
                  y: Math.max(0, Math.min(height - item.height, start.y + dy)),
                }
              : {
                  ...item,
                  width: Math.max(5, Math.min(width - item.x, start.width + dx)),
                  height: Math.max(5, Math.min(height - item.y, start.height + dy)),
                },
        ),
      );
    };
    const end = () => {
      const origin = dragOrigin.current;
      if (origin) {
        setUndoStack((history) => [...history.slice(-39), origin.elements]);
        setRedoStack([]);
      }
      dragOrigin.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end, { once: true });
  };
  const moveLayer = (id: string, direction: -1 | 1) =>
    applyElements((current) => {
      const index = current.findIndex((item) => item.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex]!, next[index]!];
      return next;
    });
  const duplicateSelected = () => {
    if (!selected) return;
    const duplicate = {
      ...selected,
      id: crypto.randomUUID(),
      x: Math.min(width - selected.width, selected.x + 4),
      y: Math.min(height - selected.height, selected.y + 4),
    };
    applyElements((current) => [...current, duplicate]);
    setSelectedId(duplicate.id);
  };
  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => {
      setLocalStorageItem(`document-designer-draft:${editingId ?? 'new'}`, {
        name,
        description,
        category,
        tags,
        kind,
        audience,
        width,
        height,
        backgroundUrl,
        elements,
        savedAt: new Date().toISOString(),
      });
    }, 600);
    return () => window.clearTimeout(timeout);
  }, [
    audience,
    backgroundUrl,
    category,
    description,
    editingId,
    elements,
    height,
    kind,
    name,
    open,
    tags,
    width,
  ]);
  const save = async () => {
    if (!name.trim()) {
      toast.error('Template name is required');
      return;
    }
    const response = await mutation(
      editingId ? `document-template/${editingId}` : 'document-template',
      {
        method: editingId ? 'PUT' : 'POST',
        body: {
          name,
          description,
          category,
          tags: tags
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
          kind,
          audience,
          page: {
            widthMm: width,
            heightMm: height,
            orientation: width > height ? 'landscape' : 'portrait',
          },
          backgroundUrl,
          elements,
          isActive: true,
        },
      },
    );
    if (!response?.results?.success) return;
    toast.success('Template saved');
    refreshTemplates();
    setOpen(false);
    removeFromLocalStorage(`document-designer-draft:${editingId ?? 'new'}`);
    reset();
  };
  const transition = async (
    template: ITemplate,
    action: 'submit' | 'approve' | 'publish' | 'revise' | 'retire',
  ) => {
    const response = await mutation(`document-template/${template._id}/lifecycle/${action}`, {
      method: 'POST',
      body: {},
    });
    if (!response?.results?.success) return;
    toast.success(`Template ${action} completed`);
    await refreshTemplates();
  };
  const retireTemplate = async (template: ITemplate) => {
    const confirmation = await Swal.fire({
      title: `Retire ${template.name}?`,
      text: 'It will no longer be available for new documents. Already issued documents remain verifiable.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Retire template',
      confirmButtonColor: '#dc2626',
    });
    if (confirmation.isConfirmed) await transition(template, 'retire');
  };
  const issue = async () => {
    if (!issueTemplate || !subjectId.trim()) {
      toast.error('Select who should receive this document');
      return;
    }
    const response = await mutation(`document-template/${issueTemplate._id}/issue`, {
      method: 'POST',
      body: { subjectId },
    });
    const data = response?.results?.data as
      | { pdfBase64?: string; issued?: { documentNumber?: string } }
      | undefined;
    if (!data?.pdfBase64) return;
    const bytes = Uint8Array.from(atob(data.pdfBase64), (char) => char.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${data.issued?.documentNumber ?? 'issued-document'}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success('Document issued and registered');
    await refreshIssued();
    setIssueTemplate(null);
    setSubjectId('');
  };
  const revokeIssued = async (document: IIssuedDocument) => {
    const prompt = await Swal.fire({
      title: `Revoke ${document.documentNumber}?`,
      input: 'textarea',
      inputLabel: 'Reason for revocation',
      inputPlaceholder: 'Explain why this issued document must no longer be accepted',
      showCancelButton: true,
      confirmButtonText: 'Revoke document',
      confirmButtonColor: '#dc2626',
      inputValidator: (value) =>
        value.trim().length < 5 ? 'Enter a clear reason with at least 5 characters' : undefined,
    });
    if (!prompt.isConfirmed) return;
    const response = await mutation(`document-template/issued/${document._id}/revoke`, {
      method: 'POST',
      body: { reason: prompt.value },
    });
    if (!response?.results?.success) return;
    toast.success('Document revoked; QR verification will now show it as invalid');
    await refreshIssued();
  };
  const prepareReissue = (document: IIssuedDocument) => {
    const template = templates.find(
      (item) => typeof document.templateId === 'object' && item._id === document.templateId?._id,
    );
    if (!template || template.status !== 'published') {
      toast.error('The published template is unavailable for reissue');
      return;
    }
    setSubjectId(document.subjectId);
    setIssueTemplate(template);
  };

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
            <FileBadge className="h-4 w-4" /> Document automation
          </div>
          <h1 className="text-3xl font-black text-slate-950">Institution Design Studio</h1>
          <p className="mt-1 text-sm text-slate-500">
            Design governed certificates, cards, letters, reports and posters with trusted ERP data.
          </p>
        </div>
        <CustomButton
          variant="primary"
          onClick={createNew}
          startIcon={<Plus className="h-4 w-4" />}
        >
          New template
        </CustomButton>
      </header>
      {templatesError && (
        <section className="flex flex-col gap-4 rounded-3xl bg-rose-50 p-5 text-rose-700 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <CircleAlert className="mt-0.5 size-5 shrink-0" />
            <div>
              <h2 className="font-bold">Design Studio could not load institution templates</h2>
              <p className="mt-1 text-sm text-rose-600">
                Your local draft remains safe. Check the connection and try again.
              </p>
            </div>
          </div>
          <CustomButton
            variant="secondary"
            onClick={() => void refreshTemplates()}
            startIcon={<RotateCw className="size-4" />}
          >
            Try again
          </CustomButton>
        </section>
      )}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {templatesLoading &&
          [0, 1, 2].map((item) => (
            <div key={item} className="h-56 animate-pulse rounded-3xl bg-white" />
          ))}
        {templates.map((template) => (
          <motion.div
            whileHover={{ y: -3 }}
            key={template._id}
            className="rounded-3xl bg-white p-5"
          >
            <div className="flex items-center justify-between">
              <span className="rounded-xl bg-violet-50 px-2.5 py-1 text-xs font-bold capitalize text-violet-700">
                {template.kind.replace('_', ' ')}
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                  template.status === 'published'
                    ? 'bg-emerald-50 text-emerald-700'
                    : template.status === 'pending_approval'
                      ? 'bg-amber-50 text-amber-700'
                      : template.status === 'approved'
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-slate-100 text-slate-600'
                }`}
              >
                {template.status.replace('_', ' ')} · v{template.version}
              </span>
            </div>
            <h3 className="mt-5 font-black text-slate-900">{template.name}</h3>
            <p className="mt-1 text-sm capitalize text-slate-500">
              {template.audience} · {template.page.widthMm} × {template.page.heightMm} mm
            </p>
            {template.description && (
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">
                {template.description}
              </p>
            )}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setHistoryTemplate(template)}
                className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-primary"
              >
                <History className="size-3.5" /> History
              </button>
              {template.status === 'draft' && (
                <>
                  <button
                    onClick={() => edit(template)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-primary"
                  >
                    <Eye className="size-3.5" /> Open designer
                  </button>
                  <CustomButton
                    variant="secondary"
                    onClick={() => transition(template, 'submit')}
                    startIcon={<Send className="h-4 w-4" />}
                  >
                    Submit
                  </CustomButton>
                </>
              )}
              {template.status === 'pending_approval' && (
                <CustomButton
                  variant="secondary"
                  onClick={() => transition(template, 'approve')}
                  startIcon={<CheckCircle2 className="h-4 w-4" />}
                >
                  Approve
                </CustomButton>
              )}
              {template.status === 'approved' && (
                <CustomButton
                  variant="primary"
                  onClick={() => transition(template, 'publish')}
                  startIcon={<BadgeCheck className="h-4 w-4" />}
                >
                  Publish
                </CustomButton>
              )}
              {template.status === 'published' && (
                <>
                  <button
                    onClick={() => transition(template, 'revise')}
                    className="inline-flex items-center gap-1 text-xs font-bold text-primary"
                  >
                    <Copy className="size-3.5" /> New revision
                  </button>
                  <button
                    onClick={() => void retireTemplate(template)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-rose-600"
                  >
                    Retire
                  </button>
                  <CustomButton
                    variant="secondary"
                    onClick={() => setIssueTemplate(template)}
                    startIcon={<BadgeCheck className="h-4 w-4" />}
                  >
                    Issue
                  </CustomButton>
                </>
              )}
            </div>
          </motion.div>
        ))}
        {!templatesLoading && !templatesError && templates.length === 0 && (
          <div className="md:col-span-2 xl:col-span-3">
            <Empty
              title="No institution templates yet"
              subTitle="Create the first governed certificate, letter, report, poster or ID card."
              pathName="Create first template"
              onClick={createNew}
            />
          </div>
        )}
      </section>
      <section className="rounded-3xl bg-white p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-blue-50 p-2.5 text-primary">
            <BadgeCheck className="size-5" />
          </span>
          <div>
            <h2 className="font-black text-slate-900">Issued-document registry</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Every official output retains its template version and cryptographic PDF fingerprint.
            </p>
          </div>
        </div>
        <div className="mt-5 divide-y divide-slate-100">
          {issuedDocuments.slice(0, 20).map((document) => (
            <div
              key={document._id}
              className="flex flex-col justify-between gap-2 py-3 sm:flex-row sm:items-center"
            >
              <div>
                <p className="text-sm font-bold text-slate-800">{document.documentNumber}</p>
                <p className="text-xs text-slate-500">
                  {document.templateId?.name ?? 'Document template'} · version{' '}
                  {document.templateVersion} · {document.subjectType}
                </p>
              </div>
              <div className="flex items-center gap-3 text-left sm:text-right">
                {!document.revokedAt && (
                  <button
                    type="button"
                    onClick={() => void revokeIssued(document)}
                    className="text-xs font-semibold text-rose-600"
                  >
                    Revoke
                  </button>
                )}
                {document.revokedAt && (
                  <button
                    type="button"
                    onClick={() => prepareReissue(document)}
                    className="text-xs font-semibold text-primary"
                  >
                    Reissue
                  </button>
                )}
                <div>
                  <p
                    className={`text-xs font-bold ${document.revokedAt ? 'text-rose-600' : 'text-emerald-600'}`}
                  >
                    {document.revokedAt ? 'Revoked' : 'Valid'}
                  </p>
                  <p className="font-mono text-[10px] text-slate-600">
                    PDF {document.pdfHash?.slice(0, 12)}…
                  </p>
                </div>
              </div>
            </div>
          ))}
          {!issuedDocuments.length && (
            <p className="py-8 text-center text-sm text-slate-600">
              Published and issued documents will appear here.
            </p>
          )}
        </div>
      </section>
      {open && (
        <div className="fixed inset-0 z-50 bg-slate-200/80 p-2 backdrop-blur-sm md:p-4">
          <div className="mx-auto flex h-[96dvh] max-w-[1500px] flex-col overflow-hidden rounded-3xl bg-slate-100">
            <div className="flex items-center justify-between bg-white px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-primary">
                  Structured canvas
                </p>
                <h2 className="font-black text-slate-900">
                  {editingId ? 'Edit template' : 'New template'}
                </h2>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="hidden items-center gap-1.5 text-[11px] font-medium text-slate-600 sm:flex">
                  <Clock3 className="size-3.5 text-emerald-500" />
                  Local autosave active
                </span>
                <button
                  type="button"
                  onClick={undo}
                  disabled={!undoStack.length}
                  aria-label="Undo"
                  className="rounded-lg bg-slate-100 p-2 text-slate-600 disabled:opacity-35"
                >
                  <Undo2 className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={redo}
                  disabled={!redoStack.length}
                  aria-label="Redo"
                  className="rounded-lg bg-slate-100 p-2 text-slate-600 disabled:opacity-35"
                >
                  <Redo2 className="size-4" />
                </button>
                <select
                  aria-label="Canvas zoom"
                  value={zoom}
                  onChange={(event) => setZoom(Number(event.target.value))}
                  className="rounded-lg bg-slate-100 px-2 py-2 text-xs font-semibold text-slate-600"
                >
                  <option value={0.5}>50%</option>
                  <option value={0.75}>75%</option>
                  <option value={1}>100%</option>
                  <option value={1.25}>125%</option>
                </select>
                <CustomButton
                  variant="primary"
                  onClick={save}
                  loading={isLoading}
                  startIcon={<Save className="h-4 w-4" />}
                >
                  Save
                </CustomButton>
                <button onClick={() => setOpen(false)} className="rounded-full bg-slate-100 p-2">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="grid min-h-0 flex-1 lg:grid-cols-[270px_1fr_290px]">
              <aside className="overflow-y-auto bg-white p-4">
                <div className="space-y-3">
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Template name"
                    className="w-full rounded-xl bg-slate-100 px-3 py-2.5 text-sm outline-none"
                  />
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Purpose and usage guidance"
                    rows={2}
                    className="w-full resize-none rounded-xl bg-slate-100 px-3 py-2.5 text-sm outline-none"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={category}
                      onChange={(event) => setCategory(event.target.value)}
                      placeholder="Category"
                      className="rounded-xl bg-slate-100 px-3 py-2.5 text-sm outline-none"
                    />
                    <input
                      value={tags}
                      onChange={(event) => setTags(event.target.value)}
                      placeholder="Tags, comma separated"
                      className="rounded-xl bg-slate-100 px-3 py-2.5 text-sm outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={kind}
                      onChange={(event) => {
                        const next = event.target.value as ITemplate['kind'];
                        setKind(next);
                        if (next === 'id_card') {
                          setWidth(54);
                          setHeight(86);
                        }
                      }}
                      className="rounded-xl bg-slate-100 px-2 py-2.5 text-sm"
                    >
                      <option value="certificate">Certificate</option>
                      <option value="id_card">ID card</option>
                      <option value="letter">Letter</option>
                      <option value="report">Report</option>
                      <option value="poster">Poster</option>
                    </select>
                    <select
                      value={audience}
                      onChange={(event) => setAudience(event.target.value as ITemplate['audience'])}
                      className="rounded-xl bg-slate-100 px-2 py-2.5 text-sm"
                    >
                      <option value="student">Student</option>
                      <option value="faculty">Faculty</option>
                      <option value="visitor">Visitor</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      value={width}
                      onChange={(event) => setWidth(Number(event.target.value))}
                      className="rounded-xl bg-slate-100 px-3 py-2 text-sm"
                    />
                    <input
                      type="number"
                      value={height}
                      onChange={(event) => setHeight(Number(event.target.value))}
                      className="rounded-xl bg-slate-100 px-3 py-2 text-sm"
                    />
                  </div>
                  <input
                    value={backgroundUrl}
                    onChange={(event) => setBackgroundUrl(event.target.value)}
                    placeholder="HTTPS background URL"
                    className="w-full rounded-xl bg-slate-100 px-3 py-2.5 text-sm outline-none"
                  />
                </div>
                <p className="mb-2 mt-6 text-xs font-bold uppercase tracking-wider text-slate-600">
                  Add element
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['text', Type, 'Text'],
                    ['image', ImageIcon, 'Image'],
                    ['qr', QrCode, 'QR'],
                    ['line', Plus, 'Line'],
                  ].map(([type, Icon, label]) => (
                    <button
                      key={String(type)}
                      onClick={() => {
                        const element = newElement(type as TElementType);
                        applyElements((current) => [...current, element]);
                        setSelectedId(element.id);
                      }}
                      className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs font-bold text-slate-600 hover:bg-blue-50"
                    >
                      <Icon className="h-4 w-4" />
                      {String(label)}
                    </button>
                  ))}
                </div>
                <p className="mb-2 mt-6 text-xs font-bold uppercase tracking-wider text-slate-600">
                  Elements
                </p>
                <div className="space-y-1">
                  {elements.map((element, index) => (
                    <button
                      key={element.id}
                      onClick={() => setSelectedId(element.id)}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs ${selectedId === element.id ? 'bg-primary text-white' : 'bg-slate-50 text-slate-600'}`}
                    >
                      <span className="capitalize">
                        {index + 1}. {element.type}
                      </span>
                      <span className="truncate">{element.content}</span>
                    </button>
                  ))}
                </div>
              </aside>
              <main className="overflow-auto p-6">
                <div className="flex min-h-full items-center justify-center">
                  <Box
                    sx={{
                      position: 'relative',
                      width: `${width * 2}px`,
                      height: `${height * 2}px`,
                      bgcolor: 'white',
                      backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : 'none',
                      backgroundSize: 'cover',
                      flexShrink: 0,
                      boxShadow: '0 20px 60px rgba(15,23,42,.15)',
                      transform: `scale(${zoom})`,
                      transformOrigin: 'center center',
                      backgroundColor: '#fff',
                      backgroundPosition: 'center',
                    }}
                  >
                    {elements.map((element) => (
                      <Box
                        key={element.id}
                        onClick={() => setSelectedId(element.id)}
                        onPointerDown={(event) => beginPointerEdit(event, element, 'move')}
                        sx={{
                          position: 'absolute',
                          left: `${element.x * 2}px`,
                          top: `${element.y * 2}px`,
                          width: `${element.width * 2}px`,
                          height: `${element.height * 2}px`,
                          fontSize: `${element.fontSize ?? 12}px`,
                          fontWeight: element.fontWeight === 'bold' ? 700 : 400,
                          textAlign: element.align ?? 'left',
                          color: element.color ?? '#111827',
                          bgcolor: element.backgroundColor ?? 'transparent',
                          borderRadius: `${element.borderRadius ?? 0}px`,
                          transform: `rotate(${element.rotation ?? 0}deg)`,
                          opacity: element.opacity ?? 1,
                          outline:
                            selectedId === element.id
                              ? '2px solid #0178D7'
                              : '1px dashed rgba(148,163,184,.45)',
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent:
                            element.align === 'center'
                              ? 'center'
                              : element.align === 'right'
                                ? 'flex-end'
                                : 'flex-start',
                          cursor: 'move',
                          touchAction: 'none',
                        }}
                      >
                        {element.type === 'text' ? (
                          element.content
                        ) : element.type === 'qr' ? (
                          <QrCode className="h-full w-full p-1" />
                        ) : element.type === 'image' ? (
                          <ImageIcon className="m-auto h-1/2 w-1/2 text-slate-300" />
                        ) : null}
                        {selectedId === element.id && (
                          <Box
                            component="button"
                            type="button"
                            aria-label="Resize element"
                            onPointerDown={(event) => beginPointerEdit(event, element, 'resize')}
                            sx={{
                              position: 'absolute',
                              right: '-5px',
                              bottom: '-5px',
                              width: '12px',
                              height: '12px',
                              borderRadius: '999px',
                              border: '2px solid white',
                              bgcolor: '#0178D7',
                              cursor: 'nwse-resize',
                              touchAction: 'none',
                            }}
                          />
                        )}
                      </Box>
                    ))}
                  </Box>
                </div>
              </main>
              <aside className="overflow-y-auto bg-white p-4">
                {selected ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-black capitalize text-slate-900">
                        {selected.type} settings
                      </h3>
                      <button
                        onClick={() => {
                          applyElements((current) =>
                            current.filter((item) => item.id !== selected.id),
                          );
                          setSelectedId(null);
                        }}
                        className="rounded-lg bg-red-50 p-2 text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => moveLayer(selected.id, 1)}
                        className="flex items-center justify-center gap-1 rounded-lg bg-slate-100 p-2 text-xs font-semibold text-slate-600"
                      >
                        <ChevronUp className="size-3.5" /> Forward
                      </button>
                      <button
                        type="button"
                        onClick={() => moveLayer(selected.id, -1)}
                        className="flex items-center justify-center gap-1 rounded-lg bg-slate-100 p-2 text-xs font-semibold text-slate-600"
                      >
                        <ChevronDown className="size-3.5" /> Back
                      </button>
                      <button
                        type="button"
                        onClick={duplicateSelected}
                        className="flex items-center justify-center gap-1 rounded-lg bg-slate-100 p-2 text-xs font-semibold text-slate-600"
                      >
                        <Copy className="size-3.5" /> Copy
                      </button>
                    </div>
                    {selected.type === 'text' && (
                      <>
                        <textarea
                          value={selected.content ?? ''}
                          onChange={(event) => updateElement({ content: event.target.value })}
                          rows={3}
                          className="w-full rounded-xl bg-slate-100 p-3 text-sm"
                        />
                        <select
                          onChange={(event) =>
                            updateElement({
                              content: `${selected.content ?? ''}${event.target.value}`,
                            })
                          }
                          className="w-full rounded-xl bg-slate-100 p-2.5 text-sm"
                        >
                          <option value="">Insert data field</option>
                          {tokens.map((token) => (
                            <option key={token} value={token}>
                              {friendlyField(token)}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                    {selected.type === 'image' && (
                      <input
                        value={selected.source ?? ''}
                        onChange={(event) => updateElement({ source: event.target.value })}
                        className="w-full rounded-xl bg-slate-100 p-2.5 text-sm"
                      />
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      {(['x', 'y', 'width', 'height'] as const).map((field) => (
                        <label
                          key={field}
                          className="text-xs font-semibold capitalize text-slate-500"
                        >
                          {field}
                          <input
                            type="number"
                            value={selected[field]}
                            onChange={(event) =>
                              updateElement({ [field]: Number(event.target.value) })
                            }
                            className="mt-1 w-full rounded-lg bg-slate-100 p-2 text-sm"
                          />
                        </label>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs font-semibold text-slate-500">
                        Rotation
                        <input
                          type="number"
                          min={-360}
                          max={360}
                          value={selected.rotation ?? 0}
                          onChange={(event) =>
                            updateElement({ rotation: Number(event.target.value) })
                          }
                          className="mt-1 w-full rounded-lg bg-slate-100 p-2 text-sm"
                        />
                      </label>
                      <label className="text-xs font-semibold text-slate-500">
                        Opacity
                        <input
                          type="number"
                          min={0.1}
                          max={1}
                          step={0.1}
                          value={selected.opacity ?? 1}
                          onChange={(event) =>
                            updateElement({ opacity: Number(event.target.value) })
                          }
                          className="mt-1 w-full rounded-lg bg-slate-100 p-2 text-sm"
                        />
                      </label>
                    </div>
                    {selected.type === 'text' && (
                      <>
                        <label className="text-xs font-semibold text-slate-500">
                          Font size
                          <input
                            type="number"
                            value={selected.fontSize ?? 12}
                            onChange={(event) =>
                              updateElement({ fontSize: Number(event.target.value) })
                            }
                            className="mt-1 w-full rounded-lg bg-slate-100 p-2 text-sm"
                          />
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={selected.fontWeight ?? 'normal'}
                            onChange={(event) =>
                              updateElement({ fontWeight: event.target.value as 'normal' | 'bold' })
                            }
                            className="rounded-lg bg-slate-100 p-2 text-sm"
                          >
                            <option value="normal">Normal</option>
                            <option value="bold">Bold</option>
                          </select>
                          <select
                            value={selected.align ?? 'left'}
                            onChange={(event) =>
                              updateElement({
                                align: event.target.value as 'left' | 'center' | 'right',
                              })
                            }
                            className="rounded-lg bg-slate-100 p-2 text-sm"
                          >
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                          </select>
                        </div>
                        <input
                          type="color"
                          value={selected.color ?? '#111827'}
                          onChange={(event) => updateElement({ color: event.target.value })}
                          className="h-10 w-full rounded-lg bg-slate-100 p-1"
                        />
                      </>
                    )}
                  </div>
                ) : (
                  <p className="py-10 text-center text-sm text-slate-600">
                    Select an element to configure it
                  </p>
                )}
              </aside>
            </div>
          </div>
        </div>
      )}
      {issueTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-200/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6">
            <div className="flex justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-primary">
                  Issue registered document
                </p>
                <h2 className="mt-1 font-black text-slate-900">{issueTemplate.name}</h2>
              </div>
              <button onClick={() => setIssueTemplate(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <AsyncSelect
              type={issueSelectorType}
              label={`Select ${issueTemplate.audience}`}
              value={subjectId}
              onChange={(value) => setSubjectId(value ?? '')}
              placeholder={`Search ${issueTemplate.audience} by name`}
              required
              className="mt-5"
            />
            <p className="mt-3 text-xs text-slate-600">
              The PDF receives a unique document number, verification QR and immutable issuance
              record.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <CustomButton variant="secondary" onClick={() => setIssueTemplate(null)}>
                Cancel
              </CustomButton>
              <CustomButton variant="primary" onClick={issue} loading={isLoading}>
                Issue PDF
              </CustomButton>
            </div>
          </div>
        </div>
      )}
      {historyTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-200/80 p-4 backdrop-blur-sm">
          <section className="w-full max-w-lg rounded-3xl bg-white p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-primary">
                  Immutable publication history
                </p>
                <h2 className="mt-1 font-black text-slate-900">{historyTemplate.name}</h2>
              </div>
              <button
                type="button"
                onClick={() => setHistoryTemplate(null)}
                className="rounded-full bg-slate-100 p-2"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-5 space-y-2">
              {versions.map((version) => (
                <div
                  key={version._id}
                  className="flex items-center justify-between rounded-xl bg-slate-50 p-3"
                >
                  <div>
                    <p className="text-sm font-bold text-slate-800">Version {version.version}</p>
                    <p className="text-[11px] text-slate-600">
                      {new Date(version.createdAt).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <code className="rounded-lg bg-white px-2 py-1 text-[10px] text-slate-500">
                    {version.snapshotHash.slice(0, 14)}…
                  </code>
                </div>
              ))}
              {!versions.length && (
                <p className="py-8 text-center text-sm text-slate-600">
                  A version is sealed when the approved template is published.
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
