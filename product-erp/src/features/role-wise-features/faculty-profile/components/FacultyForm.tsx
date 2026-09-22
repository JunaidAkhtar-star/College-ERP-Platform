'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import { ArrowLeft, User, Phone, Briefcase, BookOpen, Award, Check, Save } from 'lucide-react';
import { motion } from '@/shared/utils/motion';
import CustomButton from '@/shared/core/CustomButton';
import AsyncSelect from '@/shared/core/AsyncSelect';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import type { IFacultyProfile } from '../types/faculty-profile.types';

interface IFacultyFormInit extends Partial<IFacultyProfile> {
  joiningType?: string;
  disabilityDetails?: string;
  highestQualificationInstitution?: string;
  highestQualificationPassingYear?: string | number;
  passportExpiryDate?: string;
  dateOfJoining?: string;
}

const DESIGNATIONS = [
  { value: 'assistant_professor', label: 'Assistant Professor' },
  { value: 'associate_professor', label: 'Associate Professor' },
  { value: 'professor', label: 'Professor' },
  { value: 'head_of_department', label: 'Head of Department' },
  { value: 'dean', label: 'Dean' },
  { value: 'principal', label: 'Principal' },
  { value: 'vice_principal', label: 'Vice Principal' },
  { value: 'lecturer', label: 'Lecturer' },
  { value: 'junior_lecturer', label: 'Junior Lecturer' },
  { value: 'lab_instructor', label: 'Lab Instructor' },
  { value: 'demonstrator', label: 'Demonstrator' },
  { value: 'registrar', label: 'Registrar' },
  { value: 'admin_officer', label: 'Admin Officer' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'librarian', label: 'Librarian' },
  { value: 'programmer', label: 'Programmer' },
  { value: 'system_analyst', label: 'System Analyst' },
  { value: 'office_staff', label: 'Office Staff' },
  { value: 'lab_technician', label: 'Lab Technician' },
  { value: 'peon', label: 'Peon' },
];

const QUALIFICATIONS = [
  { value: 'phd', label: 'PhD' },
  { value: 'me_mtech', label: 'ME / M.Tech' },
  { value: 'be_btech', label: 'BE / B.Tech' },
  { value: 'mba', label: 'MBA' },
  { value: 'mca', label: 'MCA' },
  { value: 'msc', label: 'M.Sc' },
  { value: 'bsc', label: 'B.Sc' },
  { value: 'ma', label: 'MA' },
  { value: 'ba', label: 'BA' },
  { value: 'diploma', label: 'Diploma' },
  { value: 'other', label: 'Other' },
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-600 focus:border-primary focus:bg-white focus:outline-none transition-colors';

function toNumberOrUndefined(value: unknown) {
  if (value === '' || value === null || value === undefined) return undefined;
  const numberValue = Number(value);
  return Number.isNaN(numberValue) ? undefined : numberValue;
}

function emptyAddress(address: object) {
  return Object.values(address).every((value) => value === '' || value === undefined);
}

function cleanEmptyStrings<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => cleanEmptyStrings(item)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, item]) => [key, cleanEmptyStrings(item)])
        .filter(([, item]) => item !== ''),
    ) as T;
  }
  return value;
}

