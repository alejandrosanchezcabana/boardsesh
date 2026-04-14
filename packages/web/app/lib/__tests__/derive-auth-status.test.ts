import { describe, it, expect } from 'vitest';
import { deriveIsAuthenticated } from '../derive-auth-status';

describe('deriveIsAuthenticated', () => {
  it('returns true when session is authenticated', () => {
    expect(deriveIsAuthenticated('authenticated', false)).toBe(true);
    expect(deriveIsAuthenticated('authenticated', true)).toBe(true);
  });

  it('returns true during loading when SSR provided user data', () => {
    expect(deriveIsAuthenticated('loading', true)).toBe(true);
  });

  it('returns false during loading when no SSR user data', () => {
    expect(deriveIsAuthenticated('loading', false)).toBe(false);
  });

  it('returns false when session resolves to unauthenticated even with SSR data', () => {
    // Session expired or user logged out in another tab between SSR and hydration
    expect(deriveIsAuthenticated('unauthenticated', true)).toBe(false);
  });

  it('returns false when unauthenticated and no SSR data', () => {
    expect(deriveIsAuthenticated('unauthenticated', false)).toBe(false);
  });
});
