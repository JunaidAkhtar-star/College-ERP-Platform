/**
 * @file page.tsx
 * @description Job Posting route — server component wrapper.
 * @module app/[role]/job-posting
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Job Postings',
  description: 'Manage and browse placement job postings.',
};

const JobPostingPage = dynamic(
  () => import('@/features/role-wise-features/job-posting/components/JobPostingPage'),
  { loading: () => null },
);

export default function Page() {
  return <JobPostingPage />;
}
