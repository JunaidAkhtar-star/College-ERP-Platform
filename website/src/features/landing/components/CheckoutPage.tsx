'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFormik } from 'formik';
import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  Copy,
  FileCheck2,
  GraduationCap,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  MailCheck,
  ReceiptText,
  ShieldCheck,
  Upload,
  UserCheck,
  Users,
} from 'lucide-react';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import CustomButton from '@/shared/core/CustomButton';
import { motion } from '@/shared/utils/motion';
import type { IProductAddon, ISubscriptionPlan } from '@/features/landing/types/public.types';
import { paymentConfirmationSchema } from '@/features/landing/validations/checkout.validation';

interface ICatalogResponse {
  data?: {
    plans: ISubscriptionPlan[];
    addons: IProductAddon[];
    site?: {
      supportEmail?: string;
    };
  };
}

interface IOrder {
  billingId: string;
  amount: number;
  listPrice: number;
  discount: number;
  annualDiscount: number;
  lineItems: Array<{
    kind: 'plan' | 'addon';
    slug: string;
    description: string;
    billingLabel: string;
    amountInPaise: number;
  }>;
  couponCode?: string;
  couponDiscount: number;
  subtotal: number;
  taxRatePercent: number;
  taxAmount: number;
  currency: string;
  invoiceNumber: string;
  tenantName: string;
  billingEmail: string;
  paymentMethod: 'bank_transfer';
  bankTransfer: {
    accountHolderName: string;
    bankName: string;
    accountNumber: string;
    ifscCode: string;
    branch?: string;
    upiId?: string;
    instructions?: string;
  };
}

interface IRegistrationData {
  sessionId?: string;
  sessionToken?: string;
  status: string;
  adminEmail?: string;
  expiresAt?: string;
  order?: IOrder;
}

interface ICheckoutResponse {
  success?: boolean;
  data?: IRegistrationData;
}

interface IRegistrationErrors {
  institutionName?: string;
  tenantId?: string;
  adminEmail?: string;
}

interface IStatusResponse {
  success?: boolean;
  data?: { status: string; error?: string; loginUrl?: string };
}

interface IResumeResponse {
  success?: boolean;
  data?: {
    sessionId: string;
    status: string;
    error?: string;
    paymentRequired?: boolean;
    agreementAccepted?: boolean;
    adminEmail?: string;
    order?: IOrder;
  };
}

interface IAgreementDocument {
  kind: 'nda' | 'terms';
  title: string;
  version: string;
  hash: string;
  sections: Array<{ heading: string; body: string }>;
  pdfDataUrl: string;
}

interface IAgreementResponse {
  success?: boolean;
  data?: {
    documents: IAgreementDocument[];
    accepted: boolean;
    acceptanceId?: string;
    verifiedAt?: string;
    maskedEmail: string;
  };
}

const fieldClass =
  'w-full rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-900 outline-none ring-primary transition duration-200 placeholder:text-slate-400 focus:bg-white focus:ring-2';

function RequiredMark() {
  return (
    <span aria-hidden="true" className="ml-0.5 text-red-500">
      *
    </span>
  );
}

