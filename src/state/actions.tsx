import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { TransactionSheet, type TxSheetOptions } from '../sheets/TransactionSheet';
import { ReminderSheet, type ReminderSheetOptions } from '../sheets/ReminderSheet';
import { MoodSheet } from '../sheets/MoodSheet';
import { OpeningSheet } from '../sheets/OpeningSheet';
import type { DateStr } from '../lib/dates';

interface ActionsValue {
  openTransaction: (o?: TxSheetOptions) => void;
  openReminder: (o?: ReminderSheetOptions) => void;
  openMood: (date: DateStr) => void;
  openOpening: () => void;
}

const ActionsContext = createContext<ActionsValue | null>(null);

/** App-wide entry/edit sheets, reachable from any screen (dashboard, calendar, search…). */
export function ActionsProvider({ children }: { children: ReactNode }) {
  const [tx, setTx] = useState<TxSheetOptions | null>(null);
  const [rem, setRem] = useState<ReminderSheetOptions | null>(null);
  const [mood, setMood] = useState<DateStr | null>(null);
  const [opening, setOpening] = useState(false);

  const openTransaction = useCallback((o: TxSheetOptions = {}) => setTx({ ...o }), []);
  const openReminder = useCallback((o: ReminderSheetOptions = {}) => setRem({ ...o }), []);
  const openMood = useCallback((d: DateStr) => setMood(d), []);
  const openOpening = useCallback(() => setOpening(true), []);

  const value = useMemo(() => ({ openTransaction, openReminder, openMood, openOpening }), [openTransaction, openReminder, openMood, openOpening]);

  return (
    <ActionsContext.Provider value={value}>
      {children}
      <TransactionSheet opts={tx} onClose={() => setTx(null)} />
      <ReminderSheet opts={rem} onClose={() => setRem(null)} />
      <MoodSheet date={mood} onClose={() => setMood(null)} />
      <OpeningSheet open={opening} onClose={() => setOpening(false)} />
    </ActionsContext.Provider>
  );
}

export function useActions(): ActionsValue {
  const v = useContext(ActionsContext);
  if (!v) throw new Error('ActionsProvider missing');
  return v;
}
