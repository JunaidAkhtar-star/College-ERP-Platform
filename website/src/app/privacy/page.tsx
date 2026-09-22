import type { Metadata } from 'next';
import PublicPolicyLayout, {
  PolicySection,
} from '@/features/landing/components/PublicPolicyLayout';
import { createSeoMetadata } from '@/shared/utils/seo';

export const metadata: Metadata = createSeoMetadata({
  title: 'Privacy Policy',
  description: 'How Devvelocity collects, uses, shares, protects and retains personal data.',
  path: '/privacy',
});

export default function PrivacyPage() {
  return (
    <PublicPolicyLayout
      eyebrow="Legal and trust"
      title="Privacy Policy"
      summary="This policy explains how personal data is handled across the Devvelocity website, SaaS administration, billing and institution workspaces."
      updated="20 July 2026"
    >
      <PolicySection title="1. Scope and our role">
        <p>
          This policy applies to visitors, prospective customers, authorised institution
          administrators and users of Devvelocity services. For website enquiries, platform
          administration and Devvelocity billing, Devvelocity determines why and how relevant
          personal data is processed.
        </p>
        <p>
          For student, parent, applicant, employee, faculty and other records entered into an
          institution workspace, the subscribing institution normally determines the purposes and
          means of processing. Devvelocity processes that data on the institution’s documented
          instructions as its technology service provider. Users should generally submit requests
          about institution records to their institution first.
        </p>
      </PolicySection>
      <PolicySection title="2. Data we may process">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            Identity and contact information, including name, email, phone number, designation and
            organisation.
          </li>
          <li>Account, authentication, role, permission and security-event information.</li>
          <li>
            Institution records configured or uploaded by authorised tenant users, depending on
            enabled modules.
          </li>
          <li>
            Subscription, invoice, transaction reference, payment status and refund information.
            Complete card, bank or UPI credentials are processed by the payment provider and are not
            stored by Devvelocity.
          </li>
          <li>Device, browser, IP address, diagnostic, audit, usage and support information.</li>
          <li>Communications, demonstrations, enquiries and support correspondence.</li>
        </ul>
      </PolicySection>
      <PolicySection title="3. Why we process data">
        <p>
          We process data to provide and secure the service, authenticate users, enforce permissions
          and subscriptions, operate requested workflows, deliver support, process billing, issue
          invoices, prevent fraud, maintain audit trails, improve reliability, communicate service
          information and comply with legal obligations.
        </p>
        <p>
          Processing is based on consent where required, performance of customer agreements,
          compliance with law and other lawful uses recognised by applicable law. We do not sell
          personal data.
        </p>
      </PolicySection>
      <PolicySection title="4. Institution responsibilities">
        <p>
          Each institution is responsible for having a lawful basis and giving appropriate notices
          before placing personal data in its workspace; configuring authorised users and retention;
          responding to data-principal requests; and ensuring that sensitive workflows are used
          consistently with education, employment and other applicable laws.
        </p>
      </PolicySection>
      <PolicySection title="5. Children and student data">
        <p>
          Education records may relate to children. Such information is processed only through an
          authorised institution relationship and according to institution instructions.
          Institutions are responsible for obtaining verifiable parental consent or another legally
          permitted basis where required and for avoiding processing that is detrimental to a
          child’s well-being.
        </p>
      </PolicySection>
      <PolicySection title="6. Sharing and service providers">
        <p>
          Information may be shared with vetted providers supporting cloud hosting, database
          infrastructure, email and messaging, customer support, monitoring, file storage, analytics
          and payment processing. Bank-transfer or UPI payment references and supporting proof are
          processed to verify subscription payments and maintain billing records. We may also
          disclose information where required by law, to protect users and the service, during a
          corporate transaction subject to appropriate safeguards, or with valid authorisation.
        </p>
      </PolicySection>
      <PolicySection title="7. International processing">
        <p>
          Providers or support operations may process data outside the user’s state or country.
          Where cross-border processing occurs, we use contractual and technical safeguards and
          comply with restrictions notified under applicable Indian law.
        </p>
      </PolicySection>
      <PolicySection title="8. Retention and deletion">
        <p>
          We retain data only for the period needed for the stated purpose, the customer agreement,
          security, dispute resolution and legal or accounting obligations. Tenant-controlled
          records follow the institution’s configuration and contract. Backups may retain deleted
          information for a limited recovery cycle before secure expiry. Billing, tax,
          fraud-prevention and audit records may be retained for legally required periods.
        </p>
      </PolicySection>
      <PolicySection title="9. Security">
        <p>
          We use reasonable administrative, technical and organisational safeguards such as tenant
          scoping, role-based access, authentication controls, encryption where appropriate, audit
          logging, monitoring, backups and controlled operational access. No internet service is
          completely risk-free. Customers must protect credentials, configure permissions carefully
          and report suspected compromise promptly.
        </p>
      </PolicySection>
      <PolicySection title="10. Your choices and rights">
        <p>
          Subject to applicable law, individuals may request information about processing, access a
          summary of personal data, correct inaccurate or incomplete data, request erasure where
          retention is no longer required, withdraw consent, seek grievance redressal and nominate
          another person to exercise rights in permitted circumstances.
        </p>
        <p>
          For institution workspace data, contact the relevant institution. For
          Devvelocity-controlled website, billing or account data, use the contact page. We may
          verify identity and retain information where law or legitimate security requirements
          require it.
        </p>
      </PolicySection>
      <PolicySection title="11. Cookies and local storage">
        <p>
          We use essential browser storage for authentication, security, tenant routing and user
          preferences. Optional analytics or marketing technologies, if introduced, will be
          described and offered with controls where legally required. Blocking essential storage may
          prevent sign-in or core functionality.
        </p>
      </PolicySection>
      <PolicySection title="12. Incidents, grievances and complaints">
        <p>
          We investigate suspected personal-data incidents and notify affected customers or
          authorities when required. Privacy concerns may be submitted through the Devvelocity
          contact page with the subject “Privacy grievance”. Institution-data complaints should
          first be raised through that institution’s grievance channel. Applicable rights may also
          include escalation to the Data Protection Board of India according to the statutory
          process.
        </p>
      </PolicySection>
      <PolicySection title="13. Policy updates">
        <p>
          We may revise this policy when services or laws change. Material changes will be
          communicated through the website, service or registered contact channels. The date above
          identifies the current version.
        </p>
      </PolicySection>
    </PublicPolicyLayout>
  );
}
