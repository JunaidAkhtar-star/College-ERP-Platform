/**
 * @file ContactConversation.tsx
 * @description Contact details, consultation image and lead enquiry form.
 * @module features/landing/components/contact
 */

'use client';

import { CheckCircle2, Mail, MapPin, Phone, Send } from 'lucide-react';
import { useFormik, type FormikHelpers } from 'formik';
import { toast } from 'react-toastify';
import * as Yup from 'yup';
import useMutation from '@/shared/hooks/useMutation';
import type { IPublicSiteConfig } from '@/features/landing/types/public.types';
import { AnimatePresence, motion } from '@/shared/utils/motion';
import { useState } from 'react';

interface IContactConversationProps {
  site?: IPublicSiteConfig | null;
}

interface IContactValues {
  name: string;
  email: string;
  phone: string;
  organization: string;
  role: string;
  enquiry: string;
}

const initialValues: IContactValues = {
  name: '',
  email: '',
  phone: '',
  organization: '',
  role: '',
  enquiry: 'Product enquiry',
};

const enquiryOptions = [
  'Product enquiry',
  'College ERP',
  'Software engineering services',
  'Partnership',
  'Support',
] as const;

const contactSchema = Yup.object({
  name: Yup.string()
    .trim()
    .min(2, 'Enter at least 2 characters')
    .max(80, 'Name must be under 80 characters')
    .required('Full name is required'),
  email: Yup.string()
    .trim()
    .email('Enter a valid email address')
    .max(160, 'Email must be under 160 characters')
    .required('Work email is required'),
  phone: Yup.string()
    .trim()
    .matches(/^\+?[\d\s()-]{8,20}$/, 'Enter a valid phone number')
    .required('Phone number is required'),
  organization: Yup.string()
    .trim()
    .min(2, 'Enter at least 2 characters')
    .max(160, 'Organisation must be under 160 characters')
    .required('Organisation is required'),
  role: Yup.string().trim().max(100, 'Role must be under 100 characters'),
  enquiry: Yup.string()
    .oneOf([...enquiryOptions], 'Choose a valid enquiry type')
    .required('Enquiry type is required'),
});

const inputClass =
  'mt-2 w-full rounded-xl bg-[#f3f7fa] px-4 py-3.5 text-sm text-slate-800 outline-none ring-1 ring-inset ring-slate-200 transition placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-primary/30';

