'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Favorite from '@mui/icons-material/Favorite';
import FavoriteBorderOutlined from '@mui/icons-material/FavoriteBorderOutlined';
import ChatBubbleOutlineOutlined from '@mui/icons-material/ChatBubbleOutlineOutlined';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { createGraphQLHttpClient } from '@/app/lib/graphql/client';
import { useWsAuthToken } from '@/app/hooks/use-ws-auth-token';
import {
  VOTE,
  GET_VOTE_SUMMARY,
  type GetVoteSummaryQueryResponse,
  type VoteMutationResponse,
} from '@/app/lib/graphql/operations/comments-votes';
import { DELETE_BETA_VIDEO } from '@/app/lib/graphql/operations/beta-videos';
import type { BetaVideoData } from './boardsesh-beta-card';
import HlsVideoPlayer, { type HlsVideoPlayerHandle } from './hls-video-player';
import styles from './beta-video-reels.module.css';

type BetaVideoReelsPlayerProps = {
  videos: BetaVideoData[];
  initialIndex: number;
  onClose: () => void;
};

const BetaVideoReelsPlayer: React.FC<BetaVideoReelsPlayerProps> = ({ videos, initialIndex, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const { status: sessionStatus } = useSession();
  const isAuthenticated = sessionStatus === 'authenticated';
  const { token: authToken } = useWsAuthToken();
  const queryClient = useQueryClient();
  const videoRef = useRef<HlsVideoPlayerHandle>(null);

  // Swipe state
  const touchStartY = useRef(0);
  const touchDeltaY = useRef(0);
  const isSwiping = useRef(false);

  const currentVideo = videos[currentIndex];

  // Fetch vote summary for current video
  const { data: voteData } = useQuery({
    queryKey: ['voteSummary', 'beta_video', currentVideo?.uuid],
    queryFn: async () => {
      const client = createGraphQLHttpClient(authToken);
      return client.request<GetVoteSummaryQueryResponse>(GET_VOTE_SUMMARY, {
        entityType: 'beta_video',
        entityId: currentVideo.uuid,
      });
    },
    enabled: !!currentVideo,
    staleTime: 30 * 1000,
  });

  const userVote = voteData?.voteSummary?.userVote ?? 0;
  const likeCount = voteData?.voteSummary?.upvotes ?? 0;
  const isLiked = userVote === 1;

  const handleLike = useCallback(async () => {
    if (!isAuthenticated || !currentVideo) return;
    try {
      const client = createGraphQLHttpClient(authToken);
      await client.request<VoteMutationResponse>(VOTE, {
        input: {
          entityType: 'beta_video',
          entityId: currentVideo.uuid,
          value: 1,
        },
      });
      queryClient.invalidateQueries({ queryKey: ['voteSummary', 'beta_video', currentVideo.uuid] });
    } catch (error) {
      console.error('Failed to vote:', error);
    }
  }, [isAuthenticated, currentVideo, authToken, queryClient]);

  const handleDelete = useCallback(async () => {
    if (!currentVideo) return;
    try {
      const client = createGraphQLHttpClient(authToken);
      await client.request(DELETE_BETA_VIDEO, { uuid: currentVideo.uuid });
      queryClient.invalidateQueries({ queryKey: ['boardseshBetaVideos'] });
      if (videos.length <= 1) {
        onClose();
      } else {
        setCurrentIndex((prev) => Math.min(prev, videos.length - 2));
      }
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  }, [currentVideo, authToken, queryClient, videos.length, onClose]);

  // Swipe navigation
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchDeltaY.current = 0;
    isSwiping.current = false;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchDeltaY.current = e.touches[0].clientY - touchStartY.current;
    if (Math.abs(touchDeltaY.current) > 30) {
      isSwiping.current = true;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isSwiping.current) return;
    const threshold = 80;
    if (touchDeltaY.current < -threshold && currentIndex < videos.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else if (touchDeltaY.current > threshold && currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
    isSwiping.current = false;
  }, [currentIndex, videos.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown' && currentIndex < videos.length - 1) setCurrentIndex((prev) => prev + 1);
      if (e.key === 'ArrowUp' && currentIndex > 0) setCurrentIndex((prev) => prev - 1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, videos.length, onClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  if (!currentVideo) return null;

  const isOwner = !!currentVideo.userId && isAuthenticated;

  return (
    <div className={styles.overlay}>
      <div
        className={styles.videoContainer}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className={styles.videoWrapper}>
          {currentVideo.playbackUrl && (
            <HlsVideoPlayer
              key={currentVideo.uuid}
              ref={videoRef}
              src={currentVideo.playbackUrl}
              poster={currentVideo.thumbnailUrl ?? undefined}
              autoPlay
              loop
              className={styles.videoElement}
            />
          )}
        </div>

        {/* User info overlay */}
        <div className={styles.infoOverlay}>
          <div className={styles.userName}>
            {currentVideo.userDisplayName ? `@${currentVideo.userDisplayName}` : 'Anonymous'}
          </div>
          {currentVideo.angle != null && <div className={styles.climbInfo}>{currentVideo.angle}&deg;</div>}
        </div>

        {/* Side action buttons */}
        <div className={styles.sideActions}>
          {isAuthenticated && (
            <button className={styles.actionButton} onClick={handleLike} aria-label={isLiked ? 'Unlike' : 'Like'}>
              {isLiked ? (
                <Favorite sx={{ fontSize: 28, color: '#ff2d55' }} />
              ) : (
                <FavoriteBorderOutlined sx={{ fontSize: 28 }} />
              )}
              {likeCount > 0 && <span className={styles.actionCount}>{likeCount}</span>}
            </button>
          )}

          <button className={styles.actionButton} aria-label="Comments">
            <ChatBubbleOutlineOutlined sx={{ fontSize: 28 }} />
          </button>

          {isOwner && (
            <button className={styles.actionButton} onClick={handleDelete} aria-label="Delete video">
              <DeleteOutlined sx={{ fontSize: 28 }} />
            </button>
          )}
        </div>

        {/* Close button at center bottom */}
        <div className={styles.bottomBar}>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close video player">
            <CloseOutlined sx={{ fontSize: 24 }} />
          </button>
        </div>

        {/* Video counter */}
        {videos.length > 1 && (
          <div className={styles.swipeIndicator}>
            {currentIndex + 1} / {videos.length}
          </div>
        )}
      </div>
    </div>
  );
};

export default BetaVideoReelsPlayer;
