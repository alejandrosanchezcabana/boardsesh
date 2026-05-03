import React from 'react';
import { notFound } from 'next/navigation';
import type { BoardRouteParameters } from '@/app/lib/types';
import { getBoardDetailsForBoard } from '@/app/lib/board-utils';
import { parseBoardRouteParamsWithSlugs } from '@/app/lib/url-utils.server';
import type { Metadata } from 'next';
import LikedClimbsViewContent from './liked-climbs-view-content';
import { createNoIndexMetadata } from '@/app/lib/seo/metadata';
import { getServerTranslation } from '@/app/lib/i18n/server';
import styles from '@/app/components/library/playlist-view.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getServerTranslation('climbs');
  return createNoIndexMetadata({
    title: t('metadata.liked.title'),
    description: t('metadata.liked.description'),
    locale,
  });
}

export default async function LikedClimbsPage(props: { params: Promise<BoardRouteParameters> }) {
  const params = await props.params;

  try {
    const parsedParams = await parseBoardRouteParamsWithSlugs(params);
    const boardDetails = getBoardDetailsForBoard(parsedParams);

    return (
      <div className={styles.pageContainer}>
        <LikedClimbsViewContent boardDetails={boardDetails} angle={parsedParams.angle} />
      </div>
    );
  } catch (error) {
    console.error('Error loading liked climbs page:', error);
    notFound();
  }
}
