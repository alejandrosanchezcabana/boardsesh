import { useEffect, useState } from 'react';

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** True once the target time has been reached. */
  done: boolean;
}

/**
 * Live countdown to `target`. Only schedules a 1s interval when `active`
 * is true and the target is still in the future — the interval stops
 * itself the moment remaining hits zero, so a long-mounted card doesn't
 * re-render every second forever after launch.
 */
export function useCountdown(target: Date, active: boolean): Countdown {
  const [remaining, setRemaining] = useState(() =>
    active ? Math.max(0, target.getTime() - Date.now()) : 0,
  );

  useEffect(() => {
    if (!active) return;
    const compute = () => Math.max(0, target.getTime() - Date.now());
    const initial = compute();
    setRemaining(initial);
    if (initial === 0) return;
    const id = setInterval(() => {
      const next = compute();
      setRemaining(next);
      if (next === 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [active, target]);

  const totalSeconds = Math.floor(remaining / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    // When active=false, remaining is always 0, so done=true. Callers must
    // guard on their own active condition before reading done, or they'll
    // see the countdown as "complete" even when it was never started.
    done: remaining <= 0,
  };
}
