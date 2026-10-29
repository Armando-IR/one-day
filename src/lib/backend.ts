// Where the data lives. Two implementations with the same interface:
// - SupabaseBackend: the real one, with login, used when the Supabase keys are configured;
// - LocalBackend: a "prova" mode that keeps data in this browser, used without keys.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Data, RowOf, Settings, TableName } from './types';
import { TABLES } from './types';
import { DEFAULT_PROBS } from './finance';
import { todayYMD } from './dates';
import { normalizeData, normalizeRow, normalizeSettings } from './normalize';
import { sampleData } from './sample';

export type NewRow<T extends TableName> = Omit<RowOf<T>, 'id'>;

export interface Backend {
  mode: 'supabase' | 'prova';
  load(): Promise<Data>;
  insert<T extends TableName>(table: T, row: NewRow<T>): Promise<RowOf<T>>;
  insertMany<T extends TableName>(table: T, rows: NewRow<T>[]): Promise<RowOf<T>[]>;
  update<T extends TableName>(table: T, id: string, patch: Partial<RowOf<T>>): Promise<RowOf<T>>;
  remove(table: TableName, id: string): Promise<void>;
  saveSettings(s: Settings): Promise<Settings>;
  /** Deletes every row of every table (settings excluded). */
  clear(): Promise<void>;
}

export function defaultSettings(today = todayYMD()): Settings {
  return {
    ce_start: `${today.slice(0, 4)}-01-01`,
    cf_start: `${today.slice(0, 7)}-01`,
    cf_opening: null,
    personal_income: 500,
    savings_fixed: 400,
    savings_pct: 0.25,
    tax_rate: 0.3,
    phase_probs: { ...DEFAULT_PROBS },
  };
}

// ---------------------------------------------------------------- Supabase
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
/** Where Supabase keeps the login on this device. */
export const AUTH_STORAGE_KEY = 'finanze-auth';
export const supabase: SupabaseClient | null = url && key ? createClient(url, key, { auth: { storageKey: AUTH_STORAGE_KEY } }) : null;

const ORDER: Record<TableName, string> = {
  invoices: 'invoice_date',
  fixed_costs: 'name',
  incomes: 'name',
  debts: 'name',
  taxes: 'due_date',
  pipeline: 'expected_month',
  wishes: 'target_month',
  savings: 'name',
};

/**
 * Columns added by later versions of schema.sql. Asking for them on every load means that a database
 * still waiting for the update says so at once, instead of at the first save.
 */
const NEWER_COLUMNS = 'due_month,start_month,end_month';

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export class SupabaseBackend implements Backend {
  mode = 'supabase' as const;
  constructor(private sb: SupabaseClient, private userId: string) {}

  async load(): Promise<Data> {
    const [settingsRes, columnsRes, ...tableRes] = await Promise.all([
      this.sb.from('settings').select('*').maybeSingle(),
      this.sb.from('fixed_costs').select(NEWER_COLUMNS).limit(1),
      ...TABLES.map((t) => this.sb.from(t).select('*').order(ORDER[t], { ascending: true })),
    ]);
    let settings = check(settingsRes) as Record<string, unknown> | null;
    check(columnsRes);
    if (!settings) settings = (await this.saveSettings(defaultSettings())) as unknown as Record<string, unknown>;
    const out: Record<string, unknown> = { settings };
    TABLES.forEach((t, i) => (out[t] = check(tableRes[i] as { data: unknown[]; error: { message: string } | null })));
    return normalizeData(out);
  }

  async insert<T extends TableName>(table: T, row: NewRow<T>): Promise<RowOf<T>> {
    // The client has no generated types, so rows are passed untyped here.
    const data = check(await this.sb.from(table).insert(row as never).select().single());
    return normalizeRow(table, data) as RowOf<T>;
  }

  async insertMany<T extends TableName>(table: T, rows: NewRow<T>[]): Promise<RowOf<T>[]> {
    if (!rows.length) return [];
    const data = check(await this.sb.from(table).insert(rows as never).select());
    return (data as unknown[]).map((r) => normalizeRow(table, r) as RowOf<T>);
  }

  async update<T extends TableName>(table: T, id: string, patch: Partial<RowOf<T>>): Promise<RowOf<T>> {
    const { id: _ignored, ...rest } = patch as Record<string, unknown>;
    const data = check(await this.sb.from(table).update(rest).eq('id', id).select().single());
    return normalizeRow(table, data) as RowOf<T>;
  }

  async remove(table: TableName, id: string): Promise<void> {
    check(await this.sb.from(table).delete().eq('id', id));
  }

  async clear(): Promise<void> {
    for (const t of TABLES) check(await this.sb.from(t).delete().not('id', 'is', null));
  }

  async saveSettings(s: Settings): Promise<Settings> {
    const row = { ...s, user_id: this.userId, updated_at: new Date().toISOString() };
    const data = check(await this.sb.from('settings').upsert(row).select().single());
    return normalizeSettings(data);
  }
}

