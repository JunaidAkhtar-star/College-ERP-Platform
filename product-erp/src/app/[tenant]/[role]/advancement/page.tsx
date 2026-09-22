import dynamic from 'next/dynamic';
const Page = dynamic(
  () => import('@/features/role-wise-features/advancement/components/AdvancementPage'),
);
export default function Advancement() {
  return <Page />;
}
