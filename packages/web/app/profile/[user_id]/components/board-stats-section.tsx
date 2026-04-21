"use client";

import React from "react";
import CircularProgress from "@mui/material/CircularProgress";
import { EmptyState } from "@/app/components/ui/empty-state";
import BoardImportPrompt from "@/app/components/settings/board-import-prompt";
import type { LogbookEntry } from "../utils/profile-constants";
import styles from "../profile-page.module.css";

interface BoardStatsSectionProps {
  selectedBoard: string;
  loading: boolean;
  filteredLogbook: LogbookEntry[];
  isOwnProfile: boolean;
}

export default function BoardStatsSection({
  selectedBoard,
  loading,
  filteredLogbook,
  isOwnProfile,
}: BoardStatsSectionProps) {
  if (loading) {
    return (
      <div className={styles.loadingStats}>
        <CircularProgress />
      </div>
    );
  }

  if (filteredLogbook.length > 0) {
    return null;
  }

  if (
    isOwnProfile &&
    selectedBoard !== "all" &&
    (selectedBoard === "kilter" || selectedBoard === "tension")
  ) {
    return <BoardImportPrompt boardType={selectedBoard} />;
  }

  return <EmptyState description="No climbing data for this period" />;
}
