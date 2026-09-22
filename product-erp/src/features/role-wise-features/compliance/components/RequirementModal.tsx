'use client';

import CustomButton from '@/shared/core/CustomButton';
import AsyncSelect from '@/shared/core/AsyncSelect';
import useMutation from '@/shared/hooks/useMutation';
import { AnimatePresence, motion } from '@/shared/utils/motion';
import { Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'react-toastify';
import type { IRequirementField, TFramework } from '../types/compliance.types';

interface IProps {
  open: boolean;
  framework: TFramework;
  onClose: () => void;
  onSaved: () => void;
}

export default function RequirementModal({ open, framework, onClose, onSaved }: IProps) {
  const { mutation, isLoading } = useMutation();
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState('annual');
  const [targetValue, setTargetValue] = useState('');
  const [unit, setUnit] = useState('');
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [ownerIds, setOwnerIds] = useState<string[]>([]);
  const [reviewerIds, setReviewerIds] = useState<string[]>([]);
  const [dueMonth, setDueMonth] = useState('');
  const [evidenceValidityDays, setEvidenceValidityDays] = useState('365');
  const [fields, setFields] = useState<IRequirementField[]>([
    { key: '', label: '', type: 'text', required: true },
  ]);

  const updateField = (index: number, next: Partial<IRequirementField>) =>
    setFields((current) =>
      current.map((field, fieldIndex) => (fieldIndex === index ? { ...field, ...next } : field)),
    );

  const save = async () => {
    if (!code.trim() || !title.trim() || !category.trim()) {
      toast.error('Code, title and category are required');
      return;
    }
    const validFields = fields
      .filter((field) => field.label.trim())
      .map((field) => ({
        ...field,
        key:
          field.key.trim() ||
          field.label
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_|_$/g, ''),
      }));
    const response = await mutation('compliance-workspace/requirements', {
      method: 'POST',
      body: {
        framework,
        code,
        title,
        category,
        description,
        frequency,
        targetValue: targetValue ? Number(targetValue) : undefined,
        unit,
        departmentIds,
        ownerIds,
        reviewerIds,
        dueMonth: dueMonth ? Number(dueMonth) : undefined,
        evidenceValidityDays: evidenceValidityDays ? Number(evidenceValidityDays) : undefined,
        requiredFields: validFields,
      },
    });
    if (!response?.results?.success) return;
    toast.success('Compliance requirement created');
    onSaved();
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-200/80 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="max-h-[90dvh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-primary">
                  Dynamic standard
                </p>
                <h2 className="mt-1 text-xl font-black text-slate-900">
                  Add {framework.toUpperCase()} requirement
                </h2>
              </div>
              <button onClick={onClose} className="rounded-full bg-slate-100 p-2 text-slate-500">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm font-semibold text-slate-700">
                <span>Requirement code *</span>
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="e.g. AICTE-LAB"
                  className="w-full rounded-xl bg-slate-100 px-4 py-3 font-normal outline-none"
                />
              </label>
              <label className="space-y-1.5 text-sm font-semibold text-slate-700">
                <span>Category *</span>
                <input
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  placeholder="Infrastructure"
                  className="w-full rounded-xl bg-slate-100 px-4 py-3 font-normal outline-none"
                />
              </label>
              <label className="space-y-1.5 text-sm font-semibold text-slate-700 sm:col-span-2">
                <span>Title *</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="w-full rounded-xl bg-slate-100 px-4 py-3 font-normal outline-none"
                />
              </label>
              <label className="space-y-1.5 text-sm font-semibold text-slate-700 sm:col-span-2">
                <span>Description</span>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="w-full resize-none rounded-xl bg-slate-100 px-4 py-3 font-normal outline-none"
                />
              </label>
              <label className="space-y-1.5 text-sm font-semibold text-slate-700">
                <span>Frequency</span>
                <select
                  value={frequency}
                  onChange={(event) => setFrequency(event.target.value)}
                  className="w-full rounded-xl bg-slate-100 px-4 py-3 font-normal outline-none"
                >
                  <option value="once">Once</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="half_yearly">Half-yearly</option>
                  <option value="annual">Annual</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1.5 text-sm font-semibold text-slate-700">
                  <span>Target</span>
                  <input
                    type="number"
                    value={targetValue}
                    onChange={(event) => setTargetValue(event.target.value)}
                    className="w-full rounded-xl bg-slate-100 px-4 py-3 font-normal outline-none"
                  />
                </label>
                <label className="space-y-1.5 text-sm font-semibold text-slate-700">
                  <span>Unit</span>
                  <input
                    value={unit}
                    onChange={(event) => setUnit(event.target.value)}
                    placeholder="%"
                    className="w-full rounded-xl bg-slate-100 px-4 py-3 font-normal outline-none"
                  />
                </label>
              </div>
              <AsyncSelect
                type="departments"
                label="Applicable departments"
                multiple
                value={departmentIds}
                onChange={(values) => setDepartmentIds(values)}
                placeholder="All departments"
              />
              <label className="space-y-1.5 text-sm font-semibold text-slate-700">
                <span>Evidence due month</span>
                <select
                  value={dueMonth}
                  onChange={(event) => setDueMonth(event.target.value)}
                  className="w-full rounded-xl bg-slate-100 px-4 py-3 font-normal outline-none"
                >
                  <option value="">No fixed month</option>
                  {[
                    'January',
                    'February',
                    'March',
                    'April',
                    'May',
                    'June',
                    'July',
                    'August',
                    'September',
                    'October',
                    'November',
                    'December',
                  ].map((month, index) => (
                    <option key={month} value={index + 1}>
                      {month}
                    </option>
                  ))}
                </select>
              </label>
              <AsyncSelect
                type="users"
                label="Evidence owners"
                multiple
                value={ownerIds}
                onChange={(values) => setOwnerIds(values)}
                placeholder="Assign responsible users"
              />
              <AsyncSelect
                type="users"
                label="Independent reviewers"
                multiple
                value={reviewerIds}
                onChange={(values) => setReviewerIds(values)}
                placeholder="Assign reviewers"
              />
              <label className="space-y-1.5 text-sm font-semibold text-slate-700">
                <span>Evidence validity (days)</span>
                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={evidenceValidityDays}
                  onChange={(event) => setEvidenceValidityDays(event.target.value)}
                  className="w-full rounded-xl bg-slate-100 px-4 py-3 font-normal outline-none"
                />
              </label>
            </div>
            <div className="mt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-black text-slate-900">Submission fields</h3>
                  <p className="text-xs text-slate-500">
                    Define the form users complete for this requirement.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setFields((current) => [
                      ...current,
                      { key: '', label: '', type: 'text', required: false },
                    ])
                  }
                  className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  <Plus className="h-4 w-4" />
                  Add field
                </button>
              </div>
              <div className="mt-3 space-y-3">
                {fields.map((field, index) => (
                  <div
                    key={index}
                    className="grid gap-3 rounded-2xl bg-slate-50 p-3 sm:grid-cols-[1fr_150px_100px_40px]"
                  >
                    <input
                      value={field.label}
                      onChange={(event) => updateField(index, { label: event.target.value })}
                      placeholder="Field label"
                      className="rounded-xl bg-white px-3 py-2.5 text-sm outline-none"
                    />
                    <select
                      value={field.type}
                      onChange={(event) =>
                        updateField(index, {
                          type: event.target.value as IRequirementField['type'],
                        })
                      }
                      className="rounded-xl bg-white px-3 py-2.5 text-sm outline-none"
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                      <option value="boolean">Yes / No</option>
                    </select>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(event) => updateField(index, { required: event.target.checked })}
                      />{' '}
                      Required
                    </label>
                    <button
                      onClick={() =>
                        setFields((current) =>
                          current.filter((_, fieldIndex) => fieldIndex !== index),
                        )
                      }
                      className="rounded-xl bg-red-50 text-red-500"
                    >
                      <Trash2 className="mx-auto h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="min-h-10 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <CustomButton variant="primary" onClick={save} loading={isLoading}>
                Create requirement
              </CustomButton>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
