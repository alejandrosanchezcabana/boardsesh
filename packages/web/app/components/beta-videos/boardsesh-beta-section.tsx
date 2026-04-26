'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import VideocamOutlined from '@mui/icons-material/VideocamOutlined';
import FileUploadOutlined from '@mui/icons-material/FileUploadOutlined';
import Instagram from '@mui/icons-material/Instagram';
import Skeleton from '@mui/material/Skeleton';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
import { createGraphQLHttpClient } from '@/app/lib/graphql/client';
import { useWsAuthToken } from '@/app/hooks/use-ws-auth-token';
import {
  GET_BETA_VIDEOS,
  CREATE_BETA_VIDEO,
  GET_BETA_VIDEO,
  GET_BETA_LINKS,
} from '@/app/lib/graphql/operations/beta-videos';
import type { BetaLink } from '@/app/lib/api-wrappers/sync-api-types';
import { dedupeBetaLinks, getInstagramEmbedUrl } from '@/app/lib/instagram-url';
import BoardseshBetaCard, { type BetaVideoData } from './boardsesh-beta-card';
import BetaVideoReelsPlayer, { type ReelsItem } from './beta-video-reels-player';
import AttachBetaLinkForm from './attach-beta-link-form';
import styles from './boardsesh-beta.module.css';

type BoardseshBetaSectionProps = {
  boardType: string;
  climbUuid: string;
  angle: number;
};

type BetaVideosQueryResult = {
  betaVideos: BetaVideoData[];
};

type CreateBetaVideoResult = {
  createBetaVideo: {
    uuid: string;
    uploadUrl: string;
    authorizationSignature: string;
    authorizationExpire: number;
    videoId: string;
    libraryId: string;
  };
};

type BetaVideoStatusResult = {
  betaVideo: { uuid: string; status: string } | null;
};

type BetaLinksQueryResult = {
  betaLinks: Array<{
    climbUuid: string;
    link: string;
    foreignUsername: string | null;
    angle: number | null;
    thumbnail: string | null;
    isListed: boolean | null;
    createdAt: string | null;
  }>;
};

type UploadProgress = {
  uuid: string;
  phase: 'uploading' | 'processing' | 'done' | 'error';
  progress: number;
  message: string;
};

