import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SESH_SETTINGS_DRAWER_EVENT, dispatchOpenSeshSettingsDrawer } from '../sesh-settings-drawer-event';

describe('sesh-settings-drawer-event', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports the expected event name constant', () => {
    expect(SESH_SETTINGS_DRAWER_EVENT).toBe('boardsesh:open-sesh-settings-drawer');
  });

  it('dispatches a CustomEvent on the window', () => {
    const listener = vi.fn();
    window.addEventListener(SESH_SETTINGS_DRAWER_EVENT, listener);

    dispatchOpenSeshSettingsDrawer();

    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0][0] as Event;
    expect(event).toBeInstanceOf(CustomEvent);
    expect(event.type).toBe(SESH_SETTINGS_DRAWER_EVENT);

    window.removeEventListener(SESH_SETTINGS_DRAWER_EVENT, listener);
  });

  it('does not throw when window is undefined (SSR safety)', () => {
    const originalWindow = globalThis.window;

    // Temporarily make window undefined to simulate SSR
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Object.defineProperty(globalThis, 'window', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    expect(() => dispatchOpenSeshSettingsDrawer()).not.toThrow();

    // Restore window
    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      writable: true,
      configurable: true,
    });
  });
});
