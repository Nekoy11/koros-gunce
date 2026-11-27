import { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { listCategories, type Category } from '../data/categories';
import {
  addTransaction,
  deleteTransaction,
  getBalance,
  getFrequentTitles,
  getTransaction,
  updateTransaction,
  type TxType,
} from '../data/transactions';
import { getBudgetStatus, type BudgetStatus } from '../data/budgets';
import { uuid } from '../lib/id';
import { kurusToInput, parseAmountToKurus } from '../lib/money';
import { todayStr, type DateStr } from '../lib/dates';
import { errorMessage, logError } from '../lib/log';
import { useSettings } from '../state/settings';
import { useDb } from '../state/useDb';
import { Sheet } from '../ui/Sheet';
import { Button, Chip, Field, Segmented, TextArea, TextInput } from '../ui/primitives';
import { useFeedback } from '../ui/feedback';

export interface TxSheetOptions {
  type?: TxType;
  id?: string;
  date?: DateStr;
}

export function TransactionSheet({ opts, onClose }: { opts: TxSheetOptions | null; onClose: () => void }) {
  const open = !!opts;
  const editing = !!opts?.id;
  const { settings, money } = useSettings();
  const { toast, confirm } = useFeedback();

  const [type, setType] = useState<TxType>('expense');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState<DateStr>(todayStr());
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<{ title?: string; amount?: string; category?: string }>({});
  const [saving, setSaving] = useState(false);
  const newId = useRef(uuid());

  const cats = useDb(() => listCategories(), [], ['categories']);
  const frequent = useDb(() => getFrequentTitles(type), [type, open], []);

  useEffect(() => {
    if (!opts) return;
    newId.current = uuid();
    setErrors({});
    setSaving(false);
    if (opts.id) {
      getTransaction(opts.id).then((t) => {
        if (!t || t.type === 'opening') return;
        setType(t.type);
        setTitle(t.title);
        setAmount(kurusToInput(t.amount_kurus));
        setDate(t.date);
        setCategoryId(t.category_id);
        setDescription(t.description ?? '');
      });
    } else {
      setType(opts.type ?? 'expense');
      setTitle('');
      setAmount('');
      setDate(opts.date ?? todayStr());
      setCategoryId(null);
      setDescription('');
    }
  }, [opts]);

  const typeCats: Category[] = (cats.data ?? []).filter((c) => c.kind === type);

  const budgetSnapshot = async (): Promise<BudgetStatus[]> => (type === 'expense' ? getBudgetStatus(date, settings.budgetWarnPercent) : []);

  const save = async () => {
    const amountKurus = parseAmountToKurus(amount);
    const e: typeof errors = {};
    if (!title.trim()) e.title = 'İsim zorunludur.';
    if (!amountKurus) e.amount = 'Geçerli bir tutar girin (ör. 50 veya 12,50).';
    const cat = categoryId ?? typeCats.find((c) => c.is_system)?.id ?? null;
    if (!cat) e.category = 'Kategori seçin.';
    setErrors(e);
    if (Object.keys(e).length || saving) return;

    setSaving(true);
    try {
      const before = await budgetSnapshot();
      const input = { type, amountKurus: amountKurus!, title, categoryId: cat!, date, description };
      if (editing) await updateTransaction(opts!.id!, input);
      else await addTransaction(newId.current, input);
      onClose();
      toast(editing ? 'İşlem güncellendi.' : type === 'expense' ? 'Harcama kaydedildi.' : 'Gelir kaydedildi.');

      // Post-save notices: negative balance and budget thresholds.
      const balance = await getBalance();
      if (balance < 0) toast(`Bakiyeniz eksiye düştü: ${money(balance)}`, 'warning');
      if (type === 'expense') {
        const after = await getBudgetStatus(date, settings.budgetWarnPercent);
        for (const b of after) {
          if (b.categoryId !== null && b.categoryId !== cat) continue;
          const prev = before.find((x) => x.id === b.id)?.state ?? 'ok';
          if (b.state === 'over' && prev !== 'over') toast(`${b.name} bütçesi aşıldı (${money(b.spent)} / ${money(b.limit)}).`, 'error');
          else if (b.state === 'warning' && prev === 'ok') toast(`${b.name} bütçesinin %${b.percent}'i kullanıldı.`, 'warning');
        }
      }
    } catch (err) {
      logError('saveTransaction', err);
      toast(`Kayıt başarısız: ${errorMessage(err)}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!opts?.id) return;
    const ok = await confirm({ title: 'İşlem silinsin mi?', message: `"${title}" kalıcı olarak silinecek ve bakiye yeniden hesaplanacak.`, confirmLabel: 'Sil', danger: true });
    if (!ok) return;
    try {
      await deleteTransaction(opts.id);
      onClose();
      toast('İşlem silindi.');
    } catch (err) {
      toast(`Silinemedi: ${errorMessage(err)}`, 'error');
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? 'İşlemi düzenle' : type === 'expense' ? 'Harcama ekle' : 'Gelir ekle'}
      footer={
        <div className="flex gap-2">
          {editing && <Button variant="secondary" icon={Trash2} onClick={remove} aria-label="Sil" className="text-neg" />}
          <Button className="flex-1" size="lg" onClick={save} loading={saving}>
            {editing ? 'Güncelle' : 'Kaydet'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 pt-2">
        <Segmented
          value={type}
          onChange={(t) => {
            setType(t);
            setCategoryId(null);
          }}
          options={[
            { value: 'expense', label: 'Gider' },
            { value: 'income', label: 'Gelir' },
          ]}
        />

        <Field label="Tutar" required error={errors.amount}>
          <div className="relative">
            <TextInput
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,\s]/g, ''))}
              className={`h-14 pr-12 text-[24px] font-semibold tabular ${type === 'expense' ? 'text-neg' : 'text-pos'}`}
              autoFocus={!editing}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[17px] text-muted">{money(0).split(' ').pop()}</span>
          </div>
        </Field>

        <Field label={type === 'expense' ? 'Ürün / harcama adı' : 'Gelir adı'} required error={errors.title}>
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder={type === 'expense' ? 'Örn. Kahve' : 'Örn. Harçlık'} maxLength={120} />
        </Field>

        {!editing && !title && (frequent.data?.length ?? 0) > 0 && (
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
            {frequent.data!.map((f) => (
              <Chip
                key={f.title}
                onClick={() => {
                  setTitle(f.title);
                  if (typeCats.some((c) => c.id === f.category_id)) setCategoryId(f.category_id);
                }}
              >
                {f.title}
              </Chip>
            ))}
          </div>
        )}

        <Field label="Tarih" required>
          <TextInput type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </Field>

        <Field label="Kategori" error={errors.category} hint={!categoryId ? 'Seçilmezse "Diğer" kullanılır.' : undefined}>
          <div className="flex flex-wrap gap-2">
            {typeCats.map((c) => (
              <Chip key={c.id} active={categoryId === c.id} color={c.color} onClick={() => setCategoryId(c.id)}>
                {c.name}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="Açıklama">
          <TextArea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="İsteğe bağlı" maxLength={1000} rows={2} className="min-h-16" />
        </Field>
      </div>
    </Sheet>
  );
}