const BoardseshBetaSection: React.FC<BoardseshBetaSectionProps> = ({ boardType, climbUuid, angle }) => {
  const { status: sessionStatus } = useSession();
  const isAuthenticated = sessionStatus === 'authenticated';
  const { token: authToken } = useWsAuthToken();
  const queryClient = useQueryClient();
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);
  const [upload, setUpload] = useState<UploadProgress | null>(null);
  const [instagramDialogOpen, setInstagramDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const { data: bunnyData, isLoading: isBunnyLoading } = useQuery({
    queryKey: ['boardseshBetaVideos', boardType, climbUuid],
    queryFn: async () => {
      const client = createGraphQLHttpClient();
      return client.request<BetaVideosQueryResult>(GET_BETA_VIDEOS, { boardType, climbUuid });
    },
    enabled: !!climbUuid,
    staleTime: 5 * 60 * 1000,
    refetchInterval: upload?.phase === 'processing' ? 5000 : false,
  });

  const { data: betaLinks = [], isLoading: isLinksLoading } = useQuery<BetaLink[]>({
    queryKey: ['betaLinks', boardType, climbUuid],
    queryFn: async () => {
      const client = createGraphQLHttpClient();
      const result = await client.request<BetaLinksQueryResult>(GET_BETA_LINKS, { boardType, climbUuid });
      return result.betaLinks.map((b) => ({
        climb_uuid: b.climbUuid,
        link: b.link,
        foreign_username: b.foreignUsername,
        angle: b.angle,
        thumbnail: b.thumbnail,
        is_listed: b.isListed ?? false,
        created_at: b.createdAt ?? '',
      }));
    },
    enabled: !!climbUuid,
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = isBunnyLoading || isLinksLoading;
  const videos = bunnyData?.betaVideos ?? [];
  const dedupedLinks = useMemo(() => dedupeBetaLinks(betaLinks), [betaLinks]);

  const reelsItems = useMemo<ReelsItem[]>(() => {
    const items: ReelsItem[] = [];
    for (const video of videos) {
      if (video.status === 'ready') {
        items.push({ kind: 'bunny', uuid: video.uuid, data: video });
      }
    }
    for (const link of dedupedLinks) {
      const embedUrl = getInstagramEmbedUrl(link.link);
      if (!embedUrl) continue;
      items.push({
        kind: 'instagram',
        uuid: `ig:${link.link}`,
        link: link.link,
        embedUrl,
        thumbnail: link.thumbnail,
        username: link.foreign_username,
        angle: link.angle,
      });
    }
    return items;
  }, [videos, dedupedLinks]);

  const totalCount = videos.length + dedupedLinks.length;

  const startPollingStatus = useCallback(
    (uuid: string) => {
      if (pollRef.current) clearInterval(pollRef.current);
      let attempts = 0;
      pollRef.current = setInterval(async () => {
        attempts++;
        try {
          const client = createGraphQLHttpClient(authToken);
          const result = await client.request<BetaVideoStatusResult>(GET_BETA_VIDEO, { uuid });
          if (result.betaVideo?.status === 'ready') {
            clearInterval(pollRef.current);
            pollRef.current = undefined;
            setUpload({ uuid, phase: 'done', progress: 100, message: 'Your beta is live!' });
            void queryClient.invalidateQueries({ queryKey: ['boardseshBetaVideos', boardType, climbUuid] });
            setTimeout(() => setUpload(null), 3000);
          } else if (result.betaVideo?.status === 'failed' || attempts > 120) {
            clearInterval(pollRef.current);
            pollRef.current = undefined;
            setUpload({ uuid, phase: 'error', progress: 0, message: 'Processing failed' });
            setTimeout(() => setUpload(null), 5000);
          }
        } catch {
          // ignore, retry on next interval
        }
      }, 5000);
    },
    [authToken, boardType, climbUuid, queryClient],
  );

  const handleFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (!file || !authToken) return;

      const validation = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
          URL.revokeObjectURL(video.src);
          if (video.videoWidth > video.videoHeight) {
            resolve({ ok: false, error: 'Only portrait videos — record vertically' });
          } else if (video.duration > 60) {
            resolve({ ok: false, error: 'Keep it under 60 seconds' });
          } else {
            resolve({ ok: true });
          }
        };
        video.onerror = () => {
          URL.revokeObjectURL(video.src);
          resolve({ ok: false, error: 'Could not read video file' });
        };
        video.src = URL.createObjectURL(file);
      });

      if (!validation.ok) {
        setUpload({ uuid: '', phase: 'error', progress: 0, message: validation.error! });
        setTimeout(() => setUpload(null), 4000);
        return;
      }

      try {
        setUpload({ uuid: '', phase: 'uploading', progress: 0, message: 'Preparing upload...' });
        const client = createGraphQLHttpClient(authToken);
        const result = await client.request<CreateBetaVideoResult>(CREATE_BETA_VIDEO, {
          input: { boardType, climbUuid, angle, title: file.name },
        });
        const { uuid, uploadUrl, authorizationSignature, authorizationExpire, videoId, libraryId } =
          result.createBetaVideo;

        setUpload({ uuid, phase: 'uploading', progress: 0, message: 'Uploading...' });

        void queryClient.invalidateQueries({ queryKey: ['boardseshBetaVideos', boardType, climbUuid] });

        const { Upload } = await import('tus-js-client');
        const tusUpload = new Upload(file, {
          endpoint: uploadUrl,
          retryDelays: [0, 3000, 5000, 10000],
          metadata: {
            filetype: file.type || 'video/mp4',
            title: videoId,
          },
          headers: {
            AuthorizationSignature: authorizationSignature,
            AuthorizationExpire: String(authorizationExpire),
            VideoId: videoId,
            LibraryId: libraryId,
          },
          onProgress: (bytesUploaded: number, bytesTotal: number) => {
            const pct = Math.round((bytesUploaded / bytesTotal) * 100);
            setUpload({ uuid, phase: 'uploading', progress: pct, message: `Uploading... ${pct}%` });
          },
          onSuccess: () => {
            setUpload({ uuid, phase: 'processing', progress: 100, message: 'Processing video...' });
            startPollingStatus(uuid);
          },
          onError: () => {
            setUpload({ uuid, phase: 'error', progress: 0, message: 'Upload failed' });
            setTimeout(() => setUpload(null), 5000);
          },
        });
        tusUpload.start();
      } catch (err) {
        console.error('Upload failed:', err);
        setUpload({ uuid: '', phase: 'error', progress: 0, message: 'Upload failed' });
        setTimeout(() => setUpload(null), 5000);
      }
    },
    [authToken, boardType, climbUuid, angle, queryClient, startPollingStatus],
  );

  const isUploading = upload?.phase === 'uploading' || upload?.phase === 'processing';

  const handleBunnyCardClick = useCallback(
    (videoUuid: string, status: string) => {
      if (status !== 'ready') return;
      const idx = reelsItems.findIndex((item) => item.kind === 'bunny' && item.uuid === videoUuid);
      if (idx >= 0) setSelectedItemIndex(idx);
    },
    [reelsItems],
  );

  const handleInstagramCardClick = useCallback(
    (link: BetaLink) => {
      const idx = reelsItems.findIndex((item) => item.kind === 'instagram' && item.link === link.link);
      if (idx >= 0) setSelectedItemIndex(idx);
    },
    [reelsItems],
  );

  return (
    <>
      <div className={styles.section}>
        <div className={styles.header}>
          <span className={styles.headerLabel}>
            <VideocamOutlined sx={{ fontSize: 14 }} />
            Boardsesh Beta
            {totalCount > 0 && ` (${totalCount})`}
          </span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileSelected}
          style={{ display: 'none' }}
          disabled={isUploading}
        />

        <div className={styles.scrollContainer}>
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={`skeleton-${i}`} className={styles.card}>
                <Skeleton variant="rounded" sx={{ aspectRatio: '9/16', width: '100%', borderRadius: '8px' }} />
              </div>
            ))
          ) : (
            <>
              {isAuthenticated && (
                <div className={styles.uploadCardStack}>
                  <button
                    className={styles.uploadButton}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    aria-label="Upload beta video"
                  >
                    <FileUploadOutlined sx={{ fontSize: 14 }} />
                  </button>
                  <button
                    className={styles.uploadButton}
                    onClick={() => setInstagramDialogOpen(true)}
                    aria-label="Add Instagram beta link"
                  >
                    <Instagram sx={{ fontSize: 14 }} />
                  </button>
                </div>
              )}
              {videos.map((video) => (
                <BoardseshBetaCard
                  key={video.uuid}
                  video={video}
                  onClick={() => handleBunnyCardClick(video.uuid, video.status)}
                />
              ))}
              {dedupedLinks.map((link) => (
                <BoardseshBetaCard
                  key={`ig-${link.link}`}
                  source="instagram"
                  link={link}
                  onClick={() => handleInstagramCardClick(link)}
                />
              ))}
              {totalCount === 0 && !isAuthenticated && <span className={styles.emptyText}>No beta videos yet</span>}
            </>
          )}
        </div>
      </div>

      {upload && (
        <Snackbar
          open
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          sx={{ bottom: 'max(16px, env(safe-area-inset-bottom)) !important' }}
        >
          <Alert
            severity={upload.phase === 'error' ? 'error' : upload.phase === 'done' ? 'success' : 'info'}
            variant="filled"
            sx={{ width: '100%', minWidth: 280, '& .MuiAlert-message': { width: '100%' } }}
          >
            {upload.message}
            {upload.phase === 'uploading' && (
              <LinearProgress
                variant="determinate"
                value={upload.progress}
                sx={{ mt: 0.5, borderRadius: 1, height: 4 }}
              />
            )}
            {upload.phase === 'processing' && (
              <LinearProgress variant="indeterminate" sx={{ mt: 0.5, borderRadius: 1, height: 4 }} />
            )}
          </Alert>
        </Snackbar>
      )}

      <Dialog open={instagramDialogOpen} onClose={() => setInstagramDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
          Add Instagram beta
          <IconButton size="small" onClick={() => setInstagramDialogOpen(false)} aria-label="Close">
            <CloseOutlined fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <AttachBetaLinkForm
            boardType={boardType}
            climbUuid={climbUuid}
            angle={angle}
            autoFocus
            compact
            submitLabel="Add"
            showCancel
            onCancel={() => setInstagramDialogOpen(false)}
            onSuccess={() => setInstagramDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {selectedItemIndex !== null && (
        <BetaVideoReelsPlayer
          items={reelsItems}
          initialIndex={selectedItemIndex}
          onClose={() => setSelectedItemIndex(null)}
        />
      )}
    </>
  );
};

export default BoardseshBetaSection;
