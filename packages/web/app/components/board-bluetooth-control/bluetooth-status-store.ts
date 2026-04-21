"use client";

import { useSyncExternalStore } from "react";

/**
 * Module-level store that tracks whether any mounted `BluetoothProvider`
 * currently has a live connection. This lets consumers rendered outside
 * any `BluetoothProvider` (e.g., the root bottom tab bar) observe BT
 * connection state without requiring the provider to be an ancestor.
 *
 * The store is updated from `BluetoothProvider` via `setBluetoothConnected`.
 */

let connectedCount = 0;
const listeners = new Set<() => void>();
const activeDisconnects = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): boolean {
  return connectedCount > 0;
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Register a live Bluetooth connection along with its `disconnect`
 * function. Called from `BluetoothProvider` whenever `isConnected`
 * flips to `true`. Returns a cleanup function to call when it flips
 * back to `false` or the provider unmounts.
 */
export function registerBluetoothConnection(disconnect: () => void): () => void {
  connectedCount += 1;
  activeDisconnects.add(disconnect);
  notify();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    connectedCount = Math.max(0, connectedCount - 1);
    activeDisconnects.delete(disconnect);
    notify();
  };
}

/**
 * Disconnect any and all currently-registered Bluetooth connections.
 * Used by the board-switch guard to drop hardware connections before
 * navigating to a different board.
 */
export function disconnectAllBluetooth(): void {
  // Snapshot first — disconnect() typically triggers the cleanup
  // function which mutates activeDisconnects during iteration.
  const snapshot = Array.from(activeDisconnects);
  for (const disconnect of snapshot) {
    try {
      disconnect();
    } catch (err) {
      console.error("Failed to disconnect bluetooth:", err);
    }
  }
}

/**
 * Hook returning `true` when any BluetoothProvider reports an active
 * connection. Works from any component in the tree.
 */
export function useBluetoothConnectedStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
