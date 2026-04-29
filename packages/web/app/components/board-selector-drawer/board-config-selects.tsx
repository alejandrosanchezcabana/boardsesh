'use client';

import React from 'react';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MuiSelect, { type SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';

import type { BoardName } from '@/app/lib/types';
import { SUPPORTED_BOARDS, ANGLES } from '@/app/lib/board-data';

export type BoardConfigSelectsProps = {
  selectedBoard: BoardName | undefined;
  selectedLayout: number | undefined;
  selectedSize: number | undefined;
  selectedSets: number[];
  selectedAngle: number;
  layouts: Array<{ id: number; name: string }>;
  sizes: Array<{ id: number; name: string; description?: string }>;
  sets: Array<{ id: number; name: string }>;
  onBoardChange: (board: BoardName) => void;
  onLayoutChange: (layoutId: number) => void;
  onSizeChange: (sizeId: number) => void;
  onSetsChange: (setIds: number[]) => void;
  onAngleChange: (angle: number) => void;
};

export default function BoardConfigSelects({
  selectedBoard,
  selectedLayout,
  selectedSize,
  selectedSets,
  selectedAngle,
  layouts,
  sizes,
  sets,
  onBoardChange,
  onLayoutChange,
  onSizeChange,
  onSetsChange,
  onAngleChange,
}: BoardConfigSelectsProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
      <FormControl fullWidth size="small">
        <InputLabel>Board</InputLabel>
        <MuiSelect
          value={selectedBoard || ''}
          label="Board"
          onChange={(e: SelectChangeEvent) => onBoardChange(e.target.value as BoardName)}
        >
          {SUPPORTED_BOARDS.map((board) => (
            <MenuItem key={board} value={board}>
              {board.charAt(0).toUpperCase() + board.slice(1)}
            </MenuItem>
          ))}
        </MuiSelect>
      </FormControl>

      <FormControl fullWidth size="small">
        <InputLabel>Layout</InputLabel>
        <MuiSelect
          value={selectedLayout ?? ''}
          label="Layout"
          onChange={(e: SelectChangeEvent<number | string>) => onLayoutChange(e.target.value as number)}
          disabled={!selectedBoard}
        >
          {layouts.map(({ id, name }) => (
            <MenuItem key={id} value={id}>
              {name}
            </MenuItem>
          ))}
        </MuiSelect>
      </FormControl>

      {selectedBoard !== 'moonboard' && (
        <FormControl fullWidth size="small">
          <InputLabel>Size</InputLabel>
          <MuiSelect
            value={selectedSize ?? ''}
            label="Size"
            onChange={(e: SelectChangeEvent<number | string>) => onSizeChange(e.target.value as number)}
            disabled={!selectedLayout}
          >
            {sizes.map(({ id, name, description }) => (
              <MenuItem key={id} value={id}>{`${name} ${description}`}</MenuItem>
            ))}
          </MuiSelect>
        </FormControl>
      )}

      <FormControl fullWidth size="small">
        <InputLabel>Hold Sets</InputLabel>
        <MuiSelect<number[]>
          multiple
          value={selectedSets}
          label="Hold Sets"
          onChange={(e) => onSetsChange(e.target.value as number[])}
          disabled={!selectedSize}
        >
          {sets.map(({ id, name }) => (
            <MenuItem key={id} value={id}>
              {name}
            </MenuItem>
          ))}
        </MuiSelect>
      </FormControl>

      <FormControl fullWidth size="small">
        <InputLabel>Angle</InputLabel>
        <MuiSelect
          value={selectedAngle}
          label="Angle"
          onChange={(e: SelectChangeEvent<number>) => onAngleChange(e.target.value)}
          disabled={!selectedBoard}
        >
          {selectedBoard &&
            ANGLES[selectedBoard].map((angle) => (
              <MenuItem key={angle} value={angle}>
                {angle}
              </MenuItem>
            ))}
        </MuiSelect>
      </FormControl>
    </Box>
  );
}
