// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vite-plus/test';
import React, { useState, useEffect, useLayoutEffect } from 'react';
import { render, act, fireEvent, cleanup } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Isolated test of the queue drawer lazy-mount pattern.
//
// When the play drawer opens, the queue sub-drawer should NOT mount its
// content tree. It should only mount when the user explicitly opens the
// queue (queueMounted=true + isQueueOpen=true), and unmount after the
// close animation or when the play drawer closes.
//
// This mirrors the actual pattern in play-view-drawer.tsx without needing
// the full dependency tree.
// ---------------------------------------------------------------------------

// Track whether the heavy queue content is mounted
const queueContentMounted = { current: false };
const queueContentRenderCount = { current: 0 };

/** Simulates the heavy QueueList tree (~225ms in production) */
const QueueContent = () => {
  queueContentRenderCount.current++;

  useEffect(() => {
    queueContentMounted.current = true;
    return () => {
      queueContentMounted.current = false;
    };
  }, []);

  return <div data-testid="queue-content">Queue List Content</div>;
};

/**
 * Simplified PlayViewDrawer that reproduces the lazy-mount pattern.
 * Mirrors the actual state management:
 * - isOpen: whether the play drawer is open (from activeDrawer === 'play')
 * - isQueueOpen: whether the queue sub-drawer is open
 * - queueMounted: whether the queue sub-drawer tree exists in the DOM
 */
const PlayDrawerSimulation = ({ isOpen: isOpenProp }: { isOpen: boolean }) => {
  const [isOpen, setIsOpen] = useState(isOpenProp);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [queueMounted, setQueueMounted] = useState(false);

  // Expose state setters for testing
  controllerRef.current = {
    setIsOpen,
    setIsQueueOpen,
    setQueueMounted,
    openQueue: () => {
      setQueueMounted(true);
      setIsQueueOpen(true);
    },
    closeQueue: () => {
      setIsQueueOpen(false);
    },
  };

  // Mirror the useLayoutEffect from play-view-drawer.tsx:
  // When play drawer closes, unmount queue immediately
  useLayoutEffect(() => {
    if (!isOpen) {
      setQueueMounted(false);
      setIsQueueOpen(false);
    }
  }, [isOpen]);

  return (
    <div data-testid="play-drawer" data-open={isOpen}>
      {/* Play drawer content (always present when open) */}
      {isOpen && <div data-testid="play-content">Play Content</div>}

      {/* Queue button in action bar */}
      {isOpen && (
        <button
          data-testid="open-queue-btn"
          onClick={() => {
            setQueueMounted(true);
            setIsQueueOpen(true);
          }}
        >
          Open Queue
        </button>
      )}

      {/* Queue sub-drawer — lazy-mounted */}
      {queueMounted && (
        <div data-testid="queue-drawer" data-open={isQueueOpen}>
          <QueueContent />
          <button data-testid="close-queue-btn" onClick={() => setIsQueueOpen(false)}>
            Close Queue
          </button>
          {/* Simulates onTransitionEnd(false) after close animation */}
          <button
            data-testid="queue-transition-end"
            onClick={() => {
              if (!isQueueOpen) {
                setQueueMounted(false);
              }
            }}
          >
            Transition End
          </button>
        </div>
      )}
    </div>
  );
};

type ControllerHandle = {
  setIsOpen: (v: boolean) => void;
  setIsQueueOpen: (v: boolean) => void;
  setQueueMounted: (v: boolean) => void;
  openQueue: () => void;
  closeQueue: () => void;
};

