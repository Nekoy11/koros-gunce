import { useEffect, useRef } from 'react';

/** Grows a textarea with its content (min height in px) so long texts scroll with the page. */
export function useAutoGrow(value: string | undefined, minHeight = 240) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, minHeight)}px`;
  }, [value, minHeight]);
  return ref;
}
