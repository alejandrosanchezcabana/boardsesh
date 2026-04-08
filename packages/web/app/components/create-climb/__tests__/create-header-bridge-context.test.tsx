import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import {
  CreateHeaderBridgeProvider,
  useCreateHeaderBridge,
  useCreateHeaderBridgeSetters,
} from '../create-header-bridge-context';

describe('create-header-bridge-context', () => {
  function wrapper({ children }: { children: React.ReactNode }) {
    return <CreateHeaderBridgeProvider>{children}</CreateHeaderBridgeProvider>;
  }

  it('provides default inactive state before registration', () => {
    const { result } = renderHook(() => useCreateHeaderBridge(), { wrapper });

    expect(result.current.isActive).toBe(false);
    expect(result.current.climbName).toBe('');
    expect(result.current.setClimbName).toBeNull();
    expect(result.current.actionSlot).toBeNull();
  });

  it('registers create header state', () => {
    const { result } = renderHook(() => ({
      state: useCreateHeaderBridge(),
      setters: useCreateHeaderBridgeSetters(),
    }), { wrapper });

    const setClimbName = () => {};

    act(() => {
      result.current.setters.register({
        climbName: 'Test climb',
        setClimbName,
        actionSlot: <button type="button">Save</button>,
      });
    });

    expect(result.current.state.isActive).toBe(true);
    expect(result.current.state.climbName).toBe('Test climb');
    expect(result.current.state.setClimbName).toBe(setClimbName);
    expect(result.current.state.actionSlot).not.toBeNull();
  });

  it('updates registered state', () => {
    const { result } = renderHook(() => ({
      state: useCreateHeaderBridge(),
      setters: useCreateHeaderBridgeSetters(),
    }), { wrapper });

    const setClimbName = () => {};

    act(() => {
      result.current.setters.register({
        climbName: 'First name',
        setClimbName,
        actionSlot: null,
      });
    });

    act(() => {
      result.current.setters.update({
        climbName: 'Updated name',
        setClimbName,
        actionSlot: <button type="button">Save</button>,
      });
    });

    expect(result.current.state.isActive).toBe(true);
    expect(result.current.state.climbName).toBe('Updated name');
    expect(result.current.state.actionSlot).not.toBeNull();
  });

  it('deregisters back to defaults', () => {
    const { result } = renderHook(() => ({
      state: useCreateHeaderBridge(),
      setters: useCreateHeaderBridgeSetters(),
    }), { wrapper });

    act(() => {
      result.current.setters.register({
        climbName: 'Temporary',
        setClimbName: () => {},
        actionSlot: <button type="button">Save</button>,
      });
    });

    act(() => {
      result.current.setters.deregister();
    });

    expect(result.current.state.isActive).toBe(false);
    expect(result.current.state.climbName).toBe('');
    expect(result.current.state.setClimbName).toBeNull();
    expect(result.current.state.actionSlot).toBeNull();
  });
});
