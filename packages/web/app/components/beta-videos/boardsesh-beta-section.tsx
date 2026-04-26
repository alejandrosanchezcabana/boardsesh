'use client';

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import VideocamOutlined from '@mui/icons-material/VideocamOutlined';
import Instagram from '@mui/icons-material/Instagram';
import Skeleton from '@mui/material/Skeleton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
import { createGraphQLHttpClient } from '@/app/lib/graphql/client';
import { GET_BETA_LINKS } from '@/app/lib/graphql/operations/beta-videos';
import type { BetaLink } from '@/app/lib/api-wrappers/sync-api-types';
import { dedupeBetaLinks } from '@/app/lib/instagram-url';
import BoardseshBetaCard from './boardsesh-beta-card';
import AttachBetaLinkForm from './attach-beta-link-form';
import styles from './boardsesh-beta.module.css';

type BoardseshBetaSectionProps = {
  boardType: string;
  climbUuid: string;
  angle: number;
};

type BetaLinksQueryResult = {
  betaLinks: Array<{
    climbUuid: string;
    link: string;
    foreignUsername: string | null;
    angle: number | null;
    thumbnail: string | null;
    isListed: boolean | null;
    createdAt: string | null;
  }>;
};

const BoardseshBetaSection: React.FC<BoardseshBetaSectionProps> = ({ boardType, climbUuid, angle }) => {
  const { status: sessionStatus } = useSession();
  const isAuthenticated = sessionStatus === 'authenticated';
  const [attachDialogOpen, setAttachDialogOpen] = useState(false);

  const { data: betaLinks = [], isLoading } = useQuery<BetaLink[]>({
    queryKey: ['betaLinks', boardType, climbUuid],
    queryFn: async () => {
      const client = createGraphQLHttpClient();
      const result = await client.request<BetaLinksQueryResult>(GET_BETA_LINKS, { boardType, climbUuid });
      return result.betaLinks.map((b) => ({
        climb_uuid: b.climbUuid,
        link: b.link,
        foreign_username: b.foreignUsername,
        angle: b.angle,
        thumbnail: b.thumbnail,
        is_listed: b.isListed ?? false,
        created_at: b.createdAt ?? '',
      }));
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
                    aria-label="Add Instagram beta link"
                  >
                    <Instagram sx={{ fontSize: 28 }} />
                    <span>{totalCount === 0 ? 'Add beta' : 'Add'}</span>
                  </button>
                </div>
              )}
              {dedupedLinks.map((link) => (
                <BoardseshBetaCard key={`ig-${link.link}`} link={link} />
              ))}
              {totalCount === 0 && !isAuthenticated && <span className={styles.emptyText}>No beta videos yet</span>}
            </>
          )}
        </div>
      </div>

      <Dialog open={attachDialogOpen} onClose={() => setAttachDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
          Add Instagram beta
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
