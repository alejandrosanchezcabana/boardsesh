'use client';

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
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
  const [open, setOpen] = useState(false);
  const [hasOpenedOnce, setHasOpenedOnce] = useState(false);
  const [config, setConfig] = useState<AuthModalConfig>({});
  const onSuccessRef = useRef<(() => void) | undefined>(undefined);

  const openAuthModal = useCallback(async (cfg: AuthModalConfig = {}) => {
    onSuccessRef.current = cfg.onSuccess;
    setConfig({ title: cfg.title, description: cfg.description });
    setHasOpenedOnce(true);
    setOpen(true);
  }, []);

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
