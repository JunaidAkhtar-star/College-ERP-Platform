'use client';

import { AnimatePresence, motion } from '@/shared/utils/motion';
import { DatabaseZap, X } from 'lucide-react';
import ImportCenterPage from './ImportCenterPage';

export default function ImportMigrationDialog({
  open,
  target,
  title,
  onClose,
  onImported,
}: {
  open: boolean;
  target: string;
  title: string;
  onClose: () => void;
  onImported?: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-sm md:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => event.target === event.currentTarget && onClose()}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label={`Import ${title}`}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-slate-50 shadow-2xl"
          >
            <header className="flex items-center gap-3 border-b border-slate-100 bg-white px-5 py-4 md:px-7">
              <span className="rounded-xl bg-blue-50 p-2.5 text-primary">
                <DatabaseZap className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-black text-slate-900">Import {title}</h2>
                <p className="text-xs text-slate-500">
                  Upload, review validation, then migrate safely.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close import dialog"
                className="ml-auto rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="overflow-y-auto p-4 md:p-7">
              <ImportCenterPage initialTargetKey={target} embedded onImported={onImported} />
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
