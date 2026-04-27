'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import AddOutlined from '@mui/icons-material/AddOutlined';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import AttachBetaLinkForm from './attach-beta-link-form';

type BoardseshBetaAddButtonProps = {
  boardType: string;
  climbUuid: string;
  angle: number;
};

const BoardseshBetaAddButton: React.FC<BoardseshBetaAddButtonProps> = ({ boardType, climbUuid, angle }) => {
  const { status } = useSession();
  const [open, setOpen] = useState(false);

  if (status !== 'authenticated') return null;

  const handleHeaderClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    setOpen(true);
  };
  const handleClose = () => setOpen(false);

  return (
    <>
      <IconButton size="small" onClick={handleHeaderClick} aria-label="Add beta video" sx={{ color: 'text.primary' }}>
        <AddOutlined fontSize="small" />
      </IconButton>

      <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth disableScrollLock>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
          Add beta video
          <IconButton size="small" onClick={handleClose} aria-label="Close">
            <CloseOutlined fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <AttachBetaLinkForm
            boardType={boardType}
            climbUuid={climbUuid}
            angle={angle}
            autoFocus
            compact
            submitLabel="Add"
            showCancel
            onCancel={handleClose}
            onSuccess={handleClose}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BoardseshBetaAddButton;
