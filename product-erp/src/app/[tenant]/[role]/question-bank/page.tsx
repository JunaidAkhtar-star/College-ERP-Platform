/**
 * @file page.tsx
 * @description Question Bank route — server component wrapper.
 * @module app/[role]/question-bank
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Question Bank',
  description: 'Manage exam and quiz question bank.',
};

const QuestionBankPage = dynamic(
  () => import('@/features/role-wise-features/question-bank/components/QuestionBankPage'),
  { loading: () => null },
);

export default function Page() {
  return <QuestionBankPage />;
}