export default function FacultyForm({
  initial,
  onClose,
  onSaved,
}: {
  initial?: Partial<IFacultyProfile>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mutation, isLoading } = useMutation();
  const { data: rawDept } = useSwr('department');
  const departments = useMemo(() => {
    return (rawDept as { data?: { _id: string; name: string }[] })?.data ?? [];
  }, [rawDept]);

  const isEdit = !!initial?._id;

  const [step, setStep] = useState(0);

  const stepSchemas = useMemo(
    () => [
      // Step 0: Personal Details
      Yup.object({
        firstName: Yup.string().required('Required'),
        lastName: Yup.string().required('Required'),
        gender: Yup.string().required('Required'),
        dateOfBirth: Yup.string().required('Required'),
        category: Yup.string().required('Required'),
        joiningType: Yup.string().required('Required'),
      }),
      // Step 1: Contact & Address
      Yup.object({
        phone: Yup.string().required('Required'),
        collegeEmail: Yup.string().email().required('Required'),
        permanentAddress: Yup.object({
          line1: Yup.string().required('Required'),
          city: Yup.string().required('Required'),
          district: Yup.string().required('Required'),
          state: Yup.string().required('Required'),
          pincode: Yup.string().required('Required'),
          country: Yup.string().required('Required'),
        }),
      }),
      // Step 2: Employment Details
      Yup.object({
        designation: Yup.string().required('Required'),
        department: Yup.string().required('Required'),
        dateOfJoining: Yup.string().required('Required'),
        employmentType: Yup.string().required('Required'),
      }),
      // Step 3: Academic Qualifications
      Yup.object({
        highestQualification: Yup.string().required('Required'),
        highestQualificationSpecialization: Yup.string().trim().required('Required'),
      }),
      // Step 4: Research, Roles & Additional
      Yup.object({}),
    ],
    [],
  );

  const init = initial as IFacultyFormInit | undefined;

  const formik = useFormik({
    initialValues: {
      firstName: init?.firstName ?? '',
      middleName: init?.middleName ?? '',
      lastName: init?.lastName ?? '',
      gender: init?.gender ?? '',
      dateOfBirth: init?.dateOfBirth ? new Date(init.dateOfBirth).toISOString().split('T')[0] : '',
      bloodGroup: init?.bloodGroup ?? '',
      religion: init?.religion ?? '',
      category: init?.category ?? '',
      joiningType: init?.joiningType ?? '',
      maritalStatus: init?.maritalStatus ?? '',
      spouseName: init?.spouseName ?? '',
      spouseOccupation: init?.spouseOccupation ?? '',
      numberOfChildren: init?.numberOfChildren ?? '',
      motherTongue: init?.motherTongue ?? '',
      passportNumber: init?.passportNumber ?? '',
      passportExpiryDate: init?.passportExpiryDate
        ? new Date(init.passportExpiryDate).toISOString().split('T')[0]
        : '',
      isPhysicallyChallenged: init?.isPhysicallyChallenged ?? false,
      disabilityDetails: init?.disabilityDetails ?? '',

      phone: init?.phone ?? '',
      alternatePhone: init?.alternatePhone ?? '',
      collegeEmail: init?.collegeEmail ?? '',
      personalEmail: init?.personalEmail ?? '',
      permanentAddress: {
        line1: init?.permanentAddress?.line1 ?? '',
        line2: init?.permanentAddress?.line2 ?? '',
        city: init?.permanentAddress?.city ?? '',
        district: init?.permanentAddress?.district ?? '',
        state: init?.permanentAddress?.state ?? '',
        pincode: init?.permanentAddress?.pincode ?? '',
        country: init?.permanentAddress?.country ?? '',
      },
      currentAddress: {
        line1: init?.currentAddress?.line1 ?? '',
        line2: init?.currentAddress?.line2 ?? '',
        city: init?.currentAddress?.city ?? '',
        district: init?.currentAddress?.district ?? '',
        state: init?.currentAddress?.state ?? '',
        pincode: init?.currentAddress?.pincode ?? '',
        country: init?.currentAddress?.country ?? '',
      },

      employeeId: init?.employeeId ?? '',
      designation: init?.designation ?? '',
      assignedRole:
        (init as { assignedRole?: string })?.assignedRole ??
        (init?.joiningType === 'non_teaching' ? 'hr_department' : 'faculty'),
      department:
        typeof init?.department === 'object'
          ? (init.department as Record<string, unknown>)?._id
          : (init?.department ?? ''),
      dateOfJoining:
        init?.joiningDate || init?.dateOfJoining
          ? new Date(init.joiningDate ?? init.dateOfJoining!).toISOString().split('T')[0]
          : '',
      employmentType: init?.employmentType ?? '',
      biometricId: init?.biometricId ?? '',
      epfUan: init?.epfUan ?? '',
      esiNumber: init?.esiNumber ?? '',
      panNumber: init?.panNumber ?? '',

      highestQualification: init?.highestQualification ?? '',
      highestQualificationSpecialization:
        init?.specialization ?? init?.highestQualificationSpecialization ?? '',
      highestQualificationInstitution: init?.highestQualificationInstitution ?? '',
      highestQualificationPassingYear: init?.highestQualificationPassingYear ?? '',
      totalTeachingExperienceYears: init?.totalTeachingExperienceYears ?? '',
      totalIndustryExperienceYears: init?.totalIndustryExperienceYears ?? '',

      additionalResponsibilities: init?.additionalResponsibilities?.join(', ') ?? '',
      committeeMemberships: init?.committeeMemberships?.join(', ') ?? '',
    },
    validationSchema: stepSchemas[step],
    onSubmit: async (values) => {
      const { dateOfJoining, highestQualificationSpecialization, ...canonicalValues } = values;
      const profileValues = {
        ...canonicalValues,
        category: values.category.toLowerCase(),
        dateOfBirth: values.dateOfBirth || undefined,
        passportExpiryDate: values.passportExpiryDate || undefined,
        joiningDate: dateOfJoining || undefined,
        specialization: String(highestQualificationSpecialization ?? '').trim() || undefined,
        numberOfChildren: toNumberOrUndefined(values.numberOfChildren),
        highestQualificationPassingYear: toNumberOrUndefined(
          values.highestQualificationPassingYear,
        ),
        totalTeachingExperienceYears: toNumberOrUndefined(values.totalTeachingExperienceYears),
        totalIndustryExperienceYears: toNumberOrUndefined(values.totalIndustryExperienceYears),
        currentAddress: emptyAddress(values.currentAddress) ? undefined : values.currentAddress,
        additionalResponsibilities: values.additionalResponsibilities
          .split(',')
          .map((item: string) => item.trim())
          .filter(Boolean),
        committeeMemberships: values.committeeMemberships
          .split(',')
          .map((item: string) => item.trim())
          .filter(Boolean),
      };
      const cleanedProfileValues = cleanEmptyStrings(profileValues);
      let res;
      if (isEdit) {
        res = await mutation(`faculty-profile/${initial!._id}`, {
          method: 'PUT',
          body: {
            ...cleanedProfileValues,
            assignedRole: values.assignedRole,
          },
          isAlert: true,
        });
      } else {
        const payload = {
          joiningType: values.joiningType,
          name: `${values.firstName} ${values.middleName} ${values.lastName}`
            .replace(/\s+/g, ' ')
            .trim(),
          email: values.collegeEmail,
          phone: values.phone,
          roles: [
            values.assignedRole ||
              (values.joiningType === 'non_teaching' ? 'hr_department' : 'faculty'),
          ],
          departmentId: values.department,
          profile: {
            ...cleanedProfileValues,
          },
        };
        res = await mutation('faculty-onboarding', {
          method: 'POST',
          body: payload,
          isAlert: true,
        });
      }

      const success =
        (res as { success?: boolean })?.success ||
        (res as { results?: { success?: boolean } })?.results?.success;

      if (success) {
        toast.success(isEdit ? 'Profile updated' : 'Faculty onboarded — invite email sent');
        onSaved();
        onClose();
      } else {
        toast.error('Failed to save');
      }
    },
  });

  // Fetch active draft from backend if not editing
  const { data: activeDraft } = useSwr(!isEdit ? 'faculty-onboarding/draft' : null);

  useEffect(() => {
    if (activeDraft) {
      const { step: savedStep, draftData } = activeDraft as {
        step: number;
        draftData: Record<string, unknown>;
      };
      if (draftData && Object.keys(draftData).length > 0) {
        formik.setValues({ ...formik.values, ...draftData });
        setTimeout(() => {
          setStep(savedStep);
        }, 0);
        toast.info('Restored onboarding draft');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDraft]);

  // Debounced backend draft save
  useEffect(() => {
    if (isEdit) return;

    const timer = setTimeout(async () => {
      await mutation('faculty-onboarding/draft', {
        method: 'POST',
        body: { step, draftData: formik.values },
        dedupe: false,
      });
    }, 1000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formik.values, step, isEdit]);

  const err = (k: string) => {
    const meta = formik.getFieldMeta(k);
    return meta.touched && meta.error ? (
      <p className="mt-1 text-xs text-red-500">{meta.error}</p>
    ) : null;
  };

  const STEPS = [
    {
      label: 'Personal',
      description: 'Identity and personal background',
      icon: <User className="h-4 w-4" />,
    },
    {
      label: 'Contact',
      description: 'Communication and addresses',
      icon: <Phone className="h-4 w-4" />,
    },
    {
      label: 'Employment',
      description: 'Official assignment and payroll references',
      icon: <Briefcase className="h-4 w-4" />,
    },
    {
      label: 'Academic',
      description: 'Qualification and prior experience',
      icon: <BookOpen className="h-4 w-4" />,
    },
    {
      label: 'Responsibilities',
      description: 'Governance roles and final review',
      icon: <Award className="h-4 w-4" />,
    },
  ];

  const handleNext = async () => {
    const errors = await formik.validateForm();
    if (Object.keys(errors).length > 0) {
      const touched: Record<string, unknown> = {};
      const markTouched = (obj: unknown, prefix = '') => {
        if (!obj || typeof obj !== 'object') return;
        for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
          const path = prefix ? `${prefix}.${k}` : k;
          if (v && typeof v === 'object' && !Array.isArray(v)) {
            markTouched(v, path);
          } else {
            const parts = path.split('.');
            let cur: Record<string, unknown> = touched;
            for (let i = 0; i < parts.length - 1; i++) {
              const p = parts[i];
              const next = cur[p];
              if (!next || typeof next !== 'object') cur[p] = {};
              cur = cur[p] as Record<string, unknown>;
            }
            cur[parts[parts.length - 1]] = true;
          }
        }
      };
      markTouched(errors);
      formik.setTouched(touched as never);
      return;
    }
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      formik.handleSubmit();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex min-h-[calc(100vh-10rem)] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white "
    >
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-7">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-lg font-bold text-slate-900 sm:text-xl">
              {isEdit ? 'Edit Faculty Profile' : 'Add New Faculty'}
            </h3>
            <span className="hidden rounded-full bg-primary-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary sm:inline-flex">
              {isEdit ? 'Profile update' : 'Guided onboarding'}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
            {isEdit
              ? 'Review and update the faculty member’s authoritative record.'
              : 'Create the login, employment assignment and academic profile in one flow.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 transition hover:border-primary/30 hover:bg-primary-50 hover:text-primary"
          aria-label="Back to faculty management"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleNext();
        }}
        className="flex flex-col overflow-hidden flex-1"
      >
        {/* Step Indicator */}
        <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-4 sm:px-7">
          <div className="flex items-start justify-between">
            {STEPS.map((s, i) => (
              <React.Fragment key={s.label}>
                <button
                  type="button"
                  onClick={() => i < step && setStep(i)}
                  className={`group flex min-w-0 flex-col items-center gap-1.5 ${i < step ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold  transition-all ${
                      i === step
                        ? 'bg-primary text-white ring-2 ring-primary ring-offset-2'
                        : i < step
                          ? 'bg-secondary text-white'
                          : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {i < step ? <Check className="h-3.5 w-3.5" /> : s.icon}
                  </div>
                  <span
                    className={`hidden text-xs font-semibold md:block ${
                      i === step ? 'text-primary' : i < step ? 'text-secondary' : 'text-slate-600'
                    }`}
                  >
                    {s.label}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <div
                    className={`mx-2 mt-4.5 h-0.5 flex-1 transition-colors sm:mx-4 ${
                      i < step ? 'bg-secondary' : 'bg-slate-100'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Form Body */}
        <div className="flex-1 space-y-6 overflow-y-auto bg-slate-50/40 p-4 sm:p-7">
          {step === 0 && (
            <div className="mx-auto max-w-6xl space-y-6 rounded-2xl border border-slate-200 bg-white p-5  sm:p-6">
              <div>
                <h4 className="text-base font-bold text-slate-800">Identity Details</h4>
                <p className="mt-1 text-xs text-slate-500">
                  Legal name and identity information used in institutional records.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    First Name *
                  </label>
                  <input {...formik.getFieldProps('firstName')} className={inputCls} />
                  {err('firstName')}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Middle Name
                  </label>
                  <input {...formik.getFieldProps('middleName')} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Last Name *
                  </label>
                  <input {...formik.getFieldProps('lastName')} className={inputCls} />
                  {err('lastName')}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Gender *
                  </label>
                  <select {...formik.getFieldProps('gender')} className={inputCls}>
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                  {err('gender')}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Date of Birth *
                  </label>
                  <input
                    type="date"
                    {...formik.getFieldProps('dateOfBirth')}
                    className={inputCls}
                  />
                  {err('dateOfBirth')}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Blood Group
                  </label>
                  <select {...formik.getFieldProps('bloodGroup')} className={inputCls}>
                    <option value="">Select</option>
                    {BLOOD_GROUPS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="border-t border-slate-100 pt-5">
                <h4 className="text-base font-bold text-slate-800">Background & Joining</h4>
                <p className="mt-1 text-xs text-slate-500">
                  Social category and the type of faculty onboarding.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Religion
                  </label>
                  <input {...formik.getFieldProps('religion')} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Category *
                  </label>
                  <select {...formik.getFieldProps('category')} className={inputCls}>
                    <option value="">Select</option>
                    {[
                      { value: 'general', label: 'General' },
                      { value: 'obc', label: 'OBC' },
                      { value: 'sc', label: 'SC' },
                      { value: 'st', label: 'ST' },
                      { value: 'sebc', label: 'SEBC' },
                      { value: 'ph', label: 'Physically Handicapped' },
                    ].map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                  {err('category')}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Marital Status
                  </label>
                  <select {...formik.getFieldProps('maritalStatus')} className={inputCls}>
                    <option value="">Select</option>
                    {['single', 'married', 'divorced', 'widowed'].map((m) => (
                      <option key={m} value={m} className="capitalize">
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Joining Type *
                  </label>
                  <select {...formik.getFieldProps('joiningType')} className={inputCls}>
                    <option value="">Select</option>
                    <option value="new">New Candidate</option>
                    <option value="existing">Existing Staff</option>
                  </select>
                  {err('joiningType')}
                </div>
              </div>
              <div className="border-t border-slate-100 pt-5">
                <h4 className="text-base font-bold text-slate-800">Family & Travel Documents</h4>
                <p className="mt-1 text-xs text-slate-500">
                  Optional family and passport information for HR records.
                </p>
              </div>
              {formik.values.maritalStatus === 'married' && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600">
                      Spouse Name
                    </label>
                    <input {...formik.getFieldProps('spouseName')} className={inputCls} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600">
                      Spouse Occupation
                    </label>
                    <input {...formik.getFieldProps('spouseOccupation')} className={inputCls} />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Number of Children
                  </label>
                  <input
                    {...formik.getFieldProps('numberOfChildren')}
                    className={inputCls}
                    type="number"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Mother Tongue
                  </label>
                  <input {...formik.getFieldProps('motherTongue')} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Passport Number
                  </label>
                  <input {...formik.getFieldProps('passportNumber')} className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Passport Expiry Date
                  </label>
                  <input
                    {...formik.getFieldProps('passportExpiryDate')}
                    className={inputCls}
                    type="date"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <input
                  type="checkbox"
                  id="isPhysicallyChallenged"
                  checked={formik.values.isPhysicallyChallenged}
                  onChange={(e) => formik.setFieldValue('isPhysicallyChallenged', e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                />
                <label
                  htmlFor="isPhysicallyChallenged"
                  className="text-sm font-semibold text-slate-700"
                >
                  Physically Challenged
                </label>
              </div>
              {formik.values.isPhysicallyChallenged && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Disability Details
                  </label>
                  <textarea
                    {...formik.getFieldProps('disabilityDetails')}
                    className={inputCls}
                    rows={2}
                  />
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="mx-auto max-w-6xl space-y-6 rounded-2xl border border-slate-200 bg-white p-5  sm:p-6">
              <div className="space-y-4">
                <div>
                  <h4 className="text-base font-bold text-slate-800">Contact Channels</h4>
                  <p className="mt-1 text-xs text-slate-500">
                    Primary institutional contact and optional personal contact details.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600">
                      Mobile Phone *
                    </label>
                    <input {...formik.getFieldProps('phone')} className={inputCls} />
                    {err('phone')}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600">
                      Alternate Phone
                    </label>
                    <input {...formik.getFieldProps('alternatePhone')} className={inputCls} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600">
                      College Email *
                    </label>
                    <input
                      type="email"
                      {...formik.getFieldProps('collegeEmail')}
                      className={inputCls}
                    />
                    {err('collegeEmail')}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600">
                      Personal Email
                    </label>
                    <input
                      type="email"
                      {...formik.getFieldProps('personalEmail')}
                      className={inputCls}
                    />
                    {err('personalEmail')}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 pt-2 lg:grid-cols-2">
                <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <h4 className="text-sm font-semibold text-slate-700">Permanent Address</h4>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600">
                      Line 1 *
                    </label>
                    <input
                      {...formik.getFieldProps('permanentAddress.line1')}
                      className={inputCls}
                    />
                    {err('permanentAddress.line1')}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600">
                      Line 2
                    </label>
                    <input
                      {...formik.getFieldProps('permanentAddress.line2')}
                      className={inputCls}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-600">
                        City *
                      </label>
                      <input
                        {...formik.getFieldProps('permanentAddress.city')}
                        className={inputCls}
                      />
                      {err('permanentAddress.city')}
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-600">
                        District *
                      </label>
                      <input
                        {...formik.getFieldProps('permanentAddress.district')}
                        className={inputCls}
                      />
                      {err('permanentAddress.district')}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                      <label className="mb-1.5 block text-xs font-medium text-slate-600">
                        State *
                      </label>
                      <input
                        {...formik.getFieldProps('permanentAddress.state')}
                        className={inputCls}
                      />
                      {err('permanentAddress.state')}
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-600">
                        Pincode *
                      </label>
                      <input
                        {...formik.getFieldProps('permanentAddress.pincode')}
                        className={inputCls}
                      />
                      {err('permanentAddress.pincode')}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600">
                      Country *
                    </label>
                    <input
                      {...formik.getFieldProps('permanentAddress.country')}
                      className={inputCls}
                    />
                    {err('permanentAddress.country')}
                  </div>
                </div>

                <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-700">Current Address</h4>
                    <button
                      type="button"
                      onClick={() =>
                        formik.setFieldValue('currentAddress', {
                          ...formik.values.permanentAddress,
                        })
                      }
                      className="text-xs text-primary font-medium hover:underline"
                    >
                      Same as Permanent
                    </button>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600">
                      Line 1
                    </label>
                    <input {...formik.getFieldProps('currentAddress.line1')} className={inputCls} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600">
                      Line 2
                    </label>
                    <input {...formik.getFieldProps('currentAddress.line2')} className={inputCls} />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-600">
                        City
                      </label>
                      <input
                        {...formik.getFieldProps('currentAddress.city')}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-600">
                        District
                      </label>
                      <input
                        {...formik.getFieldProps('currentAddress.district')}
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                      <label className="mb-1.5 block text-xs font-medium text-slate-600">
                        State
                      </label>
                      <input
                        {...formik.getFieldProps('currentAddress.state')}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-600">
                        Pincode
                      </label>
                      <input
                        {...formik.getFieldProps('currentAddress.pincode')}
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600">
                      Country
                    </label>
                    <input
                      {...formik.getFieldProps('currentAddress.country')}
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="mx-auto max-w-6xl space-y-4 rounded-2xl border border-slate-200 bg-white p-5  sm:p-6">
              <div>
                <h4 className="text-base font-bold text-slate-800">Official Assignment</h4>
                <p className="mt-1 text-xs text-slate-500">
                  Department, designation, employment type and joining information.
                </p>
              </div>
              {isEdit && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Faculty/Employee ID
                  </label>
                  <input {...formik.getFieldProps('employeeId')} className={inputCls} disabled />
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Designation *
                  </label>
                  <select {...formik.getFieldProps('designation')} className={inputCls}>
                    <option value="">Select</option>
                    {DESIGNATIONS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                  {err('designation')}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Department *
                  </label>
                  <select {...formik.getFieldProps('department')} className={inputCls}>
                    <option value="">Select</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  {err('department')}
                </div>
                <div>
                  <AsyncSelect
                    label="Assigned System Role *"
                    type="roles"
                    required
                    params={{ category: formik.values.joiningType }}
                    value={formik.values.assignedRole}
                    onChange={(v) => formik.setFieldValue('assignedRole', v ?? '')}
                    placeholder="Select role"
                  />
                  {err('assignedRole')}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Date of Joining *
                  </label>
                  <input
                    type="date"
                    {...formik.getFieldProps('dateOfJoining')}
                    className={inputCls}
                  />
                  {err('dateOfJoining')}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Employment Type *
                  </label>
                  <select {...formik.getFieldProps('employmentType')} className={inputCls}>
                    <option value="">Select</option>
                    <option value="permanent">Permanent</option>
                    <option value="contractual">Contractual</option>
                    <option value="visiting">Visiting</option>
                    <option value="adhoc">Ad-hoc</option>
                    <option value="guest_faculty">Guest Faculty</option>
                  </select>
                  {err('employmentType')}
                </div>
              </div>
              <div className="border-t border-slate-100 pt-5">
                <h4 className="text-base font-bold text-slate-800">
                  Statutory & Payroll References
                </h4>
                <p className="mt-1 text-xs text-slate-500">
                  Optional identifiers used by attendance, payroll and compliance teams.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Biometric Ref ID
                  </label>
                  <input {...formik.getFieldProps('biometricId')} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">EPF UAN</label>
                  <input {...formik.getFieldProps('epfUan')} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    ESI Number
                  </label>
                  <input {...formik.getFieldProps('esiNumber')} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  PAN Card Number
                </label>
                <input {...formik.getFieldProps('panNumber')} className={inputCls} />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="mx-auto max-w-6xl space-y-4 rounded-2xl border border-slate-200 bg-white p-5  sm:p-6">
              <div>
                <h4 className="text-base font-bold text-slate-800">Highest Qualification</h4>
                <p className="mt-1 text-xs text-slate-500">
                  Record the faculty member’s primary academic qualification.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Highest Qualification *
                  </label>
                  <select {...formik.getFieldProps('highestQualification')} className={inputCls}>
                    <option value="">Select</option>
                    {QUALIFICATIONS.map((q) => (
                      <option key={q.value} value={q.value}>
                        {q.label}
                      </option>
                    ))}
                  </select>
                  {err('highestQualification')}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Specialization *
                  </label>
                  <input
                    {...formik.getFieldProps('highestQualificationSpecialization')}
                    className={inputCls}
                    placeholder="e.g. Computer Science & Eng."
                  />
                  {err('highestQualificationSpecialization')}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Institution / College
                  </label>
                  <input
                    {...formik.getFieldProps('highestQualificationInstitution')}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Passing Year
                  </label>
                  <input
                    type="number"
                    {...formik.getFieldProps('highestQualificationPassingYear')}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-5">
                <h4 className="text-base font-bold text-slate-800">Prior Experience</h4>
                <p className="mt-1 text-xs text-slate-500">
                  Teaching and industry experience completed before joining.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Teaching Experience (Years)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    {...formik.getFieldProps('totalTeachingExperienceYears')}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Industry Experience (Years)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    {...formik.getFieldProps('totalIndustryExperienceYears')}
                    className={inputCls}
                  />
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="mx-auto max-w-6xl space-y-4 rounded-2xl border border-slate-200 bg-white p-5  sm:p-6">
              <div>
                <h4 className="text-base font-bold text-slate-800">
                  Governance & Responsibilities
                </h4>
                <p className="mt-1 text-xs text-slate-500">
                  Optional institutional duties, committees and coordination roles.
                </p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  Additional Responsibilities
                </label>
                <input
                  {...formik.getFieldProps('additionalResponsibilities')}
                  className={inputCls}
                  placeholder="e.g. Examination Incharge, Sports Coordinator (comma separated)"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  Committee Memberships
                </label>
                <input
                  {...formik.getFieldProps('committeeMemberships')}
                  className={inputCls}
                  placeholder="e.g. Anti-Ragging Cell, Placement Board (comma separated)"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-4  sm:px-7">
          <div className="hidden items-center text-xs font-medium text-slate-500 sm:flex">
            <span className="mr-2 rounded-full bg-slate-100 px-2 py-1 font-bold text-slate-700">
              {step + 1}/{STEPS.length}
            </span>
            {STEPS[step].description}
          </div>
          <div className="flex gap-3">
            {step > 0 && (
              <CustomButton variant="secondary" onClick={() => setStep((s) => s - 1)} type="button">
                Previous Step
              </CustomButton>
            )}
            <CustomButton variant="primary" type="button" onClick={handleNext} loading={isLoading}>
              {step < STEPS.length - 1 ? (
                `Continue to ${STEPS[step + 1].label}`
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  {isEdit ? 'Save Faculty Profile' : 'Create Faculty Account'}
                </span>
              )}
            </CustomButton>
          </div>
        </div>
      </form>
    </motion.div>
  );
}
