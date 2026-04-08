export interface BleConnection {
  deviceId: string;
  deviceName?: string;
}

export interface BluetoothAdapter {
  /** Check if BLE is available and enabled */
  isAvailable(): Promise<boolean>;

  /** Scan for and connect to a board. Shows platform-appropriate device picker. */
  requestAndConnect(): Promise<BleConnection>;

  /** Disconnect from the current device */
  disconnect(): Promise<void>;

  /**
   * Write a complete board payload to the UART characteristic.
   * The adapter handles transport-level chunking internally.
   *
   * If `signal` is provided and aborted, remaining chunks are skipped
   * and the method throws an `AbortError`.
   */
  write(data: Uint8Array, signal?: AbortSignal): Promise<void>;

  /** Register a callback for disconnection events. Returns an unsubscribe function. */
  onDisconnect(callback: () => void): () => void;
}
