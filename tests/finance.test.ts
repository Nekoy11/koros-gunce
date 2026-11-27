import { beforeEach, describe, expect, it } from 'vitest';
import { freshDb } from './helpers';
import {
  addTransaction,
  deleteTransaction,
  getBalance,
  getBalanceAt,
  getCategoryTotals,
  getDailyTotals,
  getOpening,
  getTotals,
  listTransactions,
  setOpening,
  updateTransaction,
} from '../src/data/transactions';
import { createCategory, deleteCategory, getFallbackCategory, listCategories } from '../src/data/categories';
import { getBudgetStatus, setBudget } from '../src/data/budgets';
import { parseAmountToKurus } from '../src/lib/money';

async function cat(kind: 'expense' | 'income', name: string) {
  const c = (await listCategories(kind)).find((x) => x.name === name);
  if (!c) throw new Error('missing category ' + name);
  return c.id;
}

describe('Finans — zorunlu senaryo', () => {
  beforeEach(freshDb);

  it('5.000 → −50 → −30 = 4.920 → +500 = 5.420, düzenleme ve silme', async () => {
    const food = await cat('expense', 'Yiyecek ve İçecek');
    const pocket = await cat('income', 'Harçlık');

    await setOpening(parseAmountToKurus('5.000')!, '2026-11-01');
    expect(await getBalance()).toBe(500_000);

    await addTransaction('t1', { type: 'expense', amountKurus: parseAmountToKurus('50')!, title: 'Kola', categoryId: food, date: '2026-11-05' });
    await addTransaction('t2', { type: 'expense', amountKurus: parseAmountToKurus('30')!, title: 'Kahve', categoryId: food, date: '2026-11-05' });
    expect(await getBalance()).toBe(492_000); // 4.920 TL

    await addTransaction('t3', { type: 'income', amountKurus: parseAmountToKurus('500')!, title: 'Harçlık', categoryId: pocket, date: '2026-11-05' });
    expect(await getBalance()).toBe(542_000); // 5.420 TL

    // Edit an older expense: 50 → 45,50 and move it to an earlier date
    await updateTransaction('t1', { type: 'expense', amountKurus: parseAmountToKurus('45,50')!, title: 'Kola', categoryId: food, date: '2026-11-02' });
    expect(await getBalance()).toBe(542_450);
    expect(await getBalanceAt('2026-11-02')).toBe(500_000 - 4_550);

    // Delete
    await deleteTransaction('t2');
    expect(await getBalance()).toBe(545_450);
    expect((await listTransactions()).length).toBe(2);
  });

  it('aynı işlem (aynı id) iki defa kaydedilmez', async () => {
    const food = await cat('expense', 'Yiyecek ve İçecek');
    const input = { type: 'expense' as const, amountKurus: 3000, title: 'Kahve', categoryId: food, date: '2026-11-05' };
    expect((await addTransaction('dup', input)).created).toBe(true);
    expect((await addTransaction('dup', input)).created).toBe(false);
    expect((await listTransactions()).length).toBe(1);
  });

  it('kuruş hassasiyeti: 0,1 + 0,2 kayan nokta hatası olmadan', async () => {
    const food = await cat('expense', 'Yiyecek ve İçecek');
    await setOpening(0);
    for (let i = 0; i < 1000; i++) {
      await addTransaction(`k${i}`, { type: 'expense', amountKurus: i % 2 ? 10 : 20, title: 'x', categoryId: food, date: '2026-11-05' });
    }
    expect(await getBalance()).toBe(-15_000); // negatif bakiyeye izin verilir
  });

  it('başlangıç bakiyesi düzenlenince diğer işlemler bozulmaz', async () => {
    const food = await cat('expense', 'Yiyecek ve İçecek');
    await setOpening(500_000, '2026-11-01');
    await addTransaction('a', { type: 'expense', amountKurus: 8_300, title: 'Toka', categoryId: food, date: '2026-11-05' });
    await setOpening(600_000, '2026-11-01');
    expect((await getOpening())?.amountKurus).toBe(600_000);
    expect(await getBalance()).toBe(591_700);
    expect((await listTransactions()).length).toBe(1);
  });

  it('günlük özet, kategori dağılımı ve filtreler', async () => {
    const food = await cat('expense', 'Yiyecek ve İçecek');
    const transport = await cat('expense', 'Ulaşım');
    await addTransaction('1', { type: 'expense', amountKurus: 5_000, title: 'Kola', categoryId: food, date: '2026-11-05' });
    await addTransaction('2', { type: 'expense', amountKurus: 3_000, title: 'Kahve', categoryId: food, date: '2026-11-05' });
    await addTransaction('3', { type: 'expense', amountKurus: 300, title: 'Toka', categoryId: food, date: '2026-11-05' });
    await addTransaction('4', { type: 'expense', amountKurus: 2_500, title: 'Ulaşım', categoryId: transport, date: '2026-11-06' });

    const daily = await getDailyTotals('2026-11-05', '2026-11-05');
    expect(daily[0].expense).toBe(8_300); // 83 TL

    const cats = await getCategoryTotals('2026-11-01', '2026-11-30');
    expect(cats[0]).toMatchObject({ name: 'Yiyecek ve İçecek', total: 8_300 });

    expect((await listTransactions({ minKurus: 2_500, maxKurus: 3_000 })).map((t) => t.id).sort()).toEqual(['2', '4']);
    expect((await listTransactions({ categoryId: transport })).length).toBe(1);
    expect((await listTransactions({ search: 'KAHVE' })).length).toBe(1);
    expect((await getTotals('2026-11-01', '2026-11-30')).expense).toBe(10_800);
  });

  it('kategori silinince işlemler "Diğer"e taşınır', async () => {
    const id = await createCategory({ name: 'Kitap', kind: 'expense', color: '#3B82F6' });
    await addTransaction('b1', { type: 'expense', amountKurus: 10_000, title: 'Roman', categoryId: id, date: '2026-11-05' });
    await deleteCategory(id);
    const other = await getFallbackCategory('expense');
    const [t] = await listTransactions();
    expect(t.category_id).toBe(other.id);
    expect(await getBalance()).toBe(-10_000);
    await expect(deleteCategory(other.id)).rejects.toThrow();
  });

  it('gider, gelir kategorisiyle kaydedilemez', async () => {
    const pocket = await cat('income', 'Harçlık');
    await expect(addTransaction('x', { type: 'expense', amountKurus: 100, title: 'x', categoryId: pocket, date: '2026-11-05' })).rejects.toThrow();
  });

  it('bütçe hedefleri: uyarı ve aşım', async () => {
    const food = await cat('expense', 'Yiyecek ve İçecek');
    await setBudget(null, 200_000);
    await setBudget(food, 70_000);
    await addTransaction('f1', { type: 'expense', amountKurus: 60_000, title: 'Market', categoryId: food, date: '2026-11-03' });
    let s = await getBudgetStatus('2026-11-10');
    expect(s[0]).toMatchObject({ categoryId: null, spent: 60_000, state: 'ok' });
    expect(s[1]).toMatchObject({ categoryId: food, spent: 60_000, state: 'warning', percent: 85 });
    await addTransaction('f2', { type: 'expense', amountKurus: 20_000, title: 'Restoran', categoryId: food, date: '2026-11-04' });
    s = await getBudgetStatus('2026-11-10');
    expect(s[1].state).toBe('over');
    expect(s[1].remaining).toBe(-10_000);
    // Previous month's spending does not count
    expect((await getBudgetStatus('2026-12-10'))[1].spent).toBe(0);
  });
});

describe('Tutar ayrıştırma', () => {
  it.each([
    ['50', 5_000],
    ['50,5', 5_050],
    ['50,05', 5_005],
    ['1.250,75', 125_075],
    ['1250.75', 125_075],
    ['1.250', 125_000],
    ['5.000', 500_000],
    ['12.5', 1_250],
    ['1,250.75', 125_075],
    ['3 TL', 300],
    [' 1 000 ', 100_000],
  ])('%s → %i kuruş', (input, expected) => {
    expect(parseAmountToKurus(input)).toBe(expected);
  });

  it.each(['', '0', 'abc', '-5', '1,234,5', '10,999', '1e5'])('%s geçersiz', (input) => {
    expect(parseAmountToKurus(input)).toBeNull();
  });
});
