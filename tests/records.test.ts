import { beforeEach, describe, expect, it } from 'vitest';
import { freshDb, persistentDb, reopenDb } from './helpers';
import { deleteDiaryEntry, getDiaryEntry, listDiaryEntries, saveDiaryEntry } from '../src/data/diary';
import { listNotes, saveNote, setNotePinned } from '../src/data/notes';
import { addReminder, isOverdue, listReminders, setReminderCompleted, updateReminder } from '../src/data/reminders';
import { getMood, getMoodDistribution, setMood } from '../src/data/moods';
import { searchAll } from '../src/data/search';
import { addTransaction, getBalance, setOpening } from '../src/data/transactions';
import { listCategories } from '../src/data/categories';
import { getSettings, setSetting } from '../src/data/settings';
import { checkIntegrity, getDbStats, wipeAllData } from '../src/data/maintenance';
import { LATEST_SCHEMA_VERSION } from '../src/db/migrations';

describe('Günlük', () => {
  beforeEach(freshDb);

  it('aynı tarihte birden fazla kayıt, otomatik kayıt (upsert), düzenleme ve silme', async () => {
    await saveDiaryEntry('d1', { date: '2026-11-05', title: 'Okul', content: 'Bugün okulda…', tags: ['okul'] });
    await saveDiaryEntry('d2', { date: '2026-11-05', title: 'Spor', content: 'Antrenmanda…', tags: [] });
    await saveDiaryEntry('d3', { date: '2026-11-05', title: 'Kişisel düşünceler', content: 'Bugün düşündüğüm…', tags: [] });
    expect((await listDiaryEntries({ date: '2026-11-05' })).length).toBe(3);

    // Autosave calls repeatedly with the same id → still one row, latest content
    for (let i = 0; i < 5; i++) await saveDiaryEntry('d1', { date: '2026-11-05', title: 'Okul', content: 'Bugün okulda ' + i, tags: ['okul'] });
    expect((await listDiaryEntries()).length).toBe(3);
    expect((await getDiaryEntry('d1'))?.content).toBe('Bugün okulda 4');

    // Date change
    await saveDiaryEntry('d2', { date: '2026-11-04', title: 'Spor', content: 'Antrenmanda…', tags: [] });
    expect((await listDiaryEntries({ date: '2026-11-04' })).length).toBe(1);

    await deleteDiaryEntry('d3');
    expect((await listDiaryEntries()).length).toBe(2);
    expect((await listDiaryEntries({ search: 'OKUL' })).length).toBe(1);
  });
});

describe('Kalıcılık', () => {
  it('uygulama kapatılıp açıldığında kayıtlar korunur', async () => {
    const db = await persistentDb();
    const food = (await listCategories('expense'))[0].id;
    await setOpening(500_000);
    await addTransaction('p1', { type: 'expense', amountKurus: 5_000, title: 'Kola', categoryId: food, date: '2026-11-05' });
    await saveDiaryEntry('pd', { date: '2026-11-05', title: 'Gün', content: 'İçerik', tags: [] });
    await setSetting('theme', 'light');

    await reopenDb(db.snapshot());
    expect(await getBalance()).toBe(495_000);
    expect((await getDiaryEntry('pd'))?.content).toBe('İçerik');
    expect((await getSettings()).theme).toBe('light');
    // Seed does not duplicate categories on restart
    expect((await listCategories()).length).toBe(15);
  });
});

