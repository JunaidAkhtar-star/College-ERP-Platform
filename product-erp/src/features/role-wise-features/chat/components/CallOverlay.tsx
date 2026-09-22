/* eslint-disable @next/next/no-img-element */
/**
 * @file CallOverlay.tsx
 * @description Agora-powered video & voice calling overlay with global state, screen sharing,
 * minimization (PiP corner preview), camera/microphone toggling, and Teams-style ringing.
 * @module features/role-wise-features/chat/components
 */
'use client';

import React, { useEffect, useCallback, useState, useMemo, memo } from 'react';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Volume2,
  PhoneIncoming,
  MonitorUp,
  Minimize2,
} from 'lucide-react';
import { useCallStore } from '@/shared/store/callStore';
import AgoraRTC, {
  AgoraRTCProvider,
  LocalVideoTrack,
  RemoteVideoTrack,
  useJoin,
  useLocalMicrophoneTrack,
  useLocalCameraTrack,
  usePublish,
  useRemoteUsers,
  useRemoteVideoTracks,
  useRemoteAudioTracks,
} from 'agora-rtc-react';
import useMutation from '@/shared/hooks/useMutation';
import { useCallRingtone } from '../hooks/useCallRingtone';

// ── Singleton Agora Client ────────────────────────────────────────────────────
const agoraClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

