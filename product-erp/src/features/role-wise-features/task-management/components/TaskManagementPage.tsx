'use client';

import CustomButton from '@/shared/core/CustomButton';
import FileViewer, { IViewerFile } from '@/shared/core/FileViewer';
import InlineFileUpload from '@/shared/core/InlineFileUpload';
import Empty from '@/shared/core/Empty';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { useAuthStore } from '@/shared/store/authStore';
import { AnimatePresence, motion } from '@/shared/utils/motion';
import { useFormik } from 'formik';
import {
  Calendar,
  Check,
  CheckCircle2,
  CheckSquare,
  Eye,
  Paperclip,
  Plus,
  RotateCw,
  Search,
  AlertTriangle,
  MessageCircle,
  Send,
  User,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import * as Yup from 'yup';

interface IAttachment {
  url: string;
  publicId: string;
  name: string;
}

interface IUserRef {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  roles?: string[];
  department?: string | { _id: string; name: string };
}

interface ITask {
  _id: string;
  title: string;
  description: string;
  assigner: IUserRef;
  assignees: IUserRef[];
  status: 'todo' | 'in_progress' | 'completed' | 'approved';
  priority: 'low' | 'medium' | 'high' | 'critical';
  dependencyIds?: Array<string | Pick<ITask, '_id' | 'title' | 'status'>>;
  sourceModule?: string;
  sourceRecordId?: string;
  recurrence?: { frequency: 'daily' | 'weekly' | 'monthly'; interval: number; endsAt?: string };
  escalatedAt?: string;
  completionNote?: string;
  completionEvidence?: IAttachment[];
  completedAt?: string;
  comments?: Array<{
    author: string;
    authorName: string;
    message: string;
    createdAt: string;
  }>;
  dueDate: string;
  notes?: string;
  feedback?: string;
  attachments?: IAttachment[];
  createdAt: string;
  updatedAt: string;
}

const inputCls =
  'w-full rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-sm placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all';
const labelCls = 'mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500';

// Format Date nicely
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Countdown Calculation Helper
function getCountdown(dueDateStr: string) {
  const due = new Date(dueDateStr).getTime();
  const now = Date.now();
  const diff = due - now;

  if (diff < 0) {
    const absDiff = Math.abs(diff);
    const hrs = Math.floor(absDiff / 3600000);
    if (hrs < 24) return { text: `Overdue by ${hrs}h`, status: 'overdue' };
    const days = Math.floor(hrs / 24);
    return { text: `Overdue by ${days}d`, status: 'overdue' };
  }

  const hrs = Math.floor(diff / 3600000);
  if (hrs < 1) {
    const mins = Math.floor(diff / 60000);
    return { text: `${mins}m left`, status: 'critical' };
  }
  if (hrs < 24) {
    return { text: `${hrs}h left`, status: 'urgent' };
  }
  const days = Math.floor(hrs / 24);
  return { text: `${days}d left`, status: 'normal' };
}

export default function TaskManagementPage() {
  const { user, role, activeRole } = useAuthStore();
  const activeRoleName = activeRole?.baseRole ?? activeRole?.name ?? role ?? '';
  const isAssigner = ['super_admin', 'admin', 'principal', 'hod'].includes(activeRoleName);
  const [renderedAt] = useState(() => Date.now());
  const [peopleSearch, setPeopleSearch] = useState('');
  const [workspaceSearch, setWorkspaceSearch] = useState('');
  const {
    data: tasks,
    error: taskError,
    isLoading: taskLoading,
    mutate,
  } = useSwr<ITask[] | { success: boolean; data: ITask[] }>('task');
  const taskList = useMemo<ITask[]>(() => {
    if (!tasks) return [];
    if (Array.isArray(tasks)) return tasks;
    return tasks.data || [];
  }, [tasks]);
  const { data: usersResponse, error: peopleError } = useSwr<{ data: { data: IUserRef[] } }>(
    isAssigner ? `user?search=${encodeURIComponent(peopleSearch)}&limit=25` : null,
  );
  const { mutation } = useMutation();

  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [selectedTask, setSelectedTask] = useState<ITask | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [completionTask, setCompletionTask] = useState<ITask | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');

  // Filter faculties available to assign
  const availableFaculties = useMemo(() => {
    const list = Array.isArray(usersResponse) ? usersResponse : usersResponse?.data?.data || [];
    return list.filter((u: IUserRef) => {
      // Principal/Admin/Super Admin can assign to any staff role (excluding student/parent)
      const isStaff = u.roles?.some((r) => r !== 'student' && r !== 'parent');
      if (isAssigner && activeRoleName !== 'hod') {
        return isStaff;
      }
      // HOD by default can assign to their own department faculties
      const hasFacultyRole = u.roles?.some((r) => r === 'faculty' || r === 'hod');
      if (!hasFacultyRole) return false;
      if (activeRoleName === 'hod' && user?.department) {
        const uDeptId = typeof u.department === 'object' ? u.department?._id : u.department;
        const myDeptId =
          typeof user.department === 'object'
            ? (user.department as { _id: string })?._id
            : user.department;
        return uDeptId === myDeptId;
      }
      return true;
    });
  }, [usersResponse, activeRoleName, user, isAssigner]);

  // Filter tasks based on selected filter
  const filteredTasks = useMemo(() => {
    const query = workspaceSearch.trim().toLowerCase();
    return taskList.filter((task) => {
      if (filterAssignee === 'created' && String(task.assigner?._id) !== String(user?._id))
        return false;
      if (
        filterAssignee === 'assigned' &&
        !task.assignees.some((assignee) => String(assignee._id) === String(user?._id))
      )
        return false;
      if (filterPriority !== 'all' && task.priority !== filterPriority) return false;
      if (
        query &&
        ![task.title, task.description, task.assigner?.name, ...task.assignees.map((a) => a.name)]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(query))
      )
        return false;
      return true;
    });
  }, [taskList, filterAssignee, filterPriority, workspaceSearch, user]);

  const overdueCount = taskList.filter(
    (task) => task.status !== 'approved' && new Date(task.dueDate).getTime() < renderedAt,
  ).length;
  const reviewCount = taskList.filter((task) => task.status === 'completed').length;

  // Group tasks by status for Kanban Board
  const columns = useMemo(() => {
    return {
      todo: filteredTasks.filter((t) => t.status === 'todo'),
      in_progress: filteredTasks.filter((t) => t.status === 'in_progress'),
      completed: filteredTasks.filter((t) => t.status === 'completed'),
      approved: filteredTasks.filter((t) => t.status === 'approved'),
    };
  }, [filteredTasks]);

  const handleUpdateStatus = async (
    taskId: string,
    newStatus: 'todo' | 'in_progress' | 'completed',
  ) => {
    const res = await mutation(`task/${taskId}/status`, {
      method: 'PATCH',
      body: { status: newStatus },
      isAlert: true,
    });
    if (res) {
      toast.success(`Task status updated to ${newStatus.replace('_', ' ')}`);
      mutate();
      if (selectedTask?._id === taskId) {
        setSelectedTask((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
    }
  };

  const handleDecision = async (taskId: string, action: 'approve' | 'reject', feedback: string) => {
    const res = await mutation(`task/${taskId}/decide`, {
      method: 'PATCH',
      body: { action, feedback },
      isAlert: true,
    });
    if (res) {
      toast.success(action === 'approve' ? 'Task Approved' : 'Task Sent Back for Revision');
      setShowResolveModal(false);
      setSelectedTask(null);
      mutate();
    }
  };

  const handleComment = async () => {
    if (!selectedTask || commentDraft.trim().length < 2) return;
    const result = await mutation(`task/${selectedTask._id}/comments`, {
      method: 'POST',
      body: { message: commentDraft.trim() },
    });
    if (result?.results?.success) {
      const comment = result.results.data as NonNullable<ITask['comments']>[number];
      setSelectedTask((current) =>
        current ? { ...current, comments: [...(current.comments ?? []), comment] } : current,
      );
      setCommentDraft('');
      mutate();
    }
  };

  // Convert task attachments to IViewerFile array for the FileViewer
  const viewerFiles = useMemo<IViewerFile[]>(() => {
    if (!selectedTask?.attachments) return [];
    return selectedTask.attachments.map((att) => ({
      url: att.url,
      name: att.name,
      // Infer mimeType from filename so FileViewer can render PDFs inline
      mimeType: att.name?.toLowerCase().endsWith('.pdf')
        ? 'application/pdf'
        : /\.(png|jpe?g|jpg|webp|gif)$/i.test(att.name || '')
          ? 'image/jpeg'
          : undefined,
    }));
  }, [selectedTask]);

  return (
    <div className="min-h-dvh relative bg-slate-50/50 w-full p-2 mb-10">
      {(taskError || peopleError) && (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          {taskError?.message || peopleError?.message || 'Unable to load task data.'}
          <button type="button" onClick={() => mutate()} className="ml-2 font-semibold underline">
            Retry
          </button>
        </div>
      )}
      {taskLoading && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Loading tasks">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      )}
      {/* Page Header - Sticky */}
      <div className="sticky top-14 z-10 bg-slate-50/95 backdrop-blur-sm -mx-6 px-6 pb-4 pt-3 border-b border-slate-200/80 mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Task Management Control</h1>
          <p className="text-slate-500 text-sm">
            Assign, track, and complete institutional activities dynamically.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Quick Filters */}
          <div className="flex bg-white rounded-xl p-1 text-xs border border-slate-200">
            <button
              onClick={() => setFilterAssignee('all')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                filterAssignee === 'all'
                  ? 'bg-primary text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              All Tasks
            </button>
            {isAssigner && (
              <button
                onClick={() => setFilterAssignee('created')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  filterAssignee === 'created'
                    ? 'bg-primary text-white'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                Created By Me
              </button>
            )}
            <button
              onClick={() => setFilterAssignee('assigned')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                filterAssignee === 'assigned'
                  ? 'bg-primary text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Assigned To Me
            </button>
          </div>

          {/* SWR Refresh Button */}
          <CustomButton
            onClick={() => {
              mutate();
              toast.success('Task list refreshed successfully');
            }}
            fullWidth={false}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:scale-[1.01] transition-all"
          >
            <RotateCw className="h-3.5 w-3.5" /> Refresh
          </CustomButton>

          {isAssigner && (
            <CustomButton
              onClick={() => setShowCreateModal(true)}
              fullWidth={false}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-semibold text-white hover:bg-primary-600 transition-all hover:scale-[1.02]"
            >
              <Plus className="h-4 w-4" /> Create Task
            </CustomButton>
          )}
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          [
            'Active work',
            taskList.filter((task) => task.status !== 'approved').length,
            'text-blue-600',
          ],
          ['Due for review', reviewCount, 'text-amber-600'],
          ['Overdue', overdueCount, 'text-rose-600'],
          [
            'Closed',
            taskList.filter((task) => task.status === 'approved').length,
            'text-emerald-600',
          ],
        ].map(([label, value, color]) => (
          <div key={String(label)} className="rounded-2xl border border-slate-100 bg-white p-4">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs font-medium text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-600" />
          <input
            value={workspaceSearch}
            onChange={(event) => setWorkspaceSearch(event.target.value)}
            className={`${inputCls} pl-9 max-w-80`}
            placeholder="Search tasks, owners or assignees…"
          />
        </div>
        <select
          value={filterPriority}
          onChange={(event) => setFilterPriority(event.target.value)}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600"
        >
          <option value="all">All priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        {/* View Toggle */}
        <div className="flex bg-white rounded-xl p-1 text-xs border border-slate-200">
          <button
            onClick={() => setViewMode('kanban')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              viewMode === 'kanban' ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            Kanban Board
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              viewMode === 'table' ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            Table View
          </button>
        </div>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="rounded-2xl bg-white">
          <Empty
            title={taskList.length ? 'No tasks match these filters' : 'Your task board is ready'}
            subTitle={
              taskList.length
                ? 'Clear the search or priority filter to see more work.'
                : isAssigner
                  ? 'Create the first task, assign accountable owners and set a clear due date.'
                  : 'New work assigned to you will appear here with its due date and next action.'
            }
            pathName={isAssigner && !taskList.length ? 'Create first task' : undefined}
            onClick={isAssigner && !taskList.length ? () => setShowCreateModal(true) : undefined}
          />
        </div>
      ) : viewMode === 'kanban' ? (
        /* Kanban Board Columns — Flat Design */
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(columns) as Array<keyof typeof columns>).map((colKey) => {
            const titleMap = {
              todo: { label: 'To Do', border: 'border-t-slate-400', bg: 'bg-slate-100/40' },
              in_progress: {
                label: 'In Progress',
                border: 'border-t-blue-500',
                bg: 'bg-blue-50/10',
              },
              completed: {
                label: 'Completed',
                border: 'border-t-secondary',
                bg: 'bg-secondary-50/10',
              },
              approved: {
                label: 'Approved & Closed',
                border: 'border-t-emerald-500',
                bg: 'bg-emerald-50/10',
              },
            };
            const cfg = titleMap[colKey];
            const list = columns[colKey];

            return (
              <div
                key={colKey}
                className={`flex flex-col rounded-2xl bg-white/80 p-4 border-t-4 ${cfg.border} min-h-125`}
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="font-bold text-slate-700 text-sm tracking-wide">
                    {cfg.label}
                  </span>
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                    {list.length}
                  </span>
                </div>

                {/* Task Cards List — Borderless/Flat */}
                <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
                  {list.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center rounded-xl p-6 text-center text-slate-600 bg-slate-50/50">
                      <CheckSquare className="h-8 w-8 stroke-1 text-slate-300 mb-2" />
                      <span className="text-xs">No tasks</span>
                    </div>
                  ) : (
                    list.map((task) => {
                      const countdown = getCountdown(task.dueDate);

                      return (
                        <motion.div
                          key={task._id}
                          layoutId={task._id}
                          onClick={() => setSelectedTask(task)}
                          className="group relative cursor-pointer rounded-xl bg-white p-4 transition-all hover:bg-slate-50"
                        >
                          {/* Assignee / Assigner Info Row */}
                          <div className="mb-2 flex items-center justify-between">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                task.priority === 'critical'
                                  ? 'bg-rose-50 text-rose-600'
                                  : task.priority === 'high'
                                    ? 'bg-orange-50 text-orange-600'
                                    : task.priority === 'low'
                                      ? 'bg-slate-100 text-slate-500'
                                      : 'bg-blue-50 text-blue-600'
                              }`}
                            >
                              {task.priority || 'medium'}
                            </span>

                            {/* Attachments Indicator */}
                            {task.attachments && task.attachments.length > 0 && (
                              <span className="flex items-center gap-1 rounded bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500 font-medium">
                                <Paperclip className="h-2.5 w-2.5" />
                                {task.attachments.length}
                              </span>
                            )}
                          </div>

                          <h3 className="font-semibold text-slate-800 text-sm group-hover:text-primary transition-colors line-clamp-1">
                            {task.title}
                          </h3>
                          <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                            {task.description}
                          </p>
                          {task.dependencyIds && task.dependencyIds.length > 0 && (
                            <p className="mt-2 flex items-center gap-1 text-[10px] font-medium text-amber-600">
                              <AlertTriangle className="h-3 w-3" />
                              {task.dependencyIds.length} prerequisite
                              {task.dependencyIds.length > 1 ? 's' : ''}
                            </p>
                          )}

                          {/* Assignees avatars list */}
                          <div className="mt-3 flex items-center justify-between pt-3">
                            <div className="flex -space-x-1.5">
                              {task.assignees.slice(0, 3).map((a) => (
                                <div
                                  key={a._id}
                                  title={a.name}
                                  className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-50 text-[10px] font-bold text-primary ring-2 ring-white"
                                >
                                  {a.avatar ? (
                                    // Avatar URLs are user-provided and cannot be enumerated in Next image config.
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={a.avatar}
                                      alt={a.name}
                                      className="h-full w-full rounded-full object-cover"
                                    />
                                  ) : (
                                    a.name.charAt(0).toUpperCase()
                                  )}
                                </div>
                              ))}
                              {task.assignees.length > 3 && (
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[9px] font-bold text-slate-500 ring-2 ring-white">
                                  +{task.assignees.length - 3}
                                </div>
                              )}
                            </div>

                            {/* Countdown Indicator */}
                            {task.status !== 'approved' && (
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  countdown.status === 'overdue'
                                    ? 'bg-rose-50 text-rose-600'
                                    : countdown.status === 'critical' ||
                                        countdown.status === 'urgent'
                                      ? 'bg-amber-50 text-amber-600'
                                      : 'bg-emerald-50 text-emerald-600'
                                }`}
                              >
                                {countdown.text}
                              </span>
                            )}
                            {task.status === 'approved' && (
                              <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                                <CheckCircle2 className="h-3 w-3" /> Closed
                              </span>
                            )}
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Grid Table View Mode */
        <div className="overflow-x-auto rounded-2xl bg-white p-4">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <th className="pb-3 pl-4">Title</th>
                <th className="pb-3">Assigner</th>
                <th className="pb-3">Assignees</th>
                <th className="pb-3">Due Date</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-slate-700 text-sm">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-600">
                    No tasks found matching current filters.
                  </td>
                </tr>
              ) : (
                filteredTasks.map((t) => {
                  const countdown = getCountdown(t.dueDate);
                  return (
                    <tr key={t._id} className="hover:bg-slate-50/50 transition-colors">
                      <td
                        className="py-3.5 pl-4 font-semibold text-slate-800 max-w-xs truncate"
                        title={t.title}
                      >
                        {t.title}
                      </td>
                      <td className="py-3.5 text-xs text-slate-500">{t.assigner?.name}</td>
                      <td className="py-3.5">
                        <div className="flex -space-x-1.5">
                          {t.assignees.slice(0, 3).map((a) => (
                            <div
                              key={a._id}
                              title={a.name}
                              className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-50 text-[9px] font-bold text-primary ring-2 ring-white"
                            >
                              {a.avatar ? (
                                // Avatar URLs are user-provided and cannot be enumerated in Next image config.
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={a.avatar}
                                  alt={a.name}
                                  className="h-full w-full rounded-full object-cover"
                                />
                              ) : (
                                a.name.charAt(0).toUpperCase()
                              )}
                            </div>
                          ))}
                          {t.assignees.length > 3 && (
                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[8px] font-bold text-slate-500 ring-2 ring-white">
                              +{t.assignees.length - 3}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 text-xs">
                        <span className="font-semibold text-slate-600">{fmtDate(t.dueDate)}</span>
                        {t.status !== 'approved' && (
                          <span
                            className={`ml-2 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                              countdown.status === 'overdue'
                                ? 'bg-rose-50 text-rose-600'
                                : countdown.status === 'critical' || countdown.status === 'urgent'
                                  ? 'bg-amber-50 text-amber-600'
                                  : 'bg-emerald-50 text-emerald-600'
                            }`}
                          >
                            {countdown.text}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                            t.status === 'approved'
                              ? 'bg-emerald-50 text-emerald-755 text-emerald-700'
                              : t.status === 'completed'
                                ? 'bg-secondary-50 text-secondary'
                                : t.status === 'in_progress'
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {t.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 pr-4 text-right">
                        <button
                          onClick={() => setSelectedTask(t)}
                          className="text-xs font-bold text-primary hover:underline"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Task Details Modal (Standard & Approval Drawer) */}
      <AnimatePresence>
        {selectedTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
              onClick={() => setSelectedTask(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6"
            >
              {/* Close Button */}
              <button
                onClick={() => setSelectedTask(null)}
                className="absolute right-4 top-4 rounded-full p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-600 transition-all"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Assigner / Assignee Details */}
              <div className="mb-4 flex items-center gap-3">
                <span className="rounded bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary uppercase">
                  Task Detail
                </span>
                <span className="text-xs text-slate-600">
                  Created on {fmtDate(selectedTask.createdAt)}
                </span>
              </div>

              <h2 className="text-lg font-semibold text-slate-800 mb-2">{selectedTask.title}</h2>
              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 mb-4 whitespace-pre-line leading-relaxed">
                {selectedTask.description}
              </div>

              {/* Status & Deadline Grid */}
              <div className="grid grid-cols-2 gap-4 pb-4 mb-4 text-xs">
                <div>
                  <span className="block text-slate-600 font-medium mb-1">DUE DATE</span>
                  <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                    <Calendar className="h-3.5 w-3.5 text-slate-600" />
                    {fmtDate(selectedTask.dueDate)}
                  </div>
                </div>
                <div>
                  <span className="block text-slate-600 font-medium mb-1">TASK ASSIGNER</span>
                  <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                    <User className="h-3.5 w-3.5 text-slate-600" />
                    {selectedTask.assigner?.name}
                  </div>
                </div>
              </div>

              {/* Assignees List */}
              <div className="mb-4">
                <span className="block text-xs text-slate-600 font-semibold uppercase tracking-wider mb-2">
                  ASSIGNEES
                </span>
                <div className="flex flex-wrap gap-2">
                  {selectedTask.assignees.map((a) => (
                    <div
                      key={a._id}
                      className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
                    >
                      <div className="h-4 w-4 rounded-full bg-primary-100 flex items-center justify-center text-[8px] font-bold text-primary">
                        {a.avatar ? (
                          // Avatar URLs are user-provided and cannot be enumerated in Next image config.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={a.avatar}
                            alt={a.name}
                            className="h-full w-full rounded-full object-cover"
                          />
                        ) : (
                          a.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <span className="font-medium">{a.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes or Feedback if present */}
              {selectedTask.notes && (
                <div className="mb-4">
                  <span className="block text-xs text-slate-600 font-semibold uppercase tracking-wider mb-1">
                    NOTES
                  </span>
                  <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg">
                    {selectedTask.notes}
                  </p>
                </div>
              )}
              {selectedTask.feedback && (
                <div className="mb-4">
                  <span className="block text-xs text-rose-500 font-semibold uppercase tracking-wider mb-1">
                    REVISION FEEDBACK
                  </span>
                  <p className="text-xs text-rose-700 bg-rose-50/50 p-2.5 rounded-lg">
                    {selectedTask.feedback}
                  </p>
                </div>
              )}

              {/* Attachments Section — Uses FileViewer Trigger */}
              {selectedTask.attachments && selectedTask.attachments.length > 0 && (
                <div className="mb-6">
                  <span className="block text-xs text-slate-600 font-semibold uppercase tracking-wider mb-2">
                    ATTACHMENTS ({selectedTask.attachments.length})
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {selectedTask.attachments.map((att, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setViewerOpen(true)}
                        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition-all hover:border-primary/30 hover:text-primary"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span className="max-w-35 truncate">{att.name || `File ${i + 1}`}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(selectedTask.completionNote ||
                (selectedTask.completionEvidence?.length ?? 0) > 0) && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                    Completion submission
                  </p>
                  {selectedTask.completionNote && (
                    <p className="whitespace-pre-wrap text-sm text-slate-700">
                      {selectedTask.completionNote}
                    </p>
                  )}
                  {selectedTask.completionEvidence?.map((file) => (
                    <a
                      key={file.publicId}
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 flex items-center gap-2 text-xs font-semibold text-emerald-700 hover:underline"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      {file.name}
                    </a>
                  ))}
                </div>
              )}

              <div className="rounded-xl border border-slate-100 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-primary" />
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Discussion ({selectedTask.comments?.length ?? 0})
                  </p>
                </div>
                <div className="mb-3 max-h-44 space-y-3 overflow-y-auto">
                  {selectedTask.comments?.length ? (
                    selectedTask.comments.map((comment, index) => (
                      <div
                        key={`${comment.createdAt}-${index}`}
                        className="rounded-lg bg-slate-50 p-3"
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-slate-700">
                            {comment.authorName}
                          </p>
                          <p className="text-[10px] text-slate-600">{fmtDate(comment.createdAt)}</p>
                        </div>
                        <p className="whitespace-pre-wrap text-xs text-slate-600">
                          {comment.message}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="py-3 text-center text-xs text-slate-600">
                      No discussion yet. Add context, a question or an update.
                    </p>
                  )}
                </div>
                {selectedTask.status !== 'approved' && (
                  <div className="flex gap-2">
                    <input
                      value={commentDraft}
                      onChange={(event) => setCommentDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          void handleComment();
                        }
                      }}
                      className={inputCls}
                      placeholder="Add a task update…"
                    />
                    <button
                      type="button"
                      onClick={handleComment}
                      disabled={commentDraft.trim().length < 2}
                      className="rounded-xl bg-primary px-3 text-white disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Post comment"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Actions Footer — always visible, enabled by role */}
              {(() => {
                const isAssignee = selectedTask.assignees.some(
                  (a) => String(a._id) === String(user?._id),
                );
                const isTaskAssigner = String(selectedTask.assigner?._id) === String(user?._id);
                const status = selectedTask.status;

                const canStart = isAssignee && status === 'todo';
                const canSubmit = isAssignee && status === 'in_progress';
                const canReview = isTaskAssigner && status === 'completed';
                const isApproved = status === 'approved';

                return (
                  <div className="pt-4 border-t border-slate-100">
                    {/* Workflow Progress Steps */}
                    <div className="flex items-center gap-1.5 mb-4 text-[10px] font-semibold">
                      {(['todo', 'in_progress', 'completed', 'approved'] as const).map(
                        (s, i, arr) => {
                          const labels: Record<string, string> = {
                            todo: 'To Do',
                            in_progress: 'In Progress',
                            completed: 'Submitted',
                            approved: 'Approved',
                          };
                          const statusOrder = ['todo', 'in_progress', 'completed', 'approved'];
                          const isPast = statusOrder.indexOf(status) > statusOrder.indexOf(s);
                          const isCurrent = status === s;
                          return (
                            <div key={s} className="flex items-center gap-1.5">
                              <span
                                className={`px-2 py-0.5 rounded-full transition-all ${
                                  isCurrent
                                    ? 'bg-primary text-white'
                                    : isPast
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {labels[s]}
                              </span>
                              {i < arr.length - 1 && (
                                <span className={`text-slate-300 text-[8px]`}>›</span>
                              )}
                            </div>
                          );
                        },
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {!isApproved && (
                        <>
                          <button
                            type="button"
                            disabled={!canStart}
                            onClick={() =>
                              canStart && handleUpdateStatus(selectedTask._id, 'in_progress')
                            }
                            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                              canStart
                                ? 'bg-blue-600 hover:bg-blue-700 active:scale-95 text-white   cursor-pointer'
                                : 'bg-slate-100 text-slate-600 cursor-not-allowed opacity-60'
                            }`}
                          >
                            ▶ Start Task
                          </button>
                          <button
                            type="button"
                            disabled={!canSubmit}
                            onClick={() => canSubmit && setCompletionTask(selectedTask)}
                            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                              canSubmit
                                ? 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white   cursor-pointer'
                                : 'bg-slate-100 text-slate-600 cursor-not-allowed opacity-60'
                            }`}
                          >
                            ✓ Submit Completion
                          </button>
                          <button
                            type="button"
                            disabled={!canReview}
                            onClick={() => canReview && setShowResolveModal(true)}
                            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                              canReview
                                ? 'bg-amber-500 hover:bg-amber-600 active:scale-95 text-white   cursor-pointer'
                                : 'bg-slate-100 text-slate-600 cursor-not-allowed opacity-60'
                            }`}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Review & Resolve
                          </button>
                        </>
                      )}
                      {isApproved && (
                        <span className="flex items-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Task Approved
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTask(null);
                          setViewerOpen(false);
                        }}
                        className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-95 px-4 py-2 text-xs font-semibold text-slate-600 transition-all"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Review & Resolve (Approve/Reject) Modal */}
      <AnimatePresence>
        {completionTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
              onClick={() => setCompletionTask(null)}
            />
            <CompleteTaskModal
              task={completionTask}
              onClose={() => setCompletionTask(null)}
              onSaved={() => {
                setCompletionTask(null);
                setSelectedTask(null);
                mutate();
              }}
            />
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showResolveModal && selectedTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
              onClick={() => setShowResolveModal(false)}
            />
            <ReviewResolveModal
              task={selectedTask}
              onClose={() => setShowResolveModal(false)}
              onSaved={(action, feedback) => handleDecision(selectedTask._id, action, feedback)}
            />
          </div>
        )}
      </AnimatePresence>

      {/* Create Task Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
              onClick={() => setShowCreateModal(false)}
            />
            <CreateTaskModal
              availableFaculties={availableFaculties}
              searchQuery={peopleSearch}
              setSearchQuery={setPeopleSearch}
              availableTasks={taskList}
              onClose={() => setShowCreateModal(false)}
              onSaved={() => {
                setShowCreateModal(false);
                mutate();
              }}
            />
          </div>
        )}
      </AnimatePresence>

      {/* Shared FileViewer for attachments */}
      {selectedTask && (
        <FileViewer
          open={viewerOpen}
          onClose={() => setViewerOpen(false)}
          files={viewerFiles}
          title={selectedTask.title}
        />
      )}
    </div>
  );
}

function CompleteTaskModal({
  task,
  onClose,
  onSaved,
}: {
  task: ITask;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mutation, isLoading } = useMutation();
  const [note, setNote] = useState('');
  const [files, setFiles] = useState<{ file: File; objectUrl: string }[]>([]);

  const close = () => {
    files.forEach((item) => URL.revokeObjectURL(item.objectUrl));
    onClose();
  };

  const submit = async () => {
    if (note.trim().length < 10 && files.length === 0) {
      toast.error('Add a clear completion note or at least one evidence file');
      return;
    }
    const evidence: IAttachment[] = [];
    for (const item of files) {
      const formData = new FormData();
      formData.append('file', item.file);
      const uploaded = await mutation('upload', {
        method: 'POST',
        body: formData,
        isFormData: true,
      });
      const data = uploaded?.results?.data as
        | { url?: string; publicId?: string; filename?: string }
        | undefined;
      if (!uploaded?.results?.success || !data?.url || !data.publicId) {
        toast.error(`Could not upload ${item.file.name}`);
        return;
      }
      evidence.push({
        url: data.url,
        publicId: data.publicId,
        name: data.filename || item.file.name,
      });
    }
    const result = await mutation(`task/${task._id}/status`, {
      method: 'PATCH',
      body: { status: 'completed', completionNote: note.trim(), completionEvidence: evidence },
    });
    if (result?.results?.success) {
      toast.success('Completion submitted for review');
      files.forEach((item) => URL.revokeObjectURL(item.objectUrl));
      onSaved();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="relative z-10 w-full max-w-xl rounded-2xl bg-white p-6 "
    >
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Submit completion</h2>
          <p className="mt-1 text-sm text-slate-500">{task.title}</p>
        </div>
        <button type="button" onClick={close} className="rounded-lg p-2 hover:bg-slate-100">
          <X className="h-4 w-4 text-slate-500" />
        </button>
      </div>
      <div className="space-y-4">
        <div>
          <label className={labelCls}>What was completed?</label>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={4}
            className={inputCls}
            placeholder="Summarise the outcome, decisions and anything the reviewer should verify…"
          />
        </div>
        <div>
          <label className={labelCls}>Completion evidence</label>
          <InlineFileUpload
            files={files.map((item) => ({
              url: item.objectUrl,
              name: item.file.name,
              mimeType: item.file.type,
            }))}
            onUpload={async (file) => {
              setFiles((current) => [...current, { file, objectUrl: URL.createObjectURL(file) }]);
              return true;
            }}
            onRemove={async (file) => {
              setFiles((current) => {
                const removed = current.find((item) => item.objectUrl === file.url);
                if (removed) URL.revokeObjectURL(removed.objectUrl);
                return current.filter((item) => item.objectUrl !== file.url);
              });
            }}
          />
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <CustomButton type="button" variant="secondary" onClick={close}>
          Keep working
        </CustomButton>
        <CustomButton type="button" variant="primary" loading={isLoading} onClick={submit}>
          Submit for review
        </CustomButton>
      </div>
    </motion.div>
  );
}

function CreateTaskModal({
  availableFaculties,
  availableTasks,
  searchQuery,
  setSearchQuery,
  onClose,
  onSaved,
}: {
  availableFaculties: IUserRef[];
  availableTasks: ITask[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mutation, isLoading: isSaving } = useMutation();
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [localFiles, setLocalFiles] = useState<{ file: File; objectUrl: string }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedDependencies, setSelectedDependencies] = useState<string[]>([]);

  const handleClose = () => {
    localFiles.forEach((item) => URL.revokeObjectURL(item.objectUrl));
    onClose();
  };

  const formik = useFormik({
    initialValues: {
      title: '',
      description: '',
      dueDate: '',
      notes: '',
      priority: 'medium' as ITask['priority'],
      recurrenceFrequency: '',
      recurrenceInterval: 1,
      recurrenceEndsAt: '',
    },
    validationSchema: Yup.object({
      title: Yup.string().trim().max(200).required('Title is required'),
      description: Yup.string().trim().max(5000).required('Description is required'),
      dueDate: Yup.string().required('Due date and time is required'),
      notes: Yup.string().trim(),
    }),
    onSubmit: async (values) => {
      if (selectedAssignees.length === 0) {
        toast.error('Please select at least one assignee');
        return;
      }

      setIsUploading(true);
      const uploadedAttachments: IAttachment[] = [];

      try {
        for (const item of localFiles) {
          const formData = new FormData();
          formData.append('file', item.file);

          const res = await mutation('upload', {
            method: 'POST',
            body: formData,
            isFormData: true,
            isAlert: false,
          });

          if (res && res.results?.success) {
            const resData = res.results.data as
              | { url: string; publicId: string; filename?: string }
              | undefined;
            if (resData) {
              uploadedAttachments.push({
                url: resData.url,
                publicId: resData.publicId,
                name: resData.filename || item.file.name,
              });
            } else {
              throw new Error(`Failed to upload file "${item.file.name}"`);
            }
          } else {
            throw new Error(`Failed to upload file "${item.file.name}"`);
          }
        }

        const payload = {
          ...values,
          assignees: selectedAssignees,
          attachments: uploadedAttachments,
          dependencyIds: selectedDependencies,
          recurrence: values.recurrenceFrequency
            ? {
                frequency: values.recurrenceFrequency,
                interval: Number(values.recurrenceInterval),
                endsAt: values.recurrenceEndsAt || undefined,
              }
            : undefined,
        };

        const res = await mutation('task', {
          method: 'POST',
          body: payload,
          isAlert: true,
        });

        if (res) {
          toast.success('Task created and assigned successfully');
          localFiles.forEach((item) => URL.revokeObjectURL(item.objectUrl));
          onSaved();
        }
      } catch (err: unknown) {
        const errorMsg =
          err instanceof Error ? err.message : 'An error occurred during file upload';
        toast.error(errorMsg);
      } finally {
        setIsUploading(false);
      }
    },
  });

  const handleUpload = async (file: File): Promise<boolean> => {
    const objectUrl = URL.createObjectURL(file);
    setLocalFiles((prev) => [...prev, { file, objectUrl }]);
    return true;
  };

  const handleRemove = async (file: IViewerFile) => {
    setLocalFiles((prev) => {
      const match = prev.find((f) => f.objectUrl === file.url);
      if (match) {
        URL.revokeObjectURL(match.objectUrl);
      }
      return prev.filter((f) => f.objectUrl !== file.url);
    });
  };

  const toggleAssignee = (id: string) => {
    setSelectedAssignees((prev) =>
      prev.includes(id) ? prev.filter((aId) => aId !== id) : [...prev, id],
    );
  };

  const uploadedFiles: IViewerFile[] = localFiles.map((f) => ({
    url: f.objectUrl,
    name: f.file.name,
    mimeType: f.file.type,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="relative z-10 w-full max-w-2xl rounded-2xl bg-white  max-h-[85vh] flex flex-col overflow-hidden"
    >
      {/* Sticky Modal Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 shrink-0">
        <h2 className="text-lg font-bold text-slate-800">Create & Assign New Task</h2>
        <button
          type="button"
          onClick={handleClose}
          className="rounded-full p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-600 transition-all"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form
        onSubmit={formik.handleSubmit}
        className="flex flex-col flex-1 overflow-hidden text-left"
      >
        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <label className={labelCls}>Title</label>
            <input
              placeholder="e.g. Prepare NAAC Criteria 3 Documentation"
              className={inputCls}
              {...formik.getFieldProps('title')}
            />
            {formik.touched.title && formik.errors.title && (
              <p className="mt-1 text-xs text-rose-500 font-medium">{formik.errors.title}</p>
            )}
          </div>

          <div>
            <label className={labelCls}>Task Description</label>
            <textarea
              rows={4}
              placeholder="Provide a detailed request, deliverables, and instructions."
              className={inputCls}
              {...formik.getFieldProps('description')}
            />
            {formik.touched.description && formik.errors.description && (
              <p className="mt-1 text-xs text-rose-500 font-medium">{formik.errors.description}</p>
            )}
          </div>

          <div>
            <label className={labelCls}>Due Date & Time</label>
            <input
              type="datetime-local"
              className={inputCls}
              {...formik.getFieldProps('dueDate')}
            />
            {formik.touched.dueDate && formik.errors.dueDate && (
              <p className="mt-1 text-xs text-rose-500 font-medium">{formik.errors.dueDate}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Priority</label>
              <select {...formik.getFieldProps('priority')} className={inputCls}>
                <option value="low">Low — flexible</option>
                <option value="medium">Medium — normal</option>
                <option value="high">High — time sensitive</option>
                <option value="critical">Critical — immediate attention</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Repeat</label>
              <select {...formik.getFieldProps('recurrenceFrequency')} className={inputCls}>
                <option value="">Does not repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>

          {formik.values.recurrenceFrequency && (
            <div className="grid grid-cols-2 gap-4 rounded-xl bg-blue-50 p-4">
              <div>
                <label className={labelCls}>Repeat every</label>
                <div className="flex items-center gap-2">
                  <input
                    {...formik.getFieldProps('recurrenceInterval')}
                    className={inputCls}
                    type="number"
                    min={1}
                    max={365}
                  />
                  <span className="text-xs text-slate-500">
                    {formik.values.recurrenceFrequency}
                  </span>
                </div>
              </div>
              <div>
                <label className={labelCls}>Repeat until</label>
                <input
                  {...formik.getFieldProps('recurrenceEndsAt')}
                  className={inputCls}
                  type="date"
                />
              </div>
            </div>
          )}

          {availableTasks.filter((task) => task.status !== 'approved').length > 0 && (
            <div>
              <label className={labelCls}>Prerequisites</label>
              <p className="mb-2 text-xs text-slate-600">
                Assignees cannot start this work until every selected task is approved.
              </p>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
                {availableTasks
                  .filter((task) => task.status !== 'approved')
                  .map((task) => (
                    <label
                      key={task._id}
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedDependencies.includes(task._id)}
                        onChange={() =>
                          setSelectedDependencies((current) =>
                            current.includes(task._id)
                              ? current.filter((id) => id !== task._id)
                              : [...current, task._id],
                          )
                        }
                      />
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700">
                        {task.title}
                      </span>
                      <span className="text-[10px] capitalize text-slate-600">
                        {task.status.replace('_', ' ')}
                      </span>
                    </label>
                  ))}
              </div>
            </div>
          )}

          {/* Custom Multi-select for Assignees Dropdown */}
          <div className="relative">
            <label className={labelCls}>Select Assignees (Staff)</label>
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-full flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-sm text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-left"
            >
              <span className="truncate">
                {selectedAssignees.length === 0
                  ? 'Choose staff assignees...'
                  : `${selectedAssignees.length} selected: ${selectedAssignees
                      .map((id) => availableFaculties.find((f) => f._id === id)?.name)
                      .filter(Boolean)
                      .join(', ')}`}
              </span>
              <span className="text-slate-600 text-xs ml-2">▼</span>
            </button>

            {dropdownOpen && (
              <>
                {/* Overlay to close when clicking outside */}
                <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />

                {/* Dropdown Menu Container */}
                <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl  max-h-60 overflow-y-auto p-2 space-y-1">
                  {/* Search input inside dropdown */}
                  <div className="p-1 border-b border-slate-100 mb-1">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onClick={(e) => e.stopPropagation()} // Prevent dropdown closing on search input click
                      className="w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary transition-all"
                      placeholder="Search name or email..."
                    />
                  </div>

                  {availableFaculties.length === 0 ? (
                    <p className="text-xs text-slate-600 p-2 text-center">No staff found.</p>
                  ) : (
                    availableFaculties.map((f) => {
                      const isSelected = selectedAssignees.includes(f._id);
                      return (
                        <button
                          key={f._id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleAssignee(f._id);
                          }}
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                            isSelected
                              ? 'bg-primary text-white'
                              : 'text-slate-700 hover:bg-slate-200/50'
                          }`}
                        >
                          <span>
                            {f.name} ({f.email})
                          </span>
                          {isSelected && <Check className="h-3.5 w-3.5" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </>
            )}
            <span className="text-[10px] text-slate-600 font-medium mt-1 block">
              {selectedAssignees.length} assignee(s) selected
            </span>
          </div>

          <div>
            <label className={labelCls}>Additional Notes (Optional)</label>
            <input
              placeholder="e.g. Reference materials can be downloaded below"
              className={inputCls}
              {...formik.getFieldProps('notes')}
            />
          </div>

          {/* File Attachments — Uses locked InlineFileUpload component */}
          <div>
            <InlineFileUpload
              label="Attach Files (Optional)"
              multiple
              files={uploadedFiles}
              onUpload={handleUpload}
              onRemove={handleRemove}
            />
          </div>
        </div>

        {/* Sticky Modal Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4 shrink-0 bg-slate-50/50 rounded-b-2xl">
          <div className="w-fit">
            <CustomButton
              onClick={handleClose}
              variant="cancel"
              className="rounded-xl px-4 py-2.5 text-xs font-semibold"
            >
              Cancel
            </CustomButton>
          </div>
          <div className="w-fit">
            <CustomButton
              type="submit"
              disabled={isSaving || isUploading}
              className="rounded-xl bg-primary px-5 py-2.5 font-semibold text-white hover:bg-primary-600 text-xs"
            >
              {isSaving || isUploading ? 'Saving...' : 'Assign Task'}
            </CustomButton>
          </div>
        </div>
      </form>
    </motion.div>
  );
}

// Sub Component: Review & Resolve Modal
function ReviewResolveModal({
  task,
  onClose,
  onSaved,
}: {
  task: ITask;
  onClose: () => void;
  onSaved: (action: 'approve' | 'reject', feedback: string) => void;
}) {
  const [feedback, setFeedback] = useState('');

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6"
    >
      <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
        <h2 className="text-base font-bold text-slate-800">Verify & Approve Task</h2>
        <button
          onClick={onClose}
          className="rounded-full p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-600 transition-all"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-4">
        <p className="text-xs text-slate-500 font-semibold mb-1">TASK TITLE</p>
        <p className="text-sm font-bold text-slate-700">{task.title}</p>
      </div>

      <div className="mb-4">
        <label className={labelCls}>Review Notes & Feedback</label>
        <textarea
          rows={3}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Add comments on why this is approved or what needs revision..."
          className={inputCls}
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={() => onSaved('approve', feedback)}
          className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 px-4 py-2 text-xs font-semibold text-white transition-all  "
        >
          <Check className="h-3.5 w-3.5" /> Approve
        </button>
        <button
          type="button"
          onClick={() => onSaved('reject', feedback)}
          className="flex items-center gap-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 active:scale-95 px-4 py-2 text-xs font-semibold text-white transition-all  "
        >
          <X className="h-3.5 w-3.5" /> Needs Revision
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-95 px-4 py-2 text-xs font-semibold text-slate-600 transition-all"
        >
          Cancel
        </button>
      </div>
    </motion.div>
  );
}
