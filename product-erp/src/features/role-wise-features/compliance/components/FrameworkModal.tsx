/**
 * @file FrameworkModal.tsx
 * @description Guided editor for tenant-specific compliance framework configuration.
 * @module features/compliance
 */
'use client';

import CustomButton from '@/shared/core/CustomButton';
import useMutation from '@/shared/hooks/useMutation';
import { AnimatePresence, motion } from '@/shared/utils/motion';
import { Form, Formik } from 'formik';
import { Building2, FileText, Info, Settings2, X } from 'lucide-react';
import { toast } from 'react-toastify';
import * as Yup from 'yup';
import type { IComplianceFramework } from '../types/compliance.types';

interface IProps {
  open: boolean;
  framework?: IComplianceFramework | null;
  onClose: () => void;
  onSaved: () => void;
}

interface IFrameworkFormValues {
  name: string;
  shortName: string;
  slug: string;
  authority: string;
  country: string;
  region: string;
  version: string;
  description: string;
  institutionTypes: string;
  requirementTerm: string;
  submissionTerm: string;
  periodTerm: string;
  color: string;
  isActive: boolean;
}

interface IFieldProps {
  label: string;
  help: string;
  error?: string;
  required?: boolean;
  wide?: boolean;
  children: React.ReactNode;
}

const COLORS = ['blue', 'violet', 'emerald', 'amber', 'rose', 'cyan', 'indigo', 'slate'];
const controlClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-primary disabled:bg-slate-100 disabled:text-slate-500';

const validationSchema = Yup.object({
  name: Yup.string().trim().required('Enter the official framework name.'),
  shortName: Yup.string().trim().required('Enter a short name used across the workspace.'),
  country: Yup.string().trim().required('Enter the country where this standard applies.'),
  version: Yup.string().trim().required('Enter the adopted framework version.'),
});

