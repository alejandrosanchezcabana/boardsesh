import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock dependencies before component import
vi.mock('@/app/components/back-button', () => ({
  default: (props: { fallbackUrl?: string }) => (
    <div data-testid="back-button" data-fallback={props.fallbackUrl} />
  ),
}));

vi.mock('@/app/components/brand/logo', () => ({
  default: () => <div data-testid="logo" />,
}));

vi.mock('@/app/theme/theme-config', () => ({
  themeTokens: {
    transitions: { normal: '200ms ease' },
    shadows: { md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' },
  },
}));

import ProfileSubPageLayout from '../profile-sub-page-layout';

interface ProfileSubPageLayoutProps {
  userId: string;
  title: string;
  children: React.ReactNode;
}

function createDefaultProps(
  overrides: Partial<ProfileSubPageLayoutProps> = {},
): ProfileSubPageLayoutProps {
  return {
    userId: 'user-123',
    title: 'Logbook',
    children: <div data-testid="child-content">Child content</div>,
    ...overrides,
  };
}

describe('ProfileSubPageLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders title', () => {
    render(<ProfileSubPageLayout {...createDefaultProps()} />);
    expect(screen.getByText('Logbook')).toBeTruthy();
  });

  it('renders children', () => {
    render(<ProfileSubPageLayout {...createDefaultProps()} />);
    expect(screen.getByTestId('child-content')).toBeTruthy();
    expect(screen.getByText('Child content')).toBeTruthy();
  });

  it('renders back button with correct fallback URL', () => {
    render(<ProfileSubPageLayout {...createDefaultProps()} />);
    const backButton = screen.getByTestId('back-button');
    expect(backButton.getAttribute('data-fallback')).toBe('/profile/user-123');
  });

  it('renders logo', () => {
    render(<ProfileSubPageLayout {...createDefaultProps()} />);
    expect(screen.getByTestId('logo')).toBeTruthy();
  });
});
