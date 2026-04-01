/**
 * Computes the filter updates for a grade range change, ensuring
 * min never exceeds max and vice-versa.
 */
export function buildGradeRangeUpdate(
  type: 'min' | 'max',
  value: number | undefined,
  currentMin: number | undefined,
  currentMax: number | undefined,
): { minGrade?: number | undefined; maxGrade?: number | undefined } {
  if (type === 'min') {
    const updates: { minGrade?: number | undefined; maxGrade?: number | undefined } = { minGrade: value };
    if (value && currentMax && value > currentMax) {
      updates.maxGrade = value;
    }
    return updates;
  }

  const updates: { minGrade?: number | undefined; maxGrade?: number | undefined } = { maxGrade: value };
  if (value && currentMin && value < currentMin) {
    updates.minGrade = value;
  }
  return updates;
}
