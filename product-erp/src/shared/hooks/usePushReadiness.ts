'use client';

import useSwr from './useSwr';

export interface IPushReadiness {
  provider: 'firebase';
  configured: boolean;
  enabled: boolean;
  tested: boolean;
  ready: boolean;
  status: 'not_configured' | 'configured' | 'healthy' | 'error';
  lastTestedAt?: string;
  reason?: string;
}

export function usePushReadiness() {
  const query = useSwr<{ success: boolean; data: IPushReadiness }>(
    'tenant-integrations/firebase/readiness',
  );
  return {
    ...query,
    readiness: query.data?.data,
    ready: query.data?.data?.ready === true,
  };
}
