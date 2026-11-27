import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * File export uses Android's share sheet: the file is written to the app cache and the user
 * picks where it goes (Files/Downloads, Drive, e-mail…). No storage permission is needed.
 * In the browser preview it falls back to a regular download.
 */
export async function shareFile(opts: { fileName: string; data: string; encoding: 'utf8' | 'base64'; mime: string; title: string }): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    const blob =
      opts.encoding === 'base64'
        ? new Blob([Uint8Array.from(atob(opts.data), (c) => c.charCodeAt(0))], { type: opts.mime })
        : new Blob([opts.data], { type: opts.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = opts.fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5_000);
    return;
  }
  // Previous exports were already handed to the share sheet; drop them so the cache never grows.
  await Filesystem.rmdir({ path: 'exports', directory: Directory.Cache, recursive: true }).catch(() => undefined);
  const res = await Filesystem.writeFile({
    path: `exports/${opts.fileName}`,
    data: opts.data,
    directory: Directory.Cache,
    recursive: true,
    ...(opts.encoding === 'utf8' ? { encoding: Encoding.UTF8 } : {}),
  });
  try {
    await Share.share({ title: opts.title, files: [res.uri], dialogTitle: opts.title });
  } catch (e) {
    // User closing the share sheet is not an error.
    const msg = e instanceof Error ? e.message : String(e);
    if (!/cancel/i.test(msg)) throw e;
  }
}

/** Opens the system file picker (Android document chooser via the WebView) and reads text. */
export function pickTextFile(accept = 'application/json,.json'): Promise<{ name: string; text: string } | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    let settled = false;
    input.onchange = async () => {
      settled = true;
      const file = input.files?.[0];
      input.remove();
      if (!file) return resolve(null);
      if (file.size > 100 * 1024 * 1024) return reject(new Error('Dosya çok büyük (100 MB üzeri).'));
      try {
        resolve({ name: file.name, text: await file.text() });
      } catch (e) {
        reject(e);
      }
    };
    const giveUp = () => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(null);
    };
    input.addEventListener('cancel', giveUp);
    // Older Android WebViews never fire "cancel": when the app regains focus and no file
    // arrived shortly after, treat the picker as closed so the caller is never stuck.
    const onFocus = () => {
      window.removeEventListener('focus', onFocus);
      setTimeout(() => {
        if (!input.files?.length) giveUp();
      }, 1500);
    };
    setTimeout(() => window.addEventListener('focus', onFocus), 300);
    document.body.appendChild(input);
    input.click();
  });
}

const AUTO_DIR = 'backups';
const KEEP_AUTO = 5;

/** Saves a safety copy inside private app storage (kept: last 5). Returns the file name. */
export async function saveInternalBackup(fileName: string, json: string): Promise<string> {
  if (!Capacitor.isNativePlatform()) {
    try {
      localStorage.setItem(`ph-auto-backup`, json);
    } catch {
      /* quota: ignore in browser preview */
    }
    return fileName;
  }
  await Filesystem.writeFile({ path: `${AUTO_DIR}/${fileName}`, data: json, directory: Directory.Data, encoding: Encoding.UTF8, recursive: true });
  try {
    const list = await Filesystem.readdir({ path: AUTO_DIR, directory: Directory.Data });
    const files = list.files.filter((f) => f.name.endsWith('.json')).sort((a, b) => (a.name < b.name ? 1 : -1));
    for (const f of files.slice(KEEP_AUTO)) await Filesystem.deleteFile({ path: `${AUTO_DIR}/${f.name}`, directory: Directory.Data });
  } catch {
    /* cleanup is best effort */
  }
  return fileName;
}

export async function listInternalBackups(): Promise<{ name: string; size: number; mtime: number }[]> {
  if (!Capacitor.isNativePlatform()) {
    const v = localStorage.getItem('ph-auto-backup');
    return v ? [{ name: 'otomatik-yedek.json', size: v.length, mtime: Date.now() }] : [];
  }
  try {
    const list = await Filesystem.readdir({ path: AUTO_DIR, directory: Directory.Data });
    return list.files
      .filter((f) => f.name.endsWith('.json'))
      .map((f) => ({ name: f.name, size: f.size, mtime: f.mtime }))
      .sort((a, b) => (a.name < b.name ? 1 : -1));
  } catch {
    return [];
  }
}

export async function readInternalBackup(name: string): Promise<string> {
  if (!Capacitor.isNativePlatform()) return localStorage.getItem('ph-auto-backup') ?? '';
  const r = await Filesystem.readFile({ path: `${AUTO_DIR}/${name}`, directory: Directory.Data, encoding: Encoding.UTF8 });
  return typeof r.data === 'string' ? r.data : await r.data.text();
}