function GuidedField({ label, help, error, required, wide, children }: IFieldProps) {
  return (
    <label className={`block space-y-1.5 ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="text-sm font-semibold text-slate-700">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      <span className="block text-xs leading-5 text-slate-500">{help}</span>
      {children}
      {error ? <span className="block text-xs font-medium text-red-600">{error}</span> : null}
    </label>
  );
}

export default function FrameworkModal({ open, framework, onClose, onSaved }: IProps) {
  const { mutation, isLoading } = useMutation();
  const initialValues: IFrameworkFormValues = {
    name: framework?.name ?? '',
    shortName: framework?.shortName ?? '',
    slug: framework?.slug ?? '',
    authority: framework?.authority ?? '',
    country: framework?.country ?? 'India',
    region: framework?.region ?? '',
    version: framework?.version ?? '1.0',
    description: framework?.description ?? '',
    institutionTypes: framework?.institutionTypes.join(', ') ?? '',
    requirementTerm: framework?.terminology.requirement ?? 'Requirement',
    submissionTerm: framework?.terminology.submission ?? 'Submission',
    periodTerm: framework?.terminology.reportingPeriod ?? 'Reporting period',
    color: framework?.color ?? 'blue',
    isActive: framework?.isActive ?? true,
  };

  /** Saves a validated framework while preserving system-framework identifiers. */
  const save = async (values: IFrameworkFormValues) => {
    const generatedSlug = (values.slug || values.shortName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const response = await mutation(
      framework
        ? `compliance-workspace/frameworks/${framework._id}`
        : 'compliance-workspace/frameworks',
      {
        method: framework ? 'PUT' : 'POST',
        body: {
          name: values.name.trim(),
          shortName: values.shortName.trim(),
          slug: generatedSlug,
          authority: values.authority.trim(),
          country: values.country.trim(),
          region: values.region.trim(),
          version: values.version.trim(),
          description: values.description.trim(),
          institutionTypes: values.institutionTypes
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
          terminology: {
            requirement: values.requirementTerm.trim() || 'Requirement',
            submission: values.submissionTerm.trim() || 'Submission',
            reportingPeriod: values.periodTerm.trim() || 'Reporting period',
          },
          color: values.color,
          icon: 'shield-check',
          isActive: values.isActive,
        },
      },
    );
    if (!response?.results?.success) {
      toast.error(`Unable to ${framework ? 'update' : 'create'} the framework`);
      return;
    }
    toast.success(framework ? 'Framework updated' : 'Framework created');
    onSaved();
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-200/80 p-3 backdrop-blur-sm sm:p-4">
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            className="flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white"
            role="dialog"
            aria-modal="true"
            aria-labelledby="framework-dialog-title"
          >
            <Formik
              initialValues={initialValues}
              validationSchema={validationSchema}
              enableReinitialize
              onSubmit={save}
            >
              {({ values, errors, touched, handleChange, setFieldValue }) => (
                <Form className="flex min-h-0 flex-1 flex-col">
                  <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6 sm:py-5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                        Guided framework setup
                      </p>
                      <h2
                        id="framework-dialog-title"
                        className="mt-1 text-xl font-bold text-slate-900"
                      >
                        {framework ? 'Configure framework' : 'Create a custom framework'}
                      </h2>
                      <p className="mt-1 max-w-2xl text-sm text-slate-500">
                        Record where the standard applies before tailoring its workspace language.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-lg bg-slate-100 p-2 text-slate-500 hover:text-slate-700"
                      aria-label="Close framework editor"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </header>

                  <div className="min-h-0 flex-1 space-y-6 overflow-y-auto bg-slate-50/50 px-5 py-5 sm:px-6">
                    <div className="flex gap-3 rounded-xl bg-primary-50 p-4">
                      <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          When to use this form
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">
                          Use a custom framework only when the required authority or internal
                          standard is not available in the catalog. Confirm applicability with your
                          institution&apos;s quality or regulatory team.
                        </p>
                      </div>
                    </div>

                    <section className="rounded-xl bg-white p-4 sm:p-5">
                      <SectionHeading
                        icon={<FileText className="h-5 w-5" />}
                        title="1. Identify the standard"
                        description="Use the official name and adopted version shown in the governing document."
                      />
                      <div className="grid gap-5 sm:grid-cols-2">
                        <GuidedField
                          label="Framework name"
                          help="Full official title used in reports and audit packages."
                          required
                          wide
                          error={touched.name ? errors.name : undefined}
                        >
                          <input
                            name="name"
                            value={values.name}
                            onChange={handleChange}
                            placeholder="University Grants Commission reporting"
                            className={controlClass}
                          />
                        </GuidedField>
                        <GuidedField
                          label="Short name"
                          help="A recognizable abbreviation, such as UGC."
                          required
                          error={touched.shortName ? errors.shortName : undefined}
                        >
                          <input
                            name="shortName"
                            value={values.shortName}
                            onChange={handleChange}
                            placeholder="UGC"
                            className={controlClass}
                          />
                        </GuidedField>
                        <GuidedField
                          label="Adopted version"
                          help="Version, cycle or publication year currently followed."
                          required
                          error={touched.version ? errors.version : undefined}
                        >
                          <input
                            name="version"
                            value={values.version}
                            onChange={handleChange}
                            placeholder="2024 or 1.0"
                            className={controlClass}
                          />
                        </GuidedField>
                        <GuidedField
                          label="Stable code"
                          help="Generated from the short name; system framework codes cannot change."
                          wide
                        >
                          <input
                            name="slug"
                            value={values.slug}
                            disabled={framework?.isSystem}
                            onChange={handleChange}
                            placeholder="ugc-reporting"
                            className={controlClass}
                          />
                        </GuidedField>
                        <GuidedField
                          label="Purpose"
                          help="Explain what this workspace will govern and report."
                          wide
                        >
                          <textarea
                            name="description"
                            value={values.description}
                            onChange={handleChange}
                            rows={3}
                            placeholder="Describe the reporting or accreditation purpose."
                            className={`${controlClass} resize-none`}
                          />
                        </GuidedField>
                      </div>
                    </section>

                    <section className="rounded-xl bg-white p-4 sm:p-5">
                      <SectionHeading
                        icon={<Building2 className="h-5 w-5" />}
                        title="2. Define applicability"
                        description="These details explain why the framework belongs to this institution."
                      />
                      <div className="grid gap-5 sm:grid-cols-2">
                        <GuidedField
                          label="Regulatory authority"
                          help="Organization that publishes, reviews or enforces the standard."
                          wide
                        >
                          <input
                            name="authority"
                            value={values.authority}
                            onChange={handleChange}
                            placeholder="Authority or internal governing body"
                            className={controlClass}
                          />
                        </GuidedField>
                        <GuidedField
                          label="Country"
                          help="Country whose rules or accreditation system applies."
                          required
                          error={touched.country ? errors.country : undefined}
                        >
                          <input
                            name="country"
                            value={values.country}
                            onChange={handleChange}
                            className={controlClass}
                          />
                        </GuidedField>
                        <GuidedField
                          label="State or region"
                          help="Leave blank when the framework applies nationally."
                        >
                          <input
                            name="region"
                            value={values.region}
                            onChange={handleChange}
                            placeholder="State, province or region"
                            className={controlClass}
                          />
                        </GuidedField>
                        <GuidedField
                          label="Applicable institution types"
                          help="Comma-separated scope, for example Autonomous college, University."
                          wide
                        >
                          <input
                            name="institutionTypes"
                            value={values.institutionTypes}
                            onChange={handleChange}
                            placeholder="University, Autonomous college"
                            className={controlClass}
                          />
                        </GuidedField>
                      </div>
                    </section>

                    <section className="rounded-xl bg-white p-4 sm:p-5">
                      <SectionHeading
                        icon={<Settings2 className="h-5 w-5" />}
                        title="3. Configure workspace language"
                        description="Match the authority terminology so staff recognize each workflow step."
                      />
                      <div className="grid gap-5 sm:grid-cols-3">
                        <GuidedField
                          label="Requirement label"
                          help="A criterion, control or requirement."
                        >
                          <input
                            name="requirementTerm"
                            value={values.requirementTerm}
                            onChange={handleChange}
                            className={controlClass}
                          />
                        </GuidedField>
                        <GuidedField
                          label="Submission label"
                          help="The evidence package staff submit."
                        >
                          <input
                            name="submissionTerm"
                            value={values.submissionTerm}
                            onChange={handleChange}
                            className={controlClass}
                          />
                        </GuidedField>
                        <GuidedField label="Period label" help="The cycle used for reporting.">
                          <input
                            name="periodTerm"
                            value={values.periodTerm}
                            onChange={handleChange}
                            className={controlClass}
                          />
                        </GuidedField>
                      </div>
                      <div className="mt-5">
                        <p className="text-sm font-semibold text-slate-700">Workspace identifier</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Colour distinguishes workspaces; it does not determine applicability.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {COLORS.map((item) => (
                            <button
                              key={item}
                              type="button"
                              onClick={() => setFieldValue('color', item)}
                              className={`rounded-lg px-3 py-2 text-xs font-semibold capitalize transition-colors ${values.color === item ? 'bg-primary-50 text-primary ring-1 ring-primary/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                              aria-pressed={values.color === item}
                            >
                              {item}
                            </button>
                          ))}
                        </div>
                      </div>
                      {framework ? (
                        <label className="mt-5 flex items-center justify-between gap-4 rounded-xl bg-slate-50 p-4">
                          <span>
                            <strong className="block text-sm font-semibold text-slate-800">
                              Active framework
                            </strong>
                            <small className="mt-1 block text-xs leading-5 text-slate-500">
                              Turning this off hides the workspace but preserves its history.
                            </small>
                          </span>
                          <input
                            name="isActive"
                            type="checkbox"
                            checked={values.isActive}
                            onChange={handleChange}
                            className="h-5 w-5 accent-primary"
                          />
                        </label>
                      ) : null}
                    </section>

                    {framework?.revisions?.length ? (
                      <p className="text-xs font-medium text-slate-500">
                        {framework.revisions.length} previous version
                        {framework.revisions.length === 1 ? '' : 's'} preserved in audit history.
                      </p>
                    ) : null}
                  </div>

                  <footer className="flex shrink-0 flex-col-reverse gap-3 border-t border-slate-100 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
                    <CustomButton variant="secondary" onClick={onClose}>
                      Cancel
                    </CustomButton>
                    <CustomButton type="submit" variant="primary" loading={isLoading}>
                      {framework ? 'Save changes' : 'Create framework'}
                    </CustomButton>
                  </footer>
                </Form>
              )}
            </Formik>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function SectionHeading({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span className="mt-0.5 text-primary">{icon}</span>
      <div>
        <h3 className="text-base font-semibold text-slate-800">{title}</h3>
        <p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p>
      </div>
    </div>
  );
}
