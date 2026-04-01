import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import type { GetUserProfileStatsQueryResponse } from '@/app/lib/graphql/operations';
import { FONT_GRADE_COLORS, getGradeColorWithOpacity } from '@/app/lib/grade-colors';
import type { CssBarChartBar } from '@/app/components/charts/css-bar-chart';
import type { GroupedBar } from '@/app/components/charts/css-bar-chart';
import {
  type LogbookEntry,
  type TimeframeType,
  type AggregatedTimeframeType,
  difficultyMapping,
  getGradeChartColor,
  getLayoutKey,
  getLayoutDisplayName,
  getLayoutColor,
  BOARD_TYPES,
} from './profile-constants';

dayjs.extend(isoWeek);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

const GRADE_ORDER = Object.values(difficultyMapping);

function getGradeBarColor(grade: string, opacity = 0.4): string {
  const hex = FONT_GRADE_COLORS[grade.toLowerCase()];
  return hex ? getGradeColorWithOpacity(hex, opacity) : 'rgba(200, 200, 200, 0.4)';
}

// ── Timeframe filtering ─────────────────────────────────────────────

export function filterLogbookByTimeframe(
  logbook: LogbookEntry[],
  timeframe: TimeframeType,
  fromDate: string,
  toDate: string,
): LogbookEntry[] {
  const now = dayjs();
  switch (timeframe) {
    case 'lastWeek':
      return logbook.filter((entry) => dayjs(entry.climbed_at).isAfter(now.subtract(1, 'week')));
    case 'lastMonth':
      return logbook.filter((entry) => dayjs(entry.climbed_at).isAfter(now.subtract(1, 'month')));
    case 'lastYear':
      return logbook.filter((entry) => dayjs(entry.climbed_at).isAfter(now.subtract(1, 'year')));
    case 'custom':
      return logbook.filter((entry) => {
        const climbedAt = dayjs(entry.climbed_at);
        return climbedAt.isSameOrAfter(dayjs(fromDate), 'day') && climbedAt.isSameOrBefore(dayjs(toDate), 'day');
      });
    case 'all':
    default:
      return logbook;
  }
}

// ── Aggregated grade bars (for stats summary card) ──────────────────

export interface GradeBar {
  grade: string;
  count: number;
  color: string;
}

export function buildAggregatedGradeBars(
  allBoardsTicks: Record<string, LogbookEntry[]>,
  aggregatedTimeframe: AggregatedTimeframeType,
): GradeBar[] {
  const now = dayjs();

  const filterByTimeframe = (entry: LogbookEntry) => {
    const climbedAt = dayjs(entry.climbed_at);
    switch (aggregatedTimeframe) {
      case 'today':
        return climbedAt.isSame(now, 'day');
      case 'lastWeek':
        return climbedAt.isAfter(now.subtract(1, 'week'));
      case 'lastMonth':
        return climbedAt.isAfter(now.subtract(1, 'month'));
      case 'lastYear':
        return climbedAt.isAfter(now.subtract(1, 'year'));
      case 'all':
      default:
        return true;
    }
  };

  // Aggregate grade counts across all layouts using distinct climb UUIDs
  const gradeClimbs: Record<string, Set<string>> = {};

  BOARD_TYPES.forEach((boardType) => {
    const ticks = allBoardsTicks[boardType] || [];
    const filteredTicks = ticks.filter(filterByTimeframe);

    filteredTicks.forEach((entry) => {
      if (entry.difficulty === null || entry.status === 'attempt' || !entry.climbUuid) return;
      const grade = difficultyMapping[entry.difficulty];
      if (grade) {
        if (!gradeClimbs[grade]) gradeClimbs[grade] = new Set();
        gradeClimbs[grade].add(entry.climbUuid);
      }
    });
  });

  return GRADE_ORDER
    .filter((grade) => gradeClimbs[grade]?.size > 0)
    .map((grade) => ({
      grade,
      count: gradeClimbs[grade].size,
      color: getGradeBarColor(grade),
    }));
}

// ── Aggregated stacked bars (grade x layout, for stats summary) ─────

export interface LayoutLegendEntry {
  label: string;
  color: string;
}

