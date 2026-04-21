"use client";

import React, { useMemo } from "react";
import { getBoardDetails } from "@/app/lib/board-constants";
import BoardRenderer from "../board-renderer/board-renderer";
import styles from "./board-scroll.module.css";

const GRID_CONFIGS = [
  { board_name: "kilter" as const, layout_id: 1, size_id: 10, set_ids: [1, 20] },
  { board_name: "tension" as const, layout_id: 10, size_id: 6, set_ids: [12, 13] },
  { board_name: "kilter" as const, layout_id: 8, size_id: 17, set_ids: [26] },
  { board_name: "tension" as const, layout_id: 9, size_id: 3, set_ids: [8, 9] },
];

export default function BoardThumbnailGrid() {
  const boardDetailsList = useMemo(
    () =>
      GRID_CONFIGS.map((config) => {
        const key = `${config.board_name}-${config.layout_id}-${config.size_id}`;
        try {
          return { key, details: getBoardDetails(config) };
        } catch {
          return { key, details: null };
        }
      }),
    [],
  );

  return (
    <div className={styles.customBoardGrid}>
      {boardDetailsList.map(({ key, details }) => (
        <div key={key} className={styles.customBoardGridCell}>
          {details && (
            <BoardRenderer mirrored={false} boardDetails={details} thumbnail fillHeight />
          )}
        </div>
      ))}
    </div>
  );
}
