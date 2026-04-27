'use client';

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Skeleton from '@mui/material/Skeleton';
import { createGraphQLHttpClient } from '@/app/lib/graphql/client';
import { GET_BETA_LINKS } from '@/app/lib/graphql/operations/beta-links';
import type { BetaLink } from '@/app/lib/api-wrappers/sync-api-types';
import { dedupeBetaLinks, mapBetaLinksResponse } from '@/app/lib/beta-video-url';
import BoardseshBetaCard from './boardsesh-beta-card';
import styles from './boardsesh-beta.module.css';

type BoardseshBetaSectionProps = {
  boardType: string;
  climbUuid: string;
};

const BoardseshBetaSection: React.FC<BoardseshBetaSectionProps> = ({ boardType, climbUuid }) => {
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
    <div className={styles.section}>
      <div className={styles.scrollContainer}>
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={`skeleton-${i}`} className={styles.card}>
              <div className={styles.thumbnailWrapper}>
                <Skeleton variant="rectangular" sx={{ width: '100%', height: '100%' }} />
              </div>
            </div>
          ))
        ) : (
          <>
            {dedupedLinks.map((link) => (
              <BoardseshBetaCard key={link.link} link={link} />
            ))}
            {totalCount === 0 && <span className={styles.emptyText}>No beta videos yet</span>}
          </>
        )}
      </div>
    </div>
  );
};

export default BoardseshBetaSection;
