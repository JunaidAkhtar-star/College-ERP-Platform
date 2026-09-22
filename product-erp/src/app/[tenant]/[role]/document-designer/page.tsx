import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
export const metadata: Metadata = {
  title: 'Certificate & ID Designer',
  description: 'Design and issue verifiable institution documents.',
};
const DocumentDesignerPage = dynamic(
  () => import('@/features/role-wise-features/document-designer/components/DocumentDesignerPage'),
);
export default function Page() {
  return <DocumentDesignerPage />;
}
