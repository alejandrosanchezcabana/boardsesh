'use client';

import React from 'react';
import Chip, { ChipProps } from '@mui/material/Chip';
import { darkTokens, themeTokens } from '@/app/theme/theme-config';
import { useIsDarkMode } from '@/app/hooks/use-is-dark-mode';

type HoldStatusTone = 'primary' | 'secondary' | 'success' | 'error' | 'pink';

interface HoldStatusChipProps extends Omit<ChipProps, 'color'> {
  tone: HoldStatusTone;
  active: boolean;
}

const ACTIVE_STYLES: Record<HoldStatusTone, { color: string; lightBg: string; darkBg: string }> = {
  primary: {
    color: themeTokens.colors.primary,
    lightBg: `${themeTokens.colors.primary}14`,
    darkBg: `${themeTokens.colors.primary}29`,
  },
  secondary: {
    color: themeTokens.colors.secondary,
    lightBg: `${themeTokens.colors.secondary}14`,
    darkBg: `${themeTokens.colors.secondary}29`,
  },
  success: {
    color: themeTokens.colors.success,
    lightBg: themeTokens.colors.successBg,
    darkBg: darkTokens.statusBg.success,
  },
  error: {
    color: themeTokens.colors.error,
    lightBg: themeTokens.colors.errorBg,
    darkBg: darkTokens.statusBg.error,
  },
  pink: {
    color: themeTokens.colors.pink,
    lightBg: `${themeTokens.colors.pink}14`,
    darkBg: `${themeTokens.colors.pink}29`,
  },
};

export function getHoldStatusChipStyles(tone: HoldStatusTone, active: boolean, isDark: boolean) {
  if (!active) {
    return {
      backgroundColor: 'var(--neutral-100)',
      color: 'var(--neutral-600)',
      border: '1px solid var(--neutral-200)',
    };
  }

  const style = ACTIVE_STYLES[tone];

  return {
    backgroundColor: isDark ? style.darkBg : style.lightBg,
    color: style.color,
    border: `1px solid ${style.color}${isDark ? '52' : '33'}`,
  };
}

export default function HoldStatusChip({ active, sx, tone, ...props }: HoldStatusChipProps) {
  const isDark = useIsDarkMode();

  return (
    <Chip
      size="small"
      variant="outlined"
      {...props}
      sx={[
        {
          ...getHoldStatusChipStyles(tone, active, isDark),
          fontWeight: 600,
          '& .MuiChip-label': {
            px: 1.25,
          },
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    />
  );
}
