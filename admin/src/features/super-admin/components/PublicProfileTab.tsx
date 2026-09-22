/** @file PublicProfileTab.tsx @description Manages company, contact and social values shown on the public website. @module features/super-admin/components */
'use client';
import { Form, Formik } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import CustomButton from '@/shared/core/CustomButton';
import useMutation from '@/shared/hooks/useMutation';
import { IPublicSiteConfig } from '../types/super-admin.types';

interface IProps {
  profile?: IPublicSiteConfig;
  refresh: () => Promise<unknown>;
}

const fieldClass =
  'mt-1.5 w-full rounded-lg bg-slate-100 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 hover:bg-slate-200/80 focus:bg-white focus:ring-2 focus:ring-primary/30';
const labelClass = 'text-xs font-semibold uppercase tracking-wide text-slate-600';
const errorClass = 'mt-1.5 block text-xs font-medium text-rose-600';

const RequiredMark = () => <span className="text-rose-600"> *</span>;

const empty: IPublicSiteConfig = {
  companyName: '',
  headline: '',
  description: '',
  supportEmail: '',
  salesEmail: '',
  phone: '',
  address: '',
  socialLinks: { linkedin: '', facebook: '', instagram: '', youtube: '', x: '' },
};
const schema = Yup.object({
  companyName: Yup.string().required(),
  headline: Yup.string().max(160).required(),
  description: Yup.string().max(1000).required(),
  supportEmail: Yup.string().email().required(),
  salesEmail: Yup.string().email().required(),
  phone: Yup.string().required(),
  address: Yup.string().required(),
  socialLinks: Yup.object({
    linkedin: Yup.string().url().nullable(),
    facebook: Yup.string().url().nullable(),
    instagram: Yup.string().url().nullable(),
    youtube: Yup.string().url().nullable(),
    x: Yup.string().url().nullable(),
  }),
});
export default function PublicProfileTab({ profile, refresh }: IProps) {
  const { mutation, isLoading } = useMutation();
  const save = async (values: IPublicSiteConfig) => {
    const response = await mutation('super-admin/public-profile', { method: 'PUT', body: values });
    if (response?.results?.success) {
      toast.success('Public website profile published.');
      await refresh();
    }
  };
  return (
    <Formik<IPublicSiteConfig>
      enableReinitialize
      initialValues={profile ?? empty}
      validationSchema={schema}
      onSubmit={save}
    >
      {({ values, handleChange, handleBlur, errors, touched }) => (
        <Form className="admin-surface p-5 sm:p-6 lg:p-7" noValidate>
          <h2 className="text-lg font-semibold text-slate-800">Public company profile</h2>
          <p className="mt-1 text-sm text-slate-500">
            Published contact, brand message and social links used across the public website.
          </p>
          <section className="mt-6">
            <h3 className="text-sm font-semibold text-slate-800">Brand information</h3>
            <div className="mt-3 grid gap-4 lg:grid-cols-12">
              <label className="lg:col-span-4" htmlFor="company-name">
                <span className={labelClass}>
                  Company name
                  <RequiredMark />
                </span>
                <input
                  id="company-name"
                  name="companyName"
                  value={values.companyName}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Enter your registered company name"
                  className={fieldClass}
                />
                {touched.companyName && errors.companyName && (
                  <span className={errorClass}>{errors.companyName}</span>
                )}
              </label>
              <label className="lg:col-span-8" htmlFor="company-headline">
                <span className={labelClass}>
                  Website headline
                  <RequiredMark />
                </span>
                <input
                  id="company-headline"
                  name="headline"
                  value={values.headline}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Describe the platform value in one clear sentence"
                  className={fieldClass}
                />
                {touched.headline && errors.headline && (
                  <span className={errorClass}>{errors.headline}</span>
                )}
              </label>
              <label className="lg:col-span-12" htmlFor="company-description">
                <span className={labelClass}>
                  Company description
                  <RequiredMark />
                </span>
                <textarea
                  id="company-description"
                  name="description"
                  rows={4}
                  value={values.description}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Explain what Devvelocity provides, who it serves, and the business value it delivers"
                  className={`${fieldClass} resize-y`}
                />
                {touched.description && errors.description && (
                  <span className={errorClass}>{errors.description}</span>
                )}
              </label>
            </div>
          </section>

          <section className="mt-7">
            <h3 className="text-sm font-semibold text-slate-800">Contact information</h3>
            <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <label htmlFor="support-email">
                <span className={labelClass}>
                  Support email
                  <RequiredMark />
                </span>
                <input
                  id="support-email"
                  type="email"
                  name="supportEmail"
                  autoComplete="email"
                  value={values.supportEmail}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="support@devvelocity.in"
                  className={fieldClass}
                />
                {touched.supportEmail && errors.supportEmail && (
                  <span className={errorClass}>{errors.supportEmail}</span>
                )}
              </label>
              <label htmlFor="sales-email">
                <span className={labelClass}>
                  Sales email
                  <RequiredMark />
                </span>
                <input
                  id="sales-email"
                  type="email"
                  name="salesEmail"
                  value={values.salesEmail}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="sales@devvelocity.in"
                  className={fieldClass}
                />
                {touched.salesEmail && errors.salesEmail && (
                  <span className={errorClass}>{errors.salesEmail}</span>
                )}
              </label>
              <label htmlFor="company-phone" className="md:col-span-2 xl:col-span-1">
                <span className={labelClass}>
                  Phone number
                  <RequiredMark />
                </span>
                <input
                  id="company-phone"
                  type="tel"
                  name="phone"
                  autoComplete="tel"
                  value={values.phone}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="+91 98765 43210"
                  className={fieldClass}
                />
                {touched.phone && errors.phone && (
                  <span className={errorClass}>{errors.phone}</span>
                )}
              </label>
              <label className="md:col-span-2 xl:col-span-3" htmlFor="company-address">
                <span className={labelClass}>
                  Business address
                  <RequiredMark />
                </span>
                <textarea
                  id="company-address"
                  name="address"
                  rows={2}
                  autoComplete="street-address"
                  value={values.address}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Enter the complete registered business address"
                  className={`${fieldClass} resize-y`}
                />
                {touched.address && errors.address && (
                  <span className={errorClass}>{errors.address}</span>
                )}
              </label>
            </div>
          </section>

          <section className="mt-7">
            <h3 className="text-sm font-semibold text-slate-800">Social channels</h3>
            <p className="mt-1 text-xs text-slate-500">
              Optional links displayed in the public website footer.
            </p>
            <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {(['linkedin', 'facebook', 'instagram', 'youtube', 'x'] as const).map((field) => (
                <label key={field} htmlFor={`social-${field}`}>
                  <span className={labelClass}>{field === 'x' ? 'X (Twitter)' : field}</span>
                  <input
                    id={`social-${field}`}
                    type="url"
                    name={`socialLinks.${field}`}
                    value={values.socialLinks[field] ?? ''}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder={`https://${field === 'x' ? 'x.com' : `${field}.com`}/devvelocity`}
                    className={fieldClass}
                  />
                </label>
              ))}
            </div>
          </section>
          <div className="mt-6 flex justify-end">
            <CustomButton type="submit" variant="primary" size="medium" loading={isLoading}>
              Publish profile
            </CustomButton>
          </div>
        </Form>
      )}
    </Formik>
  );
}
