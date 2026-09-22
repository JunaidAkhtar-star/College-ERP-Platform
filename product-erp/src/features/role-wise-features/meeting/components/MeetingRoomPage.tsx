'use client';

import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from 'nextjs-toploader/app';
import { useAuthStore } from '@/shared/store/authStore';
import { useSocket } from '@/shared/hooks/useSocket';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  PhoneOff,
  Volume2,
  Clock,
  Pin,
  PinOff,
  MessageSquare,
  Send,
  X,
  Shield,
  VolumeX,
  Circle,
  Square,
  Hand,
  Smile,
  Lock,
  LockOpen,
  UserX,
  UserPlus,
  Users,
  MonitorX,
  MoreVertical,
  ChevronDown,
  Info,
} from 'lucide-react';
import AgoraRTC, {
  AgoraRTCProvider,
  LocalVideoTrack,
  RemoteVideoTrack,
  useJoin,
  usePublish,
  useRemoteUsers,
  useRemoteVideoTracks,
  useRemoteAudioTracks,
} from 'agora-rtc-react';
import useSwr from '@/shared/hooks/useSwr';
import { toast } from 'react-toastify';
import useMutation from '@/shared/hooks/useMutation';
import { getTenantRolePath } from '@/shared/utils';

interface IRecordingSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  publicId: string;
  signature: string;
  deliveryType?: string;
}

const agoraClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

interface IMeeting {
  _id: string;
  meetingCode?: string;
  title: string;
  scheduledAt: string;
  durationMinutes?: number;
  durationSpecified?: boolean;
  status: string;
  startedAt?: string;
  endedAt?: string;
  updatedAt?: string;
  meetingLink?: string;
  agenda?: string;
  conductedBy: string;
  createdBy: string;
  isLocked?: boolean;
  allowParticipantScreenShare?: boolean;
  coHostIds?: string[];
}

function playMeetingChime(kind: 'entered' | 'participant' | 'left') {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const frequencies =
      kind === 'entered'
        ? [392, 493.88, 587.33]
        : kind === 'participant'
          ? [523.25, 659.25]
          : [493.88, 392];
    frequencies.forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const beginsAt = ctx.currentTime + index * 0.11;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, beginsAt);
      gain.gain.setValueAtTime(0.0001, beginsAt);
      gain.gain.exponentialRampToValueAtTime(0.1, beginsAt + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, beginsAt + 0.22);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(beginsAt);
      oscillator.stop(beginsAt + 0.24);
    });
    window.setTimeout(() => void ctx.close(), frequencies.length * 110 + 350);
  } catch {
    // Sound is an enhancement; browser audio restrictions must never block the meeting.
  }
}

