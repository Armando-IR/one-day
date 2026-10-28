// Backup file: a JSON with all the data, without internal ids. Used to export, to import
// the data of the old spreadsheet, and to move to another database one day.
import type { Data, Settings, TableName } from './types';
import { TABLES } from './types';
import { normalizeData } from './normalize';

export interface Backup {
  app: 'finanze';
  version: 1;
  exported_at: string;
  settings: Settings;
  invoices: Record<string, unknown>[];
  fixed_costs: Record<string, unknown>[];
  debts: Record<string, unknown>[];
  taxes: Record<string, unknown>[];
  pipeline: Record<string, unknown>[];
  wishes: Record<string, unknown>[];
  savings: Record<string, unknown>[];
}

export function toBackup(d: Data): Backup {
  const strip = (rows: { id: string }[]) => rows.map(({ id: _id, ...rest }) => rest as Record<string, unknown>);
  return {
    app: 'finanze',
    version: 1,
    exported_at: new Date().toISOString(),
    settings: d.settings,
    invoices: strip(d.invoices),
    fixed_costs: strip(d.fixed_costs),
    debts: strip(d.debts),
    taxes: strip(d.taxes),
    pipeline: strip(d.pipeline),
    wishes: strip(d.wishes),
    savings: strip(d.savings),
  };
}

export function parseBackup(text: string): Backup {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Il file non è un backup valido: non riesco a leggerlo come JSON.');
  }
  if (raw.app !== 'finanze') throw new Error('Il file non è un backup di questa app.');
  // Files saved when "impegni" were a list of their own: they become one-off expenses.
  if (Array.isArray(raw.commitments) && raw.commitments.length) {
    const oneOff = (raw.commitments as Record<string, unknown>[]).map((c) => ({
      scope: 'personale', family: 'Altro', name: c.name, amount: c.cost, frequency: 'una_tantum', pay_month: null,
      due_month: c.target_month, active: true, note: c.note ?? null,
    }));
    raw = { ...raw, fixed_costs: [...((raw.fixed_costs as unknown[]) ?? []), ...oneOff] };
  }
  // normalizeData cleans every row; ids are dropped again because the database creates new ones
  const clean = normalizeData({ ...raw, ...Object.fromEntries(TABLES.map((t) => [t, ((raw[t] as unknown[]) ?? []).map((r) => ({ ...(r as object), id: '' }))])) });
  const out = toBackup(clean);
  return { ...out, exported_at: String(raw.exported_at ?? out.exported_at) };
}

export const rowsOf = (b: Backup, t: TableName) => b[t];

export function backupToData(b: Backup): Data {
  let i = 0;
  const withIds = (rows: Record<string, unknown>[]) => rows.map((r) => ({ ...r, id: `b${++i}` }));
  return normalizeData({
    settings: b.settings,
    ...Object.fromEntries(TABLES.map((t) => [t, withIds(b[t])])),
  });
}
