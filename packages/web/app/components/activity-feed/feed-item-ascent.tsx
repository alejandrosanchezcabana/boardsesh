'use client';

import React from 'react';
import type { ActivityFeedItem, FollowingAscentFeedItem } from '@boardsesh/shared-schema';
import SocialFeedItem from './social-feed-item';

interface FeedItemAscentProps {
  item: ActivityFeedItem;
}

/**
 * Thin adapter: maps ActivityFeedItem to FollowingAscentFeedItem shape
 * and renders existing SocialFeedItem with showUserHeader.
 */
export default function FeedItemAscent({ item }: FeedItemAscentProps) {
  const ascentItem: FollowingAscentFeedItem = {
    uuid: item.entityId,
    userId: item.actorId || '',
    userDisplayName: item.actorDisplayName ?? undefined,
    userAvatarUrl: item.actorAvatarUrl ?? undefined,
    climbUuid: item.climbUuid || '',
    climbName: item.climbName || 'Unknown Climb',
    setterUsername: item.setterUsername ?? undefined,
    boardType: item.boardType || '',
    layoutId: item.layoutId ?? undefined,
    angle: item.angle || 0,
    isMirror: item.isMirror ?? false,
    status: item.status || '',
    attemptCount: item.attemptCount || 0,
    quality: item.quality ?? undefined,
    difficulty: item.difficulty ?? undefined,
    difficultyName: item.difficultyName ?? undefined,
    isBenchmark: item.isBenchmark ?? false,
    isNoMatch: item.isNoMatch ?? false,
    comment: item.comment || '',
    climbedAt: item.createdAt,
    frames: item.frames ?? undefined,
    // Social aggregates aren't carried on ActivityFeedItem. SocialFeedItem
    // here renders without a tick-scoped like/comment footer, so the zero
    // defaults are never read by the UI — they exist only to satisfy the
    // required shape of FollowingAscentFeedItem.
    upvotes: 0,
    downvotes: 0,
    commentCount: 0,
  };

  return (
    <div data-testid="activity-feed-item">
      <SocialFeedItem item={ascentItem} showUserHeader />
    </div>
  );
}
