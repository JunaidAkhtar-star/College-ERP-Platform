/**
 * @file StudentTabIllustration.tsx
 * @description Compact, person-free visual context for student profile drawer tabs.
 */
'use client';

import { motion } from '@/shared/utils/motion';
import Image from 'next/image';

export type TStudentDetailTab = 'info' | 'results' | 'learning' | 'parents' | 'documents';

interface IStudentTabIllustrationProps {
  tab: TStudentDetailTab;
}

const TAB_VISUALS: Record<
  TStudentDetailTab,
  { src: string; eyebrow: string; title: string; description: string; surface: string }
> = {
  info: {
    src: '/student-profile/tab-illustrations/profile.png',
    eyebrow: 'Student overview',
    title: 'Academic pathway and identity',
    description: 'Programme placement, semester progress and verified profile information.',
    surface: 'from-indigo-50 via-white to-cyan-50',
  },
  results: {
    src: '/student-profile/tab-illustrations/results.png',
    eyebrow: 'Published outcomes',
    title: 'Semester result analysis',
    description: 'SGPA movement, pass status and backlog history from published records.',
    surface: 'from-cyan-50 via-white to-emerald-50',
  },
  learning: {
    src: '/student-profile/tab-illustrations/learning.png',
    eyebrow: 'Learning portfolio',
    title: 'Skills and development',
    description: 'Verified credentials, activities and learning milestones in one timeline.',
    surface: 'from-amber-50 via-white to-cyan-50',
  },
  parents: {
    src: '/student-profile/tab-illustrations/parents.png',
    eyebrow: 'Support network',
    title: 'Family and emergency contacts',
    description: 'Registered communication, consent and emergency contact records.',
    surface: 'from-rose-50 via-white to-violet-50',
  },
  documents: {
    src: '/student-profile/tab-illustrations/documents.png',
    eyebrow: 'Record verification',
    title: 'Student document register',
    description: 'Availability and verification status of submitted institutional documents.',
    surface: 'from-blue-50 via-white to-emerald-50',
  },
};

export default function StudentTabIllustration({ tab }: IStudentTabIllustrationProps) {
  const visual = TAB_VISUALS[tab];

  return (
    <section
      className={`grid min-h-28 grid-cols-[minmax(0,1fr)_96px] overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-r ${visual.surface} sm:grid-cols-[minmax(0,1fr)_190px]`}
    >
      <div className="flex min-w-0 flex-col justify-center px-4 py-4 sm:px-5">
        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-indigo-500">
          {visual.eyebrow}
        </p>
        <h3 className="mt-1 text-base font-bold text-slate-900 sm:text-lg">{visual.title}</h3>
        <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">{visual.description}</p>
      </div>
      <motion.div
        className="relative min-h-28 overflow-hidden"
        animate={{ y: [0, -3, 0], rotate: [0, 0.35, 0] }}
        transition={{ duration: 5, ease: 'easeInOut', repeat: Infinity }}
      >
        <Image
          src={visual.src}
          alt={`${visual.title} object illustration`}
          fill
          sizes="(max-width: 639px) 96px, 190px"
          className="object-contain object-center p-1 sm:p-2"
        />
      </motion.div>
    </section>
  );
}
