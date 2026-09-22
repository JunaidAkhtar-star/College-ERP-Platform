import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Accreditation Reports | Institution ERP',
  description: 'Download governmental compliance CSV and spreadsheet templates.',
};

const AccreditationPage = dynamic(
  () => import('@/features/role-wise-features/accreditation/components/AccreditationPage'),
  { loading: () => null },
);

export default function Page() {
  return <AccreditationPage />;
}
