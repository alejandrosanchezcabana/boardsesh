'use client';

import { useEffect, useRef } from 'react';
import { isNativeApp } from '@/app/lib/ble/capacitor-utils';
import { detectShake, DEFAULT_SHAKE_OPTIONS, initialShakeState, type ShakeState } from './detect-shake';

interface UseShakeDetectorOptions {
  enabled?: boolean;
}

type IosRequestPermission = () => Promise<'granted' | 'denied'>;

/**
 * Subscribe to device accelerometer events and invoke `onShake` on shake.
 * - Native (Capacitor): `@capacitor/motion` Motion plugin.
 * - Android web / older iOS: `devicemotion` listener directly.
 * - iOS 13+ mobile web: listener is gated behind a first-tap permission prompt.
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

    const processMagnitude = (magnitude: number) => {
      const step = detectShake(magnitude, Date.now(), state, DEFAULT_SHAKE_OPTIONS);
      state = step.state;
      if (step.fired) onShakeRef.current();
    };

    const attach = async () => {
      // Native: Capacitor Motion plugin, no permission flow needed.
      if (isNativeApp() && window.Capacitor?.Plugins?.Motion) {
        const handle = await window.Capacitor.Plugins.Motion.addListener('accel', (event) => {
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

      // Browser path.
      if (typeof DeviceMotionEvent === 'undefined') return;

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
        const onGesture = async () => {
          document.removeEventListener('pointerdown', onGesture);
          try {
            const result = await requestPermission.call(DeviceMotionEvent);
            if (result === 'granted' && !cancelled) {
              window.addEventListener('devicemotion', handler);
              cleanup = () => window.removeEventListener('devicemotion', handler);
            }
          } catch {
            // Denied or not allowed — bail silently.
          }
        };
        document.addEventListener('pointerdown', onGesture, { once: true });
        cleanup = () => document.removeEventListener('pointerdown', onGesture);
        return;
      }

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
