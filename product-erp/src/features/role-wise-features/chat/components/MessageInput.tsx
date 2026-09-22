/**
 * @file MessageInput.tsx
 * @description WhatsApp-style message input:
 * text, emoji picker, file/image/attachment, reply preview, typing events.
 * @module features/role-wise-features/chat/components
 */
'use client';

import React, { useState, useRef, useCallback, useEffect, KeyboardEvent } from 'react';
import dynamic from 'next/dynamic';
import { Smile, Paperclip, Send, X } from 'lucide-react';
import { Socket } from 'socket.io-client';
import { IChatMessage } from '../types/chat.types';
import useMutation from '@/shared/hooks/useMutation';
import { toast } from 'react-toastify';

// Heavy: load the emoji picker only on demand to keep first paint snappy.
const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false });

interface Props {
  conversationId: string;
  socket: Socket | null;
  replyTo: IChatMessage | null;
  onClearReply: () => void;
  onSendViaApi: (
    content: string,
    messageType?: string,
    fileUrl?: string,
    fileName?: string,
    replyTo?: string,
  ) => Promise<void>;
  disabled?: boolean;
}

function formatReplyPreview(msg: IChatMessage): string {
  if (msg.isDeleted) return 'This message was deleted';
  if (msg.messageType === 'image') return '📷 Image';
  if (msg.messageType === 'file') return `📄 ${msg.fileName ?? 'File'}`;
  if (msg.messageType === 'audio') return '🎵 Audio';
  if (msg.messageType === 'video') return '🎬 Video';
  return msg.content.slice(0, 60);
}

const getSenderName = (msg: IChatMessage): string => {
  if (typeof msg.senderId === 'object') return (msg.senderId as { name?: string }).name ?? 'User';
  return 'User';
};

export default function MessageInput({
  conversationId,
  socket,
  replyTo,
  onClearReply,
  onSendViaApi,
  disabled,
}: Props) {
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { mutation } = useMutation();
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiWrapRef = useRef<HTMLDivElement>(null);

  // Close the emoji picker when clicking outside of it.
  useEffect(() => {
    if (!showEmoji) return;
    const onDocClick = (e: MouseEvent) => {
      if (emojiWrapRef.current && !emojiWrapRef.current.contains(e.target as Node)) {
        setShowEmoji(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showEmoji]);

  const emitTypingStart = useCallback(() => {
    if (!isTyping && socket) {
      socket.emit('typing_start', { conversationId });
      setIsTyping(true);
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socket?.emit('typing_stop', { conversationId });
      setIsTyping(false);
    }, 2500);
  }, [isTyping, socket, conversationId]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    emitTypingStart();
    // auto-resize
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  const handleSend = useCallback(async () => {
    const content = text.trim();
    if (!content || disabled) return;
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    // Stop typing
    if (typingTimer.current) clearTimeout(typingTimer.current);
    socket?.emit('typing_stop', { conversationId });
    setIsTyping(false);
    // Prefer socket for real-time, fallback to API
    if (socket?.connected) {
      socket.emit('send_message', {
        conversationId,
        content,
        messageType: 'text',
        ...(replyTo ? { replyTo: replyTo._id } : {}),
      });
      onClearReply();
    } else {
      await onSendViaApi(content, 'text', undefined, undefined, replyTo?._id);
      onClearReply();
    }
  }, [text, disabled, socket, conversationId, replyTo, onSendViaApi, onClearReply]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await mutation('upload/chat', {
        method: 'POST',
        body: formData,
        isFormData: true,
      });
      const data = (
        res as
          | { results?: { success?: boolean; data?: { url?: string; filename?: string } } }
          | undefined
      )?.results;
      const fileUrl = data?.data?.url;
      const fileName = data?.data?.filename ?? file.name;
      if (!fileUrl) throw new Error('Upload failed');
      const msgType = file.type.startsWith('image/')
        ? 'image'
        : file.type.startsWith('video/')
          ? 'video'
          : file.type.startsWith('audio/')
            ? 'audio'
            : 'file';
      await onSendViaApi(fileName, msgType, fileUrl, fileName, replyTo?._id);
      onClearReply();
    } catch {
      toast.error('The attachment could not be uploaded. Please check the file and try again.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="border-t border-slate-100 bg-white p-3">
      {/* Reply preview */}
      {replyTo && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border-l-2 border-primary bg-primary-50 px-3 py-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-primary">{getSenderName(replyTo)}</p>
            <p className="truncate text-xs text-slate-500">{formatReplyPreview(replyTo)}</p>
          </div>
          <button
            type="button"
            onClick={onClearReply}
            className="text-slate-600 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Emoji picker */}
      {showEmoji && (
        <div ref={emojiWrapRef} className="relative mb-2">
          <EmojiPicker
            onEmojiClick={(emojiData) => {
              setText((t) => t + emojiData.emoji);
              textareaRef.current?.focus();
            }}
            width="100%"
            height={360}
            searchPlaceHolder="Search emojis…"
            previewConfig={{ showPreview: false }}
            skinTonesDisabled
          />
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2">
        {/* Emoji */}
        <button
          type="button"
          onClick={() => setShowEmoji((v) => !v)}
          className={`shrink-0 rounded-lg p-2 transition-colors ${showEmoji ? 'bg-primary-50 text-primary' : 'text-slate-600 hover:bg-slate-100'}`}
        >
          <Smile className="h-5 w-5" />
        </button>

        {/* File */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="shrink-0 rounded-lg p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          title="Attach file"
        >
          {uploading ? (
            <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          ) : (
            <Paperclip className="h-5 w-5" />
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
          onChange={handleFileSelect}
        />

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
          style={{ maxHeight: 120 }}
        />

        {/* Send */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!text.trim() || disabled}
          className="shrink-0 flex h-9.5 w-9.5 items-center justify-center rounded-xl bg-primary text-white transition-colors hover:bg-primary/90 disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
