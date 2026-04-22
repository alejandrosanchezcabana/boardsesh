'use client';

import React, { useMemo } from 'react';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Rating from '@mui/material/Rating';
import { EmptyState } from '@/app/components/ui/empty-state';
import type { Climb } from '@/app/lib/types';
import { useBoardProvider } from '../board-provider/board-provider-context';
import dayjs from 'dayjs';
import { AscentStatusIcon } from '@/app/components/ascent-status/ascent-status-icon';
import { normalizeAscentStatus } from '@/app/components/ascent-status/ascent-status-utils';

interface LogbookViewProps {
  currentClimb: Climb;
}

export const LogbookView: React.FC<LogbookViewProps> = ({ currentClimb }) => {
  const { logbook, boardName } = useBoardProvider();

  // Filter ascents for current climb and sort by climbed_at (newest first)
  const climbAscents = useMemo(
    () =>
      logbook
        .filter((ascent) => ascent.climb_uuid === currentClimb.uuid)
        .sort((a, b) => dayjs(b.climbed_at).valueOf() - dayjs(a.climbed_at).valueOf()),
    [logbook, currentClimb.uuid],
  );

  const showMirrorTag = boardName === 'tension';

  if (climbAscents.length === 0) {
    return <EmptyState description="No ascents logged for this climb" />;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {climbAscents.map((ascent) => {
        const ascentStatus = normalizeAscentStatus({
          status: ascent.status,
          isAscent: ascent.is_ascent,
          tries: ascent.tries,
        });
        const hasSuccess = ascentStatus !== 'attempt';

        return (
          <Card key={`${ascent.climb_uuid}-${ascent.climbed_at}`} sx={{ width: '100%' }}>
            <CardContent sx={{ p: 1.5 }}>
              <Stack spacing={1} style={{ width: '100%' }}>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  <Typography variant="body2" component="span" fontWeight={600}>
                    {dayjs(ascent.climbed_at).format('MMM D, YYYY h:mm A')}
                  </Typography>
                  {ascent.angle !== currentClimb.angle && (
                    <>
                      <Chip label={ascent.angle} size="small" color="primary" />
                      <AscentStatusIcon status={ascentStatus} variant="icon" />
                    </>
                  )}
                  {showMirrorTag && ascent.is_mirror && <Chip label="Mirrored" size="small" color="secondary" />}
                </Stack>
                {hasSuccess && ascent.quality && (
                  <Stack direction="row" spacing={1}>
                    <Rating readOnly value={ascent.quality} max={5} size="small" />
                  </Stack>
                )}
                <Stack direction="row" spacing={1}>
                  <Typography variant="body2" component="span">
                    Attempts: {ascent.tries}
                  </Typography>
                </Stack>

                {ascent.comment && (
                  <Typography variant="body2" component="span" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                    {ascent.comment}
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        );
      })}
    </Box>
  );
};
