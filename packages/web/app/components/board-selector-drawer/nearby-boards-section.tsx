'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import LocationOnOutlined from '@mui/icons-material/LocationOnOutlined';
import BoardScrollSection from '../board-scroll/board-scroll-section';
import BoardScrollCard from '../board-scroll/board-scroll-card';
import { useNearbyBoards } from '@/app/hooks/use-nearby-boards';
import type { UserBoard } from '@boardsesh/shared-schema';
import { themeTokens } from '@/app/theme/theme-config';

interface NearbyBoardsSectionProps {
  open: boolean;
  onBoardSelect: (board: UserBoard) => void;
}

export default function NearbyBoardsSection({
  open,
  onBoardSelect,
}: NearbyBoardsSectionProps) {
  const { boards, isLoading, permissionState, requestPermission, error } = useNearbyBoards({
    enabled: open,
    radiusKm: 50,
    limit: 10,
  });

  // Show loading while coords are being fetched (permission already granted)
  if (permissionState === 'granted' && isLoading) {
    return <BoardScrollSection title="Found Nearby" loading />;
  }

  // Show permission prompt when permission is unknown (null — iOS Safari
  // doesn't support the Permissions API), prompt, or denied (on iOS, calling
  // getCurrentPosition can still trigger the native prompt even when the
  // Permissions API reports 'denied', so we always offer the button).
  if (!boards.length && permissionState !== 'granted') {
    return (
      <BoardScrollSection title="Found Nearby">
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            minWidth: 200,
            py: 2,
            px: 2,
            textAlign: 'center',
          }}
        >
          <LocationOnOutlined
            sx={{ fontSize: 32, color: themeTokens.neutral[400] }}
          />
          <Typography variant="body2" color="text.secondary">
            {error || 'Enable location to find boards nearby'}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            onClick={requestPermission}
            startIcon={<LocationOnOutlined />}
          >
            {error ? 'Try Again' : 'Enable Location'}
          </Button>
        </Box>
      </BoardScrollSection>
    );
  }

  // Loading state
  if (isLoading) {
    return <BoardScrollSection title="Found Nearby" loading />;
  }

  // No results - don't show empty section
  if (boards.length === 0) {
    return null;
  }

  return (
    <BoardScrollSection title="Found Nearby">
      {boards.map((board) => (
        <BoardScrollCard
          key={board.uuid}
          userBoard={board}
          distanceMeters={board.distanceMeters}
          onClick={() => onBoardSelect(board)}
        />
      ))}
    </BoardScrollSection>
  );
}
