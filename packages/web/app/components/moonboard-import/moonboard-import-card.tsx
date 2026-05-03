'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import Stack from '@mui/material/Stack';
import MuiCard from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import MuiButton from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import { ConfirmPopover } from '@/app/components/ui/confirm-popover';
import { EditOutlined, DeleteOutlined } from '@mui/icons-material';
import { themeTokens } from '@/app/theme/theme-config';
import MoonBoardRenderer from '../moonboard-renderer/moonboard-renderer';
import type { MoonBoardClimb } from '@boardsesh/moonboard-ocr/browser';
import type { MoonBoardClimbDuplicateMatch } from '@boardsesh/shared-schema';
import type { LitUpHoldsMap } from '../board-renderer/types';
import styles from './moonboard-import-card.module.css';

type MoonBoardImportCardProps = {
  climb: MoonBoardClimb;
  duplicateMatch: MoonBoardClimbDuplicateMatch | null;
  layoutFolder: string;
  holdSetImages: string[];
  litUpHoldsMap: LitUpHoldsMap;
  onEdit: () => void;
  onRemove: () => void;
};

export default function MoonBoardImportCard({
  climb,
  duplicateMatch,
  layoutFolder,
  holdSetImages,
  litUpHoldsMap,
  onEdit,
  onRemove,
}: MoonBoardImportCardProps) {
  const { t } = useTranslation('climbs');
  const totalHolds = climb.holds.start.length + climb.holds.hand.length + climb.holds.finish.length;
  const duplicateMessage = duplicateMatch?.existingClimbName
    ? t('moonboardImport.card.duplicateNamed', { name: duplicateMatch.existingClimbName })
    : t('moonboardImport.card.duplicate');

  return (
    <MuiCard className={styles.card}>
      <div className={styles.boardPreview}>
        <MoonBoardRenderer layoutFolder={layoutFolder} holdSetImages={holdSetImages} litUpHoldsMap={litUpHoldsMap} />
      </div>
      <CardContent>
        <div className={styles.titleRow}>
          <Typography variant="body2" component="span" fontWeight={600} noWrap>
            {climb.name || 'Unnamed Climb'}
          </Typography>
          {duplicateMatch?.exists && (
            <Chip
              label={t('moonboardImport.card.skipping')}
              size="small"
              className={styles.duplicateTag}
              sx={{
                bgcolor: themeTokens.colors.amber,
                color: 'var(--neutral-900)',
                fontWeight: 700,
              }}
            />
          )}
          {climb.isBenchmark && (
            <Chip
              label="B"
              size="small"
              sx={{ bgcolor: themeTokens.colors.amber, color: 'var(--neutral-900)' }}
              className={styles.benchmarkTag}
            />
          )}
        </div>
        <div className={styles.metadata}>
          <Typography variant="body1" component="p" color="text.secondary" noWrap className={styles.setter}>
            by {climb.setter || 'Unknown'}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            <Chip label={climb.userGrade || 'No grade'} size="small" color="primary" />
            <Chip label={`${climb.angle}°`} size="small" />
            <Chip label={`${totalHolds} holds`} size="small" />
          </Stack>
          {duplicateMatch?.exists && (
            <Typography variant="body2" component="p" className={styles.duplicateText}>
              {duplicateMessage}
            </Typography>
          )}
        </div>
      </CardContent>
      <CardActions>
        <MuiButton key="edit" variant="text" startIcon={<EditOutlined />} onClick={onEdit}>
          {t('common:actions.edit')}
        </MuiButton>
        <ConfirmPopover
          title={t('common:moonboardImport.removeConfirmTitle')}
          description={t('moonboardImport.card.removeDescription')}
          onConfirm={onRemove}
          okText={t('moonboardImport.card.removeAction')}
          cancelText={t('common:actions.cancel')}
        >
          <MuiButton variant="text" color="error" startIcon={<DeleteOutlined />}>
            {t('moonboardImport.card.removeAction')}
          </MuiButton>
        </ConfirmPopover>
      </CardActions>
    </MuiCard>
  );
}
