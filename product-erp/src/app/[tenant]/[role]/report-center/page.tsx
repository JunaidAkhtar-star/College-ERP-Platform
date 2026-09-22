import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Report Center',
  description: 'Build and export governed institution reports.',
};
const ReportCenterPage = dynamic(
  () => import('@/features/role-wise-features/report-center/components/ReportCenterPage'),
);
export default function Page() {
  return <ReportCenterPage />;
}
