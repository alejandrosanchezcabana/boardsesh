import { describe, it, expect, vi } from 'vite-plus/test';
import { renderHook } from '@testing-library/react';
import { useColorMode } from '@/app/hooks/use-color-mode';
import { useIsDarkMode } from '../use-is-dark-mode';

vi.mock('@/app/hooks/use-color-mode', () => ({
  useColorMode: vi.fn(),
}));

const mockUseColorMode = vi.mocked(useColorMode);

describe('useIsDarkMode', () => {
  it('returns true when mode is dark', () => {
    mockUseColorMode.mockReturnValue({
      mode: 'dark',
      toggleMode: vi.fn(),
    });

    const { result } = renderHook(() => useIsDarkMode());

    expect(result.current).toBe(true);
  });

  it('returns false when mode is light', () => {
    mockUseColorMode.mockReturnValue({
      mode: 'light',
      toggleMode: vi.fn(),
    });

    const { result } = renderHook(() => useIsDarkMode());

    expect(result.current).toBe(false);
  });
});
