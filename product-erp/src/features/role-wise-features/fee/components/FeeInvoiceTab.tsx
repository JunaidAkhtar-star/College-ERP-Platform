'use client';

/**
 * @file FeeInvoiceTab.tsx
 * @description Admin tab — generate a new fee invoice (demand letter) for a student.
 *              Picks a student from student-profile list, requires a matching FeeStructure.
 * @module features/role-wise-features/fee/components
 */

import React, { useState } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import { FileText, Download, Eye } from 'lucide-react';
import { motion } from '@/shared/utils/motion';
import CustomButton from '@/shared/core/CustomButton';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import type { IGenerateInvoiceDto } from '../types/Fee.types';
import AsyncSelect from '@/shared/core/AsyncSelect';

interface IFeePreview {
  studentContext: {
    program: string;
    branch: string;
    semester: number;
    academicYear: string;
    category: string;
  };
  structure: {
    _id: string;
    totalAmount: number;
    feeItems: Array<{ type: string; description?: string; amount: number }>;
  };
  scholarshipTotal: number;
  grossAmount: number;
  netDue: number;
  existingInvoice?: { invoiceNumber: string; status: string } | null;
}

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary focus:bg-white';
const labelCls = 'mb-1 block text-xs font-medium text-slate-600';

function getSemestersForProgram(program: string): number {
  const p = (program ?? '').toUpperCase();
  if (p.includes('B.TECH') || p.includes('BTECH') || p.includes('BACHELOR OF TECHNOLOGY')) {
    return 8;
  }
  if (p.includes('M.TECH') || p.includes('MTECH') || p.includes('MASTER OF TECHNOLOGY')) {
    return 4;
  }
  if (p.includes('MBA') || p.includes('MASTER OF BUSINESS')) {
    return 4;
  }
  if (p.includes('MCA') || p.includes('MASTER OF COMPUTER')) {
    return 4;
  }
  if (
    p.includes('BCA') ||
    p.includes('B.CA') ||
    p.includes('BSC') ||
    p.includes('B.SC') ||
    p.includes('BBA') ||
    p.includes('B.BA')
  ) {
    return 6;
  }
  if (p.includes('PHD') || p.includes('PH.D') || p.includes('DOCTORAL')) {
    return 10;
  }
  if (p.includes('DIPLOMA')) {
    return 6;
  }
  return 8; // Default fallback
}

const schema = Yup.object({
  studentId: Yup.string().required('Select a student'),
  rollNumber: Yup.string().required('Required'),
  studentName: Yup.string().required('Required'),
  program: Yup.string().required('Required'),
  branch: Yup.string().required('Required'),
  semester: Yup.number().min(1).max(10).required('Required'),
  academicYear: Yup.string().required('Required'),
  category: Yup.string().required('Required'),
  dueDate: Yup.string().required('Required'),
  scholarships: Yup.array().of(
    Yup.object({
      type: Yup.string().required(),
      amount: Yup.number().min(0).required(),
    }),
  ),
});

