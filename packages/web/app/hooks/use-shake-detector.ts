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
      // browsers silently drop all events — attaching a listener there is
      // just dead weight. Warn loudly and bail so the cause is obvious and
      // there's no stale handler hanging off `window`.
      if (window.isSecureContext === false) {
        console.warn(
          '[shake] Page is not a secure context — mobile browsers will NOT fire devicemotion events. ' +
            'Use HTTPS or localhost to test shake-to-report. Skipping listener attachment.',
        );
        return;
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

      const requestPermissionRaw = (DeviceMotionEvent as unknown as { requestPermission?: IosRequestPermission })
        .requestPermission;

      if (typeof requestPermissionRaw === 'function') {
        // Capture the narrowed function in a const so the nested handler
        // below retains its function type — TS doesn't carry a `typeof …
        // === 'function'` narrow across a nested function declaration.
        const requestPermission = requestPermissionRaw;
        // iOS 13+ Safari: permission must be requested from a user gesture.
        // Notes on the implementation:
        // - WebKit's gesture-activation list for DeviceMotion is narrow:
        //   `click` and `touchend` qualify; `pointerdown` does NOT, even
        //   though it fires from a user tap. Using pointerdown here gave
        //   "NotAllowedError: requires a user gesture to prompt" on iOS.
        // - The handler must NOT be an `async` function. WebKit ties the
        //   gesture token to the synchronous call stack of the event
        //   listener; merely declaring the handler `async` loses the token.
        //   Promise-chain `.then()` is fine because requestPermission() is
        //   called synchronously at the top of the handler frame.
        // - We listen for both `click` and `touchend` so the permission
        //   request fires on whichever event bubbles up first (some iOS
        //   controls swallow one or the other).
        log('iOS 13+ detected — waiting for first click/touchend to request DeviceMotion permission');
        const cleanupGestureListeners = () => {
          document.removeEventListener('click', onGesture);
          document.removeEventListener('touchend', onGesture);
        };
        function onGesture() {
          cleanupGestureListeners();
          requestPermission
            .call(DeviceMotionEvent)
            .then((result) => {
              log(`DeviceMotion permission result: ${result}`);
              if (result === 'granted' && !cancelled) {
                window.addEventListener('devicemotion', handler);
                cleanup = () => window.removeEventListener('devicemotion', handler);
              } else if (result === 'denied') {
                console.warn(
                  '[shake] iOS denied DeviceMotion. If this was by accident, re-enable via ' +
                    'iPhone Settings → Safari → Motion & Orientation Access.',
                );
              }
            })
            .catch((err) => {
              log('DeviceMotion permission threw:', err);
              console.warn(
                '[shake] iOS rejected the permission call. Usually means Motion & Orientation ' +
                  'Access is disabled in iPhone Settings → Safari (toggle it on and reload).',
              );
            });
        }
        document.addEventListener('click', onGesture);
        document.addEventListener('touchend', onGesture);
        cleanup = cleanupGestureListeners;
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
