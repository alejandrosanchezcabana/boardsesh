'use client';

import React, { useState, useCallback } from 'react';
import useMediaQuery from '@mui/material/useMediaQuery';
import MuiCard from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import MuiTypography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Rating from '@mui/material/Rating';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MuiMenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import ElectricBoltOutlined from '@mui/icons-material/ElectricBoltOutlined';
import CancelOutlined from '@mui/icons-material/CancelOutlined';
import LocationOnOutlined from '@mui/icons-material/LocationOnOutlined';
import MoreVertOutlined from '@mui/icons-material/MoreVertOutlined';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import InstagramIcon from '@mui/icons-material/Instagram';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import AscentThumbnail from '@/app/components/activity-feed/ascent-thumbnail';
import AttachBetaLinkDialog from '@/app/components/beta-videos/attach-beta-link-dialog';
import PostToInstagramDialog from './post-to-instagram-dialog';
import type { AscentFeedItem } from '@/app/lib/graphql/operations/ticks';
import { themeTokens } from '@/app/theme/theme-config';
import styles from '@/app/components/activity-feed/ascents-feed.module.css';

dayjs.extend(relativeTime);

// Layout name mapping (same as ascents-feed.tsx)
const layoutNames: Record<string, string> = {
  'kilter-1': 'Kilter Original',
  'kilter-8': 'Kilter Homewall',
  'tension-9': 'Tension Classic',
  'tension-10': 'Tension 2 Mirror',
  'tension-11': 'Tension 2 Spray',
  'moonboard-1': 'MoonBoard 2010',
  'moonboard-2': 'MoonBoard 2016',
  'moonboard-3': 'MoonBoard 2024',
  'moonboard-4': 'MoonBoard Masters 2017',
  'moonboard-5': 'MoonBoard Masters 2019',
};

const getLayoutDisplayName = (boardType: string, layoutId: number | null): string => {
  if (layoutId === null) return boardType.charAt(0).toUpperCase() + boardType.slice(1);
  const key = `${boardType}-${layoutId}`;
  return layoutNames[key] || boardType.charAt(0).toUpperCase() + boardType.slice(1);
};

const getStatusDisplay = (status: AscentFeedItem['status'], attemptCount: number) => {
  switch (status) {
    case 'flash':
      return { label: 'Flashed', icon: <ElectricBoltOutlined />, color: 'gold' as const };
    case 'send':
      return { label: attemptCount > 1 ? `Sent in ${attemptCount}` : 'Sent', icon: <CheckCircleOutlined />, color: 'green' as const };
    case 'attempt':
      return { label: attemptCount === 1 ? '1 attempt' : `${attemptCount} attempts`, icon: <CancelOutlined />, color: 'default' as const };
  }
};

const getCompactStatusDisplay = (status: AscentFeedItem['status'], attemptCount: number) => {
  switch (status) {
    case 'flash':
      return { label: '', icon: <ElectricBoltOutlined />, color: 'gold' as const };
    case 'send':
      return { label: `${attemptCount}`, icon: <CheckCircleOutlined />, color: 'green' as const };
    case 'attempt':
      return { label: `${attemptCount}`, icon: <CancelOutlined />, color: 'default' as const };
  }
};

const getCompactRelativeTime = (isoDate: string) =>
  dayjs(isoDate)
    .fromNow()
    .replace(/\ba year ago\b/i, '1y ago')
    .replace(/\byears ago\b/i, 'y ago')
    .replace(/\ba month ago\b/i, '1mo ago')
    .replace(/\bmonths ago\b/i, 'mo ago')
    .replace(/\ba day ago\b/i, '1d ago')
    .replace(/\bdays ago\b/i, 'd ago')
    .replace(/\ban hour ago\b/i, '1h ago')
    .replace(/\bhours ago\b/i, 'h ago')
    .replace(/\ba minute ago\b/i, '1m ago')
    .replace(/\bminutes ago\b/i, 'm ago')
    .replace(/\ba second ago\b/i, '1s ago')
    .replace(/\bseconds ago\b/i, 's ago');

interface LogbookFeedItemProps {
  item: AscentFeedItem;
  showBoardType?: boolean;
  onDelete?: (uuid: string) => void;
  allowInstagramPosting?: boolean;
  allowInstagramLinking?: boolean;
}

