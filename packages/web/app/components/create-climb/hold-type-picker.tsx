'use client';

import React, { useMemo } from 'react';
import Popover from '@mui/material/Popover';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import { HOLD_STATE_MAP, type HoldState } from '../board-renderer/types';
import { themeTokens } from '@/app/theme/theme-config';
import type { BoardName } from '@/app/lib/types';

type SelectableState = HoldState | 'OFF';

interface HoldTypePickerProps {
  boardName: BoardName;
  anchorEl: Element | null;
  currentState: SelectableState;
  startingCount: number;
  finishCount: number;
  onSelect: (state: SelectableState) => void;
  onClose: () => void;
}

// Order in which hold types should appear in the picker.
const STATE_ORDER: HoldState[] = ['STARTING', 'HAND', 'FINISH', 'FOOT'];

const STATE_LABELS: Record<HoldState, string> = {
  STARTING: 'Start',
  HAND: 'Mid',
  FINISH: 'Finish',
  FOOT: 'Foot',
  OFF: 'Clear',
  ANY: 'Any',
  NOT: 'Not',
  AUX: 'Aux',
};

interface PickerOption {
  state: SelectableState;
  label: string;
  color: string;
}

/**
 * Build the picker's options from HOLD_STATE_MAP. Each board exposes a different
 * set of role codes — MoonBoard has no FOOT, etc. We dedupe by HoldState name
 * and use the first occurrence's displayColor (or color) so the swatch matches
 * what the LED actually shows on that board.
 */
function buildOptions(boardName: BoardName): PickerOption[] {
  const boardMap = HOLD_STATE_MAP[boardName];
  const colorByState = new Map<HoldState, string>();

  for (const entry of Object.values(boardMap)) {
    if (!colorByState.has(entry.name)) {
      colorByState.set(entry.name, entry.displayColor ?? entry.color);
    }
  }

  const options: PickerOption[] = [];
  for (const state of STATE_ORDER) {
    const color = colorByState.get(state);
    if (!color) continue;
    options.push({ state, label: STATE_LABELS[state], color });
  }
  return options;
}

const SWATCH_SIZE = 36;

export default function HoldTypePicker({
  boardName,
  anchorEl,
  currentState,
  startingCount,
  finishCount,
  onSelect,
  onClose,
}: HoldTypePickerProps) {
  const options = useMemo(() => buildOptions(boardName), [boardName]);

  const handleSelect = (state: SelectableState, disabled: boolean) => {
    if (disabled) return;
    onSelect(state);
  };

  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      slotProps={{
        paper: {
          sx: {
            borderRadius: `${themeTokens.borderRadius.lg}px`,
            boxShadow: themeTokens.shadows.lg,
            overflow: 'visible',
          },
        },
      }}
    >
      <Box
        role="menu"
        aria-label="Hold type"
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: `${themeTokens.spacing[1]}px`,
          padding: `${themeTokens.spacing[2]}px ${themeTokens.spacing[3]}px`,
        }}
      >
        {options.map((option) => {
          const isActive = option.state === currentState;
          const isDisabled =
            (option.state === 'STARTING' && startingCount >= 2 && !isActive) ||
            (option.state === 'FINISH' && finishCount >= 2 && !isActive);

          return (
            <Swatch
              key={option.state}
              label={option.label}
              color={option.color}
              isActive={isActive}
              isDisabled={isDisabled}
              onClick={() => handleSelect(option.state, isDisabled)}
            />
          );
        })}
        <Swatch
          key="clear"
          label="Clear"
          isClear
          isActive={currentState === 'OFF'}
          isDisabled={currentState === 'OFF'}
          onClick={() => handleSelect('OFF', currentState === 'OFF')}
        />
      </Box>
    </Popover>
  );
}

interface SwatchProps {
  label: string;
  color?: string;
  isActive: boolean;
  isDisabled: boolean;
  isClear?: boolean;
  onClick: () => void;
}

function Swatch({ label, color, isActive, isDisabled, isClear, onClick }: SwatchProps) {
  const ring = isClear ? themeTokens.neutral[400] : color ?? themeTokens.neutral[400];

  return (
    <ButtonBase
      onClick={onClick}
      disabled={isDisabled}
      aria-label={label}
      aria-pressed={isActive}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: `${themeTokens.spacing[1]}px`,
        padding: `${themeTokens.spacing[1]}px`,
        borderRadius: `${themeTokens.borderRadius.md}px`,
        opacity: isDisabled ? 0.35 : 1,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        transition: themeTokens.transitions.fast,
        '&:hover': isDisabled
          ? undefined
          : { backgroundColor: themeTokens.semantic.selectedLight },
      }}
    >
      <Box
        sx={{
          width: SWATCH_SIZE,
          height: SWATCH_SIZE,
          borderRadius: '50%',
          border: `3px solid ${ring}`,
          backgroundColor: isActive && !isClear ? ring : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: isClear ? ring : isActive ? '#FFFFFF' : 'transparent',
          boxSizing: 'border-box',
        }}
      >
        {isClear && <CloseIcon sx={{ fontSize: 18 }} />}
      </Box>
      <Typography
        variant="caption"
        sx={{
          fontSize: 11,
          fontWeight: themeTokens.typography.fontWeight.medium,
          lineHeight: 1,
          color: 'text.primary',
        }}
      >
        {label}
      </Typography>
    </ButtonBase>
  );
}
