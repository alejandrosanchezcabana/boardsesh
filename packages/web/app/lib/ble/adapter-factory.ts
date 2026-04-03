import { isCapacitor, isCapacitorWebView, waitForCapacitor } from './capacitor-utils';
import type { BluetoothAdapter } from './types';

export async function createBluetoothAdapter(): Promise<BluetoothAdapter> {
  // If we detect a WebView but the Capacitor bridge isn't ready yet, wait briefly
  if (!isCapacitor() && isCapacitorWebView()) {
    await waitForCapacitor(3000);
  }

  if (isCapacitor()) {
    const { CapacitorBleAdapter } = await import('./capacitor-adapter');
    return new CapacitorBleAdapter();
  }
  const { WebBluetoothAdapter } = await import('./web-adapter');
  return new WebBluetoothAdapter();
}
