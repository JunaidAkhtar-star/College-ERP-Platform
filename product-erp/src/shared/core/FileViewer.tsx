/**
 * @file FileViewer.tsx
 * @description Reusable full-screen viewer for one or many files (images / PDFs).
 *
 * Use this component for EVERY in-app file preview — never roll your own
 * `<img>` / `<iframe>` modal. Pass a list of `IViewerFile` and the viewer
 * handles thumbnails, prev / next arrows, keyboard navigation (Arrow keys,
 * Esc), download, and a "open in new tab" affordance.
 *
 * ```tsx
 * const [open, setOpen] = useState(false);
 * <CustomButton onClick={() => setOpen(true)}>View</CustomButton>
 * <FileViewer
 *   open={open}
 *   onClose={() => setOpen(false)}
 *   files={[{ url: '/a.pdf', name: 'Aadhaar' }, { url: '/b.jpg', name: 'Photo' }]}
 * />
 * ```
 * @module shared/core
 */
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Upload,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from '@/shared/utils/motion';

export interface IViewerFile {
  url: string;
  name?: string;
  mimeType?: string;
}

export interface IFileViewerProps {
  open: boolean;
  onClose: () => void;
  files?: IViewerFile[];
  initialIndex?: number;
  /** Title shown in the header (e.g. document type). Defaults to file name. */
  title?: string;
  actionLabel?: string;
  onAction?: (file: IViewerFile, index: number) => void;
  /** Allow controls that leave the ERP and open the source in a browser tab. */
  allowExternalOpen?: boolean;
  children?: React.ReactNode;
}

