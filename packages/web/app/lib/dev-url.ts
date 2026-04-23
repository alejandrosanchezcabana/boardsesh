'use client';

import { useEffect, useState } from 'react';

import { isNativeApp } from '@/app/lib/ble/capacitor-utils';

export type DevUrlState = {
  isDebug: boolean;
  currentUrl: string | null;
  defaultUrl: string;
};

const plugin = () => {
  if (typeof window === 'undefined' || !isNativeApp()) return undefined;
  return window.Capacitor?.Plugins?.DevUrl;
};

export async function getDevUrlState(): Promise<DevUrlState | null> {
  const p = plugin();
  if (!p) return null;
  try {
    const raw = await p.getState();
    // Android's JSObject may still omit the key in older plugin builds; normalize
    // to `null` so the web side's `string | null` contract holds regardless.
    return { ...raw, currentUrl: raw.currentUrl ?? null };
  } catch {
    return null;
  }
}

export async function setDevUrl(url: string): Promise<void> {
  const p = plugin();
  if (!p) return;
  await p.setUrl({ url });
}

export async function clearDevUrl(): Promise<void> {
  const p = plugin();
  if (!p) return;
  await p.clearUrl();
}

export function useDevUrl(): { isAvailable: boolean; state: DevUrlState | null; refresh: () => void } {
  const [state, setState] = useState<DevUrlState | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!isNativeApp()) {
      setState(null);
      return;
    }
    void (async () => {
      const next = await getDevUrlState();
      if (!cancelled) setState(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  return {
    isAvailable: Boolean(state?.isDebug),
    state,
    refresh: () => setTick((n) => n + 1),
  };
}
