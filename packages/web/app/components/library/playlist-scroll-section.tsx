'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import Skeleton from '@mui/material/Skeleton';
import styles from './library.module.css';

type PlaylistScrollSectionProps = {
  title: string;
  loading?: boolean;
  /** Called when the right-edge sentinel scrolls into view. Mirrors BoardScrollSection. */
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  children: React.ReactNode;
};

function ScrollSkeletons({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={`skeleton-${i}`} className={styles.cardScroll}>
          <Skeleton variant="rounded" className={styles.skeletonSquare} />
          <Skeleton variant="text" width="80%" className={styles.skeletonText} />
          <Skeleton variant="text" width="50%" className={styles.skeletonText} />
        </div>
      ))}
    </>
  );
}

export default function PlaylistScrollSection({
  title,
  loading,
  onLoadMore,
  hasMore,
  isLoadingMore,
  children,
}: PlaylistScrollSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Latest onLoadMore is captured by ref so the IntersectionObserver doesn't
  // need to be re-created when the callback identity changes per render.
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    if (entries[0]?.isIntersecting) {
      onLoadMoreRef.current?.();
    }
  }, []);

  useEffect(() => {
    if (!hasMore) return;
    const sentinel = sentinelRef.current;
    const scrollContainer = scrollRef.current;
    if (!sentinel || !scrollContainer) return;

    // root: scrollContainer makes the observer fire on horizontal scroll
    // (not page scroll). 300px right-margin gives the loader a head-start so
    // the user doesn't see the sentinel before more cards arrive.
    const observer = new IntersectionObserver(handleIntersection, {
      root: scrollContainer,
      rootMargin: '0px 300px 0px 0px',
      threshold: 0,
    });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, handleIntersection]);

  if (loading) {
    return (
      <div className={styles.scrollSection}>
        <div className={styles.sectionTitle}>{title}</div>
        <div className={styles.scrollContainer}>
          <ScrollSkeletons count={4} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.scrollSection}>
      <div className={styles.sectionTitle}>{title}</div>
      <div ref={scrollRef} className={styles.scrollContainer}>
        {children}
        {hasMore && (
          <>
            <div ref={sentinelRef} className={styles.loadMoreSentinel} />
            {isLoadingMore && <ScrollSkeletons count={3} />}
          </>
        )}
      </div>
    </div>
  );
}
