import { useCallback, useEffect, useRef, useState } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { logError } from '../lib/log';

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

/**
 * Debounced autosave with crash protection:
 * - saves `delay` ms after the last change,
 * - flushes immediately when the app goes to background, the page is hidden or the editor closes,
 * - keeps a local draft copy until the database write succeeds, so a crash inside the
 *   debounce window does not lose text (the editor offers the draft on next open).
 */
export function useAutosave<T>(opts: { value: T; enabled: boolean; save: (v: T) => Promise<void>; delay?: number; draftKey: string }) {
  const { value, enabled, delay = 700, draftKey } = opts;
  const [status, setStatus] = useState<SaveStatus>('idle');
  const saveRef = useRef(opts.save);
  saveRef.current = opts.save;
  const pending = useRef<T | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef<Promise<void> | null>(null);

  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (inflight.current) await inflight.current.catch(() => undefined);
    const v = pending.current;
    if (v === null) return true;
    pending.current = null;
    setStatus('saving');
    const p = saveRef.current(v);
    inflight.current = p;
    try {
      await p;
      setStatus(pending.current === null ? 'saved' : 'dirty');
      if (pending.current === null) {
        try {
          localStorage.removeItem(draftKey);
        } catch {
          /* ignore */
        }
      }
      return true;
    } catch (e) {
      logError('autosave', e);
      if (pending.current === null) pending.current = v; // retry on next flush
      setStatus('error');
      return false;
    } finally {
      inflight.current = null;
    }
  }, [draftKey]);

  useEffect(() => {
    if (!enabled) return;
    pending.current = value;
    setStatus('dirty');
    try {
      localStorage.setItem(draftKey, JSON.stringify({ at: new Date().toISOString(), value }));
    } catch {
      /* storage full: DB save still happens */
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), delay);
  }, [value, enabled, delay, draftKey, flush]);

  // Flush when backgrounded / hidden / unmounted.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    document.addEventListener('visibilitychange', onHide);
    const sub = Capacitor.isNativePlatform() ? App.addListener('pause', () => void flush()) : null;
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      sub?.then((h) => h.remove());
      void flush();
    };
  }, [flush]);

  /** Drops unsaved changes (used right before deleting the record). */
  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    pending.current = null;
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
  }, [draftKey]);

  return { status, flush, cancel };
}

export function readDraft<T>(key: string): { at: string; value: T } | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function statusLabel(s: SaveStatus): string {
  switch (s) {
    case 'dirty':
    case 'saving':
      return 'Kaydediliyor…';
    case 'saved':
      return 'Kaydedildi';
    case 'error':
      return 'Kayıt başarısız';
    default:
      return '';
  }
}
