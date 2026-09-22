import dynamic from 'next/dynamic';
const Workspace = dynamic(
  () =>
    import('@/features/role-wise-features/continuing-education/components/ContinuingEducationPage'),
);
export default function Page() {
  return <Workspace />;
}
