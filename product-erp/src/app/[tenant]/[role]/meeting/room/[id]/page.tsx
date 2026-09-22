/**
 * @file page.tsx
 * @description Meeting room page wrapper.
 * @module app/[role]/meeting/room/[id]
 */

import type { Metadata } from 'next';
import { MeetingRoomClient } from './MeetingRoomClient';

export const metadata: Metadata = {
  title: 'Video Room | Institution Meet',
  description: 'Join virtual meeting room.',
};

export default function Page() {
  return <MeetingRoomClient />;
}
