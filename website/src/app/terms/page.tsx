import type { Metadata } from 'next';
import PublicPolicyLayout, {
  PolicySection,
} from '@/features/landing/components/PublicPolicyLayout';
import { createSeoMetadata } from '@/shared/utils/seo';

export const metadata: Metadata = createSeoMetadata({
  title: 'Terms & Conditions',
  description: 'Terms governing access to the Devvelocity website and institution ERP SaaS.',
  path: '/terms',
});

export default function TermsPage() {
  return (
    <PublicPolicyLayout
      eyebrow="Legal and commercial"
      title="Terms & Conditions"
      summary="These terms govern access to the Devvelocity website and platform. An executed order form or written enterprise agreement may contain additional commercial terms."
      updated="20 July 2026"
    >
      <PolicySection title="1. Acceptance and contracting authority">
        <p>
          By accessing the service or accepting an order, you agree to these terms and confirm that
          you have authority to bind the relevant institution or organisation. If you do not agree,
          do not use the service. An order form, data-processing agreement or negotiated enterprise
          agreement prevails over these website terms where it expressly conflicts.
        </p>
      </PolicySection>
      <PolicySection title="2. Service and accounts">
        <p>
          Devvelocity provides configurable institution-management software, modules, integrations,
          support and related services. Customers must provide accurate information, nominate
          authorised administrators, keep credentials confidential and promptly remove access that
          is no longer required. Activities performed through an authorised account are treated as
          customer activities unless reported as compromised.
        </p>
      </PolicySection>
      <PolicySection title="3. Plans, trials and add-ons">
        <p>
          Access is limited to the modules, add-ons, users, capacity and term in the selected plan
          or order. The standard free trial lasts seven days and may have reduced limits. The first
          paid subscription year includes unlimited live meeting minutes subject to fair usage,
          participant, concurrency, duration and storage controls. Renewal meeting limits follow the
          selected plan or renewal order. The institution mobile app costs ₹20,000 per year plus
          applicable tax unless an order states otherwise. Online payment-gateway integration,
          provider charges, store accounts, white-labelling and custom development are separately
          priced. Backend entitlements determine access.
        </p>
      </PolicySection>
      <PolicySection title="4. Fees, taxes and payment">
        <p>
          Fees are stated in the order or checkout and are payable in Indian rupees unless agreed
          otherwise. Prices exclude applicable taxes unless stated. Annual plans renew only
          according to the accepted commercial arrangement. An approved one-time payment grants a
          continuing right to use the purchased version and included service scope; it does not
          transfer ownership of software or guarantee free future premium modules, third-party
          charges or separately priced services.
        </p>
        <p>
          Payment is processed by the displayed payment provider. Failed or reversed payments may
          result in a grace period, restriction or suspension. Invoices and transaction notices are
          sent to the registered billing email.
        </p>
      </PolicySection>
      <PolicySection title="5. Cancellation and refunds">
        <p>
          Cancellation, non-renewal and refund eligibility follow the applicable order form and
          refund policy presented at purchase. Unless required by law or expressly agreed, setup,
          migration, customisation and consumed service fees are non-refundable. Approved refunds
          are returned through the original payment channel where feasible. A full refund may
          terminate the corresponding licence or subscription; a partial refund does not alter
          access unless stated.
        </p>
      </PolicySection>
      <PolicySection title="6. Customer data and lawful use">
        <p>
          The customer retains its rights in customer data and authorises Devvelocity to process it
          to provide, secure and support the service. The customer is responsible for lawful
          collection, notices, permissions, accuracy, retention instructions and responses to
          individuals. Devvelocity does not acquire ownership of institution records.
        </p>
      </PolicySection>
      <PolicySection title="7. Acceptable use">
        <p>
          You must not use the service unlawfully; access another tenant or account without
          authority; upload malicious code; bypass security, limits or payment controls; probe or
          disrupt infrastructure; scrape the service at unreasonable scale; infringe rights;
          transmit abusive or deceptive content; reverse engineer except where law cannot prohibit
          it; or use the service to make unlawful discriminatory or solely automated high-impact
          decisions.
        </p>
      </PolicySection>
      <PolicySection title="8. Security and incident cooperation">
        <p>
          Devvelocity maintains reasonable safeguards appropriate to the service. Customers remain
          responsible for endpoint security, account administration, permission configuration and
          secure exports. Each party will promptly cooperate on suspected incidents affecting
          customer data and provide information reasonably necessary for investigation and legal
          obligations.
        </p>
      </PolicySection>
      <PolicySection title="9. Availability, support and changes">
        <p>
          We aim to provide dependable service but may perform maintenance, address emergencies or
          modify features for security, law, compatibility or improvement. Specific service levels
          apply only when stated in an executed agreement. Beta or preview features may change and
          are provided without production commitments.
        </p>
      </PolicySection>
      <PolicySection title="10. Intellectual property">
        <p>
          Devvelocity and its licensors retain all rights in the platform, design, documentation,
          trademarks, improvements and underlying technology. The customer receives a limited,
          non-exclusive, non-transferable right to use purchased services during the applicable term
          or lifetime scope. Feedback may be used to improve the service without identifying the
          contributor.
        </p>
      </PolicySection>
      <PolicySection title="11. Third-party services">
        <p>
          Integrations such as payment, email, messaging, video, cloud or identity services are
          governed by their providers’ terms and availability. Devvelocity is not responsible for an
          external provider’s independent acts, but will use reasonable care in integration and
          vendor selection.
        </p>
      </PolicySection>
      <PolicySection title="12. Confidentiality">
        <p>
          Each party must protect non-public business, technical, security and customer information
          using reasonable care and use it only for the agreement. This does not cover information
          independently developed, lawfully received, publicly available without breach or required
          to be disclosed by law after permitted notice.
        </p>
      </PolicySection>
      <PolicySection title="13. Suspension and termination">
        <p>
          We may restrict or suspend access for material breach, security risk, unlawful activity,
          non-payment or risk to other users, using notice where reasonably possible. On
          termination, access ends and data export or deletion follows the agreement and applicable
          law. Provisions concerning payment, confidentiality, intellectual property, liability and
          dispute resolution survive where relevant.
        </p>
      </PolicySection>
      <PolicySection title="14. Warranties and liability">
        <p>
          The service is provided with reasonable skill and care. Except for express commitments and
          rights that cannot be excluded, it is provided “as available” without implied warranties.
          Neither party is liable for indirect, special or consequential loss, lost profits or loss
          caused by matters outside reasonable control. Any aggregate liability cap will be the
          amount specified in the applicable order or enterprise agreement, subject to liabilities
          that law does not permit the parties to limit.
        </p>
      </PolicySection>
      <PolicySection title="15. Indemnity">
        <p>
          The customer will be responsible for third-party claims arising from unlawful customer
          data, unauthorised use or material breach by its users. Devvelocity will be responsible
          for claims to the extent expressly stated in an enterprise agreement. The protected party
          must give prompt notice and reasonable cooperation.
        </p>
      </PolicySection>
      <PolicySection title="16. Governing law and disputes">
        <p>
          These terms are governed by the laws of India. The parties will first attempt good-faith
          resolution through authorised representatives. Where an order form specifies arbitration,
          disputes will be resolved under the Arbitration and Conciliation Act, 1996 using the seat,
          language and procedure stated there. Otherwise, courts identified in the applicable order
          or contracting entity’s registered-office jurisdiction will have jurisdiction.
        </p>
      </PolicySection>
      <PolicySection title="17. General">
        <p>
          Neither party may assign the agreement except as permitted in an order or as part of a
          merger or transfer of substantially all relevant business, subject to continued
          obligations. Neither party is responsible for delay caused by events beyond reasonable
          control. Invalid provisions will be narrowed or severed without invalidating the
          remainder. Notices must be sent through the contractual notice channels or Devvelocity
          contact page.
        </p>
      </PolicySection>
    </PublicPolicyLayout>
  );
}
