'use client';

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AuthModal from '@/app/components/auth/auth-modal';

type AuthModalConfig = {
  title?: string;
  description?: string;
  onSuccess?: () => void;
};

type AuthModalContextValue = {
  openAuthModal: (config?: AuthModalConfig) => Promise<void>;
};

const AuthModalContext = createContext<AuthModalContextValue>({
  openAuthModal: () => Promise.resolve(),
});

export const useAuthModal = () => useContext(AuthModalContext);

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [hasOpenedOnce, setHasOpenedOnce] = useState(false);
  const [config, setConfig] = useState<AuthModalConfig>({});
  const onSuccessRef = useRef<(() => void) | undefined>(undefined);

  const openAuthModal = useCallback(
    async (cfg: AuthModalConfig = {}) => {
      onSuccessRef.current = cfg.onSuccess;
      setConfig({ title: cfg.title, description: cfg.description });
      // Lazy-load the auth namespace so unrelated pages don't ship auth.json.
      // resourcesToBackend (see lib/i18n/client.tsx) resolves this with a
      // dynamic JSON import; mounting the modal before the load resolves would
      // flash bare keys for one render tick.
      await i18n.loadNamespaces('auth');
      setHasOpenedOnce(true);
      setOpen(true);
    },
    [i18n],
  );

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  const handleSuccess = useCallback(() => {
    const cb = onSuccessRef.current;
    setOpen(false);
    onSuccessRef.current = undefined;
    cb?.();
  }, []);

  return (
    <AuthModalContext.Provider value={{ openAuthModal }}>
      {children}
      {hasOpenedOnce && (
        <AuthModal
          open={open}
          onClose={handleClose}
          onSuccess={handleSuccess}
          title={config.title}
          description={config.description}
        />
      )}
    </AuthModalContext.Provider>
  );
}
