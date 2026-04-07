'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import StopCircleOutlined from '@mui/icons-material/StopCircleOutlined';
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import { QRCodeSVG } from 'qrcode.react';
import { useQuery } from '@tanstack/react-query';
import SwipeableDrawer from '@/app/components/swipeable-drawer/swipeable-drawer';
import AngleSelector from '@/app/components/board-page/angle-selector';
import { usePersistentSession } from '@/app/components/persistent-session/persistent-session-context';
import { useQueueBridgeBoardInfo } from '@/app/components/queue-control/queue-bridge-context';
import { useRouter, usePathname } from 'next/navigation';
import { themeTokens } from '@/app/theme/theme-config';
import { useWsAuthToken } from '@/app/hooks/use-ws-auth-token';
import { createGraphQLHttpClient } from '@/app/lib/graphql/client';
import {
  GET_SESSION_DETAIL,
  type GetSessionDetailQueryResponse,
} from '@/app/lib/graphql/operations/activity-feed';
import { clearClimbSessionCookie } from '@/app/lib/climb-session-cookie';
import { useSnackbar } from '@/app/components/providers/snackbar-provider';
import type { SessionDetail } from '@boardsesh/shared-schema';
import CollapsibleSection from '@/app/components/collapsible-section/collapsible-section';
import SessionDetailContent from '@/app/session/[sessionId]/session-detail-content';

const getShareUrl = (sessionId: string | null) => {
  try {
    if (!sessionId) return '';
    return `${window.location.origin}/join/${sessionId}`;
  } catch {
    return '';
  }
};

interface SeshSettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  onTransitionEnd?: (open: boolean) => void;
}

