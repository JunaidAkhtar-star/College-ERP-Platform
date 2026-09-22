/**
 * @file Header.tsx
 * @description Sticky top header for all tenant dashboard pages.
 *  - Real notifications from API (GET notification/my) with socket push
 *  - Notification bell with slide-down panel + sound on new push
 *  - Profile photo (avatar/initials) with dropdown
 *  - Fully responsive
 * @module shared/layouts
 */

'use client';

function formatRoleName(role: string | null): string {
  if (!role) return '';
  const specialMap: Record<string, string> = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    principal: 'Principal',
    dean_academic: 'Dean Academic',
    administration_office: 'Administration Office',
    assistant_administration_officer: 'Assistant Administration Officer',
    hod: 'Head of Department',
    faculty: 'Faculty',
    student: 'Student',
    parent: 'Parent',
    examination_cell: 'Examination Cell',
    iqac_team: 'IQAC Team',
    iqac_naac: 'IQAC / NAAC',
    scholarship_cell: 'Scholarship Cell',
    library_staff: 'Library Staff',
    placement_cell: 'Training & Placement',
    hr_department: 'HR Department',
    accounts_department: 'Accounts Department',
    transportation: 'Transportation',
    research_development: 'Research & Development',
    club_head: 'Club Head',
    iic: 'IIC',
    store: 'Store',
    admission_incharge: 'Admission Incharge',
    admission_counselor: 'Admission Counselor',
  };
  return (
    specialMap[role] ||
    role
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  );
}
import useEntitlements from '@/shared/hooks/useEntitlements';
import { getPushDeviceId, useFcm } from '@/shared/hooks/useFcm';
import useMutation from '@/shared/hooks/useMutation';
import useNav from '@/shared/hooks/useNav';
import { disconnectSocket, useSocket } from '@/shared/hooks/useSocket';
import useSwr from '@/shared/hooks/useSwr';
import { useAuthStore } from '@/shared/store/authStore';
import { useCallStore } from '@/shared/store/callStore';
import { useLayoutStore } from '@/shared/store/layoutStore';
import { IActiveRole, ILoginResponse, TSystemRole } from '@/shared/types';
import { getTenantRolePath } from '@/shared/utils';
import { AnimatePresence, motion } from '@/shared/utils/motion';
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Bot,
  Briefcase,
  Calendar,
  ChartNoAxesGantt,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Clock,
  CreditCard,
  DatabaseBackup,
  DatabaseZap,
  GraduationCap,
  Home,
  Info,
  LogOut,
  Menu,
  Phone,
  Search,
  Settings,
  User,
  Video,
  X,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRouter } from 'nextjs-toploader/app';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify';
import { useSWRConfig } from 'swr';
import GlobalCalendarPanel from './GlobalCalendarPanel';
import UserGuidePanel from './UserGuidePanel';
// ── Live clock ───────────────────────────────────────────────────────────────
function useLiveClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date()); // eslint-disable-line react-hooks/set-state-in-effect
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

const subscribeToPlatform = () => () => undefined;
const getIsApplePlatform = () => /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
const getServerIsApplePlatform = () => false;

// ── Role labels ─────────────────────────────────────────────────────────────────
// Canonical ROLE_LABELS imported from `@/shared/constants/roles` above.

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  'report-center': 'Report Center',
  'import-center': 'Import & Migration Center',
  'document-designer': 'Certificate & ID Designer',
  'communication-hub': 'Communication Hub',
  'sso-settings': 'Single Sign-On Settings',
  forms: 'Forms & Workflows',
  discipline: 'Discipline Management',
  'data-portability': 'Data Portability',
  collaboration: 'Collaboration Hub',
  'external-connector': 'Connector Center',
  users: 'User Management',
  roles: 'Role Management',
  departments: 'Departments',
  'audit-log': 'Audit Log',
  admission: 'Admission',
  students: 'Students',
  faculty: 'Faculty',
  subjects: 'Subjects',
  curriculum: 'Curriculum',
  'academic-structure': 'Academic Structure',
  'academic-calendar': 'Academic Calendar',
  timetable: 'Timetable',
  'lesson-plan': 'Lesson Plans',
  'course-progress': 'Course Progress',
  'faculty-workload': 'Teaching Assignments',
  attendance: 'Attendance',
  'faculty-attendance': 'Faculty Attendance',
  examination: 'Examinations',
  'question-bank': 'Question Bank',
  assignment: 'Assignments',
  quiz: 'Quizzes',
  'study-material': 'Study Material',
  fee: 'Fee Management',
  accounts: 'Accounts',
  payroll: 'Payroll',
  scholarship: 'Scholarships',
  hr: 'HR Management',
  leave: 'Leave Management',
  mentor: 'Mentor',
  counseling: 'Counseling',
  grievance: 'Grievances',
  'semester-registration': 'Semester Registration',
  library: 'Library',
  hostel: 'Hostel',
  transport: 'Transport',
  placement: 'Placement',
  alumni: 'Alumni',
  notice: 'Notice Board',
  event: 'Events',
  meeting: 'Meetings',
  chat: 'Chat',
  document: 'Documents',
  iqac: 'IQAC',
  'naac-nba': 'NAAC / NBA',
  compliance: 'Compliance Workspace',
  'government-integrations': 'Government & Regulatory Integrations',
  parent: 'Parent Portal',
  ward: "Ward's Profile",
  profile: 'Profile',
  settings: 'Settings',
  notifications: 'Notifications',
};

