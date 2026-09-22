import dynamic from 'next/dynamic';
const FacilitiesPage = dynamic(
  () => import('@/features/role-wise-features/facilities/components/FacilitiesPage'),
);
export default function Page() {
  return <FacilitiesPage />;
}
