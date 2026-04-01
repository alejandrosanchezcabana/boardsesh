'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import BoardRenderer from './board-renderer';
import BoardImageLayers from './board-image-layers';
import BoardCanvasRenderer from './board-canvas-renderer';
import {
  useCardSwipeNavigation,
  EXIT_DURATION,
  SNAP_BACK_DURATION,
  ENTER_ANIMATION_DURATION,
} from '@/app/hooks/use-card-swipe-navigation';
import type { BoardDetails } from '@/app/lib/types';
import { useFeatureFlag } from '@/app/components/providers/feature-flags-provider';
import { useCanvasRendererReady } from '@/app/lib/board-render-worker/worker-manager';
import { convertLitUpHoldsStringToMap } from './util';
import styles from './swipe-board-carousel.module.css';

interface ClimbBoardData {
  frames: string;
  mirrored?: boolean;
}

export interface SwipeBoardCarouselProps {
  boardDetails: BoardDetails;
  currentClimb: ClimbBoardData;
  nextClimb?: ClimbBoardData | null;
  previousClimb?: ClimbBoardData | null;
  onSwipeNext: () => void;
  onSwipePrevious: () => void;
  canSwipeNext: boolean;
  canSwipePrevious: boolean;
  className?: string;
  boardContainerClassName?: string;
  fillContainer?: boolean;
}

const SwipeBoardCarousel: React.FC<SwipeBoardCarouselProps> = ({
  boardDetails,
  currentClimb,
  nextClimb,
  previousClimb,
  onSwipeNext,
  onSwipePrevious,
  canSwipeNext,
  canSwipePrevious,
  className,
  boardContainerClassName,
  fillContainer,
}) => {
  const enterFallbackRef = useRef<NodeJS.Timeout | null>(null);

  const { swipeHandlers, swipeOffset, isAnimating, animationDirection, enterDirection, clearEnterAnimation } =
    useCardSwipeNavigation({
      onSwipeNext,
      onSwipePrevious,
      canSwipeNext,
      canSwipePrevious,
      threshold: 80,
      delayNavigation: true,
    });

  useEffect(() => {
    if (enterDirection) {
      enterFallbackRef.current = setTimeout(() => {
        clearEnterAnimation();
      }, ENTER_ANIMATION_DURATION);
    }
    return () => {
      if (enterFallbackRef.current) {
        clearTimeout(enterFallbackRef.current);
        enterFallbackRef.current = null;
      }
    };
  }, [enterDirection, clearEnterAnimation]);

  const getSwipeTransition = () => {
    if (enterDirection) return 'none';
    if (isAnimating) return `transform ${EXIT_DURATION}ms ease-out`;
    if (swipeOffset === 0) return `transform ${SNAP_BACK_DURATION}ms ease`;
    return 'none';
  };

  const showPeek = swipeOffset !== 0 || isAnimating;
  const peekIsNext = animationDirection === 'left' || (animationDirection === null && swipeOffset < 0);
  const peekClimb = peekIsNext ? nextClimb : previousClimb;

  const getPeekTransform = () => {
    return peekIsNext
      ? `translateX(max(0px, calc(100% + ${swipeOffset}px)))`
      : `translateX(min(0px, calc(-100% + ${swipeOffset}px)))`;
  };

  const transition = getSwipeTransition();
  const isRustRendererEnabled = useFeatureFlag('rust-svg-rendering');
  const isWasmRendererEnabled = useFeatureFlag('wasm-rendering');
  const canvasReady = useCanvasRendererReady(!!isWasmRendererEnabled);
  const useRustRenderer = !!isRustRendererEnabled || !!isWasmRendererEnabled;

  const currentLitUpHoldsMap = useMemo(
    () => useRustRenderer
      ? undefined
      : convertLitUpHoldsStringToMap(currentClimb.frames, boardDetails.board_name)[0],
    [currentClimb.frames, boardDetails.board_name, useRustRenderer],
  );
  const peekLitUpHoldsMap = useMemo(
    () => useRustRenderer || !peekClimb
      ? undefined
      : convertLitUpHoldsStringToMap(peekClimb.frames, boardDetails.board_name)[0],
    [peekClimb, boardDetails.board_name, useRustRenderer],
  );

  const renderBoard = (climb: ClimbBoardData, litUpHoldsMap: ReturnType<typeof convertLitUpHoldsStringToMap>[0] | undefined) => {
    if (canvasReady) {
      return (
        <BoardCanvasRenderer
          boardDetails={boardDetails}
          frames={climb.frames}
          mirrored={!!climb.mirrored}
          contain
          style={{ width: '100%', height: '100%' }}
        />
      );
    }
    if (useRustRenderer) {
      return (
        <BoardImageLayers
          boardDetails={boardDetails}
          frames={climb.frames}
          mirrored={!!climb.mirrored}
          contain
          style={{ width: '100%', height: '100%' }}
        />
      );
    }
    return (
      <BoardRenderer
        boardDetails={boardDetails}
        litUpHoldsMap={litUpHoldsMap}
        mirrored={!!climb.mirrored}
        fillHeight
      />
    );
  };

  return (
    <div
      className={`${styles.carouselContainer} ${className ?? ''}`}
      style={fillContainer ? undefined : { aspectRatio: `${boardDetails.boardWidth} / ${boardDetails.boardHeight}` }}
      {...swipeHandlers}
    >
      <div
        className={boardContainerClassName}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition,
        }}
      >
        {renderBoard(currentClimb, currentLitUpHoldsMap)}
      </div>
      {showPeek && peekClimb && (
        <div
          className={styles.peekBoardContainer}
          style={{
            transform: getPeekTransform(),
            transition,
          }}
        >
          {renderBoard(peekClimb, peekLitUpHoldsMap)}
        </div>
      )}
    </div>
  );
};

export default SwipeBoardCarousel;
