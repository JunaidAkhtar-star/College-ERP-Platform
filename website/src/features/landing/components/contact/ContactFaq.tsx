/**
 * @file ContactFaq.tsx
 * @description Compact company contact FAQ and final consultation prompt.
 * @module features/landing/components/contact
 */

'use client';

import Link from 'next/link';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { AnimatePresence, motion } from '@/shared/utils/motion';

const questions = [
  {
    question: 'What can I contact Devvelocity about?',
    answer:
      'You can discuss Devvelocity products, College ERP, product design and engineering services, integrations, modernisation work, partnerships or an existing support need.',
  },
  {
    question: 'Do I need a complete project specification?',
    answer:
      'No. A clear description of the current problem, who experiences it and what you hope to improve is enough for an initial conversation.',
  },
  {
    question: 'How quickly will someone respond?',
    answer:
      'Our team normally reviews new enquiries within one business day. Urgent support matters should use the support channel available inside your product workspace.',
  },
  {
    question: 'Can you work with an existing product or internal team?',
    answer:
      'Yes. We can take ownership of a focused outcome, deliver an end-to-end product, or work as an embedded product and engineering partner.',
  },
] as const;

export default function ContactFaq() {
  const [openItem, setOpenItem] = useState<number | null>(0);

  return (
    <>
      <section className="bg-[#f3f8fb] px-5 py-20 md:px-10 lg:px-16 lg:py-28">
        <div className="mx-auto grid max-w-[1200px] gap-12 lg:grid-cols-[.72fr_1.28fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
              Before you reach out
            </p>
            <h2 className="mt-4 text-3xl font-bold tracking-[-0.05em] text-[#123f61] sm:text-5xl">
              A few useful answers.
            </h2>
            <p className="mt-5 text-sm leading-7 text-slate-500">
              The first conversation is about understanding fit—not pushing you toward a fixed
              package.
            </p>
          </div>
          <div className="divide-y divide-slate-200">
            {questions.map(({ question, answer }, index) => {
              const isOpen = openItem === index;
              return (
                <div key={question}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenItem(isOpen ? null : index)}
                    className="flex w-full items-center justify-between gap-6 py-6 text-left"
                  >
                    <span className="font-bold text-[#123f61]">{question}</span>
                    <ChevronDown
                      size={18}
                      className={`shrink-0 text-primary transition ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <p className="max-w-2xl pb-6 text-sm leading-7 text-slate-500">{answer}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-20 md:px-10 lg:px-16 lg:py-28">
        <div className="mx-auto flex max-w-[1440px] flex-col items-start justify-between gap-8 rounded-[2.5rem] bg-[#123f61] px-7 py-14 text-white sm:px-12 lg:flex-row lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-secondary-300">
              Prefer a guided product walkthrough?
            </p>
            <h2 className="mt-4 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">
              Book a focused Devvelocity demo.
            </h2>
          </div>
          <Link
            href="/demo"
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-[#123f61]"
          >
            Book a demo <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </>
  );
}
