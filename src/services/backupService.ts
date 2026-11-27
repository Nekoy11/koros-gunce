import { buildBackup, restoreBackup, summarizeBackup, validateBackup, type BackupFile } from '../data/backup';
import { fileStamp } from '../lib/dates';
import type { CurrencyCode } from '../lib/money';
import { buildExcelWorkbook, workbookToBase64 } from './excel';
import { readInternalBackup, saveInternalBackup, shareFile } from './files';
import { resyncNotifications } from './notifications';

export async function exportJsonBackup(): Promise<void> {
  const backup = await buildBackup();
  await shareFile({
    fileName: `koros-gunce-yedek_${fileStamp()}.json`,
    data: JSON.stringify(backup, null, 1),
    encoding: 'utf8',
    mime: 'application/json',
    title: 'Koros Günce yedeği',
  });
}

export async function exportExcelReport(currency: CurrencyCode): Promise<void> {
  const wb = await buildExcelWorkbook(currency);
  await shareFile({
    fileName: `koros-gunce-finans_${fileStamp()}.xlsx`,
    data: workbookToBase64(wb),
    encoding: 'base64',
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    title: 'Koros Günce finans raporu',
  });
}

/** Parses + validates file text. Throws a user-readable error; never touches the database. */
export function parseBackupText(text: string): { backup: BackupFile; summary: ReturnType<typeof summarizeBackup> } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('Dosya okunamadı: geçerli bir JSON dosyası değil.');
  }
  const backup = validateBackup(json);
  return { backup, summary: summarizeBackup(backup) };
}

/**
 * Restore flow: 1) safety copy of current data into private storage, 2) atomic restore,
 * 3) reschedule notifications. If step 2 fails the database is unchanged.
 */
export async function restoreFromBackup(backup: BackupFile): Promise<string> {
  const current = await buildBackup();
  const safetyName = await saveInternalBackup(`geri-yukleme-oncesi_${fileStamp()}.json`, JSON.stringify(current));
  await restoreBackup(backup);
  await resyncNotifications().catch(() => undefined);
  return safetyName;
}

export async function loadInternalBackup(name: string) {
  return parseBackupText(await readInternalBackup(name));
}
