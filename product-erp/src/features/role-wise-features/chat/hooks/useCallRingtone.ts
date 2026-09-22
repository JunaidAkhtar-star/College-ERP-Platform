/**
 * @file useCallRingtone.ts
 * @description Hook that plays a Microsoft Teams-style ringtone when an
 * incoming call is ringing and stops it on accept / reject / call end.
 * The audio loops until explicitly stopped.  Handles browser auto-play
 * restrictions gracefully — falls back silently if the browser blocks play().
 */
import { useCallback, useEffect, useRef } from 'react';

const RINGTONE_URL = '/sounds/microsoft_teams_call.mp3';

export function useCallRingtone(shouldRing: boolean) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Lazily create the Audio element once (avoids SSR crash).
  const getAudio = useCallback(() => {
    if (!audioRef.current && typeof window !== 'undefined') {
      const a = new Audio(RINGTONE_URL);
      a.loop = true;
      a.volume = 1.0;

      // Manual loop fallback to ensure it repeats continuously on all browsers
      a.addEventListener('ended', () => {
        a.currentTime = 0;
        a.play().catch(() => {});
      });

      // Cut off trailing silence and loop immediately (gapless loop)
      a.addEventListener('timeupdate', () => {
        if (a.duration && a.currentTime >= a.duration - 0.4) {
          a.currentTime = 0;
          a.play().catch(() => {});
        }
      });

      // Web Audio API Volume Booster (3x gain)
      try {
        const AudioContextClass =
          window.AudioContext ||
          (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (AudioContextClass) {
          const ctx = new AudioContextClass();
          const source = ctx.createMediaElementSource(a);
          const gainNode = ctx.createGain();
          gainNode.gain.value = 3.0; // Boost volume by 3x!
          source.connect(gainNode);
          gainNode.connect(ctx.destination);

          a.addEventListener('play', () => {
            if (ctx.state === 'suspended') {
              ctx.resume().catch(() => {});
            }
          });
        }
      } catch (err) {
        console.warn('Web Audio API not supported or blocked:', err);
      }

      audioRef.current = a;
    }
    return audioRef.current;
  }, []);

  useEffect(() => {
    const audio = getAudio();
    if (!audio) return;

    if (shouldRing) {
      audio.currentTime = 0;
      audio.play().catch(() => {
        // Browser may block autoplay — nothing we can do.
      });
    } else {
      audio.pause();
      audio.currentTime = 0;
    }

    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, [shouldRing, getAudio]);
}
