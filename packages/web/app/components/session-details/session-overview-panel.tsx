'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Avatar from '@mui/material/Avatar';
import AvatarGroup from '@mui/material/AvatarGroup';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Skeleton from '@mui/material/Skeleton';
import FlagOutlined from '@mui/icons-material/FlagOutlined';
import TimerOutlined from '@mui/icons-material/TimerOutlined';
import FlashOnOutlined from '@mui/icons-material/FlashOnOutlined';
import CheckCircleOutlineOutlined from '@mui/icons-material/CheckCircleOutlineOutlined';
import ErrorOutlineOutlined from '@mui/icons-material/ErrorOutlineOutlined';
import PersonOutlined from '@mui/icons-material/PersonOutlined';
import PersonAddOutlined from '@mui/icons-material/PersonAddOutlined';
import RemoveCircleOutlineOutlined from '@mui/icons-material/RemoveCircleOutlineOutlined';
import type { SessionFeedParticipant, SessionGradeDistributionItem } from '@boardsesh/shared-schema';
import { deduplicateBy } from '@/app/utils/deduplicate';
import { CssBarChart } from '@/app/components/charts/css-bar-chart';
import { buildSessionGradeBars, SESSION_GRADE_LEGEND } from '@/app/components/charts/session-grade-bars';
import { useGradeFormat } from '@/app/hooks/use-grade-format';
import type { BoardDetails } from '@/app/lib/types';
import BoardRenderer from '@/app/components/board-renderer/board-renderer';
import AngleSelector from '@/app/components/board-page/angle-selector';

/**
 * Build summary parts for collapsed activity pill display.
 */
export function buildSessionSummaryParts(stats: {
  totalFlashes: number;
  totalSends: number;
  totalAttempts: number;
  tickCount: number;
  hardestGrade?: string | null;
  formatGrade?: (g: string) => string | null;
}): string[] {
  const parts: string[] = [];
  if (stats.totalFlashes > 0) parts.push(`${stats.totalFlashes} flash${stats.totalFlashes !== 1 ? 'es' : ''}`);
  // totalSends includes flashes, so subtract to avoid double-counting
  const nonFlashSends = stats.totalSends - stats.totalFlashes;
  if (nonFlashSends > 0) parts.push(`${nonFlashSends} send${nonFlashSends !== 1 ? 's' : ''}`);
  if (stats.totalAttempts > 0) parts.push(`${stats.totalAttempts} attempt${stats.totalAttempts !== 1 ? 's' : ''}`);
  parts.push(`${stats.tickCount} climb${stats.tickCount !== 1 ? 's' : ''}`);
  if (stats.hardestGrade) {
    const formatted = stats.formatGrade ? stats.formatGrade(stats.hardestGrade) : stats.hardestGrade;
    parts.push(`Hardest: ${formatted ?? stats.hardestGrade}`);
  }
  return parts;
}

interface SessionOverviewPanelProps {
  participants: SessionFeedParticipant[];
  totalSends: number;
  totalFlashes: number;
  totalAttempts: number;
  tickCount: number;
  gradeDistribution: SessionGradeDistributionItem[];
  boardTypes: string[];
  hardestGrade?: string | null;
  durationMinutes?: number | null;
  goal?: string | null;
  ownerUserId?: string | null;
  canEditParticipants?: boolean;
  onAddParticipant?: () => void;
  onRemoveParticipant?: (userId: string) => void;
  removingUserId?: string | null;
  getParticipantHref?: (userId: string) => string;
  afterParticipants?: React.ReactNode;
  /** When true, only render participants + board preview + goal (no chips/chart). */
  compact?: boolean;
  /** Board details for rendering a thumbnail preview. */
  boardDetails?: BoardDetails | null;
  /** Current board angle for display next to the board preview. */
  currentAngle?: number;
  /** Callback when user changes the angle via the angle selector. */
  onAngleChange?: (angle: number) => void;
  /** User-facing name of the named board (e.g., "My Home Wall") */
  namedBoardName?: string;
}

