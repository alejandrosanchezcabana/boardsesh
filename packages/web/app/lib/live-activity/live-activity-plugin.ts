import { isNativeApp, getPlatform } from '../ble/capacitor-utils';

interface LiveActivityStartOptions {
  sessionId: string;
  serverUrl: string;
  authToken?: string;
  boardName: string;
  layoutId: number;
  sizeId: number;
  setIds: string;
}

interface LiveActivityUpdateOptions {
  climbName: string;
  climbDifficulty: string;
  angle: number;
  currentIndex: number;
  totalClimbs: number;
  hasNext: boolean;
  hasPrevious: boolean;
  climbUuid: string;
  queue: Array<{
    uuid: string;
    climbUuid: string;
    climbName: string;
    difficulty: string;
    angle: number;
    frames: string;
    setterUsername: string;
  }>;
}

interface LiveActivityPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  startSession(options: LiveActivityStartOptions): Promise<void>;
  endSession(): Promise<void>;
  updateActivity(options: LiveActivityUpdateOptions): Promise<void>;
}

function getPlugin(): LiveActivityPlugin | null {
  if (!isNativeApp() || getPlatform() !== 'ios') return null;
  const plugins = window.Capacitor?.Plugins;
  if (!plugins) return null;
  return (plugins.LiveActivity as LiveActivityPlugin | undefined) ?? null;
}

export async function isLiveActivityAvailable(): Promise<boolean> {
  const plugin = getPlugin();
  if (!plugin) return false;
  try {
    const { available } = await plugin.isAvailable();
    return available;
  } catch {
    return false;
  }
}

export async function startLiveActivitySession(options: LiveActivityStartOptions): Promise<void> {
  const plugin = getPlugin();
  if (!plugin) return;
  try {
    await plugin.startSession(options);
  } catch (e) {
    console.warn('[LiveActivity] Failed to start session:', e);
  }
}

export async function endLiveActivitySession(): Promise<void> {
  const plugin = getPlugin();
  if (!plugin) return;
  try {
    await plugin.endSession();
  } catch (e) {
    console.warn('[LiveActivity] Failed to end session:', e);
  }
}

export async function updateLiveActivity(options: LiveActivityUpdateOptions): Promise<void> {
  const plugin = getPlugin();
  if (!plugin) return;
  try {
    await plugin.updateActivity(options);
  } catch (e) {
    console.warn('[LiveActivity] Failed to update activity:', e);
  }
}

export type { LiveActivityStartOptions, LiveActivityUpdateOptions, LiveActivityPlugin };
