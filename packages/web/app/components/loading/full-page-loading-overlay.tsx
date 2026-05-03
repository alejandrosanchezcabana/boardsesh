'use client';

import React, { useState, useEffect, useMemo } from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';

type FullPageLoadingOverlayProps = {
  isVisible: boolean;
};

const FullPageLoadingOverlay: React.FC<FullPageLoadingOverlayProps> = ({ isVisible }) => {
  const { t } = useTranslation('common');
  const loadingMessages = useMemo(() => {
    const messages = t('loading.messages', { returnObjects: true }) as unknown;
    return Array.isArray(messages) && messages.length > 0 ? (messages as string[]) : ['Loading...'];
  }, [t]);

  const [currentMessage, setCurrentMessage] = useState(loadingMessages[0]);

  useEffect(() => {
    setCurrentMessage(loadingMessages[0]);
  }, [loadingMessages]);

  useEffect(() => {
    if (!isVisible) return;

    let messageIndex = 0;
    const interval = setInterval(() => {
      messageIndex = (messageIndex + 1) % loadingMessages.length;
      setCurrentMessage(loadingMessages[messageIndex]);
    }, 2500);

    return () => clearInterval(interval);
  }, [isVisible, loadingMessages]);

  if (!isVisible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
        gap: '24px',
      }}
    >
      <CircularProgress size={48} />
      <Typography
        variant="body2"
        component="span"
        style={{
          color: 'white',
          fontSize: '16px',
          textAlign: 'center',
          opacity: 0.9,
          maxWidth: '300px',
          lineHeight: 1.4,
        }}
      >
        {currentMessage}
      </Typography>
    </div>
  );
};

export default FullPageLoadingOverlay;
