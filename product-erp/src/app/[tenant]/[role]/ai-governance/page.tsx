import dynamic from 'next/dynamic';
const Workspace = dynamic(
  () => import('@/features/role-wise-features/ai-governance/components/AiGovernancePage'),
);
export default function Page() {
  return <Workspace />;
}
