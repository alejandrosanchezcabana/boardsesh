import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getGradeDisplayFormat,
  setGradeDisplayFormat,
} from '@/app/lib/user-preferences-db';
import type { GradeDisplayFormat } from '@/app/lib/grade-colors';
import { formatGrade, getSoftGradeColorByFormat } from '@/app/lib/grade-colors';

/** Custom event name used to sync grade format across mounted components. */
const GRADE_FORMAT_CHANGE_EVENT = 'boardsesh:gradeFormatChange';

export function useGradeFormat() {
  const [gradeFormat, setGradeFormatState] = useState<GradeDisplayFormat>('v-grade');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getGradeDisplayFormat().then((value) => {
      setGradeFormatState(value);
      setLoaded(true);
    });
  }, []);

  // Listen for changes from other components that call setGradeFormat
  useEffect(() => {
    const handler = (e: Event) => {
      const format = (e as CustomEvent<GradeDisplayFormat>).detail;
      setGradeFormatState(format);
    };
    window.addEventListener(GRADE_FORMAT_CHANGE_EVENT, handler);
    return () => window.removeEventListener(GRADE_FORMAT_CHANGE_EVENT, handler);
  }, []);

  const setGradeFormat = useCallback(async (format: GradeDisplayFormat) => {
    await setGradeDisplayFormat(format);
    setGradeFormatState(format);
    // Notify all other mounted instances of the hook
    window.dispatchEvent(
      new CustomEvent(GRADE_FORMAT_CHANGE_EVENT, { detail: format }),
    );
  }, []);

  const formatGradeWithPreference = useCallback(
    (difficulty: string | null | undefined): string | null => {
      return formatGrade(difficulty, gradeFormat);
    },
    [gradeFormat],
  );

  const getGradeColor = useCallback(
    (difficulty: string | null | undefined, darkMode?: boolean): string | undefined => {
      return getSoftGradeColorByFormat(difficulty, gradeFormat, darkMode);
    },
    [gradeFormat],
  );

  return useMemo(
    () => ({
      gradeFormat,
      setGradeFormat,
      loaded,
      formatGrade: formatGradeWithPreference,
      getGradeColor,
    }),
    [gradeFormat, setGradeFormat, loaded, formatGradeWithPreference, getGradeColor],
  );
}