export function buildAggregatedStackedBars(
  allBoardsTicks: Record<string, LogbookEntry[]>,
  aggregatedTimeframe: AggregatedTimeframeType,
): { bars: CssBarChartBar[]; legendEntries: LayoutLegendEntry[] } | null {
  const now = dayjs();

  const filterByTimeframe = (entry: LogbookEntry) => {
    const climbedAt = dayjs(entry.climbed_at);
    switch (aggregatedTimeframe) {
      case 'today':
        return climbedAt.isSame(now, 'day');
      case 'lastWeek':
        return climbedAt.isAfter(now.subtract(1, 'week'));
      case 'lastMonth':
        return climbedAt.isAfter(now.subtract(1, 'month'));
      case 'lastYear':
        return climbedAt.isAfter(now.subtract(1, 'year'));
      case 'all':
      default:
        return true;
    }
  };

  const layoutGradeClimbs: Record<string, Record<string, Set<string>>> = {};
  const allGrades = new Set<string>();
  const allLayouts = new Set<string>();

  BOARD_TYPES.forEach((boardType) => {
    const ticks = allBoardsTicks[boardType] || [];
    const filteredTicks = ticks.filter(filterByTimeframe);

    filteredTicks.forEach((entry) => {
      if (entry.difficulty === null || entry.status === 'attempt' || !entry.climbUuid) return;
      const grade = difficultyMapping[entry.difficulty];
      if (grade) {
        const layoutKey = getLayoutKey(boardType, entry.layoutId);
        if (!layoutGradeClimbs[layoutKey]) layoutGradeClimbs[layoutKey] = {};
        if (!layoutGradeClimbs[layoutKey][grade]) layoutGradeClimbs[layoutKey][grade] = new Set();
        layoutGradeClimbs[layoutKey][grade].add(entry.climbUuid);
        allGrades.add(grade);
        allLayouts.add(layoutKey);
      }
    });
  });

  if (allGrades.size === 0) return null;

  const sortedGrades = GRADE_ORDER.filter((g) => allGrades.has(g));

  const layoutOrder = [
    'kilter-1', 'kilter-8', 'tension-9', 'tension-10', 'tension-11',
    'moonboard-1', 'moonboard-2', 'moonboard-3', 'moonboard-4', 'moonboard-5',
  ];
  const sortedLayouts = Array.from(allLayouts).sort((a, b) => {
    const indexA = layoutOrder.indexOf(a);
    const indexB = layoutOrder.indexOf(b);
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return a.localeCompare(b);
  });

  const legendEntries: LayoutLegendEntry[] = sortedLayouts.map((layoutKey) => {
    const [boardType, layoutIdStr] = layoutKey.split('-');
    const layoutId = layoutIdStr === 'unknown' ? null : parseInt(layoutIdStr, 10);
    return {
      label: getLayoutDisplayName(boardType, layoutId),
      color: getLayoutColor(boardType, layoutId),
    };
  });

  const bars: CssBarChartBar[] = sortedGrades.map((grade) => ({
    key: grade,
    label: grade,
    segments: sortedLayouts.map((layoutKey) => {
      const [boardType, layoutIdStr] = layoutKey.split('-');
      const layoutId = layoutIdStr === 'unknown' ? null : parseInt(layoutIdStr, 10);
      return {
        value: layoutGradeClimbs[layoutKey]?.[grade]?.size || 0,
        color: getLayoutColor(boardType, layoutId),
        label: getLayoutDisplayName(boardType, layoutId),
      };
    }),
  }));

  return { bars, legendEntries };
}

// ── Weekly stacked bars ─────────────────────────────────────────────

export function buildWeeklyBars(filteredLogbook: LogbookEntry[]): CssBarChartBar[] | null {
  if (filteredLogbook.length === 0) return null;

  const weeks: string[] = [];
  const first = dayjs(filteredLogbook[filteredLogbook.length - 1]?.climbed_at).startOf('isoWeek');
  const last = dayjs(filteredLogbook[0]?.climbed_at).endOf('isoWeek');
  let current = first;
  while (current.isBefore(last) || current.isSame(last)) {
    weeks.push(`W${current.isoWeek()}`);
    current = current.add(1, 'week');
  }

  const weeklyData: Record<string, Record<string, number>> = {};
  filteredLogbook.forEach((entry) => {
    if (entry.difficulty === null) return;
    const week = `W${dayjs(entry.climbed_at).isoWeek()}`;
    const difficulty = difficultyMapping[entry.difficulty];
    if (difficulty) {
      if (!weeklyData[week]) weeklyData[week] = {};
      weeklyData[week][difficulty] = (weeklyData[week][difficulty] || 0) + 1;
    }
  });

  // Find which grades actually appear
  const activeGrades = GRADE_ORDER.filter((grade) =>
    weeks.some((week) => (weeklyData[week]?.[grade] || 0) > 0),
  );

  if (activeGrades.length === 0) return null;

  return weeks.map((week) => ({
    key: week,
    label: week,
    segments: activeGrades.map((grade) => ({
      value: weeklyData[week]?.[grade] || 0,
      color: getGradeChartColor(grade),
      label: grade,
    })),
  }));
}

