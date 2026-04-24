import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { renderHook, act } from '@testing-library/react';
import { useShakeDetector } from '../use-shake-detector';

type MotionHandler = (event: { acceleration: { x: number; y: number; z: number } }) => void;

interface MockMotionPlugin {
  addListener: ReturnType<typeof vi.fn>;
  removeAllListeners: ReturnType<typeof vi.fn>;
  __lastHandler: MotionHandler | null;
  __removeSpy: ReturnType<typeof vi.fn>;
}

function installCapacitorMock(): MockMotionPlugin {
  const removeSpy = vi.fn().mockResolvedValue(undefined);
  const plugin: MockMotionPlugin = {
    addListener: vi.fn(),
    removeAllListeners: vi.fn().mockResolvedValue(undefined),
    __lastHandler: null,
    __removeSpy: removeSpy,
  };
  plugin.addListener.mockImplementation(async (_event: string, handler: MotionHandler) => {
    plugin.__lastHandler = handler;
    return { remove: removeSpy };
  });
  (window as unknown as { Capacitor?: unknown }).Capacitor = {
    isNativePlatform: () => true,
    getPlatform: () => 'ios',
    Plugins: { Motion: plugin },
  };
  return plugin;
}

function uninstallCapacitor() {
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
}

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

// Coordinates that produce a magnitude well above the default 15 m/s² threshold.
const STRONG = { x: 20, y: 0, z: 0 };

describe('useShakeDetector — native path', () => {
  let mock: MockMotionPlugin;

  beforeEach(() => {
    mock = installCapacitorMock();
  });

  afterEach(() => {
    uninstallCapacitor();
    vi.restoreAllMocks();
  });

  it('subscribes to the Motion plugin on mount', async () => {
    const onShake = vi.fn();
    renderHook(() => useShakeDetector(onShake));
    await flushMicrotasks();
    expect(mock.addListener).toHaveBeenCalledTimes(1);
    expect(mock.addListener).toHaveBeenCalledWith('accel', expect.any(Function));
  });

  it('does not subscribe when enabled=false', async () => {
    renderHook(() => useShakeDetector(vi.fn(), { enabled: false }));
    await flushMicrotasks();
    expect(mock.addListener).not.toHaveBeenCalled();
  });

  it('removes the listener on unmount', async () => {
    const { unmount } = renderHook(() => useShakeDetector(vi.fn()));
    await flushMicrotasks();
    unmount();
    await flushMicrotasks();
    expect(mock.__removeSpy).toHaveBeenCalledTimes(1);
  });

  it('invokes onShake after three strong jolts inside the window', async () => {
    const onShake = vi.fn();
    renderHook(() => useShakeDetector(onShake));
    await flushMicrotasks();

    const send = (ms: number) => {
      vi.setSystemTime(ms);
      act(() => {
        mock.__lastHandler?.({ acceleration: STRONG });
      });
    };

    vi.useFakeTimers();
    send(0);
    send(200);
    send(400);
    vi.useRealTimers();

    expect(onShake).toHaveBeenCalledTimes(1);
  });

  it('does NOT fall through to devicemotion when running inside the native shell without the Motion plugin', async () => {
    // Simulate a Capacitor WebView where `window.Capacitor` is injected and
    // isNativePlatform() is true, but the Motion plugin isn't registered.
    // The hook must bail rather than wire up a devicemotion listener — the
    // native app has its own shake handling and we mustn't double-fire.
    (window as unknown as { Capacitor: unknown }).Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => 'android',
      Plugins: {}, // no Motion
    };
    (globalThis as unknown as { DeviceMotionEvent: object }).DeviceMotionEvent = function DeviceMotionEvent() {};
    const addSpy = vi.spyOn(window, 'addEventListener');

    renderHook(() => useShakeDetector(vi.fn()));
    await flushMicrotasks();

    expect(addSpy).not.toHaveBeenCalledWith('devicemotion', expect.any(Function));

    delete (globalThis as unknown as { DeviceMotionEvent?: unknown }).DeviceMotionEvent;
  });

  it('re-subscribes when enabled toggles from false to true', async () => {
    const { rerender } = renderHook(({ enabled }) => useShakeDetector(vi.fn(), { enabled }), {
      initialProps: { enabled: false },
    });
    await flushMicrotasks();
    expect(mock.addListener).not.toHaveBeenCalled();

    rerender({ enabled: true });
    await flushMicrotasks();
    expect(mock.addListener).toHaveBeenCalledTimes(1);
  });
});

