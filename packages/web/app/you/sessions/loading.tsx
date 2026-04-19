import React from 'react';
import Box from '@mui/material/Box';
import FeedItemSkeleton from '@/app/components/activity-feed/feed-item-skeleton';

export default function SessionsLoading() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <FeedItemSkeleton />
      <FeedItemSkeleton />
      <FeedItemSkeleton />
    </Box>
  );
}
