import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { Loader2, type LucideIcon } from 'lucide-react';
import { haptic, useMounted } from '../lib/motion';

export function cx(...c: (string | false | null | undefined)[]): string {
  return c.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; icon?: LucideIcon; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(
        'press inline-flex items-center justify-center gap-2 rounded-xl font-medium disabled:opacity-50 select-none',
        size === 'sm' && 'h-9 px-3 text-sm',
        size === 'md' && 'h-11 px-4 text-[15px]',
        size === 'lg' && 'h-[52px] px-5 text-base',
        variant === 'primary' && 'bg-accent text-on-accent shadow-[0_6px_18px_-8px_var(--accent)]',
        variant === 'secondary' && 'bg-card-2 text-fg',
        variant === 'ghost' && 'text-accent',
        variant === 'danger' && 'bg-neg text-white',
        className,
      )}
    >
      {loading ? <Loader2 size={18} className="animate-spin" /> : Icon ? <Icon size={18} strokeWidth={2} /> : null}
      {children}
    </button>
  );
}

export function IconButton({ icon: Icon, label, className, size = 22, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string; size?: number }) {
  return (
    <button
      aria-label={label}
      title={label}
      {...rest}
      className={cx('press press-strong inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-fg active:bg-card-2 disabled:opacity-40', className)}
    >
      <Icon size={size} strokeWidth={1.9} />
    </button>
  );
}

export function Field({ label, hint, error, children, required }: { label: string; hint?: ReactNode; error?: string | null; children: ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-muted">
        {label}
        {required && <span className="text-neg"> *</span>}
      </span>
      {children}
      {error ? <span className="mt-1 block text-[13px] text-neg">{error}</span> : hint ? <span className="mt-1 block text-[12px] text-faint">{hint}</span> : null}
    </label>
  );
}

const inputCls =
  'w-full rounded-xl border border-line bg-surface px-3.5 text-[16px] text-fg placeholder:text-faint outline-none focus:border-accent transition-colors';

/** Keeps the focused field visible above the soft keyboard. */
function scrollIntoViewSoon(el: HTMLElement) {
  setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput({ className, onFocus, ...rest }, ref) {
  return (
    <input
      ref={ref}
      {...rest}
      onFocus={(e) => {
        scrollIntoViewSoon(e.currentTarget);
        onFocus?.(e);
      }}
      className={cx(inputCls, 'h-12', className)}
    />
  );
});

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea({ className, onFocus, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      {...rest}
      onFocus={(e) => {
        scrollIntoViewSoon(e.currentTarget);
        onFocus?.(e);
      }}
      className={cx(inputCls, 'min-h-24 py-3 leading-relaxed', className)}
    />
  );
});

export function Segmented<T extends string>({ value, options, onChange, className }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; className?: string }) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const mounted = useMounted();
  return (
    <div className={cx('relative flex rounded-xl bg-card-2 p-1', className)} role="tablist">
      <span
        aria-hidden
        className="absolute bottom-1 top-1 rounded-lg bg-surface shadow-sm"
        style={{
          left: 4,
          width: `calc((100% - 8px) / ${options.length})`,
          transform: `translateX(${idx * 100}%)`,
          transition: mounted ? 'transform 420ms var(--ease-spring)' : undefined,
        }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => {
            if (o.value !== value) haptic.tick();
            onChange(o.value);
          }}
          className={cx(
            'relative z-[1] h-9 flex-1 rounded-lg px-2 text-[14px] font-medium transition-colors duration-300 whitespace-nowrap',
            o.value === value ? 'text-fg' : 'text-muted',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({ active, onClick, children, color }: { active?: boolean; onClick?: () => void; children: ReactNode; color?: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        haptic.tick();
        onClick?.();
      }}
      className={cx(
        'press inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[14px] transition-colors',
        active ? 'border-accent bg-accent-soft text-fg' : 'border-line text-muted',
      )}
    >
      {color && <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />}
      {children}
    </button>
  );
}

export function ProgressBar({ percent, state }: { percent: number; state: 'ok' | 'warning' | 'over' }) {
  const w = Math.min(100, Math.max(0, percent));
  const mounted = useMounted();
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-card-2">
      <div
        className={cx('relative h-full origin-left overflow-hidden rounded-full', state === 'over' ? 'bg-neg' : state === 'warning' ? 'bg-warn' : 'bg-pos')}
        style={{ width: `${w}%`, transform: mounted ? 'scaleX(1)' : 'scaleX(0)', transition: 'transform 1100ms var(--ease-out), width 600ms var(--ease-out)' }}
      />
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="animate-pop mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-card-2 text-muted">
        <Icon size={22} />
      </div>
      <div className="text-[15px] font-semibold">{title}</div>
      {text && <p className="mt-1 max-w-72 text-[14px] leading-relaxed text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between px-1">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {action && (
        <button onClick={onAction} className="-mr-2 px-2 py-1 text-[14px] font-medium text-accent">
          {action}
        </button>
      )}
    </div>
  );
}

export function Card({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp onClick={onClick} className={cx('block w-full rounded-2xl border border-line bg-card text-left', onClick && 'press active:bg-card-2', className)}>
      {children}
    </Comp>
  );
}

export function ListRow({
  left,
  title,
  subtitle,
  right,
  onClick,
  className,
}: {
  left?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp onClick={onClick} className={cx('flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left', onClick && 'active:bg-card-2', className)}>
      {left}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] text-fg">{title}</div>
        {subtitle && <div className="truncate text-[13px] text-muted">{subtitle}</div>}
      </div>
      {right}
    </Comp>
  );
}

export function Divided({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card', className)}>{children}</div>;
}

export function CategoryDot({ color, size = 36, children }: { color: string; size?: number; children?: ReactNode }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full text-[13px] font-semibold"
      style={{ width: size, height: size, background: `${color}22`, color }}
    >
      {children}
    </span>
  );
}

export function Spinner() {
  return (
    <div className="flex justify-center py-10 text-muted">
      <Loader2 className="animate-spin" size={22} />
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => {
        haptic.tick();
        onChange(!checked);
      }}
      className={cx('relative h-7 w-12 shrink-0 rounded-full border transition-colors duration-300', checked ? 'border-accent bg-accent' : 'border-line bg-card-2')}
    >
      <span
        className="absolute left-0.5 top-1/2 h-[22px] w-[22px] rounded-full bg-white shadow-md"
        style={{ transform: `translate(${checked ? 20 : 0}px, -50%)`, transition: 'transform 380ms var(--ease-spring)' }}
      />
    </button>
  );
}
