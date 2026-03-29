import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.boardsesh.app',
  appName: 'Boardsesh',
  server: {
    url: process.env.CAPACITOR_DEV_URL ?? 'https://boardsesh.com',
    allowNavigation: ['boardsesh.com', '*.boardsesh.com'],
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
  },
};

export default config;