// ── Flash vs Redpoint grouped bars ──────────────────────────────────

export function buildFlashRedpointBars(filteredLogbook: LogbookEntry[]): GroupedBar[] | null {
  if (filteredLogbook.length === 0) return null;

  const flash: Record<string, number> = {};
  const redpoint: Record<string, number> = {};

  filteredLogbook.forEach((entry) => {
    if (entry.difficulty === null) return;
    const difficulty = difficultyMapping[entry.difficulty];
    if (difficulty) {
      if (entry.tries === 1) {
        flash[difficulty] = (flash[difficulty] || 0) + 1;
      } else if (entry.tries > 1) {
        redpoint[difficulty] = (redpoint[difficulty] || 0) + entry.tries;
      }
    }
  });

  const allGrades = new Set([...Object.keys(flash), ...Object.keys(redpoint)]);
  const sortedGrades = GRADE_ORDER.filter((g) => allGrades.has(g));

  if (sortedGrades.length === 0) return null;

  return sortedGrades.map((grade) => ({
    key: grade,
    label: grade,
    values: [
      { value: flash[grade] || 0, color: 'rgba(75, 192, 192, 0.5)', label: 'Flash' },
      { value: redpoint[grade] || 0, color: 'rgba(192, 75, 75, 0.5)', label: 'Redpoint' },
    ],
  }));
}

// ── Statistics summary (layout percentages) ─────────────────────────

export interface LayoutPercentage {
  layoutKey: string;
  boardType: string;
  layoutId: number | null;
  displayName: string;
  color: string;
  count: number;
  grades: Record<string, number>;
  percentage: number;
}

export function buildStatisticsSummary(
  profileStats: GetUserProfileStatsQueryResponse['userProfileStats'] | null,
): { totalAscents: number; layoutPercentages: LayoutPercentage[] } {
  if (!profileStats) {
    return { totalAscents: 0, layoutPercentages: [] };
  }

  const totalAscents = profileStats.totalDistinctClimbs;

  const layoutsWithExactPercentages = profileStats.layoutStats
    .map((stats) => {
      const exactPercentage = totalAscents > 0 ? (stats.distinctClimbCount / totalAscents) * 100 : 0;
      const grades: Record<string, number> = {};
      stats.gradeCounts.forEach(({ grade, count }) => {
        const difficultyNum = parseInt(grade, 10);
        if (!isNaN(difficultyNum)) {
          const gradeName = difficultyMapping[difficultyNum];
          if (gradeName) {
            grades[gradeName] = count;
          }
        }
      });
      return {
        layoutKey: stats.layoutKey,
        boardType: stats.boardType,
        layoutId: stats.layoutId,
        displayName: getLayoutDisplayName(stats.boardType, stats.layoutId),
        color: getLayoutColor(stats.boardType, stats.layoutId),
        count: stats.distinctClimbCount,
        grades,
        exactPercentage,
        percentage: Math.floor(exactPercentage),
        remainder: exactPercentage - Math.floor(exactPercentage),
      };
    })
    .filter((layout) => layout.count > 0)
    .sort((a, b) => b.count - a.count);

  // Distribute remaining percentage points using largest remainder method
  const totalFloored = layoutsWithExactPercentages.reduce((sum, l) => sum + l.percentage, 0);
  const remaining = 100 - totalFloored;
  const sortedByRemainder = [...layoutsWithExactPercentages].sort((a, b) => b.remainder - a.remainder);
  for (let i = 0; i < remaining && i < sortedByRemainder.length; i++) {
    sortedByRemainder[i].percentage += 1;
  }

  const layoutPercentages = layoutsWithExactPercentages.map(
    ({ exactPercentage, remainder, ...rest }) => rest,
  );

  return { totalAscents, layoutPercentages };
}
