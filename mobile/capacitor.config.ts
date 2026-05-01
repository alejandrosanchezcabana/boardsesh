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
    // Resize the Android WebView when the soft keyboard opens so 100dvh/100%
    // layouts (e.g. the climb-name filter drawer) shrink to fit above it,
    // matching how mobile Chrome behaves natively.
    Keyboard: {
      resize: 'native',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
