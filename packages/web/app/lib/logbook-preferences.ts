import { getAllLayouts } from '@/app/lib/board-constants';

export type BoardFilter = 'all' | 'kilter' | 'tension' | 'moonboard';
export type SortPreset = 'recent' | 'hardest';
export type SortField = 'climbName' | 'loggedGrade' | 'consensusGrade' | 'date' | 'attemptCount';
export type SortDirection = 'asc' | 'desc';

export type LogbookFilterState = {
  includeSends: boolean;
  includeAttempts: boolean;
  flashOnly: boolean;
  minGrade: number | '';
  maxGrade: number | '';
  fromDate: string;
  toDate: string;
  angleRange: [number, number];
  benchmarkOnly: boolean;
};

export type LogbookSortState = {
  mode: 'preset' | 'custom';
  preset: SortPreset;
  primaryField: SortField;
  primaryDirection: SortDirection;
  secondaryField: '' | SortField;
  secondaryDirection: SortDirection;
};

export type LogbookPreferences = {
  version: 1;
  boardFilter: BoardFilter;
  layoutSelections: Record<Exclude<BoardFilter, 'all'>, number[]>;
  filters: LogbookFilterState;
  sort: LogbookSortState;
};

export const DEFAULT_ANGLE_RANGE: [number, number] = [0, 70];

export const DEFAULT_FILTERS: LogbookFilterState = {
  includeSends: true,
  includeAttempts: false,
  flashOnly: false,
  minGrade: '',
  maxGrade: '',
  fromDate: '',
  toDate: '',
  angleRange: DEFAULT_ANGLE_RANGE,
  benchmarkOnly: false,
};

export const DEFAULT_SORT: LogbookSortState = {
  mode: 'preset',
  preset: 'recent',
  primaryField: 'date',
  primaryDirection: 'desc',
  secondaryField: '',
  secondaryDirection: 'desc',
};

export const ALL_LAYOUT_SELECTIONS: Record<Exclude<BoardFilter, 'all'>, number[]> = {
  kilter: getAllLayouts('kilter').map((layout) => layout.id),
  tension: getAllLayouts('tension').map((layout) => layout.id),
  moonboard: getAllLayouts('moonboard').map((layout) => layout.id),
};

export const DEFAULT_LOGBOOK_PREFERENCES: LogbookPreferences = {
  version: 1,
  boardFilter: 'all',
  layoutSelections: ALL_LAYOUT_SELECTIONS,
  filters: DEFAULT_FILTERS,
  sort: DEFAULT_SORT,
};

const VALID_BOARD_FILTERS: BoardFilter[] = ['all', 'kilter', 'tension', 'moonboard'];
const VALID_SORT_FIELDS: Array<SortField | ''> = ['', 'climbName', 'loggedGrade', 'consensusGrade', 'date', 'attemptCount'];
const VALID_SORT_DIRECTIONS: SortDirection[] = ['asc', 'desc'];
const VALID_SORT_PRESETS: SortPreset[] = ['recent', 'hardest'];

function sanitizeDifficulty(value: unknown): number | '' {
  return typeof value === 'number' && Number.isFinite(value) ? value : '';
}

