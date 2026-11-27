import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.personalhub.app',
  appName: 'Koros Günce',
  webDir: 'dist',
  android: {
    // Never allow cleartext/mixed content: the app has no network features.
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SystemBars: {
      // Injects --safe-area-inset-* CSS variables so the UI avoids status/navigation bars.
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
    },
    CapacitorSQLite: {
      androidIsEncryption: false,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_notify',
      iconColor: '#4C8DFF',
    },
    Keyboard: {
      resize: 'native',
    },
  },
};

export default config;
