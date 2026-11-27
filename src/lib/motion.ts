import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/** True when the OS asks for reduced motion. Animations then collapse to instant changes. */
export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/**
 * Animates a number from its previous value to `target` (first mount starts at 0).
 * Integers only (kuruş), so formatted money never shows fractional noise.
 */
export function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }
    const from = valueRef.current;
    if (from === target) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setValue(Math.round(from + (target - from) * easeOutExpo(t)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

/** Returns false on the first render and true right after, so CSS transitions can run from an initial state. */
export function useMounted(): boolean {
  const [m, setM] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setM(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return m;
}

/* ---------- Haptics ---------- */

const native = Capacitor.isNativePlatform();

function vibrate(ms: number | number[]) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* ignore */
  }
}

export const haptic = {
  /** Tab change, toggles, chips. */
  tick() {
    if (native) Haptics.selectionChanged().catch(() => undefined);
  },
  /** Button presses that start something (open sheet, push screen). */
  light() {
    if (native) Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
    else vibrate(8);
  },
  medium() {
    if (native) Haptics.impact({ style: ImpactStyle.Medium }).catch(() => undefined);
    else vibrate(14);
  },
  success() {
    if (native) Haptics.notification({ type: NotificationType.Success }).catch(() => undefined);
    else vibrate([10, 40, 14]);
  },
  error() {
    if (native) Haptics.notification({ type: NotificationType.Error }).catch(() => undefined);
    else vibrate([20, 40, 20]);
  },
  warning() {
    if (native) Haptics.notification({ type: NotificationType.Warning }).catch(() => undefined);
  },
};
