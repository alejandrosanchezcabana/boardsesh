import {
  getVGradeColor as _getVGradeColor,
  getFontGradeColor as _getFontGradeColor,
  getGradeColor as _getGradeColor,
  DEFAULT_GRADE_COLOR,
} from "@boardsesh/board-constants/grade-colors";

/**
 * Get color for a V-grade string (e.g., "V3", "V10")
 * @returns Hex color string, always returns a color (defaults to gray)
 */
export function getVGradeColor(vGrade: string | null | undefined): string {
  return _getVGradeColor(vGrade) ?? DEFAULT_GRADE_COLOR;
}

/**
 * Get color for a Font grade string (e.g., "6a", "7b+")
 * @returns Hex color string, always returns a color (defaults to gray)
 */
export function getFontGradeColor(fontGrade: string | null | undefined): string {
  return _getFontGradeColor(fontGrade) ?? DEFAULT_GRADE_COLOR;
}

/**
 * Get color for a difficulty string that may contain both Font and V-grade (e.g., "6a/V3")
 * @returns Hex color string, always returns a color (defaults to gray)
 */
export function getGradeColor(difficulty: string | null | undefined): string {
  return _getGradeColor(difficulty) ?? DEFAULT_GRADE_COLOR;
}
