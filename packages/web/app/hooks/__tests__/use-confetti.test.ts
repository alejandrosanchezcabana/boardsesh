import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { renderHook } from '@testing-library/react';
import confetti from 'canvas-confetti';
import { useConfetti } from '../use-confetti';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

const mockConfetti = vi.mocked(confetti);

function createMockElement(x = 100, y = 400, width = 40, height = 40): HTMLElement {
  const el = document.createElement('button');
  el.getBoundingClientRect = () => ({
    left: x,
    top: y,
    width,
    height,
    right: x + width,
    bottom: y + height,
    x,
    y,
    toJSON: () => ({}),
  });
  return el;
}

describe('useConfetti', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockConfetti.mockClear();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a stable fireConfetti function', () => {
    const { result, rerender } = renderHook(() => useConfetti());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  describe('ascent variant (default)', () => {
    it('fires confetti with default multi-colour config', () => {
      const { result } = renderHook(() => useConfetti());
      result.current(null);

      expect(mockConfetti).toHaveBeenCalledTimes(1);
      const opts = mockConfetti.mock.calls[0][0]!;
      expect(opts.particleCount).toBe(35);
      expect(opts.spread).toBe(60);
      expect(opts.startVelocity).toBe(25);
      expect(opts.colors).toBeUndefined();
    });

    it('uses bottom-center origin when no element provided', () => {
      const { result } = renderHook(() => useConfetti());
      result.current(null, 'ascent');

      const opts = mockConfetti.mock.calls[0][0]!;
      expect(opts.origin).toEqual({ x: 0.5, y: 0.9 });
    });

    it('calculates origin from element bounding rect', () => {
      const { result } = renderHook(() => useConfetti());
      const el = createMockElement(100, 400, 40, 40);

      // Mock window dimensions
      Object.defineProperty(window, 'innerWidth', { value: 400, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: 800, writable: true });

      result.current(el, 'ascent');

      const opts = mockConfetti.mock.calls[0][0]!;
      // (100 + 20) / 400 = 0.3
      expect(opts.origin!.x).toBeCloseTo(0.3);
      // (400 + 20) / 800 = 0.525
      expect(opts.origin!.y).toBeCloseTo(0.525);
    });
  });

  describe('attempt variant', () => {
    it('fires confetti with red colours and reduced velocity/spread', () => {
      const { result } = renderHook(() => useConfetti());
      result.current(null, 'attempt');

      expect(mockConfetti).toHaveBeenCalledTimes(1);
      const opts = mockConfetti.mock.calls[0][0]!;
      expect(opts.particleCount).toBe(35);
      expect(opts.spread).toBe(40);
      expect(opts.startVelocity).toBe(12);
      expect(opts.colors).toEqual(['#d32f2f', '#b71c1c', '#e53935']);
    });
  });

  describe('flash variant (lightning bolts)', () => {
    it('does not fire canvas-confetti', () => {
      const { result } = renderHook(() => useConfetti());
      const el = createMockElement();
      result.current(el, 'flash');

      expect(mockConfetti).not.toHaveBeenCalled();
    });

    it('appends an overlay to document.body with correct styles', () => {
      const { result } = renderHook(() => useConfetti());
      const el = createMockElement();
      result.current(el, 'flash');

      const overlay = document.body.querySelector('[style*="z-index"]') as HTMLElement;
      expect(overlay).not.toBeNull();
      expect(overlay.style.position).toBe('fixed');
      expect(overlay.style.pointerEvents).toBe('none');
    });

    it('overlay contains SVG with filled bolt paths', () => {
      const { result } = renderHook(() => useConfetti());
      const el = createMockElement();
      result.current(el, 'flash');

      const overlay = document.body.querySelector('[style*="z-index"]') as HTMLElement;
      expect(overlay.innerHTML).toContain('<svg');
      expect(overlay.innerHTML).toContain('<path');
      // Bolts are filled yellow with dark outline
      expect(overlay.innerHTML).toContain('#FDE74C');
      expect(overlay.innerHTML).toContain('#333');
    });

    it('generates 6 bolt groups', () => {
      const { result } = renderHook(() => useConfetti());
      const el = createMockElement();
      result.current(el, 'flash');

      const overlay = document.body.querySelector('[style*="z-index"]') as HTMLElement;
      // Each bolt is a <g> with data-tx attribute
      const boltMatches = overlay.innerHTML.match(/data-tx/g);
      expect(boltMatches?.length).toBe(6);
    });

    it('removes overlay after 300ms', () => {
      const { result } = renderHook(() => useConfetti());
      const el = createMockElement();
      result.current(el, 'flash');

      const overlays = document.body.querySelectorAll('[style*="z-index"]');
      expect(overlays.length).toBe(1);
      vi.advanceTimersByTime(300);
      const overlaysAfter = document.body.querySelectorAll('[style*="z-index"]');
      expect(overlaysAfter.length).toBe(0);
    });

    it('does nothing when no origin element provided', () => {
      const { result } = renderHook(() => useConfetti());
      result.current(null, 'flash');

      expect(mockConfetti).not.toHaveBeenCalled();
      const overlays = document.body.querySelectorAll('[style*="z-index"]');
      expect(overlays.length).toBe(0);
    });
  });
});
