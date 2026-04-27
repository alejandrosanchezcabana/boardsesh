'use client';

import React from 'react';
import Box from '@mui/material/Box';
import AttachBetaLinkForm from './attach-beta-link-form';

type BoardseshBetaAddPanelProps = {
  boardType: string;
  climbUuid: string;
  angle: number;
  onCancel: () => void;
  onSuccess: () => void;
};

/**
 * Inline panel shown inside the Beta section when the user is adding a video.
 * Currently wraps the URL form; this is the single seam for adding richer
 * add-flow UI later (preview, screenshot upload, timestamp picker, etc.).
 */
const BoardseshBetaAddPanel: React.FC<BoardseshBetaAddPanelProps> = ({
  boardType,
  climbUuid,
  angle,
  onCancel,
  onSuccess,
}) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, px: 1.5, pt: 1.5, pb: 0.5 }}>
      <AttachBetaLinkForm
        boardType={boardType}
        climbUuid={climbUuid}
        angle={angle}
        autoFocus
        compact
        submitLabel="Add"
        showCancel
        onCancel={onCancel}
        onSuccess={onSuccess}
      />
    </Box>
  );
};

export default BoardseshBetaAddPanel;
