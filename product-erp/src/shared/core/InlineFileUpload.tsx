/**
 * @file InlineFileUpload.tsx
 * @description Compact inline file uploader for use BESIDE a form field.
 *   - Single or multi-file mode
 *   - PDF and safe raster images accepted (max 5 MB each, matches backend uploadDocument)
 *   - Files are uploaded IMMEDIATELY on selection (no staging) so the parent
 *     can simply read back the list from the server.
 *   - Preview is NOT rendered inline; users press "View" to open the shared
 *     FileViewer modal (with prev/next when multiple files exist).
 * @module shared/core
 */
'use client';

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import { Eye, Loader2, Paperclip, Plus, Trash2, Upload as UploadIcon } from 'lucide-react';
import { toast } from 'react-toastify';
import FileViewer, { IViewerFile } from './FileViewer';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT =
  'application/pdf,image/jpeg,image/png,image/webp,image/gif,image/avif,image/bmp,image/tiff,image/heic,image/heif';

export interface IInlineFileUploadProps {
  label?: React.ReactNode;
  required?: boolean;
  multiple?: boolean;
  files: IViewerFile[];
  /** Called for each selected file. Resolve true on success, false on failure. */
  onUpload: (file: File) => Promise<boolean>;
  /** Called when the user removes a saved file (publicId identifies it). */
  onRemove?: (file: IViewerFile, index: number) => Promise<void>;
  disabled?: boolean;
  /** Compact (icon-only) mode for tight rows. Defaults to false. */
  compact?: boolean;
  /** Helper text shown under the label. */
  hint?: string;
  /** Branding-only exception: render a selected image directly instead of the FileViewer action. */
  inlineImagePreview?: boolean;
}

function validate(file: File): string | null {
  if (
    !/^(application\/pdf|image\/(png|jpe?g|webp|gif|avif|bmp|tiff?|heic|heif))$/i.test(file.type)
  ) {
    return 'Use PDF or a supported image file (JPG, PNG, WebP, GIF, AVIF, BMP, TIFF or HEIC).';
  }
  if (file.size > MAX_BYTES) return 'File exceeds the 5 MB size limit.';
  return null;
}

