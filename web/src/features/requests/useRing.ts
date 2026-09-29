import { useCallback, useEffect, useRef } from 'react';

const RING_URL = '/sounds/notification-ring.mp3';
/** One ring, bounded: a request that goes unanswered must not keep the phone ringing (legacy: 8 s). */
export const RING_DURATION_MS = 8000;

/** `play()` restarts the ring, `stop()` ends it; unmount ends it too. Browsers may block autoplay — ignored. */
export function useRing() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const timer = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    const a = audio.current;
    audio.current = null;
    if (a) {
      a.pause();
      a.currentTime = 0;
    }
  }, []);

  const play = useCallback(() => {
    stop();
    try {
      const a = new Audio(RING_URL);
      a.loop = true;
      a.volume = 0.5;
      audio.current = a;
      void a.play()?.catch(() => {
        if (audio.current === a) audio.current = null;
      });
      timer.current = window.setTimeout(stop, RING_DURATION_MS);
    } catch {
      /* no audio support */
    }
  }, [stop]);

  useEffect(() => stop, [stop]);
  return { play, stop };
}
