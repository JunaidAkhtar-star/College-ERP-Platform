/**
 * @file RolesPage.tsx
 * @description Role Management — fully dynamic CRUD for custom roles +
 *              read-only view of system roles. Supports:
 *              - List all roles (system + custom) via GET role?includeInactive=true
 *              - Create custom role via POST role
 *              - Edit role name/description via PUT role/:id
 *              - Manage permissions via PUT role/:id/permissions (module × action matrix)
 *              - Toggle active/inactive via PATCH role/:id/toggle
 *              - Delete custom role via DELETE role/:id
 *              All modules and actions sourced from backend enum constants —
 *              nothing hardcoded; displayName read from API response.
 * @module features/role-wise-features/roles
 */

'use client';

import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { Action, Column } from '@/shared/core/CustomTable';
import DataViewSwitcher from '@/shared/core/DataViewSwitcher';
import { useHasAnyRole, useHasRole } from '@/shared/hooks/useHasRole';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { AnimatePresence, motion } from '@/shared/utils/motion';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Edit2,
  Lock,
  Menu,
  Plus,
  Power,
  Settings,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';

// ─── Types ────────────────────────────────────────────────────────────────────

interface IPermission {
  module: string;
  actions: string[];
}

interface IRole {
  _id: string;
  name: string;
  baseRole: string;
  displayName: string;
  description?: string;
  permissions: IPermission[];
  allowedNavItems?: string[];
  isSystem: boolean;
  isActive: boolean;
  usersCount?: number;
  createdAt: string;
  [key: string]: unknown;
}

interface INavItem {
  _id: string;
  kind: 'group' | 'link';
  label: string;
  href?: string;
  icon?: string;
  parentId?: string | null;
  requiredRoles?: string[];
  sortOrder: number;
  isActive: boolean;
}

interface IUserAssignment {
  _id: string;
  name: string;
  email: string;
  roles: string[];
  customRoleIds?: string[];
}

// ─── Backend enum mirrors ─────────────────────────────────────────────────────
// These match the PermissionAction and Module enums in
// backend/server/constants/permissions.ts exactly.

const ALL_ACTIONS = ['view', 'create', 'edit', 'delete', 'approve', 'export'];

const MODULE_GROUPS: { label: string; modules: string[] }[] = [
  { label: 'Foundation', modules: ['user_management', 'role_management', 'audit_log'] },
  {
    label: 'Admission',
    modules: ['admission', 'counseling', 'student_profile', 'document_management'],
  },
  {
    label: 'Academic',
    modules: [
      'academic_calendar',
      'batch_management',
      'section_management',
      'student_allotment',
      'curriculum',
      'department',
      'subject',
      'faculty_management',
      'faculty_workload',
      'timetable',
      'course_progress',
      'lesson_plan',
    ],
  },
  { label: 'Attendance', modules: ['student_attendance', 'faculty_attendance'] },
  {
    label: 'Examination',
    modules: ['examination', 'internal_assessment', 'question_bank', 'result'],
  },
  { label: 'LMS', modules: ['study_material', 'assignment', 'quiz'] },
  { label: 'Mentoring', modules: ['mentor', 'counseling_notes'] },
  {
    label: 'Administrative',
    modules: [
      'scholarship',
      'library',
      'placement',
      'notice',
      'chat',
      'notification',
      'parent_portal',
      'procurement',
      'communication_hub',
      'grievance',
      'semester_registration',
      'task_management',
      'meeting',
      'gate_pass',
      'store',
      'research',
      'iic',
      'clubs',
    ],
  },
  { label: 'Quality', modules: ['iqac', 'naac', 'nba', 'compliance'] },
  { label: 'HR & Finance', modules: ['employee', 'payroll', 'fee_management', 'accounts'] },
  { label: 'Facilities', modules: ['hostel', 'transport', 'event', 'alumni'] },
  {
    label: 'Analytics & Automation',
    modules: [
      'dashboard',
      'report_center',
      'import_center',
      'document_template',
      'form_workflow',
      'discipline',
      'data_portability',
      'collaboration',
      'external_connector',
      'sso_settings',
    ],
  },
];

/**
 * Maps a sidebar nav-item `href` to the permission modules it touches.
 * A single page can read/write across multiple modules (e.g. the placement
 * page uses `placement`, `student_profile` and `notification`).
 *
 * Used in the Create Role wizard to scope Step 3 (permissions) to only the
 * modules the user actually selected menus for in Step 2.
 */
const HREF_TO_MODULES: Record<string, string[]> = {
  '/dashboard': ['dashboard'],
  '/report-center': ['report_center'],
  '/import-center': ['import_center'],
  '/document-designer': ['document_template'],
  '/communication-hub': ['communication_hub'],
  '/sso-settings': ['sso_settings'],
  '/forms': ['form_workflow'],
  '/discipline': ['discipline'],
  '/data-portability': ['data_portability'],
  '/collaboration': ['collaboration'],
  '/external-connector': ['external_connector'],
  '/users': ['user_management'],
  '/roles': ['role_management'],
  '/audit-log': ['audit_log'],
  '/departments': ['department'],
  '/nav-admin': ['role_management'],
  '/admission': ['admission'],
  '/student-management': ['student_profile'],
  '/faculty-management': ['faculty_management'],
  '/subjects': ['subject'],
  '/curriculum': ['curriculum'],
  '/academic-structure': ['batch_management', 'section_management', 'student_allotment'],
  '/academic-calendar': ['academic_calendar'],
  '/timetable': ['timetable'],
  '/lesson-plan': ['lesson_plan'],
  '/course-progress': ['course_progress'],
  '/faculty-workload': ['faculty_workload'],
  '/attendance': ['student_attendance'],
  '/faculty-attendance': ['faculty_attendance'],
  '/examination': ['examination', 'result', 'internal_assessment'],
  '/question-bank': ['question_bank'],
  '/assignment': ['assignment'],
  '/quiz': ['quiz'],
  '/study-material': ['study_material'],
  '/fee': ['fee_management'],
  '/accounts': ['accounts'],
  '/payroll': ['payroll'],
  '/scholarship': ['scholarship'],
  '/payment-settings': ['accounts'],
  '/hr': ['employee'],
  '/leave': ['employee'],
  '/mentor': ['mentor'],
  '/counseling': ['counseling', 'counseling_notes'],
  '/grievance': ['grievance'],
  '/semester-registration': ['semester_registration'],
  '/library': ['library'],
  '/hostel': ['hostel'],
  '/transport': ['transport'],
  '/placement': ['placement'],
  '/training-session': ['placement'],
  '/alumni': ['alumni'],
  '/job-posting': ['placement'],
  '/search': [],
  '/task-management': ['task_management'],
  '/notice': ['notice'],
  '/event': ['event'],
  '/meeting': ['meeting'],
  '/chat': ['chat'],
  '/document': ['document_management'],
  '/notification': ['notification'],
  '/iqac': ['iqac'],
  '/naac-nba': ['naac', 'nba'],
  '/compliance': ['compliance'],
  '/procurement': ['procurement'],
  '/store': ['store'],
  '/research-development': ['research'],
  '/iic': ['iic'],
  '/clubs': ['clubs'],
  '/gate-pass': ['gate_pass'],
  '/parent/ward': ['parent_portal'],
  '/parent/attendance': ['parent_portal'],
  '/parent/fees': ['parent_portal'],
  '/parent/results': ['parent_portal'],
};

