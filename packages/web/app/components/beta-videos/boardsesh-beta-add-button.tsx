'use client';

import React from 'react';
import { useSession } from 'next-auth/react';
import AddOutlined from '@mui/icons-material/AddOutlined';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
import IconButton from '@mui/material/IconButton';

type BoardseshBetaAddButtonProps = {
  isAdding: boolean;
  onToggle: () => void;
};

const BoardseshBetaAddButton: React.FC<BoardseshBetaAddButtonProps> = ({ isAdding, onToggle }) => {
  const { status } = useSession();

  if (status !== 'authenticated') return null;

  return (
    <IconButton
      size="small"
      onClick={onToggle}
      aria-label={isAdding ? 'Cancel adding beta video' : 'Add beta video'}
      sx={{ color: 'text.primary' }}
    >
      {isAdding ? <CloseOutlined fontSize="small" /> : <AddOutlined fontSize="small" />}
    </IconButton>
  );
};

export default BoardseshBetaAddButton;
