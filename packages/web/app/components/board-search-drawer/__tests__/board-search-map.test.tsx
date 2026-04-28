// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { render, act, fireEvent } from '@testing-library/react';
import React from 'react';
import BoardSearchMap from '../board-search-map';

// Shared mock state. `vi.hoisted` runs before the `vi.mock` factory below
// (which is itself hoisted above imports), so the factory can reference it.
const { mockState, resetMockState } = vi.hoisted(() => {
  type Handlers = { moveend: Array<() => void>; once: Array<() => void> };
  type MockMap = {
    setView: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
    once: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    getCenter: ReturnType<typeof vi.fn>;
    getZoom: ReturnType<typeof vi.fn>;
    invalidateSize: ReturnType<typeof vi.fn>;
    flyTo: ReturnType<typeof vi.fn>;
  };
  const state: { handlers: Handlers; map: MockMap | null; LMap: ((...args: unknown[]) => MockMap | null) | null } = {
    handlers: { moveend: [], once: [] },
    map: null,
    LMap: null,
  };

  function buildMockMap(): MockMap {
    const m: Partial<MockMap> = {};
    m.setView = vi.fn(() => m as MockMap);
    m.on = vi.fn((event: string, fn: () => void) => {
      if (event === 'moveend') state.handlers.moveend.push(fn);
      return m as MockMap;
    });
    m.off = vi.fn((event: string, fn?: () => void) => {
      if (event === 'moveend') {
        state.handlers.moveend = fn ? state.handlers.moveend.filter((h) => h !== fn) : [];
      }
      return m as MockMap;
    });
    m.once = vi.fn((event: string, fn: () => void) => {
      if (event === 'moveend') state.handlers.once.push(fn);
      return m as MockMap;
    });
    m.remove = vi.fn();
    m.getCenter = vi.fn(() => ({ lat: 1, lng: 2 }));
    m.getZoom = vi.fn(() => 12);
    m.invalidateSize = vi.fn();
    m.flyTo = vi.fn();
    return m as MockMap;
  }

  return {
    mockState: state,
    resetMockState: () => {
      state.handlers.moveend = [];
      state.handlers.once = [];
      state.map = buildMockMap();
      state.LMap = vi.fn(() => state.map);
    },
  };
});

vi.mock('leaflet', () => {
  const L = {
    map: (...args: unknown[]) => mockState.LMap!(...args),
    tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
    layerGroup: vi.fn(() => {
      const layer = { addTo: vi.fn(() => layer), removeLayer: vi.fn() };
      return layer;
    }),
    divIcon: vi.fn(() => ({})),
    marker: vi.fn(() => ({ on: vi.fn(), addTo: vi.fn(), setIcon: vi.fn() })),
  };
  return { default: L, ...L };
});

vi.mock('leaflet/dist/leaflet.css', () => ({}));

const baseProps = {
  center: { lat: 0, lng: 0 },
  zoom: 2,
  boards: [],
  selectedBoardUuid: null,
  userCoords: null,
  requestPermission: vi.fn(),
  onBoardClick: vi.fn(),
};

