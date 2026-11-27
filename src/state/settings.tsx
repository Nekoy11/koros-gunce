import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { DEFAULT_SETTINGS, getSettings, setSetting, type AppSettings } from '../data/settings';
import { subscribeDataChanged } from './dataEvents';
import { formatMoney } from '../lib/money';

interface SettingsValue {
  settings: AppSettings;
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
  money: (kurus: number, opts?: { sign?: boolean; compact?: boolean }) => string;
}

const SettingsContext = createContext<SettingsValue | null>(null);

export const THEME_COLORS = {
  dark: { bg: '#13131C', card: '#1C1C28', border: '#2E2E40', text: '#EEF1F6', muted: '#9B9EB3', accent: '#1EC1CB', pos: '#3CCF8E', neg: '#FF5D6C', warn: '#F2B04A', grid: '#262636' },
  light: { bg: '#EDF5F6', card: '#FFFFFF', border: '#D6E4E7', text: '#1C1C28', muted: '#586273', accent: '#0B9AA3', pos: '#12996A', neg: '#D7384A', warn: '#C27C10', grid: '#E3EEF0' },
};

function applyTheme(theme: AppSettings['theme']) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme].bg);
  try {
    localStorage.setItem('ph-theme', theme); // only used to avoid a flash before the DB loads
  } catch {
    /* ignore */
  }
  if (Capacitor.isNativePlatform()) {
    StatusBar.setStyle({ style: theme === 'dark' ? Style.Dark : Style.Light }).catch(() => undefined);
    StatusBar.setBackgroundColor({ color: THEME_COLORS[theme].bg }).catch(() => undefined);
  }
}

export function SettingsProvider({ initial, children }: { initial: AppSettings; children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(initial ?? DEFAULT_SETTINGS);

  useEffect(() => applyTheme(settings.theme), [settings.theme]);

  useEffect(
    () =>
      subscribeDataChanged((t) => {
        if (t.has('app_settings')) getSettings().then(setSettings).catch(() => undefined);
      }),
    [],
  );

  const update = useCallback(async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((s) => ({ ...s, [key]: value }));
    await setSetting(key, value);
  }, []);

  const money = useCallback((k: number, opts?: { sign?: boolean; compact?: boolean }) => formatMoney(k, settings.currency, opts), [settings.currency]);

  return <SettingsContext.Provider value={{ settings, update, money }}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  const v = useContext(SettingsContext);
  if (!v) throw new Error('SettingsProvider missing');
  return v;
}

export function useThemeColors() {
  return THEME_COLORS[useSettings().settings.theme];
}
