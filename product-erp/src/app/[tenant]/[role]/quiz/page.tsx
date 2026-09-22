/**
 * @file page.tsx
 * @description Quizzes route — server component wrapper.
 * @module app/[role]/quiz
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Quizzes',
  description: 'Create and manage online quizzes.',
};

const QuizPage = dynamic(() => import('@/features/role-wise-features/quiz/components/QuizPage'), {
  loading: () => null,
});

export default function Page() {
  return <QuizPage />;
}
