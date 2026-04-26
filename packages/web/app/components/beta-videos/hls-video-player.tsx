'use client';

import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

export type HlsVideoPlayerHandle = {
  play: () => void;
  pause: () => void;
  getVideoElement: () => HTMLVideoElement | null;
};

type HlsVideoPlayerProps = {
  src: string;
  poster?: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  className?: string;
  onEnded?: () => void;
  onError?: () => void;
};

const HlsVideoPlayer = forwardRef<HlsVideoPlayerHandle, HlsVideoPlayerProps>(
  ({ src, poster, autoPlay = false, muted = false, loop = false, className, onEnded, onError }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<{ destroy: () => void } | null>(null);

    useImperativeHandle(ref, () => ({
      play: () => {
        videoRef.current?.play().catch(() => {});
      },
      pause: () => {
        videoRef.current?.pause();
      },
      getVideoElement: () => videoRef.current,
    }));

    useEffect(() => {
      const video = videoRef.current;
      if (!video || !src) return;

      // Check if native HLS is supported (Safari)
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src;
        if (autoPlay) video.play().catch(() => {});
        return;
      }

      // Dynamic import HLS.js for non-Safari browsers
      let destroyed = false;
      import('hls.js')
        .then(({ default: Hls }) => {
          if (destroyed) return;

          if (Hls.isSupported()) {
            const hls = new Hls({
              enableWorker: true,
              lowLatencyMode: false,
            });
            hls.loadSource(src);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              if (autoPlay) video.play().catch(() => {});
            });
            hls.on(Hls.Events.ERROR, (_event, data) => {
              if (data.fatal) {
                onError?.();
              }
            });
            hlsRef.current = hls;
          }
        })
        .catch(() => {
          onError?.();
        });

      return () => {
        destroyed = true;
        hlsRef.current?.destroy();
        hlsRef.current = null;
      };
    }, [src, autoPlay, onError]);

    return (
      <video
        ref={videoRef}
        poster={poster}
        muted={muted}
        loop={loop}
        playsInline
        controls
        className={className}
        onEnded={onEnded}
      />
    );
  },
);

HlsVideoPlayer.displayName = 'HlsVideoPlayer';
export default HlsVideoPlayer;
