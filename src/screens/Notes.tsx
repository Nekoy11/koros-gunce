import { useEffect, useMemo, useState } from 'react';
import { Pin, PinOff, Search, StickyNote, Trash2 } from 'lucide-react';
import { deleteNote, getNote, listNoteCategories, listNotes, NOTE_CATEGORY_SUGGESTIONS, saveNote, setNotePinned } from '../data/notes';
import { formatTimestamp } from '../lib/dates';
import { uuid } from '../lib/id';
import { errorMessage } from '../lib/log';
import { useDb } from '../state/useDb';
import { useNav } from '../state/nav';
import { useBackHandler } from '../state/back';
import { clearDraft, readDraft, useAutosave } from '../state/useAutosave';
import { Page, PageHeader } from '../ui/layout';
import { Button, Chip, Divided, EmptyState, IconButton, Spinner, TextInput } from '../ui/primitives';
import { useFeedback } from '../ui/feedback';
import { Fab } from '../ui/Fab';
import { SaveIndicator } from '../ui/SaveIndicator';
import { useAutoGrow } from '../ui/useAutoGrow';

export function Notes() {
  const nav = useNav();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [limit, setLimit] = useState(200);
  const { data: page } = useDb(
    async () => {
      const rows = await listNotes({ search: q, category, limit: limit + 1 });
      return { rows: rows.slice(0, limit), hasMore: rows.length > limit };
    },
    [q, category, limit],
    ['important_notes'],
  );
  const data = page?.rows;
  const cats = useDb(() => listNoteCategories(), [], ['important_notes']);

  return (
    <>
      <PageHeader back title="Önemli notlar" />
      <Page>
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
          <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Notlarda ara" className="h-11 pl-10" />
        </div>
        {(cats.data?.length ?? 0) > 0 && (
          <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
            <Chip active={!category} onClick={() => setCategory('')}>
              Tümü
            </Chip>
            {cats.data!.map((c) => (
              <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
                {c}
              </Chip>
            ))}
          </div>
        )}
        <div className="mt-3">
          {!data ? (
            <Spinner />
          ) : data.length === 0 ? (
            <EmptyState
              icon={StickyNote}
              title={q || category ? 'Sonuç bulunamadı' : 'Henüz not yok'}
              text={q || category ? undefined : 'Fikirlerinizi, hedeflerinizi ve hatırlamak istediğiniz bilgileri burada saklayın.'}
            />
          ) : (
            <Divided>
              {data.map((n) => (
                <div key={n.id} className="flex items-start">
                  <button onClick={() => nav.push({ name: 'note', id: n.id })} className="min-w-0 flex-1 px-4 py-3 text-left active:bg-card-2">
                    <div className="flex items-center gap-1.5">
                      {!!n.pinned && <Pin size={13} className="shrink-0 text-accent" />}
                      <span className="truncate text-[15px] font-medium">{n.title || 'Başlıksız not'}</span>
                    </div>
                    {n.content && <div className="mt-0.5 line-clamp-2 text-[14px] leading-snug text-muted">{n.content}</div>}
                    <div className="mt-1 flex gap-2 text-[12px] text-faint">
                      {n.category && <span className="text-accent">{n.category}</span>}
                      <span>{formatTimestamp(n.updated_at)}</span>
                    </div>
                  </button>
                  <IconButton icon={n.pinned ? PinOff : Pin} size={18} label={n.pinned ? 'Sabitlemeyi kaldır' : 'Sabitle'} className="mt-1.5 text-muted" onClick={() => setNotePinned(n.id, !n.pinned)} />
                </div>
              ))}
            </Divided>
          )}
          {page?.hasMore && (
            <Button variant="secondary" className="mt-3 w-full" onClick={() => setLimit((l) => l + 200)}>
              Daha fazla göster
            </Button>
          )}
        </div>
      </Page>
      <Fab label="Yeni not" onClick={() => nav.push({ name: 'note' })} />
    </>
  );
}

interface NoteDraft {
  title: string;
  content: string;
  category: string;
}

