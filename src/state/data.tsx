import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Data, RowOf, Settings, TableName } from '../lib/types';
import { TABLES } from '../lib/types';
import type { Backend, NewRow } from '../lib/backend';
import type { Backup } from '../lib/backup';
import { normalizeData } from '../lib/normalize';
import { todayYMD } from '../lib/dates';

interface Toast {
  id: number;
  text: string;
  tone: 'ok' | 'error';
}

interface DataCtx {
  data: Data;
  mode: Backend['mode'];
  today: string;
  stale: boolean;
  /** Why the last load failed, if it did. */
  loadError: string | null;
  add<T extends TableName>(table: T, row: NewRow<T>): Promise<RowOf<T> | null>;
  edit<T extends TableName>(table: T, id: string, patch: Partial<RowOf<T>>): Promise<boolean>;
  del(table: TableName, id: string): Promise<boolean>;
  saveSettings(patch: Partial<Settings>): Promise<boolean>;
  importBackup(b: Backup, replace: boolean): Promise<boolean>;
  /** Fetches everything again; false when the database could not be reached. */
  reload(): Promise<boolean>;
  notify(text: string, tone?: Toast['tone']): void;
  toasts: Toast[];
}

const Ctx = createContext<DataCtx | null>(null);

export function useData() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useData outside DataProvider');
  return c;
}

function readCache(key: string): Data | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? normalizeData(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeCache(key: string, d: Data) {
  try {
    localStorage.setItem(key, JSON.stringify(d));
  } catch {
    /* cache is only a convenience */
  }
}

/** What to show while the first load is running, or when it failed and nothing is cached. */
export type Fallback = (state: { error: string | null; retry: () => void }) => ReactNode;

export function DataProvider({ backend, cacheKey, children, fallback }: {
  backend: Backend;
  cacheKey: string;
  children: ReactNode;
  fallback: Fallback;
}) {
  const [data, setData] = useState<Data | null>(() => (backend.mode === 'supabase' ? readCache(cacheKey) : null));
  const [stale, setStale] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [today, setToday] = useState(() => todayYMD());
  const dataRef = useRef<Data | null>(data);
  dataRef.current = data;

  const notify = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 6000 : 2600);
  }, []);

  const commit = useCallback(
    (next: Data) => {
      setData(next);
      if (backend.mode === 'supabase') writeCache(cacheKey, next);
    },
    [backend.mode, cacheKey],
  );

  const reload = useCallback(async () => {
    setToday(todayYMD());
    setLoadError(null);
    try {
      const d = await backend.load();
      commit(d);
      setStale(false);
      return true;
    } catch (e) {
      setStale(true);
      setLoadError((e as Error).message || 'errore sconosciuto');
      return false;
    }
  }, [backend, commit]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const fail = useCallback((e: unknown) => {
    const m = (e as Error).message;
    notify(/schema cache|does not exist|violates check constraint/i.test(m)
      ? "Non salvato: al database manca un aggiornamento. In Supabase riesegui tutto supabase/schema.sql."
      : `Non salvato: ${m}`, 'error');
  }, [notify]);

  const add = useCallback(
    async <T extends TableName>(table: T, row: NewRow<T>) => {
      try {
        const saved = await backend.insert(table, row);
        const cur = dataRef.current!;
        commit({ ...cur, [table]: [...(cur[table] as unknown as RowOf<T>[]), saved] });
        return saved;
      } catch (e) {
        fail(e);
        return null;
      }
    },
    [backend, commit, fail],
  );

  const edit = useCallback(
    async <T extends TableName>(table: T, id: string, patch: Partial<RowOf<T>>) => {
      const before = dataRef.current!;
      const list = before[table] as unknown as RowOf<T>[];
      commit({ ...before, [table]: list.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
      try {
        const saved = await backend.update(table, id, patch);
        const cur = dataRef.current!;
        commit({ ...cur, [table]: (cur[table] as unknown as RowOf<T>[]).map((r) => (r.id === id ? saved : r)) });
        return true;
      } catch (e) {
        commit(before);
        fail(e);
        return false;
      }
    },
    [backend, commit, fail],
  );

  const del = useCallback(
    async (table: TableName, id: string) => {
      const before = dataRef.current!;
      commit({ ...before, [table]: (before[table] as unknown as { id: string }[]).filter((r) => r.id !== id) });
      try {
        await backend.remove(table, id);
        return true;
      } catch (e) {
        commit(before);
        fail(e);
        return false;
      }
    },
    [backend, commit, fail],
  );

  const saveSettings = useCallback(
    async (patch: Partial<Settings>) => {
      const before = dataRef.current!;
      const next = { ...before.settings, ...patch };
      commit({ ...before, settings: next });
      try {
        const saved = await backend.saveSettings(next);
        commit({ ...dataRef.current!, settings: saved });
        return true;
      } catch (e) {
        commit(before);
        fail(e);
        return false;
      }
    },
    [backend, commit, fail],
  );

  const importBackup = useCallback(
    async (b: Backup, replace: boolean) => {
      try {
        if (replace) await backend.clear();
        await backend.saveSettings(b.settings);
        for (const t of TABLES) await backend.insertMany(t, b[t] as unknown as NewRow<typeof t>[]);
        await reload();
        return true;
      } catch (e) {
        notify(`Importazione non riuscita: ${(e as Error).message}`, 'error');
        await reload();
        return false;
      }
    },
    [backend, notify, reload],
  );

  if (!data) return <>{fallback({ error: loadError, retry: () => void reload() })}</>;
  return (
    <Ctx.Provider
      value={{ data, mode: backend.mode, today, stale, loadError, add, edit, del, saveSettings, importBackup, reload, notify, toasts }}
    >
      {children}
    </Ctx.Provider>
  );
}
