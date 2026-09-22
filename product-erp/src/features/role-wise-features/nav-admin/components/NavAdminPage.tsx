/**
 * @file NavAdminPage.tsx
 * @description Admin console for the database-driven sidebar navigation.
 *   Lets Super Admin / Principal / Dean (Academic) manage navigation groups
 *   and links — labels, icons, hrefs, required roles, gates, ordering, and
 *   active state — without a code deploy.
 *
 *   Backend: `GET/POST/PUT/DELETE /nav` + `POST /nav/reorder`
 *   (controllers/nav.controller.ts).
 * @module features/role-wise-features/nav-admin
 */
'use client';

import { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  FolderTree,
  GripVertical,
  Link2,
  MousePointer2,
  PanelLeft,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from '@/shared/utils/motion';
import CustomButton from '@/shared/core/CustomButton';
import UseProtectedRoutes from '@/shared/hooks/UseProtectedRoutes';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import useNav from '@/shared/hooks/useNav';
import { useHasPermission } from '@/shared/hooks/useHasPermission';

interface INavItem {
  _id: string;
  kind: 'group' | 'link';
  label: string;
  href?: string;
  icon?: string;
  parentId?: string | null;
  requiredRoles: string[];
  gate?: 'chat';
  sortOrder: number;
  isActive: boolean;
}

interface IRoleOption {
  name: string;
  displayName: string;
  isActive: boolean;
}

interface IDragState {
  type: 'group' | 'link';
  id: string;
  parentId?: string;
}

const ICON_OPTIONS = [
  'LayoutDashboard',
  'Users',
  'Building2',
  'GraduationCap',
  'BookOpen',
  'CalendarDays',
  'ClipboardList',
  'FileText',
  'Settings',
  'ShieldCheck',
  'BellRing',
  'MessageCircle',
  'CreditCard',
  'Landmark',
  'Library',
  'Bus',
  'Home',
  'Package',
  'ShoppingCart',
];

const inputCls =
  'w-full rounded-lg bg-slate-50 px-3 py-2 text-sm placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20';
const labelCls = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600';

interface IFormState {
  kind: 'group' | 'link';
  label: string;
  href: string;
  icon: string;
  requiredRoles: string[];
  gate: '' | 'chat';
  sortOrder: number;
  isActive: boolean;
  parentId: string | null;
}

const EMPTY_FORM: IFormState = {
  kind: 'group',
  label: '',
  href: '',
  icon: '',
  requiredRoles: [],
  gate: '',
  sortOrder: 0,
  isActive: true,
  parentId: null,
};

function toggleInArray<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

function NavAdminPage() {
  const canCreate = useHasPermission('role_management', 'create');
  const canEdit = useHasPermission('role_management', 'edit');
  const canDelete = useHasPermission('role_management', 'delete');
  const canManage = canCreate || canEdit || canDelete;
  const {
    data: listRaw,
    isLoading,
    mutate: refetchList,
  } = useSwr<{ success: boolean; data: INavItem[] }>('nav');
  const { mutate: refetchUserNav } = useNav();
  const { mutation, isLoading: saving } = useMutation();
  const { data: rolesRaw } = useSwr<{ data?: IRoleOption[] }>('role?includeInactive=true');
  const roles = useMemo(
    () =>
      (rolesRaw?.data ?? [])
        .filter((role) => role.isActive)
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [rolesRaw],
  );
  const roleLabels = useMemo(
    () => new Map(roles.map((role) => [role.name, role.displayName])),
    [roles],
  );

  const items: INavItem[] = useMemo(() => listRaw?.data ?? [], [listRaw]);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'manage' | 'preview'>('manage');
  const [dragging, setDragging] = useState<IDragState | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());

  const toggleGroupCollapsed = (groupId: string) => {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const grouped = useMemo(() => {
    const groups = items
      .filter((i) => i.kind === 'group')
      .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
    const linksByParent = new Map<string, INavItem[]>();
    for (const it of items) {
      if (it.kind !== 'link' || !it.parentId) continue;
      const arr = linksByParent.get(it.parentId) ?? [];
      arr.push(it);
      linksByParent.set(it.parentId, arr);
    }
    for (const arr of linksByParent.values()) {
      arr.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
    }
    return groups.map((g) => ({ group: g, links: linksByParent.get(g._id) ?? [] }));
  }, [items]);
  const visibleGrouped = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return grouped;
    return grouped
      .map((entry) => ({
        ...entry,
        links: entry.links.filter((link) =>
          [link.label, link.href, ...link.requiredRoles]
            .filter(Boolean)
            .some((value) => value?.toLowerCase().includes(normalized)),
        ),
      }))
      .filter(
        (entry) => entry.group.label.toLowerCase().includes(normalized) || entry.links.length > 0,
      );
  }, [grouped, query]);

  // ── Form / modal ────────────────────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<IFormState>(EMPTY_FORM);

  const openCreateGroup = () => {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      kind: 'group',
      sortOrder: (grouped[grouped.length - 1]?.group.sortOrder ?? 0) + 10,
    });
    setFormOpen(true);
  };

  const openCreateLink = (groupId: string) => {
    const groupLinks = grouped.find((g) => g.group._id === groupId)?.links ?? [];
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      kind: 'link',
      parentId: groupId,
      sortOrder: (groupLinks[groupLinks.length - 1]?.sortOrder ?? 0) + 10,
    });
    setFormOpen(true);
  };

  const openEdit = (item: INavItem) => {
    setEditingId(item._id);
    setForm({
      kind: item.kind,
      label: item.label,
      href: item.href ?? '',
      icon: item.icon ?? '',
      requiredRoles: [...item.requiredRoles],
      gate: item.gate ?? '',
      sortOrder: item.sortOrder,
      isActive: item.isActive,
      parentId: item.parentId ?? null,
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const refreshAll = async () => {
    await Promise.all([refetchList(), refetchUserNav()]);
  };

  const handleSubmit = async () => {
    if (!form.label.trim()) {
      toast.error('Label is required');
      return;
    }
    if (form.kind === 'link' && !form.href.trim()) {
      toast.error('Href is required for links');
      return;
    }
    if (form.kind === 'link' && form.href.trim() && !form.href.trim().startsWith('/')) {
      toast.error('Page path must start with /, for example /student-management');
      return;
    }
    if (form.kind === 'link' && !form.parentId) {
      toast.error('Choose the menu group where this page should appear');
      return;
    }
    const duplicate = items.find(
      (item) =>
        item._id !== editingId &&
        ((form.kind === 'link' &&
          item.kind === 'link' &&
          item.href?.toLowerCase() === form.href.trim().toLowerCase()) ||
          (item.kind === form.kind &&
            item.parentId === form.parentId &&
            item.label.toLowerCase() === form.label.trim().toLowerCase())),
    );
    if (duplicate) {
      toast.error(
        form.kind === 'link'
          ? 'This page is already present in the navigation.'
          : 'A group with this name already exists.',
      );
      return;
    }

    const body: Partial<INavItem> = {
      kind: form.kind,
      label: form.label.trim(),
      requiredRoles: form.requiredRoles,
      sortOrder: Number(form.sortOrder) || 0,
      isActive: form.isActive,
      parentId: form.kind === 'link' ? form.parentId : null,
    };
    if (form.kind === 'link') {
      body.href = form.href.trim();
      body.icon = form.icon.trim() || undefined;
      body.gate = form.gate || undefined;
    }

    const path = editingId ? `nav/${editingId}` : 'nav';
    const method = editingId ? 'PUT' : 'POST';
    const result = await mutation(path, { method, body });
    if (result?.results?.success) {
      toast.success(
        editingId
          ? `${form.label.trim()} updated in the sidebar`
          : `${form.label.trim()} added to the sidebar`,
      );
      closeForm();
      await refreshAll();
    }
  };

  const handleDelete = async (item: INavItem) => {
    const isGroup = item.kind === 'group';
    const linkCount = isGroup
      ? (grouped.find((g) => g.group._id === item._id)?.links.length ?? 0)
      : 0;
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: isGroup
        ? `This will delete the "${item.label}" group${linkCount ? ` and its ${linkCount} link${linkCount === 1 ? '' : 's'}` : ''}. This action cannot be undone.`
        : `Delete the "${item.label}" link? This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it',
      confirmButtonColor: '#0178D7',
    });
    if (!result.isConfirmed) return;
    const res = await mutation(`nav/${item._id}`, { method: 'DELETE' });
    if (res?.results?.success) {
      toast.success('Deleted');
      await refreshAll();
    }
  };

  const handleToggleActive = async (item: INavItem) => {
    const res = await mutation(`nav/${item._id}`, {
      method: 'PUT',
      body: { isActive: !item.isActive },
    });
    if (res?.results?.success) await refreshAll();
  };

  // ── Reorder via swap of sortOrder with neighbour ─────────────────────────
  const swapOrder = async (a: INavItem, b: INavItem) => {
    const aOrder = a.sortOrder;
    const bOrder = b.sortOrder === aOrder ? aOrder + 1 : b.sortOrder;
    const res = await mutation('nav/reorder', {
      method: 'POST',
      body: {
        items: [
          { id: a._id, sortOrder: bOrder },
          { id: b._id, sortOrder: aOrder },
        ],
      },
    });
    if (res?.results?.success) await refreshAll();
  };

  const moveGroup = (index: number, dir: -1 | 1) => {
    const target = grouped[index + dir];
    if (!target) return;
    void swapOrder(grouped[index].group, target.group);
  };

  const moveLink = (groupId: string, index: number, dir: -1 | 1) => {
    const groupLinks = grouped.find((g) => g.group._id === groupId)?.links ?? [];
    const a = groupLinks[index];
    const b = groupLinks[index + dir];
    if (!a || !b) return;
    void swapOrder(a, b);
  };

  const reorderSequence = async (sequence: INavItem[], sourceId: string, targetId: string) => {
    const sourceIndex = sequence.findIndex((item) => item._id === sourceId);
    const targetIndex = sequence.findIndex((item) => item._id === targetId);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;

    const reordered = [...sequence];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    const response = await mutation('nav/reorder', {
      method: 'POST',
      body: {
        items: reordered.map((item, index) => ({
          id: item._id,
          sortOrder: (index + 1) * 10,
        })),
      },
    });
    if (response?.results?.success) {
      toast.success(`Moved ${moved.label}`);
      await refreshAll();
    }
  };

  const finishDrag = () => {
    setDragging(null);
    setDropTargetId(null);
  };

  const dropGroup = async (targetId: string) => {
    if (dragging?.type !== 'group' || query.trim()) return finishDrag();
    await reorderSequence(
      grouped.map((entry) => entry.group),
      dragging.id,
      targetId,
    );
    finishDrag();
  };

  const dropLink = async (groupId: string, targetId: string) => {
    if (dragging?.type !== 'link' || dragging.parentId !== groupId || query.trim()) {
      return finishDrag();
    }
    const links = grouped.find((entry) => entry.group._id === groupId)?.links ?? [];
    await reorderSequence(links, dragging.id, targetId);
    finishDrag();
  };

  // ── Render ───────────────────────────────────────────────────────────────
  const totalLinks = items.filter((i) => i.kind === 'link').length;
  const activeLinks = items.filter((i) => i.kind === 'link' && i.isActive).length;

  return (
    <div className="flex flex-col gap-5 ">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="overflow-hidden rounded-3xl border border-blue-100 bg-linear-to-br from-blue-50 via-white to-violet-50 p-5 sm:p-6"
      >
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
              <FolderTree className="h-3.5 w-3.5" /> Sidebar architecture
            </span>
            <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              Build navigation people can understand.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Arrange menu groups, place pages in a meaningful order and control visibility by role.
              Drag items to reposition them the live sidebar updates after every saved change.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void refreshAll()}
              disabled={saving || isLoading}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${saving || isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {canCreate && (
              <CustomButton
                variant="primary"
                startIcon={<Plus className="h-4 w-4" />}
                onClick={openCreateGroup}
                className="w-fit!"
              >
                Create group
              </CustomButton>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {[
            {
              icon: PanelLeft,
              title: '1. Create structure',
              text: 'Use groups to organize related ERP pages.',
            },
            {
              icon: MousePointer2,
              title: '2. Drag to arrange',
              text: 'Use the grip handle or arrow controls to reorder.',
            },
            {
              icon: CheckCircle2,
              title: '3. Verify visibility',
              text: 'Preview the result and confirm each role assignment.',
            },
          ].map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 + index * 0.06 }}
                className="flex gap-3 rounded-2xl border border-white bg-white/75 p-3.5"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">{step.title}</p>
                  <p className="mt-1 text-[11px] leading-4 text-slate-500">{step.text}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.section>

      <div className="flex flex-col gap-3 rounded-2xl bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={`${inputCls} pl-9`}
            placeholder="Search menu names, pages or roles"
            aria-label="Search navigation"
          />
        </div>
        <div className="flex rounded-xl bg-slate-100 p-1">
          {[
            ...(canManage ? [{ id: 'manage' as const, label: 'Manage', icon: Settings2 }] : []),
            { id: 'preview' as const, label: 'Sidebar preview', icon: Eye },
          ].map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setView(option.id)}
                className={`flex flex-1 items-center text-nowrap justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition ${
                  view === option.id ? 'bg-white text-primary' : 'text-slate-500'
                }`}
              >
                <Icon className="h-4 w-4" />
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {view === 'manage' && canEdit ? (
          <div
            className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2 text-xs ${
              query.trim() ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
            }`}
          >
            <GripVertical className="h-4 w-4 shrink-0" />
            {query.trim()
              ? 'Clear the search to reorder safely; filtered results can hide the true sidebar position.'
              : 'Drag a group by its grip, or drag a page within its current group. Changes save automatically.'}
          </div>
        ) : (
          <p className="min-w-0 flex-1 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Preview mode shows the configured structure without editing controls.
          </p>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCollapsedGroups(new Set(grouped.map((entry) => entry.group._id)))}
            className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:text-primary"
          >
            Collapse all
          </button>
          <button
            type="button"
            onClick={() => setCollapsedGroups(new Set())}
            className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:text-primary"
          >
            Expand all
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Menu groups',
            value: grouped.length,
            hint: 'Top-level sidebar sections',
            icon: FolderTree,
            tone: 'bg-blue-50 text-primary',
          },
          {
            label: 'Configured pages',
            value: totalLinks,
            hint: 'Pages organized across groups',
            icon: Link2,
            tone: 'bg-violet-50 text-violet-600',
          },
          {
            label: 'Visible pages',
            value: activeLinks,
            hint: totalLinks
              ? `${Math.round((activeLinks / totalLinks) * 100)}% of configured pages`
              : 'No pages configured yet',
            icon: CheckCircle2,
            tone: 'bg-emerald-50 text-emerald-600',
          },
          {
            label: 'Hidden pages',
            value: totalLinks - activeLinks,
            hint: 'Excluded from the live sidebar',
            icon: EyeOff,
            tone: 'bg-amber-50 text-amber-600',
          },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -3, borderColor: '#bfdbfe' }}
            transition={{ delay: i * 0.05 }}
            className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4"
          >
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${s.tone}`}
            >
              <s.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-black leading-none text-slate-900">
                {isLoading ? '—' : s.value}
              </p>
              <p className="mt-1.5 text-xs font-bold text-slate-700">{s.label}</p>
              <p className="mt-0.5 truncate text-[11px] text-slate-500">{s.hint}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Groups */}
      <div className="flex flex-col gap-4">
        {isLoading && (
          <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">
            Loading navigation…
          </div>
        )}
        {!isLoading && !visibleGrouped.length && (
          <div className="rounded-2xl bg-white p-8 text-center">
            <p className="text-sm font-medium text-slate-700">
              {query ? 'No navigation matches your search.' : 'No navigation groups yet.'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {query
                ? 'Try a different page, group or role name.'
                : 'Create the first group, then add pages inside it.'}
            </p>
          </div>
        )}
        {visibleGrouped.map(({ group, links }, gIdx) => (
          <motion.div
            key={group._id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: dragging?.id === group._id ? 0.55 : 1, y: 0 }}
            transition={{ delay: gIdx * 0.03 }}
            onDragOver={(event) => {
              if (dragging?.type !== 'group' || query.trim()) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              setDropTargetId(group._id);
            }}
            onDrop={(event) => {
              event.preventDefault();
              void dropGroup(group._id);
            }}
            className={`rounded-2xl border bg-white p-4 transition-colors ${
              dropTargetId === group._id && dragging?.type === 'group'
                ? 'border-primary bg-blue-50/40'
                : 'border-slate-200'
            }`}
          >
            {/* Group header */}
            <div
              className={`flex flex-wrap items-start justify-between gap-3 transition-[padding,border-color] duration-200 ${
                collapsedGroups.has(group._id) ? '' : 'border-b border-slate-100 pb-3'
              }`}
            >
              <div className="flex min-w-0 flex-1 items-start gap-2">
                <button
                  type="button"
                  onClick={() => toggleGroupCollapsed(group._id)}
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition hover:bg-primary-50 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  aria-expanded={!collapsedGroups.has(group._id)}
                  aria-controls={`nav-group-${group._id}`}
                  title={collapsedGroups.has(group._id) ? 'Expand group' : 'Collapse group'}
                >
                  {collapsedGroups.has(group._id) ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
                {view === 'manage' && canEdit && (
                  <button
                    type="button"
                    draggable={!saving && !query.trim()}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', group._id);
                      setDragging({ type: 'group', id: group._id });
                    }}
                    onDragEnd={finishDrag}
                    disabled={saving || Boolean(query.trim())}
                    className="mt-0.5 flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition hover:bg-primary-50 hover:text-primary active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
                    title="Drag to move this group"
                    aria-label={`Drag ${group.label} group to reorder`}
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <p
                      className={`text-base font-semibold ${
                        group.isActive ? 'text-slate-900' : 'text-slate-600 line-through'
                      }`}
                    >
                      {group.label}
                    </p>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                      Group {gIdx + 1}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {group.requiredRoles.length === 0 ? (
                      <span className="text-[11px] text-slate-600">visible to everyone</span>
                    ) : (
                      group.requiredRoles.map((r) => (
                        <span
                          key={r}
                          className="rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-medium text-primary"
                        >
                          {roleLabels.get(r) || r.replaceAll('_', ' ')}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
              {view === 'manage' && canManage && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {canEdit && (
                    <>
                      <IconBtn
                        title="Move up"
                        disabled={gIdx === 0 || saving || Boolean(query.trim())}
                        onClick={() => moveGroup(gIdx, -1)}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </IconBtn>
                      <IconBtn
                        title="Move down"
                        disabled={gIdx === grouped.length - 1 || saving || Boolean(query.trim())}
                        onClick={() => moveGroup(gIdx, 1)}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </IconBtn>
                      <ToggleSwitch
                        active={group.isActive}
                        onClick={() => handleToggleActive(group)}
                        disabled={saving}
                      />
                      <IconBtn title="Edit group" onClick={() => openEdit(group)} disabled={saving}>
                        <Pencil className="h-3.5 w-3.5" />
                      </IconBtn>
                    </>
                  )}
                  {canDelete && (
                    <IconBtn
                      title="Delete group"
                      onClick={() => handleDelete(group)}
                      disabled={saving}
                      danger
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconBtn>
                  )}
                  {canCreate && (
                    <CustomButton
                      variant="secondary"
                      startIcon={<Plus className="h-3.5 w-3.5" />}
                      onClick={() => openCreateLink(group._id)}
                      className="w-fit! py-1.5! text-xs!"
                    >
                      Add Link
                    </CustomButton>
                  )}
                </div>
              )}
            </div>

            {/* Links */}
            <AnimatePresence initial={false}>
              {!collapsedGroups.has(group._id) && (
                <motion.div
                  id={`nav-group-${group._id}`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: 'easeInOut' }}
                  className="mt-3 flex flex-col gap-2 overflow-hidden"
                >
                  {!links.length && (
                    <p className="px-2 py-3 text-xs text-slate-600">No links in this group.</p>
                  )}
                  {links.map((link, lIdx) => (
                    <div
                      key={link._id}
                      onDragOver={(event) => {
                        if (
                          dragging?.type !== 'link' ||
                          dragging.parentId !== group._id ||
                          query.trim()
                        )
                          return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'move';
                        setDropTargetId(link._id);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        void dropLink(group._id, link._id);
                      }}
                      className={`flex flex-wrap items-start justify-between gap-3 rounded-xl border p-3 transition ${
                        dropTargetId === link._id && dragging?.type === 'link'
                          ? 'border-primary bg-blue-50'
                          : 'border-transparent bg-slate-50'
                      } ${dragging?.id === link._id ? 'opacity-50' : ''}`}
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-2">
                        {view === 'manage' && canEdit && (
                          <button
                            type="button"
                            draggable={!saving && !query.trim()}
                            onDragStart={(event) => {
                              event.dataTransfer.effectAllowed = 'move';
                              event.dataTransfer.setData('text/plain', link._id);
                              setDragging({ type: 'link', id: link._id, parentId: group._id });
                            }}
                            onDragEnd={finishDrag}
                            disabled={saving || Boolean(query.trim())}
                            className="flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg bg-white text-slate-500 transition hover:text-primary active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
                            title="Drag to reorder this page"
                            aria-label={`Drag ${link.label} to reorder within ${group.label}`}
                          >
                            <GripVertical className="h-4 w-4" />
                          </button>
                        )}
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`text-sm font-medium ${
                                link.isActive ? 'text-slate-800' : 'text-slate-600 line-through'
                              }`}
                            >
                              {link.label}
                            </span>
                            <code className="rounded bg-white px-1.5 py-0.5 text-[11px] text-slate-600">
                              {link.href}
                            </code>
                            {link.icon && (
                              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-slate-500">
                                icon: {link.icon}
                              </span>
                            )}
                            {link.gate && (
                              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                                gate: {link.gate}
                              </span>
                            )}
                            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-slate-500">
                              Position {lIdx + 1}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {link.requiredRoles.length === 0 ? (
                              <span className="text-[11px] text-slate-600">
                                visible to everyone
                              </span>
                            ) : (
                              link.requiredRoles.map((r) => (
                                <span
                                  key={r}
                                  className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600"
                                >
                                  {roleLabels.get(r) || r.replaceAll('_', ' ')}
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                      {view === 'manage' && canManage && (
                        <div className="flex items-center gap-1.5">
                          {canEdit && (
                            <>
                              <IconBtn
                                title="Move up"
                                disabled={lIdx === 0 || saving || Boolean(query.trim())}
                                onClick={() => moveLink(group._id, lIdx, -1)}
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </IconBtn>
                              <IconBtn
                                title="Move down"
                                disabled={
                                  lIdx === links.length - 1 || saving || Boolean(query.trim())
                                }
                                onClick={() => moveLink(group._id, lIdx, 1)}
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </IconBtn>
                              <ToggleSwitch
                                active={link.isActive}
                                onClick={() => handleToggleActive(link)}
                                disabled={saving}
                              />
                              <IconBtn
                                title="Edit link"
                                onClick={() => openEdit(link)}
                                disabled={saving}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </IconBtn>
                            </>
                          )}
                          {canDelete && (
                            <IconBtn
                              title="Delete link"
                              onClick={() => handleDelete(link)}
                              disabled={saving}
                              danger
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </IconBtn>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {/* Modal */}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-200/80 p-2 md:items-center md:p-6"
          onClick={closeForm}
        >
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-lg overflow-hidden rounded-2xl bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between bg-slate-50 px-5 py-3">
              <p className="text-sm font-semibold text-slate-800">
                {editingId ? 'Edit' : 'Create'} {form.kind === 'group' ? 'Group' : 'Link'}
              </p>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-md p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex max-h-[70dvh] flex-col gap-4 overflow-y-auto p-5">
              <div>
                <label className={labelCls}>Label *</label>
                <input
                  className={inputCls}
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="e.g. Admin Tools"
                />
              </div>

              {form.kind === 'link' && (
                <>
                  <div>
                    <label className={labelCls}>Menu group *</label>
                    <select
                      className={inputCls}
                      value={form.parentId ?? ''}
                      onChange={(event) =>
                        setForm({ ...form, parentId: event.target.value || null })
                      }
                    >
                      <option value="">Choose where this page appears</option>
                      {grouped.map(({ group }) => (
                        <option key={group._id} value={group._id}>
                          {group.label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-[11px] text-slate-600">
                      Users see this group heading above the page link.
                    </p>
                  </div>
                  <div>
                    <label className={labelCls}>Page path *</label>
                    <input
                      className={inputCls}
                      value={form.href}
                      onChange={(e) => setForm({ ...form, href: e.target.value })}
                      placeholder="/student-management"
                    />
                    <p className="mt-1 text-[11px] text-slate-600">
                      The ERP page address after the role name, beginning with <code>/</code>.
                    </p>
                  </div>
                  <div>
                    <label className={labelCls}>Menu icon</label>
                    <select
                      className={inputCls}
                      value={form.icon}
                      onChange={(e) => setForm({ ...form, icon: e.target.value })}
                    >
                      <option value="">Use the default page icon</option>
                      {ICON_OPTIONS.map((icon) => (
                        <option key={icon} value={icon}>
                          {icon.replace(/([a-z])([A-Z])/g, '$1 $2')}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-[11px] text-slate-600">
                      Choose a familiar visual cue; no icon code is required.
                    </p>
                  </div>
                  <div>
                    <label className={labelCls}>Gate</label>
                    <select
                      className={inputCls}
                      value={form.gate}
                      onChange={(e) => setForm({ ...form, gate: e.target.value as '' | 'chat' })}
                    >
                      <option value="">No gate</option>
                      <option value="chat">Chat (check chat access policy)</option>
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className={labelCls}>Who can see this menu?</label>
                <p className="mb-2 text-[11px] text-slate-500">
                  Select one or more active roles. Leave empty only for a page intended for every
                  signed-in user.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {roles.map((role) => {
                    const active = form.requiredRoles.includes(role.name);
                    return (
                      <button
                        type="button"
                        key={role.name}
                        onClick={() =>
                          setForm({
                            ...form,
                            requiredRoles: toggleInArray(form.requiredRoles, role.name),
                          })
                        }
                        className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                          active
                            ? 'bg-primary text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {role.displayName}
                      </button>
                    );
                  })}
                  {roles.length === 0 && (
                    <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      Active roles could not be loaded. Refresh before changing visibility.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className={labelCls}>Status</label>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, isActive: !form.isActive })}
                  className={`flex h-9.5 w-full items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors ${
                    form.isActive ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      form.isActive ? 'bg-green-500' : 'bg-slate-400'
                    }`}
                  />
                  {form.isActive ? 'Active' : 'Hidden'}
                </button>
                <p className="mt-1 text-[11px] text-slate-600">
                  After saving, use the drag handle or arrow controls to change its sidebar
                  position.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 bg-slate-50 px-5 py-3">
              <CustomButton variant="secondary" onClick={closeForm} className="w-fit!">
                Cancel
              </CustomButton>
              <CustomButton
                variant="primary"
                loading={saving}
                onClick={handleSubmit}
                className="w-fit!"
              >
                {editingId ? 'Save Changes' : 'Create'}
              </CustomButton>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

interface IIconBtnProps {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}

function IconBtn({ title, onClick, disabled, danger, children }: IIconBtnProps) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        danger
          ? 'bg-red-50 text-red-600 hover:bg-red-100'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {children}
    </button>
  );
}

interface IToggleProps {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}

function ToggleSwitch({ active, onClick, disabled }: IToggleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={active ? 'Active — click to hide' : 'Hidden — click to show'}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? 'bg-primary' : 'bg-slate-300'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
          active ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export default UseProtectedRoutes(NavAdminPage);
