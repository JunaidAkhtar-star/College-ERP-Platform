import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import PublicPolicyLayout from '@/features/landing/components/PublicPolicyLayout';
import JsonLd from '@/shared/core/JsonLd';
import { createSeoMetadata } from '@/shared/utils/seo';

export const metadata: Metadata = createSeoMetadata({
  title: 'Education ERP Frequently Asked Questions',
  description:
    'Answers about Devvelocity ERP modules, implementation, security, pricing, payments and support.',
  path: '/faq',
});

const groups = [
  {
    title: 'Platform and modules',
    questions: [
      [
        'What is Devvelocity?',
        'Devvelocity is a multi-tenant institution operating platform connecting academics, admissions, finance, people, compliance and campus services through governed workflows.',
      ],
      [
        'Can we purchase only selected modules?',
        'Yes. Plans define included modules, capacity and features. Additional modules and premium add-ons can be activated without rebuilding the institution workspace.',
      ],
      [
        'Does each institution receive separate configuration?',
        'Yes. Each tenant has institution-specific identity, settings, users, permissions, modules, limits and operational records.',
      ],
      [
        'Can users access the platform on mobile devices?',
        'The web interface is responsive and supports modern mobile, tablet and desktop browsers. Availability of device integrations depends on the selected module and implementation scope.',
      ],
    ],
  },
  {
    title: 'Implementation and migration',
    questions: [
      [
        'How does implementation begin?',
        'Implementation begins with process discovery, scope confirmation and configuration. Data preparation, pilot validation, user training and controlled launch follow.',
      ],
      [
        'Can existing data be migrated?',
        'Yes, where agreed. Migration depends on source quality and typically includes mapping, validation, trial import, reconciliation and authorised final import.',
      ],
      [
        'Will every module launch at once?',
        'Not necessarily. A phased rollout is usually safer: foundational identity and settings first, priority workflows next, and additional modules after validation.',
      ],
      [
        'Is training included?',
        'Training scope is defined in the selected plan or order. Role-based administrator and user training can be included in an implementation engagement.',
      ],
    ],
  },
  {
    title: 'Security and privacy',
    questions: [
      [
        'How is tenant data separated?',
        'Tenant context is resolved and enforced by the backend, with institution data routed to its authorised workspace. Platform catalogue and SaaS billing information remain in the platform scope.',
      ],
      [
        'Are permissions enforced only in the interface?',
        'No. Roles, permissions and commercial module entitlements are enforced at backend routes and services as well as reflected in navigation.',
      ],
      [
        'Who controls student and employee data?',
        'The subscribing institution normally determines how its operational records are used. Devvelocity processes those records to provide the contracted service and follows institution instructions and applicable law.',
      ],
      [
        'How can an individual request correction or deletion?',
        'For records held by an institution, contact that institution first. For Devvelocity website, account or billing data, submit a privacy request through the contact page.',
      ],
    ],
  },
  {
    title: 'Plans, billing and support',
    questions: [
      [
        'Which payment models are available?',
        'Plans may use yearly billing or an approved one-time lifetime arrangement. Optional premium add-ons can have their own commercial scope.',
      ],
      [
        'What happens after a successful payment?',
        'The backend verifies the gateway signature and captured payment details before activating entitlements. A confirmation and PDF invoice are sent to the billing email.',
      ],
      [
        'What happens if payment fails or is refunded?',
        'Failed attempts are recorded and notified without activating access. Partial refunds retain access unless agreed otherwise; a full refund can cancel and suspend the corresponding subscription.',
      ],
      [
        'Is a free trial available?',
        'A guided 7-day free trial is available. The exact trial scope and any grace period shown in the accepted offer applies.',
      ],
      [
        'How do we get support?',
        'Use the contact page or the support channel stated in your order. Response targets and dedicated support depend on the selected plan.',
      ],
    ],
  },
];

export default function FaqPage() {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: groups.flatMap((group) =>
      group.questions.map(([question, answer]) => ({
        '@type': 'Question',
        name: question,
        acceptedAnswer: { '@type': 'Answer', text: answer },
      })),
    ),
  };

  return (
    <PublicPolicyLayout
      eyebrow="Product guidance"
      title="Frequently asked questions"
      summary="Clear answers about product scope, adoption, security, privacy, subscriptions and ongoing support."
      updated="20 July 2026"
    >
      <JsonLd data={faqSchema} />
      <div className="space-y-14">
        {groups.map((group) => (
          <section key={group.title}>
            <h2 className="text-2xl font-bold tracking-[-0.025em]">{group.title}</h2>
            <div className="mt-5 space-y-3">
              {group.questions.map(([question, answer]) => (
                <details
                  key={question}
                  className="group rounded-2xl bg-[#f8fafc] p-5 transition-colors open:bg-[#edf5fb]"
                >
                  <summary className="cursor-pointer list-none pr-5 font-bold">
                    {question}
                    <span className="float-right text-xl text-[#0178d7] group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-4 max-w-3xl leading-7 text-[#667085]">{answer}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
      <section className="mt-16 rounded-[2rem] bg-[#fff0e8] p-8 sm:p-10">
        <h2 className="text-3xl font-bold tracking-[-0.035em]">
          Still evaluating your requirements?
        </h2>
        <p className="mt-4 max-w-2xl leading-7 text-[#667085]">
          Share your institution size, current systems and priority workflows. We will help map the
          relevant modules and rollout approach.
        </p>
        <Link
          href="/contact"
          className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#172033] px-6 py-3.5 font-bold text-white"
        >
          Talk to our team <ArrowRight size={17} />
        </Link>
      </section>
    </PublicPolicyLayout>
  );
}