function toLabel(segment: string) {
  return (
    SEGMENT_LABELS[segment] ?? segment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

interface IBreadcrumb {
  label: string;
  href: string;
}

function buildBreadcrumbs(pathname: string, role: TSystemRole | null): IBreadcrumb[] {
  const parts = pathname.split('/').filter(Boolean);
  const crumbs: IBreadcrumb[] = [];
  let acc = '';
  for (const part of parts) {
    acc += `/${part}`;
    if (role && part === role) continue;
    crumbs.push({ label: toLabel(part), href: acc });
  }
  return crumbs;
}

// ── Notification type → icon / colour ────────────────────────────────────────
// Keys are lowercase so lookup is normalised. Backend sends lowercase_underscore types.
const NOTIF_META: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; colour: string }
> = {
  // Backend cron / service types
  fee_reminder: { icon: CreditCard, colour: 'text-orange-500 bg-orange-50' },
  attendance_alert: { icon: CheckCheck, colour: 'text-green-500  bg-green-50' },
  meeting: { icon: Calendar, colour: 'text-violet-500 bg-violet-50' },
  placement: { icon: Briefcase, colour: 'text-indigo-500 bg-indigo-50' },
  workload: { icon: ChartNoAxesGantt, colour: 'text-sky-600 bg-sky-50' },
  // Manual broadcast types (admin can type anything)
  exam: { icon: GraduationCap, colour: 'text-purple-500 bg-purple-50' },
  result: { icon: BookOpen, colour: 'text-blue-500   bg-blue-50' },
  admission: { icon: Briefcase, colour: 'text-teal-500   bg-teal-50' },
  holiday: { icon: Calendar, colour: 'text-pink-500   bg-pink-50' },
  warning: { icon: AlertTriangle, colour: 'text-red-500    bg-red-50' },
  alert: { icon: AlertTriangle, colour: 'text-red-500    bg-red-50' },
  payment: { icon: CreditCard, colour: 'text-emerald-500 bg-emerald-50' },
};

function getNotifIcon(type: string) {
  const key = (type ?? '').toLowerCase().replace(/\s+/g, '_');
  return (
    NOTIF_META[key] ?? {
      icon: Info as React.ComponentType<{ className?: string }>,
      colour: 'text-primary bg-primary-50',
    }
  );
}

function relativeTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return d.toLocaleDateString('en-IN', { weekday: 'short' });
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

// ── Notification sound (3-note ascending chime D5→F#5→A5) ───────────────────
// Uses a singleton AudioContext that is unlocked on the first user gesture —
// modern browsers suspend audio playback until the user interacts with the page.
let _audioCtx: AudioContext | null = null;
let _audioUnlocked = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (_audioCtx) return _audioCtx;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    _audioCtx = new AudioCtx();
  } catch {
    return null;
  }
  return _audioCtx;
}

if (typeof window !== 'undefined') {
  const unlock = () => {
    _audioUnlocked = true;
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => undefined);
    window.removeEventListener('click', unlock);
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('touchstart', unlock);
  };
  window.addEventListener('click', unlock, { once: false });
  window.addEventListener('keydown', unlock, { once: false });
  window.addEventListener('touchstart', unlock, { once: false });
}

function playNotificationSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  // If we haven't seen a user gesture yet the context is suspended — skip
  // silently so we don't spam the console with autoplay warnings.
  if (!_audioUnlocked && ctx.state !== 'running') return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);

  try {
    const t = ctx.currentTime;
    [
      [587.33, 0],
      [739.99, 0.22],
      [880, 0.44],
    ].forEach(([freq, offset]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + offset);
      gain.gain.setValueAtTime(0, t + offset);
      gain.gain.linearRampToValueAtTime(0.7, t + offset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t + offset);
      osc.stop(t + offset + 0.3);
    });
  } catch {
    /* ignore */
  }
}

// ── API response shapes ───────────────────────────────────────────────────────
interface INotification {
  _id: string;
  title: string;
  body: string;
  type: string;
  actionUrl?: string;
  createdAt: string;
  readBy?: Array<{ userId: string; readAt: string }>;
}

const LEGACY_ACTION_URLS: Record<string, string> = {
  '/admission-portal': '/dashboard',
  '/student/admission-portal': '/student/dashboard',
  '/student/fees': '/student/fee',
  '/warden/hostel/complaints': '/hostel',
  '/payment-submission': '/accounts',
};

/** Notifications should store role-less paths (e.g. "/chat", "/chat?conv=abc").
 *  Older rows may already contain a role prefix, so this resolver preserves any
 *  known role-prefixed URL and only prefixes truly role-less paths. */
function resolveRoleHref(role: TSystemRole | null, url?: string): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const normalized = LEGACY_ACTION_URLS[url] ?? url;
  if (normalized.startsWith('/meetings/'))
    return role ? getTenantRolePath(role, '/meeting') : '/meeting';
  if (!role) return normalized;
  if (normalized === '/admission-portal') return getTenantRolePath(role, '/dashboard');
  const assignedRoles = useAuthStore.getState().user?.roles ?? [];
  const knownRolePrefix = (assignedRoles as string[]).some(
    (knownRole: string) =>
      normalized === `/${knownRole}` ||
      normalized.startsWith(`/${knownRole}/`) ||
      normalized.startsWith(`/${knownRole}?`),
  );
  if (knownRolePrefix) return getTenantRolePath(role, normalized);
  const prefix = `/${role}`;
  if (
    normalized === prefix ||
    normalized.startsWith(`${prefix}/`) ||
    normalized.startsWith(`${prefix}?`)
  ) {
    return getTenantRolePath(role, normalized);
  }
  const path = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return getTenantRolePath(role, path);
}

// ── Live notification toast ───────────────────────────────────────────────────
interface IToastNotif {
  id: string;
  _id?: string;
  title: string;
  body: string;
  type: string;
  actionUrl?: string;
}

// SSR-safe "is on client" snapshot for useSyncExternalStore. The store never
// changes after first paint, so `subscribe` is a no-op.
const subscribeNoop = () => () => {};
const getMountedClient = () => true;
const getMountedServer = () => false;

function NotifToast({
  toast,
  onDismiss,
  role,
}: {
  toast: IToastNotif;
  onDismiss: (id: string) => void;
  role: TSystemRole | null;
}) {
  const router = useRouter();
  const { icon: Icon, colour } = getNotifIcon(toast.type);
  const typeLabel = (toast.type ?? 'notification')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 420 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 420 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="pointer-events-auto w-80 overflow-hidden rounded-2xl border border-slate-200/70 bg-white/95  backdrop-blur-md"
    >
      <div
        className="flex cursor-pointer items-start gap-3 p-4"
        onClick={() => {
          onDismiss(toast.id);
          const target = resolveRoleHref(role, toast.actionUrl);
          if (target) router.push(target);
          else if (role) router.push(getTenantRolePath(role, '/notification'));
        }}
      >
        {/* icon */}
        <span
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${colour}`}
        >
          <Icon className="h-4 w-4" />
        </span>
        {/* content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${colour}`}
            >
              {typeLabel}
            </span>
            <span className="text-[10px] text-slate-600">just now</span>
          </div>
          <p className="mt-1 text-[13px] font-semibold leading-snug text-slate-800 line-clamp-1">
            {toast.title}
          </p>
          {toast.body && <p className="mt-0.5 text-xs text-slate-600 line-clamp-2">{toast.body}</p>}
        </div>
        {/* close */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(toast.id);
          }}
          className="mt-0.5 shrink-0 rounded-lg p-0.5 text-slate-300 hover:bg-slate-100 hover:text-slate-500 cursor-pointer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {/* progress bar */}
      <motion.div
        className={`h-0.5 ${colour.split(' ')[1]}`}
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: 5, ease: 'linear' }}
        style={{ transformOrigin: 'left' }}
      />
    </motion.div>
  );
}
interface INotifResponse {
  data: INotification[];
  total: number;
}
// ── UserDropdown ──────────────────────────────────────────────────────────────
interface IDropdownProps {
  open: boolean;
  user: { name: string; email: string; avatar?: string } | null;
  role: TSystemRole | null;
  onClose: () => void;
  onLogout: () => void;
}

