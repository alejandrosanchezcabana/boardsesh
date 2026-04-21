"use client";

import React, { useRef, useEffect, useCallback } from "react";
import Skeleton from "@mui/material/Skeleton";
import styles from "./board-scroll.module.css";

interface BoardScrollSectionProps {
  title?: string;
  loading?: boolean;
  size?: "default" | "small";
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  children?: React.ReactNode;
}

function SkeletonCards({ count, isSmall }: { count: number; isSmall: boolean }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={`skeleton-${i}`}
          className={`${styles.cardScroll} ${isSmall ? styles.cardScrollSmall : ""}`}
        >
          <Skeleton variant="rounded" className={styles.skeletonSquare} sx={{ height: "auto" }} />
          <Skeleton variant="text" width="80%" className={styles.skeletonText} />
          <Skeleton variant="text" width="50%" className={styles.skeletonText} />
        </div>
      ))}
    </>
  );
}

export default function BoardScrollSection({
  title,
  loading,
  size = "default",
  onLoadMore,
  hasMore,
  isLoadingMore,
  children,
}: BoardScrollSectionProps) {
  const isSmall = size === "small";
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    if (entries[0]?.isIntersecting) {
      onLoadMoreRef.current?.();
    }
  }, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const scrollContainer = scrollRef.current;
    if (!sentinel || !scrollContainer) return;

    const observer = new IntersectionObserver(handleIntersection, {
      root: scrollContainer,
      rootMargin: "0px 300px 0px 0px",
      threshold: 0,
    });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, handleIntersection]);

  return (
    <div className={`${styles.scrollSection} ${isSmall ? styles.scrollSectionSmall : ""}`}>
      {title && <div className={styles.sectionTitle}>{title}</div>}
      <div
        ref={scrollRef}
        className={`${styles.scrollContainer} ${isSmall ? styles.scrollContainerSmall : ""}`}
      >
        {loading ? <SkeletonCards count={4} isSmall={isSmall} /> : children}
        {hasMore && (
          <>
            <div ref={sentinelRef} className={styles.loadMoreSentinel} />
            {isLoadingMore && <SkeletonCards count={3} isSmall={isSmall} />}
          </>
        )}
      </div>
    </div>
  );
}
