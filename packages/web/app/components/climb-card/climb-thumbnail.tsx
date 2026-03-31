import React, { useRef, useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { BoardDetails, Climb } from '@/app/lib/types';
import BoardRenderer from '../board-renderer/board-renderer';
import BoardImageLayers from '../board-renderer/board-image-layers';
import { useRustRenderer } from '../board-renderer/board-renderer-context';
import { getContextAwareClimbViewUrl } from '@/app/lib/url-utils';
import { convertLitUpHoldsStringToMap } from '@/app/components/board-renderer/util';

type ClimbThumbnailProps = {
  currentClimb: Climb | null;
  boardDetails: BoardDetails;
  enableNavigation?: boolean;
  onNavigate?: () => void;
  maxHeight?: string;
};

const placeholderStyle = (boardDetails: BoardDetails, maxHeight?: string): React.CSSProperties => ({
  width: '100%',
  aspectRatio: `${boardDetails.boardWidth}/${boardDetails.boardHeight}`,
  maxHeight: maxHeight ?? '10vh',
  background: 'var(--neutral-200)',
  borderRadius: 4,
});

const ClimbThumbnail = ({ boardDetails, currentClimb, enableNavigation = false, onNavigate, maxHeight }: ClimbThumbnailProps) => {
  const pathname = usePathname();
  const isRustRendererEnabled = useRustRenderer();
  const litUpHoldsMap = useMemo(
    () => currentClimb && !isRustRendererEnabled ? convertLitUpHoldsStringToMap(currentClimb.frames, boardDetails.board_name)[0] : undefined,
    [currentClimb?.frames, boardDetails.board_name, isRustRendererEnabled],
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Native loading="lazy" handles lazy loading for the rust renderer
    if (isRustRendererEnabled) {
      setIsVisible(true);
      return;
    }

    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isRustRendererEnabled]);

  if (!isVisible) {
    return <div ref={containerRef} style={placeholderStyle(boardDetails, maxHeight)} />;
  }

  // Rust WASM renderer: layered background images + overlay
  const renderContent = isRustRendererEnabled && currentClimb ? (
    <BoardImageLayers
      boardDetails={boardDetails}
      frames={currentClimb.frames}
      mirrored={!!currentClimb.mirrored}
      thumbnail
      lazy
      style={{
        aspectRatio: `${boardDetails.boardWidth} / ${boardDetails.boardHeight}`,
        maxHeight: maxHeight ?? '10vh',
        width: 'auto',
        height: '100%',
      }}
    />
  ) : (
    <BoardRenderer
      litUpHoldsMap={litUpHoldsMap}
      mirrored={!!currentClimb?.mirrored}
      boardDetails={boardDetails}
      thumbnail
      maxHeight={maxHeight}
    />
  );

  if (enableNavigation && currentClimb) {
    const climbViewUrl = getContextAwareClimbViewUrl(
      pathname,
      boardDetails,
      currentClimb.angle,
      currentClimb.uuid,
      currentClimb.name,
    );

    return (
      <div ref={containerRef}>
        <Link href={climbViewUrl} prefetch={false} onClick={() => onNavigate?.()} data-testid="climb-thumbnail-link">
          {renderContent}
        </Link>
      </div>
    );
  }

  return <div ref={containerRef}>{renderContent}</div>;
};

export default ClimbThumbnail;
