import { memo, useEffect, useRef, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import type { AppSettings } from './data/settings';
import { SettingsProvider, useSettings } from './state/settings';
import { NavProvider, useNav, type Route, type StackEntry } from './state/nav';
import { haptic } from './lib/motion';
import { ActionsProvider } from './state/actions';
import { runBackHandlers } from './state/back';
import { ALL_TABLES, emitDataChanged } from './state/dataEvents';
import { todayStr } from './lib/dates';
import { FeedbackProvider } from './ui/feedback';
import { BottomNav } from './ui/layout';
import { cx } from './ui/primitives';
import { ensureChannel, onNotificationTap, resyncNotifications } from './services/notifications';
import { Dashboard } from './screens/Dashboard';
import { Finance } from './screens/Finance';
import { Diary } from './screens/Diary';
import { DiaryEntryScreen } from './screens/DiaryEntry';
import { Calendar } from './screens/Calendar';
import { DayDetail } from './screens/DayDetail';
import { More } from './screens/More';
import { Stats } from './screens/Stats';
import { Budget } from './screens/Budget';
import { Notes, NoteEditor } from './screens/Notes';
import { Reminders } from './screens/Reminders';
import { Mood } from './screens/Mood';
import { Search } from './screens/Search';
import { Settings } from './screens/Settings';
import { Categories } from './screens/Categories';
import { Onboarding } from './screens/Onboarding';

function renderRoute(r: Route) {
  switch (r.name) {
    case 'home':
      return <Dashboard />;
    case 'finance':
      return <Finance />;
    case 'diary':
      return <Diary />;
    case 'calendar':
      return <Calendar />;
    case 'more':
      return <More />;
    case 'stats':
      return <Stats />;
    case 'budget':
      return <Budget />;
    case 'notes':
      return <Notes />;
    case 'note':
      return <NoteEditor id={r.id} />;
    case 'reminders':
      return <Reminders focusId={r.focusId} />;
    case 'mood':
      return <Mood />;
    case 'search':
      return <Search />;
    case 'settings':
      return <Settings />;
    case 'categories':
      return <Categories />;
    case 'diary-entry':
      return <DiaryEntryScreen id={r.id} date={r.date} />;
    case 'day':
      return <DayDetail date={r.date} />;
  }
}

/** Screens only re-render when their own route changes (or their own hooks fire), not on every stack change. */
const Screen = memo(function Screen({ route }: { route: Route }) {
  return renderRoute(route);
});

const EDITORS = new Set(['diary-entry', 'note']);

function Shell() {
  const nav = useNav();
  const navRef = useRef(nav);
  navRef.current = nav;
  const [keyboard, setKeyboard] = useState(false);

  // Android hardware back: sheets/dialogs/editors first, then the screen stack, then home, then exit.
  // Registered once (reads nav through a ref) so a fast press can never hit two listeners.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const sub = CapApp.addListener('backButton', () => {
      const n = navRef.current;
      if (runBackHandlers()) return;
      if (n.pop()) return;
      if (n.tab !== 'home') return n.setTab('home');
      CapApp.exitApp();
    });
    return () => {
      sub.then((h) => h.remove());
    };
  }, []);

  // If the app stays open past midnight (or resumes on a later day), "today" changes:
  // refresh every screen so dashboard totals, overdue reminders and the calendar are correct.
  useEffect(() => {
    let day = todayStr();
    const check = () => {
      const now = todayStr();
      if (now !== day) {
        day = now;
        emitDataChanged(ALL_TABLES);
      }
    };
    const onVisible = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(check, 60_000);
    const sub = Capacitor.isNativePlatform() ? CapApp.addListener('resume', check) : null;
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
      sub?.then((h) => h.remove());
    };
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const a = Keyboard.addListener('keyboardWillShow', () => setKeyboard(true));
    const b = Keyboard.addListener('keyboardWillHide', () => setKeyboard(false));
    return () => {
      a.then((h) => h.remove());
      b.then((h) => h.remove());
    };
  }, []);

  useEffect(() => {
    ensureChannel().then(resyncNotifications);
    return onNotificationTap((id) => nav.push({ name: 'reminders', focusId: id ?? undefined }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const top = nav.current;
  const hideNav = keyboard || EDITORS.has(top.name);
  const { layers } = useScreenTransitions(nav.stack);

  return (
    <>
      {/* Each stack layer keeps its own scroll position and state while covered.
          The outer div is animated; the inner one scrolls. Keeping them separate means
          position:fixed children (FAB) anchor to the screen, not to the scrolled content. */}
      {layers.map(({ entry, cls, z, interactive }) => (
        <div
          key={entry.key}
          className={cx('screen-bg absolute inset-0 overflow-hidden', cls, !interactive && 'pointer-events-none')}
          style={{ zIndex: z }}
          aria-hidden={!interactive}
          data-active-layer={interactive ? '' : undefined}
        >
          <div className="absolute inset-0 overflow-y-auto overscroll-contain"><Screen route={entry.route} /></div>
        </div>
      ))}
      {!hideNav && <BottomNav />}
    </>
  );
}

type Exit = { entry: StackEntry; cls: string; z: number; until: number };

/**
 * Derives enter/exit animations from stack changes:
 * push → new screen slides in from the right while the old one parallaxes left and dims;
 * pop → top slides out, the one below slides back; tab switch → cross-fade with a small rise.
 * Popped screens stay mounted (same React key) until their exit animation ends.
 */
function useScreenTransitions(stack: StackEntry[]) {
  const t = useRef<{ prev: StackEntry[]; anim: Map<number, string>; exiting: Exit[] }>({ prev: stack, anim: new Map(), exiting: [] });
  const [, force] = useState(0);
  const s = t.current;

  if (s.prev !== stack) {
    const prev = s.prev;
    s.prev = stack;
    const now = performance.now();
    const keys = new Set(stack.map((e) => e.key));
    const prevKeys = new Set(prev.map((e) => e.key));
    const added = stack.filter((e) => !prevKeys.has(e.key));
    const removed = prev.filter((e) => !keys.has(e.key));
    const prevTop = prev[prev.length - 1];
    const newTop = stack[stack.length - 1];

    if (added.length && removed.length) {
      // Tab switch: whole stack replaced.
      s.anim.set(newTop.key, 'layer-tab-in');
      if (prevTop) s.exiting = [...s.exiting.filter((x) => x.entry.key !== prevTop.key), { entry: prevTop, cls: 'layer-tab-out', z: 0, until: now + 180 }];
      haptic.tick();
    } else if (added.length) {
      for (const a of added) s.anim.set(a.key, 'layer-push-in');
    } else if (removed.length) {
      if (prevTop && !keys.has(prevTop.key)) {
        s.exiting = [...s.exiting.filter((x) => x.entry.key !== prevTop.key), { entry: prevTop, cls: 'layer-pop-out', z: 3, until: now + 320 }];
      }
      s.anim.set(newTop.key, 'layer-reveal');
    }
    for (const r of removed) s.anim.delete(r.key);
  }

  const exitCount = s.exiting.length;
  useEffect(() => {
    if (!exitCount) return;
    const next = Math.min(...t.current.exiting.map((x) => x.until));
    const id = setTimeout(() => {
      const now = performance.now();
      t.current.exiting = t.current.exiting.filter((x) => x.until > now + 5);
      force((n) => n + 1);
    }, Math.max(0, next - performance.now()) + 10);
    return () => clearTimeout(id);
  }, [exitCount]);

  const liveKeys = new Set(stack.map((e) => e.key));
  const layers = [
    ...stack.map((entry, i) => {
      const isTop = i === stack.length - 1;
      return { entry, cls: isTop ? (s.anim.get(entry.key) ?? '') : 'layer-cover', z: isTop ? 2 : 1, interactive: isTop };
    }),
    ...s.exiting.filter((x) => !liveKeys.has(x.entry.key)).map((x) => ({ entry: x.entry, cls: x.cls, z: x.z, interactive: false })),
  ];
  return { layers };
}

function Gate() {
  const { settings } = useSettings();
  if (!settings.onboarded) return <Onboarding />;
  return (
    <NavProvider>
      <ActionsProvider>
        <Shell />
      </ActionsProvider>
    </NavProvider>
  );
}

export default function App({ initialSettings }: { initialSettings: AppSettings }) {
  return (
    <SettingsProvider initial={initialSettings}>
      <FeedbackProvider>
        <Gate />
      </FeedbackProvider>
    </SettingsProvider>
  );
}
