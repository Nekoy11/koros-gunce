import { useEffect, useState, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { ChevronRight, Database, Download, FileJson, FileSpreadsheet, History, Info, ShieldCheck, Trash2, Upload, Wrench } from 'lucide-react';
import { CURRENCIES, type CurrencyCode } from '../lib/money';
import { errorMessage, logError } from '../lib/log';
import { fileStamp, formatTimestamp } from '../lib/dates';
import { useSettings } from '../state/settings';
import { useDb } from '../state/useDb';
import { useNav } from '../state/nav';
import { checkIntegrity, getDbStats, optimizeDatabase, wipeAllData } from '../data/maintenance';
import { buildBackup } from '../data/backup';
import { exportExcelReport, exportJsonBackup, loadInternalBackup, parseBackupText, restoreFromBackup } from '../services/backupService';
import { listInternalBackups, pickTextFile, saveInternalBackup } from '../services/files';
import { getPermissionState, requestPermission, resyncNotifications, type PermissionState } from '../services/notifications';
import { Page, PageHeader } from '../ui/layout';
import { Chip, Divided, Segmented, SectionTitle, Toggle, cx } from '../ui/primitives';
import { useFeedback } from '../ui/feedback';
import type { BackupFile } from '../data/backup';

const TABLE_LABELS: Record<string, string> = {
  transactions: 'Finansal işlemler',
  categories: 'Kategoriler',
  diary_entries: 'Günlük kayıtları',
  important_notes: 'Önemli notlar',
  reminders: 'Hatırlatmalar',
  mood_entries: 'Ruh hâli kayıtları',
  budget_goals: 'Bütçe hedefleri',
};

function Row({ icon: Icon, title, subtitle, onClick, right, danger, busy }: { icon: typeof Info; title: string; subtitle?: string; onClick?: () => void; right?: ReactNode; danger?: boolean; busy?: boolean }) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp onClick={busy ? undefined : onClick} className={cx('flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left', onClick && 'active:bg-card-2', busy && 'opacity-50')}>
      <Icon size={20} className={danger ? 'text-neg' : 'text-muted'} />
      <div className="min-w-0 flex-1">
        <div className={cx('text-[15px]', danger && 'text-neg')}>{title}</div>
        {subtitle && <div className="text-[13px] text-muted">{subtitle}</div>}
      </div>
      {right ?? (onClick ? <ChevronRight size={18} className="text-faint" /> : null)}
    </Comp>
  );
}

