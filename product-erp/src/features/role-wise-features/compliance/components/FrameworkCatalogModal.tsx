'use client';

import CustomButton from '@/shared/core/CustomButton';
import Empty from '@/shared/core/Empty';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { AnimatePresence, motion } from '@/shared/utils/motion';
import { BadgeCheck, Building2, Landmark, ShieldCheck, X } from 'lucide-react';
import { toast } from 'react-toastify';

interface ICatalogItem {
  key: string;
  slug: string;
  name: string;
  shortName: string;
  authority: string;
  country: string;
  description: string;
  category: 'accreditation' | 'regulatory' | 'internal';
  isActivated: boolean;
}

interface IApiResponse<T> {
  success: boolean;
  data: T;
}

interface IProps {
  open: boolean;
  onClose: () => void;
  onActivated: () => void;
  onCreateCustom: () => void;
}

const CATEGORY_ICON = {
  accreditation: BadgeCheck,
  regulatory: Landmark,
  internal: Building2,
};

export default function FrameworkCatalogModal({
  open,
  onClose,
  onActivated,
  onCreateCustom,
}: IProps) {
  const { mutation, isLoading } = useMutation();
  const { data, isLoading: catalogLoading } = useSwr<IApiResponse<ICatalogItem[]>>(
    open ? 'compliance-workspace/catalog' : null,
  );
  const items = data?.data ?? [];

  const activate = async (item: ICatalogItem) => {
    const response = await mutation(`compliance-workspace/catalog/${item.key}/activate`, {
      method: 'POST',
    });
    if (!response?.results?.success) {
      toast.error('Unable to activate the framework');
      return;
    }
    toast.success(`${item.shortName} workspace activated`);
    onActivated();
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-200/80 p-4 backdrop-blur-sm">
          <motion.section
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            className="flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white"
            aria-label="Framework catalog"
          >
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6 sm:py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Guided framework setup
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  Choose a compliance framework
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-slate-500">
                  Start with an authority workspace, then confirm its version, scope and ownership
                  for your institution.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-slate-100 p-2 text-slate-500 hover:text-slate-700"
                aria-label="Close framework catalog"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              <div className="mb-5 grid gap-2 sm:grid-cols-3">
                {[
                  ['1', 'Choose', 'Select the authority or internal standard.'],
                  ['2', 'Activate', 'Create its governed workspace.'],
                  ['3', 'Configure', 'Confirm version, owners and requirements.'],
                ].map(([step, title, description]) => (
                  <div key={step} className="flex gap-3 rounded-xl bg-slate-50 p-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-bold text-primary">
                      {step}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{title}</p>
                      <p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p>
                    </div>
                  </div>
                ))}
              </div>

              {catalogLoading ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="h-40 animate-pulse rounded-2xl bg-slate-100" />
                  ))}
                </div>
              ) : items.length ? (
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {items.map((item) => {
                    const Icon = CATEGORY_ICON[item.category] ?? ShieldCheck;
                    return (
                      <article key={item.key} className="rounded-2xl bg-slate-50 p-4">
                        <div className="flex items-start gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-primary">
                            <Icon className="h-5 w-5" />
                          </span>
                          <div className="min-w-0">
                            <h3 className="font-semibold text-slate-800">{item.name}</h3>
                            <p className="mt-0.5 text-xs text-slate-500">{item.authority}</p>
                          </div>
                        </div>
                        <p className="mt-3 text-xs leading-5 text-slate-600">{item.description}</p>
                        <CustomButton
                          variant="primary"
                          size="small"
                          disabled={item.isActivated || isLoading}
                          onClick={() => activate(item)}
                          className="mt-4"
                        >
                          {item.isActivated ? 'Already active' : 'Activate workspace'}
                        </CustomButton>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <Empty
                  title="Framework catalog unavailable"
                  subTitle="Create a custom framework or retry after the catalog becomes available."
                />
              )}
            </div>

            <footer className="flex shrink-0 flex-col justify-between gap-3 border-t border-slate-100 bg-white px-5 py-4 sm:flex-row sm:items-center sm:px-6">
              <p className="text-xs text-slate-500">
                Templates are starting structures; always confirm the adopted version and scope.
              </p>
              <CustomButton variant="secondary" onClick={onCreateCustom}>
                Create custom framework
              </CustomButton>
            </footer>
          </motion.section>
        </div>
      )}
    </AnimatePresence>
  );
}
