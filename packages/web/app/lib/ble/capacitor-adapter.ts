import type { BoardName } from '@/app/lib/types';
import type {
  BleConnection,
  BluetoothAdapter,
  CapacitorScanResult,
  DevicePickerFn,
  DiscoveredDevice,
  PluginListenerHandle,
} from './types';
import {
  AURORA_OPTIONAL_SERVICE_UUIDS,
  AURORA_SCAN_SERVICE_UUIDS,
  parseSerialNumber,
} from '@/app/components/board-bluetooth-control/bluetooth-aurora';
import {
  isMoonboardDeviceName,
  MOONBOARD_OPTIONAL_SERVICE_UUIDS,
  MOONBOARD_SCAN_SERVICE_UUIDS,
} from '@/app/components/board-bluetooth-control/bluetooth-moonboard';
import {
  MAX_BLUETOOTH_MESSAGE_SIZE,
  UART_SERVICE_UUID,
  UART_WRITE_CHARACTERISTIC_UUID,
} from '@/app/components/board-bluetooth-control/bluetooth-shared';

const DEFAULT_MTU = MAX_BLUETOOTH_MESSAGE_SIZE;

// Small delay between chunked writes when using the default MTU.
// Gives CoreBluetooth breathing room when sending many small chunks.
const INTER_CHUNK_DELAY_MS = 5;

// Auto-stop BLE scan after this duration to prevent indefinite battery drain
// if the user walks away from the picker dialog.
const SCAN_TIMEOUT_MS = 30_000;

// Raw Capacitor plugin interface as exposed via window.Capacitor.Plugins.BluetoothLe.
// The plugin JS is injected by the native shell. We type only the methods we use.
// IMPORTANT: The raw plugin's write() expects `value` as a continuous hex string (no spaces), not DataView.
// The BleClient npm wrapper normally handles this conversion, but we bypass it.

type CapacitorBlePlugin = {
  initialize(): Promise<void>;
  isEnabled(): Promise<{ value: boolean }>;
  requestDevice(options: {
    services: string[];
    optionalServices?: string[];
  }): Promise<{ deviceId: string; name?: string }>;
  requestLEScan?(options: { services?: string[] }): Promise<void>;
  stopLEScan?(): Promise<void>;
  connect(options: { deviceId: string }): Promise<void>;
  disconnect(options: { deviceId: string }): Promise<void>;
  write(options: {
    deviceId: string;
    service: string;
    characteristic: string;
    value: string; // Continuous hex string, e.g. "0102ff"
  }): Promise<void>;
  requestMtu(options: { deviceId: string; mtu: number }): Promise<{ value: number }>;
  addListener(
    eventName: 'disconnected' | 'onScanResult',
    callback: (data: Record<string, unknown>) => void,
  ): Promise<PluginListenerHandle>;
};

function getBlePlugin(): CapacitorBlePlugin {
  const plugin = window.Capacitor?.Plugins?.BluetoothLe;
  if (!plugin) {
    throw new Error('Capacitor BluetoothLe plugin not available');
  }
  return plugin as CapacitorBlePlugin;
}

// Cache the initialize() promise so we only cross the bridge once
let initPromise: Promise<void> | null = null;

function ensureInitialized(): Promise<void> {
  if (!initPromise) {
    const ble = getBlePlugin();
    initPromise = ble.initialize();
  }
  return initPromise;
}

/** @internal Reset cached init promise — only for tests */
export function _resetInitCache(): void {
  initPromise = null;
}

