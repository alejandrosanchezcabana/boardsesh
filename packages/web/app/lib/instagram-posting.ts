'use client';

import { getPlatform, isNativeApp } from '@/app/lib/ble/capacitor-utils';

export type InstagramPostingPlatform = 'ios' | 'android' | 'unsupported';

export interface InstagramCaptionInput {
  climbName: string;
  angle: number;
  boardType?: string;
}

const BOARD_CAPTION_CONFIG: Record<string, { name: string; handle: string; hashtags: string }> = {
  kilter: { name: 'Kilter Board', handle: '@kilterboard', hashtags: '#kilterboard #kiltergrips' },
  tension: { name: 'Tension Board', handle: '@tensionclimbing', hashtags: '#tensionboard' },
  moonboard: { name: 'MoonBoard', handle: '@moon_climbing', hashtags: '#moonboard' },
};

export interface CopyAndOpenInstagramResult {
  copied: boolean;
  opened: boolean;
}

const IOS_INSTAGRAM_CREATE_URL = 'instagram://camera';
const ANDROID_INSTAGRAM_OPEN_URL = 'instagram://camera';

const CLIPBOARD_SETTLE_DELAY_MS = 180;

function legacyTextareaCopy(text: string): boolean {
  if (typeof document === 'undefined') return false;

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.top = '0';
  textarea.style.left = '0';
  textarea.style.pointerEvents = 'none';
  textarea.style.fontSize = '16px';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  try {
    return document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }
}

function legacyContentEditableCopy(text: string): boolean {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false;

  const container = document.createElement('div');
  container.textContent = text;
  container.contentEditable = 'true';
  container.setAttribute('aria-hidden', 'true');
  container.style.position = 'fixed';
  container.style.opacity = '0';
  container.style.top = '0';
  container.style.left = '0';
  container.style.whiteSpace = 'pre-wrap';
  container.style.userSelect = 'text';
  container.style.webkitUserSelect = 'text';
  container.style.pointerEvents = 'none';
  document.body.appendChild(container);

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(container);
  selection?.removeAllRanges();
  selection?.addRange(range);

  try {
    return document.execCommand('copy');
  } finally {
    selection?.removeAllRanges();
    document.body.removeChild(container);
  }
}

function legacyCopy(text: string, platform: InstagramPostingPlatform): boolean {
  if (platform === 'ios') {
    return legacyContentEditableCopy(text) || legacyTextareaCopy(text);
  }

  return legacyTextareaCopy(text);
}

async function copyToClipboard(text: string, platform: InstagramPostingPlatform): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    return legacyCopy(text, platform);
  } catch {
    return legacyCopy(text, platform);
  }
}

function getWebPlatformFromUserAgent(): InstagramPostingPlatform {
  if (typeof navigator === 'undefined') return 'unsupported';

  const ua = navigator.userAgent || '';
  if (/iPhone/i.test(ua)) return 'ios';
  if (/Android/i.test(ua) && /Mobile/i.test(ua)) return 'android';
  return 'unsupported';
}

export function getInstagramPostingPlatform(): InstagramPostingPlatform {
  if (typeof window === 'undefined') return 'unsupported';

  if (isNativeApp()) {
    const platform = getPlatform();
    if (platform === 'ios' || platform === 'android') return platform;
  }

  return getWebPlatformFromUserAgent();
}

export function isInstagramPostingSupported(): boolean {
  return getInstagramPostingPlatform() !== 'unsupported';
}

export function buildInstagramCaption({
  climbName,
  angle,
  boardType = 'kilter',
}: InstagramCaptionInput): string {
  const config = BOARD_CAPTION_CONFIG[boardType] ?? BOARD_CAPTION_CONFIG.kilter;
  return `"${climbName}" @ ${angle}\u00b0 on the ${config.name}.\n${config.handle} ${config.hashtags}`;
}

function getInstagramLaunchUrl(platform: InstagramPostingPlatform): string | null {
  switch (platform) {
    case 'ios':
      return IOS_INSTAGRAM_CREATE_URL;
    case 'android':
      return ANDROID_INSTAGRAM_OPEN_URL;
    default:
      return null;
  }
}

function attemptInstagramLaunch(platform: InstagramPostingPlatform): Promise<boolean> {
  const launchUrl = getInstagramLaunchUrl(platform);
  if (!launchUrl || typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    let finished = false;

    const cleanup = () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange, true);
      window.removeEventListener('pagehide', handlePageHide, true);
      window.clearTimeout(timeoutId);
    };

    const finish = (opened: boolean) => {
      if (finished) return;
      finished = true;
      cleanup();
      resolve(opened);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' || document.hidden) {
        finish(true);
      }
    };

    const handlePageHide = () => finish(true);

    document.addEventListener('visibilitychange', handleVisibilityChange, true);
    window.addEventListener('pagehide', handlePageHide, true);

    const timeoutId = window.setTimeout(() => {
      finish(document.visibilityState === 'hidden' || document.hidden);
    }, 1400);

    window.location.href = launchUrl;
  });
}

function settleClipboardWrite(platform: InstagramPostingPlatform): Promise<void> {
  if (platform !== 'ios' || isNativeApp() || typeof window === 'undefined') {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    window.setTimeout(resolve, CLIPBOARD_SETTLE_DELAY_MS);
  });
}

export async function copyAndOpenInstagram(caption: string): Promise<CopyAndOpenInstagramResult> {
  const platform = getInstagramPostingPlatform();
  const copied = await copyToClipboard(caption, platform);
  if (!copied) {
    return { copied: false, opened: false };
  }

  await settleClipboardWrite(platform);
  const opened = await attemptInstagramLaunch(platform);
  return { copied, opened };
}
