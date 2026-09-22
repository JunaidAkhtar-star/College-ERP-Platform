'use client';

import AsyncSelect from '@/shared/core/AsyncSelect';
import CustomButton from '@/shared/core/CustomButton';
import useMutation from '@/shared/hooks/useMutation';
import { AnimatePresence, motion } from '@/shared/utils/motion';
import { Field, Form, Formik } from 'formik';
import { CalendarClock, CheckCircle2, MapPin, Users, X } from 'lucide-react';
import { toast } from 'react-toastify';
import * as Yup from 'yup';
import { IEvent, TEventAudience } from '../types/Event.types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editing?: IEvent | null;
}

const schema = Yup.object({
  title: Yup.string().trim().min(3, 'Use at least 3 characters').required('Title is required'),
  description: Yup.string().trim().required('Description is required'),
  eventType: Yup.string().required('Choose an event type'),
  venue: Yup.string().trim().required('Venue is required'),
  startDate: Yup.string().required('Start date and time are required'),
  endDate: Yup.string()
    .required('End date and time are required')
    .test('after-start', 'End must be after the start', function (value) {
      return Boolean(value && this.parent.startDate && value > this.parent.startDate);
    }),
  targetAudience: Yup.array().min(1, 'Choose at least one audience'),
  maxRegistrations: Yup.number().min(1, 'Must be at least 1').nullable(),
});

const inputClass =
  'min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15';
const labelClass = 'mb-1.5 block text-xs font-semibold text-slate-600';
const audiences: TEventAudience[] = ['all', 'student', 'faculty'];

function localDateTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function EventModal({ open, onClose, onSuccess, editing }: Props) {
  const { mutation, isLoading } = useMutation();
  const department =
    typeof editing?.organizingDepartment === 'string'
      ? editing.organizingDepartment
      : editing?.organizingDepartment?._id;
  const coordinatorIds =
    editing?.coordinators?.map((person) => (typeof person === 'string' ? person : person._id)) ??
    [];

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.button
            type="button"
            aria-label="Close event form"
            className="absolute inset-0 bg-slate-200/80"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="relative z-10 max-h-[94dvh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white"
            initial={{ scale: 0.97, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.97, opacity: 0 }}
          >
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editing ? 'Edit draft event' : 'Plan an event'}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Save a draft first. An authorised reviewer publishes it separately.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <Formik
              enableReinitialize
              initialValues={{
                title: editing?.title ?? '',
                description: editing?.description ?? '',
                eventType: editing?.eventType ?? 'workshop',
                venue: editing?.venue ?? '',
                startDate: localDateTime(editing?.startDate),
                endDate: localDateTime(editing?.endDate),
                organizingDepartment: department ?? '',
                coordinators: coordinatorIds,
                targetAudience: editing?.targetAudience ?? (['all'] as TEventAudience[]),
                maxRegistrations: editing?.maxRegistrations?.toString() ?? '',
              }}
              validationSchema={schema}
              onSubmit={async (values) => {
                const response = await mutation(editing ? `event/${editing._id}` : 'event', {
                  method: editing ? 'PUT' : 'POST',
                  body: {
                    ...values,
                    organizingDepartment: values.organizingDepartment || undefined,
                    maxRegistrations: values.maxRegistrations
                      ? Number(values.maxRegistrations)
                      : undefined,
                  },
                });
                if (!response?.results?.success) return;
                toast.success(editing ? 'Draft event updated' : 'Draft event created');
                onSuccess();
              }}
            >
              {({ values, errors, touched, setFieldValue }) => (
                <Form className="grid gap-5 p-5 sm:p-6">
                  <div className="grid gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-4 sm:grid-cols-3">
                    {[
                      { icon: CalendarClock, title: 'Plan', text: 'Add schedule and venue' },
                      {
                        icon: CheckCircle2,
                        title: 'Review',
                        text: 'A different approver publishes',
                      },
                      { icon: Users, title: 'Engage', text: 'Register and track attendance' },
                    ].map((step) => (
                      <div key={step.title} className="flex items-center gap-3">
                        <step.icon className="h-5 w-5 shrink-0 text-primary" />
                        <div>
                          <p className="text-xs font-bold text-slate-800">{step.title}</p>
                          <p className="text-[11px] text-slate-500">{step.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className={labelClass}>Event title *</label>
                    <Field name="title" className={inputClass} placeholder="What is happening?" />
                    {touched.title && errors.title && (
                      <p className="mt-1 text-xs text-red-600">{errors.title}</p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>Description *</label>
                    <Field
                      as="textarea"
                      rows={4}
                      name="description"
                      className={inputClass}
                      placeholder="Purpose, agenda and what attendees should expect"
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      Include the agenda, expected outcome and any preparation attendees need.
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={labelClass}>Event type *</label>
                      <Field as="select" name="eventType" className={inputClass}>
                        {[
                          'workshop',
                          'seminar',
                          'cultural',
                          'sports',
                          'technical',
                          'placement',
                          'other',
                        ].map((value) => (
                          <option key={value} value={value}>
                            {value[0].toUpperCase() + value.slice(1)}
                          </option>
                        ))}
                      </Field>
                    </div>
                    <div>
                      <label className={`${labelClass} flex items-center gap-1`}>
                        <MapPin className="h-3.5 w-3.5" /> Venue *
                      </label>
                      <Field
                        name="venue"
                        className={inputClass}
                        placeholder="Room, hall or venue"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Starts *</label>
                      <Field type="datetime-local" name="startDate" className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Ends *</label>
                      <Field type="datetime-local" name="endDate" className={inputClass} />
                      {touched.endDate && errors.endDate && (
                        <p className="mt-1 text-xs text-red-600">{errors.endDate}</p>
                      )}
                    </div>
                    <AsyncSelect
                      label="Organising department"
                      type="departments"
                      value={values.organizingDepartment || null}
                      onChange={(value) => setFieldValue('organizingDepartment', value ?? '')}
                      placeholder="Choose department"
                    />
                    <AsyncSelect
                      label="Coordinators"
                      type="users"
                      multiple
                      value={values.coordinators}
                      onChange={(value) => setFieldValue('coordinators', value)}
                      placeholder="Search people"
                    />
                    <div>
                      <label className={labelClass}>Registration capacity</label>
                      <Field
                        type="number"
                        min="1"
                        name="maxRegistrations"
                        className={inputClass}
                        placeholder="Unlimited"
                      />
                      <p className="mt-1 text-[11px] text-slate-500">
                        Leave blank when there is no registration limit.
                      </p>
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Who may attend? *</label>
                    <div className="flex flex-wrap gap-2">
                      {audiences.map((value) => {
                        const selected = values.targetAudience.includes(value);
                        return (
                          <button
                            type="button"
                            key={value}
                            onClick={() =>
                              setFieldValue(
                                'targetAudience',
                                value === 'all'
                                  ? ['all']
                                  : [
                                      ...values.targetAudience.filter(
                                        (item) => item !== 'all' && item !== value,
                                      ),
                                      ...(selected ? [] : [value]),
                                    ],
                              )
                            }
                            className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                              selected ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {value === 'all'
                              ? 'Everyone'
                              : value === 'student'
                                ? 'Students'
                                : 'Faculty'}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="sticky bottom-0 -mx-5 -mb-5 flex justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:-mx-6 sm:-mb-6 sm:px-6">
                    <CustomButton type="button" variant="cancel" onClick={onClose}>
                      Cancel
                    </CustomButton>
                    <CustomButton type="submit" loading={isLoading}>
                      {editing ? 'Update draft' : 'Save draft'}
                    </CustomButton>
                  </div>
                </Form>
              )}
            </Formik>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
