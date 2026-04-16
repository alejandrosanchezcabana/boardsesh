import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  buildInstagramCaption,
  copyAndOpenInstagram,
  getInstagramPostingPlatform,
  isInstagramPostingSupported,
} from '../instagram-posting';

const originalNavigator = global.navigator;
const originalWindow = global.window;
const originalDocument = global.document;

describe('instagram-posting', () => {
  beforeEach(() => {
    Object.defineProperty(global, 'window', {
      configurable: true,
      value: {
        Capacitor: undefined,
        location: { href: '' },
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        clearTimeout: vi.fn(),
        setTimeout: vi.fn((callback: () => void) => {
          queueMicrotask(callback);
          return 1;
        }),
      },
    });

    Object.defineProperty(global, 'navigator', {
      configurable: true,
      value: {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
      },
    });

    Object.defineProperty(global, 'document', {
      configurable: true,
      value: {
        visibilityState: 'hidden',
        hidden: true,
        body: {
          appendChild: vi.fn(),
          removeChild: vi.fn(),
        },
        createElement: vi.fn((tag: string) => ({
          tagName: tag.toUpperCase(),
          style: {},
          value: '',
          textContent: '',
          contentEditable: '',
          focus: vi.fn(),
          select: vi.fn(),
          setSelectionRange: vi.fn(),
          setAttribute: vi.fn(),
        })),
        execCommand: vi.fn(() => true),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        createRange: vi.fn(() => ({
          selectNodeContents: vi.fn(),
        })),
      },
    });

    Object.defineProperty(global.window, 'getSelection', {
      configurable: true,
      value: vi.fn(() => ({
        removeAllRanges: vi.fn(),
        addRange: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    Object.defineProperty(global, 'navigator', {
      configurable: true,
      value: originalNavigator,
    });
    Object.defineProperty(global, 'window', {
      configurable: true,
      value: originalWindow,
    });
    Object.defineProperty(global, 'document', {
      configurable: true,
      value: originalDocument,
    });
  });

  it('builds the exact caption format for Kilter', () => {
    expect(buildInstagramCaption({ climbName: 'Texas Sun', angle: 35 })).toBe(
      `"Texas Sun" @ 35° on the Kilter Board.\n@kilterboard #kilterboard #kiltergrips`,
    );
  });

  it('detects iPhone web as supported', () => {
    expect(getInstagramPostingPlatform()).toBe('ios');
    expect(isInstagramPostingSupported()).toBe(true);
  });

  it('detects Android mobile web as supported', () => {
    Object.defineProperty(global, 'navigator', {
      configurable: true,
      value: {
        userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/136.0 Mobile Safari/537.36',
      },
    });

    expect(getInstagramPostingPlatform()).toBe('android');
    expect(isInstagramPostingSupported()).toBe(true);
  });

  it('treats desktop web as unsupported', () => {
    Object.defineProperty(global, 'navigator', {
      configurable: true,
      value: {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/136.0 Safari/537.36',
      },
    });

    expect(getInstagramPostingPlatform()).toBe('unsupported');
    expect(isInstagramPostingSupported()).toBe(false);
  });

  it('falls back to legacy copy and still opens instagram on iPhone web', async () => {
    Object.defineProperty(global, 'navigator', {
      configurable: true,
      value: {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
      },
    });

    const result = await copyAndOpenInstagram('"There, There" @ 40° on the Kilter Board.');

    expect(global.document.execCommand).toHaveBeenCalledWith('copy');
    expect(result).toEqual({ copied: true, opened: true });
    expect(global.window.location.href).toBe('instagram://camera');
  });
});
