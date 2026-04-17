import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCountdown } from '../use-countdown';

describe('useCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-17T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns all zeros and done=true when inactive', () => {
    const target = new Date('2026-04-29T00:00:00Z');
    const { result } = renderHook(() => useCountdown(target, false));

    expect(result.current).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0, done: true });
  });

  it('computes initial remaining from target minus now when active', () => {
    const target = new Date('2026-04-20T03:04:05Z'); // +3d 3h 4m 5s
    const { result } = renderHook(() => useCountdown(target, true));

    expect(result.current).toEqual({ days: 3, hours: 3, minutes: 4, seconds: 5, done: false });
  });

  it('decrements each second while active', () => {
    const target = new Date('2026-04-17T00:00:10Z'); // +10s
    const { result } = renderHook(() => useCountdown(target, true));

    expect(result.current.seconds).toBe(10);
    expect(result.current.done).toBe(false);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.seconds).toBe(7);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.seconds).toBe(2);
  });

  it('clamps to zero and flips done=true at the boundary', () => {
    const target = new Date('2026-04-17T00:00:02Z'); // +2s
    const { result } = renderHook(() => useCountdown(target, true));

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0, done: true });
  });

  it('treats a target already in the past as done from the start', () => {
    const target = new Date('2026-04-01T00:00:00Z');
    const { result } = renderHook(() => useCountdown(target, true));

    expect(result.current.done).toBe(true);
    expect(result.current.days).toBe(0);
  });

  it('stops scheduling ticks once remaining hits zero', () => {
    const target = new Date('2026-04-17T00:00:01Z'); // +1s
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

    const { result } = renderHook(() => useCountdown(target, true));
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    const intervalId = setIntervalSpy.mock.results[0].value;

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.done).toBe(true);
    expect(clearIntervalSpy).toHaveBeenCalledWith(intervalId);

    // Further time should not change state (interval is gone).
    const snapshot = result.current;
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(result.current).toBe(snapshot);
  });

  it('does not schedule an interval when inactive', () => {
    const target = new Date('2026-04-29T00:00:00Z');
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');

    renderHook(() => useCountdown(target, false));
    expect(setIntervalSpy).not.toHaveBeenCalled();
  });

  it('does not schedule an interval when target is already past', () => {
    const target = new Date('2026-04-01T00:00:00Z');
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');

    renderHook(() => useCountdown(target, true));
    expect(setIntervalSpy).not.toHaveBeenCalled();
  });

  it('clears the interval when active flips false', () => {
    const target = new Date('2026-04-29T00:00:00Z');
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

    const { rerender } = renderHook(({ active }) => useCountdown(target, active), {
      initialProps: { active: true },
    });
    const priorCalls = clearIntervalSpy.mock.calls.length;

    rerender({ active: false });
    expect(clearIntervalSpy.mock.calls.length).toBeGreaterThan(priorCalls);
  });
});
