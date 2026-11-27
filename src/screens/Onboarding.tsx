import { useState } from 'react';
import { pickTextFile } from '../services/files';
import { parseBackupText, restoreFromBackup } from '../services/backupService';
import { Wallet } from 'lucide-react';
import { setOpening } from '../data/transactions';
import { CURRENCIES, parseAmountAllowZero, type CurrencyCode } from '../lib/money';
import { todayStr } from '../lib/dates';
import { errorMessage } from '../lib/log';
import { useSettings } from '../state/settings';
import { Button, Chip, Field, TextInput } from '../ui/primitives';
import { useFeedback } from '../ui/feedback';

/** First launch: currency + current money. Can be skipped and set later in Finans. */
export function Onboarding() {
  const { settings, update } = useSettings();
  const { toast } = useFeedback();
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const finish = async (skip: boolean) => {
    setSaving(true);
    try {
      if (!skip) {
        const k = parseAmountAllowZero(amount);
        if (k === null) {
          setError('Geçerli bir tutar girin, ör. 5.000');
          setSaving(false);
          return;
        }
        await setOpening(k, todayStr());
      }
      await update('onboarded', true);
    } catch (e) {
      toast(errorMessage(e), 'error');
      setSaving(false);
    }
  };

  const restore = async () => {
    setSaving(true);
    try {
      const file = await pickTextFile();
      if (!file) return;
      const { backup, summary } = parseBackupText(file.text);
      await restoreFromBackup(backup);
      toast(`Yedek geri yüklendi: ${summary.transactions} işlem, ${summary.diary} günlük, ${summary.notes} not.`);
      // restoreBackup marks the app as set up; settings reload via the data-change event.
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pt-safe pb-safe flex min-h-full flex-col bg-bg">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pt-14">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <Wallet size={28} />
        </div>
        <h1 className="mt-6 text-[28px] font-semibold leading-tight tracking-tight">Koros Günce'ye hoş geldin</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          Harcamaların, günlüğün, notların ve hatırlatmaların tek yerde. Tüm veriler yalnızca bu telefonda saklanır; internet veya hesap gerekmez.
        </p>

        <div className="mt-8 space-y-5">
          <Field label="Para birimi">
            <div className="flex flex-wrap gap-2">
              {CURRENCIES.map((c) => (
                <Chip key={c.code} active={settings.currency === c.code} onClick={() => update('currency', c.code as CurrencyCode)}>
                  {c.symbol} {c.code}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label="Şu an elindeki para (başlangıç bakiyesi)" error={error} hint="Daha sonra Finans bölümünden düzenleyebilirsin.">
            <TextInput inputMode="decimal" placeholder="Örn. 5.000" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-14 text-[22px] font-semibold tabular" />
          </Field>
        </div>

        <div className="mt-auto space-y-2 pb-8 pt-8">
          <Button size="lg" className="w-full" onClick={() => finish(false)} loading={saving} disabled={!amount.trim()}>
            Başla
          </Button>
          <Button size="lg" variant="ghost" className="w-full" onClick={() => finish(true)} disabled={saving}>
            Şimdilik atla
          </Button>
          <Button size="lg" variant="ghost" className="w-full text-muted" onClick={restore} disabled={saving}>
            Yedekten geri yükle
          </Button>
        </div>
      </div>
    </div>
  );
}