const controllerRef: { current: ControllerHandle | null } = { current: null };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Queue drawer lazy-mount pattern', () => {
  beforeEach(() => {
    queueContentMounted.current = false;
    queueContentRenderCount.current = 0;
    controllerRef.current = null;
  });

  afterEach(() => {
    cleanup();
  });

  // -------------------------------------------------------------------------
  // Core: queue content is NOT mounted when play drawer opens
  // -------------------------------------------------------------------------
  it('does NOT mount queue content when the play drawer opens', () => {
    const { queryByTestId } = render(<PlayDrawerSimulation isOpen />);

    // Play drawer content should be present
    expect(queryByTestId('play-content')).not.toBeNull();

    // Queue content should NOT be present — this is the key optimization
    expect(queryByTestId('queue-drawer')).toBeNull();
    expect(queryByTestId('queue-content')).toBeNull();
    expect(queueContentMounted.current).toBe(false);
    expect(queueContentRenderCount.current).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Queue mounts when user clicks the queue button
  // -------------------------------------------------------------------------
  it('mounts queue content when the user opens the queue', () => {
    const { queryByTestId, getByTestId } = render(<PlayDrawerSimulation isOpen />);

    // Initially: queue not mounted
    expect(queryByTestId('queue-content')).toBeNull();

    // User clicks the queue button
    act(() => {
      fireEvent.click(getByTestId('open-queue-btn'));
    });

    // Queue should now be mounted and open
    expect(queryByTestId('queue-drawer')).not.toBeNull();
    expect(queryByTestId('queue-content')).not.toBeNull();
    expect(queueContentMounted.current).toBe(true);
    expect(getByTestId('queue-drawer').dataset.open).toBe('true');
  });

  // -------------------------------------------------------------------------
  // Queue stays mounted during close animation, then unmounts
  // -------------------------------------------------------------------------
  it('keeps queue mounted during close animation, unmounts after transition end', () => {
    const { queryByTestId, getByTestId } = render(<PlayDrawerSimulation isOpen />);

    // Open the queue
    act(() => {
      fireEvent.click(getByTestId('open-queue-btn'));
    });
    expect(queueContentMounted.current).toBe(true);

    // Close the queue (isQueueOpen=false, but queueMounted still true for animation)
    act(() => {
      fireEvent.click(getByTestId('close-queue-btn'));
    });

    // Queue drawer is still in DOM (for exit animation) but marked closed
    expect(queryByTestId('queue-drawer')).not.toBeNull();
    expect(getByTestId('queue-drawer').dataset.open).toBe('false');
    expect(queueContentMounted.current).toBe(true);

    // Simulate the transition end callback
    act(() => {
      fireEvent.click(getByTestId('queue-transition-end'));
    });

    // Now queue should be fully unmounted
    expect(queryByTestId('queue-drawer')).toBeNull();
    expect(queryByTestId('queue-content')).toBeNull();
    expect(queueContentMounted.current).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Play drawer close unmounts queue immediately
  // -------------------------------------------------------------------------
  it('unmounts queue immediately when play drawer closes', () => {
    const { queryByTestId, getByTestId } = render(<PlayDrawerSimulation isOpen />);

    // Open the queue
    act(() => {
      fireEvent.click(getByTestId('open-queue-btn'));
    });
    expect(queueContentMounted.current).toBe(true);

    // Close the play drawer entirely
    act(() => {
      controllerRef.current!.setIsOpen(false);
    });

    // Both play content and queue should be gone
    expect(queryByTestId('play-content')).toBeNull();
    expect(queryByTestId('queue-drawer')).toBeNull();
    expect(queryByTestId('queue-content')).toBeNull();
    expect(queueContentMounted.current).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Re-opening queue after close works correctly
  // -------------------------------------------------------------------------
  it('re-mounts queue when opened again after a full close cycle', () => {
    const { queryByTestId, getByTestId } = render(<PlayDrawerSimulation isOpen />);

    // Open the queue
    act(() => {
      fireEvent.click(getByTestId('open-queue-btn'));
    });
    expect(queueContentMounted.current).toBe(true);
    const firstRenderCount = queueContentRenderCount.current;

    // Close the queue + transition end
    act(() => {
      fireEvent.click(getByTestId('close-queue-btn'));
    });
    act(() => {
      fireEvent.click(getByTestId('queue-transition-end'));
    });
    expect(queueContentMounted.current).toBe(false);

    // Re-open the queue
    act(() => {
      fireEvent.click(getByTestId('open-queue-btn'));
    });

    // Queue should be mounted again
    expect(queryByTestId('queue-content')).not.toBeNull();
    expect(queueContentMounted.current).toBe(true);
    expect(queueContentRenderCount.current).toBeGreaterThan(firstRenderCount);
  });

  // -------------------------------------------------------------------------
  // Re-opening play drawer starts with queue unmounted
  // -------------------------------------------------------------------------
  it('starts with queue unmounted when play drawer re-opens', () => {
    const { queryByTestId, getByTestId } = render(<PlayDrawerSimulation isOpen />);

    // Open queue, then close play drawer
    act(() => {
      fireEvent.click(getByTestId('open-queue-btn'));
    });
    expect(queueContentMounted.current).toBe(true);

    act(() => {
      controllerRef.current!.setIsOpen(false);
    });
    expect(queueContentMounted.current).toBe(false);

    // Re-open play drawer
    act(() => {
      controllerRef.current!.setIsOpen(true);
    });

    // Play content should be back, but queue should NOT be mounted
    expect(queryByTestId('play-content')).not.toBeNull();
    expect(queryByTestId('queue-drawer')).toBeNull();
    expect(queryByTestId('queue-content')).toBeNull();
    expect(queueContentMounted.current).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Transition end with isQueueOpen=true does NOT unmount (race condition guard)
  // -------------------------------------------------------------------------
  it('does NOT unmount on transition end if queue was re-opened (race guard)', () => {
    const { queryByTestId, getByTestId } = render(<PlayDrawerSimulation isOpen />);

    // Open the queue
    act(() => {
      fireEvent.click(getByTestId('open-queue-btn'));
    });

    // Close the queue
    act(() => {
      fireEvent.click(getByTestId('close-queue-btn'));
    });

    // Before transition end fires, re-open the queue
    act(() => {
      controllerRef.current!.openQueue();
    });

    // Now the stale transition end fires — should NOT unmount
    act(() => {
      fireEvent.click(getByTestId('queue-transition-end'));
    });

    // Queue should still be mounted because isQueueOpen is true
    expect(queryByTestId('queue-content')).not.toBeNull();
    expect(queueContentMounted.current).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Queue never renders when play drawer starts and stays closed
  // -------------------------------------------------------------------------
  it('never renders queue content when play drawer is never opened', () => {
    const { queryByTestId } = render(<PlayDrawerSimulation isOpen={false} />);

    expect(queryByTestId('play-content')).toBeNull();
    expect(queryByTestId('queue-drawer')).toBeNull();
    expect(queryByTestId('queue-content')).toBeNull();
    expect(queueContentRenderCount.current).toBe(0);
  });
});
