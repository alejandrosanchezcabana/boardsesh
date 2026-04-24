'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useWsAuthToken } from '@/app/hooks/use-ws-auth-token';
import { resolveSerialNumbers, type ResolvedBoardEntry } from '@/app/lib/ble/resolve-serials';
import {
  parseSerialNumber,
  AURORA_SCAN_SERVICE_UUIDS,
} from '@/app/components/board-bluetooth-control/bluetooth-aurora';
import { MOONBOARD_SCAN_SERVICE_UUIDS } from '@/app/components/board-bluetooth-control/bluetooth-moonboard';
import { supportsCapacitorBleManualScan } from '@/app/lib/ble/capacitor-utils';
import type { BleScanPlugin, DiscoveredDevice, CapacitorScanResult, PluginListenerHandle } from '@/app/lib/ble/types';

// Auto-stop scan after this duration
const SCAN_TIMEOUT_MS = 15_000;

export type BluetoothScanStatus = 'idle' | 'scanning' | 'done' | 'unavailable';

function getBlePlugin(): BleScanPlugin | null {
  const plugin = window.Capacitor?.Plugins?.BluetoothLe;
  return plugin ? (plugin as BleScanPlugin) : null;
}

export function useBluetoothScan() {
  const { token } = useWsAuthToken();
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [resolvedBoards, setResolvedBoards] = useState<Map<string, ResolvedBoardEntry>>(new Map());
  // Start as 'idle' to avoid SSR/client hydration mismatch — capabilities are
  // checked in a useEffect on mount. This means there is a single-frame flash
  // where the quick-start card appears actionable on non-Capacitor environments
  // (desktop Chrome with Web Bluetooth, Safari, etc.) before the effect fires
  // and sets 'unavailable'. Clicking during that frame is harmless — startScan
  // has the same guard.
  const [status, setStatus] = useState<BluetoothScanStatus>('idle');

  // Track whether the hook is still mounted so async callbacks from in-flight
  // BLE operations (scan timeout, serial resolution) don't call setState after
  // the component has unmounted.
  const mountedRef = useRef(true);

  useEffect(() => {
    // This hook requires Capacitor's manual BLE scan APIs (requestLEScan / stopLEScan).
    // All other environments are unsupported — including desktop browsers with
    // Web Bluetooth (which can't do background LE scans without a user gesture).
    if (!supportsCapacitorBleManualScan()) {
      setStatus('unavailable');
    }
  }, []);

  // Refs to manage scan lifecycle across renders
  const scanListenerRef = useRef<PluginListenerHandle | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const devicesMapRef = useRef<Map<string, DiscoveredDevice>>(new Map());
  const resolveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Synchronous cleanup safe for useEffect teardown — fires BLE teardown
  // best-effort without awaiting, so React can complete cleanup synchronously.
  const cleanupSync = useCallback(() => {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    if (resolveTimeoutRef.current) {
      clearTimeout(resolveTimeoutRef.current);
      resolveTimeoutRef.current = null;
    }
    if (scanListenerRef.current) {
      scanListenerRef.current.remove().catch(() => {});
      scanListenerRef.current = null;
    }
    const ble = getBlePlugin();
    if (ble?.stopLEScan) {
      ble.stopLEScan().catch(() => {});
    }
  }, []);

  // Async version for imperative callers (startScan, timeout callback)
  const stopScan = useCallback(async () => {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    if (resolveTimeoutRef.current) {
      clearTimeout(resolveTimeoutRef.current);
      resolveTimeoutRef.current = null;
    }
    if (scanListenerRef.current) {
      await scanListenerRef.current.remove();
      scanListenerRef.current = null;
    }
    const ble = getBlePlugin();
    if (ble?.stopLEScan) {
      await ble.stopLEScan().catch(() => {});
    }
  }, []);

  // Resolve serial numbers to boards via GraphQL
  const resolveSerials = useCallback(
    async (deviceMap: Map<string, DiscoveredDevice>) => {
      if (!token) return;

      const serials: string[] = [];
      for (const device of deviceMap.values()) {
        const serial = parseSerialNumber(device.name);
        if (serial) serials.push(serial);
      }

      if (serials.length === 0) return;

      try {
        const boardMap = await resolveSerialNumbers(token, serials);
        if (mountedRef.current) {
          setResolvedBoards(boardMap);
        }
      } catch (err) {
        console.error('[BLE Scan] Failed to resolve serial numbers:', err);
      }
    },
    [token],
  );

  const startScan = useCallback(async () => {
    if (!supportsCapacitorBleManualScan()) {
      setStatus('unavailable');
      return;
    }

    const ble = getBlePlugin();
    if (!ble || !ble.requestLEScan || !ble.stopLEScan) {
      setStatus('unavailable');
      return;
    }

    // Clean up any previous scan
    await stopScan();
    devicesMapRef.current.clear();
    setDevices([]);
    setResolvedBoards(new Map());
    setStatus('scanning');

    try {
      await ble.initialize();

      const { value: enabled } = await ble.isEnabled();
      if (!enabled) {
        setStatus('unavailable');
        return;
      }

      // Register scan result listener
      scanListenerRef.current = await ble.addListener('onScanResult', (data) => {
        const result = data as unknown as CapacitorScanResult;
        const device: DiscoveredDevice = {
          deviceId: result.device.deviceId,
          name: result.localName || result.device.name,
          rssi: result.rssi,
        };

        // Deduplicate by name (includes serial for Aurora boards)
        const dedupeKey = device.name || device.deviceId;
        devicesMapRef.current.set(dedupeKey, device);
        if (mountedRef.current) {
          setDevices([...devicesMapRef.current.values()]);
        }

        // Debounce serial resolution — wait 500ms after last device found
        if (resolveTimeoutRef.current) {
          clearTimeout(resolveTimeoutRef.current);
        }
        resolveTimeoutRef.current = setTimeout(() => {
          resolveSerials(devicesMapRef.current);
        }, 500);
      });

      // Start scanning with board service UUIDs to filter out non-board devices
      await ble.requestLEScan({ services: [...AURORA_SCAN_SERVICE_UUIDS, ...MOONBOARD_SCAN_SERVICE_UUIDS] });

      // Auto-stop after timeout
      scanTimeoutRef.current = setTimeout(async () => {
        await stopScan();
        // Final resolve attempt
        await resolveSerials(devicesMapRef.current);
        if (mountedRef.current) {
          setStatus('done');
        }
      }, SCAN_TIMEOUT_MS);
    } catch (err) {
      console.error('[BLE Scan] Scan failed:', err);
      await stopScan();
      if (mountedRef.current) {
        setStatus('done');
      }
    }
  }, [stopScan, resolveSerials]);

  // Cleanup on unmount — mark unmounted before sync cleanup so in-flight
  // async callbacks skip their setState calls.
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      cleanupSync();
    };
  }, [cleanupSync]);

  return { devices, resolvedBoards, status, startScan, stopScan };
}