export function Settings() {
  const { settings, update } = useSettings();
  const { toast, confirm } = useFeedback();
  const nav = useNav();
  const [busy, setBusy] = useState<string | null>(null);
  const [perm, setPerm] = useState<PermissionState>('unsupported');
  const stats = useDb(() => getDbStats(), []);
  const autoBackups = useDb(() => listInternalBackups(), [busy]);

  useEffect(() => {
    getPermissionState().then(setPerm);
  }, []);

  const run = async (key: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      logError(key, e);
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  const confirmAndRestore = async (backup: BackupFile, summary: ReturnType<typeof parseBackupText>['summary'], source: string) => {
    const ok = await confirm({
      title: 'Yedek geri yüklensin mi?',
      message: (
        <>
          <p>
            {source}
            {backup.exportedAt && ` (${formatTimestamp(backup.exportedAt)})`}
          </p>
          <p className="mt-2">
            {summary.transactions} işlem, {summary.diary} günlük, {summary.notes} not, {summary.reminders} hatırlatma, {summary.moods} ruh hâli, {summary.budgets} bütçe hedefi.
          </p>
          <p className="mt-2 text-warn">Mevcut tüm verilerin yerini alacak. Geri yüklemeden önce mevcut verilerin otomatik bir güvenlik yedeği alınır.</p>
        </>
      ),
      confirmLabel: 'Geri yükle',
      danger: true,
    });
    if (!ok) return;
    const safety = await restoreFromBackup(backup);
    toast(`Geri yükleme tamamlandı. Önceki veriler “${safety}” olarak saklandı.`);
  };

  const importJson = () =>
    run('import', async () => {
      const file = await pickTextFile();
      if (!file) return;
      const { backup, summary } = parseBackupText(file.text);
      await confirmAndRestore(backup, summary, file.name);
    });

  const wipe = () =>
    run('wipe', async () => {
      const ok = await confirm({
        title: 'Tüm veriler silinsin mi?',
        message: 'Bütün işlemler, günlükler, notlar, hatırlatmalar, ruh hâli kayıtları, bütçeler ve ayarlar kalıcı olarak silinir. Silmeden önce cihaz içine bir güvenlik yedeği alınır.',
        confirmLabel: 'Hepsini sil',
        danger: true,
        typeToConfirm: 'SİL',
      });
      if (!ok) return;
      await saveInternalBackup(`silme-oncesi_${fileStamp()}.json`, JSON.stringify(await buildBackup()));
      await wipeAllData();
      await resyncNotifications();
      toast('Tüm veriler silindi.');
      nav.setTab('home');
    });

  return (
    <>
      <PageHeader back title="Ayarlar" />
      <Page>
        <SectionTitle title="Görünüm" />
        <div className="rounded-2xl border border-line bg-card p-4">
          <div className="mb-2 text-[13px] text-muted">Tema</div>
          <Segmented
            value={settings.theme}
            onChange={(v) => update('theme', v)}
            options={[
              { value: 'dark', label: 'Koyu' },
              { value: 'light', label: 'Açık' },
            ]}
          />
          <div className="mb-2 mt-4 text-[13px] text-muted">Para birimi</div>
          <div className="flex flex-wrap gap-2">
            {CURRENCIES.map((c) => (
              <Chip key={c.code} active={settings.currency === c.code} onClick={() => update('currency', c.code as CurrencyCode)}>
                {c.symbol} {c.label}
              </Chip>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-faint">Para birimi yalnızca gösterimi değiştirir; kur dönüşümü yapılmaz.</p>
        </div>

        <SectionTitle title="Bildirimler ve bütçe" />
        <Divided>
          <Row
            icon={Info}
            title="Hatırlatma bildirimleri"
            subtitle={perm === 'unsupported' ? 'Yalnızca Android uygulamasında çalışır' : perm === 'granted' ? 'İzin verildi' : perm === 'denied' ? 'İzin reddedildi · Android ayarlarından açın' : 'İzin henüz istenmedi'}
            right={
              <Toggle
                checked={settings.notificationsEnabled}
                label="Hatırlatma bildirimleri"
                onChange={async (v) => {
                  await update('notificationsEnabled', v);
                  if (v && perm === 'prompt') setPerm(await requestPermission());
                  await resyncNotifications();
                }}
              />
            }
          />
          <div className="px-4 py-3">
            <div className="mb-2 text-[15px]">Bütçe uyarı eşiği</div>
            <Segmented
              value={String(settings.budgetWarnPercent)}
              onChange={(v) => update('budgetWarnPercent', Number(v))}
              options={['70', '80', '90'].map((v) => ({ value: v, label: `%${v}` }))}
            />
          </div>
        </Divided>

        <SectionTitle title="Yedekleme ve geri yükleme" />
        <Divided>
          <Row icon={FileJson} title="JSON yedeği al" subtitle="Tüm veriler · Dosyalar, Drive vb. konuma kaydedin" onClick={() => run('json', exportJsonBackup)} busy={busy === 'json'} right={<Download size={18} className="text-faint" />} />
          <Row icon={Upload} title="Yedekten geri yükle" subtitle="JSON yedek dosyası seçin · dosya önce doğrulanır" onClick={importJson} busy={busy === 'import'} />
          <Row icon={FileSpreadsheet} title="Excel'e aktar" subtitle="Gelirler, giderler, günlük özet, kategoriler, aylık rapor" onClick={() => run('xlsx', () => exportExcelReport(settings.currency))} busy={busy === 'xlsx'} right={<Download size={18} className="text-faint" />} />
        </Divided>
        {(autoBackups.data?.length ?? 0) > 0 && (
          <>
            <div className="mb-1.5 mt-4 px-1 text-[12px] text-muted">Otomatik güvenlik yedekleri (geri yükleme / silme öncesi, son 5)</div>
            <Divided>
              {autoBackups.data!.map((b) => (
                <Row
                  key={b.name}
                  icon={History}
                  title={b.name.replace(/\.json$/, '')}
                  subtitle={`${Math.max(1, Math.round(b.size / 1024))} KB`}
                  onClick={() =>
                    run('auto', async () => {
                      const { backup, summary } = await loadInternalBackup(b.name);
                      await confirmAndRestore(backup, summary, b.name);
                    })
                  }
                />
              ))}
            </Divided>
          </>
        )}

        <SectionTitle title="Veritabanı" />
        <Divided>
          <div className="px-4 py-3">
            <div className="flex items-center gap-3">
              <Database size={20} className="text-muted" />
              <div className="text-[15px]">Kayıtlar</div>
              <div className="ml-auto text-[12px] text-faint">Şema v{stats.data?.schemaVersion ?? '–'}</div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 pl-8 text-[13px]">
              {stats.data &&
                Object.entries(stats.data.counts).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <span className="truncate text-muted">{TABLE_LABELS[k] ?? k}</span>
                    <span className="tabular">{v}</span>
                  </div>
                ))}
            </div>
          </div>
          <Row
            icon={ShieldCheck}
            title="Bütünlük kontrolü"
            subtitle="Veritabanı dosyasını ve ilişkileri doğrular"
            busy={busy === 'check'}
            onClick={() =>
              run('check', async () => {
                const r = await checkIntegrity();
                toast(r.message, r.ok ? 'success' : 'error');
              })
            }
          />
          <Row
            icon={Wrench}
            title="Optimize et"
            subtitle="Boş alanı geri kazanır, sorguları hızlandırır"
            busy={busy === 'opt'}
            onClick={() =>
              run('opt', async () => {
                await optimizeDatabase();
                toast('Veritabanı optimize edildi.');
              })
            }
          />
          <Row icon={Trash2} title="Bütün verileri sil" subtitle="Geri alınamaz · onay gerekir" danger onClick={wipe} busy={busy === 'wipe'} />
        </Divided>

        <SectionTitle title="Uygulama hakkında" />
        <div className="rounded-2xl border border-line bg-card p-4 text-[14px] leading-relaxed">
          <div className="flex items-baseline justify-between">
            <span className="font-semibold">Koros Günce</span>
            <span className="text-muted">Sürüm {__APP_VERSION__}</span>
          </div>
          <p className="mt-2 text-muted">
            Kişisel yaşam ve finans yönetimi. Tüm veriler yalnızca bu cihazdaki yerel SQLite veritabanında saklanır; hiçbir sunucuya gönderilmez, uygulamanın internet izni yoktur.
          </p>
          <p className="mt-2 text-[12px] text-faint">Platform: {Capacitor.getPlatform()} · Tutarlar kuruş hassasiyetinde saklanır.</p>
        </div>
      </Page>
    </>
  );
}
