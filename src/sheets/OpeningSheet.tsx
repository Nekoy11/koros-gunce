import { useEffect, useState } from 'react';
import { getOpening, setOpening } from '../data/transactions';
import { kurusToInput, parseAmountAllowZero } from '../lib/money';
import { todayStr } from '../lib/dates';
import { errorMessage } from '../lib/log';
import { useSettings } from '../state/settings';
import { Sheet } from '../ui/Sheet';
import { Button, Field, TextInput } from '../ui/primitives';
import { useFeedback } from '../ui/feedback';

export function OpeningSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useFeedback();
  const { money } = useSettings();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayStr());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    getOpening().then((o) => {
      setAmount(o ? kurusToInput(o.amountKurus) : '');
      setDate(o?.date ?? todayStr());
    });
  }, [open]);

  const save = async () => {
    const k = parseAmountAllowZero(amount);
    if (k === null) return setError('Geçerli bir tutar girin.');
    setSaving(true);
    try {
      await setOpening(k, date);
      onClose();
      toast(`Başlangıç bakiyesi ${money(k)} olarak kaydedildi.`);
    } catch (e) {
      toast(`Kayıt başarısız: ${errorMessage(e)}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Başlangıç bakiyesi"
      footer={
        <Button className="w-full" size="lg" onClick={save} loading={saving}>
          Kaydet
        </Button>
      }
    >
      <p className="mb-4 px-1 text-[14px] leading-relaxed text-muted">
        Uygulamayı kullanmaya başladığınızda elinizdeki para. Değiştirdiğinizde diğer işlemler korunur; mevcut bakiye farkı kadar güncellenir.
      </p>
      <div className="space-y-4">
        <Field label="Tutar" error={error}>
          <TextInput inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Örn. 5.000" className="h-14 text-[22px] font-semibold tabular" autoFocus />
        </Field>
        <Field label="Tarih">
          <TextInput type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
}