function downloadBase64Pdf(base64: string, filename: string) {
  const byteChars = atob(base64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function FeeInvoiceTab() {
  const { mutation, isLoading: generating } = useMutation();
  const { mutation: previewMutation, isLoading: previewing } = useMutation();
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [lastInvoice, setLastInvoice] = useState<{ invoiceNumber: string; base64: string } | null>(
    null,
  );
  const [preview, setPreview] = useState<IFeePreview | null>(null);

  // Fetch full student profile when a student is selected via AsyncSelect
  const { data: studentDetailRaw, isLoading: detailLoading } = useSwr(
    selectedStudentId ? `student-profile/${selectedStudentId}` : null,
  );

  const initialValues: IGenerateInvoiceDto = {
    studentId: '',
    rollNumber: '',
    studentName: '',
    fatherName: '',
    studentEmail: '',
    program: '',
    branch: '',
    semester: 1,
    academicYear: '',
    category: 'General',
    dueDate: '',
    scholarships: [],
  };

  const handleGenerate = async (
    values: IGenerateInvoiceDto,
    helpers: { resetForm: () => void },
  ) => {
    const r = await mutation('fee/invoice', { method: 'POST', body: values });
    const resp = r as {
      results?: {
        success?: boolean;
        data?: { invoiceNumber?: string; invoiceBase64?: string };
        invoiceBase64?: string;
        message?: string;
      };
    };
    if (resp?.results?.success) {
      toast.success(`Invoice ${resp.results.data?.invoiceNumber ?? ''} generated successfully`);
      const base64 = resp.results.data?.invoiceBase64 ?? resp.results.invoiceBase64 ?? undefined;
      if (base64 && resp.results.data?.invoiceNumber) {
        setLastInvoice({
          invoiceNumber: resp.results.data.invoiceNumber,
          base64,
        });
      }
      setPreview(null);
      setSelectedStudentId(null);
      helpers.resetForm();
    } else {
      toast.error(resp?.results?.message ?? 'Failed to generate invoice');
    }
  };

  const handlePreview = async (values: IGenerateInvoiceDto) => {
    const r = await previewMutation('fee/invoice/preview', {
      method: 'POST',
      body: values,
      silentError: true,
    });
    const resp = r as {
      results?: {
        success?: boolean;
        data?: IFeePreview;
        message?: string;
      };
    };
    if (resp?.results?.success && resp.results.data) {
      setPreview(resp.results.data);
      if (resp.results.data.existingInvoice) {
        toast.info(`Invoice already exists: ${resp.results.data.existingInvoice.invoiceNumber}`);
      } else {
        toast.success('Matching fee structure found');
      }
    } else {
      setPreview(null);
      toast.error(resp?.results?.message ?? 'No matching fee structure found');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col justify-between gap-3 rounded-2xl bg-linear-to-r from-primary-50 via-sky-50 to-white p-5 border border-sky-100/80 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Generate Student Fee Invoice</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Guided invoice generator — select any student to dynamically pull profile data &
            matching fee templates
          </p>
          <p className="mt-1 text-xs text-emerald-700">
            Approved scholarship credits are applied automatically by the preview service.
          </p>
        </div>
      </div>

      {lastInvoice && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between rounded-xl bg-secondary-50 p-4"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-white">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">
                Invoice generated: {lastInvoice.invoiceNumber}
              </p>
              <p className="text-xs text-slate-500">Click download to save the demand letter PDF</p>
            </div>
          </div>
          <div className="flex gap-2">
            <CustomButton
              variant="primary"
              startIcon={<Download className="h-4 w-4" />}
              onClick={() =>
                downloadBase64Pdf(lastInvoice.base64, `${lastInvoice.invoiceNumber}.pdf`)
              }
            >
              Download PDF
            </CustomButton>
            <CustomButton variant="cancel" onClick={() => setLastInvoice(null)}>
              Dismiss
            </CustomButton>
          </div>
        </motion.div>
      )}

      <Formik<IGenerateInvoiceDto>
        initialValues={initialValues}
        validationSchema={schema}
        enableReinitialize
        onSubmit={handleGenerate}
      >
        {({ values, setValues, setFieldValue }) => {
          // Effect to autofill form when detailed student data is loaded from API
          // eslint-disable-next-line react-hooks/rules-of-hooks
          React.useEffect(() => {
            if (!studentDetailRaw) return;
            const profileData =
              (studentDetailRaw as { data?: Record<string, unknown> })?.data ??
              (studentDetailRaw as Record<string, unknown>);
            if (!profileData) return;

            const parentInfo =
              typeof profileData.parentInfo === 'object'
                ? (profileData.parentInfo as Record<string, string>)
                : null;
            const u =
              typeof profileData.userId === 'object'
                ? (profileData.userId as Record<string, string>)
                : null;
            const dept =
              typeof profileData.department === 'object'
                ? (profileData.department as Record<string, string>)
                : null;

            const studentId = String(u?._id ?? profileData.userId ?? profileData._id ?? '');
            const rollNumber = String(profileData.rollNumber ?? '');
            const fullName = String(
              profileData.fullName ??
                u?.name ??
                [profileData.firstName, profileData.middleName, profileData.lastName]
                  .filter(Boolean)
                  .join(' ') ??
                '',
            );
            const email = String(profileData.email ?? profileData.collegeEmail ?? u?.email ?? '');
            const fatherName = String(profileData.fatherName ?? parentInfo?.fatherName ?? '');

            const programName =
              typeof profileData.program === 'object'
                ? ((profileData.program as Record<string, string>)?.name ?? '')
                : String(profileData.program ?? '');
            const branchName = String(
              dept?.name ?? dept?.code ?? profileData.branch ?? profileData.department ?? '',
            );
            const semesterNum = Number(profileData.currentSemester ?? profileData.semester ?? 1);
            const academicYr = String(
              profileData.academicYear ?? profileData.batch ?? profileData.session ?? '',
            );
            const rawCategory = profileData.category ? String(profileData.category) : '';
            const categoryName =
              ['General', 'SC', 'ST', 'OBC', 'EWS', 'Lateral Entry'].find(
                (c) => c.toLowerCase() === rawCategory.toLowerCase(),
              ) ?? 'General';

            setValues((prev) => ({
              ...prev,
              studentId: studentId || prev.studentId,
              rollNumber: rollNumber || prev.rollNumber,
              studentName: fullName || prev.studentName,
              studentEmail: email || prev.studentEmail,
              fatherName: fatherName || prev.fatherName,
              program: programName || prev.program,
              branch: branchName || prev.branch,
              semester: semesterNum || prev.semester,
              academicYear: academicYr || prev.academicYear,
              category: categoryName || prev.category,
            }));
            setPreview(null);
            // eslint-disable-next-line react-hooks/exhaustive-deps
          }, [studentDetailRaw]);

          return (
            <Form className="space-y-6">
              {/* SECTION 1: Student Lookup */}
              <div className="rounded-2xl border border-slate-100 bg-white p-5  space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary">
                    1
                  </span>
                  <h4 className="text-sm font-bold text-slate-800">Student Profile Lookup</h4>
                  {detailLoading && (
                    <span className="ml-auto text-xs font-medium text-primary animate-pulse">
                      Autofilling student details...
                    </span>
                  )}
                </div>

                <div>
                  <AsyncSelect
                    label="Search & Select Student *"
                    type="studentProfiles"
                    placeholder="Type student name, roll number or email..."
                    value={selectedStudentId}
                    onChange={(val, option) => {
                      setSelectedStudentId(val);
                      if (option) {
                        const meta = option.meta as Record<string, string | number> | undefined;
                        setFieldValue('studentId', option.value);
                        setFieldValue('studentName', option.label.split(' (')[0] ?? option.label);
                        if (meta) {
                          setFieldValue('rollNumber', String(meta.rollNumber ?? ''));
                          setFieldValue('program', String(meta.program ?? ''));
                          setFieldValue('branch', String(meta.branch ?? ''));
                          setFieldValue('semester', Number(meta.semester ?? 1));
                          setFieldValue('academicYear', String(meta.academicYear ?? ''));
                          const rawCat = meta.category ? String(meta.category) : '';
                          const catVal =
                            ['General', 'SC', 'ST', 'OBC', 'EWS', 'Lateral Entry'].find(
                              (c) => c.toLowerCase() === rawCat.toLowerCase(),
                            ) ?? 'General';
                          setFieldValue('category', catVal);
                        }
                      }
                      setPreview(null);
                    }}
                    required
                  />
                  <ErrorMessage name="studentId">
                    {(m) => <p className="mt-1 text-xs text-red-500">{m}</p>}
                  </ErrorMessage>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className={labelCls}>Roll Number *</label>
                    <Field name="rollNumber" className={inputCls} placeholder="e.g. 2024CS001" />
                    <ErrorMessage name="rollNumber">
                      {(m) => <p className="mt-1 text-xs text-red-500">{m}</p>}
                    </ErrorMessage>
                  </div>
                  <div>
                    <label className={labelCls}>Student Name *</label>
                    <Field name="studentName" className={inputCls} placeholder="Full Name" />
                    <ErrorMessage name="studentName">
                      {(m) => <p className="mt-1 text-xs text-red-500">{m}</p>}
                    </ErrorMessage>
                  </div>
                  <div>
                    <label className={labelCls}>Father&apos;s Name</label>
                    <Field name="fatherName" className={inputCls} placeholder="Father's Name" />
                  </div>
                  <div>
                    <label className={labelCls}>Student Email</label>
                    <Field
                      name="studentEmail"
                      type="email"
                      className={inputCls}
                      placeholder="email@domain.com"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: Academic & Invoice Parameters */}
              <div className="rounded-2xl border border-slate-100 bg-white p-5  space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary">
                    2
                  </span>
                  <h4 className="text-sm font-bold text-slate-800">Academic & Billing Context</h4>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <AsyncSelect
                      label="Program *"
                      type="programs"
                      value={values.program || null}
                      onChange={(val, opt) => {
                        setFieldValue('program', opt?.label ?? val ?? '');
                        setFieldValue('branch', '');
                      }}
                      placeholder="Select program"
                      required
                    />
                    <ErrorMessage name="program">
                      {(m) => <p className="mt-1 text-xs text-red-500">{m}</p>}
                    </ErrorMessage>
                  </div>
                  <div>
                    <AsyncSelect
                      label="Branch *"
                      type="departments"
                      params={values.program ? { program: values.program } : undefined}
                      value={values.branch || null}
                      onChange={(val, opt) => setFieldValue('branch', opt?.label ?? val ?? '')}
                      placeholder="Select branch"
                      required
                    />
                    <ErrorMessage name="branch">
                      {(m) => <p className="mt-1 text-xs text-red-500">{m}</p>}
                    </ErrorMessage>
                  </div>
                  <div>
                    <label className={labelCls}>Semester *</label>
                    <Field
                      as="select"
                      name="semester"
                      className={inputCls}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                        setFieldValue('semester', Number(e.target.value))
                      }
                    >
                      {Array.from(
                        { length: getSemestersForProgram(values.program) },
                        (_, i) => i + 1,
                      ).map((s) => (
                        <option key={s} value={s}>
                          Semester {s}
                        </option>
                      ))}
                    </Field>
                  </div>
                  <div>
                    <label className={labelCls}>Academic Year *</label>
                    <AsyncSelect
                      type="academicYears"
                      value={values.academicYear || null}
                      onChange={(value) => setFieldValue('academicYear', value ?? '')}
                      placeholder="Select academic year"
                      required
                    />
                    <ErrorMessage name="academicYear">
                      {(m) => <p className="mt-1 text-xs text-red-500">{m}</p>}
                    </ErrorMessage>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>Category *</label>
                    <Field as="select" name="category" className={inputCls}>
                      <option value="General">General</option>
                      <option value="SC">SC</option>
                      <option value="ST">ST</option>
                      <option value="OBC">OBC</option>
                      <option value="EWS">EWS</option>
                      <option value="Lateral Entry">Lateral Entry</option>
                    </Field>
                  </div>
                  <div>
                    <label className={labelCls}>Due Date *</label>
                    <Field type="date" name="dueDate" className={inputCls} />
                    <ErrorMessage name="dueDate">
                      {(m) => <p className="mt-1 text-xs text-red-500">{m}</p>}
                    </ErrorMessage>
                  </div>
                </div>
              </div>

              {/* SECTION 3: Live Structure Match & Preview */}
              {preview && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-primary/20 bg-primary-50/40 p-5 space-y-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <span className="inline-flex items-center rounded-md bg-secondary-50 px-2 py-1 text-xs font-semibold text-secondary">
                        Matched Structure
                      </span>
                      <p className="mt-1 text-base font-bold text-slate-900">
                        {preview.studentContext.program} · {preview.studentContext.branch} (Sem{' '}
                        {preview.studentContext.semester})
                      </p>
                      <p className="text-xs text-slate-500">
                        Year: {preview.studentContext.academicYear} · Category:{' '}
                        {preview.studentContext.category}
                      </p>
                      {preview.existingInvoice && (
                        <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                          Existing invoice detected: {preview.existingInvoice.invoiceNumber} (
                          {preview.existingInvoice.status})
                        </p>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-3 rounded-xl bg-white p-3 text-right ">
                      <div>
                        <p className="text-[10px] text-slate-600 uppercase">Gross Fee</p>
                        <p className="text-sm font-bold text-slate-800">
                          ₹{preview.grossAmount.toLocaleString('en-IN')}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-600 uppercase">Scholarship</p>
                        <p className="text-sm font-bold text-emerald-600">
                          -₹{preview.scholarshipTotal.toLocaleString('en-IN')}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-600 uppercase">Net Due</p>
                        <p className="text-base font-extrabold text-primary">
                          ₹{preview.netDue.toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100 bg-white">
                    {preview.structure.feeItems.map((item, idx) => (
                      <div
                        key={`${item.type}-${idx}`}
                        className="flex items-center justify-between px-4 py-2.5"
                      >
                        <div>
                          <p className="text-xs font-semibold text-slate-700">{item.type}</p>
                          {item.description && (
                            <p className="text-[11px] text-slate-600">{item.description}</p>
                          )}
                        </div>
                        <p className="text-xs font-bold text-slate-800">
                          ₹{Number(item.amount || 0).toLocaleString('en-IN')}
                        </p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-end  gap-5">
                <CustomButton
                  type="button"
                  variant="secondary"
                  loading={previewing}
                  loadingText="Checking structure..."
                  startIcon={<Eye className="h-4 w-4" />}
                  onClick={() => handlePreview(values)}
                >
                  Preview Matching Structure
                </CustomButton>
                <CustomButton
                  type="submit"
                  loading={generating}
                  disabled={preview?.existingInvoice ? true : undefined}
                  loadingText="Generating Invoice..."
                  startIcon={<FileText className="h-4 w-4" />}
                >
                  Generate & Download Invoice
                </CustomButton>
              </div>
            </Form>
          );
        }}
      </Formik>
    </div>
  );
}