function getStableColor(str: string) {
  const colors = [
    'bg-red-100 text-red-600 border-red-200',
    'bg-blue-100 text-blue-600 border-blue-200',
    'bg-emerald-100 text-emerald-600 border-emerald-200',
    'bg-amber-100 text-amber-700 border-amber-200',
    'bg-violet-100 text-violet-600 border-violet-200',
    'bg-pink-100 text-pink-600 border-pink-200',
    'bg-cyan-100 text-cyan-700 border-cyan-200',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

function formatLiveDuration(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function getDisplayMeetingCode(meeting: IMeeting | undefined, fallbackId: string) {
  if (meeting?.meetingCode) return meeting.meetingCode;
  const alphabet = 'abcdefghjkmnpqrstuvwxyz';
  const source = fallbackId || 'institution';
  const value = Array.from({ length: 10 }, (_, index) => {
    const character = source.charCodeAt(index % source.length);
    return alphabet[(character + index * 7) % alphabet.length];
  }).join('');
  return `${value.slice(0, 3)}-${value.slice(3, 7)}-${value.slice(7)}`;
}

function DeviceSelect({
  icon,
  label,
  value,
  onChange,
  devices,
  emptyLabel,
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  devices: MediaDeviceInfo[];
  emptyLabel: string;
  disabled?: boolean;
}) {
  return (
    <label className="relative flex min-w-0 items-center rounded-full border border-slate-300 bg-white transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
      <span className="pointer-events-none ml-4 shrink-0 text-slate-600">{icon}</span>
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="h-11 min-w-0 flex-1 appearance-none truncate bg-transparent py-2 pl-2 pr-8 text-sm font-medium text-slate-700 outline-none disabled:cursor-not-allowed disabled:text-slate-400"
      >
        {devices.map((device) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label || `${label} ${device.deviceId.slice(0, 5)}`}
          </option>
        ))}
        {devices.length === 0 && <option value="">{emptyLabel}</option>}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-slate-500" />
    </label>
  );
}

function MeetingRoomContent() {
  const params = useParams();
  const router = useRouter();
  const meetingId = (params?.id as string) ?? '';
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const { socket } = useSocket();
  const { mutation } = useMutation();

  const { data: meetingDetailRaw, mutate: refreshMeeting } = useSwr<{ data?: IMeeting }>(
    meetingId ? `meeting/${meetingId}` : null,
  );
  const meeting = meetingDetailRaw?.data;
  const { data: messageHistory } = useSwr<{
    data?: { _id: string; userId: string; userName: string; content: string; createdAt: string }[];
  }>(meetingId ? `meeting/${meetingId}/messages` : null);

  // Derive if current user is the host
  const isHost = useMemo(() => {
    if (!meeting || !user) return false;
    const conductedById =
      typeof meeting.conductedBy === 'object' && meeting.conductedBy !== null
        ? String((meeting.conductedBy as { _id?: string })._id || '')
        : String(meeting.conductedBy || '');
    const createdById =
      typeof meeting.createdBy === 'object' && meeting.createdBy !== null
        ? String((meeting.createdBy as { _id?: string })._id || '')
        : String(meeting.createdBy || '');
    const currentUserId = String(user._id);

    return (
      conductedById === currentUserId ||
      createdById === currentUserId ||
      (meeting.coHostIds ?? []).map(String).includes(currentUserId)
    );
  }, [meeting, user]);

  const [clockNow, setClockNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const joinAvailability = useMemo(() => {
    if (!meeting?.scheduledAt) return { allowed: false, message: 'Loading meeting schedule…' };
    if (meeting.status === 'cancelled')
      return { allowed: false, message: 'This meeting was cancelled.' };
    if (meeting.status === 'completed')
      return { allowed: false, message: 'This meeting has ended.' };
    if (meeting.status === 'ongoing') return { allowed: true, message: 'Meeting is live' };
    const startsAt = new Date(meeting.scheduledAt).getTime();
    const endsAt = startsAt + Number(meeting.durationMinutes || 60) * 60_000;
    const opensAt = startsAt - 10 * 60_000;
    if (clockNow < opensAt) {
      const minutes = Math.ceil((opensAt - clockNow) / 60_000);
      return { allowed: false, message: `Join opens in ${minutes} min` };
    }
    if (clockNow > endsAt)
      return { allowed: false, message: 'The scheduled meeting time has ended.' };
    if (clockNow < startsAt) {
      return {
        allowed: true,
        message: `Starts in ${Math.ceil((startsAt - clockNow) / 60_000)} min`,
      };
    }
    const remainingMinutes = Math.max(0, Math.ceil((endsAt - clockNow) / 60_000));
    return { allowed: true, message: `Live · ${remainingMinutes} min remaining` };
  }, [clockNow, meeting]);
  const liveTiming = useMemo(() => {
    if (!meeting || meeting.status !== 'ongoing') return null;
    const startedAt = new Date(
      meeting.startedAt || meeting.updatedAt || meeting.scheduledAt,
    ).getTime();
    const elapsed = Math.max(0, clockNow - startedAt);
    const hasDuration =
      meeting.durationSpecified === true ||
      (meeting.durationSpecified === undefined && meeting.durationMinutes !== 60);
    if (!hasDuration || !meeting.durationMinutes) {
      return {
        elapsed: formatLiveDuration(elapsed),
        remaining: null,
        overtime: null,
        isOvertime: false,
        progress: null,
      };
    }
    const plannedDuration = Math.max(1, Number(meeting.durationMinutes)) * 60_000;
    const remaining = Math.max(0, plannedDuration - elapsed);
    const overtime = Math.max(0, elapsed - plannedDuration);
    return {
      elapsed: formatLiveDuration(elapsed),
      remaining: formatLiveDuration(remaining),
      overtime: formatLiveDuration(overtime),
      isOvertime: overtime > 0,
      progress: Math.min(100, (elapsed / plannedDuration) * 100),
    };
  }, [clockNow, meeting]);

  const [timeLeftStr, setTimeLeftStr] = useState<string>('');
  const [isEndingSoon, setIsEndingSoon] = useState(false);

  useEffect(() => {
    if (
      !meeting ||
      meeting.status === 'ongoing' ||
      !meeting.durationMinutes ||
      !meeting.scheduledAt
    )
      return;

    const timer = setInterval(() => {
      const scheduledTime = new Date(meeting.scheduledAt).getTime();
      const endTime = scheduledTime + meeting.durationMinutes! * 60 * 1000;
      const now = Date.now();
      const remainingMs = endTime - now;

      if (remainingMs <= 0) {
        clearInterval(timer);
        toast.info('Meeting time limit reached. Leaving meeting.');
        router.push(getTenantRolePath(role ?? '', '/meeting'));
        return;
      }

      const tenMinsMs = 10 * 60 * 1000;
      if (remainingMs <= tenMinsMs) {
        setIsEndingSoon(true);
        const mins = Math.floor(remainingMs / 60000);
        const secs = Math.floor((remainingMs % 60000) / 1000);
        setTimeLeftStr(`${mins}:${String(secs).padStart(2, '0')}`);
      } else {
        setIsEndingSoon(false);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [meeting, router, role]);

  const [joined, setJoined] = useState(false);
  const [callExitState, setCallExitState] = useState<'left' | 'ended' | null>(null);
  const [participantDetails, setParticipantDetails] = useState<
    Record<string, { userName: string; avatar?: string }>
  >({});
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSavingRecording, setIsSavingRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef(0);
  const recordingFinalizePromiseRef = useRef<Promise<void> | null>(null);
  const recordingFinalizeResolveRef = useRef<(() => void) | null>(null);
  const finalizeRecordingRef = useRef<() => Promise<void>>(async () => undefined);

  // Lobby states
  const [isWaitingInLobby, setIsWaitingInLobby] = useState(false);
  const [lobbyQueue, setLobbyQueue] = useState<
    { socketId: string; userId: string; userName: string }[]
  >([]);

  // Pin & Chat States
  const [pinnedUid, setPinnedUid] = useState<string | number | null>(null);
  const [liveChatMessages, setLiveChatMessages] = useState<
    { userId: string; userName: string; content: string; timestamp: number }[]
  >([]);
  const [activePanel, setActivePanel] = useState<'people' | 'chat' | 'details' | null>(null);
  const [showMoreControls, setShowMoreControls] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [handRaised, setHandRaised] = useState(false);
  const [raisedHands, setRaisedHands] = useState<Record<string, string>>({});
  const [reaction, setReaction] = useState<{ emoji: string; name: string } | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const chatMessages = useMemo(
    () => [
      ...(messageHistory?.data ?? []).map((message) => ({
        userId: message.userId,
        userName: message.userName,
        content: message.content,
        timestamp: new Date(message.createdAt).getTime(),
      })),
      ...liveChatMessages,
    ],
    [messageHistory, liveChatMessages],
  );

  // Device options
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([]);
  const [selectedCam, setSelectedCam] = useState('');
  const [selectedMic, setSelectedMic] = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState('');
  const [devicesReady, setDevicesReady] = useState(false);

  // Speaker levels & active speaker detection
  const [volumes, setVolumes] = useState<Record<string, number>>({});
  const [micLevel, setMicLevel] = useState(0);

  // Local tracks are owned here instead of the Agora React convenience hooks. Those hooks retain
  // an allocated MediaStreamTrack when their enabled flag becomes false, which leaves the browser's
  // camera/microphone privacy indicator active even though the UI says the device is off.
  const [localMicrophoneTrack, setLocalMicrophoneTrack] = useState<
    Awaited<ReturnType<typeof AgoraRTC.createMicrophoneAudioTrack>> | undefined
  >();
  const [localCameraTrack, setLocalCameraTrack] = useState<
    Awaited<ReturnType<typeof AgoraRTC.createCameraVideoTrack>> | undefined
  >();
  const [micError, setMicError] = useState<unknown>(null);
  const [camError, setCamError] = useState<unknown>(null);
  const microphoneTrackRef = useRef(localMicrophoneTrack);
  const cameraTrackRef = useRef(localCameraTrack);

  useEffect(() => {
    let cancelled = false;
    let createdTrack: Awaited<ReturnType<typeof AgoraRTC.createMicrophoneAudioTrack>> | undefined;

    if (!micOn || !joinAvailability.allowed || !devicesReady || callExitState) {
      queueMicrotask(() => {
        if (!cancelled) {
          setLocalMicrophoneTrack(undefined);
          setMicLevel(0);
        }
      });
      return () => {
        cancelled = true;
      };
    }

    if (microphones.length === 0) {
      queueMicrotask(() => {
        if (!cancelled) {
          setMicOn(false);
          setMicError(new Error('No microphone detected'));
        }
      });
      return () => {
        cancelled = true;
      };
    }

    void navigator.mediaDevices
      .getUserMedia({
        audio: selectedMic ? { deviceId: { exact: selectedMic } } : true,
        video: false,
      })
      .then((stream) => {
        stream.getTracks().forEach((track) => track.stop());
        if (cancelled) return undefined;
        return AgoraRTC.createMicrophoneAudioTrack(
          selectedMic ? { microphoneId: selectedMic } : undefined,
        );
      })
      .then((track) => {
        if (!track) return;
        createdTrack = track;
        if (cancelled) {
          track.stop();
          track.close();
          return;
        }
        setMicError(null);
        setLocalMicrophoneTrack(track);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setMicError(error);
          setMicOn(false);
          setSelectedMic('');
        }
      });

    return () => {
      cancelled = true;
      createdTrack?.stop();
      createdTrack?.close();
    };
  }, [
    callExitState,
    devicesReady,
    joinAvailability.allowed,
    micOn,
    microphones.length,
    selectedMic,
  ]);

  useEffect(() => {
    let cancelled = false;
    let createdTrack: Awaited<ReturnType<typeof AgoraRTC.createCameraVideoTrack>> | undefined;

    if (!cameraOn || !joinAvailability.allowed || !devicesReady || callExitState) {
      queueMicrotask(() => {
        if (!cancelled) setLocalCameraTrack(undefined);
      });
      return () => {
        cancelled = true;
      };
    }

    if (cameras.length === 0) {
      queueMicrotask(() => {
        if (!cancelled) {
          setCameraOn(false);
          setCamError(new Error('No camera detected'));
        }
      });
      return () => {
        cancelled = true;
      };
    }

    void navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: selectedCam ? { deviceId: { exact: selectedCam } } : true,
      })
      .then((stream) => {
        stream.getTracks().forEach((track) => track.stop());
        if (cancelled) return undefined;
        return AgoraRTC.createCameraVideoTrack(selectedCam ? { cameraId: selectedCam } : undefined);
      })
      .then((track) => {
        if (!track) return;
        createdTrack = track;
        if (cancelled) {
          track.stop();
          track.close();
          return;
        }
        setCamError(null);
        setLocalCameraTrack(track);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setCamError(error);
          setCameraOn(false);
          setSelectedCam('');
        }
      });

    return () => {
      cancelled = true;
      createdTrack?.stop();
      createdTrack?.close();
    };
  }, [
    callExitState,
    cameraOn,
    cameras.length,
    devicesReady,
    joinAvailability.allowed,
    selectedCam,
  ]);

  // Screen sharing track
  const [screenTrack, setScreenTrack] = useState<unknown>(null);
  const screenTrackRef = useRef<unknown>(null);

  useEffect(() => {
    microphoneTrackRef.current = localMicrophoneTrack;
  }, [localMicrophoneTrack]);

  useEffect(() => {
    cameraTrackRef.current = localCameraTrack;
  }, [localCameraTrack]);

  useEffect(() => {
    screenTrackRef.current = screenTrack;
  }, [screenTrack]);

  const releaseLocalMedia = useCallback(() => {
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;

    const closeTrack = (track: unknown) => {
      const mediaTrack = track as { stop?: () => void; close?: () => void } | null;
      try {
        mediaTrack?.stop?.();
      } catch {
        // Track may already be stopped by the SDK.
      }
      try {
        mediaTrack?.close?.();
      } catch {
        // Track may already be closed by the SDK.
      }
    };

    closeTrack(screenTrackRef.current);
    closeTrack(microphoneTrackRef.current);
    closeTrack(cameraTrackRef.current);
    screenTrackRef.current = null;
    microphoneTrackRef.current = undefined;
    cameraTrackRef.current = undefined;
    setScreenTrack(null);
    setLocalMicrophoneTrack(undefined);
    setLocalCameraTrack(undefined);
    setIsScreenSharing(false);
    void agoraClient.leave().catch(() => undefined);
  }, []);

  useEffect(() => {
    const handlePageExit = () => releaseLocalMedia();
    window.addEventListener('pagehide', handlePageExit);
    window.addEventListener('beforeunload', handlePageExit);
    return () => {
      window.removeEventListener('pagehide', handlePageExit);
      window.removeEventListener('beforeunload', handlePageExit);
      releaseLocalMedia();
    };
  }, [releaseLocalMedia]);

  // Clean up screen share tracks on unmount to prevent resource leaks
  useEffect(() => {
    return () => {
      if (screenTrack && typeof (screenTrack as { close?: () => void }).close === 'function') {
        (screenTrack as { close: () => void }).close();
      }
    };
  }, [screenTrack]);

  // Fetch token using native useSwr hook
  const { data: tokenData } = useSwr<{ token?: string }>(
    meetingId ? `chat/call/token?channelName=${meetingId}` : null,
  );

  // Enumerate media devices on load
  useEffect(() => {
    if (!joinAvailability.allowed) return;
    let active = true;
    const getDevices = async () => {
      try {
        const list = await navigator.mediaDevices.enumerateDevices();
        if (!active) return;
        const videoDevs = list.filter((d) => d.kind === 'videoinput');
        const audioDevs = list.filter((d) => d.kind === 'audioinput');
        const speakerDevs = list.filter((d) => d.kind === 'audiooutput');
        setCameras(videoDevs);
        setMicrophones(audioDevs);
        setSpeakers(speakerDevs);
        setSelectedCam((current) =>
          videoDevs.some((device) => device.deviceId === current)
            ? current
            : (videoDevs[0]?.deviceId ?? ''),
        );
        setSelectedMic((current) =>
          audioDevs.some((device) => device.deviceId === current)
            ? current
            : (audioDevs[0]?.deviceId ?? ''),
        );
        setSelectedSpeaker((current) =>
          speakerDevs.some((device) => device.deviceId === current)
            ? current
            : (speakerDevs[0]?.deviceId ?? ''),
        );
        if (videoDevs.length === 0) {
          setCameraOn(false);
          setCamError(new Error('No camera detected'));
        } else setCamError(null);
        if (audioDevs.length === 0) {
          setMicOn(false);
          setMicError(new Error('No microphone detected'));
        } else setMicError(null);
      } catch {
        if (!active) return;
        setCameras([]);
        setMicrophones([]);
        setSpeakers([]);
        setCameraOn(false);
        setMicOn(false);
        setCamError(new Error('Camera unavailable'));
        setMicError(new Error('Microphone unavailable'));
      } finally {
        if (active) setDevicesReady(true);
      }
    };
    void getDevices();
    navigator.mediaDevices.addEventListener?.('devicechange', getDevices);
    return () => {
      active = false;
      navigator.mediaDevices.removeEventListener?.('devicechange', getDevices);
    };
  }, [joinAvailability.allowed]);

  // Update hardware device on track when selection changes
  useEffect(() => {
    if (localCameraTrack && selectedCam) {
      localCameraTrack.setDevice(selectedCam).catch(() => undefined);
    }
  }, [selectedCam, localCameraTrack]);

  useEffect(() => {
    if (localMicrophoneTrack && selectedMic) {
      localMicrophoneTrack.setDevice(selectedMic).catch(() => undefined);
    }
  }, [selectedMic, localMicrophoneTrack]);

  // Audio level analysis for pre-join mic visual bar
  useEffect(() => {
    if (!localMicrophoneTrack || joined) return;
    const interval = setInterval(() => {
      try {
        const level = localMicrophoneTrack.getVolumeLevel();
        setMicLevel(level * 100);
      } catch {
        setMicLevel(0);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [localMicrophoneTrack, joined]);

  // Socket Coordination Event Handlers
  useEffect(() => {
    if (!socket || !meetingId) return;

    socket.on('meet_lobby_list', ({ queue }) => {
      setLobbyQueue(queue);
    });

    socket.on('meet_join_request', ({ socketId, userId, userName }) => {
      setLobbyQueue((prev) => {
        if (prev.some((item) => item.socketId === socketId)) return prev;
        return [...prev, { socketId, userId, userName }];
      });
    });

    socket.on('meet_lobby_leave', ({ socketId }) => {
      setLobbyQueue((prev) => prev.filter((item) => item.socketId !== socketId));
    });

    socket.on('meet_join_accepted', () => {
      socket.emit('meet_join_active', { meetingId });
    });

    socket.on('meet_host_ready', () => {
      socket.emit('meet_join_active', { meetingId });
    });

    socket.on('meet_join_ready', () => {
      setIsWaitingInLobby(false);
      setJoined(true);
      setCallExitState(null);
      playMeetingChime('entered');
    });

    socket.on('meet_host_transferred', ({ message }: { message?: string } = {}) => {
      toast.success(message || 'You are now the meeting host.');
      void refreshMeeting();
    });

    socket.on('meet_host_changed', ({ userName }: { userName?: string } = {}) => {
      toast.info(`${userName || 'A participant'} is now the meeting host.`);
      void refreshMeeting();
    });

    socket.on('meet_join_rejected', ({ message }: { message?: string } = {}) => {
      setIsWaitingInLobby(false);
      toast.error(message || 'The meeting host declined your request to join.');
      router.push(getTenantRolePath(role ?? '', '/meeting'));
    });

    socket.on('meet_participants_list', ({ participants }) => {
      setParticipantDetails((prev) => {
        const next = { ...prev };
        participants.forEach((p: { userId: string; userName: string; avatar?: string }) => {
          next[String(p.userId)] = {
            userName: p.userId === String(user?._id) ? (user?.name ?? 'You') : p.userName,
            avatar: p.avatar,
          };
        });
        return next;
      });
    });

    socket.on('meet_user_joined', ({ userId, userName, avatar }) => {
      setParticipantDetails((prev) => ({
        ...prev,
        [String(userId)]: { userName, avatar },
      }));
      toast.info(`${userName} joined the meeting`);
      playMeetingChime('participant');
    });

    socket.on('meet_new_chat', (msg) => {
      setLiveChatMessages((prev) => [...prev, msg]);
    });

    socket.on('meet_host_action', ({ action }) => {
      if (action === 'mute_audio') {
        setMicOn(false);
        toast.warn('The host has muted your microphone.');
      } else if (action === 'mute_video') {
        setCameraOn(false);
        toast.warn('The host has turned off your video.');
      }
    });

    socket.on('meet_ended', async ({ reason }: { reason?: string } = {}) => {
      toast.info(
        reason === 'duration_elapsed'
          ? 'The scheduled meeting duration has ended.'
          : 'The host has ended this meeting.',
      );
      await finalizeRecordingRef.current();
      releaseLocalMedia();
      setJoined(false);
      setCallExitState('ended');
      void refreshMeeting();
    });
    socket.on('meet_removed', ({ blocked }: { blocked: boolean }) => {
      toast.error(
        blocked
          ? 'The host removed and blocked you from this meeting.'
          : 'The host removed you from this meeting.',
      );
      setJoined(false);
      router.push(getTenantRolePath(role ?? '', '/meeting'));
    });
    socket.on('meet_hand_changed', ({ userId: raisedUserId, userName, raised }) => {
      setRaisedHands((current) => {
        const next = { ...current };
        if (raised) next[String(raisedUserId)] = userName;
        else delete next[String(raisedUserId)];
        return next;
      });
    });
    socket.on('meet_reaction', ({ emoji, userName }) => {
      setReaction({ emoji, name: userName });
      window.setTimeout(() => setReaction(null), 2200);
    });
    socket.on('meet_error', ({ message, code }: { message?: string; code?: string }) => {
      if (code === 'MEETING_START_FAILED') setIsWaitingInLobby(false);
      toast.error(message || 'Meeting action failed');
    });

    return () => {
      socket.off('meet_lobby_list');
      socket.off('meet_join_request');
      socket.off('meet_lobby_leave');
      socket.off('meet_join_accepted');
      socket.off('meet_host_ready');
      socket.off('meet_join_ready');
      socket.off('meet_host_transferred');
      socket.off('meet_host_changed');
      socket.off('meet_join_rejected');
      socket.off('meet_participants_list');
      socket.off('meet_user_joined');
      socket.off('meet_new_chat');
      socket.off('meet_host_action');
      socket.off('meet_ended');
      socket.off('meet_removed');
      socket.off('meet_hand_changed');
      socket.off('meet_reaction');
      socket.off('meet_error');
    };
  }, [socket, meetingId, router, role, user, refreshMeeting, releaseLocalMedia]);

  // Scroll to bottom of chat when new message arrives
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activePanel]);

  // Join Agora RTC Channel
  const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID ?? '';
  useJoin(
    {
      appid: appId,
      channel: meetingId,
      token: tokenData?.token ?? null,
      uid: user?._id ? String(user._id) : undefined,
    },
    joined && !!tokenData?.token,
  );

  // Keep the array identity stable. Agora React treats a new array as a new publish operation;
  // rebuilding it on every render aborts an in-flight publish while the user is joining.
  const publishTracks = useMemo<Parameters<typeof usePublish>[0]>(
    () =>
      isScreenSharing && screenTrack
        ? [localMicrophoneTrack ?? null, screenTrack as Parameters<typeof usePublish>[0][number]]
        : [localMicrophoneTrack ?? null, localCameraTrack ?? null],
    [isScreenSharing, screenTrack, localMicrophoneTrack, localCameraTrack],
  );
  usePublish(publishTracks, joined);

  const remoteUsers = useRemoteUsers();
  const { videoTracks: remoteVideoTracks } = useRemoteVideoTracks(remoteUsers);
  const { audioTracks: remoteAudioTracks } = useRemoteAudioTracks(remoteUsers);

  // Play remote audio
  useEffect(() => {
    remoteAudioTracks.forEach((track) => {
      if (selectedSpeaker) void track.setPlaybackDevice(selectedSpeaker).catch(() => undefined);
      void track.play();
    });
  }, [remoteAudioTracks, selectedSpeaker]);

  // Enable Agora Volume indicators
  useEffect(() => {
    if (!joined) return;
    try {
      agoraClient.enableAudioVolumeIndicator();
      const onVolume = (result: Array<{ uid: string | number; level: number }>) => {
        const levelMap: Record<string, number> = {};
        result.forEach((item) => {
          levelMap[String(item.uid)] = item.level;
        });
        setVolumes(levelMap);
      };
      agoraClient.on('volume-indicator', onVolume);
      return () => {
        agoraClient.off('volume-indicator', onVolume);
      };
    } catch {
      /* ignore */
    }
  }, [joined]);

  // Mute logic updates
  useEffect(() => {
    if (localMicrophoneTrack) {
      localMicrophoneTrack.setEnabled(micOn).catch(() => undefined);
    }
  }, [micOn, localMicrophoneTrack]);

  useEffect(() => {
    if (localCameraTrack) {
      localCameraTrack.setEnabled(cameraOn).catch(() => undefined);
    }
  }, [cameraOn, localCameraTrack]);

  // Pinned Grid Layout calculation (Declared at the top to satisfy React Hook rules)
  const pinnedUser = useMemo(() => {
    if (pinnedUid === null) return null;
    if (pinnedUid === String(user?._id)) {
      return {
        name: user?.name ?? 'You',
        uid: String(user?._id),
        isVideoOn: cameraOn,
        isAudioOn: micOn,
        isMe: true,
        track: localCameraTrack,
        avatar: user?.avatar,
      };
    }
    const rUser = remoteUsers.find((r) => String(r.uid) === String(pinnedUid));
    if (rUser) {
      const vTrack = remoteVideoTracks.find((t) => t.getUserId() === rUser.uid);
      const details = participantDetails[String(rUser.uid)];
      return {
        name: details?.userName ?? `User ${rUser.uid}`,
        uid: rUser.uid,
        isVideoOn: rUser.hasVideo,
        isAudioOn: rUser.hasAudio,
        isMe: false,
        track: vTrack,
        avatar: details?.avatar,
      };
    }
    return null;
  }, [
    pinnedUid,
    user,
    cameraOn,
    micOn,
    localCameraTrack,
    remoteUsers,
    remoteVideoTracks,
    participantDetails,
  ]);

  const otherParticipants = useMemo(() => {
    const list = [];
    // If not pinned, include Me
    if (pinnedUid !== String(user?._id)) {
      list.push({
        name: user?.name ?? 'You',
        uid: String(user?._id),
        isVideoOn: cameraOn,
        isAudioOn: micOn,
        isMe: true,
        track: localCameraTrack,
        avatar: user?.avatar,
      });
    }
    // Remote users
    remoteUsers.forEach((rUser) => {
      if (pinnedUid !== String(rUser.uid)) {
        const vTrack = remoteVideoTracks.find((t) => t.getUserId() === rUser.uid);
        const details = participantDetails[String(rUser.uid)];
        list.push({
          name: details?.userName ?? `User ${rUser.uid}`,
          uid: rUser.uid,
          isVideoOn: rUser.hasVideo,
          isAudioOn: rUser.hasAudio,
          isMe: false,
          track: vTrack,
          avatar: details?.avatar,
        });
      }
    });
    return list;
  }, [
    pinnedUid,
    user,
    cameraOn,
    micOn,
    localCameraTrack,
    remoteUsers,
    remoteVideoTracks,
    participantDetails,
  ]);

  // Layout calculations
  const allParticipantsCount = remoteUsers.length + 1;
  const gridClass = useMemo(() => {
    if (allParticipantsCount === 1) return 'grid-cols-1';
    if (allParticipantsCount === 2) return 'grid-cols-1 md:grid-cols-2';
    if (allParticipantsCount <= 4) return 'grid-cols-2';
    return 'grid-cols-2 md:grid-cols-3';
  }, [allParticipantsCount]);

  // Handle joining request or direct entry
  const handleJoinClick = () => {
    if (!joinAvailability.allowed) {
      toast.info(joinAvailability.message);
      return;
    }
    if (!socket || !meeting) {
      toast.info('Meeting access is still loading. Please try again in a moment.');
      return;
    }
    setIsWaitingInLobby(true);
    if (isHost) {
      socket.emit('meet_register_host', { meetingId });
    } else {
      socket.emit('meet_join_lobby', { meetingId, userName: user?.name });
    }
  };

  const handleScreenShare = async () => {
    if (!isHost && meeting?.allowParticipantScreenShare === false) {
      toast.error('The host disabled participant screen sharing.');
      return;
    }
    if (isScreenSharing) {
      if (screenTrack) {
        (screenTrack as { close: () => void }).close();
        setScreenTrack(null);
      }
      setIsScreenSharing(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const browserTrack = stream.getVideoTracks()[0];
      if (!browserTrack) throw new Error('No screen was selected');
      const videoTrack = AgoraRTC.createCustomVideoTrack({
        mediaStreamTrack: browserTrack,
      });
      setScreenTrack(videoTrack);
      setIsScreenSharing(true);
      browserTrack.addEventListener('ended', () => {
        videoTrack.close();
        setScreenTrack(null);
        setIsScreenSharing(false);
      });
    } catch (error) {
      if ((error as DOMException).name === 'NotAllowedError') {
        toast.info('Screen sharing was cancelled.');
        return;
      }
      toast.error('Screen sharing is unavailable on this device or browser.');
    }
  };

  const uploadRecording = async (blob: Blob, durationSeconds: number) => {
    setIsSavingRecording(true);
    try {
      const signed = await mutation(`meeting-recording/meeting/${meetingId}/signature`, {
        method: 'POST',
        body: {},
      });
      const signature = (signed?.results as { data?: IRecordingSignature } | undefined)?.data;
      if (!signature) return;
      const form = new FormData();
      form.append('file', blob, `meeting-${meetingId}.webm`);
      form.append('api_key', signature.apiKey);
      form.append('timestamp', String(signature.timestamp));
      form.append('folder', signature.folder);
      form.append('public_id', signature.publicId);
      form.append('signature', signature.signature);
      form.append('type', signature.deliveryType || 'authenticated');
      const uploaded = await new Promise<{ public_id: string }>((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open('POST', `https://api.cloudinary.com/v1_1/${signature.cloudName}/video/upload`);
        request.onload = () => {
          if (request.status < 200 || request.status >= 300)
            return reject(new Error('Secure recording upload failed'));
          resolve(JSON.parse(request.responseText) as { public_id: string });
        };
        request.onerror = () => reject(new Error('Secure recording upload failed'));
        request.send(form);
      });
      const saved = await mutation(`meeting-recording/meeting/${meetingId}`, {
        method: 'POST',
        body: {
          publicId: uploaded.public_id,
          durationSeconds,
          title: `${meeting?.title || 'Meeting'} recording`,
        },
      });
      if (saved?.results) toast.success('Recording encrypted and stored securely');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Recording could not be stored');
    } finally {
      setIsSavingRecording(false);
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      recorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' });
      recordingFinalizePromiseRef.current = new Promise<void>((resolve) => {
        recordingFinalizeResolveRef.current = resolve;
      });
      recordingChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        setIsRecording(false);
        recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
        const blob = new Blob(recordingChunksRef.current, { type: 'video/webm' });
        const duration = Math.max(
          1,
          Math.ceil((Date.now() - recordingStartedAtRef.current) / 1000),
        );
        try {
          await uploadRecording(blob, duration);
        } finally {
          recordingFinalizeResolveRef.current?.();
          recordingFinalizeResolveRef.current = null;
          recordingFinalizePromiseRef.current = null;
        }
      };
      stream
        .getVideoTracks()[0]
        ?.addEventListener('ended', () => recorder.state === 'recording' && recorder.stop());
      recorderRef.current = recorder;
      recordingStreamRef.current = stream;
      recordingStartedAtRef.current = Date.now();
      recorder.start(5000);
      setIsRecording(true);
      toast.info('Secure recording started. Select this meeting tab for complete capture.');
    } catch (error) {
      if ((error as Error).name !== 'NotAllowedError')
        toast.error('Recording could not be started');
    }
  };

  const stopRecordingAndWait = async () => {
    const pendingUpload = recordingFinalizePromiseRef.current;
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    if (pendingUpload) await pendingUpload;
  };
  useEffect(() => {
    finalizeRecordingRef.current = stopRecordingAndWait;
  });

  const handleLeave = async () => {
    await stopRecordingAndWait();
    socket?.emit('meet_leave', { meetingId });
    releaseLocalMedia();
    setJoined(false);
    setCallExitState('left');
    playMeetingChime('left');
  };

  const handleEndMeetingForAll = async () => {
    await stopRecordingAndWait();
    releaseLocalMedia();
    socket?.emit('meet_end_meeting', { meetingId });
    setJoined(false);
    setCallExitState('ended');
    playMeetingChime('left');
  };

  const sendChatMessage = () => {
    if (!chatInput.trim() || !socket) return;
    socket.emit('meet_send_chat', { meetingId, content: chatInput.trim() });
    setChatInput('');
  };

  // Host operations: admit or deny users in lobby
  const acceptGuest = (guestSocketId: string) => {
    socket?.emit('meet_accept_user', { meetingId, socketId: guestSocketId });
    setLobbyQueue((prev) => prev.filter((item) => item.socketId !== guestSocketId));
  };

  const rejectGuest = (guestSocketId: string) => {
    socket?.emit('meet_reject_user', { meetingId, socketId: guestSocketId });
    setLobbyQueue((prev) => prev.filter((item) => item.socketId !== guestSocketId));
  };

  // Host operations: force mute microphone or disable camera
  const forceMuteAudio = (targetUserId: string) => {
    socket?.emit('meet_host_control', {
      meetingId,
      targetUserId,
      action: 'mute_audio',
    });
    toast.success('Sent microphone mute request to participant.');
  };

  const forceMuteVideo = (targetUserId: string) => {
    socket?.emit('meet_host_control', {
      meetingId,
      targetUserId,
      action: 'mute_video',
    });
    toast.success('Sent camera turn off request to participant.');
  };

  const removeParticipant = (targetUserId: string) => {
    socket?.emit('meet_remove_user', { meetingId, targetUserId, block: true });
  };

  const assignCoHost = async (targetUserId: string) => {
    const response = await mutation(`meeting/${meetingId}/co-hosts/${targetUserId}`, {
      method: 'POST',
      body: {},
    });
    if (response?.results) toast.success('Participant is now a co-host');
  };

  const toggleHand = () => {
    const raised = !handRaised;
    setHandRaised(raised);
    socket?.emit('meet_raise_hand', { meetingId, raised });
  };

  const toggleMeetingLock = async () => {
    const response = await mutation(`meeting/${meetingId}/room-settings`, {
      method: 'PATCH',
      body: { isLocked: !meeting?.isLocked },
    });
    if (response?.results) {
      toast.success(meeting?.isLocked ? 'Meeting unlocked' : 'Meeting locked');
      await refreshMeeting();
    }
  };

  const toggleParticipantScreenShare = async () => {
    const response = await mutation(`meeting/${meetingId}/room-settings`, {
      method: 'PATCH',
      body: { allowParticipantScreenShare: meeting?.allowParticipantScreenShare === false },
    });
    if (response?.results) {
      toast.success(
        meeting?.allowParticipantScreenShare === false
          ? 'Participant screen sharing enabled'
          : 'Participant screen sharing disabled',
      );
      await refreshMeeting();
    }
  };

  // --- RENDERING HELPER COMPONENT FOR PARTICIPANTS ---
  const renderParticipantCard = (
    name: string,
    uid: string | number,
    isVideoOn: boolean,
    isAudioOn: boolean,
    isMe: boolean,
    track: unknown,
    avatar?: string,
  ) => {
    const isPinned = pinnedUid === uid;
    const userVolume = volumes[String(uid)] ?? 0;
    const isSpeaking = userVolume > 15;
    const displayName = name.startsWith('User ') && name.length === 29 ? 'Participant' : name;

    return (
      <div
        className={`relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl border bg-white transition-all duration-300 ${
          isSpeaking ? 'border-primary ring-2 ring-primary/20' : 'border-slate-200'
        }`}
      >
        {isVideoOn && track ? (
          isMe ? (
            <LocalVideoTrack
              track={track as Parameters<typeof LocalVideoTrack>[0]['track']}
              className="w-full h-full object-cover"
              play
            />
          ) : (
            <RemoteVideoTrack
              track={track as Parameters<typeof RemoteVideoTrack>[0]['track']}
              className="w-full h-full object-cover"
              play
            />
          )
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="relative flex items-center justify-center">
              {isSpeaking && (
                <>
                  <span className="absolute inline-flex h-24 w-24 animate-ping rounded-full bg-primary/20 opacity-75"></span>
                  <span className="absolute inline-flex h-28 w-28 animate-pulse rounded-full bg-primary/10"></span>
                </>
              )}
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatar}
                  alt={displayName}
                  className={`h-20 w-20 rounded-full object-cover border-2 relative z-10 transition-all duration-300 ${
                    isSpeaking ? 'border-primary' : 'border-slate-300'
                  }`}
                />
              ) : (
                <div
                  className={`h-20 w-20 rounded-full flex items-center justify-center border-2 font-bold text-xl uppercase transition-all duration-300 relative z-10 ${getStableColor(
                    displayName,
                  )}`}
                >
                  {displayName.slice(0, 2) || 'U'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Top toolbar tools (Pin, Host Mutes) */}
        <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
          {/* Pin trigger */}
          <button
            onClick={() => setPinnedUid(isPinned ? null : uid)}
            className={`rounded-full border p-2 transition-all ${
              isPinned
                ? 'border-blue-200 bg-blue-100 text-primary'
                : 'border-slate-200 bg-white/90 text-slate-600 hover:bg-slate-100'
            }`}
            title={isPinned ? 'Unpin' : 'Pin'}
          >
            {isPinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
          </button>

          {/* Host Mute controls */}
          {isHost && !isMe && (
            <div className="flex gap-1.5">
              <button
                onClick={() => forceMuteAudio(String(uid))}
                className="rounded-full border border-slate-200 bg-white p-1.5 text-rose-500 transition-colors hover:bg-rose-50"
                title="Mute participant audio"
              >
                <VolumeX className="h-3 w-3" />
              </button>
              <button
                onClick={() => forceMuteVideo(String(uid))}
                className="rounded-full border border-slate-200 bg-white p-1.5 text-rose-500 transition-colors hover:bg-rose-50"
                title="Turn off participant camera"
              >
                <VideoOff className="h-3 w-3" />
              </button>
              <button
                onClick={() => removeParticipant(String(uid))}
                className="rounded-full border border-slate-200 bg-white p-1.5 text-rose-500 transition-colors hover:bg-rose-50"
                title="Remove and block participant"
              >
                <UserX className="h-3 w-3" />
              </button>
              <button
                onClick={() => void assignCoHost(String(uid))}
                className="rounded-full border border-slate-200 bg-white p-1.5 text-primary transition-colors hover:bg-blue-50"
                title="Make co-host"
              >
                <UserPlus className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        {/* Audio Mute Indicator overlay */}
        {!isAudioOn && (
          <div className="absolute top-3 left-3 rounded-full border border-rose-200 bg-rose-100 p-1.5 text-rose-600">
            <MicOff className="h-3 w-3" />
          </div>
        )}

        <div className="absolute bottom-3 left-3 rounded-lg border border-slate-200 bg-white/90 px-2.5 py-1 text-[10px] font-semibold text-slate-700 backdrop-blur-md">
          {displayName} {isMe && '(You)'}
        </div>
      </div>
    );
  };

  if (callExitState) {
    const canRejoin = callExitState === 'left' && meeting?.status === 'ongoing';
    return (
      <div className="flex min-h-dvh select-none flex-col bg-white text-slate-900 [&_button:disabled]:cursor-not-allowed [&_button:not(:disabled)]:cursor-pointer">
        <header className="flex h-20 items-center px-6 sm:px-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-primary">
              <Video className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-slate-900">Institution Meet</p>
              <p className="text-xs text-slate-500">Secure campus collaboration</p>
            </div>
          </div>
        </header>
        <main className="flex flex-1 items-start justify-center px-6 pt-[12vh] text-center">
          <div className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-primary">
              <PhoneOff className="h-7 w-7" />
            </div>
            <h1 className="mt-6 text-3xl font-medium tracking-tight text-slate-950">
              {callExitState === 'ended' ? 'The meeting has ended' : "You've left the meeting"}
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
              {canRejoin
                ? 'The meeting is still live. You can rejoin now or return to your meeting workspace.'
                : 'Your camera and microphone have been turned off and securely released.'}
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              {canRejoin && (
                <button
                  type="button"
                  onClick={() => setCallExitState(null)}
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-primary px-6 text-sm font-bold text-primary transition-colors hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  Rejoin
                </button>
              )}
              <button
                type="button"
                onClick={() => router.push(getTenantRolePath(role ?? '', '/meeting'))}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-bold text-white transition-colors hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                Return to meetings
              </button>
            </div>
            <div className="mx-auto mt-10 max-w-sm rounded-2xl border border-blue-100 bg-blue-50/60 p-5 text-left">
              <div className="flex items-start gap-3">
                <Shield className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-bold text-slate-800">Your meeting is protected</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    Only invited participants and people admitted by the host can enter.
                  </p>
                  <p className="mt-3 font-mono text-[11px] tracking-wide text-slate-500">
                    {getDisplayMeetingCode(meeting, meetingId)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Pre-join Lobby (Waiting for Host Approval)
  if (isWaitingInLobby) {
    return (
      <div className="flex min-h-dvh select-none flex-col items-center justify-center bg-white p-6 text-slate-900 [&_button]:transition-colors [&_button]:duration-200 [&_button]:focus-visible:outline-none [&_button]:focus-visible:ring-2 [&_button]:focus-visible:ring-primary/25 [&_button:disabled]:cursor-not-allowed [&_button:not(:disabled)]:cursor-pointer">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center">
          <div className="h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mx-auto mb-6">
            <Shield className="h-8 w-8 animate-pulse" />
          </div>
          <h2 className="text-xl font-bold">Asking to join...</h2>
          <p className="mt-4 text-sm text-slate-600 leading-relaxed">
            You will join the meeting as soon as the host admits you. Please wait in the lobby.
          </p>
          <div className="mt-8 flex justify-center">
            <span className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-100 border-t-primary" />
          </div>
          <button
            onClick={() => {
              setIsWaitingInLobby(false);
              router.push(getTenantRolePath(role ?? '', '/meeting'));
            }}
            className="mt-8 w-full rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Pre-join Preview / Hardware Setup View
  if (!joined) {
    return (
      <div className="min-h-dvh select-none bg-white text-slate-900 [&_button]:transition-colors [&_button]:duration-200 [&_button]:focus-visible:outline-none [&_button]:focus-visible:ring-2 [&_button]:focus-visible:ring-primary/25 [&_button:disabled]:cursor-not-allowed [&_button:not(:disabled)]:cursor-pointer [&_select:disabled]:cursor-not-allowed [&_select:not(:disabled)]:cursor-pointer">
        <header className="flex h-20 items-center justify-between px-5 sm:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
              <Video className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight text-slate-950">Institution Meet</p>
              <p className="text-xs text-slate-500">Secure campus collaboration</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-right">
            <div className="hidden sm:block">
              <p className="max-w-56 truncate text-sm font-semibold text-slate-800">
                {user?.email || user?.name || 'Signed-in user'}
              </p>
              <p className="text-xs capitalize text-slate-500">{role?.replaceAll('_', ' ')}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-primary ring-1 ring-blue-100">
              {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="mx-auto grid w-full max-w-7xl items-center gap-10 px-5 pb-10 pt-6 sm:px-8 lg:min-h-[calc(100dvh-5rem)] lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)] lg:px-10 lg:pb-20 lg:pt-0">
          <section className="min-w-0 animate-in fade-in slide-in-from-left-3 duration-500">
            <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {cameraOn && localCameraTrack ? (
                <LocalVideoTrack
                  track={localCameraTrack}
                  className="h-full w-full object-cover"
                  play
                />
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-blue-50">
                    <span className="text-3xl font-semibold text-primary">
                      {(user?.name || 'U').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="mt-1 text-sm font-medium text-slate-500">Camera is off</span>
                </div>
              )}

              <div className="absolute left-4 top-4 max-w-[70%] truncate rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-sm font-semibold text-slate-700">
                {user?.name || 'You'}
              </div>
              {Boolean(micError) && (
                <p className="absolute left-4 top-14 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-600">
                  Microphone unavailable
                </p>
              )}
              {Boolean(camError) && (
                <p className="absolute left-4 top-22 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-600">
                  Camera unavailable
                </p>
              )}

              <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMicOn((m) => !m)}
                  disabled={devicesReady && microphones.length === 0}
                  aria-label={micOn ? 'Turn off microphone' : 'Turn on microphone'}
                  className={`flex h-14 w-14 items-center justify-center rounded-full transition-all active:scale-95 ${
                    micOn
                      ? 'bg-white text-slate-800 hover:bg-slate-100'
                      : 'border border-rose-200 bg-white text-rose-600 hover:bg-rose-50'
                  }`}
                >
                  {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setCameraOn((c) => !c)}
                  disabled={devicesReady && cameras.length === 0}
                  aria-label={cameraOn ? 'Turn off camera' : 'Turn on camera'}
                  className={`flex h-14 w-14 items-center justify-center rounded-full transition-all active:scale-95 ${
                    cameraOn
                      ? 'bg-white text-slate-800 hover:bg-slate-100'
                      : 'border border-rose-200 bg-white text-rose-600 hover:bg-rose-50'
                  }`}
                >
                  {cameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <DeviceSelect
                icon={<Mic className="h-4 w-4" />}
                label="Microphone source"
                value={selectedMic}
                onChange={setSelectedMic}
                disabled={!micOn}
                devices={microphones}
                emptyLabel="No microphone detected"
              />
              <DeviceSelect
                icon={<Volume2 className="h-4 w-4" />}
                label="Speaker source"
                value={selectedSpeaker}
                onChange={setSelectedSpeaker}
                devices={speakers}
                emptyLabel="System default speaker"
              />
              <DeviceSelect
                icon={<Video className="h-4 w-4" />}
                label="Camera source"
                value={selectedCam}
                onChange={setSelectedCam}
                disabled={!cameraOn}
                devices={cameras}
                emptyLabel="No camera detected"
              />
            </div>
            {micOn && (
              <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full bg-emerald-500 transition-all duration-100"
                  style={{ width: `${Math.min(micLevel, 100)}%` }}
                />
              </div>
            )}
          </section>

          <section className="animate-in fade-in slide-in-from-right-3 text-center duration-500 lg:px-4">
            <div className="mx-auto max-w-md">
              <h1 className="text-3xl font-medium tracking-tight text-slate-950 sm:text-4xl">
                Ready to join?
              </h1>
              <p className="mt-5 text-base font-semibold text-slate-800">
                {meeting?.title || 'Your meeting is ready'}
              </p>
              {meeting?.scheduledAt && (
                <p className="mt-2 text-sm font-medium text-slate-600">
                  {new Date(meeting.scheduledAt).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                  {(meeting.durationSpecified === true ||
                    (meeting.durationSpecified === undefined && meeting.durationMinutes !== 60)) &&
                  meeting.durationMinutes
                    ? ` · ${meeting.durationMinutes} min`
                    : ''}
                </p>
              )}
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Your camera and microphone choices are applied before you enter.
              </p>
              <div
                className={`mx-auto mt-4 inline-flex rounded-full px-3 py-1.5 text-xs font-bold ${joinAvailability.allowed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}
              >
                {joinAvailability.message}
              </div>
              {liveTiming && (
                <div className="mx-auto mt-5 max-w-sm rounded-2xl border border-emerald-100 bg-white px-5 py-4 text-left">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      </span>
                      Live session timing
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Updates live
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 divide-x divide-slate-100">
                    <div className="pr-4">
                      <p className="text-[11px] font-semibold text-slate-500">Running for</p>
                      <p className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900">
                        {liveTiming.elapsed}
                      </p>
                    </div>
                    <div className="pl-4">
                      <p className="text-[11px] font-semibold text-slate-500">
                        {liveTiming.remaining === null
                          ? 'Planned end'
                          : liveTiming.isOvertime
                            ? 'Over planned time'
                            : 'Time remaining'}
                      </p>
                      <p
                        className={`mt-1 font-mono text-xl font-bold tabular-nums ${liveTiming.isOvertime ? 'text-amber-600' : 'text-primary'}`}
                      >
                        {liveTiming.remaining === null
                          ? 'Open-ended'
                          : liveTiming.isOvertime
                            ? `+${liveTiming.overtime}`
                            : liveTiming.remaining}
                      </p>
                    </div>
                  </div>
                  {liveTiming.progress !== null && (
                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-blue-50">
                      <div
                        className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${liveTiming.isOvertime ? 'bg-amber-400' : 'bg-primary'}`}
                        style={{ width: `${liveTiming.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              )}
              <div className="mt-8 rounded-2xl bg-blue-50 px-5 py-4 text-left">
                <div className="flex items-start gap-3">
                  <Shield className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-bold text-slate-800">Secure institution meeting</p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      Only invited participants and admitted guests can enter this room.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={handleJoinClick}
                  disabled={!tokenData?.token || !joinAvailability.allowed}
                  className="min-h-12 w-full max-w-xs rounded-full bg-primary px-8 py-3 text-sm font-bold text-white transition-all hover:bg-primary-600 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
                >
                  {!joinAvailability.allowed
                    ? joinAvailability.message
                    : !tokenData?.token
                      ? 'Preparing meeting…'
                      : 'Join now'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    releaseLocalMedia();
                    setMicOn(false);
                    setCameraOn(false);
                    router.push(getTenantRolePath(role ?? '', '/meeting'));
                  }}
                  className="min-h-11 w-full max-w-xs rounded-full border border-slate-300 bg-white px-8 py-2.5 text-sm font-bold text-primary transition-colors hover:bg-blue-50"
                >
                  Back to meetings
                </button>
              </div>
              <p className="mt-5 font-mono text-xs tracking-wide text-slate-400">
                Meeting code · {getDisplayMeetingCode(meeting, meetingId)}
              </p>
            </div>
          </section>
        </main>
      </div>
    );
  }

  // ── MAIN VIRTUAL MEETING ROOM ──────────────────────────────────────────────
  return (
    <div className="relative flex h-dvh w-screen select-none overflow-hidden bg-white text-slate-900 [&_button]:transition-colors [&_button]:duration-200 [&_button]:focus-visible:outline-none [&_button]:focus-visible:ring-2 [&_button]:focus-visible:ring-primary/25 [&_button:disabled]:cursor-not-allowed [&_button:not(:disabled)]:cursor-pointer [&_input:not(:disabled)]:cursor-text">
      {/* Host Admission Notification overlay */}
      {isHost && lobbyQueue.length > 0 && (
        <div className="absolute left-1/2 top-20 z-50 flex w-full max-w-sm -translate-x-1/2 animate-in flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-2.5 text-xs text-primary font-bold">
            <Shield className="h-4 w-4" />
            <span>Admissions Request ({lobbyQueue.length})</span>
          </div>
          {lobbyQueue.map((guest) => (
            <div key={guest.socketId} className="flex justify-between items-center py-1">
              <span className="text-sm font-semibold text-slate-700">{guest.userName}</span>
              <div className="flex gap-2 text-xs">
                <button
                  onClick={() => rejectGuest(guest.socketId)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Deny
                </button>
                <button
                  onClick={() => acceptGuest(guest.socketId)}
                  className="rounded-lg bg-primary px-3 py-1.5 font-semibold text-white transition-colors hover:bg-primary-600"
                >
                  Admit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Floating Header & Countdown Timer */}
      <div className="pointer-events-none absolute left-5 right-5 top-3 z-10 flex items-center justify-between">
        <div className="pointer-events-auto flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-primary">
            <Video className="h-4 w-4" />
          </div>
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {meeting?.title || 'Video Call'}
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {allParticipantsCount} participant{allParticipantsCount === 1 ? '' : 's'} ·{' '}
              {meeting?.isLocked ? 'Locked' : 'Open'}
            </p>
          </div>
        </div>
        {(isRecording || isSavingRecording) && (
          <div className="pointer-events-auto ml-auto mr-3 inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-700">
            <span
              className={`h-2.5 w-2.5 rounded-full bg-rose-500 ${isRecording ? 'animate-pulse' : ''}`}
            />
            {isRecording ? 'Recording' : 'Saving recording…'}
          </div>
        )}
        {isEndingSoon && (
          <div className="bg-red-500/90 text-slate-900 font-bold px-4 py-2 rounded-2xl border border-red-500/20   pointer-events-auto animate-pulse flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span className="text-xs">Meeting ends in {timeLeftStr}</span>
          </div>
        )}
      </div>
      {reaction && (
        <div className="pointer-events-none absolute left-1/2 top-24 z-50 -translate-x-1/2 rounded-full border border-slate-200 bg-white px-5 py-3 text-center text-2xl">
          <span>{reaction.emoji}</span>
          <p className="mt-1 text-[10px] font-medium text-slate-900">{reaction.name}</p>
        </div>
      )}
      {Object.keys(raisedHands).length > 0 && (
        <div className="absolute right-6 top-20 z-40 rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-slate-950">
          <Hand className="mr-1 inline h-3.5 w-3.5" />
          {Object.values(raisedHands).join(', ')}
        </div>
      )}

      {/* Video Content Grid */}
      <div className="relative flex min-w-0 flex-1 flex-col pt-16">
        <div className="flex flex-1 items-center justify-center overflow-hidden bg-white p-4 sm:p-5">
          {pinnedUser ? (
            /* Pin Layout view: split 75% primary left, 25% secondary right list */
            <div className="h-full w-full flex flex-col md:flex-row gap-4 max-w-7xl overflow-hidden">
              {/* Primary Pinned View */}
              <div className="flex-[3] h-full flex items-center justify-center min-h-0">
                {renderParticipantCard(
                  pinnedUser.name,
                  pinnedUser.uid,
                  pinnedUser.isVideoOn,
                  pinnedUser.isAudioOn,
                  pinnedUser.isMe,
                  pinnedUser.track,
                  pinnedUser.avatar,
                )}
              </div>
              {/* Right Sidebar List */}
              <div className="flex-1 h-full overflow-y-auto pr-1 flex flex-col gap-3 min-w-[200px]">
                {otherParticipants.map((p) => (
                  <div key={p.uid} className="aspect-video w-full flex-shrink-0">
                    {renderParticipantCard(
                      p.name,
                      p.uid,
                      p.isVideoOn,
                      p.isAudioOn,
                      p.isMe,
                      p.track,
                      p.avatar,
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Uniform Standard Grid view */
            <div
              className={`grid ${gridClass} gap-4 max-w-7xl mx-auto w-full h-full items-center min-h-0`}
            >
              {otherParticipants.map((p) => (
                <div key={p.uid} className="w-full h-full min-h-0">
                  {renderParticipantCard(
                    p.name,
                    p.uid,
                    p.isVideoOn,
                    p.isAudioOn,
                    p.isMe,
                    p.track,
                    p.avatar,
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Meet Room Toolbar */}
        <div className="relative z-30 flex min-h-20 items-center justify-between border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
          <div className="hidden min-w-0 md:block">
            <p className="max-w-48 truncate text-sm font-bold text-slate-900">{meeting?.title}</p>
            <p className="text-xs text-slate-500">
              {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div className="relative mx-auto flex max-w-full items-center gap-2 px-2">
            <button
              type="button"
              onClick={() => setMicOn((m) => !m)}
              disabled={devicesReady && microphones.length === 0}
              className={`p-3.5 rounded-full transition-all duration-200 active:scale-95 ${
                micOn
                  ? 'border border-slate-200 bg-white text-slate-700 hover:bg-blue-50'
                  : 'border border-rose-200 bg-white text-rose-600 hover:bg-rose-50'
              }`}
            >
              {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </button>

            <button
              type="button"
              onClick={() => setCameraOn((c) => !c)}
              disabled={devicesReady && cameras.length === 0}
              className={`p-3.5 rounded-full transition-all duration-200 active:scale-95 ${
                cameraOn
                  ? 'border border-slate-200 bg-white text-slate-700 hover:bg-blue-50'
                  : 'border border-rose-200 bg-white text-rose-600 hover:bg-rose-50'
              }`}
            >
              {cameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </button>

            <button
              type="button"
              onClick={handleScreenShare}
              className={`p-3.5 rounded-full transition-all duration-200 active:scale-95 ${
                isScreenSharing
                  ? 'border border-emerald-200 bg-white text-emerald-600 hover:bg-emerald-50'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-blue-50'
              }`}
            >
              <MonitorUp className="h-5 w-5" />
            </button>

            {/* Chat Trigger */}
            <button
              type="button"
              onClick={() => setActivePanel((panel) => (panel === 'chat' ? null : 'chat'))}
              className={`p-3.5 rounded-full transition-all duration-200 active:scale-95 ${
                activePanel === 'chat'
                  ? 'border border-blue-200 bg-white text-primary'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-blue-50'
              }`}
              title="In-call messages"
            >
              <MessageSquare className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setActivePanel((panel) => (panel === 'people' ? null : 'people'))}
              className={`rounded-full border bg-white p-3.5 transition-all active:scale-95 ${activePanel === 'people' ? 'border-blue-200 text-primary' : 'border-slate-200 text-slate-700 hover:bg-blue-50'}`}
              title="People"
            >
              <Users className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setShowMoreControls((open) => !open)}
              className={`rounded-full border bg-white p-3.5 transition-all active:scale-95 ${showMoreControls ? 'border-blue-200 text-primary' : 'border-slate-200 text-slate-700 hover:bg-blue-50'}`}
              title="More options"
            >
              <MoreVertical className="h-5 w-5" />
            </button>
            {showMoreControls && (
              <div className="absolute bottom-16 right-12 z-50 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2">
                <button
                  type="button"
                  onClick={() => {
                    setActivePanel((panel) => (panel === 'details' ? null : 'details'));
                    setShowMoreControls(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  <Info className="h-4 w-4" /> Meeting details
                </button>
                <button
                  type="button"
                  onClick={() => {
                    toggleHand();
                    setShowMoreControls(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  <Hand className="h-4 w-4" /> {handRaised ? 'Lower hand' : 'Raise hand'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    socket?.emit('meet_reaction', { meetingId, emoji: '👏' });
                    setShowMoreControls(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  <Smile className="h-4 w-4" /> Send applause
                </button>
                {isHost && (
                  <>
                    <div className="my-1 border-t border-slate-100" />
                    <button
                      type="button"
                      onClick={() => void toggleMeetingLock()}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
                    >
                      {meeting?.isLocked ? (
                        <LockOpen className="h-4 w-4" />
                      ) : (
                        <Lock className="h-4 w-4" />
                      )}
                      {meeting?.isLocked ? 'Unlock meeting' : 'Lock meeting'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleParticipantScreenShare()}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
                    >
                      <MonitorX className="h-4 w-4" /> Participant sharing
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleRecording()}
                      disabled={isSavingRecording}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                    >
                      {isRecording ? (
                        <Square className="h-4 w-4 text-rose-500" />
                      ) : (
                        <Circle className="h-4 w-4" />
                      )}
                      {isSavingRecording
                        ? 'Saving recording…'
                        : isRecording
                          ? 'Stop recording'
                          : 'Record meeting'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleEndMeetingForAll()}
                      disabled={isSavingRecording}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50"
                    >
                      <PhoneOff className="h-4 w-4" /> End for everyone
                    </button>
                  </>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => void handleLeave()}
              disabled={isSavingRecording}
              className="rounded-full bg-rose-500 p-3.5 text-white transition-all duration-200 hover:bg-rose-600 active:scale-95"
              title="Leave meeting"
            >
              <PhoneOff className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {activePanel === 'people' && (
        <aside className="relative z-20 mt-16 mb-20 flex h-auto w-80 shrink-0 animate-in flex-col border border-r-0 border-slate-200 bg-white slide-in-from-right duration-300">
          <div className="flex items-center justify-between border-b border-slate-200 p-5">
            <div>
              <h3 className="font-bold text-slate-900">People</h3>
              <p className="mt-1 text-xs text-slate-500">{allParticipantsCount} in this meeting</p>
            </div>
            <button
              type="button"
              onClick={() => setActivePanel(null)}
              className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-4">
            {otherParticipants.map((participant) => (
              <div
                key={participant.uid}
                className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-slate-50"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-primary">
                  {participant.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {participant.name}
                    {participant.isMe ? ' (You)' : ''}
                  </p>
                  <p className="text-xs text-slate-500">
                    {participant.isAudioOn ? 'Microphone on' : 'Muted'}
                  </p>
                </div>
                {participant.isAudioOn ? (
                  <Mic className="h-4 w-4 text-slate-500" />
                ) : (
                  <MicOff className="h-4 w-4 text-rose-500" />
                )}
              </div>
            ))}
          </div>
        </aside>
      )}

      {activePanel === 'details' && (
        <aside className="relative z-20 mt-16 mb-20 flex h-auto w-80 shrink-0 animate-in flex-col border border-r-0 border-slate-200 bg-white slide-in-from-right duration-300">
          <div className="flex items-center justify-between border-b border-slate-200 p-5">
            <h3 className="font-bold text-slate-900">Meeting details</h3>
            <button
              type="button"
              onClick={() => setActivePanel(null)}
              className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="space-y-5 overflow-y-auto p-5 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Title</p>
              <p className="mt-1 font-semibold text-slate-800">{meeting?.title}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Agenda</p>
              <p className="mt-1 leading-6 text-slate-600">
                {meeting?.agenda || 'No agenda provided.'}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Meeting code
              </p>
              <p className="mt-1 font-mono text-xs tracking-wide text-slate-600">
                {getDisplayMeetingCode(meeting, meetingId)}
              </p>
            </div>
            <div className="rounded-xl bg-blue-50 p-4 text-xs leading-5 text-slate-600">
              <Shield className="mb-2 h-5 w-5 text-primary" />
              Institution access controls and host-managed admission protect this room.
            </div>
          </div>
        </aside>
      )}

      {activePanel === 'chat' && (
        <aside className="relative z-20 mt-16 mb-20 flex h-auto w-80 shrink-0 animate-in flex-col border border-r-0 border-slate-200 bg-white slide-in-from-right duration-300">
          <div className="flex items-center justify-between border-b border-slate-200 p-4">
            <span className="font-bold text-sm text-slate-700 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              In-call Messages
            </span>
            <button
              onClick={() => setActivePanel(null)}
              className="rounded-full p-2 text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3 text-xs leading-normal">
            {chatMessages.map((msg, i) => {
              const isSenderMe = String(msg.userId) === String(user?._id);
              return (
                <div
                  key={i}
                  className={`flex flex-col max-w-[85%] ${isSenderMe ? 'self-end items-end' : 'self-start items-start'}`}
                >
                  <span className="text-[10px] text-slate-600 font-semibold mb-0.5">
                    {msg.userName}
                  </span>
                  <div
                    className={`px-3 py-2 rounded-2xl ${
                      isSenderMe
                        ? 'rounded-tr-none bg-primary text-white'
                        : 'rounded-tl-none border border-slate-200 bg-slate-100 text-slate-700'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              );
            })}
            <div ref={chatBottomRef} />
          </div>

          <div className="flex items-center gap-2 border-t border-slate-200 bg-white p-3">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
              placeholder="Send message to everyone"
              className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 placeholder:text-slate-400"
            />
            <button
              onClick={sendChatMessage}
              disabled={!chatInput.trim()}
              className="rounded-xl bg-primary p-2.5 text-white transition-all duration-200 hover:bg-primary-600 disabled:pointer-events-none disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </aside>
      )}
    </div>
  );
}

export default function MeetingRoomPage() {
  return (
    <AgoraRTCProvider client={agoraClient}>
      <MeetingRoomContent />
    </AgoraRTCProvider>
  );
}
