import { AlarmClock, BarChart3, ChevronRight, Search, Settings, Smile, StickyNote, Tags, Target } from 'lucide-react';
import { useNav, type Route } from '../state/nav';
import { Page, PageHeader } from '../ui/layout';
import { Divided } from '../ui/primitives';

const ITEMS: { route: Route; label: string; desc: string; icon: typeof Search }[] = [
  { route: { name: 'stats' }, label: 'İstatistikler', desc: 'Grafikler, raporlar ve analizler', icon: BarChart3 },
  { route: { name: 'budget' }, label: 'Bütçe hedefleri', desc: 'Aylık ve kategori limitleri', icon: Target },
  { route: { name: 'notes' }, label: 'Önemli notlar', desc: 'Fikirler, hedefler, bilgiler', icon: StickyNote },
  { route: { name: 'reminders' }, label: 'Hatırlatmalar', desc: 'Görevler ve bildirimler', icon: AlarmClock },
  { route: { name: 'mood' }, label: 'Ruh hâli', desc: 'Günlük ruh hâli geçmişi', icon: Smile },
  { route: { name: 'search' }, label: 'Ara', desc: 'Tüm kayıtlarda arama', icon: Search },
  { route: { name: 'categories' }, label: 'Kategoriler', desc: 'Gelir ve gider kategorileri', icon: Tags },
  { route: { name: 'settings' }, label: 'Ayarlar', desc: 'Tema, yedekleme, veriler', icon: Settings },
];

export function More() {
  const nav = useNav();
  return (
    <>
      <PageHeader title="Daha fazla" />
      <Page>
        <Divided>
          {ITEMS.map((i) => (
            <button key={i.label} onClick={() => nav.push(i.route)} className="flex min-h-16 w-full items-center gap-3.5 px-4 text-left active:bg-card-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <i.icon size={19} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-medium">{i.label}</div>
                <div className="truncate text-[13px] text-muted">{i.desc}</div>
              </div>
              <ChevronRight size={18} className="text-faint" />
            </button>
          ))}
        </Divided>
      </Page>
    </>
  );
}