export default function CheckoutPage() {
  const params = useSearchParams();
  const catalog = useSwr<ICatalogResponse>('super-admin/public-catalog');
  const { mutation, isLoading } = useMutation();
  const productSlug = params.get('product') ?? 'college-erp';
  const plans = useMemo(
    () =>
      (catalog.data?.data?.plans ?? []).filter(
        (plan) => plan.isActive && plan.productSlug === productSlug,
      ),
    [catalog.data, productSlug],
  );
  const mobileAppAddon = useMemo(
    () =>
      (catalog.data?.data?.addons ?? []).find(
        (addon) =>
          addon.isActive &&
          addon.productSlug === productSlug &&
          addon.slug === 'institution-mobile-app',
      ),
    [catalog.data, productSlug],
  );
  const initialSlug = params.get('plan');
  const [planId, setPlanId] = useState('');
  const [includeMobileApp, setIncludeMobileApp] = useState(false);
  const [institutionName, setInstitutionName] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponError, setCouponError] = useState('');
  const [session, setSession] = useState<{ id: string; token: string } | null>(null);
  const [order, setOrder] = useState<IOrder | null>(null);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [transferReference, setTransferReference] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentChannel, setPaymentChannel] = useState<'neft' | 'rtgs' | 'imps' | 'upi'>('neft');
  const [proof, setProof] = useState<File | null>(null);
  const [paymentSubmissionError, setPaymentSubmissionError] = useState('');
  const proofSubmissionInFlight = useRef(false);
  const resumed = useRef(false);
  const statusRequestInFlight = useRef(false);
  const [state, setState] = useState<
    | 'resuming'
    | 'form'
    | 'email_sent'
    | 'agreement'
    | 'payment'
    | 'review'
    | 'provisioning'
    | 'ready'
    | 'expired'
    | 'failed'
  >('resuming');
  const [message, setMessage] = useState('');
  const [registrationErrors, setRegistrationErrors] = useState<IRegistrationErrors>({});
  const registrationRequestId = useRef('');
  const [loginUrl, setLoginUrl] = useState('');

  const selectedPlanId =
    planId || plans.find((plan) => plan.slug === initialSlug)?._id || plans[0]?._id || '';
  const plan = plans.find((item) => item._id === selectedPlanId);
  const hasPreselectedPlan = Boolean(
    initialSlug && !planId && plans.some((item) => item.slug === initialSlug),
  );
  const isFree = plan?.planType === 'free';
  const annualAmount = plan?.amountInPaise ?? 0;
  const mobileAppAmount = includeMobileApp ? (mobileAppAddon?.amountInPaise ?? 0) : 0;
  const estimatedSubtotal = annualAmount + mobileAppAmount;
  const erpBaseUrl = process.env.NEXT_PUBLIC_ERP_URL ?? 'http://localhost:3000';
  const workspaceUrl = erpBaseUrl.replace('://', `://${tenantId.trim() || 'your-college'}.`);

  useEffect(() => {
    if (resumed.current || typeof window === 'undefined') return;
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const storedSession = window.sessionStorage.getItem('devvelocity-payment-session');
    let stored: { sessionId?: string; sessionToken?: string } = {};
    try {
      stored = storedSession ? (JSON.parse(storedSession) as typeof stored) : {};
    } catch {
      window.sessionStorage.removeItem('devvelocity-payment-session');
    }
    const sessionId = fragment.get('sessionId') ?? stored.sessionId ?? null;
    const sessionToken = fragment.get('token') ?? stored.sessionToken ?? null;
    if (!sessionId || !sessionToken) {
      setState('form');
      return;
    }
    resumed.current = true;
    window.sessionStorage.setItem(
      'devvelocity-payment-session',
      JSON.stringify({ sessionId, sessionToken }),
    );
    if (window.location.hash) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }
    setSession({ id: sessionId, token: sessionToken });
    void mutation('super-admin/public-checkout/session', {
      method: 'POST',
      body: { sessionId, sessionToken },
      dedupe: false,
      suppressErrorToast: true,
    }).then((response) => {
      const result = response?.results as IResumeResponse | undefined;
      if (!result?.data) {
        window.sessionStorage.removeItem('devvelocity-payment-session');
        setSession(null);
        setOrder(null);
        setState('expired');
        return;
      }
      if (result.data.order) setOrder(result.data.order);
      setAgreementAccepted(Boolean(result.data.agreementAccepted));
      if (result.data.status === 'pending_payment' && result.data.paymentRequired === false)
        setState('agreement');
      else if (result.data.status === 'pending_payment' && result.data.order) setState('payment');
      else if (result.data.status === 'awaiting_payment_review') setState('review');
      else if (['payment_verified', 'provisioning'].includes(result.data.status))
        setState('provisioning');
      else if (result.data.status === 'ready') {
        window.sessionStorage.removeItem('devvelocity-payment-session');
        setState('provisioning');
      } else {
        setMessage(result.data.error ?? 'This checkout cannot be resumed.');
        setState('failed');
      }
    });
  }, [mutation]);

  useEffect(() => {
    if (!session || state !== 'provisioning') return;
    const timer = window.setInterval(() => {
      if (statusRequestInFlight.current) return;
      statusRequestInFlight.current = true;
      void mutation('super-admin/public-checkout/status', {
        method: 'POST',
        body: { sessionId: session.id, sessionToken: session.token },
        suppressErrorToast: true,
      })
        .then((response) => {
          const result = response?.results as IStatusResponse | undefined;
          if (result?.data?.status === 'ready') {
            window.sessionStorage.removeItem('devvelocity-payment-session');
            setLoginUrl(result.data.loginUrl ?? '');
            setSession(null);
            setOrder(null);
            setState('ready');
          } else if (result?.data?.status === 'failed') {
            setMessage(result.data.error ?? 'Workspace provisioning failed.');
            setSession(null);
            setOrder(null);
            setState('failed');
          }
        })
        .finally(() => {
          statusRequestInFlight.current = false;
        });
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [mutation, session, state]);

  const submitProof = async () => {
    if (proofSubmissionInFlight.current) return false;
    const normalizedReference = transferReference.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9-]{7,49}$/.test(normalizedReference)) {
      setPaymentSubmissionError(
        'Enter an 8–50 character bank reference starting with a letter or number.',
      );
      return false;
    }
    const parsedPaymentDate = new Date(paymentDate);
    const now = new Date();
    if (
      !paymentDate ||
      Number.isNaN(parsedPaymentDate.getTime()) ||
      parsedPaymentDate > now ||
      parsedPaymentDate < new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000)
    ) {
      setPaymentSubmissionError('Select a payment date within the last 45 days.');
      return false;
    }
    if (!session || !proof) {
      setPaymentSubmissionError('Attach the payment receipt before submitting.');
      return false;
    }
    proofSubmissionInFlight.current = true;
    setPaymentSubmissionError('');
    const body = new FormData();
    body.set('sessionId', session.id);
    body.set('sessionToken', session.token);
    body.set('transferReference', normalizedReference);
    body.set('paymentDate', paymentDate);
    body.set('paymentChannel', paymentChannel);
    body.set('proof', proof);
    try {
      const response = await mutation('super-admin/public-checkout/payment-proof', {
        method: 'POST',
        body,
        isFormData: true,
        dedupe: true,
        suppressErrorToast: true,
        onError: setPaymentSubmissionError,
      });
      if (!response) return false;
      setState('review');
      return true;
    } finally {
      proofSubmissionInFlight.current = false;
    }
  };

  const submitFreeTierForApproval = async () => {
    if (!session) return false;
    const response = await mutation('super-admin/public-checkout/free-tier-submit', {
      method: 'POST',
      body: { sessionId: session.id, sessionToken: session.token },
      dedupe: false,
      isAlert: true,
    });
    if (!response) return false;
    setState('review');
    return true;
  };

  const applyCoupon = async () => {
    if (!session || !order || !couponCode.trim()) return;
    setCouponError('');
    const response = await mutation('super-admin/public-checkout/apply-coupon', {
      method: 'POST',
      body: {
        sessionId: session.id,
        sessionToken: session.token,
        couponCode: couponCode.trim().toUpperCase(),
      },
      dedupe: false,
      suppressErrorToast: true,
      onError: setCouponError,
    });
    const financials = (response?.results as { data?: Partial<IOrder> } | undefined)?.data;
    if (financials) setOrder((current) => (current ? { ...current, ...financials } : current));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    if (!plan) return;
    const nextErrors: IRegistrationErrors = {};
    const cleanInstitutionName = institutionName.trim();
    const cleanTenantId = tenantId.trim().toLowerCase();
    const cleanAdminEmail = adminEmail.trim().toLowerCase();
    if (cleanInstitutionName.length < 2 || cleanInstitutionName.length > 150) {
      nextErrors.institutionName = 'Enter an institution name containing 2–150 characters.';
    }
    if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(cleanTenantId)) {
      nextErrors.tenantId =
        'Use 3–40 lowercase letters, numbers or hyphens, starting with a letter or number.';
    }
    if (cleanAdminEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanAdminEmail)) {
      nextErrors.adminEmail = 'Enter a valid administrator email address.';
    }
    setRegistrationErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setMessage('Please correct the highlighted fields before submitting.');
      return;
    }
    if (!registrationRequestId.current) registrationRequestId.current = crypto.randomUUID();
    const response = await mutation('super-admin/public-checkout/register', {
      method: 'POST',
      body: {
        requestId: registrationRequestId.current,
        tenantId: cleanTenantId,
        institutionName: cleanInstitutionName,
        adminEmail: cleanAdminEmail,
        planId: plan._id,
        productSlug,
        billingPeriod: 'year',
        addonSlugs: includeMobileApp && mobileAppAddon ? [mobileAppAddon.slug] : [],
      },
      dedupe: false,
      suppressErrorToast: true,
      onError: setMessage,
    });
    const result = response?.results as ICheckoutResponse | undefined;
    const registration = result?.data;
    if (!registration) return;
    if (isFree) {
      if (!registration.sessionId || !registration.sessionToken) {
        setMessage('The trial workspace session could not be created.');
        setState('failed');
        return;
      }
      setSession({ id: registration.sessionId, token: registration.sessionToken });
      window.sessionStorage.setItem(
        'devvelocity-payment-session',
        JSON.stringify({
          sessionId: registration.sessionId,
          sessionToken: registration.sessionToken,
        }),
      );
      setState('agreement');
      return;
    }
    setState('email_sent');
  };

  if (state === 'resuming')
    return (
      <CheckoutState
        icon={<LoaderCircle className="size-10 animate-spin" />}
        title="Opening your secure payment request"
        text="Validating the institution and reserved invoice attached to this private link."
      />
    );
  if (state === 'provisioning')
    return (
      <CheckoutState
        icon={<LoaderCircle className="size-10 animate-spin" />}
        title="Preparing your workspace"
        text="Payment is verified. Secure tenant provisioning is running; this page updates automatically."
      />
    );
  if (state === 'review')
    return (
      <PaymentReviewConfirmation
        billingEmail={order?.billingEmail}
        tenantName={order?.tenantName}
        invoiceNumber={order?.invoiceNumber}
      />
    );
  if (state === 'agreement' && session)
    return (
      <main className="min-h-dvh bg-slate-100 px-4 py-8 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-3xl bg-white p-5 sm:p-8">
          <p className="mb-5 text-sm text-slate-600">
            Payment is not required for this plan. Review and verify the NDA and Subscription Terms
            before the administrator can approve your workspace.
          </p>
          <AgreementAcceptance
            session={session}
            billingEmail={adminEmail}
            onBack={() => setState('form')}
            onAccepted={submitFreeTierForApproval}
          />
        </div>
      </main>
    );
  if (state === 'email_sent')
    return (
      <CheckoutState
        icon={<AnimatedSuccessIcon />}
        title="Registration received"
        text={`We sent the next payment steps to ${adminEmail}. Open the unique secure link in that email within 24 hours to view the beneficiary details and complete payment. Check your spam folder if it does not arrive shortly.`}
        action={
          <Link
            href="/"
            className="inline-flex rounded-full bg-primary px-6 py-3 font-bold text-white"
          >
            Return to Devvelocity
          </Link>
        }
      />
    );
  if (state === 'expired') {
    const supportEmail = catalog.data?.data?.site?.supportEmail || 'support@devvelocity.in';
    return (
      <CheckoutState
        icon={<CircleAlert className="size-10" />}
        title="Payment request expired"
        text="This private payment request is no longer active. For your security, expired links cannot display institution, invoice or beneficiary details. Contact Devvelocity to receive a new payment request."
        action={
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <a
              href={`mailto:${supportEmail}?subject=New subscription payment request`}
              className="inline-flex justify-center rounded-full bg-primary px-6 py-3 font-bold text-white"
            >
              Contact Devvelocity
            </a>
            <Link
              href="/"
              className="inline-flex justify-center rounded-full bg-slate-100 px-6 py-3 font-bold text-slate-600"
            >
              Return to website
            </Link>
          </div>
        }
      />
    );
  }
  if (state === 'payment' && order && session)
    return (
      <BankTransferCheckout
        order={order}
        session={session}
        transferReference={transferReference}
        paymentDate={paymentDate}
        paymentChannel={paymentChannel}
        proof={proof}
        couponCode={couponCode}
        couponError={couponError}
        submissionError={paymentSubmissionError}
        isLoading={isLoading}
        onReference={(value) => {
          setTransferReference(value);
          setPaymentSubmissionError('');
        }}
        onPaymentDate={(value) => {
          setPaymentDate(value);
          setPaymentSubmissionError('');
        }}
        onPaymentChannel={(value) => {
          setPaymentChannel(value);
          setPaymentSubmissionError('');
        }}
        onProof={(value) => {
          setProof(value);
          setPaymentSubmissionError('');
        }}
        onCouponCode={setCouponCode}
        onApplyCoupon={applyCoupon}
        onSubmit={submitProof}
        agreementAccepted={agreementAccepted}
      />
    );
  if (state === 'ready')
    return (
      <CheckoutState
        icon={<AnimatedSuccessIcon />}
        title="Your workspace is ready"
        text="Your administrator credentials were sent securely to your billing email."
        action={
          loginUrl ? (
            <a href={loginUrl} className="rounded-full bg-primary px-6 py-3 font-bold text-white">
              Open workspace
            </a>
          ) : undefined
        }
      />
    );
  if (state === 'failed')
    return (
      <CheckoutState
        icon={<CircleAlert className="size-10" />}
        title="Checkout needs attention"
        text={message}
        action={
          <button
            type="button"
            onClick={() => setState(session && order ? 'payment' : 'form')}
            className="rounded-full bg-primary px-6 py-3 font-bold text-white"
          >
            {session && order ? 'Return to payment details' : 'Try again'}
          </button>
        }
      />
    );

  return (
    <main className="min-h-dvh bg-slate-100 px-4 py-5 text-slate-900 sm:px-7 lg:py-7">
      <div className="mx-auto max-w-7xl">
        <div className="flex min-h-11 items-center justify-between gap-3 rounded-2xl bg-white px-4 sm:px-5">
          <Link href="/" className="text-sm font-semibold text-primary transition hover:opacity-70">
            ← Back to Devvelocity
          </Link>
          <span className="flex shrink-0 items-center gap-2 text-xs font-semibold text-slate-500">
            <LockKeyhole className="size-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Secure invoice billing</span>
            <span className="sm:hidden">Secure</span>
          </span>
        </div>

        <div className="mt-5 grid items-start gap-5 lg:grid-cols-2">
          <motion.form
            onSubmit={submit}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-3xl bg-white p-5 sm:p-7 lg:sticky lg:top-7 lg:p-8"
          >
            <div className="flex items-center text-xs font-semibold text-slate-400">
              <span className="flex shrink-0 items-center gap-1.5 text-primary">
                <span className="flex size-5 items-center justify-center rounded-full bg-primary-50">
                  1
                </span>
                Workspace
              </span>
              <span className="mx-1.5 h-px min-w-2 flex-1 bg-slate-200 sm:mx-2 sm:max-w-6" />
              <span className="flex shrink-0 items-center gap-1.5">
                <span className="flex size-5 items-center justify-center rounded-full bg-slate-100">
                  2
                </span>
                Payment
              </span>
              <span className="mx-1.5 h-px min-w-2 flex-1 bg-slate-200 sm:mx-2 sm:max-w-6" />
              <span className="flex shrink-0 items-center gap-1.5">
                <span className="flex size-5 items-center justify-center rounded-full bg-slate-100">
                  3
                </span>
                Activation
              </span>
            </div>
            <h1 className="mt-5 text-3xl font-bold tracking-tight text-primary-900 sm:text-4xl">
              Set up your workspace
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Confirm the subscription, then tell us where to create your institution ERP.
            </p>

            <div className="mt-8 rounded-xl bg-slate-50 p-5 sm:p-6">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Subscription
              </p>
              <div className="mt-3 grid gap-4">
                {hasPreselectedPlan ? (
                  <div>
                    <p className="text-xs font-bold text-slate-600">Your selected plan</p>
                    <div className="mt-2 flex min-h-12 flex-col items-start justify-between gap-2 rounded-xl bg-primary-50 px-4 py-3 sm:flex-row sm:items-center">
                      <span className="flex items-center gap-2 text-sm font-bold text-primary-800">
                        <CheckCircle2 className="size-4 text-emerald-600" />
                        {plan?.name}
                      </span>
                      <Link
                        href="/products/college-erp#plans"
                        className="text-xs font-bold text-primary transition hover:opacity-70"
                      >
                        Change plan
                      </Link>
                    </div>
                  </div>
                ) : (
                  <label className="text-xs font-bold text-slate-600">
                    Subscription plan <RequiredMark />
                    <select
                      value={selectedPlanId}
                      onChange={(event) => setPlanId(event.target.value)}
                      className={`${fieldClass} mt-2`}
                    >
                      {plans.map((item) => (
                        <option key={item._id} value={item._id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              {!isFree && mobileAppAddon && (
                <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-lg bg-white p-4">
                  <input
                    type="checkbox"
                    checked={includeMobileApp}
                    onChange={(event) => setIncludeMobileApp(event.target.checked)}
                    className="mt-1 size-4 accent-primary"
                  />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-x-2 text-sm font-bold text-primary-900">
                      Institution mobile app
                      <span className="text-primary">
                        +₹{(mobileAppAddon.amountInPaise / 100).toLocaleString('en-IN')}/year
                      </span>
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                      Optional annual add-on. App-store accounts, white-labelling and custom
                      development are quoted separately.
                    </span>
                  </span>
                </label>
              )}
              {!isFree && (
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  Online payment-gateway integration and provider transaction charges are not
                  included and require a separate quotation.
                </p>
              )}
            </div>

            <div className="mt-8">
              <div>
                <h2 className="text-sm font-bold text-primary-900">Institution details</h2>
                <p className="mt-1 text-xs text-slate-400">
                  These details identify and secure your tenant workspace.
                </p>
              </div>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <label className="text-xs font-bold text-slate-600 sm:col-span-2">
                  Institution name <RequiredMark />
                  <input
                    required
                    minLength={2}
                    maxLength={150}
                    value={institutionName}
                    aria-invalid={Boolean(registrationErrors.institutionName)}
                    onChange={(event) => {
                      setInstitutionName(event.target.value);
                      setRegistrationErrors((current) => ({
                        ...current,
                        institutionName: undefined,
                      }));
                    }}
                    placeholder="Your college or university"
                    className={`${fieldClass} mt-2`}
                  />
                  {registrationErrors.institutionName && (
                    <span className="mt-1.5 block font-normal text-red-600">
                      {registrationErrors.institutionName}
                    </span>
                  )}
                </label>
                <label className="text-xs font-bold text-slate-600">
                  Workspace address <RequiredMark />
                  <input
                    required
                    minLength={3}
                    maxLength={40}
                    pattern="[a-z0-9][a-z0-9-]{2,39}"
                    value={tenantId}
                    aria-invalid={Boolean(registrationErrors.tenantId)}
                    onChange={(event) => {
                      setTenantId(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                      setRegistrationErrors((current) => ({
                        ...current,
                        tenantId: undefined,
                      }));
                    }}
                    placeholder="your-college"
                    className={`${fieldClass} mt-2`}
                  />
                  {registrationErrors.tenantId && (
                    <span className="mt-1.5 block font-normal text-red-600">
                      {registrationErrors.tenantId}
                    </span>
                  )}
                  <span className="mt-1.5 block font-normal leading-5 text-slate-400">
                    Choose a short, unique name such as your institution abbreviation. Your team
                    will sign in at{' '}
                    <strong className="break-all font-semibold text-primary">{workspaceUrl}</strong>
                  </span>
                </label>
                <label className="text-xs font-bold text-slate-600">
                  Administrator email <RequiredMark />
                  <input
                    required
                    type="email"
                    maxLength={254}
                    value={adminEmail}
                    aria-invalid={Boolean(registrationErrors.adminEmail)}
                    onChange={(event) => {
                      setAdminEmail(event.target.value);
                      setRegistrationErrors((current) => ({
                        ...current,
                        adminEmail: undefined,
                      }));
                    }}
                    placeholder="admin@institution.edu"
                    className={`${fieldClass} mt-2`}
                  />
                  {registrationErrors.adminEmail && (
                    <span className="mt-1.5 block font-normal text-red-600">
                      {registrationErrors.adminEmail}
                    </span>
                  )}
                </label>
                <div className="flex gap-3 rounded-lg bg-emerald-50 p-4 text-xs leading-5 text-slate-600 sm:col-span-2">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  <p>
                    A secure temporary administrator password will be generated by our server and
                    sent only to this email after your workspace is ready. You must change it on
                    first login.
                  </p>
                </div>
              </div>
            </div>

            {message && (
              <div
                role="alert"
                className="mt-5 flex gap-3 rounded-xl bg-red-50 p-4 text-sm leading-6 text-red-700"
              >
                <CircleAlert className="mt-0.5 size-4 shrink-0" />
                <span>{message}</span>
              </div>
            )}

            <CustomButton
              type="submit"
              loading={isLoading}
              loadingText={isFree ? 'Creating your workspace…' : 'Submitting registration…'}
              disabled={!plan}
              size="large"
              endIcon={<ArrowRight className="size-4" />}
              className="mt-6 rounded-xl! py-3.5!"
            >
              {isFree ? 'Start free trial' : 'Submit registration'}
            </CustomButton>
            <p className="mt-3 text-center text-xs leading-5 text-slate-400">
              {isFree
                ? 'Your secure administrator credentials will be emailed when the workspace is ready.'
                : 'We will email a private payment link after your registration is received.'}
            </p>
          </motion.form>

          <motion.aside
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.65, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-5 lg:sticky lg:top-7"
          >
            <PaymentIllustration />
            <div className="rounded-3xl bg-white p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    Order summary
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-primary-900">
                    {plan?.name ?? 'Select a plan'}
                  </h2>
                </div>
                <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-50">
                  <ShieldCheck className="size-5 text-emerald-600" />
                </span>
              </div>

              <div className="mt-5 rounded-2xl bg-primary-50 p-4">
                <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
                  <div>
                    <p className="text-3xl font-bold text-primary-900">
                      ₹{(estimatedSubtotal / 100).toLocaleString('en-IN')}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {isFree ? 'No payment required' : 'Annual subscription · GST excluded'}
                    </p>
                  </div>
                </div>
              </div>
              {includeMobileApp && mobileAppAddon && (
                <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-xs">
                  <span className="font-semibold text-slate-600">Mobile app add-on</span>
                  <span className="font-bold text-primary-900">
                    ₹{(mobileAppAddon.amountInPaise / 100).toLocaleString('en-IN')}/year
                  </span>
                </div>
              )}

              <div className="mt-4 grid grid-cols-3 gap-2">
                <SummaryMetric
                  icon={<GraduationCap className="size-4" />}
                  value={plan?.studentLimit.toLocaleString('en-IN') ?? '—'}
                  label="Students"
                />
                <SummaryMetric
                  icon={<Users className="size-4" />}
                  value={plan?.employeeLimit.toLocaleString('en-IN') ?? '—'}
                  label="Staff"
                />
                <SummaryMetric
                  icon={<LayoutDashboard className="size-4" />}
                  value={plan?.moduleSlugs.length.toString() ?? '—'}
                  label="Modules"
                />
              </div>

              <div className="mt-5 space-y-2.5 text-sm text-slate-600">
                {plan?.highlights.slice(0, 4).map((item) => (
                  <p key={item} className="flex gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                    {item}
                  </p>
                ))}
                {plan?.slug === 'enterprise' && (
                  <p className="flex gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                    Library, hostel, transport and T&amp;P are included
                  </p>
                )}
              </div>
            </div>
          </motion.aside>
        </div>
      </div>
    </main>
  );
}

function PaymentIllustration() {
  return (
    <div className="relative h-44 overflow-hidden rounded-3xl bg-primary-50 sm:h-48 lg:h-36">
      <Image
        src="/images/checkout-secure-payment.png"
        alt="Secure digital payment passing through encrypted verification before institution workspace activation"
        fill
        priority
        sizes="(min-width: 1280px) 42vw, (min-width: 768px) 80vw, 100vw"
        className="object-cover"
      />
      <div className="absolute inset-x-0 top-0 h-28 bg-linear-to-b from-primary-50/95 to-transparent" />
      <motion.div
        animate={{ x: ['-20%', '520%'] }}
        transition={{ duration: 4.2, repeat: Infinity, repeatDelay: 2, ease: 'easeInOut' }}
        className="absolute inset-y-0 w-12 -skew-x-12 bg-white/15 blur-md"
      />
      <motion.div
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-white/90 px-3 py-2 text-primary-900 backdrop-blur-md sm:bottom-5 sm:left-5"
      >
        <ShieldCheck className="size-4 text-emerald-600" />
        <p className="text-xs font-bold">Encrypted payment verification</p>
      </motion.div>
    </div>
  );
}

function CheckoutProgress({
  currentStep,
  agreementAccepted,
}: {
  currentStep: 2 | 3;
  agreementAccepted: boolean;
}) {
  const steps = [
    { number: 1, label: 'Transfer', complete: true },
    { number: 2, label: 'Payment proof', complete: currentStep > 2 },
    { number: 3, label: 'Agreement', complete: agreementAccepted },
    { number: 4, label: 'Review', complete: false },
  ];

  return (
    <nav aria-label="Checkout progress" className="mb-7 rounded-xl bg-slate-50 p-4">
      <ol className="grid grid-cols-4 gap-1">
        {steps.map((step) => {
          const active = step.number === currentStep;
          return (
            <li key={step.number} className="relative text-center">
              <div
                className={`mx-auto flex size-8 items-center justify-center rounded-full text-xs font-bold ${
                  step.complete
                    ? 'bg-emerald-100 text-emerald-700'
                    : active
                      ? 'bg-primary text-white'
                      : 'bg-slate-200 text-slate-500'
                }`}
              >
                {step.complete ? <Check className="size-4" /> : step.number}
              </div>
              <span
                className={`mt-2 block text-[10px] font-semibold sm:text-xs ${
                  active ? 'text-primary-900' : 'text-slate-500'
                }`}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function BankTransferCheckout({
  order,
  session,
  transferReference,
  paymentDate,
  paymentChannel,
  proof,
  couponCode,
  couponError,
  submissionError,
  isLoading,
  onReference,
  onPaymentDate,
  onPaymentChannel,
  onProof,
  onCouponCode,
  onApplyCoupon,
  onSubmit,
  agreementAccepted,
}: {
  order: IOrder;
  session: { id: string; token: string };
  transferReference: string;
  paymentDate: string;
  paymentChannel: 'neft' | 'rtgs' | 'imps' | 'upi';
  proof: File | null;
  couponCode: string;
  couponError: string;
  submissionError: string;
  isLoading: boolean;
  onReference: (value: string) => void;
  onPaymentDate: (value: string) => void;
  onPaymentChannel: (value: 'neft' | 'rtgs' | 'imps' | 'upi') => void;
  onProof: (value: File | null) => void;
  onCouponCode: (value: string) => void;
  onApplyCoupon: () => Promise<void>;
  onSubmit: () => Promise<boolean>;
  agreementAccepted: boolean;
}) {
  const bank = order.bankTransfer;
  const [copied, setCopied] = useState('');
  const [showAgreement, setShowAgreement] = useState(false);
  const [agreementVerified, setAgreementVerified] = useState(agreementAccepted);
  const formik = useFormik({
    initialValues: { transferReference, paymentDate, paymentChannel, proof },
    validationSchema: paymentConfirmationSchema,
    validateOnBlur: true,
    validateOnChange: true,
    onSubmit: async () => {
      if (agreementVerified) await onSubmit();
      else setShowAgreement(true);
    },
  });
  const formatAmount = (amount: number) => `₹${(amount / 100).toLocaleString('en-IN')}`;
  const copyValue = async (label: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(''), 1800);
  };
  const bankDetails = [
    ['Beneficiary', bank.accountHolderName],
    ['Bank name', bank.bankName],
    ['Account number', bank.accountNumber],
    ['IFSC code', bank.ifscCode],
    ['Branch', bank.branch || 'Not available'],
    ['UPI ID', bank.upiId || 'Not available'],
  ];

  return (
    <main className="relative min-h-dvh bg-slate-100 text-slate-900">
      <div className="pointer-events-none absolute -left-32 top-20 size-96 rounded-full bg-primary-100/50 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 bottom-0 size-96 rounded-full bg-cyan-100/50 blur-3xl" />

      <header className="relative mx-auto flex w-full max-w-7xl shrink-0 items-center justify-between gap-3 px-4 py-4 sm:px-8 sm:py-5 lg:px-10 lg:py-3">
        <Link href="/" aria-label="Devvelocity home" className="shrink-0">
          <Image
            src="/devvelocitylogo.webp"
            alt="Devvelocity"
            width={150}
            height={46}
            priority
            className="h-8 w-auto sm:h-9"
          />
        </Link>
        <span className="flex shrink-0 items-center gap-2 rounded-full bg-white/80 px-3 py-2 text-xs font-bold text-slate-500 backdrop-blur-xl">
          <LockKeyhole className="size-3.5 text-emerald-600" />
          <span className="hidden sm:inline">Private &amp; encrypted checkout</span>
          <span className="sm:hidden">Secure</span>
        </span>
      </header>

      <div className="relative mx-auto grid w-full max-w-7xl items-start gap-10 bg-white p-5 sm:rounded-xl sm:p-8 lg:mb-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14 lg:p-10">
        <motion.aside
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="relative min-w-0 text-slate-900"
        >
          <div className="relative">
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
              <ShieldCheck className="size-3.5 text-emerald-600" />
              Secure payment request
            </span>
            <h1 className="mt-3 max-w-md text-2xl font-bold tracking-tight text-primary-900">
              Transfer to this account
            </h1>
            <p className="mt-2 max-w-md text-sm leading-5 text-slate-500">
              Invoice <strong className="text-primary-900">#{order.invoiceNumber}</strong> for{' '}
              <strong className="font-semibold text-primary-900">{order.tenantName}</strong>
            </p>
          </div>

          <div className="mt-6 flex items-end justify-between gap-4 rounded-lg bg-primary-50 px-5 py-5 text-primary-900">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Exact amount
              </p>
              <p className="mt-1 wrap-break-word text-3xl font-extrabold tracking-tighter sm:text-4xl">
                {formatAmount(order.amount)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void copyValue('Amount', (order.amount / 100).toFixed(2))}
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-primary transition hover:bg-primary-100"
            >
              {copied === 'Amount' ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied === 'Amount' ? 'Copied' : 'Copy'}
            </button>
          </div>

          <section className="mt-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-primary-900">Beneficiary details</h2>
                <p className="mt-0.5 text-xs text-slate-400">NEFT, RTGS, IMPS or UPI</p>
              </div>
              <ShieldCheck className="size-5 shrink-0 text-emerald-600" />
            </div>
            <dl className="mt-4 grid gap-x-8 gap-y-2 rounded-lg bg-slate-50 px-5 py-3 sm:grid-cols-2">
              {bankDetails.map(([label, value]) => (
                <div key={label} className="group min-w-0 py-2.5">
                  <dt className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    {label}
                  </dt>
                  <dd className="mt-1 flex min-w-0 items-center justify-between gap-3">
                    <span className="break-all text-sm font-bold text-primary-900">{value}</span>
                    <button
                      type="button"
                      aria-label={`Copy ${label}`}
                      onClick={() => void copyValue(label, value)}
                      className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white text-slate-400 transition hover:text-primary"
                    >
                      {copied === label ? (
                        <Check className="size-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </button>
                  </dd>
                </div>
              ))}
            </dl>
            {bank.instructions && (
              <details className="group mt-4 rounded-lg bg-amber-50 px-4 py-3 text-amber-800">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-bold">
                  <span className="flex items-center gap-2">
                    <CircleAlert className="size-4 shrink-0" />
                    Transfer instructions
                  </span>
                  <ChevronDown className="size-4 transition group-open:rotate-180" />
                </summary>
                <p className="mt-2 text-xs leading-5">{bank.instructions}</p>
              </details>
            )}
          </section>
        </motion.aside>

        <motion.form
          onSubmit={formik.handleSubmit}
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="min-w-0"
        >
          <CheckoutProgress
            currentStep={showAgreement ? 3 : 2}
            agreementAccepted={agreementVerified}
          />
          {showAgreement ? (
            <AgreementAcceptance
              session={session}
              billingEmail={order.billingEmail}
              onBack={() => {
                setShowAgreement(false);
                formik.setTouched({
                  transferReference: true,
                  paymentDate: true,
                  paymentChannel: true,
                  proof: true,
                });
              }}
              onAccepted={async () => {
                setAgreementVerified(true);
                return onSubmit();
              }}
              submissionError={submissionError}
            />
          ) : (
            <>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-primary">Step 2</p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-primary-900">
                  Confirm your transfer
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Enter the bank reference and attach your receipt.
                </p>
              </div>

              <InvoiceOptions
                order={order}
                couponCode={couponCode}
                couponError={couponError}
                isLoading={isLoading}
                onCouponCode={onCouponCode}
                onApplyCoupon={onApplyCoupon}
              />

              <section className="mt-7">
                <div className="rounded-xl bg-slate-50 p-5 sm:p-6">
                  <fieldset>
                    <legend className="text-xs font-bold text-slate-600">
                      Payment method <RequiredMark />
                    </legend>
                    <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg bg-slate-200 p-1 sm:grid-cols-4 sm:gap-0">
                      {(['neft', 'rtgs', 'imps', 'upi'] as const).map((method) => (
                        <button
                          key={method}
                          type="button"
                          aria-pressed={paymentChannel === method}
                          onClick={() => {
                            void formik.setFieldValue('paymentChannel', method);
                            formik.setFieldTouched('paymentChannel', true, false);
                            onPaymentChannel(method);
                          }}
                          className={`rounded-md px-2 py-2.5 text-xs font-bold uppercase transition ${
                            paymentChannel === method
                              ? 'bg-white text-primary'
                              : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          {method}
                        </button>
                      ))}
                    </div>
                    {formik.touched.paymentChannel && formik.errors.paymentChannel && (
                      <span className="mt-1.5 block font-normal text-red-600">
                        {formik.errors.paymentChannel}
                      </span>
                    )}
                  </fieldset>

                  <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    <label className="block text-xs font-bold text-slate-600">
                      Bank transaction reference / UTR <RequiredMark />
                      <input
                        id="transferReference"
                        name="transferReference"
                        required
                        minLength={8}
                        maxLength={50}
                        pattern="[A-Za-z0-9][A-Za-z0-9-]{7,49}"
                        value={formik.values.transferReference}
                        aria-invalid={Boolean(
                          formik.touched.transferReference && formik.errors.transferReference,
                        )}
                        onBlur={formik.handleBlur}
                        onChange={(event) => {
                          const value = event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
                          void formik.setFieldValue('transferReference', value);
                          onReference(value);
                        }}
                        placeholder="Enter the reference from your bank"
                        className={`${fieldClass} mt-1 lg:py-2`}
                      />
                      {formik.touched.transferReference && formik.errors.transferReference && (
                        <span className="mt-1.5 block font-normal text-red-600">
                          {formik.errors.transferReference}
                        </span>
                      )}
                      {submissionError && !formik.errors.transferReference && (
                        <span className="mt-1.5 block font-normal text-red-600">
                          {submissionError}
                        </span>
                      )}
                    </label>
                    <label className="block text-xs font-bold text-slate-600">
                      Payment date <RequiredMark />
                      <input
                        id="paymentDate"
                        name="paymentDate"
                        required
                        type="date"
                        max={new Date().toISOString().slice(0, 10)}
                        value={formik.values.paymentDate}
                        aria-invalid={Boolean(
                          formik.touched.paymentDate && formik.errors.paymentDate,
                        )}
                        onBlur={formik.handleBlur}
                        onChange={(event) => {
                          void formik.setFieldValue('paymentDate', event.target.value);
                          onPaymentDate(event.target.value);
                        }}
                        className={`${fieldClass} mt-1 lg:py-2`}
                      />
                      {formik.touched.paymentDate && formik.errors.paymentDate && (
                        <span className="mt-1.5 block font-normal text-red-600">
                          {formik.errors.paymentDate}
                        </span>
                      )}
                    </label>
                  </div>
                  <label className="mt-5 block text-xs font-bold text-slate-600">
                    Payment receipt or screenshot <RequiredMark />
                    <span
                      className={`mt-2 flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-lg px-4 text-center transition ${proof ? 'bg-emerald-50 text-emerald-700' : 'bg-white text-slate-500 hover:bg-primary-50'}`}
                    >
                      {formik.values.proof ? (
                        <FileCheck2 className="size-6" />
                      ) : (
                        <Upload className="size-6 text-primary" />
                      )}
                      <span className="mt-1 text-sm font-semibold">
                        {formik.values.proof?.name ?? 'Upload PDF or payment screenshot'}
                      </span>
                      <span className="mt-1 text-xs">
                        {formik.values.proof
                          ? 'Ready to submit securely'
                          : 'PDF, PNG, JPG or WEBP · maximum 5 MB'}
                      </span>
                      <input
                        id="proof"
                        name="proof"
                        required
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.webp"
                        onBlur={formik.handleBlur}
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          void formik.setFieldValue('proof', file);
                          formik.setFieldTouched('proof', true, false);
                          onProof(file);
                        }}
                        className="sr-only"
                      />
                    </span>
                    {formik.touched.proof && formik.errors.proof && (
                      <span className="mt-1.5 block font-normal text-red-600">
                        {formik.errors.proof}
                      </span>
                    )}
                  </label>
                  <CustomButton
                    type="submit"
                    loading={isLoading}
                    loadingText="Uploading securely…"
                    disabled={isLoading || formik.isSubmitting}
                    size="large"
                    endIcon={<ClipboardCheck className="size-4" />}
                    className="mt-5 rounded-lg! py-3!"
                  >
                    {agreementVerified ? 'Submit payment confirmation' : 'Continue to agreement'}
                  </CustomButton>
                </div>
              </section>

              <p className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                <ShieldCheck className="size-4 shrink-0 text-emerald-600" />
                Encrypted submission · Verified manually before activation
              </p>
            </>
          )}
        </motion.form>
      </div>
    </main>
  );
}

function InvoiceOptions({
  order,
  couponCode,
  couponError,
  isLoading,
  onCouponCode,
  onApplyCoupon,
}: {
  order: IOrder;
  couponCode: string;
  couponError: string;
  isLoading: boolean;
  onCouponCode: (value: string) => void;
  onApplyCoupon: () => Promise<void>;
}) {
  const annualSavingPercent =
    order.listPrice > 0 ? Math.round((order.annualDiscount / order.listPrice) * 1000) / 10 : 0;

  return (
    <details open className="group mt-5 rounded-xl bg-slate-50">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3">
        <span className="flex items-center gap-3">
          <ReceiptText className="size-4 text-primary" />
          <span className="text-sm font-bold text-primary-900">Invoice summary &amp; coupon</span>
        </span>
        <ChevronDown className="size-4 text-slate-400 transition group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-4">
        <div className="space-y-2 text-xs">
          {(order.lineItems ?? []).map((item) => (
            <div
              key={`${item.kind}-${item.slug}`}
              className="flex justify-between gap-4 text-slate-500"
            >
              <span>
                {item.description}
                <span className="ml-1 text-slate-400">· {item.billingLabel}</span>
              </span>
              <strong className="shrink-0 text-slate-700">
                ₹{(item.amountInPaise / 100).toLocaleString('en-IN')}
              </strong>
            </div>
          ))}
          <div className="my-2 border-t border-slate-200" />
          <div className="flex justify-between gap-4 text-slate-500">
            <span>List price</span>
            <strong className="text-slate-700">
              ₹{(order.listPrice / 100).toLocaleString('en-IN')}
            </strong>
          </div>
          {order.annualDiscount > 0 && (
            <div className="flex justify-between gap-4 text-emerald-700">
              <span>Annual saving ({annualSavingPercent}%)</span>
              <strong>− ₹{(order.annualDiscount / 100).toLocaleString('en-IN')}</strong>
            </div>
          )}
          {order.couponDiscount > 0 && (
            <div className="flex justify-between gap-4 text-emerald-700">
              <span>Coupon {order.couponCode ? `(${order.couponCode})` : ''}</span>
              <strong>− ₹{(order.couponDiscount / 100).toLocaleString('en-IN')}</strong>
            </div>
          )}
          <div className="flex justify-between gap-4 text-slate-500">
            <span>Taxable value</span>
            <strong className="text-slate-700">
              ₹{(order.subtotal / 100).toLocaleString('en-IN')}
            </strong>
          </div>
          <div className="flex justify-between gap-4 text-slate-500">
            <span>GST ({order.taxRatePercent}%)</span>
            <strong className="text-slate-700">
              ₹{(order.taxAmount / 100).toLocaleString('en-IN')}
            </strong>
          </div>
          <div className="flex justify-between gap-4 pt-1 font-bold text-primary-900">
            <span>Total</span>
            <strong>₹{(order.amount / 100).toLocaleString('en-IN')}</strong>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={order.couponCode || couponCode}
            disabled={Boolean(order.couponCode) || isLoading}
            maxLength={32}
            onChange={(event) =>
              onCouponCode(event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))
            }
            placeholder="Coupon code"
            aria-label="Coupon code"
            className={`${fieldClass} min-w-0 uppercase disabled:text-emerald-700`}
          />
          <button
            type="button"
            disabled={!couponCode.trim() || Boolean(order.couponCode) || isLoading}
            onClick={() => void onApplyCoupon()}
            className="shrink-0 rounded-xl bg-primary px-4 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {order.couponCode ? 'Applied' : isLoading ? 'Checking…' : 'Apply'}
          </button>
        </div>
        {couponError && (
          <p
            role="alert"
            className="mt-2 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
          >
            <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
            {couponError}
          </p>
        )}
      </div>
    </details>
  );
}

function AgreementAcceptance({
  session,
  billingEmail,
  onBack,
  onAccepted,
  submissionError,
}: {
  session: { id: string; token: string };
  billingEmail: string;
  onBack: () => void;
  onAccepted: () => Promise<boolean>;
  submissionError?: string;
}) {
  const { mutation, isLoading } = useMutation();
  const [documents, setDocuments] = useState<IAgreementDocument[]>([]);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [acceptanceId, setAcceptanceId] = useState('');
  const [signatoryName, setSignatoryName] = useState('');
  const [signatoryDesignation, setSignatoryDesignation] = useState('');
  const [ndaAccepted, setNdaAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [authorityConfirmed, setAuthorityConfirmed] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpSecondsRemaining, setOtpSecondsRemaining] = useState(0);
  const [resendSecondsRemaining, setResendSecondsRemaining] = useState(0);
  const [reviewedDocuments, setReviewedDocuments] = useState<Set<'nda' | 'terms'>>(new Set());
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [documentsError, setDocumentsError] = useState('');
  const submissionStarted = useRef(false);
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'submitting' | 'failed'>(
    'idle',
  );

  const loadDocuments = useCallback(async () => {
    await mutation('super-admin/public-checkout/agreements', {
      method: 'POST',
      body: { sessionId: session.id, sessionToken: session.token },
      dedupe: false,
      suppressErrorToast: true,
    })
      .then((response) => {
        const result = response?.results as IAgreementResponse | undefined;
        if (!result?.data) {
          setDocumentsError('The agreement PDFs could not be prepared. Please try again.');
          return;
        }
        setDocuments(result.data.documents);
        setMaskedEmail(result.data.maskedEmail);
        setAccepted(result.data.accepted);
        setAcceptanceId(result.data.acceptanceId ?? '');
      })
      .finally(() => setDocumentsLoading(false));
  }, [mutation, session.id, session.token]);
  const retryDocuments = () => {
    setDocumentsLoading(true);
    setDocumentsError('');
    void loadDocuments();
  };

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    if (!accepted || submissionStarted.current) return;
    submissionStarted.current = true;
    setSubmissionStatus('submitting');
    void onAccepted().then((submitted) => {
      if (submitted) return;
      setSubmissionStatus('failed');
    });
  }, [accepted, onAccepted]);

  useEffect(() => {
    if (!otpSent) return;
    const timer = window.setInterval(() => {
      setOtpSecondsRemaining((current) => Math.max(0, current - 1));
      setResendSecondsRemaining((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [otpSent]);

  const canRequestOtp =
    signatoryName.trim().length >= 2 &&
    signatoryDesignation.trim().length >= 2 &&
    ndaAccepted &&
    termsAccepted &&
    authorityConfirmed &&
    reviewedDocuments.has('nda') &&
    reviewedDocuments.has('terms');
  const acceptCompleteAgreement = () => {
    setReviewedDocuments(new Set(['nda', 'terms']));
    setNdaAccepted(true);
    setTermsAccepted(true);
  };

  const sendOtp = async () => {
    if (!canRequestOtp) return;
    const response = await mutation('super-admin/public-checkout/agreement/send-otp', {
      method: 'POST',
      body: {
        sessionId: session.id,
        sessionToken: session.token,
        signatoryName: signatoryName.trim(),
        signatoryDesignation: signatoryDesignation.trim(),
        ndaAccepted,
        termsAccepted,
        signatoryAuthorityConfirmed: authorityConfirmed,
      },
      dedupe: false,
      isAlert: true,
    });
    const result = response?.results as {
      data?: {
        sent?: boolean;
        accepted?: boolean;
        acceptanceId?: string;
        expiresInSeconds?: number;
      };
    };
    if (result?.data?.accepted) {
      setAccepted(true);
      setAcceptanceId(result.data.acceptanceId ?? '');
      return;
    }
    if (result?.data?.sent) {
      setOtp('');
      setOtpSecondsRemaining(result.data.expiresInSeconds ?? 300);
      setResendSecondsRemaining(60);
      setOtpSent(true);
    }
  };

  const verifyOtp = async () => {
    if (!/^\d{6}$/.test(otp) || otpSecondsRemaining <= 0) return;
    const response = await mutation('super-admin/public-checkout/agreement/verify-otp', {
      method: 'POST',
      body: {
        sessionId: session.id,
        sessionToken: session.token,
        otp,
      },
      dedupe: false,
      isAlert: true,
    });
    const result = response?.results as {
      data?: { accepted?: boolean; acceptanceId?: string };
    };
    if (!result?.data?.accepted) return;
    setAccepted(true);
    setAcceptanceId(result.data.acceptanceId ?? '');
  };
  const formatCountdown = (seconds: number) =>
    `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  if (accepted) {
    return (
      <div className="flex h-full flex-col justify-center">
        <AnimatedSuccessIcon />
        <p className="mt-5 text-xs font-bold uppercase tracking-widest text-emerald-600">
          Agreements verified
        </p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-primary-900">
          Your acceptance is securely recorded
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          The NDA and Subscription Terms were accepted using the registered billing email.
        </p>
        {acceptanceId && (
          <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500">
            Acceptance ID: <span className="break-all text-primary-900">{acceptanceId}</span>
          </p>
        )}
        {submissionStatus === 'failed' ? (
          <div className="mt-6 rounded-xl bg-red-50 p-4">
            <p className="text-sm font-semibold leading-6 text-red-700">
              {submissionError || 'The secure submission did not complete. Please retry.'}
            </p>
            <CustomButton
              type="button"
              onClick={onBack}
              endIcon={<ArrowRight className="size-4 rotate-180" />}
              className="mt-3 rounded-xl! py-3.5!"
            >
              Review payment details
            </CustomButton>
          </div>
        ) : (
          <div className="mt-6 flex items-center gap-3 rounded-xl bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-800">
            <LoaderCircle className="size-5 shrink-0 animate-spin" />
            Submitting your payment details securely…
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="text-xs font-bold text-slate-500 transition hover:text-primary"
      >
        ← Back to payment details
      </button>
      <p className="mt-4 text-xs font-bold uppercase tracking-widest text-primary">
        Agreement acceptance
      </p>
      <h2 className="mt-1 text-2xl font-bold tracking-tight text-primary-900">
        Review and authorize your subscription
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        Review both versioned documents, confirm your authority, then verify using the code sent to{' '}
        <strong className="break-all text-slate-700">{maskedEmail || billingEmail}</strong>.
      </p>

      {documentsLoading ? (
        <div className="mt-6 flex min-h-72 items-center justify-center rounded-xl bg-slate-50">
          <div className="text-center">
            <LoaderCircle className="mx-auto size-6 animate-spin text-primary" />
            <p className="mt-2 text-xs font-semibold text-slate-500">
              Preparing protected PDF copies…
            </p>
          </div>
        </div>
      ) : documentsError ? (
        <div className="mt-6 rounded-xl bg-red-50 p-5 text-sm text-red-700">
          <p className="font-bold">Agreement PDFs unavailable</p>
          <p className="mt-1 text-xs">{documentsError}</p>
          <button
            type="button"
            onClick={retryDocuments}
            className="mt-3 rounded-lg bg-white px-4 py-2 text-xs font-bold"
          >
            Retry PDF preparation
          </button>
        </div>
      ) : (
        <section className="mt-5 overflow-hidden rounded-xl bg-slate-100">
          <div className="bg-primary-900 px-5 py-4 text-white">
            <p className="text-sm font-bold">Complete subscription agreement</p>
            <p className="mt-1 text-xs leading-5 text-white/70">
              One acceptance covers both versioned documents shown below.
            </p>
          </div>
          <div className="space-y-4 p-3 sm:p-4">
            {documents.map((document, index) => (
              <article key={document.kind} className="overflow-hidden rounded-lg bg-white">
                <div className="flex items-start justify-between gap-3 bg-primary-50 px-4 py-3">
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-primary-900">{document.title}</h3>
                    <p className="mt-1 truncate text-[10px] text-slate-500">
                      Version {document.version} · SHA-256 {document.hash.slice(0, 12)}…
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] font-bold text-primary">
                    {index + 1} of {documents.length}
                  </span>
                </div>
                <iframe
                  title={`${document.title} PDF`}
                  src={document.pdfDataUrl}
                  className="h-[58dvh] min-h-96 w-full bg-white"
                />
              </article>
            ))}
          </div>
          <div className="bg-white p-5">
            <button
              type="button"
              onClick={acceptCompleteAgreement}
              className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-bold ${
                reviewedDocuments.size === 2
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-primary text-white'
              }`}
            >
              {reviewedDocuments.size === 2 && <CheckCircle2 className="size-4" />}
              {reviewedDocuments.size === 2
                ? 'Complete agreement reviewed'
                : 'I have reviewed the complete agreement'}
            </button>
          </div>
        </section>
      )}

      {!otpSent ? (
        <>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="text-xs font-bold text-slate-600">
              Authorized signatory name <RequiredMark />
              <input
                value={signatoryName}
                maxLength={120}
                onChange={(event) => setSignatoryName(event.target.value)}
                placeholder="Full legal name"
                className={`${fieldClass} mt-1`}
              />
            </label>
            <label className="text-xs font-bold text-slate-600">
              Designation <RequiredMark />
              <input
                value={signatoryDesignation}
                maxLength={120}
                onChange={(event) => setSignatoryDesignation(event.target.value)}
                placeholder="Director, Principal, Trustee…"
                className={`${fieldClass} mt-1`}
              />
            </label>
          </div>
          <div className="mt-5 space-y-4 rounded-xl bg-primary-50 p-5">
            <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
              <span className={ndaAccepted ? 'text-emerald-700' : 'text-slate-400'}>
                {ndaAccepted ? '✓ NDA included' : '○ NDA pending'}
              </span>
              <span className={termsAccepted ? 'text-emerald-700' : 'text-slate-400'}>
                {termsAccepted ? '✓ Terms included' : '○ Terms pending'}
              </span>
            </div>
            <label
              className={`flex items-start gap-3 ${
                reviewedDocuments.size < 2 ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
              }`}
            >
              <input
                type="checkbox"
                checked={authorityConfirmed}
                disabled={reviewedDocuments.size < 2}
                onChange={(event) => setAuthorityConfirmed(event.target.checked)}
                className="mt-0.5 size-4 accent-primary"
              />
              <span className="text-xs leading-5 text-slate-600">
                I confirm that I am authorized to accept these documents for the institution.{' '}
                <RequiredMark />
              </span>
            </label>
            {reviewedDocuments.size < 2 && (
              <p className="text-xs font-semibold text-primary">
                Review the complete agreement above before confirming your authority.
              </p>
            )}
          </div>
          <CustomButton
            type="button"
            onClick={() => void sendOtp()}
            loading={isLoading}
            loadingText="Sending verification code…"
            disabled={!canRequestOtp || documents.length !== 2}
            endIcon={<MailCheck className="size-4" />}
            className="mt-5 rounded-lg! py-3.5!"
          >
            Accept and send verification code
          </CustomButton>
        </>
      ) : (
        <div className="mt-5 rounded-2xl bg-primary-50 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-primary-900">
                Enter the email verification code
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Enter the six-digit code sent to {maskedEmail || billingEmail}.
              </p>
            </div>
            <span
              className={`shrink-0 rounded-xl px-3 py-2 text-center ${
                otpSecondsRemaining > 60
                  ? 'bg-white text-primary-900'
                  : otpSecondsRemaining > 0
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-red-100 text-red-700'
              }`}
            >
              <span className="block text-[9px] font-bold uppercase tracking-wider">
                Expires in
              </span>
              <span className="mt-0.5 block font-mono text-base font-black">
                {formatCountdown(otpSecondsRemaining)}
              </span>
            </span>
          </div>
          {otpSecondsRemaining === 0 && (
            <p className="mt-3 rounded-xl bg-red-100 px-3 py-2 text-xs font-semibold text-red-700">
              This code has expired. Request a new code before continuing.
            </p>
          )}
          <input
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-label="Six-digit verification code"
            placeholder="000000"
            className="mt-4 w-full rounded-xl bg-white px-4 py-3 text-center text-xl font-bold tracking-widest text-primary-900 outline-none ring-primary focus:ring-2"
          />
          <CustomButton
            type="button"
            onClick={() => void verifyOtp()}
            loading={isLoading}
            loadingText="Verifying and submitting…"
            disabled={otp.length !== 6 || otpSecondsRemaining <= 0}
            endIcon={<ShieldCheck className="size-4" />}
            className="mt-3 rounded-xl! py-3.5!"
          >
            Verify and submit payment
          </CustomButton>
          <div className="mt-3 flex flex-col items-center justify-between gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                setOtp('');
                setOtpSent(false);
                setOtpSecondsRemaining(0);
                setResendSecondsRemaining(0);
              }}
              className="text-xs font-bold text-slate-500 hover:text-primary"
            >
              Change signatory details
            </button>
            <button
              type="button"
              disabled={resendSecondsRemaining > 0 || isLoading}
              onClick={() => void sendOtp()}
              className="text-xs font-bold text-primary disabled:cursor-not-allowed disabled:text-slate-400"
            >
              {resendSecondsRemaining > 0
                ? `Resend available in ${formatCountdown(resendSecondsRemaining)}`
                : isLoading
                  ? 'Sending new code…'
                  : 'Resend verification code'}
            </button>
          </div>
        </div>
      )}

      <p className="mt-4 text-xs leading-5 text-slate-400">
        This creates an OTP-verified acceptance record and audit certificate. It is not represented
        as a statutory eSign or stamped instrument.
      </p>
    </div>
  );
}

function PaymentReviewConfirmation({
  billingEmail,
  tenantName,
  invoiceNumber,
}: {
  billingEmail?: string;
  tenantName?: string;
  invoiceNumber?: string;
}) {
  const reviewSteps = [
    {
      icon: <UserCheck key="verification" className="size-5" />,
      title: 'Payment verification',
      text: 'Our billing team will match your transaction reference and payment proof with the received funds.',
    },
    {
      icon: <Building2 key="workspace" className="size-5" />,
      title: 'Workspace preparation',
      text: 'After approval, we will securely activate and prepare your institution workspace.',
    },
    {
      icon: <MailCheck key="email" className="size-5" />,
      title: 'Welcome email',
      text: 'Your administrator will receive the workspace link and temporary login credentials by email.',
    },
  ];

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-slate-50 p-4 text-slate-900 sm:p-8">
      <div className="pointer-events-none absolute -left-32 top-10 size-96 rounded-full bg-primary-100/60 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-0 size-96 rounded-full bg-emerald-100/60 blur-3xl" />

      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-3xl overflow-hidden rounded-3xl bg-white p-5 sm:rounded-4xl sm:p-8 lg:p-10"
      >
        <div className="text-center">
          <span className="mx-auto flex justify-center">
            <AnimatedSuccessIcon />
          </span>
          <p className="mt-5 text-xs font-bold uppercase tracking-widest text-emerald-600">
            Confirmation received
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-primary-900 sm:text-4xl">
            Your payment details were submitted successfully
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500 sm:text-base">
            Thank you{tenantName ? `, ${tenantName}` : ''}. Your payment is now awaiting
            verification. No further action is required unless our billing team contacts you.
          </p>
        </div>

        <div className="mt-7 flex flex-col items-center justify-between gap-4 rounded-3xl bg-primary-50 p-5 text-center sm:flex-row sm:text-left">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white text-primary">
            <Clock3 className="size-6" />
          </span>
          <div className="flex-1">
            <p className="font-bold text-primary-900">Expected completion: 1–24 business hours</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Verification time may vary based on banking hours and transaction settlement.
            </p>
          </div>
          {invoiceNumber && (
            <span className="rounded-full bg-white px-4 py-2 text-xs font-bold text-slate-500">
              Invoice #{invoiceNumber}
            </span>
          )}
        </div>

        <div className="mt-7 grid gap-3 md:grid-cols-3">
          {reviewSteps.map((step, index) => (
            <div key={step.title} className="rounded-3xl bg-slate-50 p-5">
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl bg-white text-primary">
                  {step.icon}
                </span>
                <span className="text-xs font-bold text-slate-300">0{index + 1}</span>
              </div>
              <h2 className="mt-4 text-sm font-bold text-primary-900">{step.title}</h2>
              <p className="mt-2 text-xs leading-5 text-slate-500">{step.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-start gap-3 rounded-2xl bg-emerald-50 p-4">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" />
          <p className="text-xs leading-5 text-emerald-800">
            We will send the approval confirmation, workspace link, and administrator credentials
            {billingEmail ? (
              <>
                {' '}
                to <strong className="break-all">{billingEmail}</strong>
              </>
            ) : (
              ' to your registered billing email'
            )}
            . Please also check your spam or promotions folder.
          </p>
        </div>

        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex justify-center rounded-full bg-primary px-6 py-3 text-sm font-bold text-white transition hover:bg-primary-600"
          >
            Return to Devvelocity
          </Link>
          <button
            type="button"
            onClick={() => window.close()}
            className="inline-flex justify-center rounded-full bg-slate-100 px-6 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-200"
          >
            Close this tab
          </button>
        </div>
      </motion.section>
    </main>
  );
}

function SummaryMetric({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <span className="text-primary">{icon}</span>
      <p className="mt-2 text-sm font-bold text-primary-900">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}

function AnimatedSuccessIcon() {
  return (
    <motion.span
      initial={{ scale: 0.45, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 240, damping: 16 }}
      className="relative flex size-20 items-center justify-center"
    >
      <motion.span
        initial={{ scale: 0.75, opacity: 0 }}
        animate={{ scale: [0.75, 1.14, 1], opacity: 1 }}
        transition={{ duration: 0.65, ease: 'easeOut' }}
        className="absolute inset-0 rounded-full bg-emerald-100"
      />
      <motion.span
        initial={{ scale: 0.5, rotate: -12, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ delay: 0.18, duration: 0.45 }}
        className="relative flex size-12 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xl"
      >
        <Check className="size-7" strokeWidth={3} />
      </motion.span>
    </motion.span>
  );
}

function CheckoutState({
  icon,
  title,
  text,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 p-5">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 text-center sm:rounded-4xl sm:p-10">
        <span className="mx-auto flex size-20 items-center justify-center rounded-full bg-primary-50 text-primary">
          {icon}
        </span>
        <h1 className="mt-6 text-2xl font-bold text-primary-800 sm:text-3xl">{title}</h1>
        <p className="mt-3 text-sm leading-7 text-slate-500">{text}</p>
        {action && <div className="mt-7">{action}</div>}
      </div>
    </main>
  );
}
