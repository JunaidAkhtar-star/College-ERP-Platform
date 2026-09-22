import Image from 'next/image';
import { headers } from 'next/headers';
import { ArrowRight, Building2, CircleHelp, LockKeyhole, ShieldCheck } from 'lucide-react';

const websiteUrl = process.env.NEXT_PUBLIC_WEBSITE_URL || 'https://devvelocity.in';

/** Neutral entry page shown only when no institution tenant can be resolved. */
export default async function ProductGatewayPage() {
  const requestHeaders = await headers();
  const currentHost = requestHeaders.get('host') || 'this address';

  return (
    <main className="relative min-h-dvh overflow-x-hidden lg:h-dvh lg:overflow-hidden bg-[#fffdf9] text-[#172033]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(1,120,215,0.10),transparent_30%),radial-gradient(circle_at_88%_75%,rgba(155,185,79,0.10),transparent_28%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(23,32,51,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(23,32,51,0.035)_1px,transparent_1px)] bg-[size:42px_42px] [mask-image:linear-gradient(to_bottom,black,transparent_82%)]" />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-[1440px] flex-col px-5 py-6 sm:px-10 lg:px-16">
        <header className="flex items-center justify-between">
          <a href={websiteUrl} aria-label="Devvelocity website">
            <Image
              src="/devvelocitylogo.webp"
              alt="Devvelocity"
              width={210}
              height={58}
              priority
              className="h-11 w-auto object-contain"
            />
          </a>
          <a
            href={`${websiteUrl}/contact`}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-[#516071] transition hover:text-[#0178d7]"
          >
            <CircleHelp size={16} /> Get help
          </a>
        </header>

        <section className="my-auto grid items-center gap-10 py-10 lg:min-h-0 lg:grid-cols-[1.08fr_.92fr] lg:py-4">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#eaf4fb] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#0178d7]">
              <LockKeyhole size={15} /> Institution access required
            </div>
            <h1 className="mt-7 text-4xl font-bold leading-[1.06] tracking-[-0.045em] sm:text-5xl lg:text-6xl">
              Open your institution&apos;s dedicated workspace.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#667085]">
              Devvelocity ERP is available only through an organization-specific subdomain or an
              approved custom domain. This address is not connected to an institution.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={websiteUrl}
                className="inline-flex items-center gap-2 rounded-full bg-[#0178d7] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#0168bc]"
              >
                Visit Devvelocity <ArrowRight size={17} />
              </a>
              <a
                href={`${websiteUrl}/contact`}
                className="inline-flex items-center gap-2 rounded-full bg-[#edf5fb] px-6 py-3.5 text-sm font-bold text-[#273549] transition hover:bg-[#e2eef7]"
              >
                Contact support
              </a>
            </div>

            <p className="mt-8 text-sm text-[#8792a4]">
              Current host: <span className="font-semibold text-[#5d6879]">{currentHost}</span>
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-xl">
            <div className="rounded-[2rem] bg-white p-6  sm:p-8">
              <div className="flex items-center gap-4 border-b border-[#e5edf3] pb-6">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#eaf4fb] text-[#0178d7]">
                  <Building2 size={23} />
                </span>
                <div>
                  <p className="font-bold text-[#172033]">How institution access works</p>
                  <p className="mt-1 text-sm text-[#788497]">Your organization controls its URL.</p>
                </div>
              </div>

              <div className="mt-6 space-y-5">
                {[
                  [
                    '01',
                    'Use your assigned address',
                    'Open the workspace URL supplied by your institution administrator.',
                  ],
                  [
                    '02',
                    'Custom domains are supported',
                    'Organizations can securely map their approved ERP domain.',
                  ],
                  [
                    '03',
                    'Tenant identity is mandatory',
                    'Login is displayed only after the organization has been resolved.',
                  ],
                ].map(([number, title, description]) => (
                  <div key={number} className="grid grid-cols-[2.5rem_1fr] gap-3">
                    <span className="text-sm font-bold text-[#0178d7]">{number}</span>
                    <div>
                      <p className="text-sm font-bold text-[#273549]">{title}</p>
                      <p className="mt-1 text-sm leading-6 text-[#788497]">{description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-7 grid gap-3 border-t border-[#e5edf3] pt-6 sm:grid-cols-3">
                <div className="rounded-2xl bg-[#f3f7fa] p-4">
                  <ShieldCheck size={19} className="text-[#0178d7]" />
                  <p className="mt-3 text-xs font-bold text-[#344054]">Encrypted access</p>
                  <p className="mt-1 text-xs leading-5 text-[#788497]">
                    Protected HTTPS connections
                  </p>
                </div>
                <div className="rounded-2xl bg-[#f3f7fa] p-4">
                  <LockKeyhole size={19} className="text-[#0178d7]" />
                  <p className="mt-3 text-xs font-bold text-[#344054]">Tenant isolated</p>
                  <p className="mt-1 text-xs leading-5 text-[#788497]">
                    Organization-scoped access
                  </p>
                </div>
                <div className="rounded-2xl bg-[#f3f7fa] p-4">
                  <Image
                    src="/razorpay-logo.svg"
                    alt="Razorpay"
                    width={104}
                    height={26}
                    className="h-5 w-auto object-contain object-left"
                  />
                  <p className="mt-3 text-xs font-bold text-[#344054]">Secure payments</p>
                  <p className="mt-1 text-xs leading-5 text-[#788497]">Protected by Razorpay</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="flex flex-col gap-2 border-t border-[#e3eaf0] py-5 text-xs text-[#8a94a6] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Devvelocity. Secure institution ERP access.</p>
          <p>Encrypted connections · Tenant-isolated access · Razorpay-protected payments</p>
        </footer>
      </div>
    </main>
  );
}