export default function SeshSettingsDrawer({ open, onClose, onTransitionEnd }: SeshSettingsDrawerProps) {
  const { activeSession, session, users, deactivateSession, liveSessionStats } = usePersistentSession();
  const { boardDetails, angle } = useQueueBridgeBoardInfo();
  const { token: authToken } = useWsAuthToken();
  const router = useRouter();
  const pathname = usePathname();
  const sessionId = activeSession?.sessionId ?? null;
  const shareUrl = getShareUrl(sessionId);
  const { showMessage } = useSnackbar();
  const [isStopped, setIsStopped] = useState(false);
  const lastSessionRef = useRef<SessionDetail | null>(null);

  const copyToClipboard = useCallback(() => {
    navigator.clipboard
      .writeText(shareUrl)
      .then(() => showMessage('Share URL copied!', 'success'))
      .catch(() => showMessage('Failed to copy URL.', 'error'));
  }, [shareUrl, showMessage]);

  const handleAngleChange = useCallback((newAngle: number) => {
    if (!boardDetails || angle === undefined) return;

    // Replace the current angle in the URL with the new one
    // Same pattern as angle-selector.tsx — find by value, not position
    const pathSegments = pathname.split('/');
    const angleIndex = pathSegments.findIndex((segment) => segment === angle.toString());

    if (angleIndex !== -1) {
      pathSegments[angleIndex] = newAngle.toString();
      router.push(pathSegments.join('/'));
    }
  }, [boardDetails, angle, pathname, router]);

  const handleStopSession = useCallback(() => {
    deactivateSession();
    clearClimbSessionCookie();
    setIsStopped(true);
  }, [deactivateSession]);

  const handleClose = useCallback(() => {
    setIsStopped(false);
    onClose();
  }, [onClose]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['activeSessionDetail', sessionId],
    queryFn: async () => {
      const client = createGraphQLHttpClient(authToken);
      return client.request<GetSessionDetailQueryResponse>(GET_SESSION_DETAIL, { sessionId });
    },
    enabled: open && !!sessionId && !!authToken,
    staleTime: 5000,
    refetchOnWindowFocus: false,
  });

  const sessionDetail = data?.sessionDetail ?? null;
  const mergedStats = useMemo(() => {
    if (liveSessionStats?.sessionId !== sessionId) return null;
    return liveSessionStats;
  }, [liveSessionStats, sessionId]);

  // Capture a stable timestamp once when the active session first becomes
  // relevant, so that unrelated dep changes don't regenerate different values.
  const fallbackTimestampRef = useRef<string | null>(null);
  if (activeSession && sessionId && !fallbackTimestampRef.current) {
    fallbackTimestampRef.current = new Date().toISOString();
  }
  if (!activeSession || !sessionId) {
    fallbackTimestampRef.current = null;
  }

  // Build a placeholder SessionDetail from live context when the real
  // sessionDetail hasn't loaded yet (or isn't available at all).
  const fallbackSession = useMemo<SessionDetail | null>(() => {
    if (!activeSession || !sessionId) return null;
    if (sessionDetail) return null; // not needed when we have real data

    const stableNow = fallbackTimestampRef.current!;
    const fallbackFirstTick = session?.startedAt ?? stableNow;
    const fallbackDurationMinutes = session?.startedAt
      ? Math.max(0, Math.round((new Date(stableNow).getTime() - new Date(session.startedAt).getTime()) / 60000))
      : null;

    return {
      sessionId,
      sessionType: 'party',
      sessionName: session?.name || activeSession.sessionName || null,
      ownerUserId: null,
      participants: users.map((user) => ({
        userId: user.id,
        displayName: user.username,
        avatarUrl: user.avatarUrl,
        sends: 0,
        flashes: 0,
        attempts: 0,
      })),
      totalSends: 0,
      totalFlashes: 0,
      totalAttempts: 0,
      tickCount: 0,
      gradeDistribution: [],
      boardTypes: boardDetails?.board_name ? [boardDetails.board_name] : [],
      hardestGrade: null,
      firstTickAt: fallbackFirstTick,
      lastTickAt: stableNow,
      durationMinutes: fallbackDurationMinutes,
      goal: session?.goal ?? null,
      ticks: [],
      upvotes: 0,
      downvotes: 0,
      voteScore: 0,
      commentCount: 0,
    };
  }, [activeSession, sessionId, sessionDetail, session?.startedAt, session?.name, session?.goal, users, boardDetails?.board_name]);

  const sessionForView = useMemo<SessionDetail | null>(() => {
    const base = sessionDetail ?? fallbackSession;
    if (!base) return null;

    if (!mergedStats) return base;

    const mergedTicks = mergedStats.ticks;
    const firstTickAt = mergedTicks.length > 0
      ? mergedTicks[mergedTicks.length - 1].climbedAt
      : base.firstTickAt;
    const lastTickAt = mergedTicks.length > 0
      ? mergedTicks[0].climbedAt
      : base.lastTickAt;

    return {
      ...base,
      participants: mergedStats.participants,
      totalSends: mergedStats.totalSends,
      totalFlashes: mergedStats.totalFlashes,
      totalAttempts: mergedStats.totalAttempts,
      tickCount: mergedStats.tickCount,
      gradeDistribution: mergedStats.gradeDistribution,
      boardTypes: mergedStats.boardTypes,
      hardestGrade: mergedStats.hardestGrade,
      durationMinutes: mergedStats.durationMinutes,
      goal: mergedStats.goal,
      firstTickAt,
      lastTickAt,
      ticks: mergedTicks,
    };
  }, [sessionDetail, fallbackSession, mergedStats]);

  if (sessionForView) {
    lastSessionRef.current = sessionForView;
  }
  const displaySession = sessionForView ?? lastSessionRef.current;

  if (!activeSession && !isStopped) return null;

  return (
    <SwipeableDrawer
      title="Session overview"
      placement="top"
      open={open}
      onClose={handleClose}
      onTransitionEnd={onTransitionEnd}
      fullHeight
      styles={{
        wrapper: { height: '100dvh' },
        body: { padding: 0, paddingBottom: 0 },
      }}
      footer={isStopped ? (
        <Button
          variant="outlined"
          onClick={handleClose}
          fullWidth
        >
          Dismiss
        </Button>
      ) : (
        <Button
          variant="outlined"
          color="error"
          startIcon={<StopCircleOutlined />}
          onClick={handleStopSession}
          fullWidth
          sx={{
            borderColor: themeTokens.colors.error,
            color: themeTokens.colors.error,
            '&:hover': {
              borderColor: themeTokens.colors.error,
              backgroundColor: `${themeTokens.colors.error}10`,
            },
          }}
        >
          Stop Session
        </Button>
      )}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pb: 2 }}>
        {isLoading && !displaySession && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        )}

        {isError && (
          <Alert severity="warning" sx={{ mx: 1 }}>
            Couldn&apos;t load full session details. Live stats will continue when available.
          </Alert>
        )}

        {displaySession && (
          <SessionDetailContent
            key={`${displaySession.sessionId}:${displaySession.ticks.length}:${displaySession.ticks[0]?.uuid ?? ''}`}
            session={displaySession}
            embedded
            fallbackBoardDetails={boardDetails}
            afterParticipants={
              !isStopped && shareUrl ? (
                <CollapsibleSection
                  sections={[{
                    key: 'invite',
                    label: 'Invite',
                    title: 'Invite others to join',
                    defaultSummary: 'Share link or QR code',
                    getSummary: () => [],
                    content: (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Box sx={{ display: 'flex', width: '100%', alignItems: 'center' }}>
                          <TextField
                            value={shareUrl}
                            slotProps={{ input: { readOnly: true } }}
                            variant="outlined"
                            size="small"
                            fullWidth
                          />
                          <IconButton onClick={copyToClipboard}>
                            <ContentCopyOutlined />
                          </IconButton>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                          <QRCodeSVG value={shareUrl} size={160} />
                        </Box>
                      </Box>
                    ),
                  }]}
                />
              ) : undefined
            }
          />
        )}

        <Divider />

        {!isStopped && boardDetails && angle !== undefined && (
          <Box sx={{ px: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Angle
            </Typography>
            <AngleSelector
              boardName={boardDetails.board_name}
              boardDetails={boardDetails}
              currentAngle={angle}
              currentClimb={null}
              onAngleChange={handleAngleChange}
            />
          </Box>
        )}
      </Box>
    </SwipeableDrawer>
  );
}
