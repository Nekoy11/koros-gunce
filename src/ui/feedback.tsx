import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { useBackHandler } from '../state/back';
import { Button, TextInput, cx } from './primitives';
import { haptic } from '../lib/motion';

type ToastKind = 'success' | 'error' | 'info' | 'warning';
interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
}

interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** When set, the user must type this word to enable the confirm button. */
  typeToConfirm?: string;
}

interface FeedbackValue {
  toast: (text: string, kind?: ToastKind) => void;
  confirm: (o: ConfirmOptions) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackValue | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const [typed, setTyped] = useState('');
  const idRef = useRef(1);

  const toast = useCallback((text: string, kind: ToastKind = 'success') => {
    const id = idRef.current++;
    if (kind === 'success') haptic.success();
    else if (kind === 'error') haptic.error();
    else if (kind === 'warning') haptic.warning();
    setToasts((t) => [...t.slice(-2), { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 5000 : 2800);
  }, []);

  const confirm = useCallback((o: ConfirmOptions) => {
    setTyped('');
    if (o.danger) haptic.warning();
    return new Promise<boolean>((resolve) => setDialog({ ...o, resolve }));
  }, []);

  const close = (v: boolean) => {
    dialog?.resolve(v);
    setDialog(null);
  };
  useBackHandler(!!dialog, () => close(false));

  const canConfirm = !dialog?.typeToConfirm || typed.trim().toLocaleUpperCase('tr-TR') === dialog.typeToConfirm.toLocaleUpperCase('tr-TR');

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 top-[calc(var(--sat)+8px)] z-[70] flex flex-col items-center gap-2 px-4">
          {toasts.map((t) => {
            const Icon = t.kind === 'success' ? CheckCircle2 : t.kind === 'error' ? XCircle : t.kind === 'warning' ? AlertTriangle : Info;
            return (
              <div
                key={t.id}
                role="status"
                className="animate-toast pointer-events-auto flex w-full max-w-md items-start gap-2.5 rounded-2xl border border-line bg-card/90 px-4 py-3 text-[14px] shadow-xl backdrop-blur-xl"
              >
                <Icon
                  size={18}
                  className={cx('mt-px shrink-0', t.kind === 'success' && 'text-pos', t.kind === 'error' && 'text-neg', t.kind === 'warning' && 'text-warn', t.kind === 'info' && 'text-accent')}
                />
                <span className="whitespace-pre-line">{t.text}</span>
              </div>
            );
          })}
        </div>,
        document.body,
      )}
      {dialog &&
        createPortal(
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" role="alertdialog" aria-modal="true">
            <div className="animate-fade absolute inset-0 bg-[var(--overlay)] backdrop-blur-[2px]" onClick={() => close(false)} />
            <div className="animate-pop relative w-full max-w-sm rounded-3xl border border-line bg-surface p-5 shadow-2xl">
              <h3 className="text-[17px] font-semibold">{dialog.title}</h3>
              {dialog.message && <div className="mt-2 text-[14px] leading-relaxed text-muted">{dialog.message}</div>}
              {dialog.typeToConfirm && (
                <div className="mt-4">
                  <div className="mb-1.5 text-[13px] text-muted">
                    Onaylamak için <b className="text-fg">{dialog.typeToConfirm}</b> yazın
                  </div>
                  <TextInput value={typed} onChange={(e) => setTyped(e.target.value)} autoCapitalize="characters" autoComplete="off" />
                </div>
              )}
              <div className="mt-5 flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => close(false)}>
                  {dialog.cancelLabel ?? 'Vazgeç'}
                </Button>
                <Button variant={dialog.danger ? 'danger' : 'primary'} className="flex-1" disabled={!canConfirm} onClick={() => close(true)}>
                  {dialog.confirmLabel ?? 'Onayla'}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackValue {
  const v = useContext(FeedbackContext);
  if (!v) throw new Error('FeedbackProvider missing');
  return v;
}
