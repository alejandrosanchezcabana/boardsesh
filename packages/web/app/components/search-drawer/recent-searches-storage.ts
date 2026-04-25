import { type IDBPDatabase, openDB } from 'idb';
import type { SearchRequestPagination } from '@/app/lib/types';
import { DEFAULT_SEARCH_PARAMS } from '@/app/lib/url-utils';

export type RecentSearch = {
  id: string;
  label: string;
  filters: Partial<SearchRequestPagination>;
  timestamp: number;
};

export const RECENT_SEARCHES_CHANGED_EVENT = 'boardsesh:recent-searches-changed';
const DB_NAME = 'boardsesh-recent-searches';
const DB_VERSION = 1;
const STORE_NAME = 'searches';
const STORE_KEY = 'recent';
const MAX_ITEMS = 10;
const LEGACY_STORAGE_KEY = 'boardsesh_recent_searches';

// Numeric filter fields that the form historically wrote as `undefined` and
// that searchParamsToUrlParams used to crash on. Cleaned up on read.
const NUMERIC_FILTER_FIELDS = ['minGrade', 'maxGrade', 'minAscents', 'minRating', 'gradeAccuracy'] as const;

/**
 * Replace `undefined` numeric fields with their defaults. Older entries
 * persisted by the search drawer can contain `undefined` for these fields,
 * which violates the SearchRequestPagination type and crashed serialization
 * on iOS (see Sentry issues 7434008446 / 7435688419 / 7439815956).
 */
function sanitizeFilters(filters: Partial<SearchRequestPagination>): {
  filters: Partial<SearchRequestPagination>;
  changed: boolean;
} {
  let changed = false;
  const cleaned: Partial<SearchRequestPagination> = { ...filters };
  for (const field of NUMERIC_FILTER_FIELDS) {
    if (field in cleaned && cleaned[field] === undefined) {
      cleaned[field] = DEFAULT_SEARCH_PARAMS[field];
      changed = true;
    }
  }
  return { filters: cleaned, changed };
}

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

export function getFilterKey(filters: Partial<SearchRequestPagination>): string {
  // Exclude page/pageSize from comparison since they're not meaningful for deduplication
  const { page: _page, pageSize: _pageSize, ...rest } = filters as SearchRequestPagination;
  return JSON.stringify(rest, Object.keys(rest).sort());
}

export async function getRecentSearches(): Promise<RecentSearch[]> {
  if (typeof window === 'undefined') return [];
  try {
    const db = await initDB();
    if (!db) return [];
    const data = (await db.get(STORE_NAME, STORE_KEY)) as RecentSearch[] | undefined;
    if (data) {
      let anyChanged = false;
      const cleaned = data.map((entry) => {
        const { filters, changed } = sanitizeFilters(entry.filters);
        if (changed) anyChanged = true;
        return changed ? { ...entry, filters } : entry;
      });
      // One-time write-back so the corrupt undefined values stop coming back on every read.
      if (anyChanged) {
        await db.put(STORE_NAME, cleaned, STORE_KEY);
      }
      return cleaned;
    }

    // Attempt one-time migration from localStorage
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const parsed = (JSON.parse(legacy) as RecentSearch[]).map((entry) => ({
        ...entry,
        filters: sanitizeFilters(entry.filters).filters,
      }));
      await db.put(STORE_NAME, parsed, STORE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      return parsed;
    }

    return [];
  } catch (error) {
    console.error('Failed to get recent searches:', error);
    return [];
  }
}

export async function addRecentSearch(label: string, filters: Partial<SearchRequestPagination>): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const sanitized = sanitizeFilters(filters).filters;
    const existing = await getRecentSearches();
    const filterKey = getFilterKey(sanitized);

    // Remove duplicate if exists
    const deduplicated = existing.filter((s) => getFilterKey(s.filters) !== filterKey);

    const newEntry: RecentSearch = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      label,
      filters: sanitized,
      timestamp: Date.now(),
    };

    // Add to front, cap at MAX_ITEMS
    const updated = [newEntry, ...deduplicated].slice(0, MAX_ITEMS);
    const db = await initDB();
    if (!db) return;
    await db.put(STORE_NAME, updated, STORE_KEY);
    window.dispatchEvent(new CustomEvent(RECENT_SEARCHES_CHANGED_EVENT));
  } catch (error) {
    console.error('Failed to add recent search:', error);
  }
}
