"use client";

import React, { createContext, useCallback, useContext, useState } from "react";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import type { AlertColor } from "@mui/material/Alert";

type SnackbarAction = {
  label: string;
  onClick: () => void;
};

type SnackbarMessage = {
  key: number;
  text: string;
  severity: AlertColor;
  action?: SnackbarAction;
  duration?: number;
};

type SnackbarContextValue = {
  showMessage: (
    text: string,
    severity: AlertColor,
    action?: SnackbarAction,
    duration?: number,
  ) => void;
};

const SnackbarContext = createContext<SnackbarContextValue>({
  showMessage: () => {},
});

export const useSnackbar = () => useContext(SnackbarContext);

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<SnackbarMessage[]>([]);

  const showMessage = useCallback(
    (text: string, severity: AlertColor, action?: SnackbarAction, duration?: number) => {
      setMessages((prev) => [...prev, { key: Date.now(), text, severity, action, duration }]);
    },
    [],
  );

  const handleClose = useCallback((key: number) => {
    setMessages((prev) => prev.filter((m) => m.key !== key));
  }, []);

  return (
    <SnackbarContext.Provider value={{ showMessage }}>
      {children}
      {messages.map((msg) => (
        <Snackbar
          key={msg.key}
          open
          autoHideDuration={msg.duration ?? 3000}
          onClose={() => handleClose(msg.key)}
          anchorOrigin={{ vertical: "top", horizontal: "center" }}
          sx={{ top: "calc(8px + env(safe-area-inset-top, 0px)) !important" }}
        >
          <Alert
            onClose={() => handleClose(msg.key)}
            severity={msg.severity}
            variant="filled"
            sx={{ width: "100%" }}
            action={
              msg.action ? (
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => {
                    msg.action!.onClick();
                    handleClose(msg.key);
                  }}
                  sx={{ fontWeight: 700 }}
                >
                  {msg.action.label}
                </Button>
              ) : undefined
            }
          >
            {msg.text}
          </Alert>
        </Snackbar>
      ))}
    </SnackbarContext.Provider>
  );
}
