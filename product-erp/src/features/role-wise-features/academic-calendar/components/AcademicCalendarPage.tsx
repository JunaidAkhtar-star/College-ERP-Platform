/**
 * @file AcademicCalendarPage.tsx
 * @description Academic calendar with month/week view, event management, semester info panels.
 * Create/edit calendar records, add/remove events, publish calendar.
 * @module features/role-wise-features/academic-calendar
 */
'use client';

import React, { useState, useMemo } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { Plus, Edit2, Trash2, Send, Tag, X } from 'lucide-react';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import CustomButton from '@/shared/core/CustomButton';
import AsyncSelect from '@/shared/core/AsyncSelect';
import Empty from '@/shared/core/Empty';
import CalendarView, { CalendarEvent } from '@/shared/core/CalendarView';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import { useAuthStore } from '@/shared/store/authStore';
import AcademicWorkflowBar from '@/shared/components/AcademicWorkflowBar';

type EventCategory =
  | 'holiday'
  | 'internal_exam'
  | 'university_exam'
  | 'cultural'
  | 'sports'
  | 'technical'
  | 'other';

interface ICalendarEvent {
  [key: string]: unknown;
  _id?: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  category: EventCategory;
  isRecurring?: boolean;
}

interface IAcademicCalendar {
  _id: string;
  academicYear: string;
  semesterType: 'odd' | 'even';
  semesterStartDate: string;
  semesterEndDate: string;
  internalExamStartDate?: string;
  internalExamEndDate?: string;
  universityExamStartDate?: string;
  universityExamEndDate?: string;
  vacationStartDate?: string;
  vacationEndDate?: string;
  totalWorkingDays: number;
  events: ICalendarEvent[];
  isPublished: boolean;
  publishedAt?: string;
  [key: string]: unknown;
}

const CATEGORY_CFG: Record<
  EventCategory,
  { label: string; color: string; bg: string; text: string }
