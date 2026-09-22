'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useRouter } from 'nextjs-toploader/app';
import {
  Building2,
  Boxes,
  CreditCard,
  FileKey2,
  Globe2,
  LayoutDashboard,
  Bell,
  PackageCheck,
  Settings2,
  UserCog,
  UsersRound,
  Headphones,
  X,
} from 'lucide-react';

interface ISidebarProps {
  tenantsCount: number;
  leadsCount: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: () => void;
}

const items = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/tenants', label: 'Tenant operations', icon: Building2, countKey: 'tenants' },
  { href: '/leads', label: 'CRM pipeline', icon: UsersRound, countKey: 'leads' },
  { href: '/licenses', label: 'Subscriptions', icon: FileKey2 },
  { href: '/products', label: 'Product catalogue', icon: Boxes },
  { href: '/plans', label: 'Plans and packaging', icon: PackageCheck },
  { href: '/billing', label: 'Billing & payments', icon: CreditCard },
  { href: '/customer-operations', label: 'Implementation & support', icon: Headphones },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/public-site', label: 'Public website', icon: Globe2 },
  { href: '/settings', label: 'Platform & integrations', icon: Settings2 },
  { href: '/profile', label: 'My account', icon: UserCog },
] as const;

export default function Sidebar({
  tenantsCount,
  leadsCount,
  isOpen,
  onClose,
  onNavigate,
}: ISidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-primary-900 text-white transition-transform lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex h-16 items-center gap-3 px-5">
          <div className="rounded-xl bg-white px-2 py-1.5">
            <Image
              src="/devvelocitylogo.webp"
              alt="Devvelocity"
              width={184}
              height={52}
              priority
              className="h-10 w-auto object-contain"
            />
          </div>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onClose}
            className="ml-auto rounded-xl p-2 text-blue-100 hover:bg-white/10 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-3">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-300">
            Workspace
          </p>
          {items.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            const countKey = 'countKey' in item ? item.countKey : undefined;
            const count =
              countKey === 'tenants' ? tenantsCount : countKey === 'leads' ? leadsCount : undefined;
            return (
              <button
                type="button"
                key={item.href}
                onClick={() => {
                  onNavigate();
                  onClose();
                  router.push(item.href);
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-left text-sm font-medium transition-colors ${active ? 'bg-white text-primary-900' : 'text-blue-100 hover:bg-white/10 hover:text-white'}`}
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                <span className="flex-1">{item.label}</span>
                {count !== undefined && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${active ? 'bg-primary-50 text-primary' : 'bg-white/10 text-blue-100'}`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
