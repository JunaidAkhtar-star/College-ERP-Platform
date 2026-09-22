/**
 * @file ProcessLeadModal.tsx
 * @description Dialog form component to modify target demo qualified CRM indicators.
 * @module features/super-admin/components
 */

'use client';

import React from 'react';
import CustomButton from '@/shared/core/CustomButton';
import { ILead } from '../types/super-admin.types';

interface IProcessLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: ILead | null;
  onConfirm: (leadId: string, status: string, notes: string) => Promise<void>;
  muting: boolean;
}

export default function ProcessLeadModal({
  isOpen,
  onClose,
  lead,
  onConfirm,
  muting,
}: IProcessLeadModalProps) {
  if (!isOpen || !lead) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const statusEl = document.getElementById('leadStatus') as HTMLSelectElement;
    const notesEl = document.getElementById('leadNotes') as HTMLTextAreaElement;
    onConfirm(lead._id, statusEl.value, notesEl.value);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
        <h3 className="text-sm font-bold text-slate-800 mb-4">Process Demo Request</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-extrabold">
              College Candidate
            </p>
            <p className="text-sm font-semibold text-slate-800">{lead.collegeName}</p>
            <p className="text-xs text-slate-500">
              {lead.name} ({lead.designation})
            </p>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
              Demo Status
            </label>
            <select
              id="leadStatus"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-xs text-slate-800 outline-none focus:bg-white focus:border-blue-500 transition-all animate-none"
              defaultValue={lead.status}
            >
              <option value="pending">Pending</option>
              <option value="contacted">Contacted</option>
              <option value="converted">Converted</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
              Activity Notes / Next Actions
            </label>
            <textarea
              id="leadNotes"
              rows={4}
              placeholder="Record call logs, scheduling dates or trial comments here..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-800 outline-none focus:bg-white focus:border-blue-500 transition-all"
              defaultValue={lead.notes || ''}
            />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <CustomButton variant="cancel" size="small" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton type="submit" variant="primary" size="small" loading={muting}>
              Save Lead
            </CustomButton>
          </div>
        </form>
      </div>
    </div>
  );
}