function UserDropdown({ open, user, role, onClose, onLogout }: IDropdownProps) {
  const router = useRouter();
  const initials = (user?.name ?? 'U')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: -6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -6 }}
          transition={{ duration: 0.14 }}
          className="absolute right-0 top-full mt-2 w-60 overflow-hidden rounded-2xl border border-slate-200/70 bg-white/95  backdrop-blur-md z-50"
        >
          <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-100">
            {user?.avatar ? (
              <Image
                src={user.avatar}
                alt={user.name}
                width={40}
                height={40}
                className="h-10 w-10 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary-600 via-primary to-primary-400 text-sm font-bold text-white">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800">
                {user?.name ?? 'User'}
              </p>
              <p className="truncate text-[11px] text-slate-600">{user?.email ?? ''}</p>
              {role && (
                <span className="mt-0.5 inline-block rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  {formatRoleName(role)}
                </span>
              )}
            </div>
          </div>
          <div className="py-1.5">
            <button
              type="button"
              onClick={() => {
                if (role) router.push(getTenantRolePath(role, '/profile'));
                onClose();
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100">
                <User className="h-3.5 w-3.5 text-slate-500" />
              </span>
              My Profile
            </button>
            <button
              type="button"
              onClick={() => {
                if (role) router.push(getTenantRolePath(role, '/settings'));
                onClose();
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100">
                <Settings className="h-3.5 w-3.5 text-slate-500" />
              </span>
              Settings
            </button>
          </div>
          <div className="border-t border-slate-100" />
          <div className="py-1.5">
            <button
              type="button"
              onClick={onLogout}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50/70 cursor-pointer"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50">
                <LogOut className="h-3.5 w-3.5 text-red-400" />
              </span>
              Sign out
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── NotificationPanel ─────────────────────────────────────────────────────────
interface INotifPanelProps {
  open: boolean;
  notifications: INotification[];
  unreadCount: number;
  userId: string;
  currentUserId: string;
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  role: TSystemRole | null;
}

function NotificationPanel({
  open,
  notifications,
  unreadCount,
  currentUserId,
  onClose,
  onMarkRead,
  onMarkAllRead,
  role,
}: INotifPanelProps) {
  const router = useRouter();
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: -6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -6 }}
          transition={{ duration: 0.14 }}
          className="absolute right-0 top-full mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200/70 bg-white/95  backdrop-blur-md z-50"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-slate-800">Notifications</p>
              {unreadCount > 0 && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={onMarkAllRead}
                  className="text-[11px] cursor-pointer font-medium text-primary hover:underline"
                >
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg cursor-pointer p-1 text-slate-600 hover:bg-slate-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* List */}
          <ul className="max-h-96 divide-y divide-slate-50 overflow-y-auto py-1">
            {notifications.length === 0 ? (
              <li className="flex flex-col items-center py-10 text-slate-300">
                <Bell className="mb-2 h-8 w-8" />
                <p className="text-sm">No notifications yet</p>
              </li>
            ) : (
              notifications.map((n) => {
                const isRead = (n.readBy ?? []).some(
                  (r) => String(r.userId) === String(currentUserId),
                );
                const { icon: Icon, colour } = getNotifIcon(n.type);
                return (
                  <li key={n._id}>
                    <button
                      type="button"
                      onClick={() => {
                        onMarkRead(n._id);
                        const target = resolveRoleHref(role, n.actionUrl);
                        if (target) router.push(target);
                        else onClose();
                      }}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 cursor-pointer ${!isRead ? 'bg-primary-50/40' : ''}`}
                    >
                      <span
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${colour}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-xs leading-snug ${!isRead ? 'font-semibold text-slate-800' : 'font-medium text-slate-500'}`}
                        >
                          {n.title}
                        </p>
                        {n.body && (
                          <p className="mt-0.5 line-clamp-1 text-[10px] text-slate-600">{n.body}</p>
                        )}
                        <p className="mt-0.5 text-[10px] text-slate-600">
                          {n.type} · {relativeTime(n.createdAt)}
                        </p>
                      </div>
                      {!isRead && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          {/* Footer */}
          <div className="border-t border-slate-100 px-4 py-3">
            <button
              type="button"
              onClick={() => {
                if (role) router.push(getTenantRolePath(role, '/notification'));
                onClose();
              }}
              className="text-xs cursor-pointer font-semibold text-primary hover:text-primary-700"
            >
              View all notifications →
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── ChatPanel removed: chat notifications now surface only through the bell
// dropdown and the right-side chat sidebar, so a dedicated header popup is
// redundant.

// ── Header ────────────────────────────────────────────────────────────────────
export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const activeRole = useAuthStore((s) => s.activeRole);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const roleTransitionTarget = useAuthStore((s) => s.roleTransitionTarget);
  const beginRoleTransition = useAuthStore((s) => s.beginRoleTransition);
  const endRoleTransition = useAuthStore((s) => s.endRoleTransition);
  const toggleMobileSidebar = useLayoutStore((s) => s.toggleMobileSidebar);
  const calendarOpen = useLayoutStore((s) => s.calendarOpen);
  const openCalendar = useLayoutStore((s) => s.openCalendar);
  const closeCalendar = useLayoutStore((s) => s.closeCalendar);
  const { socket } = useSocket();
  const { mutation: markMutation } = useMutation();
  const { mutate } = useSWRConfig();
  const [roleSwitching, setRoleSwitching] = useState(false);
  const [navSearchOpen, setNavSearchOpen] = useState(false);
  const [navSearchQuery, setNavSearchQuery] = useState('');
  const [navSearchIndex, setNavSearchIndex] = useState(0);
  const navSearchInputRef = useRef<HTMLInputElement>(null);
  const navSearchListRef = useRef<HTMLDivElement>(null);
  const isApplePlatform = useSyncExternalStore(
    subscribeToPlatform,
    getIsApplePlatform,
    getServerIsApplePlatform,
  );
  const navShortcutLabel = isApplePlatform ? '⌘ K' : 'Ctrl K';
  const { groups: navGroups } = useNav();

  useEffect(() => {
    if (!roleTransitionTarget || role !== roleTransitionTarget) return;
    const segments = pathname.split('/').filter(Boolean);
    const urlRole = segments.find((segment) => segment === roleTransitionTarget);
    if (urlRole) {
      endRoleTransition();
    }
  }, [endRoleTransition, pathname, role, roleTransitionTarget]);

  const navSearchResults = useMemo(() => {
    const query = navSearchQuery.trim().toLowerCase();
    return navGroups
      .flatMap((group) =>
        group.items.map((item) => ({
          ...item,
          group: group.group,
        })),
      )
      .filter(
        (item) =>
          !query ||
          item.label.toLowerCase().includes(query) ||
          item.group.toLowerCase().includes(query) ||
          item.href.toLowerCase().replaceAll('-', ' ').includes(query),
      )
      .slice(0, 12);
  }, [navGroups, navSearchQuery]);

  const closeNavSearch = useCallback(() => {
    setNavSearchOpen(false);
    setNavSearchQuery('');
    setNavSearchIndex(0);
  }, []);

  const navigateToSearchResult = useCallback(
    (href: string) => {
      if (!role) return;
      closeNavSearch();
      router.push(getTenantRolePath(role, href));
    },
    [closeNavSearch, role, router],
  );

  useEffect(() => {
    if (!navSearchOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    navSearchInputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeNavSearch();
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setNavSearchIndex((current) =>
          navSearchResults.length ? (current + 1) % navSearchResults.length : 0,
        );
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setNavSearchIndex((current) =>
          navSearchResults.length
            ? (current - 1 + navSearchResults.length) % navSearchResults.length
            : 0,
        );
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        const result = navSearchResults[navSearchIndex];
        if (result) navigateToSearchResult(result.href);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [closeNavSearch, navSearchIndex, navSearchOpen, navSearchResults, navigateToSearchResult]);

  useEffect(() => {
    if (!navSearchOpen) return;
    navSearchListRef.current
      ?.querySelector<HTMLElement>(`[data-nav-search-index="${navSearchIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [navSearchIndex, navSearchOpen]);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setNavSearchOpen(true);
      }
    };
    document.addEventListener('keydown', onShortcut);
    return () => document.removeEventListener('keydown', onShortcut);
  }, []);

  // Call status hook and timer for minimized banner
  const { callState, setCallState } = useCallStore();
  const [callDuration, setCallDuration] = useState(0);

  useEffect(() => {
    let timerId: NodeJS.Timeout | undefined;
    if (callState.isActive && callState.callStartTime) {
      timerId = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - (callState.callStartTime ?? Date.now())) / 1000));
      }, 1000);
    }
    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [callState.isActive, callState.callStartTime]);

  const formattedCallDuration = useMemo(() => {
    const mins = Math.floor(callDuration / 60);
    const secs = callDuration % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, [callDuration]);

  // ── Subscription Entitlements & Role RBAC Validation ─────────────────────────
  const { hasVirtualClassrooms } = useEntitlements();
  const activeRoleName = activeRole?.baseRole || activeRole?.name || role;
  const canMonitorBackups = activeRoleName === 'super_admin' || activeRoleName === 'admin';
  const { data: backupOverviewRaw } = useSwr<{
    data?: {
      activeJob?: {
        progress: number;
        progressMessage: string;
        status: 'queued' | 'running';
      } | null;
    };
  }>(user && canMonitorBackups ? 'tenant-backup' : null, {
    refreshInterval: (latest) => (latest?.data?.data?.activeJob ? 4000 : 60000),
    revalidateOnFocus: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    dedupingInterval: 2000,
  });
  const activeBackup = backupOverviewRaw?.data?.activeJob;
  const canMonitorImports = ['super_admin', 'admin', 'principal', 'administration_office'].includes(
    activeRoleName ?? '',
  );
  const { data: importJobsRaw } = useSwr<{
    data?: Array<{
      _id: string;
      sourceFileName: string;
      status: string;
      validRows: number;
      processedRows: number;
    }>;
  }>(user && canMonitorImports ? 'import-center' : null, {
    refreshInterval: (latest) => {
      const jobs = latest?.data?.data ?? [];
      return jobs.some((job: { status: string }) => ['queued', 'committing'].includes(job.status))
        ? 3000
        : 60000;
    },
    revalidateOnFocus: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    dedupingInterval: 2000,
  });
  const activeImport = importJobsRaw?.data?.find((job) =>
    ['queued', 'committing'].includes(job.status),
  );
  const activeImportProgress = activeImport
    ? Math.min(
        100,
        Math.round(((activeImport.processedRows ?? 0) / Math.max(activeImport.validRows, 1)) * 100),
      )
    : 0;

  // ── Upcoming Meeting check ─────────────────────────────────────────────────
  const { data: upcomingMeetingRaw, mutate: refreshUpcomingMeeting } = useSwr<{
    data?: {
      _id: string;
      title: string;
      scheduledAt: string;
      meetingLink?: string;
      status?: 'scheduled' | 'ongoing';
    } | null;
  }>(user && hasVirtualClassrooms ? 'meeting/upcoming' : null, {
    refreshInterval: 15000,
    revalidateOnFocus: true,
  });
  const upcomingMeeting =
    upcomingMeetingRaw?.data &&
    ['scheduled', 'ongoing'].includes(upcomingMeetingRaw.data.status ?? 'scheduled')
      ? upcomingMeetingRaw.data
      : null;

  useEffect(() => {
    if (!socket) return;
    const refresh = () => void refreshUpcomingMeeting();
    socket.on('meet_ended', refresh);
    socket.on('meeting_status_changed', refresh);
    return () => {
      socket.off('meet_ended', refresh);
      socket.off('meeting_status_changed', refresh);
    };
  }, [socket, refreshUpcomingMeeting]);

  // ── Notifications from API ─────────────────────────────────────────────────
  const { data: notifRaw, mutate: mutateNotifs } = useSwr(user ? 'notification/my?limit=20' : null);
  const notifications = useMemo(() => (notifRaw as INotifResponse | null)?.data ?? [], [notifRaw]);
  const [localUnread, setLocalUnread] = useState(0);
  const prevNotifCount = useRef(0);

  // ── Live toast queue ───────────────────────────────────────────────────────
  const [toasts, setToasts] = useState<IToastNotif[]>([]);
  const deliveredNotificationIds = useRef(new Map<string, number>());
  // SSR-safe client-mounted flag: server snapshot returns false, client true.
  // Avoids the "setState in effect" lint that the previous mounted-effect tripped.
  const toastMounted = useSyncExternalStore(subscribeNoop, getMountedClient, getMountedServer);
  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);
  // Auto-dismiss after 5 s
  const addToast = useCallback((notif: Omit<IToastNotif, 'id'>) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev.slice(-2), { id, ...notif }]); // max 3 visible
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);
  const isDuplicateDelivery = useCallback((notificationId?: string) => {
    if (!notificationId) return false;
    const now = Date.now();
    const seen = deliveredNotificationIds.current;
    for (const [id, deliveredAt] of seen) {
      if (now - deliveredAt > 60_000) seen.delete(id);
    }
    if (seen.has(notificationId)) return true;
    seen.set(notificationId, now);
    return false;
  }, []);

  // ── FCM (browser push) ─────────────────────────────────────────────────────
  // Register this device with Firebase Cloud Messaging so the backend can
  // deliver notifications when the tab is closed / device is locked.
  // Foreground messages are surfaced through the same toast queue as socket
  // pushes — and the bell list is revalidated so badges stay in sync.
  useFcm({
    enabled: Boolean(user),
    onForegroundMessage: (payload) => {
      mutateNotifs();
      if (isDuplicateDelivery(payload.data?.['notificationId'])) return;
      const n = payload.notification;
      const title = n?.title || payload.data?.['title'];
      const body = n?.body || payload.data?.['body'] || '';
      if (title) {
        addToast({
          title,
          body,
          type: (payload.data?.['type'] as string) ?? '',
          actionUrl: (payload.data?.['actionUrl'] || payload.data?.['url']) as string | undefined,
        });
        if (
          typeof window !== 'undefined' &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          const pushIcon =
            (payload.data?.['icon'] as string | undefined) ||
            (payload.data?.['tenantLogo'] as string | undefined) ||
            (payload.data?.['avatar'] as string | undefined) ||
            n?.icon ||
            user?.avatar ||
            '/favicon.ico';

          try {
            new Notification(title, {
              body,
              icon: pushIcon,
              data: payload.data,
            });
          } catch {
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.ready
                .then((reg) => {
                  reg.showNotification(title, {
                    body,
                    icon: pushIcon,
                    data: payload.data,
                  });
                })
                .catch(() => undefined);
            }
          }
        }
      }
    },
  });

  // Sync API unread (compute from data — backend returns full readBy array)
  useEffect(() => {
    const uid = user?._id;
    const count = notifications.filter(
      (n) => !uid || !(n.readBy ?? []).some((r) => String(r.userId) === String(uid)),
    ).length;
    setLocalUnread(count); // eslint-disable-line react-hooks/set-state-in-effect
  }, [notifications, user?._id]);

  // ── Socket: new notification push & new message ────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onNotif = (data: { notification?: IToastNotif }) => {
      mutateNotifs();
      setLocalUnread((c) => c + 1);
      playNotificationSound();
      prevNotifCount.current += 1;
      if (data?.notification) {
        // Suppress chat-related toasts while the user is on the chat page —
        // the chat UI already reflects the new message inline (WhatsApp-style).
        const n = data.notification;
        if (isDuplicateDelivery(String(n._id ?? ''))) return;
        const isChatNotif =
          (n.actionUrl ?? '').includes('/chat') ||
          (n.title ?? '').startsWith('New message from') ||
          (n.title ?? '').includes(' in ');
        if (isChatNotif && pathname.includes('/chat')) return;
        addToast({
          title: n.title,
          body: n.body,
          type: n.type ?? '',
          actionUrl: n.actionUrl,
        });
      }
    };

    const onNewMsg = (payload: {
      conversationId?: string;
      message?: { senderId?: string | { _id?: string } };
    }) => {
      // Ignore messages I sent myself — sender shouldn't see their own
      // message as a fresh notification / bell refresh / sound / badge bump.
      const rawSender = payload?.message?.senderId;
      const senderId = typeof rawSender === 'string' ? rawSender : (rawSender?._id ?? '');
      if (user?._id && String(senderId) === String(user._id)) return;

      // Refresh notifications list so the persistent count picks up the new
      // chat-message notification, and play a sound when we're not actively
      // on the chat page.
      mutateNotifs();
      if (!pathname.includes('/chat')) {
        playNotificationSound();
      }
    };

    socket.on('notification_push', onNotif);
    socket.on('new_message', onNewMsg);

    // ── Offline notification queue flush ───────────────────────────────────
    // Backend sends a single `pending_notifications` event on connect
    // containing everything we missed while offline. We surface them as
    // ONE summary toast (not a stack) so users immediately know "something
    // arrived while you were away" without spamming the screen. Dedupe
    // across reloads using sessionStorage so refreshing the page doesn't
    // re-flash the same batch.
    const onPending = (data: { notifications?: INotification[] }) => {
      const items = data?.notifications ?? [];
      if (items.length === 0) return;
      mutateNotifs();
    };
    socket.on('pending_notifications', onPending);

    return () => {
      socket.off('notification_push', onNotif);
      socket.off('new_message', onNewMsg);
      socket.off('pending_notifications', onPending);
    };
  }, [socket, mutateNotifs, pathname, addToast, isDuplicateDelivery, user?._id, role]);

  // Bulk-clear all unread chat notifications server-side on entering the chat
  // page, then refresh the bell list so the badge drops immediately.
  useEffect(() => {
    if (pathname.includes('/chat')) {
      markMutation('notification/chat/read-all', { method: 'POST', isAlert: false })
        .then(() => mutateNotifs())
        .catch(() => undefined);
    }
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Panel state ────────────────────────────────────────────────────────────
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    const openPageGuide = () => setGuideOpen(true);
    window.addEventListener('erp:open-page-guide', openPageGuide);
    return () => window.removeEventListener('erp:open-page-guide', openPageGuide);
  }, []);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close panels on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setDropdownOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ── Mark read / mark all ───────────────────────────────────────────────────
  const handleMarkRead = useCallback(
    async (id: string) => {
      await markMutation(`notification/${id}/read`, { method: 'POST', isAlert: false });
      mutateNotifs();
      setLocalUnread((c) => Math.max(0, c - 1));
    },
    [markMutation, mutateNotifs],
  );

  const handleMarkAllRead = useCallback(async () => {
    const uid = user?._id;
    const unread = notifications.filter(
      (n) => !(n.readBy ?? []).some((r) => String(r.userId) === String(uid)),
    );
    await Promise.all(
      unread.map((n) =>
        markMutation(`notification/${n._id}/read`, { method: 'POST', isAlert: false }),
      ),
    );
    mutateNotifs();
    setLocalUnread(0);
  }, [notifications, markMutation, mutateNotifs, user?._id]);

  const now = useLiveClock();
  const breadcrumbs = buildBreadcrumbs(pathname, role);
  const isDashboard = pathname.endsWith('/dashboard');

  const handleLogout = () => {
    setDropdownOpen(false);
    // Best-effort unregister this device's FCM token so the server stops
    // pushing to a now-orphaned web token. Fire-and-forget — logout must not
    // block on the network round-trip.
    void markMutation('notification/fcm-token', {
      method: 'DELETE',
      body: { platform: 'web', deviceId: getPushDeviceId() },
      isAlert: false,
    });
    disconnectSocket();
    clearAuth();
    router.replace('/auth/signin');
  };

  const handleRoleSwitch = async (selectedRole: string) => {
    if (!user || selectedRole === activeRole?.name || roleSwitching) return;
    setRoleSwitching(true);
    beginRoleTransition(selectedRole as TSystemRole);
    try {
      const response = await markMutation('auth/switch-role', {
        method: 'POST',
        body: { role: selectedRole },
        isAlert: false,
      });
      const data = response?.results?.data as
        | (Pick<ILoginResponse, 'accessToken' | 'refreshToken'> & {
            role: IActiveRole;
            activeRole: TSystemRole;
          })
        | undefined;
      if (!data?.accessToken || !data.refreshToken || !data.role || !data.activeRole) {
        toast.error('Role could not be changed. Please try again.');
        endRoleTransition();
        return;
      }
      setAuth(
        { ...user, role: data.activeRole },
        data.accessToken,
        data.refreshToken || refreshToken || '',
        data.activeRole,
        data.role,
      );
      // Keep one stable transition screen while role-sensitive resources are
      // refreshed with the rotated token. Clearing every cache entry first
      // made the guard, sidebar and dashboard display loaders sequentially.
      await mutate(() => true);
      router.replace(getTenantRolePath(data.activeRole, '/dashboard'));
    } catch {
      endRoleTransition();
      toast.error('Role could not be changed. Please try again.');
    } finally {
      setRoleSwitching(false);
    }
  };

  const initials = (user?.name ?? 'U')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const profilePhoto = user?.avatar;

  return (
    <header className="sticky top-0 z-30 flex h-15 items-center gap-2 border-b border-slate-100/80 bg-white/80 px-4 backdrop-blur-md md:px-6">
      {/* ── Hamburger ─────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={toggleMobileSidebar}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 lg:hidden cursor-pointer"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* ── Breadcrumb ────────────────────────────────────────────────────── */}
      <nav className="flex min-w-0 flex-1 items-center gap-1 text-sm" aria-label="Breadcrumb">
        <Link
          href={role ? getTenantRolePath(role, '/dashboard') : '/'}
          className="shrink-0 text-slate-600 hover:text-slate-600"
          aria-label="Home"
        >
          <Home className="h-3.5 w-3.5" />
        </Link>
        {breadcrumbs.map((crumb, i) => (
          <React.Fragment key={crumb.href}>
            <ChevronRight className="h-3 w-3 shrink-0 text-slate-300" />
            {i === breadcrumbs.length - 1 ? (
              <span className="truncate text-[13px] font-semibold text-slate-800">
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="truncate text-[13px] text-slate-600 hover:text-slate-600"
              >
                {crumb.label}
              </Link>
            )}
          </React.Fragment>
        ))}
      </nav>

      {(activeRole?.assignedRoles?.length ?? 0) > 1 && (
        <div className="relative hidden min-w-48 md:block">
          <select
            id="header-active-role"
            value={activeRole?.name ?? ''}
            onChange={(event) => void handleRoleSwitch(event.target.value)}
            aria-label="Active workspace"
            disabled={roleSwitching}
            className="peer h-10 w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-9 text-xs font-bold leading-10 text-slate-800 outline-none transition-colors hover:border-blue-200 hover:bg-blue-50/30 focus:border-primary focus:bg-white disabled:cursor-wait disabled:bg-slate-50 disabled:text-slate-500"
          >
            {activeRole?.assignedRoles?.map((assignedRole) => (
              <option key={assignedRole} value={assignedRole}>
                {formatRoleName(assignedRole)}
              </option>
            ))}
          </select>
          <label
            htmlFor="header-active-role"
            className="pointer-events-none absolute inset-s-2 top-0 z-10 -translate-y-1/2 bg-white px-1.5 text-[10px] font-semibold leading-4 text-slate-500 transition-colors peer-focus:text-primary peer-disabled:bg-slate-50"
          >
            {roleSwitching ? 'Changing workspace' : 'Active workspace'}
          </label>
          <ChevronDown
            className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 ${
              roleSwitching ? 'opacity-40' : ''
            }`}
            aria-hidden="true"
          />
        </div>
      )}

      {activeBackup && role && (
        <Link
          href={getTenantRolePath(role, '/settings')}
          className="group hidden min-w-40 max-w-60 items-center gap-2 rounded-xl bg-primary-50 px-3 py-2 sm:flex"
          title={activeBackup.progressMessage}
        >
          <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-primary">
            <DatabaseBackup className="h-4 w-4" />
            <span className="absolute inset-0 animate-ping rounded-full ring-1 ring-primary/25" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-700">
              <span>Secure backup</span>
              <span className="text-primary">{activeBackup.progress}%</span>
            </span>
            <progress
              value={activeBackup.progress}
              max={100}
              className="mt-1 h-1.5 w-full overflow-hidden rounded-full accent-primary"
              aria-label={`Secure backup progress ${activeBackup.progress}%`}
            />
          </span>
        </Link>
      )}
      {activeImport && role && (
        <Link
          href={getTenantRolePath(role, '/import-center')}
          className="group hidden min-w-40 max-w-60 items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 sm:flex"
          title={`${activeImport.sourceFileName} is being imported`}
        >
          <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-blue-600">
            <DatabaseZap className="h-4 w-4" />
            <span className="absolute inset-0 animate-ping rounded-full ring-1 ring-blue-500/25" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-700">
              <span className="truncate">Data import</span>
              <span className="text-blue-600">{activeImportProgress}%</span>
            </span>
            <progress
              value={activeImportProgress}
              max={100}
              className="mt-1 h-1.5 w-full overflow-hidden rounded-full accent-blue-600"
              aria-label={`Data import progress ${activeImportProgress}%`}
            />
          </span>
        </Link>
      )}

      {/* ── Live clock ────────────────────────────────────────────────────── */}
      {now && !isDashboard && (
        <div className="hidden items-center gap-2 rounded  bg-slate-50 px-3 py-1.5 lg:flex">
          <Clock className="h-3 w-3 shrink-0 text-primary" />
          <div className="text-right items-center flex gap-3">
            <p className="text-sm font-semibold leading-tight text-slate-700">
              {now.toLocaleDateString('en-IN', {
                weekday: 'short',
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </p>
            <p className="font-mono text-sm font-bold leading-tight text-primary tabular-nums">
              {now.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true,
              })}
            </p>
          </div>
        </div>
      )}

      {/* ── Right actions ─────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-1">
        {/* ── Upcoming Meeting Pill ────────────────────────────────────────── */}
        {upcomingMeeting && (
          <Link
            href={
              upcomingMeeting.meetingLink
                ? role
                  ? getTenantRolePath(role, upcomingMeeting.meetingLink)
                  : upcomingMeeting.meetingLink
                : role
                  ? getTenantRolePath(role, `/meeting/room/${upcomingMeeting._id}`)
                  : `/meeting/room/${upcomingMeeting._id}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl bg-primary-50 border border-primary-100/60 px-3 py-1.5 text-primary hover:bg-primary-100 transition-colors animate-pulse mr-2"
            title="Join Meeting"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            <Video className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold max-w-30 truncate">{upcomingMeeting.title}</span>
            <span className="font-mono text-[10px] font-bold bg-primary-100/80 px-2 py-0.5 rounded-full text-primary-700 tabular-nums">
              {(() => {
                if (!now) return '';
                const diffMs = new Date(upcomingMeeting.scheduledAt).getTime() - now.getTime();
                const diffMin = Math.max(0, Math.ceil(diffMs / 60000));
                return diffMin === 0 ? 'Now' : `${diffMin}m`;
              })()}
            </span>
          </Link>
        )}

        {/* ── Minimized Call Banner (WhatsApp-style) ───────────────────────── */}
        {callState.isActive && callState.isMinimized && (
          <button
            type="button"
            onClick={() => setCallState({ isMinimized: false })}
            className="flex items-center gap-2.5 rounded-full bg-emerald-50 border border-emerald-200/60 px-3 py-1.5 text-emerald-700 hover:bg-emerald-100/60 transition-colors animate-pulse mr-2 cursor-pointer"
            title="Maximize Call"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            {callState.type === 'video' ? (
              <Video className="h-3.5 w-3.5 text-emerald-600 animate-spin-slow" />
            ) : (
              <Phone className="h-3.5 w-3.5 text-emerald-600 animate-bounce" />
            )}
            <span className="text-xs font-semibold max-w-25 truncate">
              {callState.callerName ?? 'Call'}
            </span>
            <span className="font-mono text-[10px] font-bold bg-emerald-100/80 px-2 py-0.5 rounded-full text-emerald-800 tabular-nums">
              {formattedCallDuration}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            setNavSearchOpen(true);
            setNotifOpen(false);
            setDropdownOpen(false);
          }}
          className="group flex h-10 items-center justify-center gap-1.5 rounded-xl px-1.5 text-slate-500 transition-colors hover:text-sky-600 cursor-pointer"
          aria-label="Search available navigation"
          title={`Search navigation (${navShortcutLabel})`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 transition-colors group-hover:bg-sky-50 group-hover:text-sky-600">
            <Search className="h-4.5 w-4.5" />
          </span>
        </button>

        {/* ── Global SWR Mutate Refresh ──────────────────────────────────── */}
        <button
          type="button"
          onClick={() => {
            openCalendar();
            setNotifOpen(false);
            setDropdownOpen(false);
          }}
          className="group flex h-10 items-center justify-center gap-1.5 rounded-xl px-1.5 text-slate-500 transition-colors hover:text-primary cursor-pointer"
          aria-label="Open my calendar"
          title="My calendar"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 transition-colors group-hover:bg-primary-50 group-hover:text-primary">
            <Calendar className="h-4.5 w-4.5" />
          </span>
        </button>

        {/* ── AI Assistant ──────────────────────────────────────────────── */}
        <button
          type="button"
          onClick={() => {
            setGuideOpen(true);
            setNotifOpen(false);
            closeCalendar();
            setDropdownOpen(false);
          }}
          className="group flex h-10 items-center justify-center gap-1.5 rounded-xl px-1.5 text-slate-500 transition-colors hover:text-violet-600 cursor-pointer"
          aria-label="AI Assistant & Setup Guide"
          title="AI Assistant & Setup Guide"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 transition-colors group-hover:bg-violet-50 group-hover:text-violet-600">
            <Bot className="h-4.5 w-4.5" />
          </span>
        </button>

        {/* ── Notification bell ──────────────────────────────────────────── */}
        {user && (
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => {
                const next = !notifOpen;
                setNotifOpen(next);
                if (next) mutateNotifs();
                setDropdownOpen(false);
              }}
              className="group flex h-10 items-center justify-center gap-1.5 rounded-xl px-1.5 text-slate-500 transition-colors hover:text-amber-600 cursor-pointer"
              aria-label="Notifications"
              title="Notifications"
            >
              <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 transition-colors group-hover:bg-amber-50 group-hover:text-amber-600">
                <Bell className="h-4.5 w-4.5" />
                <AnimatePresence>
                  {localUnread > 0 && (
                    <motion.span
                      key="notif-badge"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 py-0.5 ring-2 ring-white "
                    >
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" />
                      <span className="relative text-[9px] font-black leading-none text-white tabular-nums">
                        {localUnread > 9 ? '9+' : localUnread}
                      </span>
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
            </button>
            <NotificationPanel
              open={notifOpen}
              notifications={notifications}
              unreadCount={localUnread}
              userId={user?._id ?? ''}
              currentUserId={user?._id ?? ''}
              onClose={() => setNotifOpen(false)}
              onMarkRead={handleMarkRead}
              onMarkAllRead={handleMarkAllRead}
              role={role}
            />
          </div>
        )}

        {/* Separator */}
        <div className="mx-1 h-5 w-px bg-slate-200" />

        {/* ── User avatar ────────────────────────────────────────────────── */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => {
              setDropdownOpen((v) => !v);
              setNotifOpen(false);
            }}
            className="flex items-center cursor-pointer gap-2.5 rounded-xl px-2 py-1.5 hover:bg-slate-100"
          >
            {profilePhoto ? (
              <Image
                src={profilePhoto}
                alt={user?.name ?? 'Profile'}
                width={32}
                height={32}
                className="h-8 w-8 rounded-full object-cover ring-2 ring-white"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-br from-primary-600 via-primary to-primary-400 text-[11px] font-bold text-white ring-2 ring-white">
                {initials}
              </div>
            )}
            <div className="hidden min-w-0 max-w-44 text-left md:block xl:max-w-64">
              <p
                className="truncate text-[12px] font-semibold leading-tight text-slate-800"
                title={user?.name ?? 'User'}
              >
                {user?.name?.slice(0, 23) ?? 'User'}
              </p>
              <p className="text-[10px] leading-tight text-slate-600">
                {role ? formatRoleName(role) : ''}
              </p>
            </div>
            <motion.span
              animate={{ rotate: dropdownOpen ? 180 : 0 }}
              transition={{ duration: 0.18 }}
              className="hidden md:block"
            >
              <ChevronRight className="h-3 w-3 rotate-90 text-slate-600" />
            </motion.span>
          </button>
          <UserDropdown
            open={dropdownOpen}
            user={user as { name: string; email: string; avatar?: string } | null}
            role={role}
            onClose={() => setDropdownOpen(false)}
            onLogout={handleLogout}
          />
        </div>
      </div>

      {/* ── Live notification toasts (top-right, below header) ─────────────── */}
      {toastMounted &&
        createPortal(
          <div className="fixed top-20 right-4 z-9999 flex flex-col gap-2 pointer-events-none">
            <AnimatePresence mode="popLayout">
              {toasts.map((t) => (
                <NotifToast key={t.id} toast={t} onDismiss={dismissToast} role={role} />
              ))}
            </AnimatePresence>
          </div>,
          document.body,
        )}
      {toastMounted &&
        createPortal(
          <AnimatePresence>
            {navSearchOpen && (
              <div className="fixed inset-0 z-110 flex items-start justify-center px-3 pt-[6dvh] sm:px-5 sm:pt-[10dvh]">
                <motion.button
                  type="button"
                  aria-label="Close navigation search"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={closeNavSearch}
                  className="absolute inset-0 cursor-default bg-slate-200/80 backdrop-blur-sm"
                />
                <motion.section
                  role="dialog"
                  aria-modal="true"
                  aria-label="Search navigation"
                  initial={{ opacity: 0, y: -12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  className="relative w-full max-w-3xl overflow-hidden rounded-[1.75rem] bg-white ring-1 ring-white/70"
                >
                  <div className="bg-[linear-gradient(135deg,#f8fbff_0%,#eef7ff_100%)] px-4 pb-4 pt-5 sm:px-6 sm:pb-5">
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Jump to anywhere</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Search everything available to your active role
                        </p>
                      </div>
                      <kbd className="rounded-lg bg-white px-2.5 py-1.5 text-[10px] font-semibold text-slate-500 ring-1 ring-slate-200">
                        {navShortcutLabel}
                      </kbd>
                    </div>
                    <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-sky-100 focus-within:ring-2 focus-within:ring-primary/20">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary">
                        <Search className="h-4.5 w-4.5" />
                      </span>
                      <input
                        ref={navSearchInputRef}
                        value={navSearchQuery}
                        onChange={(event) => {
                          setNavSearchQuery(event.target.value);
                          setNavSearchIndex(0);
                        }}
                        placeholder="Search menus, modules, or sections…"
                        aria-label="Search menus, modules, or sections"
                        className="min-w-0 flex-1 bg-transparent text-base font-medium text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-600"
                      />
                      <kbd className="hidden rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500 sm:block">
                        ESC
                      </kbd>
                    </div>
                  </div>
                  <div
                    ref={navSearchListRef}
                    className="max-h-[55dvh] scroll-py-2 overflow-y-auto bg-white p-2 sm:p-3"
                  >
                    {navSearchResults.map((item, index) => (
                      <button
                        key={item._id}
                        type="button"
                        data-nav-search-index={index}
                        onMouseEnter={() => setNavSearchIndex(index)}
                        onClick={() => navigateToSearchResult(item.href)}
                        className={`flex w-full scroll-my-2 items-center gap-3 rounded-2xl px-3 py-3 text-left transition sm:px-4 cursor-pointer ${index === navSearchIndex ? 'bg-primary-50 text-primary ring-1 ring-primary/10' : 'text-slate-700 hover:bg-slate-50'}`}
                      >
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${index === navSearchIndex ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'}`}
                        >
                          {item.label.charAt(0).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{item.label}</span>
                          <span className="mt-1 flex min-w-0 items-center gap-2 text-[11px] text-slate-600">
                            <span className="truncate">{item.group}</span>
                            <span aria-hidden="true">·</span>
                            <span className="truncate">{item.href.replaceAll('-', ' ')}</span>
                          </span>
                        </span>
                        {index === navSearchIndex && (
                          <kbd className="rounded-lg bg-white px-2 py-1 text-[10px] font-semibold text-primary ring-1 ring-primary/10">
                            Enter
                          </kbd>
                        )}
                        <ChevronRight
                          className={`h-4 w-4 shrink-0 ${index === navSearchIndex ? 'text-primary' : 'text-slate-300'}`}
                        />
                      </button>
                    ))}
                    {!navSearchResults.length && (
                      <div className="px-5 py-12 text-center">
                        <Search className="mx-auto h-7 w-7 text-slate-300" />
                        <p className="mt-3 text-sm font-semibold text-slate-600">
                          No available menu found
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          Results only include modules allowed by your role and subscription.
                        </p>
                      </div>
                    )}
                  </div>
                  <footer className="flex flex-wrap items-center gap-x-5 gap-y-1 bg-slate-50 px-4 py-3 text-[10px] font-medium text-slate-600 sm:px-6">
                    <span>
                      <kbd className="font-semibold text-slate-600">↑ ↓</kbd> Navigate
                    </span>
                    <span>
                      <kbd className="font-semibold text-slate-600">Enter</kbd> Open
                    </span>
                    <span>
                      <kbd className="font-semibold text-slate-600">Esc</kbd> Close
                    </span>
                    <span className="ml-auto hidden sm:inline">RBAC and subscription filtered</span>
                  </footer>
                </motion.section>
              </div>
            )}
          </AnimatePresence>,
          document.body,
        )}
      {toastMounted &&
        createPortal(
          <GlobalCalendarPanel open={calendarOpen} role={role ?? ''} onClose={closeCalendar} />,
          document.body,
        )}
      {toastMounted &&
        createPortal(
          <UserGuidePanel isOpen={guideOpen} onClose={() => setGuideOpen(false)} />,
          document.body,
        )}
    </header>
  );
}
