import { beforeEach, describe, expect, it } from 'vitest';
import { freshDb } from './helpers';
import { buildBackup, restoreBackup, summarizeBackup, validateBackup } from '../src/data/backup';
import { addTransaction, getBalance, getOpening, setOpening } from '../src/data/transactions';
import { createCategory, listCategories } from '../src/data/categories';
import { listDiaryEntries, saveDiaryEntry } from '../src/data/diary';
import { addReminder, listReminders } from '../src/data/reminders';
import { getMood, setMood } from '../src/data/moods';
import { getBudgetStatus, setBudget } from '../src/data/budgets';
import { listNotes, saveNote } from '../src/data/notes';
import { getSettings, setSetting } from '../src/data/settings';
import { buildExcelWorkbook } from '../src/services/excel';
import * as XLSX from 'xlsx';

async function populate() {
  const food = (await listCategories('expense')).find((c) => c.name === 'Yiyecek ve İçecek')!.id;
  const pocket = (await listCategories('income')).find((c) => c.name === 'Harçlık')!.id;
  const book = await createCategory({ name: 'Kitap', kind: 'expense', color: '#3B82F6' });
  await setOpening(500_000, '2026-11-01');
  await addTransaction('t1', { type: 'expense', amountKurus: 5_000, title: 'Kola', categoryId: food, date: '2026-11-05', description: 'soğuk' });
  await addTransaction('t2', { type: 'expense', amountKurus: 3_000, title: 'Kahve', categoryId: food, date: '2026-11-05' });
  await addTransaction('t3', { type: 'income', amountKurus: 50_000, title: 'Harçlık', categoryId: pocket, date: '2026-11-05' });
  await addTransaction('t4', { type: 'expense', amountKurus: 12_000, title: 'Roman', categoryId: book, date: '2026-10-20' });
  await saveDiaryEntry('d1', { date: '2026-11-05', title: 'Okul', content: 'Bugün okulda…', tags: ['okul', 'ders'] });
  await saveNote('n1', { title: 'Hedef', content: 'Kitap oku', category: 'Hedef' });
  await addReminder('r1', { title: 'Kitap satın al', dueDate: '2026-11-10', dueTime: '16:00' });
  await setMood('2026-11-05', 4, 'iyi');
  await setBudget(null, 200_000);
  await setBudget(food, 70_000);
  await setSetting('theme', 'light');
  await setSetting('onboarded', true);
}

describe('JSON yedekleme ve geri yükleme', () => {
  beforeEach(freshDb);

  it('yedek alınır, veriler silinir, yedek geri yüklenir: her şey aynıdır', async () => {
    await populate();
    const balanceBefore = await getBalance();
    const json = JSON.stringify(await buildBackup());

    // Replace with different data
    await freshDb();
    await addTransaction('other', { type: 'expense', amountKurus: 1, title: 'x', categoryId: (await listCategories('expense'))[0].id, date: '2026-01-01' });

    const parsed = validateBackup(JSON.parse(json));
    expect(summarizeBackup(parsed)).toMatchObject({ transactions: 4, diary: 1, notes: 1, reminders: 1, moods: 1, budgets: 2, categories: 16 });
    await restoreBackup(parsed);

    expect(await getBalance()).toBe(balanceBefore);
    expect(balanceBefore).toBe(500_000 - 5_000 - 3_000 + 50_000 - 12_000);
    expect((await getOpening())?.amountKurus).toBe(500_000);
    expect((await listDiaryEntries())[0].tags).toEqual(['okul', 'ders']);
    expect((await listNotes()).length).toBe(1);
    expect((await listReminders())[0].due_time).toBe('16:00');
    expect((await getMood('2026-11-05'))?.note).toBe('iyi');
    expect((await getBudgetStatus('2026-11-10')).length).toBe(2);
    expect((await getSettings()).theme).toBe('light');
    expect((await listCategories('expense')).some((c) => c.name === 'Kitap')).toBe(true);
  });

  it('bozuk / yanlış dosyalar reddedilir ve veritabanına dokunulmaz', async () => {
    await populate();
    const before = await getBalance();
    const good = await buildBackup();

    expect(() => validateBackup(null)).toThrow();
    expect(() => validateBackup({ hello: 'world' })).toThrow(/Koros Günce/);
    expect(() => validateBackup({ ...good, formatVersion: 99 })).toThrow(/yeni/);

    const badAmount = structuredClone(good);
    badAmount.data.transactions.find((t) => t.id === 't2')!.amount_kurus = 12.5;
    expect(() => validateBackup(badAmount)).toThrow(/amount_kurus/);

    const badCat = structuredClone(good);
    badCat.data.transactions.find((t) => t.id === 't2')!.category_id = 9999;
    expect(() => validateBackup(badCat)).toThrow(/kategori/);

    const badDate = structuredClone(good);
    badDate.data.diary_entries[0].date = '2026-13-45';
    expect(() => validateBackup(badDate)).toThrow(/tarih/);

    const dupId = structuredClone(good);
    dupId.data.transactions.push({ ...dupId.data.transactions.find((t) => t.id === 't2')! });
    expect(() => validateBackup(dupId)).toThrow(/tekrarlanan/);

    expect(await getBalance()).toBe(before);
  });

  it('geri yükleme sırasında hata olursa işlem tamamen geri alınır', async () => {
    await populate();
    const before = await getBalance();
    const b = validateBackup(JSON.parse(JSON.stringify(await buildBackup())));
    // Force a failure deep inside the restore transaction (violates CHECK constraint)
    b.data.mood_entries.push({ date: '2026-11-06', mood: 9, note: null, created_at: '2026-11-06T00:00:00Z', updated_at: '2026-11-06T00:00:00Z' });
    b.data.transactions = b.data.transactions.filter((t) => t.id !== 't2');
    await expect(restoreBackup(b)).rejects.toThrow();
    expect(await getBalance()).toBe(before);
    expect((await listNotes()).length).toBe(1);
  });
});

describe('Excel dışa aktarma', () => {
  beforeEach(freshDb);

  it('çalışma kitabı ayrı sayfalar içerir ve okunabilir', async () => {
    await populate();
    const wb = await buildExcelWorkbook('TRY');
    expect(wb.SheetNames).toEqual(['Gelirler', 'Giderler', 'Günlük Özet', 'Kategoriler', 'Aylık Rapor']);
    const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const back = XLSX.read(bytes, { type: 'array' });
    const expenses = XLSX.utils.sheet_to_json<Record<string, unknown>>(back.Sheets['Giderler']);
    expect(expenses.length).toBe(3);
    expect(expenses[0]).toMatchObject({ Tarih: '05.11.2026', Ad: 'Kahve', 'Tutar (TRY)': 30 });
    const monthly = XLSX.utils.sheet_to_json<Record<string, unknown>>(back.Sheets['Aylık Rapor']);
    expect(monthly.find((m) => m['Ay'] === 'Kasım 2026')).toMatchObject({ 'Gelir (TRY)': 500, 'Gider (TRY)': 80, 'Net (TRY)': 420 });
  });
});
