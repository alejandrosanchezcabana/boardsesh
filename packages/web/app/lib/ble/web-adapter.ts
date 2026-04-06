import {
  getCharacteristic,
  requestDevice,
  splitMessages,
  writeCharacteristicSeries,
} from '@/app/components/board-bluetooth-control/bluetooth';
import type { BleConnection, BluetoothAdapter } from './types';

export class WebBluetoothAdapter implements BluetoothAdapter {
  private device: BluetoothDevice | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private disconnectHandler: (() => void) | null = null;

  async isAvailable(): Promise<boolean> {
    return typeof navigator !== 'undefined' && !!navigator.bluetooth;
  }

  async requestAndConnect(): Promise<BleConnection> {
    // Clean up any existing device listeners
    this.cleanupListeners();

    const device = await requestDevice();
    const characteristic = await getCharacteristic(device);

    if (!characteristic) {
      throw new Error('Failed to get UART characteristic');
    }

    device.addEventListener('gattserverdisconnected', this.handleDisconnect);

    this.device = device;
    this.characteristic = characteristic;

    return {
      deviceId: device.id,
      deviceName: device.name ?? undefined,
    };
  }

  async disconnect(): Promise<void> {
    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.cleanupListeners();
    this.device = null;
    this.characteristic = null;
  }

  async write(data: Uint8Array, signal?: AbortSignal): Promise<void> {
    if (!this.characteristic) {
      throw new Error('Not connected');
    }
    const messages = splitMessages(data);
    await writeCharacteristicSeries(this.characteristic, messages, signal);
  }

  onDisconnect(callback: () => void): () => void {
    this.disconnectHandler = callback;
    return () => {
      this.disconnectHandler = null;
    };
  }

  private handleDisconnect = (): void => {
    this.characteristic = null;
    this.disconnectHandler?.();
  };

  private cleanupListeners(): void {
    if (this.device) {
      this.device.removeEventListener('gattserverdisconnected', this.handleDisconnect);
    }
  }
}
