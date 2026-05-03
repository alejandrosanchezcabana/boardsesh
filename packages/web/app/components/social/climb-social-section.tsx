'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import VoteButton from './vote-button';
import CommentSection from './comment-section';
import ProposalSection from './proposal-section';

type ClimbSocialSectionProps = {
  climbUuid: string;
  boardType?: string;
  angle?: number;
  currentClimbDifficulty?: string;
  boardName?: string;
  highlightProposalUuid?: string;
};

export default function ClimbSocialSection({
  climbUuid,
  boardType,
  angle,
  currentClimbDifficulty,
  boardName,
  highlightProposalUuid,
}: ClimbSocialSectionProps) {
  const { t } = useTranslation('common');
  return (
    <Box>
      {boardType && angle != null && (
        <ProposalSection
          climbUuid={climbUuid}
          boardType={boardType}
          angle={angle}
          currentClimbDifficulty={currentClimbDifficulty}
          boardName={boardName}
          highlightProposalUuid={highlightProposalUuid}
        />
      )}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <VoteButton entityType="climb" entityId={climbUuid} />
      </Box>
      <CommentSection entityType="climb" entityId={climbUuid} title={t('comment.discussionTitle')} />
    </Box>
  );
}
