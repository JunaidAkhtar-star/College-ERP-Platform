/**
 * @file Sidebar.tsx
 * @description Role-filtered professional sidebar for the institution ERP.
 *  - Nav tree comes from the backend (`useNav`) — see `nav-item.model.ts`.
 *  - Deep gradient background (primary-800 → primary-900)
 *  - All nav groups always expanded — no per-group collapse
 *  - Active link: white pill with icon + label
 *  - Icon-only mode with tooltip on hover
 *  - Gradient user card + logout at the bottom
 *  - Sets --sidebar-w CSS variable (matches motion duration: 240 ms)
 * @module shared/layouts
 */

'use client';

import { useNav, type INavLinkDto } from '@/shared/hooks/useNav';
import { useAuthStore } from '@/shared/store/authStore';
import { useLayoutStore } from '@/shared/store/layoutStore';
import { motion } from '@/shared/utils/motion';
import {
  Award,
  Baby,
  BadgeCheck,
  Banknote,
  BarChart2,
  Bell,
  BellRing,
  BookMarked,
  BookOpen,
  Briefcase,
  Building2,
  Bus,
  CalendarCheck,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CalendarMinus,
  ChartNoAxesGantt,
  CheckSquare,
  ChevronLeft,
  ClipboardCheck,
  ClipboardList,
  ClipboardPen,
  Clock,
  CreditCard,
  DatabaseZap,
  FileBadge,
  FileBarChart,
  FilePlus,
  FileSpreadsheet,
  FileStack,
  FileText,
  FlaskConical,
  FolderOpen,
  GraduationCap,
  Grid3x3,
  Handshake,
  HeartHandshake,
  HelpCircle,
  Home,
  Landmark,
  LayoutDashboard,
  Layers,
  Library,
  Lightbulb,
  ListChecks,
  ListOrdered,
  ListTodo,
  Menu as MenuIcon,
  MessageCircle,
  MessagesSquare,
  MessageSquareLock,
  MessageSquareWarning,
  Package,
  PackageOpen,
  PenSquare,
  Receipt,
  Rocket,
  Search,
  Scale,
  ScrollText,
  Send,
  Settings,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  SquareKanban,
  TrendingUp,
  User,
  UserCheck,
  UserCheck2,
  UserCog,
  UserPlus,
  Users,
  Users2,
  Video,
  WalletCards,
  Zap,
} from 'lucide-react';
import Image from 'next/image';
import { getTenantRolePath } from '@/shared/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRouter } from 'nextjs-toploader/app';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import useSwr from '@/shared/hooks/useSwr';

// ── Icon map ──────────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard,
  FileBarChart,
  DatabaseZap,
  FileBadge,
  Bell,
  Send,
  ListChecks,
  Scale,
  MessagesSquare,
  SquareKanban,
  Users,
  ShieldCheck,
  Building2,
  ClipboardList,
  FilePlus,
  UserPlus,
  Grid3x3,
  ListOrdered,
  Layers,
  GraduationCap,
  UserCheck,
  BookOpen,
  BookMarked,
  CalendarDays,
  Clock,
  ListTodo,
  TrendingUp,
  Briefcase,
  ChartNoAxesGantt,
  UserCheck2,
  CalendarCheck,
  FileText,
  ScrollText,
  ClipboardCheck,
  HelpCircle,
  PenSquare,
  CheckSquare,
  FolderOpen,
  CreditCard,
  Landmark,
  Banknote,
  Award,
  UserCog,
  CalendarMinus,
  Handshake,
  HeartHandshake,
  MessageSquareWarning,
  ClipboardPen,
  Library,
  Home,
  Bus,
  Package,
  ShoppingCart,
  ShieldAlert,
  Rocket,
  Users2,
  BellRing,
  CalendarClock,
  Video,
  MessageCircle,
  FileStack,
  FlaskConical,
  Lightbulb,
  Sparkles: Lightbulb,
  Star: Award,
  BadgeCheck,
  FileSpreadsheet,
  Baby,
  CalendarCheck2,
  Receipt,
  BarChart2,
  PackageOpen,
  User,
  Settings,
  WalletCards,
  Zap,
  Search,
  MessageSquareLock,
  Menu: MenuIcon,
};

