import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useBackHandler } from '../state/back';
import { haptic } from '../lib/motion';
import { IconButton } from './primitives';

const EXIT_MS = 260;

/**
 * Bottom sheet modal sized for phones. Closes on backdrop tap, Android back button,
 * or by dragging the handle/header down. Slides out instead of vanishing.
 * Content scrolls; the footer stays visible above the keyboard (adjustResize).
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  full,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  full?: boolean;
}) {
  useBackHandler(open, onClose);

  // While closing, keep showing what was on screen when it was open (callers often clear their state on close).
  const snapshot = useRef({ title, children, footer });
  if (open) snapshot.current = { title, children, footer };
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);

  // Drag to dismiss.
  const panel = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; t: number; dy: number } | null>(null);
  const [dragY, setDragY] = useState(0);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      setDragY(0);
      return;
    }
    // dragY is kept: the exit animation continues from where the finger let go.
    if (!mounted) return;
    setClosing(true);
    const id = setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, EXIT_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);


  const onDown = (e: ReactPointerEvent) => {
    if (closing || (e.target as HTMLElement).closest('button')) return;
    drag.current = { y: e.clientY, t: performance.now(), dy: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const raw = e.clientY - d.y;
    // Rubber band when pulled up.
    d.dy = raw < 0 ? -Math.sqrt(-raw) * 2 : raw;
    setDragY(d.dy);
  };
  const onUp = (e: ReactPointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const dt = Math.max(1, performance.now() - d.t);
    const velocity = (e.clientY - d.y) / dt; // px per ms
    const height = panel.current?.offsetHeight ?? 400;
    if (d.dy > Math.min(140, height * 0.3) || (velocity > 0.6 && d.dy > 20)) {
      haptic.light();
      onClose();
    } else {
      setDragY(0);
    }
  };

  if (!mounted && !open) return null;
  const view = open ? { title, children, footer } : snapshot.current;
  const dragging = drag.current !== null;

  return createPortal(
    <div className={`fixed inset-0 z-50 flex flex-col justify-end ${closing ? 'pointer-events-none' : ''}`} role="dialog" aria-modal="true" aria-label={view.title}>
      <div
        className={closing ? 'animate-fade-out absolute inset-0 bg-[var(--overlay)]' : 'animate-fade absolute inset-0 bg-[var(--overlay)] backdrop-blur-[2px]'}
        style={{ opacity: !closing && dragY > 0 ? Math.max(0.2, 1 - dragY / 500) : undefined }}
        onClick={onClose}
      />
      <div
        ref={panel}
        className={`${closing ? 'animate-sheet-out' : 'animate-sheet'} relative flex w-full flex-col rounded-t-[28px] border-t border-line bg-surface shadow-[0_-12px_40px_rgba(0,0,0,0.18)] ${full ? 'h-[calc(100%-var(--sat)-12px)]' : 'max-h-[calc(100%-var(--sat)-24px)]'}`}
        style={
          {
            '--drag-y': `${Math.max(0, dragY)}px`,
            transform: !closing && dragY !== 0 ? `translateY(${dragY}px)` : undefined,
            transition: !closing && !dragging ? 'transform 380ms var(--ease-spring)' : undefined,
          } as CSSProperties
        }
      >
        <div className="touch-none cursor-grab select-none" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <div className="mx-auto mt-2 h-1.5 w-11 rounded-full bg-faint/40" />
          <div className="flex items-center justify-between px-4 pb-1 pt-1">
            <h2 className="pl-1 text-[17px] font-semibold">{view.title}</h2>
            <IconButton icon={X} label="Kapat" onClick={onClose} />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{view.children}</div>
        {view.footer && <div className="border-t border-line px-5 pb-[calc(var(--sab)+12px)] pt-3">{view.footer}</div>}
        {!view.footer && <div className="pb-safe" />}
      </div>
    </div>,
    document.body,
  );
}