describe('useShakeDetector — browser path (no requestPermission)', () => {
  let addSpy: ReturnType<typeof vi.spyOn>;
  let removeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Ensure DeviceMotionEvent exists but has no requestPermission method (Android, older iOS).
    (globalThis as unknown as { DeviceMotionEvent: object }).DeviceMotionEvent = function DeviceMotionEvent() {};
    addSpy = vi.spyOn(window, 'addEventListener');
    removeSpy = vi.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    uninstallCapacitor();
    vi.restoreAllMocks();
    delete (globalThis as unknown as { DeviceMotionEvent?: unknown }).DeviceMotionEvent;
  });

  it("wires window.addEventListener('devicemotion', ...) directly", async () => {
    renderHook(() => useShakeDetector(vi.fn()));
    await flushMicrotasks();
    expect(addSpy).toHaveBeenCalledWith('devicemotion', expect.any(Function));
  });

  it('removes the devicemotion listener on unmount', async () => {
    const { unmount } = renderHook(() => useShakeDetector(vi.fn()));
    await flushMicrotasks();
    const addedCall = addSpy.mock.calls.find(([event]: [string, unknown]) => event === 'devicemotion');
    const attachedHandler = addedCall?.[1];
    unmount();
    await flushMicrotasks();
    expect(removeSpy).toHaveBeenCalledWith('devicemotion', attachedHandler);
  });
});

describe('useShakeDetector — iOS 13+ permission path', () => {
  let requestPermission: ReturnType<typeof vi.fn>;
  let addSpy: ReturnType<typeof vi.spyOn>;
  let docAddSpy: ReturnType<typeof vi.spyOn>;
  let docRemoveSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    requestPermission = vi.fn();
    const stub = function DeviceMotionEvent() {} as unknown as { requestPermission: typeof requestPermission };
    stub.requestPermission = requestPermission;
    (globalThis as unknown as { DeviceMotionEvent: typeof stub }).DeviceMotionEvent = stub;
    addSpy = vi.spyOn(window, 'addEventListener');
    docAddSpy = vi.spyOn(document, 'addEventListener');
    docRemoveSpy = vi.spyOn(document, 'removeEventListener');
  });

  afterEach(() => {
    uninstallCapacitor();
    vi.restoreAllMocks();
    delete (globalThis as unknown as { DeviceMotionEvent?: unknown }).DeviceMotionEvent;
  });

  it('defers listener attachment to a pointerdown gesture', async () => {
    renderHook(() => useShakeDetector(vi.fn()));
    await flushMicrotasks();
    // No devicemotion listener yet — waiting for gesture.
    expect(addSpy).not.toHaveBeenCalledWith('devicemotion', expect.any(Function));
    expect(docAddSpy).toHaveBeenCalledWith('pointerdown', expect.any(Function));
  });

  it('attaches devicemotion once the user grants permission', async () => {
    requestPermission.mockResolvedValue('granted');
    renderHook(() => useShakeDetector(vi.fn()));
    await flushMicrotasks();

    const gestureCall = docAddSpy.mock.calls.find(([event]: [string, unknown]) => event === 'pointerdown');
    const gestureHandler = gestureCall?.[1] as () => Promise<void>;
    await act(async () => {
      await gestureHandler();
    });

    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(addSpy).toHaveBeenCalledWith('devicemotion', expect.any(Function));
  });

  it('bails silently when permission is denied', async () => {
    requestPermission.mockResolvedValue('denied');
    renderHook(() => useShakeDetector(vi.fn()));
    await flushMicrotasks();

    const gestureCall = docAddSpy.mock.calls.find(([event]: [string, unknown]) => event === 'pointerdown');
    const gestureHandler = gestureCall?.[1] as () => Promise<void>;
    await act(async () => {
      await gestureHandler();
    });

    expect(addSpy).not.toHaveBeenCalledWith('devicemotion', expect.any(Function));
  });

  it('cleans up the pending pointerdown listener if unmounted before gesture', async () => {
    requestPermission.mockResolvedValue('granted');
    const { unmount } = renderHook(() => useShakeDetector(vi.fn()));
    await flushMicrotasks();
    unmount();
    await flushMicrotasks();
    expect(docRemoveSpy).toHaveBeenCalledWith('pointerdown', expect.any(Function));
  });
});

describe('useShakeDetector — no motion API available', () => {
  it('is a safe no-op', async () => {
    expect(() => renderHook(() => useShakeDetector(vi.fn()))).not.toThrow();
  });
});