interface CallOverlayProps {
  onAccept: () => void;
  onReject: () => void;
  onHangUp: () => void;
  onAcceptWaiting?: () => void;
  onRejectWaiting?: () => void;
  onMergeWaiting?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Call Controls Component
// ─────────────────────────────────────────────────────────────────────────────
const CallControls = memo(function CallControls({
  isVideo,
  isMuted,
  isCamOff,
  isScreenSharing,
  onToggleMute,
  onToggleCam,
  onToggleScreenShare,
  onMinimize,
  onHangUp,
}: {
  isVideo: boolean;
  isMuted: boolean;
  isCamOff: boolean;
  isScreenSharing: boolean;
  onToggleMute: () => void;
  onToggleCam: () => void;
  onToggleScreenShare: () => void;
  onMinimize: () => void;
  onHangUp: () => void;
}) {
  return (
    <div className="bg-slate-200/80 backdrop-blur-xl border-t border-slate-300 px-8 py-6 flex items-center justify-center gap-6">
      {/* Minimize */}
      <button
        type="button"
        onClick={onMinimize}
        title="Minimize Call"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-slate-900 hover:bg-white/20 transition-all"
      >
        <Minimize2 className="h-5 w-5" />
      </button>

      {/* Mute Microphone */}
      <button
        type="button"
        onClick={onToggleMute}
        title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        className={`flex h-14 w-14 items-center justify-center rounded-full transition-all duration-200 ${
          isMuted
            ? 'bg-red-500/25 text-red-400 ring-2 ring-red-500/40 hover:bg-red-500/35'
            : 'bg-white/15 text-slate-900 hover:bg-white/25'
        }`}
      >
        {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
      </button>

      {/* Hang Up */}
      <button
        type="button"
        onClick={onHangUp}
        title="End call"
        className="flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-red-500 to-rose-600 text-slate-900   transition-transform hover:scale-110 active:scale-95"
      >
        <PhoneOff className="h-7 w-7" />
      </button>

      {/* Camera Toggle (video only) */}
      {isVideo && (
        <button
          type="button"
          onClick={onToggleCam}
          title={isCamOff ? 'Turn camera on' : 'Turn camera off'}
          className={`flex h-14 w-14 items-center justify-center rounded-full transition-all duration-200 ${
            isCamOff
              ? 'bg-red-500/25 text-red-400 ring-2 ring-red-500/40 hover:bg-red-500/35'
              : 'bg-white/15 text-slate-900 hover:bg-white/25'
          }`}
        >
          {isCamOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
        </button>
      )}

      {/* Screen Share (video only) */}
      {isVideo && (
        <button
          type="button"
          onClick={onToggleScreenShare}
          title={isScreenSharing ? 'Stop screen sharing' : 'Share screen'}
          className={`flex h-14 w-14 items-center justify-center rounded-full transition-all duration-200 ${
            isScreenSharing
              ? 'bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-500/40 hover:bg-emerald-500/35'
              : 'bg-white/15 text-slate-900 hover:bg-white/25'
          }`}
        >
          <MonitorUp className="h-5 w-5" />
        </button>
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Active Call View (Agora integration)
// ─────────────────────────────────────────────────────────────────────────────
const AgoraCallView = memo(function AgoraCallView({
  channelId,
  callType,
  callerName,
  callerAvatar,
  onHangUp,
  onAcceptWaiting,
  onRejectWaiting,
  onMergeWaiting,
}: {
  channelId: string;
  callType: 'audio' | 'video';
  callerName: string;
  callerAvatar?: string;
  onHangUp: () => void;
  onAcceptWaiting?: () => void;
  onRejectWaiting?: () => void;
  onMergeWaiting?: () => void;
}) {
  const { mutation } = useMutation();
  const [token, setToken] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  // Screen sharing state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [screenTrack, setScreenTrack] = useState<any>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const isVideo = useMemo(() => callType === 'video', [callType]);
  const appId = useMemo(() => process.env.NEXT_PUBLIC_AGORA_APP_ID ?? '', []);

  const { callState, setCallState } = useCallStore();

  // ── Sync Call Start Time with global store ─────────────────────────────────
  useEffect(() => {
    if (!callState.callStartTime) {
      setCallState({ callStartTime: Date.now() });
    }
  }, [callState.callStartTime, setCallState]);

  // Call duration calculations
  useEffect(() => {
    let timerId: NodeJS.Timeout | undefined;
    if (callState.callStartTime) {
      timerId = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - (callState.callStartTime ?? Date.now())) / 1000));
      }, 1000);
    } else {
      timerId = setInterval(() => setCallDuration((d) => d + 1), 1000);
    }
    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [callState.callStartTime]);

  const formattedDuration = useMemo(() => {
    const mins = Math.floor(callDuration / 60);
    const secs = callDuration % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, [callDuration]);

  // Fetch secure token
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const response = await mutation(`chat/call/token?channelName=${channelId}`, {
          method: 'GET',
          silentError: true,
        });
        const json = response?.results as { success?: boolean; token?: string } | undefined;
        if (json?.success && json.token) setToken(json.token);
      } catch (e) {
        console.error('Failed to fetch Agora token:', e);
      }
    };
    fetchToken();
  }, [channelId, mutation]);

  // Agora Hooks
  useJoin({ appid: appId, channel: channelId, token }, !!token);

  const { localMicrophoneTrack } = useLocalMicrophoneTrack(!isMuted);
  const { localCameraTrack } = useLocalCameraTrack(isVideo && !isCamOff && !isScreenSharing);

  // Hardware mute enforcement
  useEffect(() => {
    if (localMicrophoneTrack) {
      localMicrophoneTrack.setEnabled(!isMuted);
      localMicrophoneTrack.setMuted(isMuted);
    }
  }, [localMicrophoneTrack, isMuted]);

  useEffect(() => {
    if (localCameraTrack) {
      localCameraTrack.setEnabled(isVideo && !isCamOff && !isScreenSharing);
      localCameraTrack.setMuted(isCamOff || isScreenSharing);
    }
  }, [localCameraTrack, isVideo, isCamOff, isScreenSharing]);

  // Screen share handler
  const handleToggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      if (screenTrack) {
        screenTrack.close();
        setScreenTrack(null);
      }
      setIsScreenSharing(false);
    } else {
      try {
        const result = await AgoraRTC.createScreenVideoTrack({ encoderConfig: '1080p_1' }, 'auto');
        const vTrack = Array.isArray(result) ? result[0] : result;
        const aTrack = Array.isArray(result) ? result[1] : null;

        vTrack.on('track-ended', () => {
          vTrack.close();
          if (aTrack) aTrack.close();
          setScreenTrack(null);
          setIsScreenSharing(false);
          setCallState({ isMinimized: false });
        });

        setScreenTrack(vTrack);
        setIsScreenSharing(true);
        setCallState({ isMinimized: true });
      } catch (e) {
        console.error('Failed to start screen share:', e);
      }
    }
  }, [isScreenSharing, screenTrack, setCallState]);

  const tracksToPublish = useMemo(() => {
    const list = [];
    if (localMicrophoneTrack) list.push(localMicrophoneTrack);
    if (isScreenSharing && screenTrack) {
      list.push(screenTrack);
    } else if (isVideo && localCameraTrack && !isCamOff) {
      list.push(localCameraTrack);
    }
    return list;
  }, [localMicrophoneTrack, isScreenSharing, screenTrack, isVideo, localCameraTrack, isCamOff]);

  usePublish(tracksToPublish);

  // Cleanup local tracks
  useEffect(() => {
    return () => {
      localMicrophoneTrack?.close();
      localCameraTrack?.close();
      if (screenTrack) screenTrack.close();
    };
  }, [localMicrophoneTrack, localCameraTrack, screenTrack]);

  // Remote Users
  const remoteUsers = useRemoteUsers();
  const { videoTracks: remoteVideoTracks } = useRemoteVideoTracks(remoteUsers);
  const { audioTracks: remoteAudioTracks } = useRemoteAudioTracks(remoteUsers);

  // Play remote audio
  useEffect(() => {
    remoteAudioTracks.forEach((track) => track.play());
  }, [remoteAudioTracks]);

  const remoteVideoTrack = remoteVideoTracks[0] ?? null;

  // ── Render Minimized State (Floating Preview Box) ──────────────────────────
  if (callState.isMinimized) {
    if (!isVideo) return null; // Audio calls do not need a floating preview widget when minimized.
    return (
      <div
        onClick={() => setCallState({ isMinimized: false })}
        title="Maximize Call Window"
        className="fixed bottom-20 right-4 z-9999 h-52 w-36 cursor-pointer rounded-2xl overflow-hidden border border-slate-300 bg-slate-200/80  transition-transform hover:scale-105 hover:border-emerald-500/40 flex flex-col"
      >
        <div className="relative flex-1 bg-slate-200/80 flex items-center justify-center">
          {isVideo && (remoteVideoTrack || (localCameraTrack && !isCamOff)) ? (
            <div className="w-full h-full">
              {remoteVideoTrack ? (
                <RemoteVideoTrack
                  track={remoteVideoTrack}
                  className="w-full h-full object-cover"
                  play
                />
              ) : (
                localCameraTrack && (
                  <LocalVideoTrack
                    track={localCameraTrack}
                    className="w-full h-full object-cover scale-x-[-1]"
                    play
                  />
                )
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-2 text-center">
              {callerAvatar ? (
                <img
                  src={callerAvatar}
                  className="h-14 w-14 rounded-full border border-slate-300"
                  alt=""
                />
              ) : (
                <div className="h-14 w-14 rounded-full bg-white/10 flex items-center justify-center text-lg font-bold uppercase">
                  {callerName.charAt(0)}
                </div>
              )}
              <span className="text-[10px] text-slate-600 mt-2 font-medium truncate max-w-30">
                {callerName}
              </span>
            </div>
          )}

          {/* Duration overlay */}
          <div className="absolute top-2 right-2 bg-slate-200/80 backdrop-blur-md px-1.5 py-0.5 rounded text-[9px] font-mono text-emerald-400">
            {formattedDuration}
          </div>

          {/* Type Icon overlay */}
          <div className="absolute bottom-2 left-2 bg-emerald-500 p-1.5 rounded-full  text-slate-900">
            {isVideo ? <Video className="h-3.5 w-3.5" /> : <Phone className="h-3.5 w-3.5" />}
          </div>
        </div>
      </div>
    );
  }

  // ── Render Full Screen Call View ───────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-linear-to-b from-slate-900 via-slate-950 to-black text-slate-900"
    >
      {/* ── WhatsApp-style Call Waiting Overlay ── */}
      {callState.waitingCall && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-999 w-full max-w-sm px-4">
          <div className="bg-slate-800/95 backdrop-blur-2xl border border-slate-300 rounded-3xl p-5  flex flex-col gap-4 text-center">
            <div className="flex items-center gap-3 text-left">
              {callState.waitingCall.callerAvatar ? (
                <img
                  src={callState.waitingCall.callerAvatar}
                  alt={callState.waitingCall.callerName}
                  className="h-12 w-12 rounded-full object-cover border border-slate-300"
                />
              ) : (
                <div className="h-12 w-12 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-lg uppercase">
                  {callState.waitingCall.callerName.charAt(0)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate text-slate-900">
                  {callState.waitingCall.callerName}
                </p>
                <p className="text-xs text-slate-600">
                  Incoming {callState.waitingCall.type === 'video' ? 'Video' : 'Voice'} Call
                  waiting...
                </p>
              </div>
            </div>

            <div className="flex justify-between items-center gap-2 text-xs font-semibold">
              <button
                type="button"
                onClick={onRejectWaiting}
                className="flex-1 py-2 px-1 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors border border-red-500/30"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={onAcceptWaiting}
                className="flex-1 py-2 px-1 rounded-xl bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors border border-amber-500/30"
              >
                End & Accept
              </button>
              <button
                type="button"
                onClick={onMergeWaiting}
                className="flex-1 py-2 px-1 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors border border-emerald-500/30"
              >
                Merge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Video / Audio Area ─────────────────────────────────────────── */}
      <div className="relative flex-1 overflow-hidden">
        {isVideo ? (
          <>
            {/* Remote video — full screen grid */}
            <div className="absolute inset-0 bg-slate-200/80 flex items-center justify-center">
              {remoteVideoTracks.length > 0 ? (
                <div
                  className={`w-full h-full grid gap-2 p-2 ${
                    remoteVideoTracks.length === 1
                      ? 'grid-cols-1'
                      : remoteVideoTracks.length === 2
                        ? 'grid-cols-1 md:grid-cols-2'
                        : 'grid-cols-2'
                  }`}
                >
                  {remoteVideoTracks.map((track) => (
                    <div
                      key={track.getTrackId()}
                      className="relative w-full h-full rounded-2xl overflow-hidden bg-slate-800 border border-slate-300"
                    >
                      <RemoteVideoTrack track={track} className="w-full h-full object-cover" play />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  {callerAvatar ? (
                    <img
                      src={callerAvatar}
                      alt={callerName}
                      className="h-28 w-28 rounded-full object-cover border-4 border-slate-300 opacity-60 blur-sm"
                    />
                  ) : (
                    <div className="h-28 w-28 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-4xl font-bold uppercase">
                      {callerName.charAt(0)}
                    </div>
                  )}
                  <Video className="h-10 w-10 text-blue-400 animate-pulse" />
                  <p className="text-slate-600 text-sm font-medium">Waiting for remote stream…</p>
                </div>
              )}
            </div>

            {/* Local video — PiP corner */}
            {((localCameraTrack && !isCamOff && !isScreenSharing) ||
              (isScreenSharing && screenTrack)) && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="absolute top-4 right-4 w-32 h-44 rounded-2xl overflow-hidden border-2 border-slate-300  z-10 bg-slate-800"
              >
                {isScreenSharing && screenTrack ? (
                  <LocalVideoTrack
                    track={screenTrack}
                    className="w-full h-full object-cover"
                    play
                  />
                ) : (
                  localCameraTrack && (
                    <LocalVideoTrack
                      track={localCameraTrack}
                      className="w-full h-full object-cover scale-x-[-1]"
                      play
                    />
                  )
                )}
              </motion.div>
            )}

            {/* Status overlay */}
            <div className="absolute bottom-28 left-0 right-0 flex justify-center gap-3">
              <span className="bg-slate-200/80 backdrop-blur-md text-slate-900 text-sm font-semibold px-4 py-1.5 rounded-full">
                {callerName} {isScreenSharing ? '(Screen Sharing)' : ''}
              </span>
              <span className="bg-slate-200/80 backdrop-blur-md text-emerald-400 text-sm font-mono px-3 py-1.5 rounded-full">
                {formattedDuration}
              </span>
            </div>
          </>
        ) : (
          /* ── Voice Call screen ─────────────────────────────────────────── */
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="relative">
              {callerAvatar ? (
                <img
                  src={callerAvatar}
                  alt={callerName}
                  className="h-36 w-36 rounded-full object-cover border-4 border-slate-300 "
                />
              ) : (
                <div className="h-36 w-36 rounded-full bg-linear-to-br from-emerald-500/30 to-blue-500/30 backdrop-blur-sm border-4 border-slate-300 flex items-center justify-center text-5xl font-bold uppercase ">
                  {callerName.charAt(0)}
                </div>
              )}
              <span className="absolute inset-0 rounded-full border-2 border-emerald-500 animate-ping opacity-40" />
              <span className="absolute -inset-3 rounded-full border border-emerald-500/20 animate-pulse" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">{callerName}</h2>
            <div className="flex items-center gap-3">
              <p className="flex items-center gap-2 text-sm text-emerald-400 font-medium">
                <Volume2 className="h-4 w-4 animate-bounce" />
                Voice Call
              </p>
              <span className="text-emerald-400/60 text-sm font-mono">{formattedDuration}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Control Bar ──────────────────────────────────────────────── */}
      <CallControls
        isVideo={isVideo}
        isMuted={isMuted}
        isCamOff={isCamOff}
        isScreenSharing={isScreenSharing}
        onToggleMute={() => setIsMuted((v) => !v)}
        onToggleCam={() => setIsCamOff((v) => !v)}
        onToggleScreenShare={handleToggleScreenShare}
        onMinimize={() => setCallState({ isMinimized: true })}
        onHangUp={onHangUp}
      />
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Shared Avatar component
// ─────────────────────────────────────────────────────────────────────────────
function CallerAvatar({
  name,
  avatar,
  size = 'lg',
}: {
  name: string;
  avatar?: string;
  size?: 'sm' | 'lg';
}) {
  const dim = size === 'lg' ? 'h-28 w-28' : 'h-24 w-24';
  const textSize = size === 'lg' ? 'text-4xl' : 'text-3xl';
  return avatar ? (
    <img
      src={avatar}
      alt={name}
      className={`${dim} rounded-full object-cover border-4 border-slate-300 `}
    />
  ) : (
    <div
      className={`${dim} rounded-full bg-linear-to-br from-blue-500/30 to-purple-500/30 backdrop-blur-sm border-4 border-slate-300 flex items-center justify-center ${textSize} font-bold text-slate-900 uppercase `}
    >
      {name.charAt(0)}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main CallOverlay Component
// ─────────────────────────────────────────────────────────────────────────────
export default function CallOverlay({
  onAccept,
  onReject,
  onHangUp,
  onAcceptWaiting,
  onRejectWaiting,
  onMergeWaiting,
}: CallOverlayProps) {
  const { callState } = useCallStore();

  const name = callState.callerName ?? 'Someone';
  const avatar = callState.callerAvatar;
  const isVideo = callState.type === 'video';

  // Teams-style Ringtone
  const shouldRing = callState.isIncoming && !callState.isActive;
  useCallRingtone(shouldRing);

  // 1. Incoming Call Dialog
  if (callState.isIncoming && !callState.isActive) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-9999 flex items-center justify-center bg-slate-200/80 backdrop-blur-xl p-4"
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="w-full max-w-sm rounded-3xl bg-linear-to-b from-slate-800/90 to-slate-900/95 backdrop-blur-2xl p-8 text-center  border border-slate-300"
          >
            <div className="relative mx-auto mb-6 h-28 w-28">
              <CallerAvatar name={name} avatar={avatar} size="lg" />
              <span className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping opacity-50" />
              <span className="absolute -inset-2 rounded-full border border-emerald-400/30 animate-pulse" />
              <span
                className="absolute -inset-4 rounded-full border border-emerald-400/15 animate-pulse"
                style={{ animationDelay: '0.5s' }}
              />
            </div>

            <h3 className="text-xl font-bold text-slate-900">{name}</h3>
            <p className="mt-1.5 flex items-center justify-center gap-2 text-sm text-slate-600">
              <PhoneIncoming className="h-4 w-4 text-emerald-400 animate-bounce" />
              Incoming {isVideo ? 'Video' : 'Voice'} Call…
            </p>

            <div className="mt-8 flex justify-center gap-10">
              {/* Decline */}
              <div className="flex flex-col items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  type="button"
                  onClick={onReject}
                  aria-label="Decline"
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-red-500 to-rose-600 text-slate-900  "
                >
                  <PhoneOff className="h-6 w-6" />
                </motion.button>
                <span className="text-xs text-slate-600 font-medium">Decline</span>
              </div>

              {/* Accept */}
              <div className="flex flex-col items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  type="button"
                  onClick={onAccept}
                  aria-label="Accept"
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-emerald-500 to-green-600 text-slate-900  "
                >
                  <Phone className="h-6 w-6" />
                </motion.button>
                <span className="text-xs text-slate-600 font-medium">Accept</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // 2. Outgoing Ringing State
  if (
    !callState.isIncoming &&
    !callState.isActive &&
    (callState.targetUserId || callState.callerId)
  ) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-9999 flex items-center justify-center bg-slate-200/80 backdrop-blur-xl p-4"
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="w-full max-w-sm rounded-3xl bg-linear-to-b from-slate-800/90 to-slate-900/95 backdrop-blur-2xl p-8 text-center  border border-slate-300"
          >
            <div className="relative mx-auto mb-6 h-28 w-28">
              <CallerAvatar name={name} avatar={avatar} size="lg" />
              <span className="absolute inset-0 rounded-full border border-blue-400/40 animate-pulse" />
              <span
                className="absolute -inset-3 rounded-full border border-blue-400/20 animate-pulse"
                style={{ animationDelay: '0.3s' }}
              />
            </div>

            <h3 className="text-xl font-bold text-slate-900">{name}</h3>
            <p className="mt-1.5 text-sm text-slate-600">
              {callState.isCallWaiting
                ? 'Waiting... (User is on another call)'
                : `Calling${isVideo ? ' (Video)' : ''}…`}
            </p>

            <div className="mt-3 flex justify-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.3 }}
                  className="h-2 w-2 rounded-full bg-blue-400"
                />
              ))}
            </div>

            <div className="mt-8 flex flex-col items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={onHangUp}
                aria-label="Cancel Call"
                className="flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-red-500 to-rose-600 text-slate-900  "
              >
                <PhoneOff className="h-6 w-6" />
              </motion.button>
              <span className="text-xs text-slate-600 font-medium">Cancel</span>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // 3. Active Call
  if (callState.isActive && callState.conversationId) {
    return (
      <AgoraRTCProvider client={agoraClient}>
        <AgoraCallView
          channelId={callState.conversationId}
          callType={callState.type ?? 'audio'}
          callerName={name}
          callerAvatar={avatar}
          onHangUp={onHangUp}
          onAcceptWaiting={onAcceptWaiting}
          onRejectWaiting={onRejectWaiting}
          onMergeWaiting={onMergeWaiting}
        />
      </AgoraRTCProvider>
    );
  }

  return null;
}
