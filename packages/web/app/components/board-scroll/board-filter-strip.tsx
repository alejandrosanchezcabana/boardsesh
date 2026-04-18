'use client';

import React, { useCallback } from 'react';
import type { UserBoard } from '@boardsesh/shared-schema';
import BoardScrollSection from './board-scroll-section';
import BoardScrollCard from './board-scroll-card';
import styles from './board-scroll.module.css';

interface BoardFilterStripSingleProps {
  boards: UserBoard[];
  loading: boolean;
  selectedBoard: UserBoard | null;
  onBoardSelect: (board: UserBoard | null) => void;
  /** Board types with available content; boards not in this list render as disabled */
  boardTypes?: string[];
  /** Label shown on disabled cards instead of their normal meta text */
  disabledText?: string;
  multiSelect?: false;
}

interface BoardFilterStripMultiProps {
  boards: UserBoard[];
  loading: boolean;
  selectedBoards: UserBoard[];
  onBoardToggle: (board: UserBoard | null) => void;
  /** Board types with available content; boards not in this list render as disabled */
  boardTypes?: string[];
  /** Label shown on disabled cards instead of their normal meta text */
  disabledText?: string;
  multiSelect: true;
}

type BoardFilterStripProps = BoardFilterStripSingleProps | BoardFilterStripMultiProps;

export default function BoardFilterStrip(props: BoardFilterStripProps) {
  const { boards, loading, boardTypes, disabledText } = props;

  const handleAllKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (props.multiSelect) {
          props.onBoardToggle(null);
        } else {
          props.onBoardSelect(null);
        }
      }
    },
    [props],
  );

  const handleAllClick = useCallback(() => {
    if (props.multiSelect) {
      props.onBoardToggle(null);
    } else {
      props.onBoardSelect(null);
    }
  }, [props]);

  const handleBoardClick = useCallback(
    (board: UserBoard) => {
      if (props.multiSelect) {
        props.onBoardToggle(board);
      } else {
        props.onBoardSelect(board);
      }
    },
    [props],
  );

  const isBoardSelected = useCallback(
    (board: UserBoard) => {
      if (props.multiSelect) {
        return props.selectedBoards.some((b) => b.uuid === board.uuid);
      }
      return props.selectedBoard?.uuid === board.uuid;
    },
    [props],
  );

  const isAllSelected = props.multiSelect
    ? props.selectedBoards.length === 0
    : !props.selectedBoard;

  if (!loading && boards.length === 0 && !props.multiSelect) {
    return null;
  }

  return (
    <BoardScrollSection loading={loading} size="small">
      <div
        className={`${styles.cardScroll} ${styles.cardScrollSmall}`}
        role="button"
        tabIndex={0}
        onClick={handleAllClick}
        onKeyDown={handleAllKeyDown}
      >
        <div
          className={`${styles.cardSquare} ${styles.filterSquare} ${isAllSelected ? styles.cardSquareSelected : ''}`}
        >
          <span className={styles.filterLabel}>All</span>
        </div>
        <div
          className={`${styles.cardName} ${isAllSelected ? styles.cardNameSelected : ''}`}
        >
          All Boards
        </div>
      </div>
      {boards.map((board) => (
        <BoardScrollCard
          key={board.uuid}
          userBoard={board}
          size="small"
          selected={isBoardSelected(board)}
          disabled={boardTypes ? !boardTypes.includes(board.boardType) : false}
          disabledText={disabledText}
          onClick={() => handleBoardClick(board)}
        />
      ))}
    </BoardScrollSection>
  );
}
