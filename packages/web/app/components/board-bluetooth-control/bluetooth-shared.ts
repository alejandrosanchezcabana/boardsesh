// Shared BLE transport constants/helpers used by all board protocols.

export const MAX_BLUETOOTH_MESSAGE_SIZE = 20;
export const MESSAGE_BODY_MAX_LENGTH = 255;

export const AURORA_ADVERTISED_SERVICE_UUID = '4488b571-7806-4df6-bcff-a2897e4953ff';
export const UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
export const UART_WRITE_CHARACTERISTIC_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

export const splitMessages = (buffer: Uint8Array) =>
  Array.from({ length: Math.ceil(buffer.length / MAX_BLUETOOTH_MESSAGE_SIZE) }, (_, i) =>
    buffer.slice(i * MAX_BLUETOOTH_MESSAGE_SIZE, (i + 1) * MAX_BLUETOOTH_MESSAGE_SIZE),
  );

export const writeCharacteristicSeries = async (
  characteristic: BluetoothRemoteGATTCharacteristic,
  messages: Uint8Array[],
  signal?: AbortSignal,
) => {
  for (const message of messages) {
    if (signal?.aborted) {
      throw new DOMException('Write aborted', 'AbortError');
    }
    await characteristic.writeValue(new Uint8Array(message));
  }
};

export const requestBluetoothDevice = async (options: RequestDeviceOptions) =>
  navigator.bluetooth.requestDevice(options);

export const getUartCharacteristic = async (device: BluetoothDevice) => {
  const server = await device.gatt?.connect();
  const service = await server?.getPrimaryService(UART_SERVICE_UUID);
  return await service?.getCharacteristic(UART_WRITE_CHARACTERISTIC_UUID);
};
