import { describe, expect, it } from 'vitest';
import {
  ALL_LAYOUT_SELECTIONS,
  DEFAULT_LOGBOOK_PREFERENCES,
  sanitizeLogbookPreferences,
} from '../logbook-preferences';

describe('sanitizeLogbookPreferences', () => {
  it('returns defaults for non-object values', () => {
    expect(sanitizeLogbookPreferences(null)).toEqual(DEFAULT_LOGBOOK_PREFERENCES);
  });

  it('drops invalid board filters and layout ids', () => {
    const result = sanitizeLogbookPreferences({
      version: 1,
      boardFilter: 'spraywall',
      layoutSelections: {
        kilter: [999999],
        tension: [ALL_LAYOUT_SELECTIONS.tension[0]],
        moonboard: [],
      },
      filters: {},
      sort: {},
    });

    expect(result.boardFilter).toBe('all');
    expect(result.layoutSelections.kilter).toEqual(ALL_LAYOUT_SELECTIONS.kilter);
    expect(result.layoutSelections.tension).toEqual([ALL_LAYOUT_SELECTIONS.tension[0]]);
    expect(result.layoutSelections.moonboard).toEqual(ALL_LAYOUT_SELECTIONS.moonboard);
  });

  it('forces at least one result type and clears flashOnly when sends are off', () => {
    const result = sanitizeLogbookPreferences({
      version: 1,
      boardFilter: 'all',
      layoutSelections: ALL_LAYOUT_SELECTIONS,
      filters: {
        includeSends: false,
        includeAttempts: false,
        flashOnly: true,
        minGrade: '',
        maxGrade: '',
        fromDate: '',
        toDate: '',
        angleRange: [0, 70],
        benchmarkOnly: false,
      },
      sort: DEFAULT_LOGBOOK_PREFERENCES.sort,
    });

    expect(result.filters.includeSends).toBe(true);
    expect(result.filters.includeAttempts).toBe(false);
    expect(result.filters.flashOnly).toBe(true);
  });
});
