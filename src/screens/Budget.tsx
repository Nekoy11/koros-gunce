import { useState } from 'react';
import { AlertTriangle, Plus, Target, Trash2 } from 'lucide-react';
import { deleteBudget, getBudgetStatus, setBudget, type BudgetStatus } from '../data/budgets';
import { listCategories } from '../data/categories';
import { formatMonthYear, todayStr } from '../lib/dates';
import { kurusToInput, parseAmountToKurus } from '../lib/money';
import { errorMessage } from '../lib/log';
import { useDb } from '../state/useDb';
import { useSettings } from '../state/settings';
import { Page, PageHeader } from '../ui/layout';
import { Button, Card, Chip, EmptyState, Field, IconButton, ProgressBar, Spinner, TextInput, cx } from '../ui/primitives';
import { Sheet } from '../ui/Sheet';
import { useFeedback } from '../ui/feedback';

export function Budget() {
  const { settings, money } = useSettings();
  const { confirm, toast } = useFeedback();
  const { data } = useDb(() => getBudgetStatus(todayStr(), settings.budgetWarnPercent), [settings.budgetWarnPercent]);
  const [edit, setEdit] = useState<{ categoryId: number | null; amount?: number } | null>(null);

  const remove = async (b: BudgetStatus) => {
    if (!(await confirm({ title: 'Bütçe hedefi silinsin mi?', message: `${b.name} limiti kaldırılacak. Harcamalar etkilenmez.`, confirmLabel: 'Sil', danger: true }))) return;
    await deleteBudget(b.id);
    toast('Bütçe hedefi silindi.');
  };

  return (
    <>
      <PageHeader back title="Bütçe hedefleri" subtitle={formatMonthYear(todayStr())} actions={<IconButton icon={Plus} label="Hedef ekle" onClick={() => setEdit({ categoryId: null })} />} />
      <Page>
        {!data ? (
          <Spinner />
        ) : data.length === 0 ? (
          <EmptyState
            icon={Target}
            title="Bütçe hedefi yok"
            text="Aylık toplam harcama limiti ve kategori limitleri belirleyin. Limite yaklaşınca ve aşılınca uyarılırsınız."
            action={
              <Button icon={Plus} onClick={() => setEdit({ categoryId: null })}>
                Aylık limit belirle
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {data.map((b) => (
              <Card key={b.id} className="p-4">
                <div className="flex items-center gap-2">
                  <i className="h-2.5 w-2.5 rounded-full" style={{ background: b.color }} />
                  <button className="min-w-0 flex-1 truncate text-left text-[15px] font-medium" onClick={() => setEdit({ categoryId: b.categoryId, amount: b.limit })}>
                    {b.name}
                  </button>
                  <IconButton icon={Trash2} size={18} label="Sil" className="-my-2 -mr-2 text-muted" onClick={() => remove(b)} />
                </div>
                <button className="mt-2 block w-full text-left" onClick={() => setEdit({ categoryId: b.categoryId, amount: b.limit })}>
                  <ProgressBar percent={b.percent} state={b.state} />
                  <div className="mt-2 flex items-baseline justify-between text-[13px]">
                    <span className="tabular text-muted">
                      {money(b.spent)} / {money(b.limit)}
                    </span>
                    <span className={cx('tabular font-medium', b.state === 'over' ? 'text-neg' : b.state === 'warning' ? 'text-warn' : 'text-pos')}>
                      {b.remaining >= 0 ? `${money(b.remaining)} kaldı` : `${money(-b.remaining)} aşıldı`}
                    </span>
                  </div>
                  {b.state !== 'ok' && (
                    <div className={cx('mt-2 flex items-center gap-1.5 text-[12px]', b.state === 'over' ? 'text-neg' : 'text-warn')}>
                      <AlertTriangle size={13} />
                      {b.state === 'over' ? 'Limit aşıldı.' : `Limitin %${b.percent}'i kullanıldı.`}
                    </div>
                  )}
                </button>
              </Card>
            ))}
            <p className="px-1 pt-2 text-[12px] text-faint">Uyarı eşiği: limitin %{settings.budgetWarnPercent}'i. Ayarlardan değiştirilebilir.</p>
          </div>
        )}
      </Page>
      <BudgetSheet value={edit} existing={data ?? []} onClose={() => setEdit(null)} onSaved={(n) => toast(`${n} limiti kaydedildi.`)} onError={(e) => toast(errorMessage(e), 'error')} />
    </>
  );
}

function BudgetSheet({
  value,
  existing,
  onClose,
  onSaved,
  onError,
}: {
  value: { categoryId: number | null; amount?: number } | null;
  existing: BudgetStatus[];
  onClose: () => void;
  onSaved: (name: string) => void;
  onError: (e: unknown) => void;
}) {
  const cats = useDb(() => listCategories('expense'), [], ['categories']);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<typeof value>(null);
  if (value !== last) {
    setLast(value);
    if (value) {
      setCategoryId(value.categoryId);
      setAmount(value.amount ? kurusToInput(value.amount) : '');
      setError(null);
    }
  }
  const editing = value?.amount !== undefined;
  const overallExists = existing.some((b) => b.categoryId === null);

  const save = async () => {
    const k = parseAmountToKurus(amount);
    if (!k) return setError('Geçerli bir limit girin.');
    try {
      await setBudget(categoryId, k);
      onSaved(categoryId === null ? 'Aylık toplam' : (cats.data?.find((c) => c.id === categoryId)?.name ?? 'Kategori'));
      onClose();
    } catch (e) {
      onError(e);
    }
  };

  return (
    <Sheet
      open={!!value}
      onClose={onClose}
      title={editing ? 'Limiti düzenle' : 'Bütçe hedefi'}
      footer={
        <Button className="w-full" size="lg" onClick={save}>
          Kaydet
        </Button>
      }
    >
      <div className="space-y-4 pt-2">
        {!editing && (
          <Field label="Hedef türü">
            <div className="flex flex-wrap gap-2">
              <Chip active={categoryId === null} onClick={() => setCategoryId(null)}>
                Aylık toplam {overallExists && '(mevcut)'}
              </Chip>
              {(cats.data ?? []).map((c) => (
                <Chip key={c.id} color={c.color} active={categoryId === c.id} onClick={() => setCategoryId(c.id)}>
                  {c.name}
                  {existing.some((b) => b.categoryId === c.id) && ' (mevcut)'}
                </Chip>
              ))}
            </div>
          </Field>
        )}
        <Field label="Aylık limit" error={error} hint="Mevcut bir hedef seçilirse limiti güncellenir.">
          <TextInput inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Örn. 2.000" className="h-14 text-[20px] font-semibold tabular" />
        </Field>
      </div>
    </Sheet>
  );
}
