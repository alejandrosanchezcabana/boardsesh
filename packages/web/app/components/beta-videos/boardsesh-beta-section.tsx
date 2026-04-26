'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import VideocamOutlined from '@mui/icons-material/VideocamOutlined';
import FileUploadOutlined from '@mui/icons-material/FileUploadOutlined';
import Skeleton from '@mui/material/Skeleton';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import { createGraphQLHttpClient } from '@/app/lib/graphql/client';
import { useWsAuthToken } from '@/app/hooks/use-ws-auth-token';
import { GET_BETA_VIDEOS, CREATE_BETA_VIDEO, GET_BETA_VIDEO } from '@/app/lib/graphql/operations/beta-videos';
import BoardseshBetaCard, { type BetaVideoData } from './boardsesh-beta-card';
import BetaVideoReelsPlayer from './beta-video-reels-player';
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
  const [selectedVideoIndex, setSelectedVideoIndex] = useState<number | null>(null);
  const [upload, setUpload] = useState<UploadProgress | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['boardseshBetaVideos', boardType, climbUuid],
    queryFn: async () => {
      const client = createGraphQLHttpClient();
      return client.request<BetaVideosQueryResult>(GET_BETA_VIDEOS, { boardType, climbUuid });
    },
    enabled: !!climbUuid,
    staleTime: 5 * 60 * 1000,
    // Poll more frequently while a video is processing
    refetchInterval: upload?.phase === 'processing' ? 5000 : false,
  });

  const videos = data?.betaVideos ?? [];

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
            queryClient.invalidateQueries({ queryKey: ['boardseshBetaVideos', boardType, climbUuid] });
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
      // Reset so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (!file || !authToken) return;

      // Validate portrait orientation
      const isPortrait = await new Promise<boolean>((resolve) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
          URL.revokeObjectURL(video.src);
          resolve(video.videoWidth <= video.videoHeight);
        };
        video.onerror = () => {
          URL.revokeObjectURL(video.src);
          resolve(false);
        };
        video.src = URL.createObjectURL(file);
      });

      if (!isPortrait) {
        setUpload({ uuid: '', phase: 'error', progress: 0, message: 'Only portrait videos — record vertically' });
        setTimeout(() => setUpload(null), 4000);
        return;
      }

      try {
        // Create video entry
        setUpload({ uuid: '', phase: 'uploading', progress: 0, message: 'Preparing upload...' });
        const client = createGraphQLHttpClient(authToken);
        const result = await client.request<CreateBetaVideoResult>(CREATE_BETA_VIDEO, {
          input: { boardType, climbUuid, angle, title: file.name },
        });
        const { uuid, uploadUrl, authorizationSignature, authorizationExpire, videoId, libraryId } =
          result.createBetaVideo;

        setUpload({ uuid, phase: 'uploading', progress: 0, message: 'Uploading...' });

        // Refetch so the processing card shows up immediately
        queryClient.invalidateQueries({ queryKey: ['boardseshBetaVideos', boardType, climbUuid] });

        // Start TUS upload
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

  return (
    <>
      <div className={styles.section}>
        <div className={styles.header}>
          <span className={styles.headerLabel}>
            <VideocamOutlined sx={{ fontSize: 14 }} />
            Boardsesh Beta
            {videos.length > 0 && ` (${videos.length})`}
          </span>
        </div>

        {/* Hidden file input */}
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
              {videos.map((video, index) => (
                <BoardseshBetaCard
                  key={video.uuid}
                  video={video}
                  onClick={() => {
                    if (video.status === 'ready') setSelectedVideoIndex(index);
                  }}
                />
              ))}
              {isAuthenticated && (
                <div className={styles.uploadCard}>
                  <button
                    className={styles.uploadButton}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    aria-label="Upload beta video"
                  >
                    <FileUploadOutlined sx={{ fontSize: 24 }} />
                    {videos.length === 0 ? 'Add beta' : 'Upload'}
                  </button>
                </div>
              )}
              {videos.length === 0 && !isAuthenticated && <span className={styles.emptyText}>No beta videos yet</span>}
            </>
          )}
        </div>
      </div>

      {/* Upload progress snackbar */}
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

      {selectedVideoIndex !== null && (
        <BetaVideoReelsPlayer
          videos={videos.filter((v) => v.status === 'ready')}
          initialIndex={selectedVideoIndex}
          onClose={() => setSelectedVideoIndex(null)}
        />
      )}
    </>
  );
};

export default BoardseshBetaSection;
