'use client';

import React, { useMemo } from 'react';
import Box from '@mui/material/Box';
import dayjs from 'dayjs';
import { EmptyState } from '@/app/components/ui/empty-state';
import type { Climb } from '@/app/lib/types';
import { VoteSummaryProvider } from '@/app/components/social/vote-summary-context';
import { useBoardProvider } from '../board-provider/board-provider-context';
import { LogbookEntryCard } from './logbook-entry-card';

interface LogbookViewProps {
  currentClimb: Climb;
}

// Optimistic ticks live under a `temp-` UUID until the save mutation returns
// the real one — those rows must not render social affordances or be included
// in the bulk vote-summary fetch.
const isPersistedUuid = (uuid: string | undefined): uuid is string => !!uuid && !uuid.startsWith('temp-');

export const LogbookView: React.FC<LogbookViewProps> = ({ currentClimb }) => {
  const { logbook, boardName } = useBoardProvider();

  const climbAscents = useMemo(
    () =>
      logbook
        .filter((ascent) => ascent.climb_uuid === currentClimb.uuid)
        .sort((a, b) => dayjs(b.climbed_at).valueOf() - dayjs(a.climbed_at).valueOf()),
    [logbook, currentClimb.uuid],
  );

  const tickUuids = useMemo(
    () => climbAscents.map((ascent) => ascent.uuid).filter(isPersistedUuid),
    [climbAscents],
  );

  const showMirrorTag = boardName === 'tension';

  if (climbAscents.length === 0) {
    return <EmptyState description="No ascents logged for this climb" />;
  }

  return (
    <VoteSummaryProvider entityType="tick" entityIds={tickUuids}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {climbAscents.map((ascent) => (
          <LogbookEntryCard
            key={ascent.uuid || `${ascent.climb_uuid}-${ascent.climbed_at}`}
            entry={{
              climbedAt: ascent.climbed_at,
              angle: ascent.angle,
              isMirror: !!ascent.is_mirror,
              status: ascent.status ?? null,
              attemptCount: ascent.tries,
              quality: ascent.quality,
              comment: ascent.comment,
              tickUuid: isPersistedUuid(ascent.uuid) ? ascent.uuid : null,
              upvotes: ascent.upvotes,
              downvotes: ascent.downvotes,
              commentCount: ascent.commentCount,
            }}
            currentClimbAngle={currentClimb.angle}
            showMirrorTag={showMirrorTag}
          />
        ))}
      </Box>
    </VoteSummaryProvider>
  );
};
