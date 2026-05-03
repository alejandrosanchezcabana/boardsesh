import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { tFromCatalog } from '@/app/__test-helpers__/i18n-mock';
import ZoomableBoard from '../zoomable-board';

vi.mock('react-i18next', () => ({
  useTranslation: (ns?: string) => ({
    t: (key: string, options?: Record<string, unknown>) => tFromCatalog(ns, key, options),
    i18n: { language: 'en-US' },
  }),
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

// Mock the useZoomPan hook
const mockResetZoom = vi.fn();
const mockUseZoomPan = vi.fn(() => ({
  containerRef: vi.fn(),
  contentRef: { current: null },
  isZoomed: false,
  resetZoom: mockResetZoom,
}));

vi.mock('@/app/lib/hooks/use-zoom-pan', () => ({
  useZoomPan: () => mockUseZoomPan(),
}));

describe('ZoomableBoard', () => {
  const defaultProps = {
    onZoomChange: vi.fn(),
    resetKey: 'climb-1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseZoomPan.mockReturnValue({
      containerRef: vi.fn(),
      contentRef: { current: null },
      isZoomed: false,
      resetZoom: mockResetZoom,
    });
  });

  it('renders children', () => {
    render(
      <ZoomableBoard {...defaultProps}>
        <div data-testid="board-content">Board</div>
      </ZoomableBoard>,
    );

    expect(screen.getByTestId('board-content')).toBeTruthy();
  });

  it('renders reset button', () => {
    render(
      <ZoomableBoard {...defaultProps}>
        <div>Board</div>
      </ZoomableBoard>,
    );

    expect(screen.getByLabelText('Reset zoom')).toBeTruthy();
  });

  it('reset button is not interactive when not zoomed', () => {
    render(
      <ZoomableBoard {...defaultProps}>
        <div>Board</div>
      </ZoomableBoard>,
    );

    const resetButton = screen.getByLabelText('Reset zoom');
    expect(resetButton.getAttribute('tabindex')).toBe('-1');
  });

  it('reset button is interactive when zoomed', () => {
    mockUseZoomPan.mockReturnValue({
      containerRef: vi.fn(),
      contentRef: { current: null },
      isZoomed: true,
      resetZoom: mockResetZoom,
    });

    render(
      <ZoomableBoard {...defaultProps}>
        <div>Board</div>
      </ZoomableBoard>,
    );

    const resetButton = screen.getByLabelText('Reset zoom');
    expect(resetButton.getAttribute('tabindex')).toBe('0');
  });

  it('clicking reset button calls resetZoom', () => {
    mockUseZoomPan.mockReturnValue({
      containerRef: vi.fn(),
      contentRef: { current: null },
      isZoomed: true,
      resetZoom: mockResetZoom,
    });

    render(
      <ZoomableBoard {...defaultProps}>
        <div>Board</div>
      </ZoomableBoard>,
    );

    fireEvent.click(screen.getByLabelText('Reset zoom'));
    expect(mockResetZoom).toHaveBeenCalledTimes(1);
  });

  it('calls onZoomChange when zoom state changes', () => {
    const onZoomChange = vi.fn();

    const { rerender } = render(
      <ZoomableBoard {...defaultProps} onZoomChange={onZoomChange}>
        <div>Board</div>
      </ZoomableBoard>,
    );

    expect(onZoomChange).toHaveBeenCalledWith(false);

    // Simulate zoom change
    mockUseZoomPan.mockReturnValue({
      containerRef: vi.fn(),
      contentRef: { current: null },
      isZoomed: true,
      resetZoom: mockResetZoom,
    });

    rerender(
      <ZoomableBoard {...defaultProps} onZoomChange={onZoomChange}>
        <div>Board</div>
      </ZoomableBoard>,
    );

    expect(onZoomChange).toHaveBeenCalledWith(true);
  });

  it('resets zoom when resetKey changes', () => {
    const { rerender } = render(
      <ZoomableBoard {...defaultProps} resetKey="climb-1">
        <div>Board</div>
      </ZoomableBoard>,
    );

    // Initial render should not call resetZoom
    expect(mockResetZoom).not.toHaveBeenCalled();

    // Change resetKey to simulate climb change
    rerender(
      <ZoomableBoard {...defaultProps} resetKey="climb-2">
        <div>Board</div>
      </ZoomableBoard>,
    );

    expect(mockResetZoom).toHaveBeenCalledTimes(1);
  });

  it('does not reset zoom when resetKey stays the same', () => {
    const { rerender } = render(
      <ZoomableBoard {...defaultProps} resetKey="climb-1">
        <div>Board</div>
      </ZoomableBoard>,
    );

    rerender(
      <ZoomableBoard {...defaultProps} resetKey="climb-1">
        <div>Board</div>
      </ZoomableBoard>,
    );

    expect(mockResetZoom).not.toHaveBeenCalled();
  });

  it('sets touch-action to pan-y when not zoomed', () => {
    render(
      <ZoomableBoard {...defaultProps}>
        <div data-testid="board">Board</div>
      </ZoomableBoard>,
    );

    // The container div should have touch-action: pan-y
    const board = screen.getByTestId('board');
    const container = board.parentElement?.parentElement;
    expect(container?.style.touchAction).toBe('pan-y');
  });

  it('sets touch-action to none when zoomed', () => {
    mockUseZoomPan.mockReturnValue({
      containerRef: vi.fn(),
      contentRef: { current: null },
      isZoomed: true,
      resetZoom: mockResetZoom,
    });

    render(
      <ZoomableBoard {...defaultProps}>
        <div data-testid="board">Board</div>
      </ZoomableBoard>,
    );

    const board = screen.getByTestId('board');
    const container = board.parentElement?.parentElement;
    expect(container?.style.touchAction).toBe('none');
  });

  it('adds data-swipe-blocked attribute when zoomed', () => {
    mockUseZoomPan.mockReturnValue({
      containerRef: vi.fn(),
      contentRef: { current: null },
      isZoomed: true,
      resetZoom: mockResetZoom,
    });

    render(
      <ZoomableBoard {...defaultProps}>
        <div data-testid="board">Board</div>
      </ZoomableBoard>,
    );

    const board = screen.getByTestId('board');
    const container = board.parentElement?.parentElement;
    expect(container?.hasAttribute('data-swipe-blocked')).toBe(true);
  });

  it('does not have data-swipe-blocked attribute when not zoomed', () => {
    render(
      <ZoomableBoard {...defaultProps}>
        <div data-testid="board">Board</div>
      </ZoomableBoard>,
    );

    const board = screen.getByTestId('board');
    const container = board.parentElement?.parentElement;
    expect(container?.hasAttribute('data-swipe-blocked')).toBe(false);
  });
});
