import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
export const metadata: Metadata = {
  title: 'Recruitment CRM | Devvelocity ERP',
  description: 'Prospect pipeline and admissions follow-up workspace.',
};
const RecruitmentCrmPage = dynamic(
  () => import('@/features/role-wise-features/recruitment-crm/components/RecruitmentCrmPage'),
);
export default function Page() {
  return <RecruitmentCrmPage />;
}
