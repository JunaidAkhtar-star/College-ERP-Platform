/**
 * @file LibraryPage.tsx
 * @description Library management — role-aware:
 *   All: Search books (GET library/books)
 *   Student: My issued books (GET library/issues/my), renew (PUT library/issues/:id/renew)
 *   Library Staff/Admin: Add book, issue, return, digital content
 * @module features/role-wise-features/library
 */
'use client';

import React, { useMemo, useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import {
  Plus,
  BookMarked,
  RefreshCw,
  RotateCcw,
  BookOpen,
  Monitor,
  Edit2,
  AlertTriangle,
  BookCopy,
  LibraryBig,
  Users,
} from 'lucide-react';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { Column, Action } from '@/shared/core/CustomTable';
import DataViewSwitcher from '@/shared/core/DataViewSwitcher';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import { useAuthStore } from '@/shared/store/authStore';
import AsyncSelect from '@/shared/core/AsyncSelect';
import Empty from '@/shared/core/Empty';

interface IBook {
  _id: string;
  title: string;
  authors?: string[];
  isbn?: string;
  publisher?: string;
  publicationYear?: number;
  edition?: string;
  category?: string;
  availableCopies?: number;
  totalCopies?: number;
  [key: string]: unknown;
}

interface IIssue {
  _id: string;
  bookId?: string | { _id: string; title?: string; isbn?: string; authors?: string[] };
  bookTitle?: string;
  isbn?: string;
  memberId?: string | { _id: string; name?: string; email?: string };
  memberType?: 'student' | 'faculty';
  studentName?: string;
  rollNo?: string;
  issueDate: string;
  dueDate: string;
  returnDate?: string;
  status: 'issued' | 'returned' | 'overdue' | 'renewed' | 'lost';
  fineAmount?: number;
  finePaid?: number;
  [key: string]: unknown;
}

interface IDigitalResource {
  _id: string;
  title: string;
  isbn: string;
  authors: string[];
  publisher: string;
  publicationYear: number;
  category: string;
  digitalUrl: string;
  subject?: string;
  [key: string]: unknown;
}

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm placeholder-slate-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20';
const labelCls = 'mb-1 block text-xs font-medium text-slate-600';

const ISSUE_STATUS_CFG = {
  issued: { label: 'Issued', bg: 'bg-blue-50', text: 'text-blue-600' },
  returned: { label: 'Returned', bg: 'bg-green-50', text: 'text-green-600' },
  overdue: { label: 'Overdue', bg: 'bg-red-50', text: 'text-red-500' },
  renewed: { label: 'Renewed', bg: 'bg-amber-50', text: 'text-amber-600' },
  lost: { label: 'Lost', bg: 'bg-rose-50', text: 'text-rose-700' },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Add Book Modal (staff) ───────────────────────────────────────────────────
function AddBookModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { mutation, isLoading } = useMutation();
  const formik = useFormik({
    initialValues: {
      title: '',
      authorsRaw: '',
      isbn: '',
      publisher: '',
      publicationYear: new Date().getFullYear(),
      edition: '',
      category: '',
      subject: '',
      language: 'English',
      shelfLocation: '',
      totalCopies: 1,
    },
    validationSchema: Yup.object({
      title: Yup.string().trim().required('Title required'),
      authorsRaw: Yup.string().trim().required('At least one author is required'),
      isbn: Yup.string().trim().required('ISBN required'),
      publisher: Yup.string().trim().required('Publisher required'),
      publicationYear: Yup.number()
        .min(1000)
        .max(new Date().getFullYear() + 1)
        .required(),
      category: Yup.string().trim().required('Category required'),
      totalCopies: Yup.number().min(1).required(),
    }),
    onSubmit: async (values) => {
      const authors = values.authorsRaw
        .split(',')
        .map((author) => author.trim())
        .filter(Boolean);
      const res = await mutation('library/books', {
        method: 'POST',
        body: {
          title: values.title,
          authors,
          isbn: values.isbn,
          publisher: values.publisher,
          publicationYear: values.publicationYear,
          edition: values.edition,
          category: values.category,
          subject: values.subject,
          language: values.language,
          shelfLocation: values.shelfLocation,
          totalCopies: values.totalCopies,
        },
        isAlert: true,
      });
      if ((res as { results?: { success?: boolean } })?.results?.success) {
        toast.success('Book added');
        onSaved();
      } else toast.error('Failed');
    },
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="relative z-10 w-full max-w-md rounded-2xl bg-white  p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold">Add Book</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-600 hover:text-slate-600 text-xl"
          >
            ✕
          </button>
        </div>
        <form onSubmit={formik.handleSubmit} className="space-y-3">
          <div>
            <label className={labelCls}>Title *</label>
            <input
              name="title"
              value={formik.values.title}
              onChange={formik.handleChange}
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Authors *</label>
              <input
                name="authorsRaw"
                value={formik.values.authorsRaw}
                onChange={formik.handleChange}
                placeholder="Separate multiple authors with commas"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>ISBN *</label>
              <input
                name="isbn"
                value={formik.values.isbn}
                onChange={formik.handleChange}
                className={inputCls}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Publisher *</label>
              <input
                name="publisher"
                value={formik.values.publisher}
                onChange={formik.handleChange}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Publication Year *</label>
              <input
                type="number"
                name="publicationYear"
                value={formik.values.publicationYear}
                onChange={formik.handleChange}
                className={inputCls}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Category *</label>
              <input
                name="category"
                value={formik.values.category}
                onChange={formik.handleChange}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Copies *</label>
              <input
                type="number"
                name="totalCopies"
                min={1}
                value={formik.values.totalCopies}
                onChange={formik.handleChange}
                className={inputCls}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Edition</label>
              <input className={inputCls} {...formik.getFieldProps('edition')} />
            </div>
            <div>
              <label className={labelCls}>Shelf Location</label>
              <input
                className={inputCls}
                {...formik.getFieldProps('shelfLocation')}
                placeholder="Example: A-12"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <CustomButton variant="tertiary" type="button" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton variant="primary" type="submit" loading={isLoading}>
              Add
            </CustomButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Issue Book Modal ─────────────────────────────────────────────────────────
function IssueBookModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { mutation, isLoading } = useMutation();
  const formik = useFormik({
    initialValues: { bookId: '', memberId: '', memberType: 'student' as 'student' | 'faculty' },
    validationSchema: Yup.object({
      bookId: Yup.string().trim().required(),
      memberId: Yup.string().trim().required(),
      memberType: Yup.string().oneOf(['student', 'faculty']).required(),
    }),
    onSubmit: async (values) => {
      const res = await mutation('library/issues', { method: 'POST', body: values, isAlert: true });
      if ((res as { results?: { success?: boolean } })?.results?.success) {
        toast.success('Book issued');
        onSaved();
      } else toast.error('Failed');
    },
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="relative z-10 w-full max-w-sm rounded-2xl bg-white  p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold">Issue Book</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-600 hover:text-slate-600 text-xl"
          >
            ✕
          </button>
        </div>
        <form onSubmit={formik.handleSubmit} className="space-y-3">
          <AsyncSelect
            type="books"
            label="Available Book"
            value={formik.values.bookId || null}
            onChange={(value) => formik.setFieldValue('bookId', value ?? '')}
            placeholder="Search title, author or ISBN"
            required
          />
          <div>
            <label className={labelCls}>Member Type *</label>
            <select
              className={inputCls}
              {...formik.getFieldProps('memberType')}
              onChange={(event) => {
                formik.handleChange(event);
                formik.setFieldValue('memberId', '');
              }}
            >
              <option value="student">Student</option>
              <option value="faculty">Faculty</option>
            </select>
          </div>
          <AsyncSelect
            type={formik.values.memberType === 'student' ? 'students' : 'faculty'}
            label={formik.values.memberType === 'student' ? 'Student' : 'Faculty Member'}
            value={formik.values.memberId || null}
            onChange={(value) => formik.setFieldValue('memberId', value ?? '')}
            placeholder={`Search ${formik.values.memberType} by name`}
            required
          />
          <p className="rounded-xl bg-primary-50 p-3 text-xs text-slate-600">
            The due date is calculated automatically from the library circulation policy.
          </p>
          <div className="flex justify-end gap-3">
            <CustomButton variant="tertiary" type="button" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton variant="primary" type="submit" loading={isLoading}>
              Issue
            </CustomButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Books Panel ───────────────────────────────────────────────────────────────
function BooksPanel({ canManage }: { canManage: boolean }) {
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<IBook | null>(null);
  const {
    data: raw,
    error,
    isLoading,
    isValidating,
    mutate,
  } = useSwr(q ? `library/books?q=${encodeURIComponent(q)}` : 'library/books');
  const books: IBook[] = (raw as { data?: IBook[] })?.data ?? [];

  if (error) return <Empty title="Books could not be loaded" subTitle={error.message} />;

  const columns: Column<IBook>[] = [
    {
      field: 'title',
      title: 'Title',
      render: (r) => (
        <div>
          <p className="text-sm font-medium">{r.title}</p>
          <p className="text-xs text-slate-600">{r.authors?.join(', ')}</p>
        </div>
      ),
    },
    {
      field: 'isbn',
      title: 'ISBN',
      render: (r) => <span className="text-xs font-mono">{String(r.isbn ?? '—')}</span>,
    },
    {
      field: 'category',
      title: 'Category',
      render: (r) => <span className="text-sm capitalize">{String(r.category ?? '—')}</span>,
    },
    {
      field: 'totalCopies',
      title: 'Copies',
      render: (r) => (
        <span
          className={`text-sm font-bold ${(r.availableCopies ?? 0) < 1 ? 'text-red-500' : 'text-green-600'}`}
        >
          {r.availableCopies ?? 0}/{r.totalCopies ?? 0}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <DataViewSwitcher<IBook>
        data={books}
        isLoading={isLoading}
        storageKey="library-books.view"
        showSearch={false}
        renderCard={(b) => {
          const available = (b as { availableCopies?: number }).availableCopies ?? 0;
          const total = (b as { totalCopies?: number }).totalCopies ?? 0;
          return (
            <motion.div
              whileHover={{ y: -2 }}
              className="flex flex-col gap-3 rounded-2xl bg-white p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary">
                  <BookOpen className="h-5 w-5" />
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${available > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}
                >
                  {available > 0 ? 'Available' : 'Out of stock'}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 line-clamp-2">
                  {(b as { title?: string }).title}
                </p>
                <p className="text-xs text-slate-500">{b.authors?.join(', ')}</p>
                {(b as { category?: string }).category && (
                  <p className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-600">
                    {(b as { category?: string }).category}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-mono">{(b as { isbn?: string }).isbn ?? '—'}</span>
                <span className="font-bold text-slate-800">
                  {available} / {total}
                </span>
              </div>
              {canManage && (
                <div className="flex items-center justify-end border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setEditing(b)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <Edit2 className="h-3 w-3" /> Edit
                  </button>
                </div>
              )}
            </motion.div>
          );
        }}
        table={
          <div className="overflow-hidden rounded-2xl bg-white">
            <CustomTable
              data={books}
              columns={columns}
              actions={
                canManage
                  ? [
                      {
                        tooltip: 'Edit',
                        icon: <Edit2 className="h-3.5 w-3.5" />,
                        onClick: (r) => setEditing(r),
                      },
                    ]
                  : []
              }
              isLoading={isLoading}
              isValidating={isValidating}
              title="Physical catalogue"
              description="Search titles, authors, ISBN records and live copy availability."
              onRefresh={() => mutate()}
              onSearch={(value) => setQ(value)}
              options={{ search: true, pagination: true, pageSize: 15 }}
              localization={{ toolbar: { searchPlaceholder: 'Search title, author or ISBN…' } }}
            />
          </div>
        }
      />
      <AnimatePresence>
        {editing && (
          <EditBookModal book={editing} onClose={() => setEditing(null)} onSaved={() => mutate()} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Edit Book Modal ─────────────────────────────────────────────────────
function EditBookModal({
  book,
  onClose,
  onSaved,
}: {
  book: IBook;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mutation, isLoading } = useMutation();
  const formik = useFormik({
    initialValues: {
      title: book.title ?? '',
      authorsRaw: book.authors?.join(', ') ?? '',
      isbn: book.isbn ?? '',
      publisher: book.publisher ?? '',
      publicationYear: Number(book.publicationYear ?? new Date().getFullYear()),
      edition: book.edition ?? '',
      category: book.category ?? '',
      totalCopies: book.totalCopies ?? 1,
    },
    validationSchema: Yup.object({
      title: Yup.string().trim().required('Title required'),
      totalCopies: Yup.number().min(1).required(),
    }),
    onSubmit: async (values) => {
      const authors = values.authorsRaw
        .split(',')
        .map((author) => author.trim())
        .filter(Boolean);
      const res = await mutation(`library/books/${book._id}`, {
        method: 'PUT',
        body: { ...values, authors, authorsRaw: undefined, isbn: undefined },
        isAlert: true,
      });
      if ((res as { data?: { success?: boolean } })?.data?.success !== false) {
        toast.success('Book updated');
        onSaved();
        onClose();
      } else toast.error('Failed');
    },
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6"
      >
        <h2 className="mb-4 text-base font-semibold">Edit Book</h2>
        <form onSubmit={formik.handleSubmit} className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={labelCls}>Title *</label>
            <input className={inputCls} {...formik.getFieldProps('title')} />
          </div>
          <div>
            <label className={labelCls}>Authors</label>
            <input className={inputCls} {...formik.getFieldProps('authorsRaw')} />
          </div>
          <div>
            <label className={labelCls}>ISBN</label>
            <input className={inputCls} {...formik.getFieldProps('isbn')} readOnly />
          </div>
          <div>
            <label className={labelCls}>Publisher</label>
            <input className={inputCls} {...formik.getFieldProps('publisher')} />
          </div>
          <div>
            <label className={labelCls}>Publication Year</label>
            <input
              className={inputCls}
              type="number"
              {...formik.getFieldProps('publicationYear')}
            />
          </div>
          <div>
            <label className={labelCls}>Category</label>
            <input className={inputCls} {...formik.getFieldProps('category')} />
          </div>
          <div>
            <label className={labelCls}>Total Copies</label>
            <input className={inputCls} type="number" {...formik.getFieldProps('totalCopies')} />
          </div>
          <p className="col-span-2 rounded-xl bg-primary-50 p-3 text-xs text-slate-600">
            Available copies are calculated automatically from total inventory and active issues.
          </p>
          <div className="col-span-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
            <CustomButton type="submit" loading={isLoading} className="w-fit!">
              Save
            </CustomButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Issues Panel ──────────────────────────────────────────────────────────────
function IssuesPanel({ canManage, selfService }: { canManage: boolean; selfService: boolean }) {
  const endpoint = selfService ? 'library/issues/my' : 'library/issues?limit=500';
  const { data: raw, error, isLoading, isValidating, mutate } = useSwr(endpoint);
  const issues: IIssue[] = ((raw as { data?: IIssue[] })?.data ?? []).map((issue) => {
    const book = typeof issue.bookId === 'object' ? issue.bookId : undefined;
    const member = typeof issue.memberId === 'object' ? issue.memberId : undefined;
    return {
      ...issue,
      bookTitle: issue.bookTitle ?? book?.title,
      isbn: issue.isbn ?? book?.isbn,
      studentName: issue.studentName ?? member?.name,
    };
  });
  const { mutation } = useMutation();
  const [fineIssue, setFineIssue] = useState<IIssue | null>(null);

  if (error) return <Empty title="Issues could not be loaded" subTitle={error.message} />;

  const handleReturn = async (issue: IIssue) => {
    const r = await Swal.fire({
      title: 'Return book?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes',
      confirmButtonColor: '#0178D7',
    });
    if (!r.isConfirmed) return;
    const res = await mutation(`library/issues/${issue._id}/return`, {
      method: 'PUT',
      body: {},
      isAlert: true,
    });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Returned');
      mutate();
    } else toast.error('Failed');
  };

  const handleRenew = async (issue: IIssue) => {
    const res = await mutation(`library/issues/${issue._id}/renew`, {
      method: 'PUT',
      body: {},
      isAlert: true,
    });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Renewed');
      mutate();
    } else toast.error('Failed');
  };

  const columns: Column<IIssue>[] = [
    {
      field: 'bookTitle',
      title: 'Book',
      render: (r) => <span className="text-sm">{r.bookTitle ?? 'Book unavailable'}</span>,
    },
    ...(!selfService
      ? [
          {
            field: 'studentName' as keyof IIssue,
            title: 'Student',
            render: (r: IIssue) => (
              <div>
                <p className="text-sm">{String(r.studentName ?? '—')}</p>
                <p className="text-xs font-mono text-slate-600">{String(r.rollNo ?? '')}</p>
              </div>
            ),
          },
        ]
      : []),
    {
      field: 'issueDate',
      title: 'Issued',
      render: (r) => <span className="text-xs">{fmtDate(r.issueDate)}</span>,
    },
    {
      field: 'dueDate',
      title: 'Due',
      render: (r) => {
        const overdue = !r.returnDate && new Date(r.dueDate) < new Date();
        return (
          <span className={`text-xs ${overdue ? 'text-red-500 font-bold' : 'text-slate-600'}`}>
            {fmtDate(r.dueDate)}
          </span>
        );
      },
    },
    {
      field: 'status',
      title: 'Status',
      render: (r) => {
        const c = ISSUE_STATUS_CFG[r.status] ?? ISSUE_STATUS_CFG.issued;
        return (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}>
            {c.label}
          </span>
        );
      },
    },
    ...((r) =>
      r.fineAmount
        ? [
            {
              field: 'fineAmount' as keyof IIssue,
              title: 'Fine',
              render: (r: IIssue) => (
                <span className="text-xs font-bold text-red-500">₹{r.fineAmount}</span>
              ),
            },
          ]
        : [])({} as IIssue),
  ];

  const actions: Action<IIssue>[] = [
    ...(canManage
      ? ([
          {
            tooltip: 'Return',
            icon: <RotateCcw className="h-4 w-4 text-green-500" />,
            onClick: handleReturn,
            hidden: (r: IIssue) => r.status === 'returned',
          },
          {
            tooltip: 'Collect Fine',
            icon: <BookMarked className="h-4 w-4 text-amber-500" />,
            onClick: (issue: IIssue) => setFineIssue(issue),
            hidden: (issue: IIssue) =>
              issue.status !== 'returned' || (issue.fineAmount ?? 0) - (issue.finePaid ?? 0) <= 0,
          },
        ] as Action<IIssue>[])
      : []),
    ...(selfService
      ? ([
          {
            tooltip: 'Renew',
            icon: <RefreshCw className="h-4 w-4 text-primary" />,
            onClick: handleRenew,
            hidden: (r: IIssue) => r.status !== 'issued' && r.status !== 'renewed',
          },
        ] as Action<IIssue>[])
      : []),
  ];

  return (
    <>
      <DataViewSwitcher<IIssue>
        data={issues}
        isLoading={isLoading}
        storageKey="library.issues.view"
        searchPlaceholder="Search issues…"
        searchFields={['bookTitle', 'isbn', 'studentName', 'rollNo', 'status']}
        pageSize={16}
        renderCard={(r) => {
          const cfg =
            r.status === 'returned'
              ? 'bg-green-50 text-green-600'
              : r.status === 'overdue'
                ? 'bg-red-50 text-red-500'
                : r.status === 'renewed'
                  ? 'bg-amber-50 text-amber-600'
                  : 'bg-blue-50 text-blue-600';
          return (
            <motion.div
              whileHover={{ y: -2 }}
              className="flex flex-col gap-3 rounded-2xl bg-white p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary">
                  <BookMarked className="h-5 w-5" />
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${cfg}`}
                >
                  {r.status}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 line-clamp-2">
                  {r.bookTitle ?? '—'}
                </p>
                {r.isbn && <p className="text-[11px] font-mono text-slate-600">{r.isbn}</p>}
              </div>
              <div className="space-y-1 text-xs text-slate-500">
                {r.studentName && (
                  <p>
                    To:{' '}
                    <span className="text-slate-700">
                      {r.studentName}
                      {r.rollNo ? ` (${r.rollNo})` : ''}
                    </span>
                  </p>
                )}
                {r.issueDate && (
                  <p>
                    Issued:{' '}
                    <span className="text-slate-700">
                      {new Date(r.issueDate).toLocaleDateString()}
                    </span>
                  </p>
                )}
                {r.dueDate && (
                  <p>
                    Due:{' '}
                    <span className="text-slate-700">
                      {new Date(r.dueDate).toLocaleDateString()}
                    </span>
                  </p>
                )}
                {r.returnDate && (
                  <p>
                    Returned:{' '}
                    <span className="text-slate-700">
                      {new Date(r.returnDate).toLocaleDateString()}
                    </span>
                  </p>
                )}
                {!!r.fineAmount && r.fineAmount > 0 && (
                  <p className="font-medium text-red-500">Fine: ₹{r.fineAmount}</p>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3 text-xs">
                {canManage && r.status !== 'returned' && (
                  <button
                    type="button"
                    onClick={() => handleReturn(r)}
                    className="inline-flex items-center gap-1 font-medium text-green-600 hover:underline"
                  >
                    <RotateCcw className="h-3 w-3" /> Return
                  </button>
                )}
                {selfService && (r.status === 'issued' || r.status === 'renewed') && (
                  <button
                    type="button"
                    onClick={() => handleRenew(r)}
                    className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    <RefreshCw className="h-3 w-3" /> Renew
                  </button>
                )}
              </div>
            </motion.div>
          );
        }}
        table={
          <div className="overflow-hidden rounded-2xl bg-white">
            <CustomTable
              data={issues}
              columns={columns}
              actions={actions}
              isLoading={isLoading}
              isValidating={isValidating}
              title={selfService ? 'My circulation' : 'Circulation register'}
              description={
                selfService
                  ? 'Track due dates, renew eligible loans and review return status.'
                  : 'Review member loans, due dates, returns, overdue exposure and fine settlement.'
              }
              onRefresh={() => mutate()}
              options={{ search: false, pagination: true, pageSize: 12 }}
              localization={{ toolbar: { searchPlaceholder: 'Search issues…' } }}
            />
          </div>
        }
      />
      <AnimatePresence>
        {fineIssue && (
          <FinePaymentModal
            issue={fineIssue}
            onClose={() => setFineIssue(null)}
            onSaved={() => {
              setFineIssue(null);
              mutate();
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function FinePaymentModal({
  issue,
  onClose,
  onSaved,
}: {
  issue: IIssue;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mutation, isLoading } = useMutation();
  const outstanding = Math.max(0, (issue.fineAmount ?? 0) - (issue.finePaid ?? 0));
  const formik = useFormik({
    initialValues: {
      amount: outstanding,
      paymentMode: 'cash' as 'cash' | 'bank_transfer' | 'upi',
      referenceNo: '',
    },
    validationSchema: Yup.object({
      amount: Yup.number().positive().max(outstanding).required(),
      paymentMode: Yup.string().oneOf(['cash', 'bank_transfer', 'upi']).required(),
    }),
    onSubmit: async (values) => {
      const response = await mutation(`library/issues/${issue._id}/fine-payments`, {
        method: 'POST',
        body: values,
        isAlert: true,
      });
      if ((response as { results?: { success?: boolean } })?.results?.success) {
        toast.success('Fine payment recorded and posted to accounts');
        onSaved();
      } else toast.error('Fine payment could not be recorded');
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm" onClick={onClose} />
      <motion.div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6">
        <h2 className="text-base font-semibold">Collect Library Fine</h2>
        <p className="mt-1 text-xs text-slate-500">
          {issue.bookTitle} · Outstanding ₹{outstanding.toLocaleString('en-IN')}
        </p>
        <form onSubmit={formik.handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className={labelCls}>Amount *</label>
            <input
              type="number"
              min={0.01}
              max={outstanding}
              step={0.01}
              className={inputCls}
              {...formik.getFieldProps('amount')}
            />
          </div>
          <div>
            <label className={labelCls}>Payment Mode *</label>
            <select className={inputCls} {...formik.getFieldProps('paymentMode')}>
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="upi">UPI</option>
            </select>
          </div>
          {formik.values.paymentMode !== 'cash' && (
            <div>
              <label className={labelCls}>Payment Reference</label>
              <input className={inputCls} {...formik.getFieldProps('referenceNo')} />
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <CustomButton type="button" variant="tertiary" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton type="submit" loading={isLoading}>
              Record Payment
            </CustomButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Digital Panel ─────────────────────────────────────────────────────────────
function DigitalPanel({ canManage }: { canManage: boolean }) {
  const { data: raw, error, isLoading, isValidating, mutate } = useSwr('library/digital');
  const resources: IDigitalResource[] = (raw as { data?: IDigitalResource[] })?.data ?? [];
  const [showAdd, setShowAdd] = useState(false);

  if (error)
    return <Empty title="Digital resources could not be loaded" subTitle={error.message} />;
  if (isLoading) return <div className="h-32 animate-pulse rounded-2xl bg-white" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-base font-bold text-slate-900">Digital library</h2><p className="mt-1 text-xs text-slate-500">Licensed e-books, journals, databases, courses and learning media.</p></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => mutate()} className="flex w-fit items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200"><RefreshCw className={`h-4 w-4 ${isValidating ? 'animate-spin' : ''}`} />Refresh</button>
          {canManage && (
          <CustomButton
            startIcon={<Plus className="h-4 w-4" />}
            onClick={() => setShowAdd(true)}
            className="w-fit!"
          >
            Add Resource
          </CustomButton>
          )}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {resources.map((r) => (
          <div key={r._id} className="flex items-start gap-3 rounded-2xl bg-white p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary">
              <Monitor className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 line-clamp-1">{r.title}</p>
              <p className="text-xs text-slate-600">{r.authors?.join(', ')}</p>
              <p className="mt-1 text-xs text-slate-500">{r.category}</p>
              <a
                href={r.digitalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Access →
              </a>
            </div>
          </div>
        ))}
        {!resources.length && (
          <div className="col-span-full rounded-2xl bg-white">
            <Empty
              title="No digital resources yet"
              subTitle="Add licensed e-books, journals, videos or learning databases."
            />
          </div>
        )}
      </div>
      <AnimatePresence>
        {showAdd && <AddDigitalModal onClose={() => setShowAdd(false)} onSaved={() => mutate()} />}
      </AnimatePresence>
    </div>
  );
}

// ─── Add Digital Modal (staff) ──────────────────────────────────────────────────────
function AddDigitalModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { mutation, isLoading } = useMutation();
  const formik = useFormik({
    initialValues: {
      title: '',
      isbn: '',
      authorsRaw: '',
      publisher: '',
      publicationYear: new Date().getFullYear(),
      category: 'E-Book',
      subject: '',
      digitalUrl: '',
      language: 'English',
    },
    validationSchema: Yup.object({
      title: Yup.string().trim().required('Title required'),
      isbn: Yup.string().trim().required('ISBN or resource identifier required'),
      authorsRaw: Yup.string().trim().required('Author required'),
      publisher: Yup.string().trim().required('Publisher required'),
      publicationYear: Yup.number()
        .min(1000)
        .max(new Date().getFullYear() + 1)
        .required(),
      digitalUrl: Yup.string().url('Invalid URL').required('URL required'),
      category: Yup.string().required('Category required'),
    }),
    onSubmit: async (values) => {
      const authors = values.authorsRaw
        .split(',')
        .map((author) => author.trim())
        .filter(Boolean);
      const res = await mutation('library/digital', {
        method: 'POST',
        body: { ...values, authors, authorsRaw: undefined },
        isAlert: true,
      });
      if ((res as { data?: { success?: boolean } })?.data?.success !== false) {
        toast.success('Resource added');
        onSaved();
        onClose();
      } else toast.error('Failed');
    },
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6"
      >
        <h2 className="mb-4 text-base font-semibold">Add Digital Resource</h2>
        <form onSubmit={formik.handleSubmit} className="space-y-3">
          <div>
            <label className={labelCls}>Title *</label>
            <input className={inputCls} {...formik.getFieldProps('title')} />
          </div>
          <div>
            <label className={labelCls}>Category *</label>
            <select className={inputCls} {...formik.getFieldProps('category')}>
              <option>E-Book</option>
              <option>Journal</option>
              <option>Video</option>
              <option>Course</option>
              <option>Database</option>
              <option>Other</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Resource URL *</label>
            <input
              className={inputCls}
              {...formik.getFieldProps('digitalUrl')}
              placeholder="https://..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Author(s) *</label>
              <input className={inputCls} {...formik.getFieldProps('authorsRaw')} />
            </div>
            <div>
              <label className={labelCls}>Publisher *</label>
              <input className={inputCls} {...formik.getFieldProps('publisher')} />
            </div>
            <div>
              <label className={labelCls}>ISBN / Resource ID *</label>
              <input className={inputCls} {...formik.getFieldProps('isbn')} />
            </div>
            <div>
              <label className={labelCls}>Publication Year *</label>
              <input
                type="number"
                className={inputCls}
                {...formik.getFieldProps('publicationYear')}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
            <CustomButton type="submit" loading={isLoading} className="w-fit!">
              Add
            </CustomButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
type Tab = 'books' | 'issues' | 'digital';

function LibraryAnalytics({
  books,
  issues,
  catalogueTotal,
  digitalTotal,
  selfService,
  isLoading,
}: {
  books: IBook[];
  issues: IIssue[];
  catalogueTotal: number;
  digitalTotal: number;
  selfService: boolean;
  isLoading: boolean;
}) {
  const summary = useMemo(() => {
    const totalCopies = books.reduce((sum, book) => sum + Number(book.totalCopies ?? 0), 0);
    const availableCopies = books.reduce(
      (sum, book) => sum + Number(book.availableCopies ?? 0),
      0,
    );
    const activeIssues = issues.filter(
      (issue) => !issue.returnDate && ['issued', 'renewed', 'overdue'].includes(issue.status),
    );
    const overdue = activeIssues.filter(
      (issue) => issue.status === 'overdue' || new Date(issue.dueDate) < new Date(),
    ).length;
    const outstandingFine = issues.reduce(
      (sum, issue) => sum + Math.max(0, Number(issue.fineAmount ?? 0) - Number(issue.finePaid ?? 0)),
      0,
    );
    const categories = books.reduce<Record<string, number>>((counts, book) => {
      const category = String(book.category || 'Uncategorised');
      counts[category] = (counts[category] ?? 0) + 1;
      return counts;
    }, {});
    return {
      totalCopies,
      availableCopies,
      onLoan: Math.max(0, totalCopies - availableCopies),
      activeIssues: activeIssues.length,
      overdue,
      outstandingFine,
      categories: Object.entries(categories)
        .sort((left, right) => right[1] - left[1])
        .slice(0, 5),
    };
  }, [books, issues]);

  if (isLoading) {
    return <div className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white" />;
  }

  const inventoryTotal = summary.availableCopies + summary.onLoan;
  const availablePercent = inventoryTotal ? (summary.availableCopies / inventoryTotal) * 100 : 0;
  const circumference = 2 * Math.PI * 42;
  const categoryMax = Math.max(1, ...summary.categories.map(([, count]) => count));
  const hasOperationalData = summary.totalCopies > 0 || issues.length > 0;

  return (
    <section className="space-y-4" aria-label="Library analytics">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Catalogue titles',
            value: catalogueTotal.toLocaleString('en-IN'),
            detail: `${summary.totalCopies.toLocaleString('en-IN')} physical copies`,
            icon: LibraryBig,
            color: 'bg-blue-50 text-blue-600',
          },
          {
            label: 'Available now',
            value: summary.availableCopies.toLocaleString('en-IN'),
            detail: inventoryTotal ? `${availablePercent.toFixed(1)}% of inventory` : 'No physical inventory',
            icon: BookCopy,
            color: 'bg-emerald-50 text-emerald-600',
          },
          {
            label: selfService ? 'My active loans' : 'Active loans',
            value: summary.activeIssues.toLocaleString('en-IN'),
            detail: `${summary.overdue} overdue`,
            icon: Users,
            color: summary.overdue ? 'bg-rose-50 text-rose-600' : 'bg-violet-50 text-violet-600',
          },
          {
            label: 'Digital resources',
            value: digitalTotal.toLocaleString('en-IN'),
            detail: summary.outstandingFine ? `₹${summary.outstandingFine.toLocaleString('en-IN')} fines due` : 'No outstanding fines',
            icon: Monitor,
            color: 'bg-amber-50 text-amber-600',
          },
        ].map(({ label, value, detail, icon: Icon, color }) => (
          <article key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-500">{label}</p>
                <p className="mt-0.5 text-xl font-black text-slate-900">{value}</p>
              </div>
            </div>
            <p className="mt-3 truncate text-xs text-slate-500">{detail}</p>
          </article>
        ))}
      </div>

      {hasOperationalData && (
        <div className="grid gap-4 lg:grid-cols-2">
          {summary.totalCopies > 0 && (
            <article className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Inventory availability</h2>
                  <p className="mt-1 text-xs text-slate-500">Physical copies available versus currently on loan</p>
                </div>
                {summary.overdue > 0 && <span className="flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-600"><AlertTriangle className="h-3.5 w-3.5" />{summary.overdue} overdue</span>}
              </div>
              <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:justify-around">
                <div className="relative h-36 w-36">
                  <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label="Inventory availability donut">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#e2e8f0" strokeWidth="11" />
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#10b981" strokeWidth="11" strokeLinecap="round" strokeDasharray={`${(availablePercent / 100) * circumference} ${circumference}`} />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-xl font-black text-slate-900">{availablePercent.toFixed(0)}%</span><span className="text-[10px] text-slate-500">available</span></div>
                </div>
                <div className="w-full space-y-3 sm:max-w-52">
                  {[['Available copies', summary.availableCopies, 'bg-emerald-500'], ['On loan', summary.onLoan, 'bg-slate-300']].map(([label, value, color]) => <div key={String(label)} className="flex items-center justify-between rounded-xl bg-slate-50 p-3"><span className="flex items-center gap-2 text-xs text-slate-600"><span className={`h-2.5 w-2.5 rounded-full ${color}`} />{label}</span><span className="text-sm font-bold text-slate-900">{value}</span></div>)}
                </div>
              </div>
            </article>
          )}

          {summary.categories.length > 0 && (
            <article className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
              <h2 className="text-sm font-bold text-slate-900">Catalogue composition</h2>
              <p className="mt-1 text-xs text-slate-500">Leading categories across the loaded catalogue</p>
              <div className="mt-5 space-y-3">
                {summary.categories.map(([category, count]) => (
                  <div key={category}>
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="truncate font-medium text-slate-600">{category}</span><span className="font-bold text-slate-800">{count}</span></div>
                    <svg viewBox="0 0 100 6" className="h-2 w-full" aria-hidden="true"><rect width="100" height="6" rx="3" className="fill-slate-100" /><rect width={(count / categoryMax) * 100} height="6" rx="3" className="fill-primary" /></svg>
                  </div>
                ))}
              </div>
            </article>
          )}
        </div>
      )}
    </section>
  );
}

export default function LibraryPage() {
  const activeRole = useAuthStore(
    (state) => state.activeRole?.baseRole ?? state.activeRole?.name ?? state.role,
  );
  const canView = useHasPermission('library', 'view');
  const canCreate = useHasPermission('library', 'create');
  const canEdit = useHasPermission('library', 'edit');
  const canManage = canCreate || canEdit;
  const selfService = activeRole === 'student' || activeRole === 'faculty';

  const { data: analyticsBooksRaw, isLoading: booksLoading } = useSwr(
    canView ? 'library/books?limit=500' : null,
  );
  const { data: analyticsIssuesRaw, isLoading: issuesLoading } = useSwr(
    canView ? (selfService ? 'library/issues/my' : 'library/issues?limit=500') : null,
  );
  const { data: analyticsDigitalRaw, isLoading: digitalLoading } = useSwr(
    canView ? 'library/digital?limit=500' : null,
  );
  const analyticsBooks: IBook[] = useMemo(
    () => (analyticsBooksRaw as { data?: IBook[] } | undefined)?.data ?? [],
    [analyticsBooksRaw],
  );
  const analyticsIssues: IIssue[] = useMemo(
    () => (analyticsIssuesRaw as { data?: IIssue[] } | undefined)?.data ?? [],
    [analyticsIssuesRaw],
  );
  const analyticsDigital: IDigitalResource[] = useMemo(
    () => (analyticsDigitalRaw as { data?: IDigitalResource[] } | undefined)?.data ?? [],
    [analyticsDigitalRaw],
  );
  const catalogueTotal =
    (analyticsBooksRaw as { total?: number } | undefined)?.total ?? analyticsBooks.length;
  const digitalTotal =
    (analyticsDigitalRaw as { total?: number } | undefined)?.total ?? analyticsDigital.length;

  const [tab, setTab] = useState<Tab>('books');
  const [revision, setRevision] = useState(0);
  const [showAddBook, setShowAddBook] = useState(false);
  const [showIssueBook, setShowIssueBook] = useState(false);

  if (!canView) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Library access unavailable</h1>
        <p className="mt-2 text-sm text-slate-500">
          Your active role cannot view library resources.
        </p>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'books', label: 'Books', icon: BookOpen },
    { id: 'issues', label: selfService ? 'My Issues' : 'Circulation', icon: BookMarked },
    { id: 'digital', label: 'Digital Library', icon: Monitor },
  ];

  return (
    <div className="space-y-5">
      <LibraryAnalytics
        books={analyticsBooks}
        issues={analyticsIssues}
        catalogueTotal={catalogueTotal}
        digitalTotal={digitalTotal}
        selfService={selfService}
        isLoading={booksLoading || issuesLoading || digitalLoading}
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${tab === t.id ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-100'}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>
      {canManage && (
        <div className="flex flex-wrap gap-2">
          <CustomButton variant="secondary" onClick={() => setShowIssueBook(true)} className="w-fit!">Issue Book</CustomButton>
          <CustomButton variant="primary" startIcon={<Plus className="h-4 w-4" />} onClick={() => setShowAddBook(true)} className="w-fit!">Add Book</CustomButton>
        </div>
      )}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
        >
          {tab === 'books' && <BooksPanel key={`books-${revision}`} canManage={canEdit} />}
          {tab === 'issues' && (
            <IssuesPanel
              key={`issues-${revision}`}
              canManage={canEdit}
              selfService={selfService}
            />
          )}
          {tab === 'digital' && (
            <DigitalPanel key={`digital-${revision}`} canManage={canCreate} />
          )}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {showAddBook && (
          <AddBookModal
            onClose={() => setShowAddBook(false)}
            onSaved={() => {
              setRevision((value) => value + 1);
              setShowAddBook(false);
            }}
          />
        )}
        {showIssueBook && (
          <IssueBookModal
            onClose={() => setShowIssueBook(false)}
            onSaved={() => {
              setRevision((value) => value + 1);
              setShowIssueBook(false);
              setTab('issues');
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
