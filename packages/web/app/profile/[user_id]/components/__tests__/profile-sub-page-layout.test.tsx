import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

import ProfileSubPageLayout from '../profile-sub-page-layout';

interface ProfileSubPageLayoutProps {
  children: React.ReactNode;
}

function createDefaultProps(
  overrides: Partial<ProfileSubPageLayoutProps> = {},
): ProfileSubPageLayoutProps {
  return {
    children: <div data-testid="child-content">Child content</div>,
    ...overrides,
  };
}

describe('ProfileSubPageLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children', () => {
    render(<ProfileSubPageLayout {...createDefaultProps()} />);
    expect(screen.getByTestId('child-content')).toBeTruthy();
    expect(screen.getByText('Child content')).toBeTruthy();
  });

  it('does not render its own local header controls', () => {
    render(<ProfileSubPageLayout {...createDefaultProps()} />);
    expect(screen.queryByTestId('back-button')).toBeNull();
    expect(screen.queryByTestId('logo')).toBeNull();
  });
});
