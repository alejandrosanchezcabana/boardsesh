'use client';

import React from 'react';
import CheckOutlined from '@mui/icons-material/CheckOutlined';
import ElectricBoltOutlined from '@mui/icons-material/ElectricBoltOutlined';
import styles from './tick-icon.module.css';

type TickIconProps = {
  isFlash: boolean;
};

export const TickIcon: React.FC<TickIconProps> = ({ isFlash }) => {
  return isFlash ? <ElectricBoltOutlined /> : <CheckOutlined />;
};

type TickButtonWithLabelProps = {
  label: 'flash' | 'tick' | 'attempt' | 'save';
  children: React.ReactNode;
};

/**
 * Wraps a tick/attempt IconButton and renders a subtle subtitle label below it,
 * matching the style of the "stars" and "tries" labels in the tick controls.
 */
export const TickButtonWithLabel: React.FC<TickButtonWithLabelProps> = ({ label, children }) => {
  return (
    <div className={styles.tickButtonWrapper}>
      {children}
      <span className={styles.tickButtonLabel} aria-hidden="true">
        {label}
      </span>
    </div>
  );
};
