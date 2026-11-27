import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { DateStr } from '../lib/dates';

export type TabName = 'home' | 'finance' | 'diary' | 'calendar' | 'more';

export type Route =
  | { name: TabName }
  | { name: 'stats' }
  | { name: 'budget' }
  | { name: 'notes' }
  | { name: 'note'; id?: string }
  | { name: 'reminders'; focusId?: string }
  | { name: 'mood' }
  | { name: 'search' }
  | { name: 'settings' }
  | { name: 'categories' }
  | { name: 'diary-entry'; id?: string; date?: DateStr }
  | { name: 'day'; date: DateStr };

/** A screen on the stack. `key` is unique per push so a new screen never reuses an old one's state. */
export interface StackEntry {
  key: number;
  route: Route;
}

interface NavValue {
  tab: TabName;
  stack: StackEntry[];
  current: Route;
  setTab: (t: TabName) => void;
  push: (r: Route) => void;
  pop: () => boolean;
  /** Replaces the top screen's route in place (same key: keeps scroll, e.g. day-to-day paging). */
  replace: (r: Route) => void;
}

const NavContext = createContext<NavValue | null>(null);

let nextKey = 1;
const entry = (route: Route): StackEntry => ({ key: nextKey++, route });

export function NavProvider({ children }: { children: ReactNode }) {
  const [tab, setTabState] = useState<TabName>('home');
  const [stack, setStack] = useState<StackEntry[]>(() => [entry({ name: 'home' })]);
  const stackRef = useRef(stack);
  stackRef.current = stack;

  const setTab = useCallback((t: TabName) => {
    setTabState(t);
    setStack([entry({ name: t })]);
  }, []);

  const push = useCallback((r: Route) => setStack((s) => [...s, entry(r)]), []);
  const replace = useCallback((r: Route) => setStack((s) => [...s.slice(0, -1), { key: s[s.length - 1].key, route: r }]), []);

  const pop = useCallback((): boolean => {
    if (stackRef.current.length <= 1) return false;
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
    return true;
  }, []);

  const value = useMemo<NavValue>(
    () => ({ tab, stack, current: stack[stack.length - 1].route, setTab, push, pop, replace }),
    [tab, stack, setTab, push, pop, replace],
  );
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav(): NavValue {
  const v = useContext(NavContext);
  if (!v) throw new Error('NavProvider missing');
  return v;
}
