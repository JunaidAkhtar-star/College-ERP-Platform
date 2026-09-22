import type { Metadata } from 'next';
import OnboardingPage from '@/features/onboarding/components/OnboardingPage';

export const metadata: Metadata = {
  title: 'Set up your institution',
  description: 'Complete the required institution profile before opening your ERP workspace.',
};

export default function Page() {
  return <OnboardingPage />;
}