// ---------------------------------------------------------------- logged in, but no connection
/**
 * Used while the login is being checked, or when it can't be renewed for lack of connection:
 * the app shows the copy saved on this device and saves nothing.
 * Every load asks Supabase for the session again; once there is one, the app switches to SupabaseBackend.
 */
export class OfflineBackend implements Backend {
  mode = 'supabase' as const;
  constructor(private hasSession: () => Promise<boolean>) {}
  private fail(): never {
    throw new Error('sei offline, riprova quando torna la connessione');
  }
  async load(): Promise<Data> {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('offline');
    // With a valid session the view is about to be replaced: keep showing the saved copy meanwhile.
    if (await this.hasSession()) return new Promise<Data>(() => undefined);
    throw new Error('offline');
  }
  async insert(): Promise<never> { return this.fail(); }
  async insertMany(): Promise<never> { return this.fail(); }
  async update(): Promise<never> { return this.fail(); }
  async remove(): Promise<never> { return this.fail(); }
  async saveSettings(): Promise<never> { return this.fail(); }
  async clear(): Promise<never> { return this.fail(); }
}

// ---------------------------------------------------------------- local "prova" mode
const LOCAL_KEY = 'finanze-prova-v1';
const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now() + Math.random());

export class LocalBackend implements Backend {
  mode = 'prova' as const;
  private data: Data;

  constructor() {
    let stored: Data | null = null;
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      stored = raw ? normalizeData(JSON.parse(raw)) : null;
    } catch {
      stored = null;
    }
    this.data = stored ?? sampleData();
  }

  private persist() {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(this.data));
    } catch {
      /* storage full or blocked: data stays in memory for this session */
    }
  }

  async load() {
    return structuredClone(this.data);
  }

  async insert<T extends TableName>(table: T, row: NewRow<T>): Promise<RowOf<T>> {
    const full = { ...row, id: newId() } as unknown as RowOf<T>;
    (this.data[table] as unknown as RowOf<T>[]).push(full);
    this.persist();
    return structuredClone(full);
  }

  async insertMany<T extends TableName>(table: T, rows: NewRow<T>[]) {
    const out: RowOf<T>[] = [];
    for (const r of rows) out.push(await this.insert(table, r));
    return out;
  }

  async update<T extends TableName>(table: T, id: string, patch: Partial<RowOf<T>>): Promise<RowOf<T>> {
    const list = this.data[table] as unknown as RowOf<T>[];
    const i = list.findIndex((r) => r.id === id);
    if (i < 0) throw new Error('Riga non trovata');
    list[i] = { ...list[i], ...patch, id };
    this.persist();
    return structuredClone(list[i]);
  }

  async remove(table: TableName, id: string) {
    (this.data as unknown as Record<TableName, { id: string }[]>)[table] = (
      this.data[table] as unknown as { id: string }[]
    ).filter((r) => r.id !== id);
    this.persist();
  }

  async saveSettings(s: Settings) {
    this.data.settings = { ...s };
    this.persist();
    return structuredClone(this.data.settings);
  }

  async clear() {
    TABLES.forEach((t) => ((this.data as unknown as Record<TableName, unknown[]>)[t] = []));
    this.persist();
  }
}
