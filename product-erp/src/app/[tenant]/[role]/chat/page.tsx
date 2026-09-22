/**
 * @file page.tsx
 * @description Chat route — server component wrapper.
 * @module app/[role]/chat
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Chat',
  description: 'Institutional messaging and communication.',
};

const ChatPage = dynamic(() => import('@/features/role-wise-features/chat/components/ChatPage'), {
  loading: () => null,
});

export default function Page() {
  return <ChatPage />;
}