function sanitizeDate(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function sanitizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function sanitizeAngleRange(value: unknown): [number, number] {
  if (!Array.isArray(value) || value.length !== 2) {
    return DEFAULT_ANGLE_RANGE;
  }

  const rawMin = typeof value[0] === 'number' ? value[0] : DEFAULT_ANGLE_RANGE[0];
  const rawMax = typeof value[1] === 'number' ? value[1] : DEFAULT_ANGLE_RANGE[1];
  const min = Math.max(0, Math.min(70, rawMin));
  const max = Math.max(min, Math.min(70, rawMax));
  return [min, max];
}

function sanitizeLayoutSelections(value: unknown): Record<Exclude<BoardFilter, 'all'>, number[]> {
  const source = value && typeof value === 'object' ? value as Partial<Record<Exclude<BoardFilter, 'all'>, unknown>> : {};

  return {
    kilter: sanitizeBoardLayouts(source.kilter, 'kilter'),
    tension: sanitizeBoardLayouts(source.tension, 'tension'),
    moonboard: sanitizeBoardLayouts(source.moonboard, 'moonboard'),
  };
}

function sanitizeBoardLayouts(value: unknown, board: Exclude<BoardFilter, 'all'>): number[] {
  const validIds = new Set(ALL_LAYOUT_SELECTIONS[board]);
  const ids = Array.isArray(value)
    ? value.filter((candidate): candidate is number => typeof candidate === 'number' && validIds.has(candidate))
    : [];

  return ids.length > 0 ? Array.from(new Set(ids)).sort((a, b) => a - b) : ALL_LAYOUT_SELECTIONS[board];
}

export function sanitizeLogbookPreferences(value: unknown): LogbookPreferences {
  if (!value || typeof value !== 'object') {
    return DEFAULT_LOGBOOK_PREFERENCES;
  }

  const source = value as Partial<LogbookPreferences>;
  const filters = source.filters && typeof source.filters === 'object' ? source.filters : {};
  const sort = source.sort && typeof source.sort === 'object' ? source.sort : {};

  const sanitizedFilters: LogbookFilterState = {
    includeSends: sanitizeBoolean((filters as Partial<LogbookFilterState>).includeSends, DEFAULT_FILTERS.includeSends),
    includeAttempts: sanitizeBoolean((filters as Partial<LogbookFilterState>).includeAttempts, DEFAULT_FILTERS.includeAttempts),
    flashOnly: sanitizeBoolean((filters as Partial<LogbookFilterState>).flashOnly, DEFAULT_FILTERS.flashOnly),
    minGrade: sanitizeDifficulty((filters as Partial<LogbookFilterState>).minGrade),
    maxGrade: sanitizeDifficulty((filters as Partial<LogbookFilterState>).maxGrade),
    fromDate: sanitizeDate((filters as Partial<LogbookFilterState>).fromDate),
    toDate: sanitizeDate((filters as Partial<LogbookFilterState>).toDate),
    angleRange: sanitizeAngleRange((filters as Partial<LogbookFilterState>).angleRange),
    benchmarkOnly: sanitizeBoolean((filters as Partial<LogbookFilterState>).benchmarkOnly, DEFAULT_FILTERS.benchmarkOnly),
  };

  if (!sanitizedFilters.includeSends && !sanitizedFilters.includeAttempts) {
    sanitizedFilters.includeSends = true;
  }
  if (!sanitizedFilters.includeSends) {
    sanitizedFilters.flashOnly = false;
  }

  const sanitizedSort: LogbookSortState = {
    mode: sort && (sort as Partial<LogbookSortState>).mode === 'custom' ? 'custom' : 'preset',
    preset: VALID_SORT_PRESETS.includes((sort as Partial<LogbookSortState>).preset ?? 'recent')
      ? ((sort as Partial<LogbookSortState>).preset as SortPreset)
      : DEFAULT_SORT.preset,
    primaryField: VALID_SORT_FIELDS.includes((sort as Partial<LogbookSortState>).primaryField ?? 'date')
      ? (((sort as Partial<LogbookSortState>).primaryField || 'date') as SortField)
      : DEFAULT_SORT.primaryField,
    primaryDirection: VALID_SORT_DIRECTIONS.includes((sort as Partial<LogbookSortState>).primaryDirection ?? 'desc')
      ? ((sort as Partial<LogbookSortState>).primaryDirection as SortDirection)
      : DEFAULT_SORT.primaryDirection,
    secondaryField: VALID_SORT_FIELDS.includes((sort as Partial<LogbookSortState>).secondaryField ?? '')
      ? (((sort as Partial<LogbookSortState>).secondaryField ?? '') as '' | SortField)
      : DEFAULT_SORT.secondaryField,
    secondaryDirection: VALID_SORT_DIRECTIONS.includes((sort as Partial<LogbookSortState>).secondaryDirection ?? 'desc')
      ? ((sort as Partial<LogbookSortState>).secondaryDirection as SortDirection)
      : DEFAULT_SORT.secondaryDirection,
  };

  const boardFilter = VALID_BOARD_FILTERS.includes(source.boardFilter ?? 'all')
    ? (source.boardFilter as BoardFilter)
    : DEFAULT_LOGBOOK_PREFERENCES.boardFilter;

  return {
    version: 1,
    boardFilter,
    layoutSelections: sanitizeLayoutSelections(source.layoutSelections),
    filters: sanitizedFilters,
    sort: sanitizedSort,
  };
}