function modulesForHrefs(hrefs: string[]): Set<string> {
  const set = new Set<string>();
  for (const href of hrefs) {
    const mods = HREF_TO_MODULES[href];
    if (mods) mods.forEach((m) => set.add(m));
  }
  return set;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtModule(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Permission Matrix ────────────────────────────────────────────────────────

function PermissionMatrix({
  permissions,
  onChange,
  disabled,
  restrictToModules,
}: {
  permissions: IPermission[];
  onChange: (p: IPermission[]) => void;
  disabled?: boolean;
  /** When provided, only modules in this set are shown / selectable. */
  restrictToModules?: Set<string>;
}) {
  // Filter groups (and modules within each group) by `restrictToModules`.
  const visibleGroups = useMemo(() => {
    if (!restrictToModules) return MODULE_GROUPS;
    return MODULE_GROUPS.map((g) => ({
      ...g,
      modules: g.modules.filter((m) => restrictToModules.has(m)),
    })).filter((g) => g.modules.length > 0);
  }, [restrictToModules]);
  const visibleModules = useMemo(() => visibleGroups.flatMap((g) => g.modules), [visibleGroups]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    Object.fromEntries(MODULE_GROUPS.map((g) => [g.label, true])),
  );

  function getActions(mod: string) {
    return permissions.find((p) => p.module === mod)?.actions ?? [];
  }

  function toggleAction(mod: string, action: string) {
    if (disabled) return;
    const existing = permissions.find((p) => p.module === mod);
    if (existing) {
      const next = existing.actions.includes(action)
        ? existing.actions.filter((a) => a !== action)
        : [...existing.actions, action];
      onChange(
        next.length === 0
          ? permissions.filter((p) => p.module !== mod)
          : permissions.map((p) => (p.module === mod ? { ...p, actions: next } : p)),
      );
    } else {
      onChange([...permissions, { module: mod, actions: [action] }]);
    }
  }

  function toggleModule(mod: string, on: boolean) {
    if (disabled) return;
    if (on) {
      const exists = permissions.find((p) => p.module === mod);
      onChange(
        exists
          ? permissions.map((p) => (p.module === mod ? { ...p, actions: ALL_ACTIONS } : p))
          : [...permissions, { module: mod, actions: ALL_ACTIONS }],
      );
    } else {
      onChange(permissions.filter((p) => p.module !== mod));
    }
  }

  function toggleGroup(mods: string[], on: boolean) {
    if (disabled) return;
    let updated = [...permissions];
    if (on) {
      mods.forEach((mod) => {
        const idx = updated.findIndex((p) => p.module === mod);
        if (idx >= 0) updated[idx] = { ...updated[idx], actions: ALL_ACTIONS };
        else updated.push({ module: mod, actions: ALL_ACTIONS });
      });
    } else {
      updated = updated.filter((p) => !mods.includes(p.module));
    }
    onChange(updated);
  }

  const total = permissions.reduce((s, p) => s + p.actions.length, 0);
  const warnings = permissions.flatMap((permission) => {
    const elevated = permission.actions.filter((action) =>
      ['create', 'edit', 'delete', 'approve', 'export'].includes(action),
    );
    return elevated.length && !permission.actions.includes('view')
      ? [`${fmtModule(permission.module)} can ${elevated.join(', ')} but cannot view records.`]
      : [];
  });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {total} permissions · {permissions.length} modules
        </p>
        {!disabled && (
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() =>
                onChange(visibleModules.map((m) => ({ module: m, actions: ALL_ACTIONS })))
              }
              className="font-medium text-primary hover:underline"
            >
              Select All
            </button>
            <span className="text-slate-300">·</span>
            <button
              type="button"
              onClick={() => onChange([])}
              className="font-medium text-slate-500 hover:underline"
            >
              Clear All
            </button>
          </div>
        )}
      </div>
      {warnings.length > 0 && (
        <div className="mb-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
          <p className="font-bold">Review permission conflicts</p>
          {warnings.slice(0, 4).map((warning) => (
            <p key={warning} className="mt-1">
              {warning}
            </p>
          ))}
        </div>
      )}

      <div className="max-h-105 space-y-2 overflow-y-auto pr-1">
        {visibleGroups.length === 0 && (
          <p className="py-6 text-center text-xs text-slate-600">
            No menus selected — go back and pick at least one to configure permissions.
          </p>
        )}
        {visibleGroups.map((g) => {
          const allOn = g.modules.every((m) => ALL_ACTIONS.every((a) => getActions(m).includes(a)));
          const partial = !allOn && g.modules.some((m) => getActions(m).length > 0);
          const open = expanded[g.label] ?? true;

          return (
            <div key={g.label} className="rounded-xl bg-slate-50">
              <div className="flex items-center gap-2 px-3 py-2.5">
                {!disabled && (
                  <input
                    type="checkbox"
                    checked={allOn}
                    ref={(el) => {
                      if (el) el.indeterminate = partial;
                    }}
                    onChange={(e) => toggleGroup(g.modules, e.target.checked)}
                    className="h-4 w-4 rounded accent-primary"
                  />
                )}
                <button
                  type="button"
                  className="flex flex-1 items-center gap-2 text-left"
                  onClick={() => setExpanded((p) => ({ ...p, [g.label]: !open }))}
                >
                  <span className="text-sm font-semibold text-slate-700">{g.label}</span>
                  <span className="text-xs text-slate-600">({g.modules.length})</span>
                  {open ? (
                    <ChevronUp className="ml-auto h-3.5 w-3.5 text-slate-600" />
                  ) : (
                    <ChevronDown className="ml-auto h-3.5 w-3.5 text-slate-600" />
                  )}
                </button>
              </div>

              <AnimatePresence>
                {open && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-1 border-t border-slate-100 px-3 pb-2 pt-1">
                      {g.modules.map((mod) => {
                        const acts = getActions(mod);
                        const allMod = ALL_ACTIONS.every((a) => acts.includes(a));
                        const partMod = !allMod && acts.length > 0;
                        return (
                          <div
                            key={mod}
                            className="flex items-center gap-3 rounded-lg bg-white px-2.5 py-1.5"
                          >
                            {!disabled && (
                              <input
                                type="checkbox"
                                checked={allMod}
                                ref={(el) => {
                                  if (el) el.indeterminate = partMod;
                                }}
                                onChange={(e) => toggleModule(mod, e.target.checked)}
                                className="h-3.5 w-3.5 rounded accent-primary"
                              />
                            )}
                            <span className="w-44 shrink-0 text-xs font-medium text-slate-600">
                              {fmtModule(mod)}
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {ALL_ACTIONS.map((action) => {
                                const on = acts.includes(action);
                                return (
                                  <button
                                    key={action}
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => toggleAction(mod, action)}
                                    className={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition-colors ${on ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'} ${disabled ? 'cursor-default' : 'cursor-pointer'}`}
                                  >
                                    {action.charAt(0).toUpperCase() + action.slice(1)}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Role Form Modal ───────────────────────────────────────────────────────────

function RoleFormModal({
  role,
  onClose,
  onSuccess,
}: {
  role?: IRole | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEdit = !!role;
  const { mutation, isLoading } = useMutation();

  // Sidebar nav items (only needed in create flow — edit uses dedicated drawers)
  const { data: navData } = useSwr(isEdit ? null : 'nav');
  const { data: roleOptionsData } = useSwr(isEdit ? null : 'role?includeInactive=true');
  const navItems: INavItem[] = useMemo(
    () => (navData as { data?: INavItem[] })?.data ?? [],
    [navData],
  );
  const groups = useMemo(
    () =>
      navItems
        .filter((n) => n.kind === 'group' && n.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [navItems],
  );
  const systemRoleOptions: IRole[] = useMemo(
    () =>
      ((roleOptionsData as { data?: IRole[] })?.data ?? []).filter(
        (candidate) => candidate.isSystem && candidate.isActive,
      ),
    [roleOptionsData],
  );
  const linksByGroup = useMemo(() => {
    const map: Record<string, INavItem[]> = {};
    navItems
      .filter((n) => n.kind === 'link' && n.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .forEach((l) => {
        const gid = String(l.parentId ?? '');
        if (!map[gid]) map[gid] = [];
        map[gid].push(l);
      });
    return map;
  }, [navItems]);

  const [step, setStep] = useState(0);
  const [basics, setBasics] = useState({
    displayName: role?.displayName ?? '',
    description: role?.description ?? '',
    baseRole: role?.baseRole ?? '',
  });
  const [selectedNav, setSelectedNav] = useState<Set<string>>(new Set());
  const [permissions, setPermissions] = useState<IPermission[]>([]);
  const [basicsError, setBasicsError] = useState('');

  const totalNav = navItems.filter((n) => n.isActive).length;
  const totalPerms = permissions.reduce((n, p) => n + p.actions.length, 0);

  function toggleNav(id: string) {
    setSelectedNav((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleNavGroup(group: INavItem, on: boolean) {
    const links = linksByGroup[group._id] ?? [];
    setSelectedNav((prev) => {
      const next = new Set(prev);
      if (on) {
        next.add(group._id);
        links.forEach((l) => next.add(l._id));
      } else {
        next.delete(group._id);
        links.forEach((l) => next.delete(l._id));
      }
      return next;
    });
  }
  function selectAllNav() {
    setSelectedNav(new Set(navItems.filter((n) => n.isActive).map((n) => n._id)));
  }

  // Derive which permission modules are relevant based on the menus the user
  // picked in step 2. Step 3 (permissions) is then scoped to just those.
  const relevantModules = useMemo(() => {
    const selectedHrefs = navItems
      .filter((n) => n.kind === 'link' && n.href && selectedNav.has(n._id))
      .map((n) => n.href as string);
    return modulesForHrefs(selectedHrefs);
  }, [navItems, selectedNav]);

  // Quick presets — scoped to the modules relevant to the selected menus.
  function applyPreset(preset: 'readonly' | 'staff' | 'admin' | 'none') {
    if (preset === 'none') return setPermissions([]);
    const mods = Array.from(relevantModules);
    if (preset === 'readonly')
      return setPermissions(mods.map((m) => ({ module: m, actions: ['view'] })));
    if (preset === 'staff')
      return setPermissions(mods.map((m) => ({ module: m, actions: ['view', 'create', 'edit'] })));
    return setPermissions(mods.map((m) => ({ module: m, actions: ALL_ACTIONS })));
  }

  function next() {
    if (step === 0) {
      const dn = basics.displayName.trim();
      if (dn.length < 2) {
        setBasicsError('Display name must be at least 2 characters');
        return;
      }
      if (dn.length > 60) {
        setBasicsError('Display name is too long');
        return;
      }
      if (!isEdit && !basics.baseRole) {
        setBasicsError('Select the base role that defines this role’s record scope');
        return;
      }
      setBasicsError('');
    }
    setStep((s) => Math.min(s + 1, isEdit ? 0 : 3));
  }
  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleFinalSubmit() {
    const body: Record<string, unknown> = {
      displayName: basics.displayName.trim(),
      description: basics.description.trim(),
    };
    if (!isEdit) {
      body['baseRole'] = basics.baseRole;
      body['allowedNavItems'] = Array.from(selectedNav);
      body['permissions'] = permissions;
    }
    const res = await mutation(isEdit ? `role/${role!._id}` : 'role', {
      method: isEdit ? 'PUT' : 'POST',
      body,
    });
    if (res) {
      toast.success(isEdit ? 'Role updated' : 'Role created');
      onSuccess();
      onClose();
    } else {
      toast.error(isEdit ? 'Failed to update role' : 'Failed to create role');
    }
  }

  const STEPS = [
    { label: 'Basics', icon: ShieldCheck },
    { label: 'Menu Access', icon: Menu },
    { label: 'Permissions', icon: Lock },
    { label: 'Review', icon: Check },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className={`relative z-10 flex max-h-[92dvh] w-full ${isEdit ? 'max-w-md' : 'max-w-4xl'} flex-col overflow-hidden rounded-2xl bg-white`}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between bg-linear-to-br from-primary/5 to-secondary/5 px-6 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {isEdit ? 'Edit Role' : 'Create New Role'}
              </h2>
              <p className="text-xs text-slate-500">
                {isEdit
                  ? 'Update display name and description'
                  : 'Set up a role in three easy steps'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-600 hover:bg-white/60"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Step indicator (create only) ───────────────────────────────── */}
        {!isEdit && (
          <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-3">
            {STEPS.map((s, i) => {
              const active = i === step;
              const done = i < step;
              const Icon = s.icon;
              return (
                <React.Fragment key={s.label}>
                  <button
                    type="button"
                    onClick={() => i < step && setStep(i)}
                    disabled={i > step}
                    className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                      active
                        ? 'bg-primary text-white'
                        : done
                          ? 'cursor-pointer text-primary hover:bg-primary/10'
                          : 'text-slate-600'
                    }`}
                  >
                    <span
                      className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${
                        active
                          ? 'bg-white text-primary'
                          : done
                            ? 'bg-primary text-white'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {done ? <Check className="h-3 w-3" /> : i + 1}
                    </span>
                    <Icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{s.label}</span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <span className={`h-px flex-1 ${i < step ? 'bg-primary' : 'bg-slate-200'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <AnimatePresence mode="wait">
            {/* Step 0 / Edit — basics */}
            {step === 0 && (
              <motion.div
                key="basics"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="space-y-5"
              >
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Role Name *
                  </label>
                  <input
                    type="text"
                    value={basics.displayName}
                    onChange={(e) => setBasics((b) => ({ ...b, displayName: e.target.value }))}
                    placeholder="e.g. Finance Manager, Lab Assistant, Hostel Warden"
                    className="w-full rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-primary"
                    autoFocus
                  />
                  {basicsError ? (
                    <p className="mt-1.5 text-xs text-red-500">{basicsError}</p>
                  ) : (
                    !isEdit && (
                      <p className="mt-1.5 text-[11px] text-slate-600">
                        A unique internal key will be generated from this name automatically.
                      </p>
                    )
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Base Record Scope *
                  </label>
                  {isEdit ? (
                    <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      {systemRoleOptions.find((candidate) => candidate.name === basics.baseRole)
                        ?.displayName ?? fmtModule(basics.baseRole)}
                    </div>
                  ) : (
                    <select
                      value={basics.baseRole}
                      onChange={(event) =>
                        setBasics((current) => ({ ...current, baseRole: event.target.value }))
                      }
                      className="w-full rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Select a base role</option>
                      {systemRoleOptions.map((candidate) => (
                        <option key={candidate._id} value={candidate.name}>
                          {candidate.displayName}
                        </option>
                      ))}
                    </select>
                  )}
                  <p className="mt-1.5 text-[11px] text-slate-600">
                    Defines ownership and department scope; permissions below define allowed
                    actions.
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={basics.description}
                    onChange={(e) => setBasics((b) => ({ ...b, description: e.target.value }))}
                    placeholder="What is this role responsible for?"
                    className="w-full resize-none rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-primary"
                  />
                </div>
              </motion.div>
            )}

            {/* Step 1 — menu access */}
            {!isEdit && step === 1 && (
              <motion.div
                key="menu"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="space-y-3"
              >
                <div className="rounded-xl bg-primary/5 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-800">
                    Which sidebar menus should this role see?
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Pick whole groups or individual items. The user will only see what you select
                    here.
                  </p>
                </div>

                <div className="flex items-center justify-between px-1">
                  <p className="text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">{selectedNav.size}</span> of{' '}
                    {totalNav} items selected
                  </p>
                  <div className="flex gap-2 text-xs">
                    <button
                      type="button"
                      onClick={selectAllNav}
                      className="font-medium text-primary hover:underline"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300">·</span>
                    <button
                      type="button"
                      onClick={() => setSelectedNav(new Set())}
                      className="font-medium text-slate-500 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {groups.length === 0 && (
                    <p className="py-6 text-center text-xs text-slate-600">Loading menus…</p>
                  )}
                  {groups.map((g) => {
                    const links = linksByGroup[g._id] ?? [];
                    const selectedCount = links.filter((l) => selectedNav.has(l._id)).length;
                    const allOn =
                      selectedNav.has(g._id) && links.length > 0 && selectedCount === links.length;
                    const partial = selectedCount > 0 && selectedCount < links.length;
                    return (
                      <div key={g._id} className="rounded-xl bg-slate-50 p-3">
                        <label className="flex cursor-pointer items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={allOn}
                              ref={(el) => {
                                if (el) el.indeterminate = partial;
                              }}
                              onChange={(e) => toggleNavGroup(g, e.target.checked)}
                              className="h-4 w-4 rounded accent-primary"
                            />
                            <span className="text-sm font-semibold text-slate-800">{g.label}</span>
                          </div>
                          <span className="text-[11px] text-slate-600">
                            {selectedCount}/{links.length}
                          </span>
                        </label>
                        {links.length > 0 && (
                          <div className="mt-2 ml-6 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                            {links.map((l) => (
                              <label
                                key={l._id}
                                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 hover:bg-white"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedNav.has(l._id)}
                                  onChange={() => toggleNav(l._id)}
                                  className="h-3.5 w-3.5 rounded accent-primary"
                                />
                                <span className="text-xs text-slate-600">{l.label}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Step 2 — permissions */}
            {!isEdit && step === 2 && (
              <motion.div
                key="perms"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="space-y-3"
              >
                <div className="rounded-xl bg-primary/5 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-800">
                    What can this role do inside each feature?
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Showing only the {relevantModules.size} module
                    {relevantModules.size === 1 ? '' : 's'} tied to the {selectedNav.size} menu
                    {selectedNav.size === 1 ? '' : 's'} you picked. Start with a preset, then
                    fine-tune.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="text-xs font-medium text-slate-500">Quick presets:</span>
                  <button
                    type="button"
                    onClick={() => applyPreset('readonly')}
                    className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                  >
                    Read-only
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('staff')}
                    className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                  >
                    Staff (view/create/edit)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('admin')}
                    className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20"
                  >
                    Full Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('none')}
                    className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500 hover:bg-slate-200"
                  >
                    Clear
                  </button>
                </div>

                <PermissionMatrix
                  permissions={permissions}
                  onChange={setPermissions}
                  restrictToModules={relevantModules}
                />
              </motion.div>
            )}

            {/* Step 3 — review */}
            {!isEdit && step === 3 && (
              <motion.div
                key="review"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="space-y-4"
              >
                <div className="rounded-xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-100">
                  <p className="text-sm font-semibold text-emerald-800">
                    Almost done — review and create
                  </p>
                  <p className="mt-0.5 text-xs text-emerald-700">
                    You can change menu access and permissions later from the role list.
                  </p>
                </div>

                <div className="space-y-3">
                  <ReviewRow
                    label="Role Name"
                    value={basics.displayName}
                    onEdit={() => setStep(0)}
                  />
                  {basics.description && (
                    <ReviewRow
                      label="Description"
                      value={basics.description}
                      onEdit={() => setStep(0)}
                    />
                  )}
                  <ReviewRow
                    label="Menu Access"
                    value={`${selectedNav.size} of ${totalNav} sidebar items`}
                    onEdit={() => setStep(1)}
                  />
                  <ReviewRow
                    label="Permissions"
                    value={`${totalPerms} actions across ${permissions.length} modules`}
                    onEdit={() => setStep(2)}
                  />
                </div>

                {selectedNav.size === 0 && permissions.length === 0 && (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    Heads up — this role has no menus and no permissions. Users assigned to it will
                    see an empty sidebar.
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4">
          <div className="text-xs text-slate-600">
            {!isEdit && `Step ${step + 1} of ${STEPS.length}`}
          </div>
          <div className="flex gap-3">
            {!isEdit && step > 0 && (
              <CustomButton variant="cancel" type="button" onClick={back}>
                Back
              </CustomButton>
            )}
            {(isEdit || step === STEPS.length - 1) && (
              <>
                <CustomButton variant="cancel" type="button" onClick={onClose}>
                  Cancel
                </CustomButton>
                <CustomButton
                  variant="primary"
                  type="button"
                  loading={isLoading}
                  onClick={handleFinalSubmit}
                  startIcon={<Check className="h-4 w-4" />}
                >
                  {isEdit ? 'Save Changes' : 'Create Role'}
                </CustomButton>
              </>
            )}
            {!isEdit && step < STEPS.length - 1 && (
              <CustomButton variant="primary" type="button" onClick={next}>
                Continue
              </CustomButton>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function ReviewRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-slate-600 uppercase">{label}</p>
        <p className="mt-0.5 text-sm wrap-break-word text-slate-800">{value}</p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        <Edit2 className="h-3 w-3" />
        Edit
      </button>
    </div>
  );
}

// ─── Permission Drawer ─────────────────────────────────────────────────────────

function PermissionDrawer({
  role,
  onClose,
  onSuccess,
}: {
  role: IRole;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [permissions, setPermissions] = useState<IPermission[]>(role.permissions ?? []);
  const { mutation, isLoading } = useMutation();

  async function handleSave() {
    const res = await mutation(`role/${role._id}/permissions`, {
      method: 'PUT',
      body: { permissions },
    });
    if (res) {
      toast.success('Permissions updated');
      onSuccess();
      onClose();
    } else {
      toast.error('Failed to update permissions');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        className="relative z-10 flex w-full max-w-2xl flex-col bg-white"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Edit Permissions</h2>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="text-sm font-semibold text-primary">{role.displayName}</span>
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                {role.name}
              </code>
              {role.isSystem && (
                <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600">
                  SYSTEM
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <PermissionMatrix permissions={permissions} onChange={setPermissions} />
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <CustomButton variant="cancel" onClick={onClose} type="button">
            Cancel
          </CustomButton>
          <CustomButton
            variant="primary"
            onClick={handleSave}
            loading={isLoading}
            startIcon={<Check className="h-4 w-4" />}
          >
            Save Permissions
          </CustomButton>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Role Detail Drawer (view mode) ───────────────────────────────────────────

function RoleDetailDrawer({
  role,
  onClose,
  onEditPermissions,
}: {
  role: IRole;
  onClose: () => void;
  onEditPermissions: () => void;
}) {
  const totalPerms = role.permissions.reduce((s, p) => s + p.actions.length, 0);
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        className="relative z-10 flex w-full max-w-lg flex-col bg-white"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{role.displayName}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <code className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                {role.name}
              </code>
              {role.isSystem && (
                <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600">
                  SYSTEM
                </span>
              )}
              {!role.isActive && (
                <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-500">
                  INACTIVE
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {role.description && <p className="text-sm text-slate-500">{role.description}</p>}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Modules', value: role.permissions.length },
              { label: 'Permissions', value: totalPerms },
              { label: 'Users', value: role.usersCount ?? 0 },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-slate-50 p-3 text-center">
                <p className="text-lg font-bold text-slate-900">{s.value}</p>
                <p className="text-xs text-slate-600">{s.label}</p>
              </div>
            ))}
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">
              Permission Matrix (read-only)
            </p>
            <PermissionMatrix permissions={role.permissions} onChange={() => {}} disabled />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <CustomButton variant="cancel" onClick={onClose} type="button">
            Close
          </CustomButton>
          <CustomButton
            variant="primary"
            onClick={onEditPermissions}
            startIcon={<Settings className="h-4 w-4" />}
          >
            Edit Permissions
          </CustomButton>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Nav Items Drawer ─────────────────────────────────────────────────────────

function NavItemsDrawer({
  role,
  onClose,
  onSuccess,
}: {
  role: IRole;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { data: navData, isLoading: navLoading } = useSwr('nav');
  const navItems: INavItem[] = useMemo(
    () => (navData as { data?: INavItem[] })?.data ?? [],
    [navData],
  );
  const [selected, setSelected] = useState<Set<string>>(() => new Set(role.allowedNavItems ?? []));
  const { mutation, isLoading } = useMutation();

  const groups = useMemo(
    () =>
      navItems
        .filter((n) => n.kind === 'group' && n.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [navItems],
  );
  const linksByGroup = useMemo(() => {
    const map: Record<string, INavItem[]> = {};
    navItems
      .filter((n) => n.kind === 'link' && n.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .forEach((l) => {
        const gid = String(l.parentId ?? '');
        if (!map[gid]) map[gid] = [];
        map[gid].push(l);
      });
    return map;
  }, [navItems]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleGroup(group: INavItem, on: boolean) {
    const links = linksByGroup[group._id] ?? [];
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) {
        next.add(group._id);
        links.forEach((l) => next.add(l._id));
      } else {
        next.delete(group._id);
        links.forEach((l) => next.delete(l._id));
      }
      return next;
    });
  }

  function selectAll() {
    const ids = new Set<string>();
    navItems.filter((n) => n.isActive).forEach((n) => ids.add(n._id));
    setSelected(ids);
  }

  async function handleSave() {
    const res = await mutation(`role/${role._id}/nav-items`, {
      method: 'PUT',
      body: { allowedNavItems: Array.from(selected) },
    });
    if (res) {
      toast.success('Navigation access updated');
      onSuccess();
      onClose();
    } else {
      toast.error('Failed to update navigation access');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        className="relative z-10 flex w-full max-w-2xl flex-col bg-white"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Navigation Access</h2>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="text-sm font-semibold text-primary">{role.displayName}</span>
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                {role.name}
              </code>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              {selected.size} of {navItems.filter((n) => n.isActive).length} items selected
            </p>
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={selectAll}
                className="font-medium text-primary hover:underline"
              >
                Select All
              </button>
              <span className="text-slate-300">·</span>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="font-medium text-slate-500 hover:underline"
              >
                Clear All
              </button>
            </div>
          </div>

          {navLoading ? (
            <p className="py-8 text-center text-sm text-slate-600">Loading navigation…</p>
          ) : (
            <div className="space-y-2">
              {groups.map((g) => {
                const links = linksByGroup[g._id] ?? [];
                const allOn = selected.has(g._id) && links.every((l) => selected.has(l._id));
                const partial =
                  !allOn && (selected.has(g._id) || links.some((l) => selected.has(l._id)));
                return (
                  <div key={g._id} className="rounded-xl bg-slate-50">
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={allOn}
                        ref={(el) => {
                          if (el) el.indeterminate = partial;
                        }}
                        onChange={(e) => toggleGroup(g, e.target.checked)}
                        className="h-4 w-4 rounded accent-primary"
                      />
                      <span className="text-sm font-semibold text-slate-700">{g.label}</span>
                      <span className="text-xs text-slate-600">({links.length})</span>
                    </div>
                    {links.length > 0 && (
                      <div className="space-y-1 border-t border-slate-100 px-3 pb-2 pt-1">
                        {links.map((l) => (
                          <label
                            key={l._id}
                            className="flex cursor-pointer items-center gap-3 rounded-lg bg-white px-2.5 py-1.5 hover:bg-slate-50"
                          >
                            <input
                              type="checkbox"
                              checked={selected.has(l._id)}
                              onChange={() => toggle(l._id)}
                              className="h-3.5 w-3.5 rounded accent-primary"
                            />
                            <span className="text-xs font-medium text-slate-600">{l.label}</span>
                            {l.href && (
                              <code className="ml-auto text-[10px] text-slate-600">{l.href}</code>
                            )}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {/* Orphan links (no parent) */}
              {(linksByGroup[''] ?? []).length > 0 && (
                <div className="rounded-xl bg-slate-50">
                  <div className="px-3 py-2.5 text-sm font-semibold text-slate-700">Top-level</div>
                  <div className="space-y-1 border-t border-slate-100 px-3 pb-2 pt-1">
                    {(linksByGroup[''] ?? []).map((l) => (
                      <label
                        key={l._id}
                        className="flex cursor-pointer items-center gap-3 rounded-lg bg-white px-2.5 py-1.5 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(l._id)}
                          onChange={() => toggle(l._id)}
                          className="h-3.5 w-3.5 rounded accent-primary"
                        />
                        <span className="text-xs font-medium text-slate-600">{l.label}</span>
                        {l.href && (
                          <code className="ml-auto text-[10px] text-slate-600">{l.href}</code>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <CustomButton variant="cancel" onClick={onClose} type="button">
            Cancel
          </CustomButton>
          <CustomButton
            variant="primary"
            onClick={handleSave}
            loading={isLoading}
            startIcon={<Check className="h-4 w-4" />}
          >
            Save Navigation
          </CustomButton>
        </div>
      </motion.div>
    </div>
  );
}

function RoleAssignmentModal({
  role,
  onClose,
  onChanged,
}: {
  role: IRole;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { data, isLoading, mutate } = useSwr('user?limit=100&status=active');
  const { mutation, isLoading: saving } = useMutation();
  const users = useMemo(
    () =>
      ((data as { data?: { data?: IUserAssignment[] } })?.data?.data ?? []).filter((user) =>
        user.roles.includes(role.baseRole),
      ),
    [data, role.baseRole],
  );

  async function setAssigned(user: IUserAssignment, assigned: boolean) {
    const result = await mutation(`role/${role._id}/users/${user._id}`, {
      method: 'PUT',
      body: { assigned },
      dedupe: false,
    });
    if (!result) {
      toast.error(`Failed to ${assigned ? 'assign' : 'remove'} role`);
      return;
    }
    toast.success(assigned ? 'Role assigned; existing sessions revoked' : 'Role removed');
    await mutate();
    onChanged();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close role assignments"
      />
      <div className="relative z-10 flex max-h-[85dvh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white">
        <div className="flex items-start justify-between bg-primary/5 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Assign {role.displayName}</h2>
            <p className="mt-1 text-xs text-slate-500">
              Only active users with the {fmtModule(role.baseRole)} base scope are eligible.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-6 py-4">
          {isLoading && <p className="py-8 text-center text-sm text-slate-600">Loading users…</p>}
          {!isLoading && users.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-600">
              No eligible active users were found.
            </p>
          )}
          {users.map((user) => {
            const assigned = (user.customRoleIds ?? []).some(
              (assignedRole) => String(assignedRole) === role._id,
            );
            return (
              <label
                key={user._id}
                className="flex cursor-pointer items-center gap-3 rounded-xl bg-slate-50 px-4 py-3"
              >
                <input
                  type="checkbox"
                  checked={assigned}
                  disabled={saving}
                  onChange={(event) => void setAssigned(user, event.target.checked)}
                  className="h-4 w-4 rounded accent-primary"
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-800">
                    {user.name}
                  </span>
                  <span className="block truncate text-xs text-slate-500">{user.email}</span>
                </span>
              </label>
            );
          })}
        </div>
        <div className="flex justify-end px-6 py-4">
          <CustomButton type="button" variant="cancel" onClick={onClose}>
            Done
          </CustomButton>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export const metadata = {
  title: 'Role Management | Institution ERP',
  description: 'Manage ERP roles and fine-grained module permissions',
};

export default function RolesPage() {
  const isSuperAdmin = useHasRole('super_admin');
  const canWrite = useHasAnyRole(['super_admin', 'principal']);

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.append('includeInactive', 'true');
    params.append('page', String(page + 1));
    params.append('limit', String(pageSize));
    return params.toString();
  }, [page, pageSize]);

  const { data: raw, isValidating: isLoading, mutate, pagination } = useSwr(`role?${queryString}`);
  const { data: allRaw } = useSwr('role?includeInactive=true');
  const { mutation, isLoading: processing } = useMutation();

  const roles: IRole[] = useMemo(() => (raw as { data?: IRole[] })?.data ?? [], [raw]);
  const allRoles: IRole[] = useMemo(() => (allRaw as { data?: IRole[] })?.data ?? [], [allRaw]);

  const [showCreate, setShowCreate] = useState(false);
  const [editingRole, setEditingRole] = useState<IRole | null>(null);
  const [viewingRole, setViewingRole] = useState<IRole | null>(null);
  const [permRole, setPermRole] = useState<IRole | null>(null);
  const [navRole, setNavRole] = useState<IRole | null>(null);
  const [assignmentRole, setAssignmentRole] = useState<IRole | null>(null);

  const totalPerms = allRoles.reduce(
    (s, r) => s + r.permissions.reduce((ss, p) => ss + p.actions.length, 0),
    0,
  );
  const totalUsers = allRoles.reduce((s, r) => s + (r.usersCount ?? 0), 0);
  const activeCount = allRoles.filter((r) => r.isActive).length;

  async function handleToggle(r: IRole) {
    if (r.isSystem) {
      toast.error('System roles cannot be deactivated');
      return;
    }
    const conf = await Swal.fire({
      title: `${r.isActive ? 'Deactivate' : 'Activate'} Role?`,
      text: `This will ${r.isActive ? 'deactivate' : 'activate'} "${r.displayName}".`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: `Yes, ${r.isActive ? 'deactivate' : 'activate'}`,
      confirmButtonColor: '#0178D7',
    });
    if (!conf.isConfirmed) return;
    const res = await mutation(`role/${r._id}/toggle`, { method: 'PATCH', body: {} });
    if (res) {
      toast.success(r.isActive ? 'Role deactivated' : 'Role activated');
      mutate();
    } else toast.error('Failed to toggle role');
  }

  async function handleDelete(r: IRole) {
    if (r.isSystem) {
      toast.error('System roles cannot be deleted');
      return;
    }
    const conf = await Swal.fire({
      title: 'Delete Role?',
      text: `"${r.displayName}" will be permanently removed. This cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it',
      confirmButtonColor: '#0178D7',
    });
    if (!conf.isConfirmed) return;
    const res = await mutation(`role/${r._id}`, { method: 'DELETE', body: {} });
    if (res) {
      toast.success('Role deleted');
      mutate();
    } else toast.error('Failed to delete role');
  }

  const columns: Column<IRole>[] = [
    {
      field: 'displayName',
      title: 'Role',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-lg ${row.isActive ? 'bg-primary-50' : 'bg-slate-100'}`}
          >
            <ShieldCheck
              className={`h-4 w-4 ${row.isActive ? 'text-primary' : 'text-slate-600'}`}
            />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">{String(row.displayName)}</p>
            <code className="text-[10px] text-slate-600">{row.name}</code>
          </div>
        </div>
      ),
    },
    {
      field: 'isSystem',
      title: 'Type',
      cellClassName: '!text-center',
      render: (row) => (
        <div className="flex justify-center">
          <span
            className={`rounded-md px-2 py-0.5 text-xs font-medium ${row.isSystem ? 'bg-amber-50 text-amber-600' : 'bg-violet-50 text-violet-600'}`}
          >
            {row.isSystem ? 'System' : 'Custom'}
          </span>
        </div>
      ),
    },
    {
      field: 'permissions',
      title: 'Permissions',
      cellClassName: '!text-center',
      render: (row) => {
        const perms = (row.permissions ?? []) as IPermission[];
        const total = perms.reduce((s, p) => s + p.actions.length, 0);
        return (
          <div className="flex items-center justify-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-slate-600" />
            <span className="text-sm font-semibold text-slate-700">{total}</span>
            <span className="text-xs text-slate-600">/ {perms.length} modules</span>
          </div>
        );
      },
    },
    {
      field: 'usersCount',
      title: 'Users',
      cellClassName: '!text-center',
      render: (row) => (
        <div className="flex items-center justify-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-slate-600" />
          <span className="text-sm text-slate-700">{row.usersCount ?? 0}</span>
        </div>
      ),
    },
    {
      field: 'isActive',
      title: 'Status',
      cellClassName: '!text-center',
      render: (row) => (
        <div className="flex justify-center">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${row.isActive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-400'}`}
          >
            {row.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      ),
    },
    {
      field: 'createdAt',
      title: 'Created',
      cellClassName: '!text-center',
      render: (row) => (
        <div className="flex justify-center">
          <span className="text-xs text-slate-600">{fmtDate(String(row.createdAt))}</span>
        </div>
      ),
    },
  ];

  const actions: Action<IRole>[] = [
    {
      tooltip: 'View Details',
      icon: <Lock className="h-3.5 w-3.5 text-violet-600" />,
      onClick: (r) => setViewingRole(r),
    },
    ...(canWrite
      ? [
          {
            tooltip: 'Edit Permissions',
            icon: <Settings className="h-3.5 w-3.5 text-primary" />,
            onClick: (r: IRole) => setPermRole(r),
          },
          ...(isSuperAdmin
            ? [
                {
                  tooltip: 'Assign Users',
                  icon: <Users className="h-3.5 w-3.5 text-primary" />,
                  onClick: (r: IRole) => {
                    if (r.isSystem) {
                      toast.error('Assign system roles from User Management');
                      return;
                    }
                    setAssignmentRole(r);
                  },
                },
              ]
            : []),
          {
            tooltip: 'Navigation Access',
            icon: <Menu className="h-3.5 w-3.5 text-slate-500" />,
            onClick: (r: IRole) => setNavRole(r),
          },
          {
            tooltip: 'Edit Info',
            icon: <Edit2 className="h-3.5 w-3.5 text-primary" />,
            onClick: (r: IRole) => {
              if (r.isSystem) {
                toast.error('System roles cannot be renamed');
                return;
              }
              setEditingRole(r);
            },
          },
        ]
      : []),
    ...(isSuperAdmin
      ? [
          {
            tooltip: 'Toggle Active',
            icon: <Power className="h-3.5 w-3.5 text-orange-600" />,
            onClick: handleToggle,
          },
          {
            tooltip: 'Delete',
            icon: <Trash2 className="h-3.5 w-3.5 text-red-500" />,
            onClick: handleDelete,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          {
            label: 'Total Roles',
            value: roles.length,
            icon: <ShieldCheck className="h-5 w-5" />,
            bg: 'bg-primary-50',
            fg: 'text-primary',
          },
          {
            label: 'Active Roles',
            value: activeCount,
            icon: <Check className="h-5 w-5" />,
            bg: 'bg-secondary-50',
            fg: 'text-secondary',
          },
          {
            label: 'Total Perms',
            value: totalPerms,
            icon: <Lock className="h-5 w-5" />,
            bg: 'bg-violet-50',
            fg: 'text-violet-600',
          },
          {
            label: 'Assigned Users',
            value: totalUsers,
            icon: <Users className="h-5 w-5" />,
            bg: 'bg-amber-50',
            fg: 'text-amber-600',
          },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.06 }}
            className="flex items-center gap-3 rounded-2xl bg-white p-4"
          >
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${s.bg}`}>
              <span className={s.fg}>{s.icon}</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{isLoading ? '—' : s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* List */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
      >
        <DataViewSwitcher<IRole>
          data={roles}
          isLoading={isLoading}
          storageKey="roles.view"
          searchPlaceholder="Search roles…"
          searchFields={['displayName', 'name']}
          renderCard={(r) => (
            <motion.div
              whileHover={{ y: -2 }}
              className="flex flex-col gap-3 rounded-2xl bg-white p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary">
                  {r.isSystem ? <Lock className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${r.isActive ? 'bg-secondary-50 text-secondary' : 'bg-slate-100 text-slate-500'}`}
                  >
                    {r.isActive ? 'Active' : 'Inactive'}
                  </span>
                  {r.isSystem && (
                    <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-600">
                      System
                    </span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{r.displayName}</p>
                <p className="font-mono text-[11px] text-slate-600">{r.name}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                  <p className="text-[10px] uppercase text-slate-600">Permissions</p>
                  <p className="font-bold text-slate-800">{r.permissions?.length ?? 0}</p>
                </div>
                <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                  <p className="text-[10px] uppercase text-slate-600">Users</p>
                  <p className="font-bold text-slate-800">{r.usersCount ?? 0}</p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3 text-xs">
                <button
                  type="button"
                  onClick={() => setViewingRole(r)}
                  className="inline-flex items-center gap-1 font-medium text-slate-500 hover:text-primary"
                >
                  <Lock className="h-3 w-3" /> View
                </button>
                {canWrite && (
                  <button
                    type="button"
                    onClick={() => setPermRole(r)}
                    className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    <Settings className="h-3 w-3" /> Perms
                  </button>
                )}
                {canWrite && !r.isSystem && (
                  <button
                    type="button"
                    onClick={() => setEditingRole(r)}
                    className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    <Edit2 className="h-3 w-3" /> Edit
                  </button>
                )}
              </div>
            </motion.div>
          )}
          table={
            <CustomTable<IRole>
              title="Role Management"
              description="Manage ERP roles and fine-grained module permissions"
              onRefresh={() => mutate()}
              isRefreshing={isLoading}
              columns={columns}
              data={roles}
              isLoading={isLoading}
              actions={actions}
              page={page}
              pageSize={pageSize}
              totalCount={(pagination as { total?: number } | undefined)?.total ?? roles.length}
              onPageChange={setPage}
              onRowsPerPageChange={setPageSize}
              customActions={
                isSuperAdmin ? (
                  <CustomButton
                    variant="primary"
                    startIcon={<Plus className="h-4 w-4" />}
                    onClick={() => setShowCreate(true)}
                  >
                    Create Role
                  </CustomButton>
                ) : undefined
              }
              options={{
                search: false,
                pagination: true,
                pageSize: pageSize,
                actionsType: 'dropdown',
                export: false,
              }}
            />
          }
        />
      </motion.div>

      {/* Modals / Drawers */}
      <AnimatePresence>
        {assignmentRole && (
          <RoleAssignmentModal
            key="assign"
            role={assignmentRole}
            onClose={() => setAssignmentRole(null)}
            onChanged={() => void mutate()}
          />
        )}
        {showCreate && (
          <RoleFormModal
            key="create"
            onClose={() => setShowCreate(false)}
            onSuccess={() => mutate()}
          />
        )}
        {editingRole && (
          <RoleFormModal
            key="edit"
            role={editingRole}
            onClose={() => setEditingRole(null)}
            onSuccess={() => mutate()}
          />
        )}
        {viewingRole && (
          <RoleDetailDrawer
            key="view"
            role={viewingRole}
            onClose={() => setViewingRole(null)}
            onEditPermissions={() => {
              setPermRole(viewingRole);
              setViewingRole(null);
            }}
          />
        )}
        {permRole && (
          <PermissionDrawer
            key="perm"
            role={permRole}
            onClose={() => setPermRole(null)}
            onSuccess={() => mutate()}
          />
        )}
        {navRole && (
          <NavItemsDrawer
            key="nav"
            role={navRole}
            onClose={() => setNavRole(null)}
            onSuccess={() => mutate()}
          />
        )}
      </AnimatePresence>

      {/* Suppress unused processing variable lint warning */}
      {processing && null}
    </div>
  );
}