> = {
  holiday: { label: 'Holiday', color: 'bg-red-400', bg: 'bg-red-50', text: 'text-red-600' },
  internal_exam: {
    label: 'Internal Exam',
    color: 'bg-orange-400',
    bg: 'bg-orange-50',
    text: 'text-orange-600',
  },
  university_exam: {
    label: 'University Exam',
    color: 'bg-purple-500',
    bg: 'bg-purple-50',
    text: 'text-purple-600',
  },
  cultural: { label: 'Cultural', color: 'bg-pink-400', bg: 'bg-pink-50', text: 'text-pink-600' },
  sports: { label: 'Sports', color: 'bg-cyan-400', bg: 'bg-cyan-50', text: 'text-cyan-600' },
  technical: { label: 'Technical', color: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-600' },
  other: { label: 'Other', color: 'bg-slate-400', bg: 'bg-slate-100', text: 'text-slate-600' },
};

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20';
const selectCls = inputCls;

const semesterSchema = Yup.object({
  academicYear: Yup.string().required('Required'),
  semesterType: Yup.string().required('Required'),
  semesterStartDate: Yup.string().required('Required'),
  semesterEndDate: Yup.string().required('Required'),
  totalWorkingDays: Yup.number().min(1).required('Required'),
});

const eventSchema = Yup.object({
  title: Yup.string().required('Required'),
  category: Yup.string().required('Required'),
  startDate: Yup.string().required('Required'),
  endDate: Yup.string().required('Required'),
});

function currentAY() {
  const y = new Date().getFullYear();
  return new Date().getMonth() >= 6
    ? `${y}-${(y + 1).toString().slice(-2)}`
    : `${y - 1}-${y.toString().slice(-2)}`;
}

export default function AcademicCalendarPage() {
  const activeRole = useAuthStore(
    (state) => state.activeRole?.baseRole ?? state.activeRole?.name ?? state.role ?? '',
  );
  const canManage = ['super_admin', 'admin', 'dean_academic'].includes(activeRole);
  const canPublish = ['super_admin', 'admin', 'principal'].includes(activeRole);
  const canViewDrafts = canManage || canPublish;
  const [selectedCalId, setSelectedCalId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [editingEvent, setEditingEvent] = useState<(ICalendarEvent & { idx: number }) | null>(null);
  const [addEventDate, setAddEventDate] = useState<Date | null>(null);

  const {
    data: raw,
    error,
    isLoading,
    mutate,
  } = useSwr(canViewDrafts ? 'academic-calendar' : 'academic-calendar/visible');
  const calendars: IAcademicCalendar[] = (raw as { data?: IAcademicCalendar[] })?.data ?? [];
  const selected = calendars.find((c) => c._id === selectedCalId) ?? calendars[0] ?? null;
  const canEditSelected = canManage && !!selected && !selected.isPublished;
  const { mutation, isLoading: saving } = useMutation();

  // ── Semester form ──────────────────────────────────────────────────────────
  const semForm = useFormik({
    initialValues: {
      academicYear: currentAY(),
      semesterType: 'odd' as 'odd' | 'even',
      semesterStartDate: '',
      semesterEndDate: '',
      internalExamStartDate: '',
      internalExamEndDate: '',
      universityExamStartDate: '',
      universityExamEndDate: '',
      vacationStartDate: '',
      vacationEndDate: '',
      totalWorkingDays: 90,
    },
    validationSchema: semesterSchema,
    onSubmit: async (values, { resetForm }) => {
      const body: Record<string, unknown> = { ...values };
      [
        'internalExamStartDate',
        'internalExamEndDate',
        'universityExamStartDate',
        'universityExamEndDate',
        'vacationStartDate',
        'vacationEndDate',
      ].forEach((k) => {
        if (!body[k]) delete body[k];
      });
      const res = await mutation('academic-calendar', { method: 'POST', body, isAlert: true });
      if ((res as { results?: { success?: boolean } })?.results?.success) {
        toast.success('Calendar created');
        resetForm();
        setShowCreateForm(false);
        mutate();
      } else {
        toast.error('Failed to create calendar');
      }
    },
  });

  // ── Event form ─────────────────────────────────────────────────────────────
  const evForm = useFormik<ICalendarEvent>({
    initialValues: {
      title: '',
      description: '',
      startDate: addEventDate ? addEventDate.toISOString().split('T')[0] : '',
      endDate: addEventDate ? addEventDate.toISOString().split('T')[0] : '',
      category: 'other' as EventCategory,
      isRecurring: false,
    },
    enableReinitialize: true,
    validationSchema: eventSchema,
    onSubmit: async (values, { resetForm }) => {
      if (!selected) return;
      const endpoint = editingEvent
        ? `academic-calendar/${selected._id}`
        : `academic-calendar/${selected._id}/events`;
      const method = editingEvent ? 'PUT' : 'POST';
      let body: Record<string, unknown> = values;
      if (editingEvent) {
        // update full calendar events array
        const updatedEvents = [...selected.events];
        updatedEvents[editingEvent.idx] = values;
        body = { events: updatedEvents };
      }
      const res = await mutation(endpoint, { method, body, isAlert: true });
      if ((res as { results?: { success?: boolean } })?.results?.success) {
        toast.success(editingEvent ? 'Event updated' : 'Event added');
        resetForm();
        setShowAddEvent(false);
        setEditingEvent(null);
        mutate();
      } else {
        toast.error('Failed');
      }
    },
  });

  const handleRemoveEvent = async (calId: string, eventId: string) => {
    const r = await Swal.fire({
      title: 'Remove event?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Remove',
      confirmButtonColor: '#0178D7',
    });
    if (!r.isConfirmed) return;
    const res = await mutation(`academic-calendar/${calId}/events/${eventId}`, {
      method: 'DELETE',
      isAlert: true,
    });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Removed');
      mutate();
    } else toast.error('Failed');
  };

  const handlePublish = async (calId: string) => {
    const cal = calendars.find((c) => c._id === calId);
    const r = await Swal.fire({
      title: 'Publish Calendar?',
      text: `Publish ${cal?.academicYear} ${cal?.semesterType} semester calendar to all users?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Publish',
      confirmButtonColor: '#0178D7',
    });
    if (!r.isConfirmed) return;
    const res = await mutation(`academic-calendar/${calId}/publish`, {
      method: 'PUT',
      isAlert: true,
    });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Calendar published');
      mutate();
    } else toast.error('Failed to publish');
  };

  // Convert events to CalendarEvent format
  const calEvents: CalendarEvent[] = useMemo(() => {
    if (!selected) return [];
    const evs: CalendarEvent[] = selected.events.map((e, i) => ({
      id: e._id ?? String(i),
      title: e.title,
      date: new Date(e.startDate),
      endDate: e.endDate ? new Date(e.endDate) : undefined,
      category: e.category,
      color: CATEGORY_CFG[e.category]?.color ?? 'bg-slate-400',
      badge: CATEGORY_CFG[e.category]?.label.slice(0, 3),
      payload: e as unknown as Record<string, unknown>,
    }));
    // Add semester start/end
    if (selected.semesterStartDate)
      evs.push({
        id: 'sem-start',
        title: 'Semester Start',
        date: new Date(selected.semesterStartDate),
        category: 'other',
        color: 'bg-green-500',
      });
    if (selected.semesterEndDate)
      evs.push({
        id: 'sem-end',
        title: 'Semester End',
        date: new Date(selected.semesterEndDate),
        category: 'other',
        color: 'bg-slate-500',
      });
    if (selected.internalExamStartDate)
      evs.push({
        id: 'int-start',
        title: 'Internals Start',
        date: new Date(selected.internalExamStartDate),
        endDate: selected.internalExamEndDate ? new Date(selected.internalExamEndDate) : undefined,
        category: 'internal_exam',
        color: 'bg-orange-400',
      });
    if (selected.universityExamStartDate)
      evs.push({
        id: 'univ-start',
        title: 'University Exam',
        date: new Date(selected.universityExamStartDate),
        endDate: selected.universityExamEndDate
          ? new Date(selected.universityExamEndDate)
          : undefined,
        category: 'university_exam',
        color: 'bg-purple-500',
      });
    if (selected.vacationStartDate)
      evs.push({
        id: 'vacation',
        title: 'Vacation',
        date: new Date(selected.vacationStartDate),
        endDate: selected.vacationEndDate ? new Date(selected.vacationEndDate) : undefined,
        category: 'holiday',
        color: 'bg-red-300',
      });
    return evs;
  }, [selected]);

  return (
    <div className="space-y-5">
      <AcademicWorkflowBar />
      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          {error.message || 'Unable to load the academic calendar.'}
          <button type="button" onClick={() => mutate()} className="ml-2 font-semibold underline">
            Retry
          </button>
        </div>
      )}
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Academic Calendar</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage semester events, exams, holidays and key dates
          </p>
        </div>
        <div className="flex gap-2">
          {canPublish && selected && !selected.isPublished && (
            <CustomButton
              variant="secondary"
              startIcon={<Send className="h-4 w-4" />}
              onClick={() => handlePublish(selected._id)}
              loading={saving}
              className="w-fit!"
            >
              Publish
            </CustomButton>
          )}
          {canManage && (
            <CustomButton
              variant="primary"
              startIcon={<Plus className="h-4 w-4" />}
              onClick={() => setShowCreateForm((v) => !v)}
              className="w-fit!"
            >
              New Calendar
            </CustomButton>
          )}
        </div>
      </motion.div>

      {/* Semester selector */}
      {calendars.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {calendars.map((c) => (
            <button
              key={c._id}
              type="button"
              onClick={() => setSelectedCalId(c._id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${selected?._id === c._id ? 'bg-primary text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
            >
              {c.academicYear} · {c.semesterType === 'odd' ? 'Odd' : 'Even'}{' '}
              {c.isPublished ? '✓' : '(Draft)'}
            </button>
          ))}
        </div>
      )}

      {/* Calendar view */}
      {isLoading ? (
        <div className="h-96 animate-pulse rounded-2xl bg-white" />
      ) : !selected ? (
        <div className="rounded-2xl bg-white">
          <Empty
            title="No academic calendar yet"
            subTitle={
              canManage
                ? 'Create the semester calendar to begin planning teaching days, examinations, holidays, and events.'
                : 'The academic calendar will appear here after an authorised user creates it.'
            }
            pathName={canManage ? 'Create Calendar' : undefined}
            onClick={canManage ? () => setShowCreateForm(true) : undefined}
          />
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden">
          <CalendarView
            events={calEvents}
            onAddClick={
              canEditSelected
                ? (date) => {
                    setAddEventDate(date);
                    evForm.setValues({
                      title: '',
                      description: '',
                      startDate: date.toISOString().split('T')[0],
                      endDate: date.toISOString().split('T')[0],
                      category: 'other',
                      isRecurring: false,
                    });
                    setEditingEvent(null);
                    setShowAddEvent(true);
                  }
                : undefined
            }
            renderEventPopover={(event, close) => {
              const ev = event.payload as ICalendarEvent;
              const cfg = CATEGORY_CFG[ev?.category as EventCategory];
              return (
                <div>
                  <p className="font-semibold text-slate-800">{event.title}</p>
                  {cfg && (
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium mt-1 ${cfg.bg} ${cfg.text}`}
                    >
                      {cfg.label}
                    </span>
                  )}
                  {ev?.description && (
                    <p className="mt-2 text-xs text-slate-500">{ev.description}</p>
                  )}
                  <p className="mt-2 text-xs text-slate-600">
                    {new Date(ev?.startDate ?? event.date).toLocaleDateString('en-IN')}
                    {ev?.endDate &&
                      ev.endDate !== ev.startDate &&
                      ` → ${new Date(ev.endDate).toLocaleDateString('en-IN')}`}
                  </p>
                  {canEditSelected && ev?._id && (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const idx = selected.events.findIndex((e) => e._id === ev._id);
                          setEditingEvent({ ...ev, idx });
                          evForm.setValues({
                            ...ev,
                            description: ev.description ?? '',
                            isRecurring: ev.isRecurring ?? false,
                          });
                          setShowAddEvent(true);
                          close();
                        }}
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Edit2 className="h-3 w-3" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleRemoveEvent(selected._id, ev._id!);
                          close();
                        }}
                        className="flex items-center gap-1 text-xs text-red-500 hover:underline"
                      >
                        <Trash2 className="h-3 w-3" />
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              );
            }}
          />
        </div>
      )}

      {/* Add/Edit event modal */}
      <AnimatePresence>
        {canEditSelected && showAddEvent && selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
              onClick={() => {
                setShowAddEvent(false);
                setEditingEvent(null);
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.2 }}
              className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 "
            >
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary">
                  <Tag className="h-4.5 w-4.5" />
                </div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {editingEvent ? 'Edit Event' : 'Add Event'}
                </h2>
              </div>
              <form onSubmit={evForm.handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Title *</label>
                  <input
                    name="title"
                    value={evForm.values.title}
                    onChange={evForm.handleChange}
                    onBlur={evForm.handleBlur}
                    className={inputCls}
                  />
                  {evForm.touched.title && evForm.errors.title && (
                    <p className="mt-1 text-xs text-red-500">{evForm.errors.title}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Category *
                  </label>
                  <select
                    name="category"
                    value={evForm.values.category}
                    onChange={evForm.handleChange}
                    className={selectCls}
                  >
                    {Object.entries(CATEGORY_CFG).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Start Date *
                    </label>
                    <input
                      type="date"
                      name="startDate"
                      value={evForm.values.startDate}
                      onChange={evForm.handleChange}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      End Date *
                    </label>
                    <input
                      type="date"
                      name="endDate"
                      value={evForm.values.endDate}
                      min={evForm.values.startDate}
                      onChange={evForm.handleChange}
                      className={inputCls}
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={evForm.values.description ?? ''}
                    onChange={evForm.handleChange}
                    rows={2}
                    className={inputCls + ' resize-none'}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="recur"
                    checked={evForm.values.isRecurring ?? false}
                    onChange={(e) => evForm.setFieldValue('isRecurring', e.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  <label htmlFor="recur" className="text-xs font-medium text-slate-600">
                    Recurring event
                  </label>
                </div>
                <div className="flex justify-end gap-3 pt-1">
                  <CustomButton
                    variant="tertiary"
                    type="button"
                    onClick={() => {
                      setShowAddEvent(false);
                      setEditingEvent(null);
                    }}
                  >
                    Cancel
                  </CustomButton>
                  <CustomButton variant="primary" type="submit" loading={saving}>
                    {editingEvent ? 'Update' : 'Add Event'}
                  </CustomButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Legend */}
      {selected && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white px-4 py-3">
          <span className="text-xs font-semibold text-slate-500">Legend:</span>
          {Object.entries(CATEGORY_CFG).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${v.color}`} />
              <span className="text-xs text-slate-500">{v.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
            <span className="text-xs text-slate-500">Sem Start</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-500" />
            <span className="text-xs text-slate-500">Sem End</span>
          </div>
        </div>
      )}

      {/* Events list */}
      {selected && selected.events.length > 0 && (
        <div className="rounded-2xl bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">
              All Events ({selected.events.length})
            </h3>
            {canEditSelected && (
              <CustomButton
                variant="secondary"
                startIcon={<Plus className="h-4 w-4" />}
                onClick={() => {
                  setEditingEvent(null);
                  evForm.resetForm();
                  setShowAddEvent(true);
                }}
                className="w-fit!"
              >
                Add Event
              </CustomButton>
            )}
          </div>
          <div className="space-y-2">
            {[...selected.events]
              .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
              .map((ev, i) => {
                const cfg = CATEGORY_CFG[ev.category as EventCategory] ?? CATEGORY_CFG.other;
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`h-2 w-2 rounded-full ${cfg.color}`} />
                      <div>
                        <p className="text-sm font-medium text-slate-800">{ev.title}</p>
                        <p className="text-xs text-slate-600">
                          {new Date(ev.startDate).toLocaleDateString('en-IN')}
                          {ev.endDate !== ev.startDate &&
                            ` → ${new Date(ev.endDate).toLocaleDateString('en-IN')}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text}`}
                      >
                        {cfg.label}
                      </span>
                      {canEditSelected && (
                        <button
                          type="button"
                          onClick={() => {
                            const idx = i;
                            setEditingEvent({ ...ev, idx });
                            evForm.setValues({
                              ...ev,
                              description: ev.description ?? '',
                              isRecurring: ev.isRecurring ?? false,
                            });
                            setShowAddEvent(true);
                          }}
                          className="p-1 text-slate-600 hover:text-primary"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canEditSelected && ev._id && (
                        <button
                          type="button"
                          onClick={() => handleRemoveEvent(selected._id, ev._id!)}
                          className="p-1 text-slate-600 hover:text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
      {/* Create form dialog modal */}
      <AnimatePresence>
        {canManage && showCreateForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
              onClick={() => setShowCreateForm(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="relative z-10 flex w-full max-w-5xl flex-col rounded-2xl border border-slate-100 bg-white  overflow-hidden"
            >
              {/* Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Plus className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-800">Create Semester Calendar</h2>
                    <p className="text-xs text-slate-600">
                      Define the academic year, semester, and key dates.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Form Content */}
              <form
                onSubmit={semForm.handleSubmit}
                className="flex flex-col flex-1 overflow-hidden"
              >
                <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
                  {/* Left Column: Form Fields */}
                  <div className="flex-1 space-y-4 p-6 overflow-y-auto max-h-[60vh]">
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          Academic Year *
                        </label>
                        <AsyncSelect
                          type="academicYears"
                          value={semForm.values.academicYear || null}
                          onChange={(value) => semForm.setFieldValue('academicYear', value ?? '')}
                          placeholder="Select configured academic year"
                        />
                        {semForm.touched.academicYear && semForm.errors.academicYear && (
                          <p className="mt-1 text-xs text-red-500">{semForm.errors.academicYear}</p>
                        )}
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          Semester *
                        </label>
                        <select
                          name="semesterType"
                          value={semForm.values.semesterType}
                          onChange={semForm.handleChange}
                          className={selectCls}
                        >
                          <option value="odd">Odd (Jul–Dec)</option>
                          <option value="even">Even (Jan–Jun)</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          Working Days *
                        </label>
                        <input
                          type="number"
                          name="totalWorkingDays"
                          value={semForm.values.totalWorkingDays}
                          onChange={semForm.handleChange}
                          min={1}
                          className={inputCls}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          Semester Start *
                        </label>
                        <input
                          type="date"
                          name="semesterStartDate"
                          value={semForm.values.semesterStartDate}
                          onChange={semForm.handleChange}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          Semester End *
                        </label>
                        <input
                          type="date"
                          name="semesterEndDate"
                          value={semForm.values.semesterEndDate}
                          onChange={semForm.handleChange}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          Internal Exam Start
                        </label>
                        <input
                          type="date"
                          name="internalExamStartDate"
                          value={semForm.values.internalExamStartDate}
                          onChange={semForm.handleChange}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          Internal Exam End
                        </label>
                        <input
                          type="date"
                          name="internalExamEndDate"
                          value={semForm.values.internalExamEndDate}
                          onChange={semForm.handleChange}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          University Exam Start
                        </label>
                        <input
                          type="date"
                          name="universityExamStartDate"
                          value={semForm.values.universityExamStartDate}
                          onChange={semForm.handleChange}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          University Exam End
                        </label>
                        <input
                          type="date"
                          name="universityExamEndDate"
                          value={semForm.values.universityExamEndDate}
                          onChange={semForm.handleChange}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          Vacation Start
                        </label>
                        <input
                          type="date"
                          name="vacationStartDate"
                          value={semForm.values.vacationStartDate}
                          onChange={semForm.handleChange}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          Vacation End
                        </label>
                        <input
                          type="date"
                          name="vacationEndDate"
                          value={semForm.values.vacationEndDate}
                          onChange={semForm.handleChange}
                          className={inputCls}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Guidance Sidebar */}
                  <div className="w-full lg:w-96 bg-slate-50 p-6 border-t lg:border-t-0 lg:border-l border-slate-100 overflow-y-auto max-h-[60vh] flex flex-col gap-4 text-xs font-normal">
                    <h3 className="font-bold text-slate-800 text-sm">Calendar Guidelines</h3>
                    <div className="space-y-3 text-slate-600 leading-relaxed">
                      <div>
                        <p className="font-bold text-slate-700">Academic Year</p>
                        <p className="mt-0.5">
                          Use YYYY-YY format (e.g. 2026-27). This links the calendar to the active
                          batch registration year.
                        </p>
                      </div>
                      <div>
                        <p className="font-bold text-slate-700">Semester Type</p>
                        <p className="mt-0.5">
                          Odd semesters typically run from July to December. Even semesters run from
                          January to June.
                        </p>
                      </div>
                      <div>
                        <p className="font-bold text-slate-700">Working Days</p>
                        <p className="mt-0.5">
                          The total count of active classroom teaching days. Generally ranges
                          between 90–110 days per term.
                        </p>
                      </div>
                      <div>
                        <p className="font-bold text-slate-700">Date Overlaps</p>
                        <p className="mt-0.5">
                          Ensure internal/university exams and vacations fall within the overall
                          Semester Start and End date range.
                        </p>
                      </div>
                    </div>
                    <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-blue-800">
                      <strong>Draft Status:</strong> Newly created calendars are drafts. They will
                      not be visible to students or faculty until you click <strong>Publish</strong>
                      .
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-6 py-4">
                  <CustomButton
                    variant="tertiary"
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                  >
                    Cancel
                  </CustomButton>
                  <CustomButton variant="primary" type="submit" loading={saving}>
                    Create Calendar
                  </CustomButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
