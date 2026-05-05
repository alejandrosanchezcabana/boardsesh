/// <reference types="node" />
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.boardsesh.app',
  appName: 'Boardsesh',
  server: {
    url: process.env.CAPACITOR_DEV_URL ?? 'https://www.boardsesh.com',
    allowNavigation: ['boardsesh.com', '*.boardsesh.com', '*.ts.net'],
  },
  ios: {
    contentInset: 'never',
    preferredContentMode: 'mobile',
    backgroundColor: '#0A0A0A',
    limitsNavigationsToAppBoundDomains: true,
  },
  android: {
    backgroundColor: '#0A0A0A',
  },
  plugins: {
    // @capacitor-community/safe-area handles inset propagation itself. Disable
    // Capacitor's built-in SystemBars inset handling so the two don't fight.
    SystemBars: {
      insetsHandling: 'disable',
    },
    // Do not install @capacitor/keyboard or set a `Keyboard` plugin config
    // here. @capacitor-community/safe-area pads the WebView decorView by
    // imeInsets.bottom on Chromium >= 140 with viewport-fit=cover, so the
    // keyboard already lifts content as expected. Combined with
    // `interactiveWidget: 'resizes-visual'` (packages/web/app/layout.tsx) and
    // `100dvh` drawers, this matches mobile Chrome. Adding @capacitor/keyboard
    // with `resize: 'native'` plus `windowSoftInputMode="adjustResize"` (PRs
    // #1796 + commit 6e748c0d5) physically shrinks the WebView when the IME
    // opens, collapsing the dvh-based layout on top of a fixed-height bottom
    // bar — see #1808. The safe-area plugin also explicitly logs an error if
    // `Keyboard.resizeOnFullScreen: true` is set.
  },
};

export default config;
