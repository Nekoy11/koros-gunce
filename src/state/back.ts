import { useEffect, useRef } from 'react';

/**
 * Android back-button stack. The most recently registered handler (an open sheet,
 * dialog, or editor) runs first; returning true means "handled".
 */
type Handler = () => boolean;
const stack: { id: number; fn: () => boolean }[] = [];
let nextId = 1;

export function pushBackHandler(fn: Handler): () => void {
  const id = nextId++;
  stack.push({ id, fn });
  return () => {
    const i = stack.findIndex((h) => h.id === id);
    if (i >= 0) stack.splice(i, 1);
  };
}

export function runBackHandlers(): boolean {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].fn()) return true;
  }
  return false;
}

/** Registers `onBack` while `active` is true. */
export function useBackHandler(active: boolean, onBack: () => void): void {
  const ref = useRef(onBack);
  ref.current = onBack;
  useEffect(() => {
    if (!active) return;
    return pushBackHandler(() => {
      ref.current();
      return true;
    });
  }, [active]);
}
