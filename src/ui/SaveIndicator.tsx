import { CheckCircle2, CloudOff, Loader2 } from 'lucide-react';
import { statusLabel, type SaveStatus } from '../state/useAutosave';
import { cx } from './primitives';

/** "Kaydediliyor… / Kaydedildi / Kayıt başarısız" indicator for autosaving editors. */
export function SaveIndicator({ status }: { status: SaveStatus }) {
  const label = statusLabel(status);
  if (!label) return null;
  const Icon = status === 'error' ? CloudOff : status === 'saved' ? CheckCircle2 : Loader2;
  return (
    <span className={cx('mr-1 flex items-center gap-1 text-[12px]', status === 'error' ? 'text-neg' : 'text-muted')} role="status">
      <Icon size={14} className={status === 'saving' || status === 'dirty' ? 'animate-spin' : ''} />
      {label}
    </span>
  );
}
