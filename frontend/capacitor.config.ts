import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jarvis.intranet',
  appName: 'JARVIS Intranet',
  webDir: 'dist',
  server: {
    cleartext: true
  },
  android: {
    allowMixedContent: true
  }
};

export default config;
