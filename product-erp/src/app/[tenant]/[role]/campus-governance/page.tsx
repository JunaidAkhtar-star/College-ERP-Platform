import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
export const metadata: Metadata = {
  title: 'Multi-campus Governance | Devvelocity ERP',
  description: 'Campus hierarchy, scoped authority, calendars and consolidated reporting.',
};
const CampusGovernancePage = dynamic(
  () => import('@/features/role-wise-features/campus-governance/components/CampusGovernancePage'),
);
export default function Page() {
  return <CampusGovernancePage />;
}