// Keep currently deployed navigation records visually distinct while the
// idempotent seed synchronizes their newer icon names.
const ICON_BY_HREF: Record<string, React.ElementType> = {
  '/task-management': SquareKanban,
  '/faculty-workload': ChartNoAxesGantt,
  '/assessment-policy': ScrollText,
  '/payment-settings': WalletCards,
};

function NavIcon({ name, href, className }: { name: string; href: string; className?: string }) {
  const Icon = (ICON_BY_HREF[href] ?? ICON_MAP[name] ?? LayoutDashboard) as React.ComponentType<{
    className?: string;
  }>;
  return <Icon className={className ?? 'size-5'} />;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const EXPANDED_W = 288;
const COLLAPSED_W = 64;

// ── Tooltip (fixed-position portal — renders outside overflow:hidden aside) ──
interface ITooltipProps {
  label: string;
  anchorRef: React.RefObject<HTMLLIElement | null>;
}

function Tooltip({ label, anchorRef }: ITooltipProps) {
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const updatePosition = () => {
      if (!anchorRef.current) return;
      const r = anchorRef.current.getBoundingClientRect();
      setPos({
        top: r.top + r.height / 2,
        left: COLLAPSED_W + 8,
      });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [anchorRef]);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      role="tooltip"
      className="pointer-events-none fixed z-9999 -translate-y-1/2 whitespace-nowrap rounded-xl bg-primary-800 px-3.5 py-2 text-[13px] font-semibold text-white  ring-1 ring-white/10"
      style={{ top: pos.top, left: pos.left }}
    >
      {label}
      <span className="absolute -left-1.5 top-1/2 -translate-y-1/2 border-[6px] border-transparent border-r-primary-800" />
    </div>,
    document.body,
  );
}

// ── NavItem (ref-aware so tooltip portal can read position) ────────────────
interface INavItemProps {
  item: INavLinkDto;
  active: boolean;
  collapsed: boolean;
  role: string | null;
  onNavigate?: () => void;
  onIntent?: () => void;
}

function NavItem({ item, active, collapsed, role, onNavigate, onIntent }: INavItemProps) {
  const liRef = useRef<HTMLLIElement>(null);
  const [hovered, setHovered] = useState(false);

  return (
    <li
      ref={liRef}
      className="relative py-0.5"
      style={{ width: collapsed ? COLLAPSED_W : EXPANDED_W }}
    >
      <Link
        href={role ? getTenantRolePath(role, item.href) : item.href}
        data-sidebar-active={active ? 'true' : undefined}
        aria-current={active ? 'page' : undefined}
        prefetch
        onClick={onNavigate}
        onMouseEnter={() => {
          if (collapsed) setHovered(true);
          onIntent?.();
        }}
        onFocus={onIntent}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: collapsed ? COLLAPSED_W : EXPANDED_W - 16,
          marginInline: collapsed ? 0 : 8,
        }}
        className={`group relative flex h-11 items-center overflow-hidden rounded-lg text-sm font-medium transition-colors duration-200
          ${
            active
              ? `${collapsed ? '' : 'bg-white'} font-semibold text-primary-800`
              : `text-white/85 hover:text-white ${collapsed ? '' : 'hover:bg-white/10'}`
          }`}
      >
        {collapsed && (
          <span
            className={`pointer-events-none absolute inset-y-0 inset-x-2 rounded-lg transition-colors ${active ? 'bg-white' : 'group-hover:bg-white/10'}`}
          />
        )}
        {/* Left accent stripe — opacity-only, no layout shift */}
        <span
          className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-primary-400 transition-opacity duration-200"
          style={{ opacity: active && !collapsed ? 1 : 0 }}
        />

        {/* Fixed-width icon slot — matches COLLAPSED_W so icon stays centered while sidebar width animates */}
        <span
          className="relative z-10 flex shrink-0 items-center justify-center"
          style={{ width: collapsed ? COLLAPSED_W : COLLAPSED_W - 16 }}
        >
          <NavIcon
            name={item.icon ?? 'LayoutDashboard'}
            href={item.href}
            className={`size-5 transition-colors ${active ? 'text-primary-700' : 'text-white'}`}
          />
        </span>

        {/* Label — opacity fade only; clipped by aside's overflow:hidden */}
        <span
          className="flex-1 whitespace-nowrap pr-3 transition-opacity duration-200"
          style={{ opacity: collapsed ? 0 : 1 }}
        >
          {item.label}
        </span>

        {/* Active dot — opacity only */}
        <span
          className="mr-3 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500 transition-opacity duration-200"
          style={{ opacity: active && !collapsed ? 1 : 0 }}
        />
      </Link>

      {/* Portal tooltip when collapsed */}
      {collapsed && hovered && <Tooltip label={item.label} anchorRef={liRef} />}
    </li>
  );
}

