import { type IDBPDatabase, openDB } from 'idb';

/**
 * Per-device list of playlists the user has recently opened.
 * Used as a fallback for the "Pinned" grid on /playlists when the user has
 * not pinned anything yet — the grid is filled with their most-recently-used
 * playlists instead of being empty. Pinning lives server-side; this list is
 * deliberately local-only (no cross-device sync).
 */
export type RecentPlaylist = {
  uuid: string;
  boardType: string;
  layoutId: number | null;
  timestamp: number;
};

export const RECENT_PLAYLISTS_CHANGED_EVENT = 'boardsesh:recent-playlists-changed';
const DB_NAME = 'boardsesh-recent-playlists';
const DB_VERSION = 1;
const STORE_NAME = 'playlists';
const STORE_KEY = 'recent';
const MAX_ITEMS = 16;

let dbPromise: Promise<IDBPDatabase> | null = null;

const initDB = async (): Promise<IDBPDatabase | null> => {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return null;
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  }
  return dbPromise;
};

export async function getRecentPlaylists(): Promise<RecentPlaylist[]> {
  if (typeof window === 'undefined') return [];
  try {
    const db = await initDB();
    if (!db) return [];
    const data = (await db.get(STORE_NAME, STORE_KEY)) as RecentPlaylist[] | undefined;
    return data ?? [];
  } catch (error) {
    console.error('Failed to get recent playlists:', error);
    return [];
  }
}

export async function recordPlaylistOpen(entry: Omit<RecentPlaylist, 'timestamp'>): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const existing = await getRecentPlaylists();
    // Dedupe by uuid so re-opening a playlist bubbles it to the front.
    const deduped = existing.filter((e) => e.uuid !== entry.uuid);
    const next: RecentPlaylist[] = [{ ...entry, timestamp: Date.now() }, ...deduped].slice(0, MAX_ITEMS);

    const db = await initDB();
    if (!db) return;
    await db.put(STORE_NAME, next, STORE_KEY);
    window.dispatchEvent(new CustomEvent(RECENT_PLAYLISTS_CHANGED_EVENT));
  } catch (error) {
    console.error('Failed to record playlist open:', error);
  }
}

export async function clearRecentPlaylists(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const db = await initDB();
    if (!db) return;
    await db.delete(STORE_NAME, STORE_KEY);
    window.dispatchEvent(new CustomEvent(RECENT_PLAYLISTS_CHANGED_EVENT));
  } catch (error) {
    console.error('Failed to clear recent playlists:', error);
  }
}
