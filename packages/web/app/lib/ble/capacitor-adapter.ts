import type { BoardName } from "@/app/lib/types";
import type { BleConnection, BluetoothAdapter } from "./types";
import {
  AURORA_OPTIONAL_SERVICE_UUIDS,
  AURORA_SCAN_SERVICE_UUIDS,
} from "@/app/components/board-bluetooth-control/bluetooth-aurora";
import {
  MOONBOARD_OPTIONAL_SERVICE_UUIDS,
  MOONBOARD_SCAN_SERVICE_UUIDS,
} from "@/app/components/board-bluetooth-control/bluetooth-moonboard";
import {
  MAX_BLUETOOTH_MESSAGE_SIZE,
  UART_SERVICE_UUID,
  UART_WRITE_CHARACTERISTIC_UUID,
} from "@/app/components/board-bluetooth-control/bluetooth-shared";

const DEFAULT_MTU = MAX_BLUETOOTH_MESSAGE_SIZE;

// Small delay between chunked writes when using the default MTU.
// Gives CoreBluetooth breathing room when sending many small chunks.
const INTER_CHUNK_DELAY_MS = 5;

// Raw Capacitor plugin interface as exposed via window.Capacitor.Plugins.BluetoothLe.
// The plugin JS is injected by the native shell. We type only the methods we use.
// IMPORTANT: The raw plugin's write() expects `value` as a continuous hex string (no spaces), not DataView.
// The BleClient npm wrapper normally handles this conversion, but we bypass it.

interface PluginListenerHandle {
  remove(): Promise<void>;
}

interface CapacitorBlePlugin {
  initialize(): Promise<void>;
  isEnabled(): Promise<{ value: boolean }>;
  requestDevice(options: {
    services: string[];
    optionalServices?: string[];
  }): Promise<{ deviceId: string; name?: string }>;
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
    eventName: "disconnected",
    callback: (data: { deviceId: string }) => void,
  ): Promise<PluginListenerHandle>;
}

function getBlePlugin(): CapacitorBlePlugin {
  const plugin = window.Capacitor?.Plugins?.BluetoothLe;
  if (!plugin) {
    throw new Error("Capacitor BluetoothLe plugin not available");
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
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class CapacitorBleAdapter implements BluetoothAdapter {
  constructor(private readonly boardName: BoardName = "kilter") {}

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

  async requestAndConnect(): Promise<BleConnection> {
    await ensureInitialized();
    const ble = getBlePlugin();

    const services =
      this.boardName === "moonboard"
        ? [...MOONBOARD_SCAN_SERVICE_UUIDS]
        : [...AURORA_SCAN_SERVICE_UUIDS];
    const optionalServices =
      this.boardName === "moonboard"
        ? [...MOONBOARD_OPTIONAL_SERVICE_UUIDS]
        : [...AURORA_OPTIONAL_SERVICE_UUIDS];

    // Request device — shows native scan dialog on iOS.
    // MoonBoard controllers advertise Nordic UART directly; Aurora boards use
    // their own advertised service and expose UART after connection.
    const device = await ble.requestDevice({
      services,
      optionalServices,
    });

    // Connect to the device
    await ble.connect({ deviceId: device.deviceId });

    // Negotiate larger MTU (iOS negotiates automatically, but requesting
    // explicitly ensures we know the actual value for chunking)
    try {
      const mtuResult = await ble.requestMtu({ deviceId: device.deviceId, mtu: 512 });
      this.mtu = mtuResult.value - 3; // MTU minus ATT header overhead
    } catch {
      // MTU negotiation not supported or failed — keep default 20
    }

    this.deviceId = device.deviceId;

    // Listen for unexpected disconnections from the native CoreBluetooth layer
    this.disconnectListenerHandle = await ble.addListener("disconnected", (data) => {
      if (data.deviceId === this.deviceId) {
        this.deviceId = null;
        this.disconnectListenerHandle = null;
        this.disconnectCallback?.();
      }
    });

    return {
      deviceId: device.deviceId,
      deviceName: device.name,
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
      throw new Error("Not connected");
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
        throw new DOMException("Write aborted", "AbortError");
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
