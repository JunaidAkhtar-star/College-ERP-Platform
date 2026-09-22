/**
 * @file useSocket.ts
 * @description Singleton Socket.IO client hook.
 * Connects on first use (with JWT from localStorage), keeps alive for the
 * entire app session, and is only torn down by an explicit call to
 * disconnectSocket() (e.g. from logout).
 *
 * Usage:
 *   const { socket, isConnected } = useSocket();
 *
 * The hook is safe to call in multiple components — it returns the same
 * singleton socket instance.
 *
 * @module shared/hooks
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getFromLocalStorage, getTenantId } from '@/shared/utils';

// ─── Singleton socket ─────────────────────────────────────────────────────────
let _socket: Socket | null = null;

const SOCKET_URL = (process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8080/api/v1').replace(
  '/api/v1',
  '',
);

function getOrCreateSocket(): Socket {
  // Return the existing instance whether or not it is connected yet — the
  // socket.io client manages reconnection internally. Creating a new instance
  // while the previous one is still in handshake produces duplicate sessions.
  if (_socket) return _socket;
  const token = getFromLocalStorage('accessToken');
  _socket = io(SOCKET_URL, {
    auth: { token, tenantId: getTenantId() },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1500,
    autoConnect: true,
  });
  return _socket;
}

/**
 * Force-disconnect the singleton socket. Call from logout so the backend
 * immediately marks the user offline (instead of waiting for ping timeout).
 * Safe to call from non-React code.
 */
export function disconnectSocket(): void {
  if (_socket) {
    _socket.removeAllListeners();
    _socket.disconnect();
    _socket = null;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const s = getOrCreateSocket();
    socketRef.current = s;
    setSocket(s); // eslint-disable-line react-hooks/set-state-in-effect
    setIsConnected(s.connected);

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);

    if (!s.connected) s.connect();

    return () => {
      // Detach this component's listeners only — do NOT disconnect the
      // singleton on unmount, otherwise React StrictMode (or simple page
      // navigations) would tear down and recreate the connection, producing
      // duplicate sessions on the backend.
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
    };
  }, []);

  return { socket: socket ?? _socket, isConnected };
}
