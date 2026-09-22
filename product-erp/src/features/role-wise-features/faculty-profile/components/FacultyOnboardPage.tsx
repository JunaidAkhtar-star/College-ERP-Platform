'use client';

import React, { useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useRouter } from 'nextjs-toploader/app';
import useSwr from '@/shared/hooks/useSwr';
import FacultyForm from './FacultyForm';
import FacultyHrWorkflowBar from '@/shared/components/FacultyHrWorkflowBar';

function FacultyOnboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const editId = searchParams.get('id');

  const {
    data: rawProfile,
    isLoading,
    error,
  } = useSwr(editId ? `faculty-profile/${editId}` : null);

  const profile = useMemo(() => {
    return (rawProfile as { data?: Record<string, unknown> })?.data;
  }, [rawProfile]);

  const parentPath = useMemo(() => {
    return pathname.replace(/\/onboard$/, '');
  }, [pathname]);

  const handleClose = () => {
    router.push(parentPath);
  };

  const handleSaved = () => {
    router.push(parentPath);
  };

  if (editId && isLoading) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (editId && error) {
    return (
      <div className="space-y-5">
        <FacultyHrWorkflowBar />
        <div role="alert" className="rounded-xl bg-red-50 p-5 text-sm text-red-700">
          This faculty profile could not be loaded, so no editable form has been opened.
          <button type="button" onClick={handleClose} className="ml-2 font-semibold underline">
            Return to faculty profiles
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full space-y-5">
      <FacultyHrWorkflowBar />
      <FacultyForm initial={profile} onClose={handleClose} onSaved={handleSaved} />
    </div>
  );
}

export default FacultyOnboardPage;