export default function InlineFileUpload({
  label,
  required,
  multiple = false,
  files,
  onUpload,
  onRemove,
  disabled,
  compact,
  hint,
  inlineImagePreview = false,
}: IInlineFileUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busyIdx, setBusyIdx] = useState<number | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIdx, setViewerIdx] = useState(0);

  const handleFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const picks = Array.from(list);
    setUploading(true);
    try {
      // Single-file mode: if a file already exists, REPLACE it (remove old → upload new)
      // so the user doesn't end up with duplicate uploads server-side.
      if (!multiple && files.length > 0 && onRemove) {
        try {
          await onRemove(files[0], 0);
        } catch {
          /* fall through — backend may still accept the new upload */
        }
      }
      for (const f of picks) {
        const err = validate(f);
        if (err) {
          toast.error(err);
          continue;
        }
        const ok = await onUpload(f);
        if (!ok) {
          toast.error(`Failed to upload "${f.name}"`);
          break;
        }
        if (!multiple) break;
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = async (i: number) => {
    if (!onRemove) return;
    setBusyIdx(i);
    try {
      await onRemove(files[i], i);
    } finally {
      setBusyIdx(null);
    }
  };

  const openViewerAt = (i: number) => {
    setViewerIdx(i);
    setViewerOpen(true);
  };

  // In single-file mode the trigger is rendered next to the file (Replace);
  // in empty state it's rendered in the dashed empty-row.

  return (
    <div className={compact ? '' : 'space-y-2'}>
      {label && !compact && (
        <div className="flex items-baseline justify-between gap-2">
          <label className="text-xs font-medium text-slate-600">
            {label}
            {required && <span className="ml-0.5 text-red-500">*</span>}
          </label>
          {hint && <span className="text-[10px] text-slate-600">{hint}</span>}
        </div>
      )}

      {/* Hidden native input — triggered by the inline buttons below. */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple={multiple}
        disabled={disabled || uploading}
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />

      {/* Empty state — single full-width row with Upload action on the right. */}
      {files.length === 0 && !compact && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <Paperclip className="h-3.5 w-3.5 shrink-0 text-slate-600" />
            <span className="truncate text-[11px] text-slate-600">
              {hint ?? 'PDF or image · 5 MB max'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || uploading}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-primary bg-primary px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <UploadIcon className="h-3 w-3" />
                Upload
              </>
            )}
          </button>
        </div>
      )}

      {files.length > 0 && !compact && inlineImagePreview && (
        <div className="overflow-hidden rounded-xl bg-white p-3">
          <div className="relative h-36 overflow-hidden rounded-lg bg-slate-50">
            <Image
              src={files[0].url}
              alt={files[0].name || 'Uploaded image preview'}
              fill
              sizes="(max-width: 768px) 100vw, 420px"
              className="object-contain p-3"
              unoptimized
            />
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={disabled || uploading}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-200 disabled:cursor-wait disabled:opacity-60"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <UploadIcon className="h-3.5 w-3.5" />
              )}
              {uploading ? 'Replacing…' : 'Replace logo'}
            </button>
            {onRemove && (
              <button
                type="button"
                onClick={() => handleRemove(0)}
                disabled={busyIdx === 0 || disabled}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-50"
              >
                {busyIdx === 0 ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Remove
              </button>
            )}
          </div>
        </div>
      )}

      {files.length > 0 && !compact && !inlineImagePreview && (
        <ul className="min-w-0 space-y-1 overflow-hidden">
          {files.map((f, i) => {
            const name = f.name || `File ${i + 1}`;
            const isLast = i === files.length - 1;
            const showReplaceHere = !multiple && isLast;
            return (
              <li
                key={f.url + i}
                className="flex min-w-0 items-center justify-between gap-2 overflow-hidden rounded-lg bg-slate-50 px-3 py-1.5"
              >
                <button
                  type="button"
                  onClick={() => openViewerAt(i)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <Paperclip className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                  <span
                    title={name}
                    className="block min-w-0 truncate text-xs text-slate-700 hover:text-primary"
                  >
                    {name}
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openViewerAt(i)}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
                  >
                    <Eye className="h-3 w-3" />
                    View
                  </button>
                  {showReplaceHere && (
                    <button
                      type="button"
                      onClick={() => inputRef.current?.click()}
                      disabled={disabled || uploading}
                      className="inline-flex items-center gap-1 rounded-md bg-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 transition-colors hover:bg-slate-300 disabled:opacity-60"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Uploading…
                        </>
                      ) : (
                        <>
                          <UploadIcon className="h-3 w-3" />
                          Replace
                        </>
                      )}
                    </button>
                  )}
                  {onRemove && (
                    <button
                      type="button"
                      onClick={() => handleRemove(i)}
                      disabled={busyIdx === i || disabled}
                      className="rounded-full p-1 text-red-500 hover:bg-red-50 disabled:opacity-50"
                      aria-label={`Remove ${name}`}
                    >
                      {busyIdx === i ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
          {multiple && (
            <li className="flex justify-end">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={disabled || uploading}
                className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-60"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Uploading…
                  </>
                ) : (
                  <>
                    <Plus className="h-3 w-3" />
                    Add file
                  </>
                )}
              </button>
            </li>
          )}
        </ul>
      )}

      {/* Compact (icon-only) trigger row — used inside dense table cells. */}
      {compact && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
          className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-60"
        >
          {uploading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <UploadIcon className="h-3 w-3" />
          )}
          {uploading ? 'Uploading…' : files.length ? 'Replace' : 'Upload'}
        </button>
      )}

      <FileViewer
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
        files={files}
        initialIndex={viewerIdx}
        title={typeof label === 'string' ? label : undefined}
      />
    </div>
  );
}
