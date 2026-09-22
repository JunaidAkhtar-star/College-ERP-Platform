import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
export const metadata: Metadata = {
  title: 'Import & Migration Center',
  description: 'Safely validate and import institution data.',
};
const ImportCenterPage = dynamic(
  () => import('@/features/role-wise-features/import-center/components/ImportCenterPage'),
);
export default function Page() {
  return <ImportCenterPage />;
}
