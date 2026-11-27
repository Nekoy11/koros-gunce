import type { ReactNode } from 'react';
import { ArrowLeft, BookOpen, CalendarDays, Home, LayoutGrid, Wallet } from 'lucide-react';
import { useNav, type TabName } from '../state/nav';
import { runBackHandlers } from '../state/back';
import { IconButton, cx } from './primitives';

export function PageHeader({ title, subtitle, actions, back }: { title: string; subtitle?: string; actions?: ReactNode; back?: boolean }) {
  const nav = useNav();
  return (
    <header className="pt-safe sticky top-0 z-30 bg-bg/60 backdrop-blur-xl backdrop-saturate-150">
      <div className="flex h-14 items-center gap-1 px-2">
        {back ? <IconButton icon={ArrowLeft} label="Geri" onClick={() => runBackHandlers() || nav.pop()} /> : <div className="w-2" />}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[20px] font-semibold tracking-tight">{title}</h1>
          {subtitle && <div className="-mt-0.5 truncate text-[12px] text-muted">{subtitle}</div>}
        </div>
        <div className="flex items-center">{actions}</div>
      </div>
    </header>
  );
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cx('stagger pb-nav mx-auto w-full max-w-xl px-4', className)}>{children}</main>;
}

const TABS: { name: TabName; label: string; icon: typeof Home }[] = [
  { name: 'home', label: 'Ana Sayfa', icon: Home },
  { name: 'finance', label: 'Finans', icon: Wallet },
  { name: 'diary', label: 'Günlük', icon: BookOpen },
  { name: 'calendar', label: 'Takvim', icon: CalendarDays },
  { name: 'more', label: 'Daha Fazla', icon: LayoutGrid },
];

export function BottomNav() {
  const nav = useNav();
  const idx = Math.max(0, TABS.findIndex((t) => t.name === nav.tab));
  return (
    <nav className="animate-rise pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/80 backdrop-blur-xl backdrop-saturate-150" aria-label="Ana menü">
      <div className="relative mx-auto flex h-[var(--nav-h)] max-w-xl">
        {/* Sliding pill behind the active icon. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 flex justify-center"
          style={{ width: `${100 / TABS.length}%`, transform: `translateX(${idx * 100}%)`, transition: 'transform 460ms var(--ease-spring)' }}
        >
          <span className="mt-[8px] h-7 w-14 rounded-full bg-accent-soft" />
        </span>
        {TABS.map((t, i) => {
          const active = nav.tab === t.name;
          return (
            <button
              key={t.name}
              onClick={() => {
                if (active && nav.stack.length === 1) {
                  // Re-tapping the current tab scrolls it back to the top.
                  document.querySelector('[data-active-layer] > div')?.scrollTo({ top: 0, behavior: 'smooth' });
                  return;
                }
                nav.setTab(t.name);
              }}
              aria-current={active ? 'page' : undefined}
              data-tab-index={i}
              className={cx('press relative flex flex-1 flex-col items-center justify-center gap-1.5 text-[11px] font-medium transition-colors duration-300', active ? 'text-accent' : 'text-muted')}
            >
              <span key={active ? `on-${nav.tab}` : 'off'} className={active ? 'nav-bounce' : undefined}>
                <t.icon size={22} strokeWidth={active ? 2.3 : 1.8} />
              </span>
              {t.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
