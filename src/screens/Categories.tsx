import { useState } from 'react';
import { Lock, Plus } from 'lucide-react';
import { CATEGORY_COLORS, countCategoryUsage, createCategory, deleteCategory, listCategories, updateCategory, type Category, type CategoryKind } from '../data/categories';
import { errorMessage } from '../lib/log';
import { useDb } from '../state/useDb';
import { Page, PageHeader } from '../ui/layout';
import { Button, CategoryDot, Divided, Field, IconButton, Segmented, Spinner, TextInput, cx } from '../ui/primitives';
import { Sheet } from '../ui/Sheet';
import { useFeedback } from '../ui/feedback';

export function Categories() {
  const [kind, setKind] = useState<CategoryKind>('expense');
  const { data } = useDb(() => listCategories(kind), [kind], ['categories']);
  const [edit, setEdit] = useState<Category | 'new' | null>(null);

  return (
    <>
      <PageHeader back title="Kategoriler" actions={<IconButton icon={Plus} label="Kategori ekle" onClick={() => setEdit('new')} />} />
      <Page>
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'expense', label: 'Gider' },
            { value: 'income', label: 'Gelir' },
          ]}
        />
        <div className="mt-3">
          {!data ? (
            <Spinner />
          ) : (
            <Divided>
              {data.map((c) => (
                <button key={c.id} onClick={() => setEdit(c)} className="flex min-h-14 w-full items-center gap-3 px-4 text-left active:bg-card-2">
                  <CategoryDot color={c.color} size={32}>
                    {c.name.slice(0, 1)}
                  </CategoryDot>
                  <span className="flex-1 text-[15px]">{c.name}</span>
                  {!!c.is_system && <Lock size={14} className="text-faint" />}
                </button>
              ))}
            </Divided>
          )}
          <p className="mt-3 px-1 text-[12px] text-faint">Silinen bir kategorinin işlemleri “Diğer” kategorisine taşınır; hiçbir kayıt kaybolmaz.</p>
        </div>
      </Page>
      <CategorySheet value={edit} kind={kind} onClose={() => setEdit(null)} />
    </>
  );
}

function CategorySheet({ value, kind, onClose }: { value: Category | 'new' | null; kind: CategoryKind; onClose: () => void }) {
  const { toast, confirm } = useFeedback();
  const [name, setName] = useState('');
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<typeof value>(null);
  if (value !== last) {
    setLast(value);
    if (value) {
      setName(value === 'new' ? '' : value.name);
      setColor(value === 'new' ? CATEGORY_COLORS[Math.floor(Math.random() * CATEGORY_COLORS.length)] : value.color);
      setError(null);
    }
  }
  const editing = value && value !== 'new' ? value : null;

  const save = async () => {
    try {
      if (editing) await updateCategory(editing.id, { name, color });
      else await createCategory({ name, kind, color });
      toast('Kategori kaydedildi.');
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const remove = async () => {
    if (!editing) return;
    const n = await countCategoryUsage(editing.id);
    const ok = await confirm({
      title: `“${editing.name}” silinsin mi?`,
      message: n ? `${n} işlem “${editing.kind === 'expense' ? 'Diğer' : 'Diğer Gelir'}” kategorisine taşınacak.` : 'Bu kategoride işlem yok.',
      confirmLabel: 'Sil',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteCategory(editing.id);
      toast('Kategori silindi.');
      onClose();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  return (
    <Sheet
      open={!!value}
      onClose={onClose}
      title={editing ? 'Kategoriyi düzenle' : `Yeni ${kind === 'expense' ? 'gider' : 'gelir'} kategorisi`}
      footer={
        <div className="flex gap-2">
          {editing && !editing.is_system && (
            <Button variant="secondary" className="text-neg" onClick={remove}>
              Sil
            </Button>
          )}
          <Button className="flex-1" size="lg" onClick={save}>
            Kaydet
          </Button>
        </div>
      }
    >
      <div className="space-y-4 pt-2">
        <Field label="Ad" required error={error}>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus />
        </Field>
        <Field label="Renk">
          <div className="flex flex-wrap gap-2.5">
            {CATEGORY_COLORS.map((c) => (
              <button
                key={c}
                aria-label={c}
                onClick={() => setColor(c)}
                className={cx('h-9 w-9 rounded-full border-2', color === c ? 'border-fg' : 'border-transparent')}
                style={{ background: c }}
              />
            ))}
          </div>
        </Field>
        {editing?.is_system ? <p className="text-[12px] text-faint">Bu varsayılan kategori silinemez, ancak yeniden adlandırılabilir.</p> : null}
      </div>
    </Sheet>
  );
}
