import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { logError } from '../lib/log';

export function FatalScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="pt-safe flex min-h-full flex-col items-center justify-center bg-bg px-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neg/15 text-neg">
        <AlertTriangle size={26} />
      </div>
      <h1 className="mt-4 text-[18px] font-semibold">Beklenmeyen bir hata oluştu</h1>
      <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-muted">{message}</p>
      <p className="mt-2 max-w-sm text-[13px] text-faint">Kayıtlı verileriniz veritabanında güvende. Uygulamayı yeniden başlatmayı deneyin.</p>
      <button onClick={onRetry} className="mt-6 h-11 rounded-xl bg-accent px-6 font-medium text-on-accent">
        Yeniden başlat
      </button>
    </div>
  );
}

/** Catches render errors so a bug in one screen never wipes or blocks the stored data. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    logError('render', error);
  }

  render() {
    if (this.state.error) return <FatalScreen message={this.state.error.message} onRetry={() => location.reload()} />;
    return this.props.children;
  }
}