function ParticipantAvatar({
  participant,
  size,
  href,
}: {
  participant: SessionFeedParticipant;
  size: number;
  href?: string;
}) {
  const avatar = (
    <Avatar
      src={participant.avatarUrl ?? undefined}
      {...(href ? { component: 'a' as const, href } : {})}
      sx={{ width: size, height: size }}
    >
      {!participant.avatarUrl && <PersonOutlined sx={{ fontSize: size * 0.4 }} />}
    </Avatar>
  );
  return avatar;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

export default function SessionOverviewPanel({
  participants,
  totalSends,
  totalFlashes,
  totalAttempts,
  tickCount,
  gradeDistribution,
  boardTypes,
  hardestGrade,
  durationMinutes,
  goal,
  ownerUserId = null,
  canEditParticipants = false,
  onAddParticipant,
  onRemoveParticipant,
  removingUserId = null,
  getParticipantHref,
  afterParticipants,
  compact = false,
  boardDetails = null,
  currentAngle,
  onAngleChange,
  namedBoardName,
}: SessionOverviewPanelProps) {
  const { formatGrade, loaded: gradeFormatLoaded } = useGradeFormat();

  // Defensive dedup: during WebSocket reconnection race conditions the server
  // may briefly report the same participant twice. Deduplicating by userId
  // keeps the UI stable until the next authoritative state sync arrives.
  const uniqueParticipants = React.useMemo(
    () => deduplicateBy(participants, (p) => p.userId),
    [participants],
  );

  const isMultiUser = uniqueParticipants.length > 1;

  const gradeBars = React.useMemo(
    () => buildSessionGradeBars(gradeDistribution, formatGrade),
    [gradeDistribution, formatGrade],
  );

  return (
    <>
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
        {compact && boardDetails && (
          <>
            <Box
              sx={{
                width: 90,
                flexShrink: 0,
                borderRadius: '6px',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-xs)',
                background: 'var(--neutral-100)',
                aspectRatio: '1',
              }}
            >
              <BoardRenderer
                boardDetails={boardDetails}
                mirrored={false}
                thumbnail
                fillHeight
              />
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0, flexShrink: 0 }}>
              <Typography variant="body2" fontWeight={600}>
                {namedBoardName || (boardDetails.board_name.charAt(0).toUpperCase() + boardDetails.board_name.slice(1))}
              </Typography>
              {currentAngle != null && onAngleChange && (
                <AngleSelector
                  boardName={boardDetails.board_name}
                  boardDetails={boardDetails}
                  currentAngle={currentAngle}
                  currentClimb={null}
                  onAngleChange={onAngleChange}
                />
              )}
            </Box>
          </>
        )}
        <Card sx={{ flex: 1 }}>
          <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: isMultiUser ? 1 : 0 }}>
              {isMultiUser ? (
                <AvatarGroup max={5} sx={{ '& .MuiAvatar-root': { width: 32, height: 32, fontSize: 14 } }}>
                  {uniqueParticipants.map((participant) => (
                    <ParticipantAvatar
                      key={participant.userId}
                      participant={participant}
                      size={32}
                      href={getParticipantHref?.(participant.userId)}
                    />
                  ))}
                </AvatarGroup>
              ) : uniqueParticipants[0] ? (
                <ParticipantAvatar
                  participant={uniqueParticipants[0]}
                  size={40}
                  href={getParticipantHref?.(uniqueParticipants[0].userId)}
                />
              ) : (
                <Avatar sx={{ width: 40, height: 40 }}>
                  <PersonOutlined />
                </Avatar>
              )}
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" fontWeight={600}>
                  {uniqueParticipants.length > 0
                    ? uniqueParticipants.map((participant) => participant.displayName || 'Climber').join(', ')
                    : 'No participants yet'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {uniqueParticipants.length} participant{uniqueParticipants.length !== 1 ? 's' : ''}
                </Typography>
              </Box>
              {canEditParticipants && onAddParticipant && (
                <IconButton size="small" onClick={onAddParticipant}>
                  <PersonAddOutlined fontSize="small" />
                </IconButton>
              )}
            </Box>

            {isMultiUser && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 1 }}>
                {uniqueParticipants.map((participant) => (
                  <Box key={participant.userId} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar src={participant.avatarUrl ?? undefined} sx={{ width: 20, height: 20 }}>
                      {!participant.avatarUrl && <PersonOutlined sx={{ fontSize: 10 }} />}
                    </Avatar>
                    <Typography variant="caption" sx={{ flex: 1 }}>
                      {participant.displayName || 'Climber'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {participant.sends}S {participant.flashes}F {participant.attempts}A
                    </Typography>
                    {canEditParticipants && onRemoveParticipant && participant.userId !== ownerUserId && (
                      <IconButton
                        size="small"
                        onClick={() => onRemoveParticipant(participant.userId)}
                        disabled={removingUserId === participant.userId}
                        sx={{ p: 0.25 }}
                      >
                        {removingUserId === participant.userId ? (
                          <CircularProgress size={14} />
                        ) : (
                          <RemoveCircleOutlineOutlined sx={{ fontSize: 14 }} color="error" />
                        )}
                      </IconButton>
                    )}
                  </Box>
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>

      {afterParticipants}

      {goal ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <FlagOutlined sx={{ fontSize: 16 }} color="action" />
          <Typography variant="body2" color="text.secondary">
            Goal: {goal}
          </Typography>
        </Box>
      ) : null}

      {!compact && (
        <>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {totalFlashes > 0 && (
              <Chip
                icon={<FlashOnOutlined />}
                label={`${totalFlashes} flash${totalFlashes !== 1 ? 'es' : ''}`}
                sx={{ bgcolor: 'success.main', color: 'success.contrastText', '& .MuiChip-icon': { color: 'inherit' } }}
              />
            )}
            {/* totalSends includes flashes — subtract to avoid double-counting */}
            {(totalSends - totalFlashes) > 0 && (
              <Chip
                icon={<CheckCircleOutlineOutlined />}
                label={`${totalSends - totalFlashes} send${(totalSends - totalFlashes) !== 1 ? 's' : ''}`}
                color="primary"
              />
            )}
            {totalAttempts > 0 && (
              <Chip
                icon={<ErrorOutlineOutlined />}
                label={`${totalAttempts} attempt${totalAttempts !== 1 ? 's' : ''}`}
                variant="outlined"
              />
            )}
            {durationMinutes != null && durationMinutes > 0 && (
              <Chip
                icon={<TimerOutlined />}
                label={formatDuration(durationMinutes)}
                variant="outlined"
              />
            )}
            <Chip label={`${tickCount} climb${tickCount !== 1 ? 's' : ''}`} variant="outlined" />
            {hardestGrade && (
              gradeFormatLoaded
                ? <Chip label={`Hardest: ${formatGrade(hardestGrade) ?? hardestGrade}`} variant="outlined" />
                : <Skeleton variant="rounded" width={80} height={32} />
            )}
          </Box>

          {boardTypes.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {boardTypes.map((boardType) => (
                <Chip
                  key={boardType}
                  label={boardType.charAt(0).toUpperCase() + boardType.slice(1)}
                  size="small"
                  variant="outlined"
                />
              ))}
            </Box>
          )}

          {gradeDistribution.length > 0 && (
            <Card>
              <CardContent>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Grade Distribution
                </Typography>
                <CssBarChart
                  bars={gradeBars}
                  height={160}
                  mobileHeight={120}
                  gap={3}
                  ariaLabel="Session grade distribution"
                />
                <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', mt: 1 }}>
                  {SESSION_GRADE_LEGEND.map((entry) => (
                    <Box key={entry.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: entry.color }} />
                      <Typography variant="caption" color="text.secondary">{entry.label}</Typography>
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </>
  );
}
