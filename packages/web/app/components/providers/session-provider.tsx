"use client";

import React, { useEffect, useState } from "react";
import { SessionProvider, signIn } from "next-auth/react";
import { ReactNode } from "react";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import { isNativeApp } from "@/app/lib/ble/capacitor-utils";
import { NATIVE_OAUTH_CALLBACK_SCHEME } from "@/app/lib/auth/native-oauth-config";

interface SessionProviderWrapperProps {
  children: ReactNode;
}

export default function SessionProviderWrapper({ children }: SessionProviderWrapperProps) {
  const [deepLinkError, setDeepLinkError] = useState(false);

  useEffect(() => {
    if (!isNativeApp()) {
      return;
    }

    const appPlugin = window.Capacitor?.Plugins?.App;
    if (!appPlugin) {
      return;
    }

    let cancelled = false;
    let listenerHandle: { remove: () => Promise<void> } | null = null;

    // addListener may return a PluginListenerHandle directly (Capacitor 6+)
    // or a Promise<PluginListenerHandle> (Capacitor 5). Wrap with
    // Promise.resolve to handle both cases safely.
    const listenerResult = appPlugin.addListener("appUrlOpen", async ({ url }) => {
      if (!url.startsWith(NATIVE_OAUTH_CALLBACK_SCHEME)) {
        return;
      }

      const closeBrowser = () => window.Capacitor?.Plugins?.Browser?.close?.();

      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        await closeBrowser();
        window.location.assign("/auth/login?error=OAuthCallback");
        return;
      }

      const callbackError = parsed.searchParams.get("error");
      const transferToken = parsed.searchParams.get("transferToken");
      const nextPath = parsed.searchParams.get("next") ?? "/";
      const safeCallbackUrl = nextPath.startsWith("/") ? nextPath : "/";

      if (callbackError || !transferToken) {
        await closeBrowser();
        window.location.assign("/auth/login?error=OAuthCallback");
        return;
      }

      const result = await signIn("native-oauth", {
        transferToken,
        callbackUrl: safeCallbackUrl,
        redirect: false,
      });

      await closeBrowser();

      if (result?.error) {
        window.location.assign("/auth/login?error=OAuthCallback");
        return;
      }

      window.location.assign(result?.url ?? safeCallbackUrl);
    });

    Promise.resolve(listenerResult)
      .then((handle) => {
        if (cancelled) {
          // Component unmounted before the listener was registered — clean up
          void handle.remove();
        } else {
          listenerHandle = handle;
        }
      })
      .catch((err) => {
        console.error("[Native OAuth] Failed to register appUrlOpen listener:", err);
        setDeepLinkError(true);
      });

    return () => {
      cancelled = true;
      void listenerHandle?.remove();
    };
  }, []);

  return (
    <SessionProvider refetchOnWindowFocus={false} refetchWhenOffline={false}>
      {children}
      <Snackbar
        open={deepLinkError}
        autoHideDuration={8000}
        onClose={() => setDeepLinkError(false)}
      >
        <Alert severity="warning" onClose={() => setDeepLinkError(false)}>
          Sign-in with Google, Apple, or Facebook may not work. Try restarting the app.
        </Alert>
      </Snackbar>
    </SessionProvider>
  );
}
