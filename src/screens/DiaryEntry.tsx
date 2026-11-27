import { useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { deleteDiaryEntry, getDiaryEntry, saveDiaryEntry } from '../data/diary';
import { uuid } from '../lib/id';
import { formatDateWithWeekday, formatTimestamp, todayStr, type DateStr } from '../lib/dates';
import { parseTags } from '../lib/text';
import { errorMessage } from '../lib/log';
import { useNav } from '../state/nav';
import { useBackHandler } from '../state/back';
import { clearDraft, readDraft, useAutosave } from '../state/useAutosave';
import { SaveIndicator } from '../ui/SaveIndicator';
import { useAutoGrow } from '../ui/useAutoGrow';
import { PageHeader } from '../ui/layout';
import { IconButton, Spinner, TextInput } from '../ui/primitives';
import { useFeedback } from '../ui/feedback';

interface Draft {
  date: DateStr;
  title: string;
  content: string;
  tags: string;
}


export function DiaryEntryScreen({ id: routeId, date: routeDate }: { id?: string; date?: DateStr }) {
  const nav = useNav();
  const { toast, confirm } = useFeedback();
  const id = useMemo(() => routeId ?? uuid(), [routeId]);
  const [draft, setDraft] = useState<Draft | null>(routeId ? null : { date: routeDate ?? todayStr(), title: '', content: '', tags: '' });
  const [meta, setMeta] = useState<{ created: string; updated: string } | null>(null);
  const [exists, setExists] = useState(!!routeId);
  const [touched, setTouched] = useState(false);
  const draftKey = `ph-draft-diary-${id}`;

  useEffect(() => {
    if (!routeId) return;
    getDiaryEntry(routeId).then((e) => {
      if (!e) {
        toast('Kayıt bulunamadı.', 'error');
        nav.pop();
        return;
      }
      let d: Draft = { date: e.date, title: e.title, content: e.content, tags: e.tags.join(', ') };
      const local = readDraft<Draft>(draftKey);
      if (local && local.at > e.updated_at) {
        d = local.value;
        toast('Kaydedilmemiş son değişiklikleriniz geri yüklendi.', 'info');
        setTouched(true);
      }
      setDraft(d);
      setMeta({ created: e.created_at, updated: e.updated_at });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId]);

  const contentRef = useAutoGrow(draft?.content);
  const isEmpty = !draft || (!draft.title.trim() && !draft.content.trim());
  const { status, flush, cancel } = useAutosave({
    value: draft,
    enabled: !!draft && touched && (exists || !isEmpty),
    draftKey,
    save: async (v) => {
      if (!v) return;
      await saveDiaryEntry(id, { date: v.date, title: v.title, content: v.content, tags: parseTags(v.tags) });
      setExists(true);
    },
  });

  const update = (patch: Partial<Draft>) => {
    setTouched(true);
    setDraft((d) => (d ? { ...d, ...patch } : d));
  };

  const close = async () => {
    if (exists && isEmpty) {
      // An entry whose title and text were fully erased is removed instead of kept empty.
      cancel();
      await deleteDiaryEntry(id).catch(() => undefined);
      nav.pop();
      return;
    }
    const ok = await flush();
    if (!ok) {
      const leave = await confirm({ title: 'Kayıt başarısız', message: 'Son değişiklikler kaydedilemedi. Yine de çıkılsın mı? (Taslak cihazda saklanır.)', confirmLabel: 'Çık' });
      if (!leave) return;
    }
    nav.pop();
  };
  useBackHandler(true, close);

  const remove = async () => {
    const ok = await confirm({ title: 'Kayıt silinsin mi?', message: 'Bu günlük kaydı kalıcı olarak silinecek.', confirmLabel: 'Sil', danger: true });
    if (!ok) return;
    try {
      setTouched(false);
      cancel();
      await deleteDiaryEntry(id);
      clearDraft(draftKey);
      toast('Kayıt silindi.');
      nav.pop();
    } catch (e) {
      toast(`Silinemedi: ${errorMessage(e)}`, 'error');
    }
  };


  return (
    <>
      <PageHeader
        back
        title={exists ? 'Günlük kaydı' : 'Yeni kayıt'}
        actions={
          <>
            <SaveIndicator status={status} />
            {exists && <IconButton icon={Trash2} label="Sil" onClick={remove} />}
          </>
        }
      />
      {!draft ? (
        <Spinner />
      ) : (
        <main className="mx-auto w-full max-w-xl px-4 pb-[calc(var(--sab)+40px)]">
          <div className="flex items-center gap-2">
            <TextInput type="date" value={draft.date} onChange={(e) => e.target.value && update({ date: e.target.value })} className="h-10 max-w-44 text-[14px]" aria-label="Tarih" />
            <span className="truncate text-[13px] text-muted">{formatDateWithWeekday(draft.date).split(', ')[1]}</span>
          </div>
          <input
            value={draft.title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="Başlık"
            maxLength={200}
            className="mt-4 w-full bg-transparent text-[22px] font-semibold outline-none placeholder:text-faint"
          />
          <input
            value={draft.tags}
            onChange={(e) => update({ tags: e.target.value })}
            placeholder="Etiketler (virgülle ayırın)"
            className="mt-2 w-full bg-transparent text-[14px] text-accent outline-none placeholder:text-faint"
          />
          <textarea
            ref={contentRef}
            value={draft.content}
            onChange={(e) => update({ content: e.target.value })}
            placeholder="Bugün neler oldu?"
            autoFocus={!routeId}
            className="mt-4 w-full resize-none bg-transparent text-[16px] leading-[1.7] outline-none placeholder:text-faint"
          />
          {meta && (
            <div className="mt-6 border-t border-line pt-3 text-[12px] text-faint">
              Oluşturuldu {formatTimestamp(meta.created)} · Son düzenleme {formatTimestamp(meta.updated)}
            </div>
          )}
        </main>
      )}
    </>
  );
}