export function NoteEditor({ id: routeId }: { id?: string }) {
  const nav = useNav();
  const { toast, confirm } = useFeedback();
  const id = useMemo(() => routeId ?? uuid(), [routeId]);
  const draftKey = `ph-draft-note-${id}`;
  const [draft, setDraft] = useState<NoteDraft | null>(routeId ? null : { title: '', content: '', category: '' });
  const [meta, setMeta] = useState<{ created: string; updated: string; pinned: boolean } | null>(null);
  const [exists, setExists] = useState(!!routeId);
  const [touched, setTouched] = useState(false);
  const cats = useDb(() => listNoteCategories(), [], ['important_notes']);

  useEffect(() => {
    if (!routeId) return;
    getNote(routeId).then((n) => {
      if (!n) return void nav.pop();
      let d: NoteDraft = { title: n.title, content: n.content, category: n.category };
      const local = readDraft<NoteDraft>(draftKey);
      if (local && local.at > n.updated_at) {
        d = local.value;
        setTouched(true);
        toast('Kaydedilmemiş son değişiklikleriniz geri yüklendi.', 'info');
      }
      setDraft(d);
      setMeta({ created: n.created_at, updated: n.updated_at, pinned: !!n.pinned });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId]);

  const ref = useAutoGrow(draft?.content);
  const isEmpty = !draft || (!draft.title.trim() && !draft.content.trim());
  const { status, flush, cancel } = useAutosave({
    value: draft,
    enabled: !!draft && touched && (exists || !isEmpty),
    draftKey,
    save: async (v) => {
      if (!v) return;
      await saveNote(id, v);
      setExists(true);
    },
  });
  const update = (p: Partial<NoteDraft>) => {
    setTouched(true);
    setDraft((d) => (d ? { ...d, ...p } : d));
  };

  const close = async () => {
    if (exists && isEmpty) {
      cancel();
      await deleteNote(id).catch(() => undefined);
      return void nav.pop();
    }
    if (!(await flush()) && !(await confirm({ title: 'Kayıt başarısız', message: 'Son değişiklikler kaydedilemedi. Yine de çıkılsın mı?', confirmLabel: 'Çık' }))) return;
    nav.pop();
  };
  useBackHandler(true, close);

  const remove = async () => {
    if (!(await confirm({ title: 'Not silinsin mi?', message: 'Bu not kalıcı olarak silinecek.', confirmLabel: 'Sil', danger: true }))) return;
    try {
      setTouched(false);
      cancel();
      await deleteNote(id);
      clearDraft(draftKey);
      toast('Not silindi.');
      nav.pop();
    } catch (e) {
      toast(`Silinemedi: ${errorMessage(e)}`, 'error');
    }
  };

  const togglePin = async () => {
    await flush();
    if (!exists) return;
    const next = !meta?.pinned;
    await setNotePinned(id, next);
    setMeta((m) => (m ? { ...m, pinned: next } : { created: '', updated: '', pinned: next }));
    toast(next ? 'Not sabitlendi.' : 'Sabitleme kaldırıldı.');
  };


  const suggestions = Array.from(new Set([...(cats.data ?? []), ...NOTE_CATEGORY_SUGGESTIONS]));

  return (
    <>
      <PageHeader
        back
        title={exists ? 'Not' : 'Yeni not'}
        actions={
          <>
            <SaveIndicator status={status} />
            {exists && <IconButton icon={meta?.pinned ? PinOff : Pin} label={meta?.pinned ? 'Sabitlemeyi kaldır' : 'Sabitle'} onClick={togglePin} />}
            {exists && <IconButton icon={Trash2} label="Sil" onClick={remove} />}
          </>
        }
      />
      {!draft ? (
        <Spinner />
      ) : (
        <main className="mx-auto w-full max-w-xl px-4 pb-[calc(var(--sab)+40px)]">
          <input
            value={draft.title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="Başlık"
            maxLength={200}
            autoFocus={!routeId}
            className="w-full bg-transparent text-[22px] font-semibold outline-none placeholder:text-faint"
          />
          <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
            {suggestions.map((c) => (
              <Chip key={c} active={draft.category === c} onClick={() => update({ category: draft.category === c ? '' : c })}>
                {c}
              </Chip>
            ))}
          </div>
          <input
            value={draft.category}
            onChange={(e) => update({ category: e.target.value })}
            placeholder="Kategori / etiket (isteğe bağlı)"
            maxLength={40}
            className="mt-2 w-full bg-transparent text-[14px] text-accent outline-none placeholder:text-faint"
          />
          <textarea
            ref={ref}
            value={draft.content}
            onChange={(e) => update({ content: e.target.value })}
            placeholder="Notunuz…"
            className="mt-4 w-full resize-none bg-transparent text-[16px] leading-[1.7] outline-none placeholder:text-faint"
          />
          {meta?.created && (
            <div className="mt-6 border-t border-line pt-3 text-[12px] text-faint">
              Oluşturuldu {formatTimestamp(meta.created)} · Son düzenleme {formatTimestamp(meta.updated)}
            </div>
          )}
        </main>
      )}
    </>
  );
}
