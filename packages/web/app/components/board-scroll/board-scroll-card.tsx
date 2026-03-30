'use client';

import React, { useMemo, useRef, useState, useEffect } from 'react';
import DashboardOutlined from '@mui/icons-material/DashboardOutlined';
import { BoardDetails, BoardName } from '@/app/lib/types';
import { getBoardDetails } from '@/app/lib/__generated__/product-sizes-data';
import { getMoonBoardDetails } from '@/app/lib/moonboard-config';
import BoardRenderer from '../board-renderer/board-renderer';
import { BoardConfigData } from '@/app/lib/server-board-configs';
import { StoredBoardConfig } from '@/app/lib/saved-boards-db';
import type { UserBoard, PopularBoardConfig } from '@boardsesh/shared-schema';
import styles from './board-scroll.module.css';

const BOARD_TYPE_LABELS: Record<string, string> = {
  kilter: 'Kilter',
  tension: 'Tension',
  moonboard: 'MoonBoard',
  decoy: 'Decoy',
  touchstone: 'Touchstone',
  grasshopper: 'Grasshopper',
  soill: 'So iLL',
};

interface BoardScrollCardProps {
  userBoard?: UserBoard;
  storedConfig?: StoredBoardConfig;
  popularConfig?: PopularBoardConfig;
  boardConfigs?: BoardConfigData;
  selected?: boolean;
  disabled?: boolean;
  disabledText?: string;
  size?: 'default' | 'small';
  onClick: () => void;
}

export default function BoardScrollCard({
  userBoard,
  storedConfig,
  popularConfig,
  boardConfigs,
  selected,
  disabled,
  disabledText,
  size = 'default',
  onClick,
}: BoardScrollCardProps) {
  const { boardDetails, name, meta } = useMemo(() => {
    let details: BoardDetails | null = null;
    let cardName = '';
    let cardMeta = '';

    try {
      if (userBoard) {
        const setIds = userBoard.setIds.split(',').map(Number);
        const boardName = userBoard.boardType as BoardName;
        cardName = userBoard.name;
        cardMeta = BOARD_TYPE_LABELS[userBoard.boardType] || userBoard.boardType;
        if (userBoard.locationName) {
          cardMeta += ` \u00B7 ${userBoard.locationName}`;
        }

        if (boardName === 'moonboard') {
          details = getMoonBoardDetails({
            layout_id: userBoard.layoutId,
            set_ids: setIds,
          }) as BoardDetails;
        } else {
          details = getBoardDetails({
            board_name: boardName,
            layout_id: userBoard.layoutId,
            size_id: userBoard.sizeId,
            set_ids: setIds,
          });
        }
      } else if (storedConfig) {
        cardName = storedConfig.name;

        // Derive meta from boardConfigs if available
        if (boardConfigs) {
          const layouts = boardConfigs.layouts[storedConfig.board] || [];
          const layout = layouts.find((l) => l.id === storedConfig.layoutId);
          cardMeta = layout?.name || (storedConfig.board.charAt(0).toUpperCase() + storedConfig.board.slice(1));
        } else {
          cardMeta = storedConfig.board.charAt(0).toUpperCase() + storedConfig.board.slice(1);
        }
        cardMeta += ` \u00B7 ${storedConfig.angle}\u00B0`;

        if (storedConfig.board === 'moonboard') {
          details = getMoonBoardDetails({
            layout_id: storedConfig.layoutId,
            set_ids: storedConfig.setIds,
          }) as BoardDetails;
        } else {
          details = getBoardDetails({
            board_name: storedConfig.board,
            layout_id: storedConfig.layoutId,
            size_id: storedConfig.sizeId,
            set_ids: storedConfig.setIds,
          });
        }
      } else if (popularConfig) {
        const boardName = popularConfig.boardType as BoardName;
        const shortLayout = (popularConfig.layoutName || '')
          .replace(/\bBoard\b\s*/gi, '')
          .replace(/\bHomewall\b/gi, 'HW')
          .trim();
        cardName = `${shortLayout} ${popularConfig.sizeName || ''}`.trim();
        cardMeta = `${BOARD_TYPE_LABELS[boardName] || boardName} \u00B7 ${popularConfig.climbCount.toLocaleString()} routes`;

        if (boardName === 'moonboard') {
          details = getMoonBoardDetails({
            layout_id: popularConfig.layoutId,
            set_ids: popularConfig.setIds,
          }) as BoardDetails;
        } else {
          details = getBoardDetails({
            board_name: boardName,
            layout_id: popularConfig.layoutId,
            size_id: popularConfig.sizeId,
            set_ids: popularConfig.setIds,
          });
        }
      }
    } catch {
      // Fall back to icon if board details unavailable
    }

    return { boardDetails: details, name: cardName, meta: cardMeta };
  }, [userBoard, storedConfig, popularConfig, boardConfigs]);

  const isSmall = size === 'small';
  const iconSize = isSmall ? 24 : 32;

  const handleClick = disabled ? undefined : onClick;
  const displayMeta = disabled && disabledText ? disabledText : meta;

  // Defer SVG rendering until card is near the viewport
  const cardRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = cardRef.current;
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
  }, []);

  return (
    <div ref={cardRef} className={`${styles.cardScroll} ${isSmall ? styles.cardScrollSmall : ''}`} onClick={handleClick}>
      <div
        className={`${styles.cardSquare} ${selected ? styles.cardSquareSelected : ''} ${disabled ? styles.cardSquareDisabled : ''}`}
      >
        {boardDetails && isVisible ? (
          <BoardRenderer
            litUpHoldsMap={{}}
            mirrored={false}
            boardDetails={boardDetails}
            thumbnail
            fillHeight
          />
        ) : (
          <div className={styles.cardFallback}>
            <DashboardOutlined sx={{ fontSize: iconSize }} />
          </div>
        )}
      </div>
      <div className={`${styles.cardName} ${selected ? styles.cardNameSelected : ''} ${disabled ? styles.cardNameDisabled : ''}`}>
        {name}
      </div>
      {displayMeta && <div className={`${styles.cardMeta} ${disabled ? styles.cardNameDisabled : ''}`}>{displayMeta}</div>}
    </div>
  );
}
