import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search across students, faculty and users.',
};

const GlobalSearchPage = dynamic(
  () => import('@/features/role-wise-features/search/components/GlobalSearchPage'),
  { loading: () => null },
);

export default function Page() {
  return <GlobalSearchPage />;
}
