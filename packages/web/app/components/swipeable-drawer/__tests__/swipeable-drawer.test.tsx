import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import SwipeableDrawer from '../swipeable-drawer';
import styles from '../swipeable-drawer.module.css';

// We render the drawer with disablePortal so jsdom can find its contents
// without needing a full MUI portal setup.
const baseProps = {
  open: true,
  disablePortal: true,
  onClose: vi.fn(),
};

// The MUI SwipeableDrawer root gets the className from the `className` prop on
// <MuiSwipeableDrawer>. Our component maps its `rootClassName` / `className`
// props onto that. Locate the root by the MUI class that MUI always applies.
function getMuiDrawerRoot(container: HTMLElement): HTMLElement | null {
  return container.querySelector('.MuiDrawer-root');
}

describe('SwipeableDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('close button rendering', () => {
    it('renders the close button by default (showCloseButton undefined)', () => {
      render(
        <SwipeableDrawer {...baseProps} placement="bottom">
          <div>body</div>
        </SwipeableDrawer>,
      );
      expect(document.querySelector('.drawer-close-btn')).not.toBeNull();
    });

    it('does not render the close button when showCloseButton is false', () => {
      render(
        <SwipeableDrawer {...baseProps} placement="bottom" showCloseButton={false}>
          <div>body</div>
        </SwipeableDrawer>,
      );
      expect(document.querySelector('.drawer-close-btn')).toBeNull();
    });

    it('calls onClose when the close button is clicked', () => {
      const onClose = vi.fn();
      render(
        <SwipeableDrawer {...baseProps} placement="bottom" onClose={onClose}>
          <div>body</div>
        </SwipeableDrawer>,
      );
      const btn = document.querySelector('.drawer-close-btn') as HTMLElement;
      fireEvent.click(btn);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('top placement close button position', () => {
    it('positions the close button at top-right for placement="top"', () => {
      render(
        <SwipeableDrawer {...baseProps} placement="top">
          <div>body</div>
        </SwipeableDrawer>,
      );
      const btn = document.querySelector('.drawer-close-btn') as HTMLElement;
      expect(btn).not.toBeNull();
      // MUI's sx prop is compiled to emotion classes (not inline styles),
      // which jsdom parses from the injected <style> tags.
      const computed = window.getComputedStyle(btn);
      expect(computed.top).toBe('8px');
      expect(computed.right).toBe('8px');
      // The other two sides should not be pinned (left/bottom are unset).
      expect(computed.left).not.toBe('8px');
      expect(computed.bottom).not.toBe('8px');
    });

    it('positions the close button at top-left for placement="bottom"', () => {
      render(
        <SwipeableDrawer {...baseProps} placement="bottom">
          <div>body</div>
        </SwipeableDrawer>,
      );
      const btn = document.querySelector('.drawer-close-btn') as HTMLElement;
      const computed = window.getComputedStyle(btn);
      expect(computed.top).toBe('8px');
      expect(computed.left).toBe('8px');
      expect(computed.right).not.toBe('8px');
      expect(computed.bottom).not.toBe('8px');
    });
  });

  describe('mobileHideClose class toggling', () => {
    it('adds the mobileHideClose class by default so the close button is hidden on mobile', () => {
      const { container } = render(
        <SwipeableDrawer {...baseProps} placement="top">
          <div>body</div>
        </SwipeableDrawer>,
      );
      const root = getMuiDrawerRoot(container);
      expect(root).not.toBeNull();
      expect(root?.className).toContain(styles.mobileHideClose);
    });

    it('omits the mobileHideClose class when showCloseButtonOnMobile is true', () => {
      const { container } = render(
        <SwipeableDrawer {...baseProps} placement="top" showCloseButtonOnMobile>
          <div>body</div>
        </SwipeableDrawer>,
      );
      const root = getMuiDrawerRoot(container);
      expect(root).not.toBeNull();
      expect(root?.className ?? '').not.toContain(styles.mobileHideClose);
    });

    it('preserves user-supplied className/rootClassName when showCloseButtonOnMobile is true', () => {
      const { container } = render(
        <SwipeableDrawer
          {...baseProps}
          placement="top"
          showCloseButtonOnMobile
          className="custom-class"
        >
          <div>body</div>
        </SwipeableDrawer>,
      );
      const root = getMuiDrawerRoot(container);
      expect(root?.className).toContain('custom-class');
      expect(root?.className ?? '').not.toContain(styles.mobileHideClose);
    });

    it('merges mobileHideClose with user-supplied className by default', () => {
      const { container } = render(
        <SwipeableDrawer
          {...baseProps}
          placement="top"
          className="custom-class"
        >
          <div>body</div>
        </SwipeableDrawer>,
      );
      const root = getMuiDrawerRoot(container);
      expect(root?.className).toContain('custom-class');
      expect(root?.className).toContain(styles.mobileHideClose);
    });
  });

  describe('title', () => {
    it('renders the title when provided', () => {
      render(
        <SwipeableDrawer {...baseProps} placement="top" title="My title">
          <div>body</div>
        </SwipeableDrawer>,
      );
      expect(screen.getByText('My title')).toBeTruthy();
    });
  });

  describe('swipe blocking', () => {
    // MUI's handleBodyTouchStart bails out when nativeEvent.defaultMuiPrevented
    // is true (SwipeableDrawer.js:398), but also sets the flag itself when the
    // drawer is open and the touch is inside the paper (line 426). To isolate
    // what OUR handler did, we observe the flag from a bubble-phase listener
    // on document.body — React's delegated listener on the root container
    // dispatches synthetic handlers during bubble phase before the event
    // reaches document.body, while MUI's listener is on document (one step
    // later in the bubble chain).
    function dispatchAndReadFlagPostReact(target: HTMLElement): boolean {
      let flag = false;
      const read = (e: Event) => {
        flag = Boolean((e as unknown as Record<string, unknown>).defaultMuiPrevented);
      };
      document.body.addEventListener('touchstart', read);
      const event = new Event('touchstart', { bubbles: true, cancelable: true });
      // jsdom lacks a TouchEvent constructor; stub `touches` so MUI's
      // calculateCurrentX/Y don't throw when its document listener fires.
      Object.defineProperty(event, 'touches', {
        value: [{ pageX: 0, pageY: 0, clientX: 0, clientY: 0 }],
      });
      try {
        target.dispatchEvent(event);
      } finally {
        document.body.removeEventListener('touchstart', read);
      }
      return flag;
    }

    it('sets defaultMuiPrevented when touchstart originates inside a [data-swipe-blocked] zone', () => {
      // Override disablePortal: the nested-drawer branch otherwise sets the
      // flag unconditionally, which would hide whether the zone check ran.
      render(
        <SwipeableDrawer {...baseProps} disablePortal={false} placement="bottom">
          <div data-swipe-blocked="true">
            <div data-testid="inner">map content</div>
          </div>
        </SwipeableDrawer>,
      );

      expect(dispatchAndReadFlagPostReact(screen.getByTestId('inner'))).toBe(true);
    });

    it('leaves defaultMuiPrevented unset when touchstart target has no [data-swipe-blocked] ancestor', () => {
      // The target still sits inside the drawer paper; what matters is that
      // no ancestor in its chain carries the swipe-blocked attribute, so our
      // handler should not claim the touch. (MUI's own document listener
      // will set the flag later — our helper reads it at document.body,
      // before that listener runs.)
      render(
        <SwipeableDrawer {...baseProps} disablePortal={false} placement="bottom">
          <div data-testid="unblocked">regular content</div>
        </SwipeableDrawer>,
      );

      expect(dispatchAndReadFlagPostReact(screen.getByTestId('unblocked'))).toBe(false);
    });

    it('sets defaultMuiPrevented on any touch when disablePortal is set (nested-drawer case)', () => {
      render(
        <SwipeableDrawer {...baseProps} placement="bottom">
          <div data-testid="anywhere">regular content</div>
        </SwipeableDrawer>,
      );

      // baseProps.disablePortal is true → handler sets flag regardless of zone.
      expect(dispatchAndReadFlagPostReact(screen.getByTestId('anywhere'))).toBe(true);
    });

    // Regression test for #1621: a touchstart inside a [data-swipe-blocked]
    // zone must not trigger the swipe-to-close flow. We can't simulate a full
    // touchmove/touchend swipe gesture under jsdom (no TouchEvent
    // constructor), but we can verify the upstream guard: because our handler
    // sets defaultMuiPrevented on touchstart, MUI's handleBodyTouchStart
    // returns early (SwipeableDrawer.js:398-400) without calling
    // startMaybeSwiping, so the subsequent touchend will not dispatch onClose.
    it('does not call onClose from a touchstart originating in a [data-swipe-blocked] zone', () => {
      const onClose = vi.fn();
      render(
        <SwipeableDrawer {...baseProps} disablePortal={false} placement="bottom" onClose={onClose}>
          <div data-swipe-blocked="true">
            <div data-testid="inner">map content</div>
          </div>
        </SwipeableDrawer>,
      );

      const event = new Event('touchstart', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'touches', {
        value: [{ pageX: 0, pageY: 0, clientX: 0, clientY: 0 }],
      });
      screen.getByTestId('inner').dispatchEvent(event);

      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
