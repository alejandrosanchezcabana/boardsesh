"use client";

import React, { useCallback } from "react";
import QueueMusicOutlined from "@mui/icons-material/QueueMusicOutlined";
import { ClimbActionProps, ClimbActionResult } from "../types";
import { useOptionalQueueActions } from "../../graphql-queue";
import { buildActionResult, computeActionDisplay } from "../action-view-renderer";

export function GoToQueueAction({
  viewMode,
  size = "default",
  showLabel,
  disabled,
  className,
  onGoToQueue,
}: ClimbActionProps): ClimbActionResult {
  const queueActions = useOptionalQueueActions();
  const { iconSize } = computeActionDisplay(viewMode, size, showLabel);

  const handleClick = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      e?.preventDefault();
      onGoToQueue?.();
    },
    [onGoToQueue],
  );

  const icon = <QueueMusicOutlined sx={{ fontSize: iconSize }} />;

  return buildActionResult({
    key: "goToQueue",
    label: "Go to Queue",
    icon,
    onClick: handleClick,
    viewMode,
    size,
    showLabel,
    disabled: disabled || !onGoToQueue,
    className,
    available: !!queueActions && !!onGoToQueue,
  });
}

export default GoToQueueAction;
