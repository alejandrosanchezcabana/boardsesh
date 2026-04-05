'use client';

import React, { useCallback } from 'react';
import type { UserBoard } from '@boardsesh/shared-schema';
import BoardScrollSection from './board-scroll-section';
import BoardScrollCard from './board-scroll-card';
import styles from './board-scroll.module.css';

interface BoardFilterStripProps {
  boards: UserBoard[];
  loading: boolean;
  selectedBoard: UserBoard | null;
  onBoardSelect: (board: UserBoard | null) => void;
  /** Board types with available content; boards not in this list render as disabled */
  boardTypes?: string[];
  /** Label shown on disabled cards instead of their normal meta text */
  disabledText?: string;
}

export default function BoardFilterStrip({
  boards,
  loading,
  selectedBoard,
  onBoardSelect,
  boardTypes,
  disabledText,
}: BoardFilterStripProps) {
  const handleAllKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onBoardSelect(null);
      }
    },
    [onBoardSelect],
  );

  if (!loading && boards.length === 0) {
    return null;
  }

  return (
    <BoardScrollSection loading={loading} size="small">
      <div
        className={`${styles.cardScroll} ${styles.cardScrollSmall}`}
        role="button"
        tabIndex={0}
        onClick={() => onBoardSelect(null)}
        onKeyDown={handleAllKeyDown}
      >
        <div
          className={`${styles.cardSquare} ${styles.filterSquare} ${!selectedBoard ? styles.cardSquareSelected : ''}`}
        >
          <span className={styles.filterLabel}>All</span>
        </div>
        <div
          className={`${styles.cardName} ${!selectedBoard ? styles.cardNameSelected : ''}`}
        >
          All Boards
        </div>
      </div>
      {boards.map((board) => (
        <BoardScrollCard
          key={board.uuid}
          userBoard={board}
          size="small"
          selected={selectedBoard?.uuid === board.uuid}
          disabled={boardTypes ? !boardTypes.includes(board.boardType) : false}
          disabledText={disabledText}
          onClick={() => onBoardSelect(board)}
        />
      ))}
    </BoardScrollSection>
  );
}
