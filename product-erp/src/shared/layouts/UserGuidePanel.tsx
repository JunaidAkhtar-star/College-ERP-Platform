/**
 * @file UserGuidePanel.tsx
 * @description Comprehensive RBAC-aware Interactive User Setup, Visual Module Guide & Dynamic AI ERP Assistant.
 * Covers 100% of ERP modules and roles (Admin, Faculty, Student, Admissions, Accounts, Exams, HR, Placement, Library, Facilities, IQAC).
 * Integrates with dynamic navigation (`useNav`) and backend entities (`GET /search`).
 * @module shared/layouts
 */

'use client';

import { useNav } from '@/shared/hooks/useNav';
import { useAuthStore } from '@/shared/store/authStore';
import { getFromLocalStorage, getTenantId, getTenantRolePath } from '@/shared/utils';
import { authenticatedRequest } from '@/shared/utils/authenticatedRequest';
import { AnimatePresence, motion } from '@/shared/utils/motion';
import {
  ArrowUp,
  BookOpen,
  Bot,
  Calendar,
  Check,
  Copy,
  CreditCard,
  ExternalLink,
  Globe,
  GraduationCap,
  History,
  Loader2,
  MessageSquarePlus,
  MessageSquareText,
  Square,
  Terminal,
  Trash2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Swal from 'sweetalert2';

interface IChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  actionRoute?: string;
  actionLabel?: string;
  timestamp: string;
  isStreaming?: boolean;
  webSources?: Array<{ title: string; uri: string }>;
}

interface IChatConversation {
  id: string;
  title: string;
  updatedAt: string;
  messages: IChatMessage[];
}

const ASSISTANT_MARKDOWN_CLASS =
  'prose max-w-none text-[13.5px] leading-relaxed text-slate-700 prose-headings:text-slate-900 ' +
  '[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 ' +
  '[&_h1]:mb-2 [&_h1]:mt-3.5 [&_h1]:text-base [&_h1]:font-bold [&_h1]:text-slate-900 ' +
  '[&_h2]:mb-1.5 [&_h2]:mt-3 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:text-slate-900 [&_h2]:border-b [&_h2]:border-slate-100 [&_h2]:pb-1 ' +
  '[&_h3]:mb-1 [&_h3]:mt-2.5 [&_h3]:text-[13px] [&_h3]:font-bold [&_h3]:text-slate-900 ' +
  '[&_strong]:font-semibold [&_strong]:text-slate-900 ' +
  '[&_em]:italic [&_em]:text-slate-600 ' +
  '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 ' +
  '[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 ' +
  '[&_li]:pl-0.5 [&_li]:marker:font-semibold [&_li]:marker:text-primary ' +
  '[&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_a]:transition hover:[&_a]:text-primary-700 ' +
  '[&_blockquote]:my-2.5 [&_blockquote]:rounded-r-xl [&_blockquote]:border-l-3 [&_blockquote]:border-primary/50 [&_blockquote]:bg-slate-50/80 [&_blockquote]:px-3.5 [&_blockquote]:py-2 [&_blockquote]:text-slate-600 [&_blockquote]:text-xs ' +
  '[&_hr]:my-3 [&_hr]:border-slate-200 ' +
  '[&_code]:rounded-md [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[12px] [&_code]:font-mono [&_code]:font-medium [&_code]:text-slate-800 ' +
  '[&_table]:my-2.5 [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs [&_table]:rounded-xl [&_table]:overflow-hidden ' +
  '[&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-100/90 [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold [&_th]:text-slate-800 ' +
  '[&_td]:border [&_td]:border-slate-200 [&_td]:px-3 [&_td]:py-1.5 [&_td]:align-top [&_td]:text-slate-700 [&_tr:nth-child(even)]:bg-slate-50/50';

// ─── Code Block (Clean Enterprise Theme) ────────────────────────────────────
function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="group my-2.5 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/80 text-slate-800 text-xs">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100/80 px-3 py-1.5 text-[11px] text-slate-600 font-mono">
        <span className="font-semibold">{language || 'text'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition cursor-pointer"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-[12px] leading-relaxed text-slate-800">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ─── HTML Block Renderer ─────────────────────────────────────────────────────
function HtmlBlock({ code }: { code: string }) {
  const safe = code
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/<iframe[\s\S]*?>/gi, '')
    .replace(/src\s*=\s*["'](https?:\/\/[^"']*)["']/gi, '');
  return (
    <div className="my-2.5 overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-3 py-1.5">
        <Terminal className="h-3.5 w-3.5 text-slate-500" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Preview
        </span>
      </div>
      <div
        className="p-3 text-sm [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:p-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_td]:border [&_td]:border-slate-200 [&_td]:p-2 [&_td]:text-xs [&_td]:align-top [&_tr:nth-child(even)]:bg-slate-50/50 [&_h1]:text-base [&_h1]:font-bold [&_h2]:text-sm [&_h2]:font-bold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_strong]:font-semibold"
        dangerouslySetInnerHTML={{ __html: safe }}
      />
    </div>
  );
}

