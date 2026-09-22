/**
 * @file ProductCatalogTab.tsx
 * @description Creates and lists Devvelocity ERP modules and their route registry.
 * @module features/super-admin/components
 */
'use client';
import { Form, Formik } from 'formik';
import * as Yup from 'yup';
import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { Column } from '@/shared/core/CustomTable';
import useMutation from '@/shared/hooks/useMutation';
import { IProductModule } from '../types/super-admin.types';
import { useEffect, useState } from 'react';
import { motion } from '@/shared/utils/motion';
import { Plus, X, Table, LayoutGrid } from 'lucide-react';
import Drawer from '@mui/material/Drawer';

interface IProps {
  modules: IProductModule[];
  isLoading: boolean;
  refresh: () => Promise<unknown>;
  isValidating?: boolean;
}
interface IValues {
  name: string;
  slug: string;
  description: string;
  icon: string;
  frontendRoute: string;
  apiRoute: string;
  features: string;
  tier: 'core' | 'standard' | 'premium' | 'ultimate';
}
const schema = Yup.object({
  name: Yup.string().required(),
  slug: Yup.string()
    .matches(/^[a-z0-9-]+$/)
    .required(),
  description: Yup.string().required(),
  icon: Yup.string().required(),
  frontendRoute: Yup.string().required(),
  apiRoute: Yup.string().required(),
});