describe('BoardSearchMap lifecycle', () => {
  beforeEach(() => {
    resetMockState();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Reproduces the production crash: during cleanup, Leaflet's internal
  // teardown emits a `moveend`. Without our fix, that re-runs fireViewport,
  // schedules a fresh setTimeout, and 250ms later calls getCenter() on a
  // destroyed _mapPane. The fix is twofold:
  //   1. `map.off('moveend')` runs BEFORE `map.remove()` so teardown events
  //      can no longer reach fireViewport.
  //   2. The setTimeout body checks cancelledRef as a belt-and-braces guard.
  it('does not call map.getCenter() if Leaflet emits moveend during teardown', async () => {
    vi.useFakeTimers();
    const onViewportChange = vi.fn();

    const { unmount } = render(<BoardSearchMap {...baseProps} onViewportChange={onViewportChange} />);

    // Flush the async Leaflet import. waitFor can't be used here because its
    // setInterval retry mechanism is frozen by vi.useFakeTimers(). Promise
    // microtasks are unaffected by fake timers, so two ticks suffice: one for
    // Promise.all to coalesce, one for the .then() to run. The explicit expect
    // makes failure loud if the flush depth ever needs to change.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockState.handlers.moveend.length).toBeGreaterThan(0);

    // Simulate Leaflet's internal teardown emitting moveend during remove().
    mockState.map!.remove.mockImplementation(() => {
      mockState.handlers.moveend.forEach((fn: () => void) => fn());
    });

    act(() => {
      unmount();
    });

    // Cleanup must detach moveend BEFORE removing the map. With this order,
    // remove()'s teardown emission finds no handlers and schedules nothing.
    expect(mockState.map!.off).toHaveBeenCalledWith('moveend', expect.any(Function));
    const offOrder = mockState.map!.off.mock.invocationCallOrder.at(-1)!;
    const removeOrder = mockState.map!.remove.mock.invocationCallOrder.at(-1)!;
    expect(offOrder).toBeLessThan(removeOrder);

    mockState.map!.getCenter.mockClear();

    // Advance well past the debounce. If a stale setTimeout slipped through,
    // it would fire here and the cancelledRef guard catches it.
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(mockState.map!.getCenter).not.toHaveBeenCalled();
    expect(onViewportChange).not.toHaveBeenCalled();
  });

  // Even if a moveend slips through before unmount and schedules a debounced
  // viewport timer, the cleanup's clearTimeout and the cancelledRef guard
  // ensure the callback is a no-op against the destroyed map.
  it('does not fire the debounced viewport callback against a destroyed map', async () => {
    vi.useFakeTimers();
    const onViewportChange = vi.fn();

    const { unmount } = render(<BoardSearchMap {...baseProps} onViewportChange={onViewportChange} />);

    // Same flush approach as the teardown test above: fake timers freeze
    // waitFor's setInterval, so we flush microtasks manually instead.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockState.handlers.moveend.length).toBeGreaterThan(0);

    act(() => {
      mockState.handlers.moveend.forEach((fn: () => void) => fn());
    });

    act(() => {
      unmount();
    });

    mockState.map!.getCenter.mockClear();

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(mockState.map!.getCenter).not.toHaveBeenCalled();
    expect(onViewportChange).not.toHaveBeenCalled();
  });

  // At-destination guard: if the map is already at the user's location and
  // zoom level, flyTo would be a no-op and never emit moveend, so the once()
  // handler would never fire. The guard detects this and calls onViewportChange
  // immediately instead of relying on a moveend that will never come.
  it('calls onViewportChange immediately when map is already at user location', async () => {
    // 13 matches the component's internal FLY_TO_ZOOM. Not exported — that
    // would couple the public API to test infrastructure. If the component
    // changes the zoom, this test fails: flyTo fires and the not.toHaveBeenCalled
    // assertion below catches it.
    const FLY_TO_ZOOM = 13;
    mockState.map!.getCenter.mockReturnValue({ lat: 37.5, lng: -122.1 });
    mockState.map!.getZoom.mockReturnValue(FLY_TO_ZOOM);

    const onViewportChange = vi.fn();
    const userCoords = { latitude: 37.5, longitude: -122.1 };

    const { findByRole } = render(
      <BoardSearchMap {...baseProps} userCoords={userCoords} onViewportChange={onViewportChange} />,
    );

    const button = await findByRole('button', { name: /my location/i });

    fireEvent.click(button);

    expect(mockState.map!.flyTo).not.toHaveBeenCalled();
    expect(mockState.map!.once).not.toHaveBeenCalled();
    expect(onViewportChange).toHaveBeenCalledWith({ lat: 37.5, lng: -122.1, zoom: FLY_TO_ZOOM });
  });

  // Per-invocation `cancelled` guard: if the component unmounts before the
  // dynamic Leaflet import resolves, the import callback must bail out
  // without creating a map. A shared ref would be reset by a subsequent
  // mount and the stale callback would then create a second map on the
  // (now reused) container.
  it('does not initialize a Leaflet map when unmounted before the import resolves', async () => {
    const { unmount } = render(<BoardSearchMap {...baseProps} onViewportChange={vi.fn()} />);

    // Synchronously unmount BEFORE letting microtasks flush.
    unmount();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockState.LMap).not.toHaveBeenCalled();
  });
});
