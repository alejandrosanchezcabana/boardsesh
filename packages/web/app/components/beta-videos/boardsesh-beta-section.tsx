'use client';

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import VideocamOutlined from '@mui/icons-material/VideocamOutlined';
import AddOutlined from '@mui/icons-material/AddOutlined';
import Skeleton from '@mui/material/Skeleton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
import { createGraphQLHttpClient } from '@/app/lib/graphql/client';
import { GET_BETA_LINKS } from '@/app/lib/graphql/operations/beta-links';
import type { BetaLink } from '@/app/lib/api-wrappers/sync-api-types';
import { dedupeBetaLinks, mapBetaLinksResponse } from '@/app/lib/beta-video-url';
import BoardseshBetaCard from './boardsesh-beta-card';
import AttachBetaLinkForm from './attach-beta-link-form';
import styles from './boardsesh-beta.module.css';

type BoardseshBetaSectionProps = {
  boardType: string;
  climbUuid: string;
  angle: number;
};

const BoardseshBetaSection: React.FC<BoardseshBetaSectionProps> = ({ boardType, climbUuid, angle }) => {
  const { status: sessionStatus } = useSession();
  const isAuthenticated = sessionStatus === 'authenticated';
  const [attachDialogOpen, setAttachDialogOpen] = useState(false);

  const { data: betaLinks = [], isLoading } = useQuery<BetaLink[]>({
    queryKey: ['betaLinks', boardType, climbUuid],
    queryFn: async () => {
      const client = createGraphQLHttpClient();
      const result = await client.request<{ betaLinks: Parameters<typeof mapBetaLinksResponse>[0] }>(GET_BETA_LINKS, {
        boardType,
        climbUuid,
      });
      return mapBetaLinksResponse(result.betaLinks);
    },
    enabled: !!climbUuid,
    staleTime: 5 * 60 * 1000,
  });

  const dedupedLinks = useMemo(() => dedupeBetaLinks(betaLinks), [betaLinks]);
  const totalCount = dedupedLinks.length;

  return (
    <>
      <div className={styles.section}>
        <div className={styles.header}>
          <span className={styles.headerLabel}>
            <VideocamOutlined sx={{ fontSize: 14 }} />
            Boardsesh Beta
            {totalCount > 0 && ` (${totalCount})`}
          </span>
        </div>

        <div className={styles.scrollContainer}>
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={`skeleton-${i}`} className={styles.card}>
                <Skeleton variant="rounded" sx={{ aspectRatio: '9/16', width: '100%', borderRadius: '8px' }} />
              </div>
            ))
          ) : (
            <>
              {isAuthenticated && (
                <div className={styles.uploadCard}>
                  <button
                    className={styles.uploadButton}
                    onClick={() => setAttachDialogOpen(true)}
                    aria-label="Add beta video"
                  >
                    <AddOutlined sx={{ fontSize: 28 }} />
                    <span>{totalCount === 0 ? 'Add beta' : 'Add'}</span>
                  </button>
                </div>
              )}
              {dedupedLinks.map((link) => (
                <BoardseshBetaCard key={link.link} link={link} />
              ))}
              {totalCount === 0 && !isAuthenticated && <span className={styles.emptyText}>No beta videos yet</span>}
            </>
          )}
        </div>
      </div>

      <Dialog open={attachDialogOpen} onClose={() => setAttachDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
          Add beta video
          <IconButton size="small" onClick={() => setAttachDialogOpen(false)} aria-label="Close">
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
            onCancel={() => setAttachDialogOpen(false)}
            onSuccess={() => setAttachDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BoardseshBetaSection;
