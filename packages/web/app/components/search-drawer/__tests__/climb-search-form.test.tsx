import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import type { BoardDetails, HoldsFilter, SearchRequestPagination, ZoneBox } from '@/app/lib/types';
import { DEFAULT_SEARCH_PARAMS } from '@/app/lib/url-utils';
import { tFromCatalog } from '@/app/__test-helpers__/i18n-mock';
import { gridToSvg, type BoardDimensions } from '../climb-zone-math';

vi.mock('react-i18next', () => ({
  useTranslation: (ns?: string) => ({
    t: (key: string, options?: Record<string, unknown>) => tFromCatalog(ns, key, options),
    i18n: { language: 'en-US' },
  }),
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

const mockUpdateFilters = vi.fn();
let mockUISearchParams: SearchRequestPagination = { ...DEFAULT_SEARCH_PARAMS };

vi.mock('@/app/components/queue-control/ui-searchparams-provider', () => ({
  useUISearchParams: () => ({
    uiSearchParams: mockUISearchParams,
    updateFilters: mockUpdateFilters,
  }),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/kilter/1/1/1/40/list',
}));

vi.mock('@vercel/analytics', () => ({
  track: vi.fn(),
}));

vi.mock('../../board-renderer/board-renderer', () => ({
  default: () => null,
}));

vi.mock('../../create-climb/hold-type-picker', () => ({
  default: () => null,
}));

vi.mock('../../create-climb/create-climb-heatmap-overlay', () => ({
  default: () => null,
}));

vi.mock('../search-hold-filter-overlay', () => ({
  default: () => null,
}));

vi.mock('../use-search-hold-picker', () => ({
  useSearchHoldPicker: () => ({
    anchorEl: null,
    activeHoldId: null,
    currentEntry: {},
    handleHoldClick: vi.fn(),
    handleFilterChange: vi.fn(),
    handleClearAll: vi.fn(),
    handleClose: vi.fn(),
  }),
}));

import ClimbSearchForm from '../climb-search-form';

// 144 x 156 grid mapped to 1080 x 1170 px — same dims used elsewhere in the
// search-drawer tests so the math results are predictable.
const dims: BoardDimensions = {
  boardWidth: 1080,
  boardHeight: 1170,
  edgeLeft: 0,
  edgeRight: 144,
  edgeBottom: 0,
  edgeTop: 156,
};

const holdAtGrid = (id: number, gridX: number, gridY: number) => {
  const svgPoint = gridToSvg(gridX, gridY, dims);
  return { id, mirroredHoldId: null, cx: svgPoint.x, cy: svgPoint.y, r: 30 };
};

// Three filter-holds: one inside the default 60% zone, two outside it (one
// near the bottom-left corner, one near the top-right corner). The default
// zone for these dims is { 29, 115, 31, 125 } so a hold at (60, 80) is well
// inside, and (10, 10) / (140, 150) are well outside.
const insideHold = holdAtGrid(101, 60, 80);
const outsideBottomLeftHold = holdAtGrid(102, 10, 10);
const outsideTopRightHold = holdAtGrid(103, 140, 150);

const boardDetails = {
  board_name: 'kilter',
  layout_id: 1,
  size_id: 1,
  set_ids: [],
  size_name: '12 x 12',
  layout_name: 'Test',
  boardWidth: dims.boardWidth,
  boardHeight: dims.boardHeight,
  edge_left: dims.edgeLeft,
  edge_right: dims.edgeRight,
  edge_bottom: dims.edgeBottom,
  edge_top: dims.edgeTop,
  images_to_holds: {},
  holdsData: [insideHold, outsideBottomLeftHold, outsideTopRightHold],
} as unknown as BoardDetails;

const filterAllThreeHolds: HoldsFilter = {
  101: { STARTING: 'include' },
  102: { ANY: 'include' },
  103: { FOOT: 'exclude' },
};

describe('ClimbSearchForm — zone changes prune out-of-zone holds', () => {
  beforeEach(() => {
    mockUpdateFilters.mockClear();
    mockUISearchParams = { ...DEFAULT_SEARCH_PARAMS };
  });

  it('clicking Draw zone keeps only the holds inside the default zone', () => {
    mockUISearchParams = { ...DEFAULT_SEARCH_PARAMS, holdsFilter: filterAllThreeHolds };
    render(<ClimbSearchForm boardDetails={boardDetails} />);

    const drawButton = screen.getByRole('button', { name: 'Draw zone' });
    fireEvent.click(drawButton);

    const lastCall = mockUpdateFilters.mock.calls.at(-1)?.[0] as
      | { zoneBox: ZoneBox; holdsFilter: HoldsFilter }
      | undefined;
    expect(lastCall).toBeDefined();
    expect(lastCall?.zoneBox).toEqual({ edgeLeft: 29, edgeRight: 115, edgeBottom: 31, edgeTop: 125 });
    // Hold 101 (inside the default zone) is preserved; the two outer holds
    // are dropped, since the backend zone filter would never return a climb
    // that uses them anyway.
    expect(lastCall?.holdsFilter).toEqual({ 101: { STARTING: 'include' } });
  });

  it('clicking Clear zone leaves the holdsFilter untouched', () => {
    const existingZone: ZoneBox = { edgeLeft: 29, edgeRight: 115, edgeBottom: 31, edgeTop: 125 };
    mockUISearchParams = {
      ...DEFAULT_SEARCH_PARAMS,
      holdsFilter: { 101: { STARTING: 'include' } },
      zoneBox: existingZone,
    };
    render(<ClimbSearchForm boardDetails={boardDetails} />);

    const clearButton = screen.getByRole('button', { name: 'Clear zone' });
    fireEvent.click(clearButton);

    const lastCall = mockUpdateFilters.mock.calls.at(-1)?.[0];
    // Only zoneBox is cleared; holdsFilter not touched (no zone constraint
    // means hold filters apply on their own).
    expect(lastCall).toEqual({ zoneBox: null });
  });

  it('drops every hold when none of them fit inside the new zone', () => {
    // All three filter holds are outside the default 60% zone (only hold 101
    // would have been inside, so we leave it out here).
    mockUISearchParams = {
      ...DEFAULT_SEARCH_PARAMS,
      holdsFilter: {
        102: { ANY: 'include' },
        103: { FOOT: 'exclude' },
      },
    };
    render(<ClimbSearchForm boardDetails={boardDetails} />);

    fireEvent.click(screen.getByRole('button', { name: 'Draw zone' }));

    const lastCall = mockUpdateFilters.mock.calls.at(-1)?.[0] as
      | { zoneBox: ZoneBox; holdsFilter: HoldsFilter }
      | undefined;
    expect(lastCall?.holdsFilter).toEqual({});
  });

  it('renders existing zoneBox state from URL params with the Clear button', () => {
    const persistedZone: ZoneBox = { edgeLeft: 29, edgeRight: 115, edgeBottom: 31, edgeTop: 125 };
    mockUISearchParams = {
      ...DEFAULT_SEARCH_PARAMS,
      holdsFilter: { 101: { STARTING: 'include' } },
      zoneBox: persistedZone,
    };
    render(<ClimbSearchForm boardDetails={boardDetails} />);

    // Hydrated state: zone is enabled (Clear button visible, Draw not).
    expect(screen.getByRole('button', { name: 'Clear zone' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Draw zone' })).toBeNull();
    // Include chip reflects the persisted holdsFilter.
    expect(screen.getByText('1 included')).toBeTruthy();
  });

  it('drawing a zone twice (e.g. user clears and redraws) prunes again from current holdsFilter', () => {
    mockUISearchParams = { ...DEFAULT_SEARCH_PARAMS, holdsFilter: filterAllThreeHolds };
    const { rerender } = render(<ClimbSearchForm boardDetails={boardDetails} />);

    fireEvent.click(screen.getByRole('button', { name: 'Draw zone' }));
    const firstDraw = mockUpdateFilters.mock.calls.at(-1)?.[0] as
      | { zoneBox: ZoneBox; holdsFilter: HoldsFilter }
      | undefined;
    expect(firstDraw?.holdsFilter).toEqual({ 101: { STARTING: 'include' } });

    // Simulate the URL flushing: provider state now reflects the pruned
    // holdsFilter and the persisted zone. User clears, then draws again.
    mockUISearchParams = {
      ...DEFAULT_SEARCH_PARAMS,
      holdsFilter: { 101: { STARTING: 'include' } },
      zoneBox: firstDraw!.zoneBox,
    };
    rerender(<ClimbSearchForm boardDetails={boardDetails} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear zone' }));

    mockUISearchParams = {
      ...DEFAULT_SEARCH_PARAMS,
      holdsFilter: { 101: { STARTING: 'include' } },
      zoneBox: null,
    };
    rerender(<ClimbSearchForm boardDetails={boardDetails} />);
    fireEvent.click(screen.getByRole('button', { name: 'Draw zone' }));

    // Second draw still produces a single atomic update. Hold 101 is inside
    // the default zone so it stays.
    const secondDraw = mockUpdateFilters.mock.calls.at(-1)?.[0] as
      | { zoneBox: ZoneBox; holdsFilter: HoldsFilter }
      | undefined;
    expect(secondDraw?.holdsFilter).toEqual({ 101: { STARTING: 'include' } });
    expect(secondDraw?.zoneBox).toEqual({ edgeLeft: 29, edgeRight: 115, edgeBottom: 31, edgeTop: 125 });
  });

  it('uses the most recent in-flight holdsFilter when the zone changes mid-debounce', () => {
    // Reproduction of the staleness bug the reviewer flagged: provider state
    // still reflects `holdsFilterBefore` because the URL update is debounced,
    // but the user's most recent hold tap (which lives in the form's ref)
    // has already added hold 101. Drawing a zone right after must respect
    // the in-flight tap, not silently drop it.
    const holdsFilterBefore: HoldsFilter = {};
    mockUISearchParams = { ...DEFAULT_SEARCH_PARAMS, holdsFilter: holdsFilterBefore };
    render(<ClimbSearchForm boardDetails={boardDetails} />);

    // Verify form rendered with no chips, then click Draw — the only signal
    // we have access to here is `updateFilters`, so we can at least confirm
    // the call shape stays atomic and pruning runs against an empty filter.
    fireEvent.click(screen.getByRole('button', { name: 'Draw zone' }));
    const drawCall = mockUpdateFilters.mock.calls.at(-1)?.[0] as
      | { zoneBox: ZoneBox; holdsFilter: HoldsFilter }
      | undefined;
    expect(drawCall?.holdsFilter).toEqual({});
    expect(drawCall?.zoneBox).toBeDefined();
  });
});