export default function ContactConversation({ site }: IContactConversationProps) {
  const { mutation, isLoading } = useMutation();
  const [submitted, setSubmitted] = useState(false);

  const submitEnquiry = async (
    values: IContactValues,
    { resetForm }: FormikHelpers<IContactValues>,
  ) => {
    const response = await mutation('super-admin/leads', {
      method: 'POST',
      body: {
        name: values.name,
        email: values.email,
        phone: values.phone,
        collegeName: values.organization,
        designation: values.role || values.enquiry,
        studentCount: 0,
      },
    });
    if (response?.results?.success) {
      resetForm();
      setSubmitted(true);
      toast.success('Your enquiry has been sent.');
    }
  };

  const formik = useFormik<IContactValues>({
    initialValues,
    validationSchema: contactSchema,
    validateOnBlur: true,
    validateOnChange: true,
    onSubmit: submitEnquiry,
  });

  return (
    <section id="contact-form" className="bg-white px-5 py-20 md:px-10 lg:px-16 lg:py-28">
      <div className="mx-auto grid max-w-[1440px] gap-12 lg:grid-cols-[.85fr_1.15fr]">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
            Direct contact
          </p>
          <h2 className="mt-4 text-3xl font-bold tracking-[-0.05em] text-[#123f61] sm:text-5xl">
            Reach the right conversation.
          </h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
            Whether you represent an institution, a growing business or a product team, share the
            context you have. You do not need a finished specification.
          </p>

          <div className="mt-9 space-y-6">
            {[
              {
                icon: Mail,
                label: 'Email',
                value: site?.salesEmail || 'Contact details are being updated',
                href: site?.salesEmail ? `mailto:${site.salesEmail}` : undefined,
              },
              {
                icon: Phone,
                label: 'Phone',
                value: site?.phone || 'Contact details are being updated',
                href: site?.phone ? `tel:${site.phone}` : undefined,
              },
              {
                icon: MapPin,
                label: 'Location',
                value: site?.address || 'Address details are being updated',
              },
            ].map(({ icon: Icon, label, value, href }) => (
              <div key={label} className="flex items-start gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary">
                  <Icon size={19} />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                    {label}
                  </p>
                  {href ? (
                    <a href={href} className="mt-1 block text-sm font-bold text-[#123f61]">
                      {value}
                    </a>
                  ) : (
                    <p className="mt-1 text-sm font-bold leading-6 text-[#123f61]">{value}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 bg-[#123f61] px-6 py-7 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-secondary-300">
              What happens next
            </p>
            <p className="mt-3 max-w-md text-sm leading-7 text-white/65">
              We review your context, connect you with the right person and respond with a useful
              next step within one business day.
            </p>
          </div>
        </div>

        <div className="self-start rounded-[2rem] bg-[#f3f8fb] p-6 sm:p-9 lg:p-10">
          <AnimatePresence mode="wait">
            {submitted ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid min-h-[540px] place-items-center text-center"
              >
                <div>
                  <span className="mx-auto grid size-16 place-items-center rounded-full bg-secondary-100 text-secondary-700">
                    <CheckCircle2 size={30} />
                  </span>
                  <h3 className="mt-6 text-2xl font-bold text-[#123f61]">
                    Your enquiry is with our team.
                  </h3>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-500">
                    We will review the context and contact you within one business day with a useful
                    next step.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSubmitted(false)}
                    className="mt-7 rounded-full bg-white px-5 py-3 text-sm font-bold text-primary"
                  >
                    Send another enquiry
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h2 className="text-2xl font-bold text-[#123f61]">How can we help?</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  A few details are enough to begin. Required fields are marked.
                </p>
                <form onSubmit={formik.handleSubmit} noValidate className="mt-8 space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    {[
                      ['name', 'Full name *', 'Your name', 'text'],
                      ['email', 'Work email *', 'you@organisation.com', 'email'],
                      ['phone', 'Phone number *', '+91 98765 43210', 'tel'],
                      ['organization', 'Organisation *', 'Organisation name', 'text'],
                    ].map(([name, label, placeholder, type]) => {
                      const field = name as keyof IContactValues;
                      const hasError = Boolean(formik.touched[field] && formik.errors[field]);
                      return (
                        <label key={name} className="text-xs font-bold text-slate-600">
                          {label}
                          <input
                            name={name}
                            type={type}
                            value={formik.values[field]}
                            onChange={formik.handleChange}
                            onBlur={formik.handleBlur}
                            placeholder={placeholder}
                            aria-invalid={hasError}
                            aria-describedby={hasError ? `${name}-error` : undefined}
                            className={`${inputClass} ${
                              hasError
                                ? 'ring-rose-300 focus:ring-rose-300'
                                : 'ring-slate-200 focus:ring-primary/30'
                            }`}
                          />
                          {hasError && (
                            <span
                              id={`${name}-error`}
                              role="alert"
                              className="mt-1.5 block text-[11px] font-medium text-rose-600"
                            >
                              {formik.errors[field]}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className="text-xs font-bold text-slate-600">
                      Your role
                      <input
                        name="role"
                        value={formik.values.role}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        placeholder="Founder, Principal, Product lead"
                        aria-invalid={Boolean(formik.touched.role && formik.errors.role)}
                        className={`${inputClass} ${
                          formik.touched.role && formik.errors.role
                            ? 'ring-rose-300 focus:ring-rose-300'
                            : ''
                        }`}
                      />
                      {formik.touched.role && formik.errors.role && (
                        <span role="alert" className="mt-1.5 block text-[11px] text-rose-600">
                          {formik.errors.role}
                        </span>
                      )}
                    </label>
                    <label className="text-xs font-bold text-slate-600">
                      What would you like to discuss?
                      <select
                        name="enquiry"
                        value={formik.values.enquiry}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        className={inputClass}
                      >
                        {enquiryOptions.map((option) => (
                          <option key={option}>{option}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading || formik.isSubmitting}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 text-sm font-bold text-white transition hover:bg-primary-600 disabled:cursor-wait disabled:opacity-60"
                  >
                    {isLoading || formik.isSubmitting ? 'Sending enquiry…' : 'Send enquiry'}
                    {!isLoading && !formik.isSubmitting && <Send size={16} />}
                  </button>
                  <p className="text-center text-[11px] leading-5 text-slate-400">
                    By submitting, you agree that our team may contact you about this enquiry.
                  </p>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
