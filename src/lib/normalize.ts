// Turns rows coming from the database (or from a backup file) into clean typed objects.
import type { Data, Debt, FixedCost, Frequency, Income, Invoice, Phase, Pipeline, Saving, Settings, TableName, Tax, Wish } from './types';
import { PHASES } from './types';
import { DEFAULT_PROBS } from './finance';

type Raw = Record<string, unknown>;
const num = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v));
const req = (v: unknown) => num(v) ?? 0;
const str = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v));
const day = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v).slice(0, 10));
const bool = (v: unknown) => v === true || v === 'true';
const id = (r: Raw) => String(r.id ?? '');

export function normalizeRow(table: TableName, raw: unknown) {
  const r = (raw ?? {}) as Raw;
  switch (table) {
    case 'invoices':
      return {
        id: id(r), kind: r.kind === 'collaboratore' ? 'collaboratore' : 'ricavo', party: String(r.party ?? ''),
        description: str(r.description), amount: req(r.amount), invoice_date: day(r.invoice_date) ?? '',
        cash_date: day(r.cash_date), settled: bool(r.settled), note: str(r.note),
      } satisfies Invoice;
    case 'fixed_costs':
      return {
        id: id(r), scope: r.scope === 'lavoro' ? 'lavoro' : 'personale', family: str(r.family), name: String(r.name ?? ''),
        amount: req(r.amount),
        frequency: (['annuale', 'una_tantum'].includes(String(r.frequency)) ? r.frequency : 'mensile') as Frequency,
        pay_month: num(r.pay_month), due_month: day(r.due_month), start_month: day(r.start_month), end_month: day(r.end_month),
        active: r.active === undefined ? true : bool(r.active), note: str(r.note),
      } satisfies FixedCost;
    case 'incomes':
      return {
        id: id(r), name: String(r.name ?? ''), amount: req(r.amount),
        frequency: (['annuale', 'una_tantum'].includes(String(r.frequency)) ? r.frequency : 'mensile') as Frequency,
        pay_month: num(r.pay_month), due_month: day(r.due_month), start_month: day(r.start_month), end_month: day(r.end_month),
        active: r.active === undefined ? true : bool(r.active), note: str(r.note),
      } satisfies Income;
    case 'debts':
      return {
        id: id(r), name: String(r.name ?? ''), installment: num(r.installment), first_month: day(r.first_month),
        last_month: day(r.last_month), note: str(r.note),
      } satisfies Debt;
    case 'taxes':
      return {
        id: id(r), due_date: day(r.due_date) ?? '', description: String(r.description ?? ''), amount: num(r.amount),
        note: str(r.note),
      } satisfies Tax;
    case 'pipeline':
      return {
        id: id(r), name: String(r.name ?? ''), client: str(r.client),
        phase: (PHASES.includes(r.phase as Phase) ? r.phase : 'Contatto') as Phase, amount: req(r.amount),
        expected_month: day(r.expected_month) ?? '', prob_override: num(r.prob_override), note: str(r.note),
      } satisfies Pipeline;
    case 'wishes':
      return {
        id: id(r), name: String(r.name ?? ''), cost: req(r.cost),
        priority: (['alta', 'media', 'bassa'].includes(String(r.priority)) ? r.priority : 'media') as Wish['priority'],
        target_month: day(r.target_month), planned: bool(r.planned), note: str(r.note),
      } satisfies Wish;
    case 'savings':
      return { id: id(r), name: String(r.name ?? ''), amount: req(r.amount), note: str(r.note) } satisfies Saving;
  }
}

export function normalizeSettings(raw: unknown): Settings {
  const r = (raw ?? {}) as Raw;
  const probs = { ...DEFAULT_PROBS, ...((r.phase_probs as Record<Phase, number>) ?? {}) };
  PHASES.forEach((p) => (probs[p] = Number(probs[p])));
  return {
    ce_start: day(r.ce_start) ?? `${new Date().getFullYear()}-01-01`,
    cf_start: day(r.cf_start) ?? `${new Date().toISOString().slice(0, 7)}-01`,
    cf_opening: num(r.cf_opening),
    personal_income: num(r.personal_income) ?? 500,
    savings_fixed: num(r.savings_fixed) ?? 400,
    savings_pct: num(r.savings_pct) ?? 0.25,
    tax_rate: num(r.tax_rate) ?? 0.3,
    phase_probs: probs,
  };
}

export function normalizeData(raw: unknown): Data {
  const r = (raw ?? {}) as Raw;
  const list = <T extends TableName>(t: T) => ((r[t] as unknown[]) ?? []).map((x) => normalizeRow(t, x));
  return {
    settings: normalizeSettings(r.settings),
    invoices: list('invoices') as Invoice[],
    fixed_costs: list('fixed_costs') as FixedCost[],
    incomes: list('incomes') as Income[],
    debts: list('debts') as Debt[],
    taxes: list('taxes') as Tax[],
    pipeline: list('pipeline') as Pipeline[],
    wishes: list('wishes') as Wish[],
    savings: list('savings') as Saving[],
  };
}
