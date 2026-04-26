'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';
import Favorite from '@mui/icons-material/Favorite';
import FavoriteBorderOutlined from '@mui/icons-material/FavoriteBorderOutlined';
import ChatBubbleOutlineOutlined from '@mui/icons-material/ChatBubbleOutlineOutlined';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
import Instagram from '@mui/icons-material/Instagram';
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined';
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
import { themeTokens } from '@/app/theme/theme-config';
import type { BetaVideoData } from './boardsesh-beta-card';
import HlsVideoPlayer, { type HlsVideoPlayerHandle } from './hls-video-player';
import styles from './beta-video-reels.module.css';

export type ReelsItem =
  | { kind: 'bunny'; uuid: string; data: BetaVideoData }
  | {
      kind: 'instagram';
      uuid: string;
      link: string;
      embedUrl: string;
      thumbnail: string | null;
      username: string | null;
      angle: number | null;
    };

type BetaVideoReelsPlayerProps = {
  items: ReelsItem[];
  initialIndex: number;
  onClose: () => void;
};

const BetaVideoReelsPlayer: React.FC<BetaVideoReelsPlayerProps> = ({ items, initialIndex, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const { status: sessionStatus, data: session } = useSession();
  const isAuthenticated = sessionStatus === 'authenticated';
  const { token: authToken } = useWsAuthToken();
  const queryClient = useQueryClient();
  const videoRef = useRef<HlsVideoPlayerHandle>(null);

  const touchStartY = useRef(0);
  const touchDeltaY = useRef(0);
  const isSwiping = useRef(false);

  const currentItem = items[currentIndex];
  const currentBunnyVideo = currentItem?.kind === 'bunny' ? currentItem.data : null;

  const { data: voteData } = useQuery({
    queryKey: ['voteSummary', 'beta_video', currentBunnyVideo?.uuid],
    queryFn: async () => {
      const client = createGraphQLHttpClient(authToken);
      return client.request<GetVoteSummaryQueryResponse>(GET_VOTE_SUMMARY, {
        entityType: 'beta_video',
        entityId: currentBunnyVideo!.uuid,
      });
    },
    enabled: !!currentBunnyVideo,
    staleTime: 30 * 1000,
  });

  const userVote = voteData?.voteSummary?.userVote ?? 0;
  const likeCount = voteData?.voteSummary?.upvotes ?? 0;
  const isLiked = userVote === 1;

  const handleLike = useCallback(async () => {
    if (!isAuthenticated || !currentBunnyVideo) return;
    try {
      const client = createGraphQLHttpClient(authToken);
      await client.request<VoteMutationResponse>(VOTE, {
        input: {
          entityType: 'beta_video',
          entityId: currentBunnyVideo.uuid,
          value: 1,
        },
      });
      void queryClient.invalidateQueries({ queryKey: ['voteSummary', 'beta_video', currentBunnyVideo.uuid] });
    } catch (error) {
      console.error('Failed to vote:', error);
    }
  }, [isAuthenticated, currentBunnyVideo, authToken, queryClient]);

  const handleDelete = useCallback(async () => {
    if (!currentBunnyVideo) return;
    try {
      const client = createGraphQLHttpClient(authToken);
      await client.request(DELETE_BETA_VIDEO, { uuid: currentBunnyVideo.uuid });
      void queryClient.invalidateQueries({ queryKey: ['boardseshBetaVideos'] });
      if (items.length <= 1) {
        onClose();
      } else {
        setCurrentIndex((prev) => Math.min(prev, items.length - 2));
      }
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  }, [currentBunnyVideo, authToken, queryClient, items.length, onClose]);

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
    if (touchDeltaY.current < -threshold && currentIndex < items.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else if (touchDeltaY.current > threshold && currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
    isSwiping.current = false;
  }, [currentIndex, items.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown' && currentIndex < items.length - 1) setCurrentIndex((prev) => prev + 1);
      if (e.key === 'ArrowUp' && currentIndex > 0) setCurrentIndex((prev) => prev - 1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, items.length, onClose]);

  useEffect(() => {
    document.body.classList.add('reelsPlayerOpen');
    return () => {
      document.body.classList.remove('reelsPlayerOpen');
    };
  }, []);

  // Track the visual viewport so the overlay height follows the URL bar /
  // on-screen keyboard. Pure dvh isn't enough on Android Chrome — the bottom
  // close button gets clipped once Chrome's chrome reappears after the iframe
  // settles. Apply the viewport height as a CSS variable on the root element.
  useEffect(() => {
    const root = document.documentElement;
    const update = () => {
      const vh = window.visualViewport?.height ?? window.innerHeight;
      root.style.setProperty('--reels-vh', `${vh}px`);
    };
    update();
    const vv = window.visualViewport;
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      root.style.removeProperty('--reels-vh');
    };
  }, []);

  if (!currentItem) return null;
  if (typeof document === 'undefined') return null;

  const isOwner =
    currentItem.kind === 'bunny' &&
    isAuthenticated &&
    !!currentItem.data.userId &&
    currentItem.data.userId === session?.user?.id;

  const username = currentItem.kind === 'bunny' ? currentItem.data.userDisplayName : currentItem.username;
  const angle = currentItem.kind === 'bunny' ? currentItem.data.angle : currentItem.angle;

  return createPortal(
    <div className={styles.overlay}>
      <div
        className={styles.videoContainer}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className={styles.videoWrapper}>
          {currentItem.kind === 'bunny' && currentItem.data.playbackUrl && (
            <HlsVideoPlayer
              key={currentItem.data.uuid}
              ref={videoRef}
              src={currentItem.data.playbackUrl}
              poster={currentItem.data.thumbnailUrl ?? undefined}
              autoPlay
              muted
              loop
              className={styles.videoElement}
            />
          )}
          {currentItem.kind === 'instagram' && (
            <div className={styles.iframeWrapper}>
              <iframe
                key={currentItem.uuid}
                src={currentItem.embedUrl}
                title="Instagram beta video"
                scrolling="no"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              />
              <a className={styles.openOnInstagram} href={currentItem.link} target="_blank" rel="noopener noreferrer">
                <Instagram sx={{ fontSize: 16 }} />
                Open on Instagram
                <OpenInNewOutlined sx={{ fontSize: 14 }} />
              </a>
            </div>
          )}
        </div>

        <div className={styles.infoOverlay}>
          <div className={styles.userName}>{username ? `@${username}` : 'Anonymous'}</div>
          {angle != null && <div className={styles.climbInfo}>{angle}&deg;</div>}
        </div>

        {currentItem.kind === 'bunny' && (
          <div className={styles.sideActions}>
            {isAuthenticated && (
              <button className={styles.actionButton} onClick={handleLike} aria-label={isLiked ? 'Unlike' : 'Like'}>
                {isLiked ? (
                  <Favorite sx={{ fontSize: 28, color: themeTokens.colors.error }} />
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
        )}
      </div>

      <div className={styles.bottomBar}>
        <button className={styles.closeButton} onClick={onClose} aria-label="Close video player">
          <CloseOutlined sx={{ fontSize: 24 }} />
        </button>
      </div>
    </div>,
    document.body,
  );
};

export default BetaVideoReelsPlayer;
