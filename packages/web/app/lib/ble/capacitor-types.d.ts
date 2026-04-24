interface CapacitorGeolocationPlugin {
  getCurrentPosition(options?: { enableHighAccuracy?: boolean; timeout?: number; maximumAge?: number }): Promise<{
    coords: {
      latitude: number;
      longitude: number;
      accuracy: number;
      altitude: number | null;
      altitudeAccuracy: number | null;
      heading: number | null;
      speed: number | null;
    };
    timestamp: number;
  }>;
  checkPermissions(): Promise<{ location: 'prompt' | 'granted' | 'denied' }>;
  requestPermissions(): Promise<{ location: 'prompt' | 'granted' | 'denied' }>;
}

interface CapacitorKeepAwakePlugin {
  keepAwake(): Promise<void>;
  allowSleep(): Promise<void>;
  isSupported(): Promise<{ isSupported: boolean }>;
  isKeptAwake(): Promise<{ isKeptAwake: boolean }>;
}

interface CapacitorBrowserPlugin {
  open(options: { url: string; toolbarColor?: string }): Promise<void>;
  close(): Promise<void>;
}

interface CapacitorAppPlugin {
  addListener(
    eventName: 'appUrlOpen',
    listenerFunc: (event: { url: string }) => void,
  ): Promise<{ remove: () => Promise<void> }>;
  getInfo(): Promise<{ name: string; id: string; build: string; version: string }>;
}

interface CapacitorInAppReviewPlugin {
  requestReview(): Promise<void>;
}

interface CapacitorMotionPlugin {
  addListener(
    eventName: 'accel',
    listenerFunc: (event: {
      acceleration: { x: number; y: number; z: number };
      accelerationIncludingGravity: { x: number; y: number; z: number };
    }) => void,
  ): Promise<{ remove: () => Promise<void> }>;
  removeAllListeners(): Promise<void>;
}

interface CapacitorDevUrlPlugin {
  getState(): Promise<{ isDebug: boolean; currentUrl: string | null; defaultUrl: string }>;
  setUrl(options: { url: string }): Promise<void>;
  clearUrl(): Promise<void>;
}

interface CapacitorGlobal {
  isNativePlatform(): boolean;
  getPlatform(): string;
  Plugins: {
    BluetoothLe?: unknown;
    Geolocation?: CapacitorGeolocationPlugin;
    KeepAwake?: CapacitorKeepAwakePlugin;
    Browser?: CapacitorBrowserPlugin;
    App?: CapacitorAppPlugin;
    DevUrl?: CapacitorDevUrlPlugin;
    InAppReview?: CapacitorInAppReviewPlugin;
    Motion?: CapacitorMotionPlugin;
    LiveActivity?: {
      isAvailable(): Promise<{ available: boolean }>;
      startSession(options: Record<string, unknown>): Promise<void>;
      endSession(): Promise<void>;
      updateActivity(options: Record<string, unknown>): Promise<void>;
      addListener(
        eventName: string,
        callback: (data: Record<string, unknown>) => void,
      ): { remove: () => void } | Promise<{ remove: () => void }>;
    };
    [key: string]: unknown;
  };
}

declare global {
  interface Window {
    Capacitor?: CapacitorGlobal;
  }
}

export {};
