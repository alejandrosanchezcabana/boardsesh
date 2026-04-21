"use client";

import React from "react";
import Link from "next/link";
import PlaylistPreviewSquare from "./playlist-preview-square";
import styles from "./library.module.css";

export type PlaylistCardProps = {
  name: string;
  climbCount: number;
  boardType: string;
  layoutId?: number | null;
  color?: string;
  icon?: string;
  href: string;
  variant: "grid" | "scroll";
  index?: number;
  isLikedClimbs?: boolean;
  fetchPriority?: "high" | "low" | "auto";
};

export default function PlaylistCard({
  name,
  climbCount,
  boardType,
  layoutId,
  color,
  icon,
  href,
  variant,
  index = 0,
  isLikedClimbs,
  fetchPriority,
}: PlaylistCardProps) {
  if (variant === "grid") {
    return (
      <Link href={href} className={styles.cardCompact}>
        <div className={styles.cardCompactSquare}>
          <PlaylistPreviewSquare
            boardType={boardType}
            layoutId={layoutId}
            color={color}
            icon={icon}
            isLikedClimbs={isLikedClimbs}
            index={index}
            className={styles.previewCompact}
            fetchPriority={fetchPriority}
          />
        </div>
        <div className={styles.cardCompactInfo}>
          <div className={styles.cardCompactName}>{name}</div>
          <div className={styles.cardMeta}>
            {climbCount} {climbCount === 1 ? "climb" : "climbs"}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link href={href} className={`${styles.card} ${styles.cardScroll}`}>
      <div className={styles.cardSquare}>
        <PlaylistPreviewSquare
          boardType={boardType}
          layoutId={layoutId}
          color={color}
          icon={icon}
          isLikedClimbs={isLikedClimbs}
          index={index}
          fetchPriority={fetchPriority}
        />
      </div>
      <div className={styles.cardName}>{name}</div>
      <div className={styles.cardMeta}>
        {climbCount} {climbCount === 1 ? "climb" : "climbs"}
      </div>
    </Link>
  );
}
