import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Verify Institution Document',
};

const DocumentVerificationPage = dynamic(
  () => import('@/features/public/document-verification/components/DocumentVerificationPage'),
);

export default function Page() {
  return <DocumentVerificationPage />;
}
