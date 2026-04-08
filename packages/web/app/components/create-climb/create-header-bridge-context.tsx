'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

interface CreateHeaderBridgeState {
  isActive: boolean;
  climbName: string;
  setClimbName: ((value: string) => void) | null;
  actionSlot: React.ReactNode | null;
}

interface CreateHeaderBridgeRegistration {
  climbName: string;
  setClimbName: (value: string) => void;
  actionSlot: React.ReactNode | null;
}

interface CreateHeaderBridgeSetters {
  register: (registration: CreateHeaderBridgeRegistration) => void;
  update: (registration: CreateHeaderBridgeRegistration) => void;
  deregister: () => void;
}

const DEFAULT_STATE: CreateHeaderBridgeState = {
  isActive: false,
  climbName: '',
  setClimbName: null,
  actionSlot: null,
};

const CreateHeaderBridgeContext = createContext<CreateHeaderBridgeState>(DEFAULT_STATE);

const CreateHeaderBridgeSetterContext = createContext<CreateHeaderBridgeSetters>({
  register: () => {},
  update: () => {},
  deregister: () => {},
});

export function useCreateHeaderBridge() {
  return useContext(CreateHeaderBridgeContext);
}

export function useCreateHeaderBridgeSetters() {
  return useContext(CreateHeaderBridgeSetterContext);
}

export function CreateHeaderBridgeProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CreateHeaderBridgeState>(DEFAULT_STATE);

  const register = useCallback((registration: CreateHeaderBridgeRegistration) => {
    setState({
      isActive: true,
      ...registration,
    });
  }, []);

  const update = useCallback((registration: CreateHeaderBridgeRegistration) => {
    setState({
      isActive: true,
      ...registration,
    });
  }, []);

  const deregister = useCallback(() => {
    setState(DEFAULT_STATE);
  }, []);

  const setters = useMemo<CreateHeaderBridgeSetters>(
    () => ({ register, update, deregister }),
    [register, update, deregister],
  );

  return (
    <CreateHeaderBridgeSetterContext.Provider value={setters}>
      <CreateHeaderBridgeContext.Provider value={state}>
        {children}
      </CreateHeaderBridgeContext.Provider>
    </CreateHeaderBridgeSetterContext.Provider>
  );
}
