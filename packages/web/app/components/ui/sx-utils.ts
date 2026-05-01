import type { SxProps, Theme } from '@mui/material';

export type SxArrayItem = Exclude<SxProps<Theme>, readonly unknown[]>;

export function toSxArray(sx: SxProps<Theme> | undefined): SxArrayItem[] {
  if (Array.isArray(sx)) return sx as SxArrayItem[];
  if (sx) return [sx as SxArrayItem];
  return [];
}