const LogbookFeedItem: React.FC<LogbookFeedItemProps> = ({
  item,
  showBoardType,
  onDelete,
  allowInstagramPosting = false,
  allowInstagramLinking = false,
}) => {
  const isMobile = useMediaQuery('(max-width: 768px)', { noSsr: true });
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const menuOpen = Boolean(anchorEl);

  const handleMenuOpen = useCallback((e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  }, []);

  const handleMenuClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handleDelete = useCallback(() => {
    handleMenuClose();
    onDelete?.(item.uuid);
  }, [onDelete, item.uuid, handleMenuClose]);

  const handlePostToInstagram = useCallback(() => {
    handleMenuClose();
    setPostDialogOpen(true);
  }, [handleMenuClose]);

  const handleLinkInstagram = useCallback(() => {
    handleMenuClose();
    setLinkDialogOpen(true);
  }, [handleMenuClose]);

  const timeAgo = isMobile ? getCompactRelativeTime(item.climbedAt) : dayjs(item.climbedAt).fromNow();
  const statusDisplay = isMobile
    ? getCompactStatusDisplay(item.status, item.attemptCount)
    : getStatusDisplay(item.status, item.attemptCount);
  const boardDisplay = getLayoutDisplayName(item.boardType, item.layoutId);
  const hasSuccess = item.status === 'flash' || item.status === 'send';
  const canPostToInstagram = allowInstagramPosting && item.boardType === 'kilter';
  const canLinkInstagram = allowInstagramLinking && hasSuccess;

  return (
    <MuiCard className={styles.feedItem}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          {item.frames && item.layoutId && (
            <AscentThumbnail
              boardType={item.boardType}
              layoutId={item.layoutId}
              angle={item.angle}
              climbUuid={item.climbUuid}
              climbName={item.climbName}
              frames={item.frames}
              isMirror={item.isMirror}
            />
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
                <Chip
                  icon={statusDisplay.icon as React.ReactElement}
                  label={statusDisplay.label}
                  size="small"
                  color={statusDisplay.color === 'green' ? 'success' : undefined}
                  sx={{
                    ...(statusDisplay.color === 'gold'
                      ? { bgcolor: themeTokens.colors.amber, color: 'var(--neutral-900)' }
                      : {}),
                    ...(isMobile
                      ? {
                          minWidth: 0,
                          '& .MuiChip-label': {
                            px: statusDisplay.label ? 0.75 : 0.25,
                          },
                          '& .MuiChip-icon': {
                            mx: statusDisplay.label ? 0 : '4px',
                          },
                        }
                      : {}),
                  }}
                  className={styles.statusTag}
                />
                <MuiTypography variant="body2" component="span" fontWeight={600} className={styles.climbName}>
                  {item.climbName}
                </MuiTypography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
                <MuiTypography variant="body2" component="span" color="text.secondary" className={styles.timeAgo}>
                  {timeAgo}
                </MuiTypography>
                {(canPostToInstagram || canLinkInstagram || onDelete) && (
                  <>
                    <IconButton size="small" onClick={handleMenuOpen} sx={{ ml: 0.25, p: 0.5 }} aria-label="Open climb actions">
                      <MoreVertOutlined sx={{ fontSize: 18 }} />
                    </IconButton>
                    <Menu
                      anchorEl={anchorEl}
                      open={menuOpen}
                      onClose={handleMenuClose}
                      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                    >
                      {canPostToInstagram && (
                        <MuiMenuItem onClick={handlePostToInstagram}>
                          <ListItemIcon><InstagramIcon fontSize="small" /></ListItemIcon>
                          <ListItemText>Post to Instagram</ListItemText>
                        </MuiMenuItem>
                      )}
                      {canLinkInstagram && (
                        <MuiMenuItem onClick={handleLinkInstagram}>
                          <ListItemIcon><InstagramIcon fontSize="small" /></ListItemIcon>
                          <ListItemText>Link Instagram video</ListItemText>
                        </MuiMenuItem>
                      )}
                      {onDelete && (
                        <MuiMenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
                          <ListItemIcon><DeleteOutlined sx={{ color: 'error.main' }} /></ListItemIcon>
                          <ListItemText>Delete</ListItemText>
                        </MuiMenuItem>
                      )}
                    </Menu>
                  </>
                )}
              </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              {item.consensusDifficultyName && (
                <Chip label={`Consensus ${item.consensusDifficultyName}`} size="small" variant="outlined" />
              )}
              {item.difficultyName && (
                <Chip label={`Logged ${item.difficultyName}`} size="small" color="primary" />
              )}
              <Chip icon={<LocationOnOutlined />} label={`${item.angle}\u00B0`} size="small" />
              {showBoardType && (
                <MuiTypography variant="body2" component="span" color="text.secondary" className={styles.boardType}>
                  {boardDisplay}
                </MuiTypography>
              )}
              {item.isMirror && <Chip label="Mirrored" size="small" color="secondary" />}
              {item.isBenchmark && <Chip label="Benchmark" size="small" />}
            </Box>

            {(item.status === 'flash' || item.status === 'send') && item.quality && (
              <Rating readOnly value={item.quality} max={5} className={styles.rating} />
            )}

            {item.setterUsername && (
              <MuiTypography variant="body2" component="span" color="text.secondary" className={styles.setter}>
                Set by {item.setterUsername}
              </MuiTypography>
            )}

            {item.comment && (
              <MuiTypography variant="body2" component="span" className={styles.comment}>
                {item.comment}
              </MuiTypography>
            )}
          </Box>
        </Box>
      </CardContent>
      <PostToInstagramDialog
        open={postDialogOpen}
        onClose={() => setPostDialogOpen(false)}
        item={item}
      />
      <AttachBetaLinkDialog
        open={linkDialogOpen}
        onClose={() => setLinkDialogOpen(false)}
        boardType={item.boardType}
        climbUuid={item.climbUuid}
        climbName={item.climbName}
        angle={item.angle}
      />
    </MuiCard>
  );
};

export default React.memo(LogbookFeedItem);
