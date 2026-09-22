'use client';

import { useState } from 'react';
import { toast } from 'react-toastify';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { useAdminPageContext } from '@/features/super-admin/context/AdminPageContext';
import LeadsTab from '@/features/super-admin/components/LeadsTab';
import ProcessLeadModal from '@/features/super-admin/components/ProcessLeadModal';
import type { ILead } from '@/features/super-admin/types/super-admin.types';

export default function LeadsPage() {
  const { searchQuery } = useAdminPageContext();
  const query = useSwr<{ data?: ILead[] }>('super-admin/leads');
  const { mutation, isLoading } = useMutation();
  const [selectedLead, setSelectedLead] = useState<ILead | null>(null);

  const updateLead = async (leadId: string, status: string, notes: string) => {
    const response = await mutation(`super-admin/leads/${leadId}`, {
      method: 'PATCH',
      body: { status, notes },
    });
    if (response?.results?.success) {
      toast.success('Lead processed successfully.');
      setSelectedLead(null);
      await query.mutate();
    }
  };

  return (
    <>
      <LeadsTab
        leads={query.data?.data ?? []}
        searchQuery={searchQuery}
        isLoading={query.isLoading}
        isValidating={query.isValidating}
        onRefresh={query.mutate}
        onProcess={setSelectedLead}
      />
      <ProcessLeadModal
        isOpen={Boolean(selectedLead)}
        onClose={() => setSelectedLead(null)}
        lead={selectedLead}
        onConfirm={updateLead}
        muting={isLoading}
      />
    </>
  );
}
