/**
 * @file FileViewer.tsx
 * @description Shared full-screen Admin viewer for images, PDFs and downloadable files.
 * Use this component for every in-app Admin file preview.
 */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, ExternalLink, FileText, X } from 'lucide-react';
import { AnimatePresence, motion } from '@/shared/utils/motion';

export interface IViewerFile {
  url: string;
  name?: string;
  mimeType?: string;
}

interface IFileViewerProps {
  open: boolean;
  onClose: () => void;
  files: IViewerFile[];
  initialIndex?: number;
  title?: string;
}

function fileKind(file: IViewerFile): 'image' | 'pdf' | 'other' {
  const mime = (file.mimeType || '').toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  const reference = `${file.url} ${file.name || ''}`.toLowerCase();
  if (/\/image\/upload\//i.test(reference)) return 'image';
  if (/\/raw\/upload\//i.test(reference)) return 'pdf';
  if (/\.(png|jpe?g|webp|gif|bmp|svg)(\?|#|$)/i.test(reference)) return 'image';
  if (/\.pdf(\?|#|$)/i.test(reference)) return 'pdf';
  return 'other';
}

function fileName(file: IViewerFile): string {
  if (file.name) return file.name;
  try {
    const name = new URL(file.url, 'https://placeholder.local').pathname
      .split('/')
      .filter(Boolean)
      .pop();
    return name ? decodeURIComponent(name) : 'Document';
  } catch {
    return 'Document';
  }
}

export default function FileViewer({
  open,
  onClose,
  files,
  initialIndex = 0,
  title,
}: IFileViewerProps) {
  const availableFiles = useMemo(() => files.filter((file) => Boolean(file?.url)), [files]);
  const [index, setIndex] = useState(initialIndex);
  const [previousOpen, setPreviousOpen] = useState(open);
  if (open !== previousOpen) {
    setPreviousOpen(open);
    if (open) setIndex(Math.min(Math.max(initialIndex, 0), Math.max(availableFiles.length - 1, 0)));
  }

  const previous = useCallback(
    () => setIndex((current) => (current - 1 + availableFiles.length) % availableFiles.length),
    [availableFiles.length],
  );
  const next = useCallback(
    () => setIndex((current) => (current + 1) % availableFiles.length),
    [availableFiles.length],
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowLeft' && availableFiles.length > 1) previous();
      else if (event.key === 'ArrowRight' && availableFiles.length > 1) next();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [availableFiles.length, next, onClose, open, previous]);

  if (!open || availableFiles.length === 0) return null;
  const current = availableFiles[index];
  const kind = fileKind(current);
  const heading = title || fileName(current);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        role="dialog"
        aria-modal="true"
        aria-label={heading}
        className="fixed inset-0 z-[1400] flex h-dvh flex-col bg-slate-950/96 backdrop-blur-md"
        onClick={onClose}
      >
        <header
          className="flex min-h-16 items-center justify-between gap-4 border-b border-white/10 px-4 text-white sm:px-6"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{heading}</p>
            <p className="mt-0.5 truncate text-[11px] text-slate-400">
              {availableFiles.length > 1 ? `${index + 1} of ${availableFiles.length} · ` : ''}
              {fileName(current)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <a
              href={current.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open in new tab"
              title="Open in new tab"
              className="rounded-xl p-2.5 text-slate-200 transition hover:bg-white/10 hover:text-white"
            >
              <ExternalLink className="size-4" />
            </a>
            <a
              href={current.url}
              download
              aria-label="Download file"
              title="Download"
              className="rounded-xl p-2.5 text-slate-200 transition hover:bg-white/10 hover:text-white"
            >
              <Download className="size-4" />
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close file viewer"
              className="rounded-xl p-2.5 text-slate-200 transition hover:bg-white/10 hover:text-white"
            >
              <X className="size-5" />
            </button>
          </div>
        </header>

        <div
          className={`relative flex min-h-0 flex-1 items-center justify-center ${
            kind === 'pdf' ? 'p-0' : 'p-3 sm:p-5'
          }`}
        >
          {availableFiles.length > 1 && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                previous();
              }}
              aria-label="Previous file"
              className="absolute left-4 z-10 rounded-xl bg-slate-900/70 p-2.5 text-white backdrop-blur transition hover:bg-slate-800"
            >
              <ChevronLeft className="size-5" />
            </button>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={`${current.url}-${index}`}
              initial={{ opacity: 0, scale: 0.985 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.985 }}
              transition={{ duration: 0.16 }}
              className="flex h-full w-full items-center justify-center"
              onClick={(event) => event.stopPropagation()}
            >
              {kind === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={current.url}
                  alt={heading}
                  className="max-h-full max-w-full rounded-2xl bg-white object-contain shadow-2xl"
                />
              ) : kind === 'pdf' ? (
                <iframe
                  src={current.url}
                  title={heading}
                  referrerPolicy="no-referrer"
                  className="h-full w-full border-0 bg-white"
                />
              ) : (
                <div className="rounded-3xl border border-white/10 bg-white/5 px-8 py-10 text-center text-slate-200">
                  <FileText className="mx-auto size-10" />
                  <p className="mt-4 text-sm font-semibold">
                    Preview is unavailable for this format.
                  </p>
                  <a
                    href={current.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-900"
                  >
                    Open file
                  </a>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {availableFiles.length > 1 && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                next();
              }}
              aria-label="Next file"
              className="absolute right-4 z-10 rounded-xl bg-slate-900/70 p-2.5 text-white backdrop-blur transition hover:bg-slate-800"
            >
              <ChevronRight className="size-5" />
            </button>
          )}
        </div>

        {availableFiles.length > 1 && (
          <footer
            className="flex justify-center gap-2 overflow-x-auto px-4 pb-4"
            onClick={(event) => event.stopPropagation()}
          >
            {availableFiles.map((file, fileIndex) => (
              <button
                key={`${file.url}-${fileIndex}`}
                type="button"
                onClick={() => setIndex(fileIndex)}
                aria-label={`View file ${fileIndex + 1}`}
                className={`flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/10 ring-2 transition ${
                  fileIndex === index ? 'ring-primary' : 'ring-transparent hover:ring-white/30'
                }`}
              >
                {fileKind(file) === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={file.url} alt="" className="size-full object-cover" />
                ) : (
                  <FileText className="size-5 text-white" />
                )}
              </button>
            ))}
          </footer>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
