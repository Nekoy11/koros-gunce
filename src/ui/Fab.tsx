import { Plus } from 'lucide-react';
import { haptic } from '../lib/motion';

/** Floating add button, placed above the bottom navigation. */
export function Fab({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      aria-label={label}
      onClick={() => {
        haptic.light();
        onClick();
      }}
      className="press press-strong animate-pop fixed right-4 z-30 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#6adde2] to-[#119aa4] text-[#0c1a20] shadow-[0_12px_28px_-8px_#1ec1cb]"
      style={{ bottom: 'calc(var(--nav-h) + var(--sab) + 16px)', animationDelay: '180ms' }}
    >
      <Plus size={26} />
    </button>
  );
}
