import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
export const metadata: Metadata = {
  title: 'Financial Aid | Devvelocity ERP',
  description: 'Need analysis, aid packaging, acceptance and disbursement reconciliation.',
};
const FinancialAidPage = dynamic(
  () => import('@/features/role-wise-features/financial-aid/components/FinancialAidPage'),
);
export default function Page() {
  return <FinancialAidPage />;
}