// ─── Chat Input Bar ──────────────────────────────────────────────────────────
interface ChatInputBarProps {
  onSend: (text: string) => void;
  isThinking: boolean;
  onStop?: () => void;
}

function ChatInputBar({ onSend, isThinking, onStop }: ChatInputBarProps) {
  const [query, setQuery] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow textarea height
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 140)}px`;
  }, [query]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim() || isThinking) return;
    onSend(query.trim());
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const canSubmit = Boolean(query.trim()) && !isThinking;
  const tenantId = getTenantId();
  const tenantShortCode = tenantId ? tenantId.toUpperCase() : 'ERP';

  return (
    <div className="shrink-0 border-t border-slate-200 bg-white px-3.5 py-2.5 sm:px-4 sm:py-3">
      <div className="relative rounded-xl border border-slate-200 bg-slate-50 p-1.5 transition-all focus-within:border-primary/60 focus-within:bg-white focus-within:ring-2 focus-within:ring-primary/10">
        <textarea
          ref={textareaRef}
          rows={1}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isThinking ? 'AI is generating answer…' : 'Ask about workload, timetable, admissions, fees…'
          }
          className="w-full resize-none border-0 bg-transparent px-2 py-1 text-[13px] leading-relaxed text-slate-800 outline-none placeholder:text-slate-400 disabled:opacity-60 max-h-36 min-h-9"
          style={{ height: 'auto' }}
        />
        <div className="flex items-center justify-between pt-0.5 px-1">
          <span className="text-[10px] text-slate-400 hidden sm:inline-flex items-center gap-1 font-medium">
            <span>Press</span>
            <kbd className="rounded border border-slate-200 bg-slate-100 px-1 py-0.5 text-[9px] font-mono text-slate-600">Enter ↵</kbd>
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            {isThinking ? (
              <button
                type="button"
                onClick={onStop}
                title="Stop generating"
                className="flex h-7.5 w-7.5 items-center justify-center rounded-lg bg-red-600 text-white transition hover:bg-red-700 cursor-pointer"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSubmit()}
                disabled={!canSubmit}
                aria-label="Send message"
                className={`flex h-7.5 w-7.5 items-center justify-center rounded-lg transition-all duration-150 cursor-pointer ${canSubmit
                    ? 'bg-primary text-white hover:bg-primary-700 shadow-xs'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                  }`}
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
      <p className="mt-1 text-center text-[10px] text-slate-400">
        {tenantShortCode} ERP Assistant · Enterprise AI Knowledge Base
      </p>
    </div>
  );
}

function parseTextAndSuggestions(text: string): {
  cleanText: string;
  suggestions: { q: string; label: string }[];
} {
  const marker = '[FOLLOW_UP]';
  const index = text.indexOf(marker);
  if (index === -1) {
    return { cleanText: text, suggestions: [] };
  }

  const cleanText = text.slice(0, index).trim();
  const followUpPart = text.slice(index + marker.length);

  const suggestions: { q: string; label: string }[] = [];
  const lines = followUpPart.split('\n');
  for (let line of lines) {
    line = line.trim();
    if (line.startsWith('-')) {
      const q = line.slice(1).trim();
      if (q) {
        const label = q;
        suggestions.push({ q, label });
      }
    }
  }

  return { cleanText, suggestions };
}

interface UserGuidePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserGuidePanel({ isOpen, onClose }: UserGuidePanelProps) {
  const { role } = useAuthStore();
  const pathname = usePathname();
  const { groups: navGroups } = useNav(isOpen);

  // AI Chat Assistant State
  const msgCounterRef = useRef(1);
  const [chatMessages, setChatMessages] = useState<IChatMessage[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: `Hello! I am your AI ERP Assistant. Ask me anything about module setups, feature workflows, or setup order. How can I help you today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const [assistantStatus, setAssistantStatus] = useState<string | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [conversations, setConversations] = useState<IChatConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null);
  const [isDeletingAllHistory, setIsDeletingAllHistory] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const shouldFollowStreamRef = useRef(true);
  const requestAbortRef = useRef<AbortController | null>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (!chatScrollRef.current || !shouldFollowStreamRef.current) return;
    const frame = requestAnimationFrame(() => {
      if (chatScrollRef.current) {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [chatMessages, isThinking]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) return;
    requestAbortRef.current?.abort();
    requestAbortRef.current = null;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();

    const loadHistory = async () => {
      setIsHistoryLoading(true);
      try {
        const token = getFromLocalStorage('accessToken');
        const tenantId = getTenantId();
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        if (tenantId) headers['X-Tenant-ID'] = tenantId;
        const response = await authenticatedRequest('erp-assistant/history', {
          headers,
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          data?: Array<{
            _id: string;
            conversationId?: string;
            question: string;
            answer: string;
            mentionedModules?: string[];
            createdAt: string;
          }>;
        };
        const rows = payload.data ?? [];
        if (rows.length === 0) return;
        const grouped = new Map<string, IChatConversation>();
        rows.forEach((entry) => {
          const timestamp = new Date(entry.createdAt).toLocaleString([], {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          });
          const moduleName = entry.mentionedModules?.[0];
          const conversationId = entry.conversationId || `legacy-${entry._id}`;
          const messages: IChatMessage[] = [
            {
              id: `${entry._id}_user`,
              sender: 'user',
              text: entry.question,
              timestamp,
            },
            {
              id: `${entry._id}_ai`,
              sender: 'ai',
              text: entry.answer,
              timestamp,
              actionRoute: moduleName
                ? role
                  ? getTenantRolePath(role, moduleName)
                  : `/${moduleName}`
                : undefined,
              actionLabel: moduleName
                ? `Open ${moduleName.replace(/-/g, ' ')} Workspace`
                : undefined,
            },
          ];
          const existing = grouped.get(conversationId);
          if (existing) {
            existing.messages.push(...messages);
            existing.updatedAt = entry.createdAt;
          } else {
            grouped.set(conversationId, {
              id: conversationId,
              title: entry.question.slice(0, 72),
              updatedAt: entry.createdAt,
              messages,
            });
          }
        });
        const restoredConversations = Array.from(grouped.values()).sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );
        setConversations(restoredConversations);
        const latest = restoredConversations[0];
        if (latest) {
          setCurrentConversationId(latest.id);
          setChatMessages(latest.messages);
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          // Keep the welcome message when history is temporarily unavailable.
        }
      } finally {
        if (!controller.signal.aborted) setIsHistoryLoading(false);
      }
    };

    void loadHistory();
    return () => controller.abort();
  }, [isOpen, role]);

  const startNewConversation = () => {
    requestAbortRef.current?.abort();
    setCurrentConversationId(crypto.randomUUID());
    setIsThinking(false);
    setAssistantStatus(null);
    setShowHistory(false);
    shouldFollowStreamRef.current = true;
    setChatMessages([
      {
        id: 'welcome',
        sender: 'ai',
        text: 'Hello! I am your AI ERP Assistant. Ask me anything about module setups, feature workflows, or setup order. How can I help you today?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const deleteConversation = async (conversation: IChatConversation) => {
    const confirmation = await Swal.fire({
      title: 'Delete this conversation?',
      text: `“${conversation.title}” will be permanently removed from your chat history.`,
      icon: 'warning',
      showCancelButton: true,
      reverseButtons: true,
      focusCancel: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Delete conversation',
      cancelButtonText: 'Keep conversation',
    });
    if (!confirmation.isConfirmed) return;
    setDeletingConversationId(conversation.id);
    try {
      const token = getFromLocalStorage('accessToken');
      const tenantId = getTenantId();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      if (tenantId) headers['X-Tenant-ID'] = tenantId;
      const response = await authenticatedRequest(
        `erp-assistant/history/${encodeURIComponent(conversation.id)}`,
        { method: 'DELETE', headers },
      );
      if (!response.ok) return;
      setConversations((previous) => previous.filter((item) => item.id !== conversation.id));
      if (currentConversationId === conversation.id) {
        setCurrentConversationId('');
        setChatMessages([
          {
            id: 'welcome',
            sender: 'ai',
            text: 'Hello! I am your AI ERP Assistant. Ask me anything about module setups, feature workflows, or setup order. How can I help you today?',
            timestamp: new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
          },
        ]);
      }
    } finally {
      setDeletingConversationId(null);
    }
  };

  const deleteAllConversations = async () => {
    const confirmation = await Swal.fire({
      title: 'Delete all chat history?',
      text: 'All your previous assistant conversations will be permanently deleted. This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      reverseButtons: true,
      focusCancel: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Delete all',
      cancelButtonText: 'Cancel',
    });
    if (!confirmation.isConfirmed) return;
    setIsDeletingAllHistory(true);
    try {
      const token = getFromLocalStorage('accessToken');
      const tenantId = getTenantId();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      if (tenantId) headers['X-Tenant-ID'] = tenantId;
      const response = await authenticatedRequest('erp-assistant/history', {
        method: 'DELETE',
        headers,
      });
      if (!response.ok) return;
      setConversations([]);
      setCurrentConversationId('');
      setChatMessages([
        {
          id: 'welcome',
          sender: 'ai',
          text: 'Hello! I am your AI ERP Assistant. Ask me anything about module setups, feature workflows, or setup order. How can I help you today?',
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
      ]);
    } finally {
      setIsDeletingAllHistory(false);
    }
  };

  const copyAssistantMessage = async (message: IChatMessage) => {
    await navigator.clipboard.writeText(message.text);
    setCopiedMessageId(message.id);
    window.setTimeout(() => setCopiedMessageId(null), 1600);
  };

  const resolveRoute = (path: string) => {
    if (!role) return path;
    return getTenantRolePath(role, path);
  };

  // Handle AI Chat Submit with Real Backend Gemini Integration (SSE Streaming)
  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isThinking) return;

    const conversationId = currentConversationId || crypto.randomUUID();
    if (!currentConversationId) setCurrentConversationId(conversationId);
    shouldFollowStreamRef.current = true;

    msgCounterRef.current += 1;
    const userMsgId = `u_${msgCounterRef.current}`;
    const timestampStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: IChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: textToSend,
      timestamp: timestampStr,
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setConversations((previous) => {
      const existing = previous.find((item) => item.id === conversationId);
      const priorMessages =
        existing?.messages ?? chatMessages.filter((item) => item.id !== 'welcome');
      const conversation: IChatConversation = {
        id: conversationId,
        title: existing?.title || textToSend.slice(0, 72),
        updatedAt: new Date().toISOString(),
        messages: [...priorMessages, userMsg],
      };
      return [conversation, ...previous.filter((item) => item.id !== conversationId)];
    });
    setIsThinking(true);
    setAssistantStatus('Connecting securely…');

    // We'll create the AI message when the first chunk arrives (not before)
    const aiMsgId = `ai_${msgCounterRef.current + 1}`;
    msgCounterRef.current += 1;
    let aiMessageCreated = false;

    try {
      requestAbortRef.current?.abort();
      const requestController = new AbortController();
      requestAbortRef.current = requestController;
      const token = getFromLocalStorage('accessToken');
      const tenantId = getTenantId();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (tenantId) headers['X-Tenant-ID'] = tenantId;

      const history = chatMessages
        .filter((m) => m.id !== 'welcome')
        .slice(-8)
        .map((m) => ({
          role: m.sender === 'user' ? ('user' as const) : ('model' as const),
          text: m.text.slice(0, 2000),
        }));
      const visibleModules = navGroups.flatMap((group) =>
        group.items.map((item) => ({
          label: item.label,
          path: item.href,
          group: group.group,
        })),
      );

      // Use SSE streaming endpoint for real-time chunk-by-chunk response
      const res = await authenticatedRequest('erp-assistant/ask-stream', {
        method: 'POST',
        headers,
        signal: requestController.signal,
        body: JSON.stringify({
          question: textToSend,
          conversationId,
          history,
          context: {
            currentPath: pathname,
            visibleModules,
          },
        }),
      });

      if (res.ok) {
        const reader = res.body?.getReader();
        if (!reader) throw new Error('No response stream');

        const decoder = new TextDecoder();
        let buffer = '';
        const streamedChunks: string[] = [];
        const finalAnswers: string[] = [];
        const streamErrors: string[] = [];
        let targetRoute: string | undefined;
        let targetLabel: string | undefined;
        let streamWebSources: Array<{ title: string; uri: string }> = [];
        let firstChunkReceived = false;
        let currentEvent = 'message';

        // Fluid typewriter interpolation queue
        let targetText = '';
        let displayedLength = 0;
        let isStreamFinished = false;
        let drainInterval: ReturnType<typeof setInterval> | null = null;

        const startDrainer = () => {
          if (drainInterval) return;
          drainInterval = setInterval(() => {
            if (displayedLength < targetText.length) {
              const diff = targetText.length - displayedLength;
              const step = diff > 60 ? Math.ceil(diff / 3) : diff > 20 ? 3 : diff > 6 ? 2 : 1;
              displayedLength = Math.min(targetText.length, displayedLength + step);
              const currentChunk = targetText.slice(0, displayedLength);

              setChatMessages((prev) =>
                prev.map((m) =>
                  m.id === aiMsgId
                    ? {
                      ...m,
                      text: currentChunk,
                      isStreaming: !isStreamFinished || displayedLength < targetText.length,
                    }
                    : m,
                ),
              );
            } else if (isStreamFinished && displayedLength >= targetText.length) {
              if (drainInterval) {
                clearInterval(drainInterval);
                drainInterval = null;
              }
            }
          }, 16);
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim();
              continue;
            }
            if (line.startsWith('data: ')) {
              try {
                const payload = JSON.parse(line.slice(6));
                if (currentEvent === 'status' && payload.message) {
                  setAssistantStatus(String(payload.message));
                }
                if (payload.text) {
                  streamedChunks.push(String(payload.text));
                  targetText = streamedChunks.join('');
                  if (!firstChunkReceived) {
                    firstChunkReceived = true;
                    setIsThinking(false);
                    setAssistantStatus('Writing response…');
                    const timestampStr = new Date().toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    setChatMessages((prev) => [
                      ...prev,
                      {
                        id: aiMsgId,
                        sender: 'ai' as const,
                        text: '',
                        timestamp: timestampStr,
                        isStreaming: true,
                      },
                    ]);
                    aiMessageCreated = true;
                    startDrainer();
                  }
                }
                if (payload.answer) {
                  finalAnswers.push(String(payload.answer));
                  if (payload.mentionedModules?.length > 0) {
                    targetRoute = resolveRoute(`/${payload.mentionedModules[0]}`);
                    targetLabel = `Open ${payload.mentionedModules[0].replace(/-/g, ' ')} Workspace`;
                  }
                  if (Array.isArray(payload.webSources)) {
                    streamWebSources = payload.webSources as Array<{ title: string; uri: string }>;
                  }
                }
                if (currentEvent === 'error') {
                  streamErrors.push(String(payload.message || 'Assistant generation failed'));
                }
              } catch {
                // skip malformed SSE line
              }
            }
          }
        }

        if (streamErrors.length > 0) throw new Error(streamErrors[0]);

        isStreamFinished = true;
        targetText = finalAnswers.at(-1) || streamedChunks.join('');

        // Wait until smooth drainer catches up
        await new Promise<void>((resolve) => {
          const checkDrain = setInterval(() => {
            if (!drainInterval || displayedLength >= targetText.length) {
              clearInterval(checkDrain);
              if (drainInterval) clearInterval(drainInterval);
              resolve();
            }
          }, 20);
        });

        const accumulatedText = targetText;

        // Final update with action route and complete flag
        if (aiMessageCreated) {
          setChatMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId
                ? {
                  ...m,
                  text: accumulatedText,
                  actionRoute: targetRoute,
                  actionLabel: targetLabel,
                  webSources: streamWebSources,
                  isStreaming: false,
                }
                : m,
            ),
          );
        } else if (accumulatedText) {
          const timestampStr = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });
          setChatMessages((prev) => [
            ...prev,
            {
              id: aiMsgId,
              sender: 'ai' as const,
              text: accumulatedText,
              timestamp: timestampStr,
              actionRoute: targetRoute,
              actionLabel: targetLabel,
              webSources: streamWebSources,
              isStreaming: false,
            },
          ]);
        }
        setIsThinking(false);
        setAssistantStatus(null);
        requestAbortRef.current = null;
        setConversations((previous) =>
          previous.map((conversation) =>
            conversation.id === conversationId
              ? {
                ...conversation,
                updatedAt: new Date().toISOString(),
                messages: [
                  ...conversation.messages.filter((message) => message.id !== aiMsgId),
                  {
                    id: aiMsgId,
                    sender: 'ai' as const,
                    text: accumulatedText,
                    timestamp: new Date().toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    }),
                    actionRoute: targetRoute,
                    actionLabel: targetLabel,
                    isStreaming: false,
                  },
                ],
              }
              : conversation,
          ),
        );
        return;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setIsThinking(false);
        setAssistantStatus(null);
        return;
      }
      // Fall back to local KB if offline or error
    }

    // Network/stream error fallback — show friendly offline message
    setChatMessages((prev) => prev.filter((m) => m.id !== aiMsgId));

    const fallbackText = `I'm having trouble connecting to the AI service right now. Please check your network connection and try again. If the issue persists, contact your system administrator.`;

    const targetRoute = undefined;
    const targetLabel = undefined;

    msgCounterRef.current += 1;
    const aiMsg: IChatMessage = {
      id: `ai_${msgCounterRef.current}`,
      sender: 'ai',
      text: fallbackText,
      actionRoute: targetRoute,
      actionLabel: targetLabel,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isStreaming: false,
    };

    setChatMessages((prev) => [...prev, aiMsg]);
    setConversations((previous) =>
      previous.map((conversation) =>
        conversation.id === conversationId
          ? {
            ...conversation,
            updatedAt: new Date().toISOString(),
            messages: [...conversation.messages, aiMsg],
          }
          : conversation,
      ),
    );
    setIsThinking(false);
    setAssistantStatus(null);
    requestAbortRef.current = null;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-800/30 backdrop-blur-xs transition-opacity"
          />

          <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full sm:pl-10">
            <motion.div
              initial={{ x: 72, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 72, opacity: 0 }}
              transition={{ type: 'spring', damping: 32, stiffness: 260, mass: 0.85 }}
              className="pointer-events-auto flex w-screen flex-col overflow-hidden border-l border-slate-200 bg-slate-50 sm:max-w-2xl xl:max-w-3xl"
            >
              <div className="relative shrink-0 border-b border-slate-200 bg-white px-4 py-2.5">
                {/* Compact top row: icon + title + actions */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary border border-primary-200/70">
                      <Bot className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-800 leading-tight">
                        ERP Assistant
                      </h2>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShowHistory((value) => !value)}
                      disabled={isThinking}
                      title="Previous chats"
                      className={`inline-flex h-7.5 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition cursor-pointer ${showHistory
                          ? 'bg-primary-50 text-primary'
                          : 'text-slate-600 hover:bg-slate-100'
                        } disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      <History className="h-3.5 w-3.5" />
                      <span className="hidden md:inline">Chats</span>
                      {conversations.length > 0 && (
                        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 font-medium">
                          {conversations.length}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={startNewConversation}
                      title="Start a new chat"
                      className="inline-flex h-7.5 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-xs font-semibold text-white transition hover:bg-primary-700 cursor-pointer shadow-xs"
                    >
                      <MessageSquarePlus className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">New chat</span>
                    </button>
                    <span className="mx-0.5 h-4 w-px bg-slate-200" />
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex h-7.5 w-7.5 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
                      aria-label="Close guide panel"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* AI ERP ASSISTANT */}
              <div className="erp-assistant-font flex min-h-0 flex-1 flex-col">
                {showHistory && (
                  <div className="flex-1 overflow-y-auto bg-slate-50/70 px-4 py-5 sm:px-6">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">Previous chats</h3>
                        <p className="mt-1 text-xs text-slate-500">
                          Select a conversation to continue. Chats are removed after 7 days.
                        </p>
                      </div>
                      {conversations.length > 0 && (
                        <button
                          type="button"
                          onClick={deleteAllConversations}
                          disabled={isDeletingAllHistory}
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-red-200 bg-red-50/60 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100 hover:text-red-700 cursor-pointer disabled:opacity-50"
                        >
                          {isDeletingAllHistory ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          <span>Delete All</span>
                        </button>
                      )}
                    </div>
                    {isHistoryLoading ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map((item) => (
                          <div
                            key={item}
                            className="h-20 animate-pulse rounded-2xl border border-slate-100 bg-white"
                          />
                        ))}
                      </div>
                    ) : conversations.length === 0 ? (
                      <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 text-center">
                        <MessageSquareText className="h-8 w-8 text-slate-300" />
                        <p className="mt-3 text-sm font-semibold text-slate-700">No saved chats</p>
                        <p className="mt-1 text-xs text-slate-600">
                          Your completed assistant conversations will appear here.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {conversations.map((conversation) => (
                          <div
                            key={conversation.id}
                            className={`relative overflow-hidden rounded-2xl border bg-white transition hover:-translate-y-0.5 hover:border-primary-200  ${conversation.id === currentConversationId
                                ? 'border-primary-200 ring-2 ring-primary/5'
                                : 'border-slate-200'
                              }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setCurrentConversationId(conversation.id);
                                setChatMessages(conversation.messages);
                                setShowHistory(false);
                              }}
                              disabled={deletingConversationId === conversation.id}
                              className="flex w-full items-start gap-3 p-4 pr-14 text-left cursor-pointer disabled:opacity-60"
                            >
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary">
                                <MessageSquareText className="h-4 w-4" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold text-slate-800">
                                  {conversation.title}
                                </span>
                                <span className="mt-1 block truncate text-xs text-slate-500">
                                  {conversation.messages.at(-1)?.text}
                                </span>
                                <span className="mt-2 block text-[11px] font-medium text-slate-600">
                                  {new Date(conversation.updatedAt).toLocaleString([], {
                                    day: '2-digit',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteConversation(conversation)}
                              disabled={deletingConversationId !== null}
                              title="Delete this conversation"
                              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-red-50 hover:text-red-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {deletingConversationId === conversation.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {/* Messages Feed — only this scrolls */}
                <div
                  className={`${showHistory ? 'hidden' : 'flex-1'} overflow-y-auto bg-[radial-gradient(circle_at_top_right,color-mix(in_srgb,var(--primary-color)_4%,transparent),transparent_22rem)] px-4 py-5 sm:px-6`}
                  ref={chatScrollRef}
                  onScroll={(event) => {
                    const element = event.currentTarget;
                    shouldFollowStreamRef.current =
                      element.scrollHeight - element.scrollTop - element.clientHeight < 120;
                  }}
                >
                  <div className="flex flex-col gap-5">
                    {isHistoryLoading && (
                      <div className="space-y-3" aria-label="Loading assistant history">
                        <div className="ml-auto h-12 w-2/3 animate-pulse rounded-2xl bg-slate-200/70" />
                        <div className="h-24 w-5/6 animate-pulse rounded-2xl bg-white " />
                      </div>
                    )}
                    {chatMessages.filter((m) => m.sender === 'user').length === 0 ? (
                      <div className="flex flex-col items-center justify-center min-h-96 py-8 px-4 text-center">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary border border-primary-200/70 mb-4">
                          <Bot className="h-6 w-6" />
                        </div>
                        <h2 className="text-lg font-bold text-slate-900 tracking-tight sm:text-xl">
                          How can I help you today?
                        </h2>
                        <p className="mt-1 text-xs text-slate-500 max-w-sm leading-relaxed">
                          Ask about academic setup, faculty workloads, timetables, admissions, or fees.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-6 w-full max-w-lg px-1">
                          {[
                            {
                              icon: GraduationCap,
                              label: 'Academic Hierarchy',
                              desc: 'Curriculum, departments, and batch setup order',
                              q: 'Explain the complete academic setup hierarchy step by step',
                            },
                            {
                              icon: BookOpen,
                              label: 'Faculty Workload & AICTE',
                              desc: 'Statutory 12-16h norms, duties, and approval',
                              q: 'How does faculty workload allocation and AICTE compliance work?',
                            },
                            {
                              icon: Calendar,
                              label: 'Timetable Scheduling',
                              desc: 'Classroom periods, slots, and workload checks',
                              q: 'How to create and publish clash-free timetables?',
                            },
                            {
                              icon: CreditCard,
                              label: 'Payment & Fee Settings',
                              desc: 'UPI QR codes, bank accounts, and gateways',
                              q: 'How to configure college UPI QR code and payment gateways?',
                            },
                          ].map((item, idx) => {
                            const IconComponent = item.icon;
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => handleSendMessage(item.q)}
                                className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3 text-left transition-all duration-150 ease-out hover:border-primary/40 hover:bg-slate-50 hover:shadow-2xs cursor-pointer active:scale-[0.99] group"
                              >
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors group-hover:bg-primary-50 group-hover:text-primary">
                                  <IconComponent className="h-4 w-4" />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block text-[12.5px] font-semibold text-slate-800 group-hover:text-primary">
                                    {item.label}
                                  </span>
                                  <span className="mt-0.5 block text-[11px] text-slate-500 leading-snug">
                                    {item.desc}
                                  </span>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      chatMessages
                        .filter((msg) => {
                          const hasUserMessages = chatMessages.some((m) => m.sender === 'user');
                          if (msg.id === 'welcome' && hasUserMessages) return false;
                          return true;
                        })
                        .map((msg, index, arr) => {
                          const { cleanText, suggestions: rawSuggestions } =
                            parseTextAndSuggestions(msg.text);
                          const isLastMessage = index === arr.length - 1;
                          const suggestions =
                            isLastMessage && msg.sender === 'ai' && !msg.isStreaming
                              ? rawSuggestions
                              : [];

                          return (
                            <motion.div
                              key={msg.id}
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.15, ease: 'easeOut' }}
                              className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                              {msg.sender === 'ai' && (
                                <div className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary border border-primary-200/70">
                                  <Bot className="h-4 w-4" />
                                </div>
                              )}

                              <div
                                className={`text-[13.5px] leading-relaxed ${msg.sender === 'user'
                                    ? 'max-w-[85%] rounded-2xl rounded-tr-xs bg-primary px-4 py-2.5 text-white font-normal shadow-xs'
                                    : 'w-[calc(100%-2.5rem)] max-w-[94%] rounded-2xl rounded-tl-xs border border-slate-200/90 bg-white px-4.5 py-3.5 text-slate-800 shadow-2xs'
                                  }`}
                              >
                                {msg.sender === 'ai' && (
                                  <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-1.5">
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold tracking-wide text-slate-600">
                                      <Bot className="h-3 w-3 text-primary" />
                                      ERP Assistant
                                      {msg.webSources && msg.webSources.length > 0 && (
                                        <span className="ml-1 inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-[9px] font-semibold text-blue-700">
                                          <Globe className="h-2.5 w-2.5" />
                                          Web Verified
                                        </span>
                                      )}
                                    </span>
                                    {!msg.isStreaming && (
                                      <button
                                        type="button"
                                        onClick={() => copyAssistantMessage(msg)}
                                        title="Copy response"
                                        className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[10.5px] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
                                      >
                                        {copiedMessageId === msg.id ? (
                                          <Check className="h-3 w-3 text-emerald-500" />
                                        ) : (
                                          <Copy className="h-3 w-3" />
                                        )}
                                        <span>{copiedMessageId === msg.id ? 'Copied' : 'Copy'}</span>
                                      </button>
                                    )}
                                  </div>
                                )}

                                {msg.sender === 'user' ? (
                                  <p className="whitespace-pre-wrap wrap-break-word">{msg.text}</p>
                                ) : (
                                  <div className="relative">
                                    <div className={ASSISTANT_MARKDOWN_CLASS}>
                                      <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                          a({ href, children, ...props }) {
                                            let finalHref = href || '';
                                            if (
                                              finalHref.startsWith('/') &&
                                              !finalHref.startsWith('//')
                                            ) {
                                              const segments = finalHref.split('/').filter(Boolean);
                                              const tenantId =
                                                pathname.split('/').filter(Boolean)[0] || '';
                                              if (tenantId && segments[0] === tenantId) {
                                                segments.shift();
                                              }
                                              if (role && segments[0] === role) {
                                                segments.shift();
                                              }
                                              finalHref = `/${tenantId}/${role}/${segments.join('/')}`;
                                            }
                                            return (
                                              <a
                                                href={finalHref}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                {...props}
                                              >
                                                {children}
                                              </a>
                                            );
                                          },
                                          code({ className, children, ...props }) {
                                            const lang = (className ?? '').replace('language-', '');
                                            const codeStr = String(children).replace(/\n$/, '');
                                            if (lang === 'html') {
                                              return <HtmlBlock code={codeStr} />;
                                            }
                                            const isBlock =
                                              className?.startsWith('language-') ||
                                              codeStr.includes('\n');
                                            if (isBlock) {
                                              return <CodeBlock language={lang} code={codeStr} />;
                                            }
                                            return (
                                              <code
                                                className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[12px] font-mono font-medium text-slate-800"
                                                {...props}
                                              >
                                                {children}
                                              </code>
                                            );
                                          },
                                        }}
                                      >
                                        {cleanText}
                                      </ReactMarkdown>
                                    </div>
                                    {msg.isStreaming && (
                                      <span
                                        aria-label="Assistant is responding"
                                        className="ml-1 inline-block h-3.5 w-1.5 animate-pulse rounded-full bg-primary align-middle"
                                      />
                                    )}
                                    {/* Web Search Sources */}
                                    {!msg.isStreaming &&
                                      msg.webSources &&
                                      msg.webSources.length > 0 && (
                                        <div className="mt-2.5 rounded-xl border border-blue-100 bg-blue-50/50 p-2.5">
                                          <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-600">
                                            <Globe className="h-3 w-3" />
                                            Verified Sources
                                          </p>
                                          <div className="space-y-1">
                                            {msg.webSources.map((src, i) => (
                                              <a
                                                key={i}
                                                href={src.uri}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1.5 truncate text-[11px] font-medium text-blue-700 hover:text-blue-900 hover:underline"
                                              >
                                                <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                                                {src.title || src.uri}
                                              </a>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                  </div>
                                )}

                                {msg.actionRoute && (
                                  <div className="mt-2.5 pt-2 border-t border-slate-100">
                                    <Link
                                      href={msg.actionRoute}
                                      onClick={onClose}
                                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-bold text-white hover:bg-primary-700 transition-colors"
                                    >
                                      <span>{msg.actionLabel || 'Open Module'}</span>
                                      <ExternalLink className="h-3 w-3" />
                                    </Link>
                                  </div>
                                )}

                                {suggestions.length > 0 && (
                                  <div className="mt-3 pt-2 border-t border-slate-100">
                                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                      Suggested Follow-up:
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {suggestions.map((item, idx) => (
                                        <button
                                          key={idx}
                                          type="button"
                                          onClick={() => handleSendMessage(item.q)}
                                          className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 hover:border-primary/40 hover:bg-primary-50 hover:text-primary px-2.5 py-1 text-xs text-slate-700 font-medium transition cursor-pointer active:scale-98"
                                        >
                                          <span>{item.label}</span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                <span className="mt-1 block text-right font-mono text-[9px] text-slate-400">
                                  {msg.timestamp}
                                </span>
                              </div>
                            </motion.div>
                          );
                        })
                    )}



                    {isThinking && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="ml-11 max-w-[85%] rounded-2xl rounded-bl-md border border-slate-200 bg-linear-to-br from-slate-50 to-white p-4 "
                      >
                        <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-primary">
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                          </span>
                          {assistantStatus || 'Analyzing ERP context…'}
                        </div>
                        <div className="mt-3 space-y-2" aria-hidden="true">
                          <div className="h-2.5 w-full animate-pulse rounded-full bg-slate-200/70" />
                          <div
                            className="h-2.5 w-[88%] animate-pulse rounded-full bg-slate-200/70"
                            style={{ animationDelay: '120ms' }}
                          />
                          <div
                            className="h-2.5 w-[64%] animate-pulse rounded-full bg-slate-200/70"
                            style={{ animationDelay: '240ms' }}
                          />
                        </div>
                      </motion.div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                </div>

                {/* Chat Input Bar — fixed at bottom */}
                {!showHistory && (
                  <ChatInputBar
                    onSend={handleSendMessage}
                    isThinking={isThinking}
                    onStop={() => requestAbortRef.current?.abort()}
                  />
                )}
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
