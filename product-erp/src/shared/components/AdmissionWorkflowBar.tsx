'use client';

import { FileCheck2 } from 'lucide-react';
import { useParams, usePathname } from 'next/navigation';
import { useRouter } from 'nextjs-toploader/app';
import { useWorkflowNavigation } from '@/shared/hooks/useWorkflowNavigation';

const items = [
  { label: 'Recruitment CRM', route: 'recruitment-crm' },
  { label: 'Applications', route: 'admission' },
  { label: 'New Application', route: 'admission/initiate' },
];

export default function AdmissionWorkflowBar() {
  const params = useParams<{ tenant: string; role: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const visible = useWorkflowNavigation(items);

  // Derive the base from the current pathname up to and including the role segment.
  // This avoids doubling the tenant in subdomain-based setups where the middleware
  // internally rewrites rite.localhost/super_admin/... → /rite/super_admin/...
  // but the browser URL stays as rite.localhost/super_admin/...
  const role = params.role;
  const roleIdx = pathname.indexOf(`/${role}`);
  const base =
    roleIdx !== -1 ? pathname.slice(0, roleIdx + role.length + 1) : `/${params.tenant}/${role}`;

  return (
    <nav aria-label="Admissions workspace" className="rounded-2xl bg-white p-4">
      <div className="flex items-center gap-2 px-2 pb-2 pt-1">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-50 text-primary">
          <FileCheck2 className="h-4 w-4" />
        </span>
        <div>
          <p className="text-xs font-semibold text-slate-800">Admissions workspace</p>
          <p className="text-[10px] text-slate-600">
            Initiate, review, approve, collect payment, and enrol
          </p>
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto px-2">
        {visible.map((item, index) => {
          const href = `${base}/${item.route}`;
          const active =
            item.route === 'admission'
              ? pathname === href ||
                (/\/admission\/[^/]+$/.test(pathname) && !pathname.endsWith('/initiate'))
              : pathname === href;
          return (
            <div
              key={item.route}
              onClick={() => router.push(href)}
              aria-current={active ? 'page' : undefined}
              className={`flex cursor-pointer shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                active
                  ? 'bg-primary text-white'
                  : 'bg-slate-50 text-slate-600 hover:bg-primary-50 hover:text-primary'
              }`}
            >
              <span className={active ? 'text-white/70' : 'text-slate-600'}>{index + 1}</span>
              {item.label}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
