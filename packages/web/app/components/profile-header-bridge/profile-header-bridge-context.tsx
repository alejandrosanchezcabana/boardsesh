'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useLayoutEffect,
  useEffect,
} from 'react';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

interface ProfileHeaderShareState {
  isActive: boolean;
  displayName: string | null;
}

const ProfileHeaderShareContext = createContext<ProfileHeaderShareState>({
  isActive: false,
  displayName: null,
});

export function useProfileHeaderShare() {
  return useContext(ProfileHeaderShareContext);
}

interface ProfileHeaderShareSetters {
  register: (displayName: string | null) => void;
  deregister: () => void;
}

const ProfileHeaderShareSetterContext = createContext<ProfileHeaderShareSetters>({
  register: () => {},
  deregister: () => {},
});

export function ProfileHeaderShareProvider({ children }: { children: React.ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);

  const register = useCallback((name: string | null) => {
    setDisplayName(name);
    setIsActive(true);
  }, []);

  const deregister = useCallback(() => {
    setDisplayName(null);
    setIsActive(false);
  }, []);

  const state = useMemo<ProfileHeaderShareState>(() => ({
    isActive,
    displayName,
  }), [isActive, displayName]);

  const setters = useMemo<ProfileHeaderShareSetters>(() => ({
    register,
    deregister,
  }), [register, deregister]);

  return (
    <ProfileHeaderShareSetterContext.Provider value={setters}>
      <ProfileHeaderShareContext.Provider value={state}>
        {children}
      </ProfileHeaderShareContext.Provider>
    </ProfileHeaderShareSetterContext.Provider>
  );
}

interface ProfileHeaderShareInjectorProps {
  displayName: string | null;
  isActive: boolean;
}

export function ProfileHeaderShareInjector({
  displayName,
  isActive,
}: ProfileHeaderShareInjectorProps) {
  const { register, deregister } = useContext(ProfileHeaderShareSetterContext);

  useIsomorphicLayoutEffect(() => {
    if (isActive) {
      register(displayName);
    } else {
      deregister();
    }

    return () => {
      deregister();
    };
  }, [displayName, isActive, register, deregister]);

  return null;
}
