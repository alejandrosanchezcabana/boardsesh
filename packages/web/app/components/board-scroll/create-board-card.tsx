'use client';

import React from 'react';
import AddOutlined from '@mui/icons-material/AddOutlined';
import { useTranslation } from 'react-i18next';
import styles from './board-scroll.module.css';

type CreateBoardCardProps = {
  onClick: () => void;
  label?: string;
  size?: 'default' | 'small';
};

export default function CreateBoardCard({ onClick, label, size = 'default' }: CreateBoardCardProps) {
  const { t } = useTranslation('boards');
  const isSmall = size === 'small';
  const iconSize = isSmall ? 24 : 32;
  const resolvedLabel = label ?? t('discovery.create.defaultLabel');

  return (
    <div className={`${styles.cardScroll} ${isSmall ? styles.cardScrollSmall : ''}`} onClick={onClick}>
      <div className={`${styles.cardSquare} ${styles.createSquare}`}>
        <AddOutlined sx={{ fontSize: iconSize }} />
        <span className={styles.createLabel}>{resolvedLabel}</span>
      </div>
    </div>
  );
}