function inferKind(file: IViewerFile): 'image' | 'pdf' | 'other' {
  // Check mimeType first (most reliable for blob: URLs)
  const mime = (file.mimeType || '').toLowerCase();
  if (mime.includes('pdf')) return 'pdf';
  if (mime.startsWith('image/')) return 'image';
  if (mime) return 'other';

  // Cloudinary delivers PDFs through an `/image/upload/` path, so file
  // extension/name checks must take precedence over delivery-path segments.
  const ref = `${file.url || ''} ${file.name || ''}`.toLowerCase();
  if (/(\.pdf(?:\?|$|#|\s)|application\/pdf|\bpdf\b)/i.test(ref)) return 'pdf';
  if (/\.(png|jpe?g|webp|gif|bmp|svg|avif|heic|heif)(\?|$|#|\s)/i.test(ref)) return 'image';
  if (/\.(docx?|xlsx?|csv|pptx?|odt|ods)(\?|$|#|\s)/i.test(ref)) return 'other';

  // Check file name extension
  const name = (file.name || '').toLowerCase();
  if (name.includes('pdf')) return 'pdf';
  if (/\.(png|jpe?g|jpg|webp|gif|bmp|svg|avif|heic|heif)$/i.test(name)) return 'image';

  // Unknown uploaded documents default to PDF; ordinary image URLs have
  // already been identified above by MIME type or extension.
  if (file.url && !/\.(png|jpe?g|jpg|webp|gif|bmp|svg|avif|heic|heif)(\?|$|#)/i.test(ref)) {
    return 'pdf';
  }

  return 'other';
}

type FileFamily = 'pdf' | 'image' | 'word' | 'sheet' | 'slides' | 'file';

function inferFamily(file?: IViewerFile): FileFamily {
  if (!file) return 'file';
  const ref = `${file.mimeType || ''} ${file.name || ''} ${file.url || ''}`.toLowerCase();
  if (
    file.mimeType?.toLowerCase().startsWith('image/') ||
    /\.(png|jpe?g|webp|gif|svg)(?:\?|#|\s|$)/i.test(ref)
  )
    return 'image';
  if (ref.includes('pdf') || /\.pdf(?:\?|#|\s|$)/i.test(ref)) return 'pdf';
  if (ref.includes('spreadsheet') || /\.(xlsx?|csv|ods)(?:\?|#|\s|$)/i.test(ref)) return 'sheet';
  if (ref.includes('presentation') || /\.(pptx?|odp)(?:\?|#|\s|$)/i.test(ref)) return 'slides';
  if (
    ref.includes('wordprocessing') ||
    ref.includes('msword') ||
    /\.(docx?|odt)(?:\?|#|\s|$)/i.test(ref)
  )
    return 'word';
  return 'file';
}

function familyTone(family: FileFamily) {
  if (family === 'pdf') return 'border-rose-200 bg-rose-50 text-rose-600';
  if (family === 'image') return 'border-violet-200 bg-violet-50 text-violet-600';
  if (family === 'word') return 'border-blue-200 bg-blue-50 text-blue-600';
  if (family === 'sheet') return 'border-emerald-200 bg-emerald-50 text-emerald-600';
  if (family === 'slides') return 'border-amber-200 bg-amber-50 text-amber-600';
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

function FileFamilyGlyph({ file }: { file: IViewerFile }) {
  const family = inferFamily(file);
  if (family === 'image') {
    const isSvg = `${file.mimeType || ''} ${file.name || ''} ${file.url}`
      .toLowerCase()
      .includes('svg');
    if (isSvg) {
      return (
        <svg
          viewBox="0 0 24 24"
          className="h-7 w-7 text-fuchsia-600"
          role="img"
          aria-label="SVG vector file"
        >
          <path
            d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"
            fill="currentColor"
            opacity="0.14"
          />
          <path
            d="M14 3.5v4h4M10 11l-2 2 2 2M14 11l2 2-2 2M13 9.5l-2 7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    }
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-7 w-7 text-violet-600"
        role="img"
        aria-label="Image file"
      >
        <rect x="3" y="4" width="18" height="16" rx="3" fill="currentColor" opacity="0.14" />
        <circle cx="16.5" cy="8.5" r="2" fill="#f59e0b" />
        <path d="M5.5 17l4.2-5 3.1 3 2.1-2.1 3.6 4.1h-13Z" fill="currentColor" opacity="0.85" />
        <rect
          x="3"
          y="4"
          width="18"
          height="16"
          rx="3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
        />
      </svg>
    );
  }
  if (family === 'pdf') {
    return (
      <svg viewBox="0 0 24 24" className="h-7 w-7" role="img" aria-label="PDF file">
        <path
          d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"
          fill="currentColor"
          opacity="0.16"
        />
        <path
          d="M14 3.5v4h4M8.5 17c2-4.8 3.1-7.2 4-7 1 .2.3 5.1 2 5.4 1.1.2 2-2 3-1.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (family === 'word') {
    return (
      <svg viewBox="0 0 24 24" className="h-7 w-7" role="img" aria-label="Word document">
        <rect x="3" y="4" width="18" height="16" rx="3" fill="currentColor" opacity="0.14" />
        <path
          d="M6.5 8l2 8 2.5-6 2.5 6 2-8M17 9h2M17 12h2M17 15h2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (family === 'sheet') {
    return (
      <svg viewBox="0 0 24 24" className="h-7 w-7" role="img" aria-label="Spreadsheet file">
        <rect x="3" y="4" width="18" height="16" rx="3" fill="currentColor" opacity="0.14" />
        <path
          d="M7 8h10v8H7zM10.3 8v8M13.7 8v8M7 10.7h10M7 13.3h10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (family === 'slides') {
    return (
      <svg viewBox="0 0 24 24" className="h-7 w-7" role="img" aria-label="Presentation file">
        <rect x="3" y="4" width="18" height="14" rx="3" fill="currentColor" opacity="0.14" />
        <path
          d="M7 8h10v6H7zM12 18v3M9 21h6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" role="img" aria-label="Document file">
      <path
        d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"
        fill="currentColor"
        opacity="0.14"
      />
      <path
        d="M14 3.5v4h4M9 11h6M9 14h6M9 17h4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function shortName(file: IViewerFile): string {
  if (file.name) return file.name;
  try {
    const path = new URL(file.url, 'https://placeholder.local').pathname;
    const last = path.split('/').filter(Boolean).pop();
    return last ? decodeURIComponent(last) : file.url;
  } catch {
    return file.url;
  }
}

export default function FileViewer({
  open,
  onClose,
  files,
  initialIndex = 0,
  title,
  actionLabel,
  onAction,
  allowExternalOpen = true,
  children,
}: IFileViewerProps) {
  const safeFiles = useMemo(() => (files ?? []).filter((f) => !!f?.url), [files]);
  const [index, setIndex] = useState(initialIndex);
  // Reset index when the viewer is (re)opened — done during render rather than
  // in an effect to avoid a cascading render pass.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      const clamped = Math.min(Math.max(initialIndex, 0), Math.max(safeFiles.length - 1, 0));
      setIndex(clamped);
    }
  }

  const prev = useCallback(() => {
    if (!safeFiles.length) return;
    setIndex((i) => (i - 1 + safeFiles.length) % safeFiles.length);
  }, [safeFiles.length]);
  const next = useCallback(() => {
    if (!safeFiles.length) return;
    setIndex((i) => (i + 1) % safeFiles.length);
  }, [safeFiles.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, prev, next]);

  const current = safeFiles[index];
  const kind = current ? inferKind(current) : 'other';
  const family = inferFamily(current);

  if (!open) return null;
  if (!children && safeFiles.length === 0) return null;

  const headerTitle = title ?? (current ? shortName(current) : 'File Preview');
  const pdfFrameUrl = current?.url || '';

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="viewer"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-50 flex h-dvh flex-col bg-slate-100/95 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.15 }}
          className="relative flex flex-1 min-h-0 w-full flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden ${
                  family === 'image' ? 'rounded-md' : `rounded-lg border ${familyTone(family)}`
                }`}
              >
                {current && <FileFamilyGlyph file={current} />}
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-slate-800 sm:text-sm">
                  {headerTitle}
                </p>
                {safeFiles.length > 1 && (
                  <p className="text-[10px] text-slate-500">
                    File {index + 1} of {safeFiles.length}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onAction && actionLabel ? (
                <button
                  type="button"
                  onClick={() => onAction(current, index)}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-primary/90"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {actionLabel}
                </button>
              ) : null}
              {current?.url && (
                <>
                  {allowExternalOpen && (
                    <a
                      href={current.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-slate-200 p-1.5 text-slate-600 transition-colors hover:border-primary/20 hover:bg-primary-50 hover:text-primary"
                      aria-label="Open in new tab"
                      title="Open in new tab"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                  <a
                    href={current.url}
                    download
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-primary/20 hover:bg-primary-50 hover:text-primary"
                    aria-label="Download"
                    title="Download"
                  >
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Download</span>
                  </a>
                </>
              )}
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer rounded-lg border border-slate-200 p-1.5 text-slate-500 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                aria-label="Close viewer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>

          {/* Stage */}
          <div
            className={`relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden bg-slate-100 ${kind === 'pdf' && !children ? 'p-0' : 'p-3 sm:p-5'}`}
          >
            {safeFiles.length > 1 && (
              <aside
                className="absolute bottom-3 left-1/2 z-20 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 sm:bottom-auto sm:left-4 sm:top-1/2 sm:max-h-[calc(100%-2rem)] sm:max-w-none sm:-translate-x-0 sm:-translate-y-1/2 sm:flex-col sm:overflow-y-auto"
                aria-label="Related files"
              >
                <p className="hidden px-1 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400 sm:block">
                  Related
                </p>
                {safeFiles.map((file, fileIndex) => {
                  const fileFamily = inferFamily(file);
                  const active = fileIndex === index;
                  return (
                    <button
                      key={file.url + fileIndex}
                      type="button"
                      onClick={() => setIndex(fileIndex)}
                      className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 transition-colors ${active ? `border-primary ${familyTone(fileFamily)}` : `${familyTone(fileFamily)} hover:border-primary/30`}`}
                      aria-label={`Preview related file ${fileIndex + 1}: ${shortName(file)}`}
                    >
                      <FileFamilyGlyph file={file} />
                    </button>
                  );
                })}
              </aside>
            )}
            {safeFiles.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  prev();
                }}
                className="absolute left-20 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-slate-200 bg-white p-2.5 text-slate-700 transition-colors hover:border-primary/20 hover:bg-primary-50 hover:text-primary sm:block"
                aria-label="Previous file"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}

            <AnimatePresence mode="wait">
              <motion.div
                key={children ? 'custom_content' : (current?.url ?? '') + index}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="flex h-full w-full items-center justify-center min-h-0 overflow-hidden"
              >
                {children ? (
                  <div className="h-full w-full max-w-4xl overflow-y-auto rounded-xl p-2 sm:p-4">
                    {children}
                  </div>
                ) : kind === 'image' && current ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={current.url}
                    alt={headerTitle}
                    className="max-h-full max-w-full rounded-lg object-contain  select-none"
                  />
                ) : kind === 'pdf' && current ? (
                  <iframe
                    src={pdfFrameUrl}
                    title={headerTitle}
                    className="h-full w-full border-0 bg-white"
                    allow="fullscreen"
                  />
                ) : (
                  <div className="flex max-w-md flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white px-8 py-10 text-center text-slate-700">
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary">
                      <FileText className="h-7 w-7" />
                    </span>
                    <p className="text-sm font-bold">Preview is not available for this format</p>
                    <p className="text-xs leading-5 text-slate-500">
                      Download the file to open it with a compatible application on your device.
                    </p>
                    {current?.url && allowExternalOpen && (
                      <a
                        href={current.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary underline hover:text-primary/80"
                      >
                        Open file in browser <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {safeFiles.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  next();
                }}
                className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full border border-slate-200 bg-white p-2.5 text-slate-700 transition-colors hover:border-primary/20 hover:bg-primary-50 hover:text-primary"
                aria-label="Next file"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
