import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeDataChanged } from './dataEvents';
import { logError } from '../lib/log';

export interface DbResult<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
  reload: () => void;
}

/**
 * Runs an async repository call and re-runs it whenever the data changes
 * (optionally only when one of `tables` changed) or when `deps` change.
 */
export function useDb<T>(fn: () => Promise<T>, deps: unknown[], tables?: string[]): DbResult<T> {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const seq = useRef(0);

  const run = useCallback(() => {
    const my = ++seq.current;
    fnRef
      .current()
      .then((d) => {
        if (my === seq.current) {
          setData(d);
          setError(null);
        }
      })
      .catch((e) => {
        logError('query', e);
        if (my === seq.current) setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (my === seq.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
  }, [run]);

  const tablesKey = tables?.join(',');
  useEffect(() => {
    const filter = tablesKey ? tablesKey.split(',') : null;
    return subscribeDataChanged((changed) => {
      if (!filter || filter.some((t) => changed.has(t))) run();
    });
  }, [run, tablesKey]);

  return { data, loading, error, reload: run };
}