describe('Notlar, hatırlatmalar, ruh hâli, arama', () => {
  beforeEach(freshDb);

  it('önemli notlar: sabitleme sırayı değiştirir', async () => {
    await saveNote('n1', { title: 'Fikir A', content: 'x', category: 'Fikir' });
    await saveNote('n2', { title: 'Hedef B', content: 'y', category: 'Hedef' });
    await setNotePinned('n1', true);
    const notes = await listNotes();
    expect(notes[0].id).toBe('n1');
    expect((await listNotes({ category: 'Hedef' })).length).toBe(1);
  });

  it('hatırlatmalar: benzersiz bildirim id, sıralama, tamamlama, gecikme', async () => {
    const a = await addReminder('r1', { title: 'Kitap satın al', dueDate: '2026-11-10', dueTime: '16:00' });
    const b = await addReminder('r2', { title: 'Fatura', dueDate: '2026-11-08' });
    await addReminder('r1', { title: 'Kitap satın al', dueDate: '2026-11-10', dueTime: '16:00' }); // idempotent
    expect(a.notification_id).not.toBe(b.notification_id);
    const open = await listReminders({ completed: false });
    expect(open.map((r) => r.id)).toEqual(['r2', 'r1']);
    await setReminderCompleted('r2', true);
    expect((await listReminders({ completed: false })).length).toBe(1);
    expect((await listReminders({ completed: true }))[0].completed_at).toBeTruthy();
    const upd = await updateReminder('r1', { title: 'Kitap al', dueDate: '2026-11-01', dueTime: '10:00' });
    expect(isOverdue(upd, new Date(2026, 10, 2))).toBe(true);
    expect(isOverdue(upd, new Date(2026, 10, 1, 9, 0))).toBe(false);
    await expect(addReminder('bad', { title: 'x', dueDate: '2026-11-01', dueTime: '25:00' })).rejects.toThrow();
  });

  it('ruh hâli: günde tek kayıt, düzenlenebilir', async () => {
    await setMood('2026-11-05', 4, 'iyi gün');
    await setMood('2026-11-05', 2);
    expect((await getMood('2026-11-05'))?.mood).toBe(2);
    await setMood('2026-11-06', 5);
    expect(await getMoodDistribution('2026-11-01', '2026-11-30')).toEqual([
      { mood: 5, n: 1 },
      { mood: 2, n: 1 },
    ]);
    await expect(setMood('2026-11-07', 7)).rejects.toThrow();
  });

  it('genel arama: Türkçe karakter ve büyük/küçük harf duyarsız', async () => {
    const food = (await listCategories('expense'))[0].id;
    await addTransaction('s1', { type: 'expense', amountKurus: 2_000, title: 'Süt', categoryId: food, date: '2026-11-05' });
    await saveDiaryEntry('s2', { date: '2026-11-05', title: 'IŞIK', content: 'Şehir ışıkları çok güzeldi', tags: [] });
    await saveNote('s3', { title: 'İstanbul planı', content: 'Gezi', category: '' });
    await addReminder('s4', { title: 'Çiçek sula', dueDate: '2026-11-07' });

    expect((await searchAll('sut')).map((r) => r.kind)).toEqual(['expense']);
    expect((await searchAll('SÜT')).length).toBe(1);
    expect((await searchAll('ışık')).map((r) => r.id)).toEqual(['s2']);
    expect((await searchAll('isik')).map((r) => r.id)).toEqual(['s2']);
    expect((await searchAll('istanbul')).map((r) => r.id)).toEqual(['s3']);
    expect((await searchAll('İSTANBUL')).map((r) => r.id)).toEqual(['s3']);
    expect((await searchAll('cicek')).map((r) => r.kind)).toEqual(['reminder']);
    expect(await searchAll('100%')).toEqual([]);
  });
});

describe('Veritabanı yönetimi', () => {
  beforeEach(freshDb);

  it('şema sürümü, bütünlük ve tüm verileri silme', async () => {
    const stats = await getDbStats();
    expect(stats.schemaVersion).toBe(LATEST_SCHEMA_VERSION);
    expect((await checkIntegrity()).ok).toBe(true);
    await setOpening(100);
    await saveNote('x', { title: 't', content: 'c', category: '' });
    await wipeAllData();
    const after = await getDbStats();
    expect(after.counts.transactions).toBe(0);
    expect(after.counts.important_notes).toBe(0);
    expect(after.counts.categories).toBe(15);
  });
});
