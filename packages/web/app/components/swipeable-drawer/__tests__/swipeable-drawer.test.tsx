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
});
