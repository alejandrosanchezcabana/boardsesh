import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen } from '@testing-library/react';
import React from 'react';
import ProfileNavCard from '../profile-nav-card';

// Mock dependencies before component import
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/app/theme/theme-config', () => ({
  themeTokens: {
    transitions: { normal: '200ms ease' },
    shadows: { md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' },
  },
}));

type ProfileNavCardProps = {
  title: string;
  subtitle?: string;
  href: string;
  icon: React.ReactNode;
};

function createDefaultProps(overrides: Partial<ProfileNavCardProps> = {}): ProfileNavCardProps {
  return {
    title: 'Logbook',
    subtitle: 'View your climbing history',
    href: '/profile/user-123/logbook',
    icon: <span data-testid="nav-icon">icon</span>,
    ...overrides,
  };
}

describe('ProfileNavCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders title text', () => {
    render(<ProfileNavCard {...createDefaultProps()} />);
    expect(screen.getByText('Logbook')).toBeTruthy();
  });

  it('renders subtitle when provided', () => {
    render(<ProfileNavCard {...createDefaultProps()} />);
    expect(screen.getByText('View your climbing history')).toBeTruthy();
  });

  it('does not render subtitle when not provided', () => {
    render(<ProfileNavCard {...createDefaultProps({ subtitle: undefined })} />);
    expect(screen.queryByText('View your climbing history')).toBeNull();
  });

  it('renders as a link with correct href', () => {
    render(<ProfileNavCard {...createDefaultProps()} />);
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/profile/user-123/logbook');
  });

  it('renders icon', () => {
    render(<ProfileNavCard {...createDefaultProps()} />);
    expect(screen.getByTestId('nav-icon')).toBeTruthy();
  });

  it('renders chevron arrow', () => {
    render(<ProfileNavCard {...createDefaultProps()} />);
    // ChevronRightOutlined renders as an SVG with a data-testid
    const svg = document.querySelector('[data-testid="ChevronRightOutlinedIcon"]');
    expect(svg).toBeTruthy();
  });
});
