// @vitest-environment jsdom
import { describe, it, expect } from 'vite-plus/test';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import CollapsibleSection, { type CollapsibleSectionConfig } from '../collapsible-section';

function makeSections(): CollapsibleSectionConfig[] {
  return [
    {
      key: 'invite',
      label: 'Invite',
      title: 'Invite others',
      defaultSummary: 'Share link',
      content: <div data-testid="invite-body">Invite content</div>,
    },
    {
      key: 'activity',
      label: 'Activity',
      title: 'Recent activity',
      defaultSummary: 'No climbs yet',
      content: <div data-testid="activity-body">Activity content</div>,
    },
    {
      key: 'analytics',
      label: 'Analytics',
      title: 'Grade breakdown',
      defaultSummary: 'Grades climbed',
      content: <div data-testid="analytics-body">Analytics content</div>,
    },
  ];
}

describe('CollapsibleSection', () => {
  describe('uncontrolled mode (no forcedActiveKey)', () => {
    it('starts with no section active when there is no defaultActive', () => {
      render(<CollapsibleSection sections={makeSections()} />);
      expect(screen.getByText('Invite')).toBeDefined();
      expect(screen.getByText('Activity')).toBeDefined();
      // When inactive the label shows; when active the title does.
      expect(screen.queryByText('Invite others')).toBeNull();
    });

    it('clicking a section label opens it', () => {
      render(<CollapsibleSection sections={makeSections()} />);
      fireEvent.click(screen.getByText('Invite'));
      expect(screen.getByText('Invite others')).toBeDefined();
    });

    it('clicking the title of an active section collapses it', () => {
      render(<CollapsibleSection sections={makeSections()} />);
      fireEvent.click(screen.getByText('Invite')); // open
      expect(screen.getByText('Invite others')).toBeDefined();
      fireEvent.click(screen.getByText('Invite others')); // close
      expect(screen.queryByText('Invite others')).toBeNull();
    });

    it('honours defaultActive on initial render', () => {
      const sections = makeSections();
      sections[1].defaultActive = true;
      render(<CollapsibleSection sections={sections} />);
      expect(screen.getByText('Recent activity')).toBeDefined();
    });
  });

  describe('controlled mode (forcedActiveKey)', () => {
    it('renders the forced section active', () => {
      render(<CollapsibleSection sections={makeSections()} forcedActiveKey="analytics" />);
      expect(screen.getByText('Grade breakdown')).toBeDefined();
      expect(screen.queryByText('Invite others')).toBeNull();
    });

    it('swaps the active section when forcedActiveKey changes', () => {
      const { rerender } = render(<CollapsibleSection sections={makeSections()} forcedActiveKey="invite" />);
      expect(screen.getByText('Invite others')).toBeDefined();

      rerender(<CollapsibleSection sections={makeSections()} forcedActiveKey="activity" />);
      expect(screen.getByText('Recent activity')).toBeDefined();
      expect(screen.queryByText('Invite others')).toBeNull();

      rerender(<CollapsibleSection sections={makeSections()} forcedActiveKey="analytics" />);
      expect(screen.getByText('Grade breakdown')).toBeDefined();
    });

    it('disables user-driven collapse/expand while forced', () => {
      render(<CollapsibleSection sections={makeSections()} forcedActiveKey="invite" />);

      // Click an inactive section label — nothing should change.
      fireEvent.click(screen.getByText('Activity'));
      expect(screen.getByText('Invite others')).toBeDefined();
      expect(screen.queryByText('Recent activity')).toBeNull();

      // Click the active title — nothing should collapse.
      fireEvent.click(screen.getByText('Invite others'));
      expect(screen.getByText('Invite others')).toBeDefined();
    });

    it('explicit null collapses all sections', () => {
      const sections = makeSections();
      sections[0].defaultActive = true;
      const { rerender } = render(<CollapsibleSection sections={sections} />);
      expect(screen.getByText('Invite others')).toBeDefined();

      rerender(<CollapsibleSection sections={sections} forcedActiveKey={null} />);
      expect(screen.queryByText('Invite others')).toBeNull();
    });

    it('transitioning back to uncontrolled mode restores the initial default', () => {
      const sections = makeSections();
      sections[0].defaultActive = true; // initial default = 'invite'

      // Start uncontrolled with the default active.
      const { rerender } = render(<CollapsibleSection sections={sections} />);
      expect(screen.getByText('Invite others')).toBeDefined();

      // Controlled: force 'analytics'.
      rerender(<CollapsibleSection sections={sections} forcedActiveKey="analytics" />);
      expect(screen.getByText('Grade breakdown')).toBeDefined();

      // Drop back to uncontrolled. The forced value must not leak — the
      // component resets to the original default ('invite').
      rerender(<CollapsibleSection sections={sections} />);
      expect(screen.getByText('Invite others')).toBeDefined();
      expect(screen.queryByText('Grade breakdown')).toBeNull();
    });

    it('transitioning back to uncontrolled with no default collapses to null', () => {
      const sections = makeSections(); // no defaultActive
      const { rerender } = render(<CollapsibleSection sections={sections} forcedActiveKey="invite" />);
      expect(screen.getByText('Invite others')).toBeDefined();

      rerender(<CollapsibleSection sections={sections} />);
      expect(screen.queryByText('Invite others')).toBeNull();
      expect(screen.queryByText('Recent activity')).toBeNull();
      expect(screen.queryByText('Grade breakdown')).toBeNull();
    });
  });
});
