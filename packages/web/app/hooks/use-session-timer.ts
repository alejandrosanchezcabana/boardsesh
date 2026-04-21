import { useState, useEffect } from "react";

export function formatElapsed(seconds: number, short?: boolean): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (short) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Returns a live timer string counting up from the given ISO timestamp.
 * Pass `short: true` for hh:mm format, otherwise returns hh:mm:ss.
 * Returns null when startedAt is falsy (no interval is created).
 */
export function useSessionTimer(
  startedAt: string | null | undefined,
  options?: { short?: boolean },
): string | null {
  const short = options?.short;

  const [elapsed, setElapsed] = useState<string | null>(() => {
    if (!startedAt) return null;
    const seconds = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
    return formatElapsed(seconds, short);
  });

  useEffect(() => {
    if (!startedAt) {
      setElapsed(null);
      return;
    }

    const startMs = new Date(startedAt).getTime();

    const update = () => {
      const seconds = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
      setElapsed(formatElapsed(seconds, short));
    };

    update();
    // Long format (hh:mm:ss) ticks every 1s; short format (hh:mm) only
    // changes on the minute boundary so we poll every 10s to save cycles.
    const id = setInterval(update, short ? 10_000 : 1_000);
    return () => clearInterval(id);
  }, [startedAt, short]);

  return elapsed;
}
