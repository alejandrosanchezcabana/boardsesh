import { describe, expect, it } from 'vitest';
import { darkTokens, themeTokens } from '@/app/theme/theme-config';
import { getHoldStatusChipStyles } from '../hold-status-chip';

describe('getHoldStatusChipStyles', () => {
  it('returns neutral inactive styles', () => {
    expect(getHoldStatusChipStyles('primary', false, false)).toEqual({
      backgroundColor: 'var(--neutral-100)',
      color: 'var(--neutral-600)',
      border: '1px solid var(--neutral-200)',
    });
  });

  it('returns light-mode success styles', () => {
    expect(getHoldStatusChipStyles('success', true, false)).toEqual({
      backgroundColor: themeTokens.colors.successBg,
      color: themeTokens.colors.success,
      border: `1px solid ${themeTokens.colors.success}33`,
    });
  });

  it('returns dark-mode error styles', () => {
    expect(getHoldStatusChipStyles('error', true, true)).toEqual({
      backgroundColor: darkTokens.statusBg.error,
      color: themeTokens.colors.error,
      border: `1px solid ${themeTokens.colors.error}52`,
    });
  });

  it('returns dark-mode pink styles for finish chips', () => {
    expect(getHoldStatusChipStyles('pink', true, true)).toEqual({
      backgroundColor: `${themeTokens.colors.pink}29`,
      color: themeTokens.colors.pink,
      border: `1px solid ${themeTokens.colors.pink}52`,
    });
  });
});
