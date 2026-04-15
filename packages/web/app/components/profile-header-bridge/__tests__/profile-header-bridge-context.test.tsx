import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  ProfileHeaderShareInjector,
  ProfileHeaderShareProvider,
  useProfileHeaderShare,
} from '../profile-header-bridge-context';

function StateProbe() {
  const { isActive, displayName } = useProfileHeaderShare();

  return (
    <div
      data-testid="profile-header-share-state"
      data-active={isActive ? 'true' : 'false'}
      data-display-name={displayName ?? ''}
    />
  );
}

function TestHarness({
  displayName,
  isActive,
  renderInjector = true,
}: {
  displayName: string | null;
  isActive: boolean;
  renderInjector?: boolean;
}) {
  return (
    <ProfileHeaderShareProvider>
      <StateProbe />
      {renderInjector ? (
        <ProfileHeaderShareInjector displayName={displayName} isActive={isActive} />
      ) : null}
    </ProfileHeaderShareProvider>
  );
}

describe('ProfileHeaderShareBridge', () => {
  it('registers share state when the injector is active', () => {
    render(<TestHarness displayName="Viewed User" isActive />);

    expect(screen.getByTestId('profile-header-share-state').getAttribute('data-active')).toBe('true');
    expect(screen.getByTestId('profile-header-share-state').getAttribute('data-display-name')).toBe('Viewed User');
  });

  it('clears share state when the injector becomes inactive', () => {
    const { rerender } = render(<TestHarness displayName="Viewed User" isActive />);

    rerender(<TestHarness displayName={null} isActive={false} />);

    expect(screen.getByTestId('profile-header-share-state').getAttribute('data-active')).toBe('false');
    expect(screen.getByTestId('profile-header-share-state').getAttribute('data-display-name')).toBe('');
  });

  it('clears share state when the injector unmounts', () => {
    const { rerender } = render(<TestHarness displayName="Viewed User" isActive />);

    expect(screen.getByTestId('profile-header-share-state').getAttribute('data-active')).toBe('true');

    rerender(<TestHarness displayName={null} isActive={false} renderInjector={false} />);

    expect(screen.getByTestId('profile-header-share-state').getAttribute('data-active')).toBe('false');
    expect(screen.getByTestId('profile-header-share-state').getAttribute('data-display-name')).toBe('');
  });
});