export default function ProductCatalogTab({ modules, isLoading, refresh, isValidating }: IProps) {
  const [view, setView] = useState<'table' | 'grid'>('grid');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { mutation, isLoading: saving } = useMutation();
  useEffect(() => {
    if (!drawerOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [drawerOpen]);
  const create = async (values: IValues, reset: () => void) => {
    const response = await mutation('super-admin/product-modules', {
      method: 'POST',
      body: {
        ...values,
        features: values.features
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        status: 'active',
        isPublic: true,
      },
    });
    if (response?.results?.success) {
      toast.success('Product module registered.');
      reset();
      setDrawerOpen(false);
      await refresh();
    }
  };
  const remove = async (module: IProductModule) => {
    const result = await Swal.fire({
      title: `Delete ${module.name}?`,
      text: 'Plans referencing this slug must be reviewed.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete module',
      confirmButtonColor: '#0178D7',
    });
    if (!result.isConfirmed) return;
    const response = await mutation(`super-admin/product-modules/${module._id}`, {
      method: 'DELETE',
    });
    if (response?.results?.success) {
      toast.success('Module deleted.');
      await refresh();
    }
  };
  const columns: Column<IProductModule>[] = [
    { field: 'name', title: 'Module', sortable: true },
    { field: 'frontendRoute', title: 'Frontend route' },
    { field: 'apiRoute', title: 'API route' },
    { field: 'status', title: 'Status' },
    {
      field: 'tier',
      title: 'Tier',
      render: (row) => <span className="capitalize">{row.tier}</span>,
    },
    {
      field: 'features',
      title: 'Available features',
      minWidth: '320px',
      render: (row) => (
        <div className="flex max-w-xl flex-wrap gap-1.5 py-1">
          {row.features.length ? (
            <>
              {row.features.slice(0, 5).map((feature) => (
                <span
                  key={feature}
                  className="rounded-lg bg-primary-50 px-2 py-1 text-[10px] font-medium text-primary-900"
                >
                  {feature}
                </span>
              ))}
              {row.features.length > 5 && (
                <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                  +{row.features.length - 5} more
                </span>
              )}
            </>
          ) : (
            <span className="text-xs text-slate-400">No features registered</span>
          )}
        </div>
      ),
    },
  ];
  const catalogue = modules;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">ERP product suite</h2>
          <p className="mt-1 text-sm text-slate-600">
            Browse every module, feature and route available in Devvelocity ERP.
          </p>
        </div>
        <div className="flex flex-wrap items-center  gap-5">
          <div className="flex justify-end">
            <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100/80 p-1 border border-slate-200/60 shadow-xs">
              <div className="relative group flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => setView('table')}
                  aria-label="Table view"
                  className={`relative cursor-pointer inline-flex items-center justify-center rounded-lg p-2 text-xs font-medium transition-colors duration-200 ${
                    view === 'table'
                      ? 'text-primary-600 font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {view === 'table' && (
                    <motion.div
                      layoutId="catalogViewActivePill"
                      className="absolute inset-0 rounded-lg bg-white shadow-xs border border-slate-200/50"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <Table className="relative z-10 h-4 w-4" />
                </button>
                <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 z-30 shadow-md">
                  Table view
                </span>
              </div>
              <div className="relative group flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => setView('grid')}
                  aria-label="Grid view"
                  className={`relative cursor-pointer inline-flex items-center justify-center rounded-lg p-2 text-xs font-medium transition-colors duration-200 ${
                    view === 'grid'
                      ? 'text-primary-600 font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {view === 'grid' && (
                    <motion.div
                      layoutId="catalogViewActivePill"
                      className="absolute inset-0 rounded-lg bg-white shadow-xs border border-slate-200/50"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <LayoutGrid className="relative z-10 h-4 w-4" />
                </button>
                <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 z-30 shadow-md">
                  Grid view
                </span>
              </div>
            </div>
          </div>
          <div className="w-fit">
            <CustomButton
              variant="primary"
              size="medium"
              className="text-nowrap"
              onClick={() => setDrawerOpen(true)}
              startIcon={<Plus className="h-4 w-4" />}
            >
              Add feature / module
            </CustomButton>
          </div>
        </div>
      </div>

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        slotProps={{
          paper: {
            className: 'w-full max-w-xl bg-white',
          },
          backdrop: {
            className: 'bg-slate-950/35 backdrop-blur-[2px]',
          },
        }}
      >
        <div className="h-dvh w-full overflow-hidden bg-white">
          <Formik<IValues>
            initialValues={{
              name: '',
              slug: '',
              description: '',
              icon: 'Boxes',
              frontendRoute: '',
              apiRoute: '',
              features: '',
              tier: 'core',
            }}
            validationSchema={schema}
            onSubmit={(values, helpers) => create(values, helpers.resetForm)}
          >
            {({ values, handleChange, errors, touched }) => (
              <Form className="flex h-dvh min-h-0 flex-col">
                <header className="flex flex-none flex-wrap items-start justify-between gap-4 bg-white px-5 py-5 sm:px-7">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-800">Add feature module</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Maintain the public feature catalogue and frontend/backend route map.
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Close module form"
                    onClick={() => setDrawerOpen(false)}
                    className="rounded-xl bg-slate-100 p-2.5 text-slate-600 hover:bg-slate-200"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/60 px-5 py-6 sm:px-7">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label>
                      <span className="text-xs font-semibold text-slate-600">Catalogue tier</span>
                      <select
                        name="tier"
                        value={values.tier}
                        onChange={handleChange}
                        className="mt-1.5 w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm outline-none ring-primary focus:ring-2"
                      >
                        <option value="core">Core</option>
                        <option value="standard">Standard</option>
                        <option value="premium">Premium</option>
                        <option value="ultimate">Ultimate</option>
                      </select>
                    </label>
                    {(
                      [
                        'name',
                        'slug',
                        'icon',
                        'frontendRoute',
                        'apiRoute',
                        'description',
                        'features',
                      ] as const
                    ).map((field) => (
                      <label
                        key={field}
                        className={
                          field === 'description' || field === 'features' ? 'sm:col-span-2' : ''
                        }
                      >
                        <span className="text-xs font-semibold capitalize text-slate-600">
                          {field.replaceAll(/([A-Z])/g, ' $1')}
                        </span>
                        <input
                          name={field}
                          value={values[field]}
                          onChange={handleChange}
                          placeholder={
                            field === 'features' ? 'Admissions, workflow, reporting' : undefined
                          }
                          className="mt-1.5 w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm outline-none ring-primary focus:ring-2"
                        />
                        {touched[field] && errors[field] && (
                          <span className="text-xs text-rose-600">{errors[field]}</span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
                <footer className="flex flex-none justify-end gap-2 bg-white px-5 py-4 sm:px-7">
                  <CustomButton
                    type="button"
                    variant="tertiary"
                    size="medium"
                    onClick={() => setDrawerOpen(false)}
                  >
                    Cancel
                  </CustomButton>
                  <CustomButton type="submit" variant="primary" size="medium" loading={saving}>
                    Register module
                  </CustomButton>
                </footer>
              </Form>
            )}
          </Formik>
        </div>
      </Drawer>

      {!isLoading && !catalogue.length ? (
        <div className="admin-surface p-10 text-center">
          <h3 className="text-lg font-semibold text-slate-800">No product modules registered</h3>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">
            Use Add Feature / Module to create the first backend-managed catalogue record.
          </p>
        </div>
      ) : view === 'table' ? (
        <CustomTable
          data={catalogue as unknown as Record<string, unknown>[]}
          columns={columns as unknown as Column<Record<string, unknown>>[]}
          isLoading={isLoading}
          onRefresh={refresh}
          isValidating={isValidating}
          actions={[
            {
              icon: <span className="text-xs font-semibold text-rose-600">Delete</span>,
              tooltip: 'Delete module',
              onClick: (row) => remove(row as unknown as IProductModule),
            },
          ]}
          options={{ pagination: true, search: true, sorting: true, refresh: true }}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {catalogue.map((module) => (
            <article key={module._id} className="admin-surface p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900">{module.name}</h3>
                  <p className="mt-1 font-mono text-[11px] text-slate-500">
                    {module.frontendRoute}
                  </p>
                </div>
                <span className="rounded-full bg-primary-50 px-2.5 py-1 text-[10px] font-bold uppercase text-primary">
                  {module.tier} · {module.status}
                </span>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-slate-500">{module.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {module.features.map((feature) => (
                  <span
                    key={feature}
                    className="rounded-xl bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600"
                  >
                    {feature}
                  </span>
                ))}
              </div>
              <p className="mt-4 font-mono text-[11px] text-slate-400">{module.apiRoute}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
