import type { BleConnection, BluetoothAdapter } from './types';

// Service UUIDs for Aurora boards (same as bluetooth.ts)
const AURORA_ADVERTISED_SERVICE_UUID = '4488b571-7806-4df6-bcff-a2897e4953ff';
const UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const UART_WRITE_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

// Raw Capacitor plugin interface as exposed via window.Capacitor.Plugins.BluetoothLe.
// The plugin JS is injected by the native shell. We type only the methods we use.
// IMPORTANT: The raw plugin's write() expects `value` as a hex string, not DataView.
// The BleClient npm wrapper normally handles this conversion, but we bypass it.
interface CapacitorBlePlugin {
  initialize(): Promise<void>;
  isEnabled(): Promise<{ value: boolean }>;
  requestDevice(options: {
    services: string[];
    optionalServices?: string[];
  }): Promise<{ deviceId: string; name?: string }>;
  connect(options: {
    deviceId: string;
  }): Promise<void>;
  disconnect(options: {
    deviceId: string;
  }): Promise<void>;
  write(options: {
    deviceId: string;
    service: string;
    characteristic: string;
    value: string; // Hex string, e.g. "01 02 ff"
  }): Promise<void>;
  requestMtu(options: {
    deviceId: string;
    mtu: number;
  }): Promise<{ value: number }>;
}

function getBlePlugin(): CapacitorBlePlugin {
  const plugin = window.Capacitor?.Plugins?.BluetoothLe;
  if (!plugin) {
    throw new Error('Capacitor BluetoothLe plugin not available');
  }
  return plugin as CapacitorBlePlugin;
}

/** Convert a Uint8Array to the space-separated hex string the raw plugin expects */
function toHexString(data: Uint8Array): string {
  return Array.from(data)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ');
}

export class CapacitorBleAdapter implements BluetoothAdapter {
  private deviceId: string | null = null;
  private disconnectCallback: (() => void) | null = null;
  private mtu = 20; // Conservative default; updated via MTU negotiation after connection

  async isAvailable(): Promise<boolean> {
    try {
      const ble = getBlePlugin();
      await ble.initialize();
      const result = await ble.isEnabled();
      return result.value;
    } catch {
      return false;
    }
  }

  async requestAndConnect(): Promise<BleConnection> {
    const ble = getBlePlugin();
    await ble.initialize();

    // Request device — shows native scan dialog on iOS
    const device = await ble.requestDevice({
      services: [AURORA_ADVERTISED_SERVICE_UUID],
      optionalServices: [UART_SERVICE_UUID],
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

    return {
      deviceId: device.deviceId,
      deviceName: device.name,
    };
  }

  async disconnect(): Promise<void> {
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

  async write(data: Uint8Array): Promise<void> {
    if (!this.deviceId) {
      throw new Error('Not connected');
    }

    const ble = getBlePlugin();
    const chunkSize = this.mtu;

    // Adapter owns chunking — callers pass the full packet from getBluetoothPacket()
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      await ble.write({
        deviceId: this.deviceId,
        service: UART_SERVICE_UUID,
        characteristic: UART_WRITE_UUID,
        value: toHexString(chunk),
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
