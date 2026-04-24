'use client';

import { useEffect, useRef } from 'react';
import { isNativeApp } from '@/app/lib/ble/capacitor-utils';
import { detectShake, DEFAULT_SHAKE_OPTIONS, initialShakeState, type ShakeState } from './detect-shake';

interface UseShakeDetectorOptions {
  enabled?: boolean;
}

type IosRequestPermission = () => Promise<'granted' | 'denied'>;

const DEBUG = process.env.NODE_ENV !== 'production';
const log = (...args: unknown[]) => {
  if (DEBUG) console.info('[shake]', ...args);
};

/**
 * Subscribe to device accelerometer events and invoke `onShake` on shake.
 *
 * Platform routing:
 * - Inside the Capacitor WebView (`isNativeApp()`): use the Motion plugin or
 *   nothing. We never fall through to `devicemotion` in the native shell —
 *   the native side owns motion so the web layer must not double-subscribe.
 * - Mobile browser / PWA on Android (or older iOS): `devicemotion` listener
 *   attached directly.
 * - Mobile Safari iOS 13+: `devicemotion` gated on a first-tap permission
 *   request (iOS requires requestPermission() from a user gesture).
 * - Desktop or missing APIs: no-op.
 */
export function useShakeDetector(onShake: () => void, { enabled = true }: UseShakeDetectorOptions = {}): void {
  const onShakeRef = useRef(onShake);
  useEffect(() => {
    onShakeRef.current = onShake;
  }, [onShake]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    let state: ShakeState = initialShakeState();
    let cleanup: (() => void | Promise<void>) | null = null;
    let cancelled = false;

    let sampleCount = 0;
    let peakMagnitude = 0;
    const processMagnitude = (magnitude: number) => {
      const step = detectShake(magnitude, Date.now(), state, DEFAULT_SHAKE_OPTIONS);
      state = step.state;
      sampleCount += 1;
      if (magnitude > peakMagnitude) peakMagnitude = magnitude;
      // Log once per second so devtools don't flood; include the peak so the
      // user can see whether their shake is even crossing threshold.
      if (DEBUG && sampleCount % 50 === 0) {
        log(`samples=${sampleCount} peak=${peakMagnitude.toFixed(1)} jolts=${state.joltTimestamps.length}`);
      }
      if (step.fired) {
        log(`SHAKE fired (peak=${peakMagnitude.toFixed(1)} m/s²)`);
        peakMagnitude = 0;
        onShakeRef.current();
      }
    };

    const attach = async () => {
      // Inside the native Capacitor shell: use the Motion plugin, or bail.
      // Crucially, we do NOT fall through to the browser `devicemotion` path
      // here — the native side owns motion, so the web layer must not wire up
      // a second listener (double detection, stale state, wrong thresholds).
      if (isNativeApp()) {
        const motion = window.Capacitor?.Plugins?.Motion;
        if (!motion) {
          log('native shell without Motion plugin — not attaching');
          return;
        }
        log('attaching via Capacitor Motion plugin');
        const handle = await motion.addListener('accel', (event) => {
          const { x, y, z } = event.acceleration;
          processMagnitude(Math.sqrt(x * x + y * y + z * z));
        });
        if (cancelled) {
          void handle.remove();
          return;
        }
        cleanup = () => handle.remove();
        return;
      }

      // Mobile browser / PWA path.
      if (typeof DeviceMotionEvent === 'undefined') {
        log('DeviceMotionEvent unavailable (desktop or old browser) — not attaching');
        return;
      }

      // DeviceMotion requires a secure context (HTTPS or localhost). Over
      // plain HTTP (e.g. LAN IP / Tailscale IP on the dev server), mobile
      // browsers silently drop all events — so the hook looks like it's
      // doing nothing. Warn up front so the cause is obvious in the console.
      if (typeof window !== 'undefined' && window.isSecureContext === false) {
        console.warn(
          '[shake] Page is not a secure context — mobile browsers will NOT fire devicemotion events. ' +
            'Use HTTPS or localhost to test shake-to-report.',
        );
      }

      const handler = (event: DeviceMotionEvent) => {
        const accel = event.acceleration;
        if (accel && accel.x !== null && accel.y !== null && accel.z !== null) {
          processMagnitude(Math.sqrt(accel.x * accel.x + accel.y * accel.y + accel.z * accel.z));
          return;
        }
        // Fallback: some browsers only populate accelerationIncludingGravity.
        // Recover the user-acceleration magnitude from the including-gravity
        // magnitude under the worst-case assumption that gravity is orthogonal
        // to the shake axis (true for lateral shakes on an upright phone):
        //   |total|² ≈ |user|² + |gravity|²  ⟹  |user| ≈ √(|total|² − g²)
        // Clamp to 0 to avoid NaN in the degenerate parallel-opposite case
        // (phone in free-fall-like motion, not relevant for a shake gesture).
        const g = event.accelerationIncludingGravity;
        if (!g || g.x === null || g.y === null || g.z === null) return;
        const totalSq = g.x * g.x + g.y * g.y + g.z * g.z;
        const GRAVITY_SQ = 9.8 * 9.8;
        processMagnitude(Math.sqrt(Math.max(0, totalSq - GRAVITY_SQ)));
      };

      const requestPermission = (DeviceMotionEvent as unknown as { requestPermission?: IosRequestPermission })
        .requestPermission;

      if (typeof requestPermission === 'function') {
        // iOS 13+ Safari: permission must be requested from a user gesture.
        // Critical: the handler must NOT be an `async` function. WebKit ties
        // the user-gesture token to the synchronous call stack of the event
        // handler; wrapping the handler in `async` (even before the first
        // `await`) is enough to make Safari reject the call with
        // "Requesting device motion access requires a user gesture to prompt".
        // We also don't pass { once: true } — we call removeEventListener
        // manually BEFORE kicking off the permission request, so the same
        // gesture can't accidentally fire this handler twice and so the
        // cleanup on unmount has a listener to remove.
        log('iOS 13+ detected — waiting for first pointerdown to request DeviceMotion permission');
        const onGesture = () => {
          document.removeEventListener('pointerdown', onGesture);
          // Synchronously inside the gesture frame — promise chaining, not
          // async/await, so WebKit still counts this as a user-initiated call.
          requestPermission
            .call(DeviceMotionEvent)
            .then((result) => {
              log(`DeviceMotion permission result: ${result}`);
              if (result === 'granted' && !cancelled) {
                window.addEventListener('devicemotion', handler);
                cleanup = () => window.removeEventListener('devicemotion', handler);
              }
            })
            .catch((err) => {
              log('DeviceMotion permission threw:', err);
            });
        };
        document.addEventListener('pointerdown', onGesture);
        cleanup = () => document.removeEventListener('pointerdown', onGesture);
        return;
      }

      log('attaching devicemotion listener');
      window.addEventListener('devicemotion', handler);
      cleanup = () => window.removeEventListener('devicemotion', handler);
    };

    void attach();

    return () => {
      cancelled = true;
      if (cleanup) {
        const result = cleanup();
        if (result instanceof Promise) void result.catch(() => undefined);
      }
    };
  }, [enabled]);
}