// ── Sidebar ──────────────────────────────────────────────────────────────────
export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const role = useAuthStore((s) => s.role);
  const mobileSidebarOpen = useLayoutStore((s) => s.mobileSidebarOpen);
  const closeMobileSidebar = useLayoutStore((s) => s.closeMobileSidebar);
  const { data: settingsRes } = useSwr<{
    success: boolean;
    data: { name: string; logoUrl?: string };
  }>('institution-setting/public');
  const settings = settingsRes?.data;

  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const navScrollRef = useRef<HTMLElement>(null);

  // Detect mobile breakpoint (< 1024px = lg)
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 1023px)');
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  // Keep CSS variable in sync — 0 on mobile so content takes full width
  useEffect(() => {
    if (isMobile) {
      document.documentElement.style.setProperty('--sidebar-w', '0px');
    } else {
      document.documentElement.style.setProperty(
        '--sidebar-w',
        `${collapsed ? COLLAPSED_W : EXPANDED_W}px`,
      );
    }
  }, [collapsed, isMobile]);

  // Close mobile sidebar when route changes
  useEffect(() => {
    closeMobileSidebar();
  }, [pathname, closeMobileSidebar]);

  const handleNavClick = useCallback(() => {
    if (isMobile) closeMobileSidebar();
  }, [isMobile, closeMobileSidebar]);

  const prefetchRoute = useCallback(
    (href: string) => {
      if (role) router.prefetch(getTenantRolePath(role, href));
    },
    [role, router],
  );

  // Nav tree comes from the backend, role-filtered and gate-resolved server-side.
  const { groups: visibleGroups, isLoading: isNavLoading, error: navError } = useNav();

  const isActive = (href: string) => {
    const segment = role ? getTenantRolePath(role, href) : href;
    return pathname === segment || pathname.startsWith(`${segment}/`);
  };

  // When multiple item hrefs match (e.g. `/admission` and `/admission/initiate`
  // both match on `/admission/initiate`), only the LONGEST matching href is
  // truly "active". Compute that winner once, then use it in the render pass.
  const activeHref: string | null = (() => {
    let best: string | null = null;
    for (const g of visibleGroups) {
      for (const it of g.items) {
        if (!isActive(it.href)) continue;
        if (!best || it.href.length > best.length) best = it.href;
      }
    }
    return best;
  })();

  // Keep the selected menu visible when a route opens inside a long sidebar.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const activeItem = navScrollRef.current?.querySelector<HTMLElement>(
        '[data-sidebar-active="true"]',
      );
      activeItem?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeHref, collapsed, mobileSidebarOpen]);

  return (
    <>
      {/* ── Mobile backdrop overlay ──────────────────────────────────── */}
      {isMobile && mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-200/80 backdrop-blur-sm lg:hidden"
          onClick={closeMobileSidebar}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar panel ───────────────────────────────────────────────── */}
      <motion.aside
        animate={{
          width: isMobile ? EXPANDED_W : collapsed ? COLLAPSED_W : EXPANDED_W,
          x: isMobile ? (mobileSidebarOpen ? 0 : -EXPANDED_W) : 0,
        }}
        transition={{ duration: 0.26, ease: [0.32, 0.72, 0, 1] }}
        className="tenant-sidebar fixed left-0 top-0 z-50 flex h-dvh flex-col"
        style={{
          overflow: 'hidden',
        }}
      >
        {/* ── Logo — fixed inner width keeps logo centered in collapsed slot without reflow ── */}
        <div
          className="flex h-15 shrink-0 items-center border-b border-white/10"
          style={{ width: EXPANDED_W }}
        >
          <div className="flex shrink-0 items-center justify-center" style={{ width: COLLAPSED_W }}>
            {settings?.logoUrl ? (
              <Image
                src={settings.logoUrl}
                width={44}
                height={44}
                alt={settings.name || 'Institution logo'}
                className="h-auto w-auto rounded-lg object-contain"
              />
            ) : (
              <span className="flex h-11 w-11 items-center justify-center rounded-md bg-white/10 text-sm font-bold text-white">
                ERP
              </span>
            )}
          </div>
          <p
            className="line-clamp-2 min-w-0 flex-1 pr-3 text-sm font-semibold leading-tight text-white transition-opacity duration-200"
            style={{ opacity: collapsed ? 0 : 1 }}
            title={settings?.name || 'Institution setup required'}
          >
            {settings?.name || 'Institution setup required'}
          </p>
        </div>

        {/* ── Scrollable nav — fixed inner width prevents reflow during sidebar width animation ── */}
        <nav
          ref={navScrollRef}
          className="flex-1 overflow-y-auto overflow-x-hidden py-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10"
          style={{ width: EXPANDED_W }}
        >
          {isNavLoading && (
            <div className="space-y-3 px-4 py-2" aria-label="Loading navigation">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="h-9 animate-pulse rounded-lg bg-white/10" />
              ))}
            </div>
          )}

          {!isNavLoading && navError && !collapsed && (
            <p className="mx-4 rounded-lg border border-white/15 bg-white/10 px-3 py-3 text-xs leading-5 text-white/80">
              Navigation could not load. Refresh the page or contact your administrator.
            </p>
          )}

          {!isNavLoading && !navError && visibleGroups.length === 0 && !collapsed && (
            <p className="mx-4 rounded-lg border border-white/15 bg-white/10 px-3 py-3 text-xs leading-5 text-white/80">
              No modules are enabled for this role and subscription.
            </p>
          )}

          {visibleGroups.map((group, gi) => (
            <div key={group._id} className={gi > 0 ? 'mt-1' : ''}>
              {/* Group label / divider — both rendered, crossfade by opacity only */}
              <div className="relative h-9" style={{ width: EXPANDED_W }}>
                <span
                  className="absolute inset-0 flex items-center justify-center transition-opacity duration-200"
                  style={{ opacity: collapsed ? 1 : 0 }}
                >
                  <span className="h-px w-6 rounded-full bg-white/20" />
                </span>
                <span
                  className="absolute inset-0 flex items-center px-4 pt-1 text-[10.5px] font-extrabold uppercase tracking-[0.22em] text-secondary transition-opacity duration-200"
                  style={{ opacity: collapsed ? 0 : 1 }}
                >
                  {group.group}
                </span>
              </div>

              {/* Items */}
              <ul className="mt-1">
                {group.items.map((item) => {
                  const active = item.href === activeHref;
                  return (
                    <NavItem
                      key={item._id}
                      item={item}
                      active={active}
                      collapsed={isMobile ? false : collapsed}
                      role={role}
                      onNavigate={handleNavClick}
                      onIntent={() => prefetchRoute(item.href)}
                    />
                  );
                })}
              </ul>
            </div>
          ))}

          {/* Bottom padding */}
          <div className="h-4" />
        </nav>
      </motion.aside>

      {/* ── Collapse toggle — desktop only ────────────────────────────── */}
      {!isMobile && (
        <motion.div
          animate={{ left: collapsed ? COLLAPSED_W - 13 : EXPANDED_W - 13 }}
          transition={{ duration: 0.26, ease: [0.32, 0.72, 0, 1] }}
          className="fixed top-4.5 cursor-pointer z-50 hidden lg:block"
        >
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-700 text-white ring-1 ring-white/25  transition-all hover:bg-primary cursor-pointer hover:text-white focus-visible:outline-none"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <motion.span animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.24 }}>
              <ChevronLeft className="h-3 w-3" />
            </motion.span>
          </button>
        </motion.div>
      )}
    </>
  );
}