/** Convert a Uint8Array to the continuous hex string the raw plugin expects (v8+) */
function toHexString(data: Uint8Array): string {
  return Array.from(data)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function stopScanQuietly(ble: CapacitorBlePlugin): Promise<void> {
  if (!ble.stopLEScan) {
    return Promise.resolve();
  }
  return ble.stopLEScan().catch(() => {});
}

export class CapacitorBleAdapter implements BluetoothAdapter {
  constructor(
    private readonly boardName: BoardName = 'kilter',
    private readonly devicePicker?: DevicePickerFn,
  ) {}

  private deviceId: string | null = null;
  private disconnectCallback: (() => void) | null = null;
  private disconnectListenerHandle: PluginListenerHandle | null = null;
  private mtu = DEFAULT_MTU; // Conservative default; updated via MTU negotiation after connection

  async isAvailable(): Promise<boolean> {
    try {
      await ensureInitialized();
      const ble = getBlePlugin();
      const result = await ble.isEnabled();
      return result.value;
    } catch {
      return false;
    }
  }

  async requestAndConnect(targetSerial?: string): Promise<BleConnection> {
    await ensureInitialized();
    const ble = getBlePlugin();

    const services =
      this.boardName === 'moonboard' ? [...MOONBOARD_SCAN_SERVICE_UUIDS] : [...AURORA_SCAN_SERVICE_UUIDS];
    const optionalServices =
      this.boardName === 'moonboard' ? [...MOONBOARD_OPTIONAL_SERVICE_UUIDS] : [...AURORA_OPTIONAL_SERVICE_UUIDS];

    let selectedDeviceId: string;
    let selectedDeviceName: string | undefined;

    if (this.devicePicker && ble.requestLEScan && ble.stopLEScan) {
      // Manual scan with custom picker — deduplicates devices ourselves
      const devices = new Map<string, DiscoveredDevice>();
      let updateListener: ((devices: DiscoveredDevice[]) => void) | null = null;
      const pushDevices = () => updateListener?.([...devices.values()]);

      // When targetSerial is set, auto-resolve instead of waiting for picker
      let autoSelectResolve: ((deviceId: string) => void) | null = null;
      let autoSelectReject: ((error: Error) => void) | null = null;

      // Start the picker promise (resolves when user selects a device)
      let selectionPromise: Promise<string>;
      if (targetSerial) {
        // Skip the picker UI — resolve automatically when matching device is found
        selectionPromise = new Promise<string>((resolve, reject) => {
          autoSelectResolve = resolve;
          autoSelectReject = reject;
        });
      } else {
        selectionPromise = this.devicePicker((onUpdate) => {
          updateListener = onUpdate;
          pushDevices();
        });
      }

      // Register scan result listener BEFORE starting the scan.
      // The raw Capacitor plugin delivers results via events, not callbacks.
      const scanListener = await ble.addListener('onScanResult', (data) => {
        const result = data as unknown as CapacitorScanResult;
        const device: DiscoveredDevice = {
          deviceId: result.device.deviceId,
          name: result.localName || result.device.name,
          rssi: result.rssi,
        };

        if (this.boardName === 'moonboard' && !isMoonboardDeviceName(device.name)) {
          return;
        }

        // Deduplicate by name (which includes the serial number for Aurora boards)
        // rather than deviceId, because iOS can assign different CoreBluetooth UUIDs
        // to the same physical device across scan results.
        const dedupeKey = device.name || device.deviceId;
        devices.set(dedupeKey, device);
        pushDevices();

        // Auto-select if this device matches the target serial
        if (autoSelectResolve && targetSerial) {
          const serial = parseSerialNumber(device.name);
          if (serial === targetSerial) {
            autoSelectResolve(device.deviceId);
            autoSelectResolve = null;
          }
        }
      });

      // Start scanning
      await ble.requestLEScan({ services });

      // Auto-stop scan after timeout to prevent indefinite battery drain.
      // If auto-selecting by serial, reject the promise so the caller isn't stuck forever.
      const scanTimeoutId = setTimeout(() => {
        stopScanQuietly(ble);
        if (autoSelectReject) {
          autoSelectReject(new Error('Target board not found during scan'));
          autoSelectReject = null;
        }
      }, SCAN_TIMEOUT_MS);

      try {
        selectedDeviceId = await selectionPromise;
      } finally {
        clearTimeout(scanTimeoutId);
        await scanListener.remove();
        await stopScanQuietly(ble);
      }

      // Find the device name — map is keyed by name (dedupeKey), so search by deviceId
      for (const device of devices.values()) {
        if (device.deviceId === selectedDeviceId) {
          selectedDeviceName = device.name;
          break;
        }
      }
    } else {
      // Fallback: use the plugin's built-in device picker
      const device = await ble.requestDevice({
        services,
        optionalServices,
      });

      selectedDeviceId = device.deviceId;
      selectedDeviceName = device.name;
    }

    // Connect to the device
    await ble.connect({ deviceId: selectedDeviceId });

    // Negotiate larger MTU (iOS negotiates automatically, but requesting
    // explicitly ensures we know the actual value for chunking)
    try {
      const mtuResult = await ble.requestMtu({ deviceId: selectedDeviceId, mtu: 512 });
      this.mtu = Math.max(mtuResult.value - 3, DEFAULT_MTU); // MTU minus ATT header overhead
    } catch {
      // MTU negotiation not supported or failed — keep default 20
    }

    this.deviceId = selectedDeviceId;

    // Listen for unexpected disconnections from the native CoreBluetooth layer
    this.disconnectListenerHandle = await ble.addListener('disconnected', (data) => {
      if (data.deviceId === this.deviceId) {
        this.deviceId = null;
        this.disconnectListenerHandle = null;
        this.disconnectCallback?.();
      }
    });

    return {
      deviceId: selectedDeviceId,
      deviceName: selectedDeviceName,
    };
  }

  async disconnect(): Promise<void> {
    // Remove the disconnect listener before intentional disconnect
    // to avoid firing the callback for user-initiated disconnections
    if (this.disconnectListenerHandle) {
      await this.disconnectListenerHandle.remove();
      this.disconnectListenerHandle = null;
    }

    if (this.deviceId) {
      try {
        const ble = getBlePlugin();
        await ble.disconnect({ deviceId: this.deviceId });
      } catch {
        // Ignore disconnect errors (device may already be disconnected)
      }
      this.deviceId = null;
    }
  }

  async write(data: Uint8Array, signal?: AbortSignal): Promise<void> {
    if (!this.deviceId) {
      throw new Error('Not connected');
    }

    const ble = getBlePlugin();
    const chunkSize = this.mtu;
    const needsPacing = this.mtu <= DEFAULT_MTU;

    // Convert the entire packet to hex once, then slice per-chunk.
    // Each byte = 2 hex chars, so chunk boundaries are chunkSize * 2.
    const fullHex = toHexString(data);
    const hexChunkSize = chunkSize * 2;

    for (let i = 0; i < fullHex.length; i += hexChunkSize) {
      // Check abort signal before each chunk to stop sending stale climbs
      if (signal?.aborted) {
        throw new DOMException('Write aborted', 'AbortError');
      }

      // Add a small delay between chunks when using the minimum MTU
      // to avoid overwhelming the CoreBluetooth write queue
      if (needsPacing && i > 0) {
        await delay(INTER_CHUNK_DELAY_MS);
      }

      await ble.write({
        deviceId: this.deviceId,
        service: UART_SERVICE_UUID,
        characteristic: UART_WRITE_CHARACTERISTIC_UUID,
        value: fullHex.slice(i, i + hexChunkSize),
      });
    }
  }

  onDisconnect(callback: () => void): () => void {
    this.disconnectCallback = callback;
    return () => {
      this.disconnectCallback = null;
    };
  }
}
