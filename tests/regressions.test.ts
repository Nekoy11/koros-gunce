import { beforeEach, describe, expect, it } from 'vitest';
import { freshDb } from './helpers';
import { addTransaction, getBalance, getBalanceAt, getPlannedTotals, setOpening } from '../src/data/transactions';
import { listCategories } from '../src/data/categories';
import { buildBackup, restoreBackup, validateBackup } from '../src/data/backup';
import { getSettings, setSetting } from '../src/data/settings';
import { getOpening } from '../src/data/transactions';
import { parseAmountAllowZero } from '../src/lib/money';

/** Regression tests for logic errors found in the second review. */
describe('İkinci inceleme düzeltmeleri', () => {
  beforeEach(freshDb);

  it('ileri tarihli işlemler mevcut bakiyeyi değiştirmez, planlanan olarak görünür', async () => {
    const food = (await listCategories('expense'))[0].id;
    const pocket = (await listCategories('income'))[0].id;
    await setOpening(500_000, '2026-11-01');
    await addTransaction('past', { type: 'expense', amountKurus: 5_000, title: 'Kola', categoryId: food, date: '2026-11-05' });
    await addTransaction('future', { type: 'expense', amountKurus: 100_000, title: 'Kira', categoryId: food, date: '2026-12-01' });
    await addTransaction('futureIn', { type: 'income', amountKurus: 20_000, title: 'Harçlık', categoryId: pocket, date: '2026-11-20' });

    expect(await getBalance('2026-11-07')).toBe(495_000);
    expect(await getPlannedTotals('2026-11-07')).toEqual({ income: 20_000, expense: 100_000, count: 2 });
    // On the day it happens, it counts.
    expect(await getBalance('2026-12-01')).toBe(495_000 + 20_000 - 100_000);
    expect(await getBalanceAt('2026-11-20')).toBe(515_000);
  });

  it('başlangıç bakiyesi 0 ve "0,00" girilebilir', () => {
    expect(parseAmountAllowZero('0')).toBe(0);
    expect(parseAmountAllowZero('0,00')).toBe(0);
    expect(parseAmountAllowZero(' 0.0 ')).toBe(0);
    expect(parseAmountAllowZero('5.000')).toBe(500_000);
    expect(parseAmountAllowZero('-1')).toBeNull();
    expect(parseAmountAllowZero('')).toBeNull();
  });

  it('kurulum tamamlanmadan alınmış yedek geri yüklenince karşılama ekranı geri gelmez', async () => {
    await setOpening(123_400, '2026-11-01');
    await setSetting('onboarded', false);
    const backup = validateBackup(JSON.parse(JSON.stringify(await buildBackup())));
    await freshDb();
    await restoreBackup(backup);
    expect((await getSettings()).onboarded).toBe(true);
    expect((await getOpening())?.amountKurus).toBe(123_400);
  });
});
