// All the money logic of the app, ported from the "Personal Finance 2026" spreadsheet.
// Pure functions: easy to test, no React, no database.
import type { Data, Debt, FixedCost, Invoice, Phase, Pipeline, Settings, Tax, Wish } from './types';
import { addDays, addMonths, daysBetween, firstOfMonth, idxToMonth, inMonth, monthIdx, monthOf, months, pad, parseYMD } from './dates';

export const DEFAULT_PROBS: Record<Phase, number> = {
  Contatto: 0.1,
  'Proposta inviata': 0.3,
  Trattativa: 0.6,
  'Confermato a voce': 0.9,
  Persa: 0,
};

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const n = (x: number | null | undefined) => (typeof x === 'number' && Number.isFinite(x) ? x : 0);

// ---------------------------------------------------------------- expenses: every month, once a year, or once
export const isOneOff = (c: FixedCost) => c.frequency === 'una_tantum';

/** The recurring cost per month: yearly ones divided by 12. One-off expenses are not recurring: 0. */
export function monthlyEquivalent(c: FixedCost): number {
  if (isOneOff(c)) return 0;
  return c.frequency === 'annuale' ? n(c.amount) / 12 : n(c.amount);
}

/** Does a recurring expense run in this month, between its first and last month (when they are set)? */
export function runsIn(c: FixedCost, month: string): boolean {
  const i = monthIdx(month);
  if (c.start_month && i < monthIdx(c.start_month)) return false;
  if (c.end_month && i > monthIdx(c.end_month)) return false;
  return true;
}

/**
 * Cash out in a given month: yearly costs fall in their payment month (or are spread if it is unknown),
 * one-off expenses in their own month. Recurring ones only between their first and last month.
 */
/**
 * For the calendar: the next payment of a yearly expense, not before its first month, and how many
 * there are until its last month (no count: no last month). Null when no payment is left.
 */
export function yearlyPayments(payMonth: number, today: string, start: string | null, end: string | null) {
  const from = start && monthIdx(start) > monthIdx(today) ? start : today;
  const year = parseYMD(from).y + (payMonth < monthOf(from) ? 1 : 0);
  const first = `${year}-${pad(payMonth)}-01`;
  if (!end) return { first };
  const count = parseYMD(end).y - year + (monthOf(end) >= payMonth ? 1 : 0);
  return count > 0 ? { first, count } : null;
}

export function cashInMonth(c: FixedCost, month: string): number {
  if (isOneOff(c)) return inMonth(c.due_month, month) ? n(c.amount) : 0;
  if (!runsIn(c, month)) return 0;
  if (c.frequency !== 'annuale') return n(c.amount);
  if (c.pay_month == null) return n(c.amount) / 12;
  return monthOf(month) === c.pay_month ? n(c.amount) : 0;
}

/** Active recurring expenses of a scope (one-off ones are counted month by month instead). */
export const activeCosts = (d: Data, scope: FixedCost['scope']) =>
  d.fixed_costs.filter((c) => c.scope === scope && c.active && !isOneOff(c));

/** One-off expenses of a scope (or of both) falling in a month. */
export const oneOffIn = (d: Data, month: string, scope?: FixedCost['scope']) =>
  sum(d.fixed_costs.filter((c) => c.active && isOneOff(c) && (!scope || c.scope === scope)).map((c) => cashInMonth(c, month)));

/** Recurring cost per month of a scope, counting only the expenses running in that month. */
export const monthlyCosts = (d: Data, scope: FixedCost['scope'], month: string) =>
  sum(activeCosts(d, scope).filter((c) => runsIn(c, month)).map(monthlyEquivalent));

// ---------------------------------------------------------------- economic view (conto economico)
export interface EconomicMonth {
  month: string;
  ricavi: number;
  collaboratori: number;
  margine: number;
  speseLavoro: number;
  tasse: number;
  nettoLavoro: number;
  spesePersonali: number;
  resta: number;
  restaCumulato: number;
}

export type EconomicTotals = Omit<EconomicMonth, 'month' | 'restaCumulato'>;

export function economic(d: Data): { months: EconomicMonth[]; totals: EconomicTotals } {
  const t = n(d.settings.tax_rate);
  let cum = 0;
  const rows = months(d.settings.ce_start).map((m) => {
    const ricavi = sum(d.invoices.filter((i) => i.kind === 'ricavo' && inMonth(i.invoice_date, m)).map((i) => n(i.amount)));
    const collaboratori = -sum(
      d.invoices.filter((i) => i.kind === 'collaboratore' && inMonth(i.invoice_date, m)).map((i) => n(i.amount)),
    );
    const margine = ricavi + collaboratori;
    const speseLavoro = -monthlyCosts(d, 'lavoro', m) - oneOffIn(d, m, 'lavoro');
    const tasse = -t * (margine + speseLavoro);
    const nettoLavoro = margine + speseLavoro + tasse;
    const spesePersonali = -monthlyCosts(d, 'personale', m) - oneOffIn(d, m, 'personale');
    const resta = nettoLavoro + spesePersonali;
    cum += resta;
    return { month: m, ricavi, collaboratori, margine, speseLavoro, tasse, nettoLavoro, spesePersonali, resta, restaCumulato: cum };
  });
  const keys: (keyof EconomicTotals)[] = [
    'ricavi', 'collaboratori', 'margine', 'speseLavoro', 'tasse', 'nettoLavoro', 'spesePersonali', 'resta',
  ];
  const totals = Object.fromEntries(keys.map((k) => [k, sum(rows.map((r) => r[k]))])) as unknown as EconomicTotals;
  return { months: rows, totals };
}

// ---------------------------------------------------------------- cashflow
export interface CashMonth {
  month: string;
  opening: number;
  incassi: number;
  collaboratori: number;
  speseLavoro: number;
  spesePersonali: number;
  rate: number;
  tasse: number;
  unaTantum: number;
  desideri: number;
  closing: number;
}

export function debtActiveIn(debt: Debt, month: string): boolean {
  if (!debt.installment || !debt.first_month || !debt.last_month) return false;
  const i = monthIdx(month);
  return monthIdx(debt.first_month) <= i && i <= monthIdx(debt.last_month);
}

/** How far the cashflow looks ahead: this many months from the current one, the current one included. */
export const HORIZON = 24;
/** Last month of the cashflow for a given day. */
export const cashHorizon = (today: string) => addMonths(firstOfMonth(today), HORIZON - 1);

/**
 * Month by month from the starting balance: at least 12 months, and up to `until` if given
 * (at most 10 years, in case the starting month is far in the past).
 */
export function cashflow(d: Data, until?: string): { months: CashMonth[]; lateCredits: number; start: string } {
  const start = firstOfMonth(d.settings.cf_start);
  const count = Math.min(120, Math.max(12, until ? monthIdx(until) - monthIdx(start) + 1 : 12));
  let opening = n(d.settings.cf_opening);
  const rows = months(start, count).map((m) => {
    const incassi = sum(d.invoices.filter((i) => i.kind === 'ricavo' && inMonth(i.cash_date, m)).map((i) => n(i.amount)));
    const collaboratori = -sum(
      d.invoices.filter((i) => i.kind === 'collaboratore' && inMonth(i.cash_date, m)).map((i) => n(i.amount)),
    );
    const speseLavoro = -sum(activeCosts(d, 'lavoro').map((c) => cashInMonth(c, m)));
    const spesePersonali = -sum(activeCosts(d, 'personale').map((c) => cashInMonth(c, m)));
    const rate = -sum(d.debts.filter((x) => debtActiveIn(x, m)).map((x) => n(x.installment)));
    const tasse = -sum(d.taxes.filter((x) => inMonth(x.due_date, m)).map((x) => n(x.amount)));
    const unaTantum = -oneOffIn(d, m);
    const desideri = -sum(d.wishes.filter((w) => w.planned && inMonth(w.target_month, m)).map((w) => n(w.cost)));
    const closing = opening + incassi + collaboratori + speseLavoro + spesePersonali + rate + tasse + unaTantum + desideri;
    const row = { month: m, opening, incassi, collaboratori, speseLavoro, spesePersonali, rate, tasse, unaTantum, desideri, closing };
    opening = closing;
    return row;
  });
  const lateCredits = sum(
    d.invoices
      .filter((i) => i.kind === 'ricavo' && !i.settled && (!i.cash_date || i.cash_date < start))
      .map((i) => n(i.amount)),
  );
  return { months: rows, lateCredits, start };
}

// ---------------------------------------------------------------- goals
export interface Goals {
  business: number;
  personalCosts: number;
  wishesMonthly: number;
  oneOffMonthly: number;
  baseline: number;
  plusPct: number;
  plusFixed: number;
  plusWishes: number;
  covers: boolean;
}

/** How much to put aside each month to have `cost` by `month`. Nothing once the month has passed. */
export function monthlySaving(cost: number, month: string | null, today: string): number {
  if (!month || monthIdx(month) < monthIdx(today)) return 0;
  return n(cost) / Math.max(1, monthIdx(month) - monthIdx(today));
}

export const wishMonthly = (w: Wish, today: string) => monthlySaving(w.cost, w.target_month, today);
/** For a one-off expense: how much to put aside each month until its month. */
export const oneOffSaving = (c: FixedCost, today: string) => (isOneOff(c) ? monthlySaving(c.amount, c.due_month, today) : 0);

export function goals(d: Data, today: string): Goals {
  const s: Settings = d.settings;
  const t = n(s.tax_rate);
  const p = n(s.personal_income);
  const business = monthlyCosts(d, 'lavoro', today);
  const personalCosts = monthlyCosts(d, 'personale', today);
  const wishesMonthly = sum(d.wishes.filter((w) => w.planned).map((w) => wishMonthly(w, today)));
  const oneOffMonthly = sum(d.fixed_costs.filter((c) => c.active).map((c) => oneOffSaving(c, today)));
  return {
    business,
    personalCosts,
    wishesMonthly,
    oneOffMonthly,
    baseline: p / (1 - t) + business,
    plusPct: p / (1 - n(s.savings_pct)) / (1 - t) + business,
    plusFixed: (p + n(s.savings_fixed)) / (1 - t) + business,
    // what you want for yourself, plus what to put aside for one-off expenses and planned wishes
    plusWishes: (p + oneOffMonthly + wishesMonthly) / (1 - t) + business,
    covers: p >= personalCosts,
  };
}

/** Which goal a monthly margin reaches: 0 = below the minimum, 1 = minimum, 2 and 3 = the savings goals. */
export function tierOf(value: number, g: Goals): 0 | 1 | 2 | 3 {
  if (value < g.baseline) return 0;
  const [lo, hi] = [g.plusPct, g.plusFixed].sort((a, b) => a - b);
  if (value >= hi) return 3;
  if (value >= lo) return 2;
  return 1;
}

/**
 * The "Projections" sheet: margin of each month, average per month from the start of the year,
 * total from the start of the year, and quarters (compared with the goals times three).
 * Months after the current one have no average or total yet.
 */
export function projections(d: Data, today: string) {
  const g = goals(d, today);
  const now = monthIdx(today);
  let total = 0;
  const rows = economic(d).months.map((m, i) => {
    total += m.margine;
    return { month: m.month, margin: m.margine, average: total / (i + 1), total, future: monthIdx(m.month) > now };
  });
  const quarters = [0, 1, 2, 3].map((q) => {
    const ms = rows.slice(q * 3, q * 3 + 3);
    return {
      n: q + 1,
      total: sum(ms.map((m) => m.margin)),
      started: !ms[0].future,
      complete: monthIdx(ms[2].month) < now,
    };
  });
  return { goals: g, rows, quarters };
}

// ---------------------------------------------------------------- hypotheses and forecast
export function probability(p: Pipeline, probs: Record<Phase, number>): number {
  if (p.prob_override != null) return p.prob_override;
  return probs[p.phase] ?? DEFAULT_PROBS[p.phase] ?? 0;
}

export const probableValue = (p: Pipeline, probs: Record<Phase, number>) => n(p.amount) * probability(p, probs);

export interface ForecastMonth {
  month: string;
  confirmed: number;
  probable: number;
  withProbable: number;
  best: number;
}

export interface CashForecastMonth {
  month: string;
  closing: number;
  probableIn: number;
  withProbable: number;
  target: number;
}

export function forecast(d: Data, today: string) {
  const probs = { ...DEFAULT_PROBS, ...d.settings.phase_probs };
  const econ = economic(d);
  const cash = cashflow(d, cashHorizon(today));
  const g = goals(d, today);
  const open = d.pipeline.filter((p) => p.phase !== 'Persa');
  const margin: ForecastMonth[] = econ.months.map((r) => {
    const inM = d.pipeline.filter((p) => inMonth(p.expected_month, r.month));
    const probable = sum(inM.map((p) => probableValue(p, probs)));
    const best = r.margine + sum(open.filter((p) => inMonth(p.expected_month, r.month)).map((p) => n(p.amount)));
    return { month: r.month, confirmed: r.margine, probable, withProbable: r.margine + probable, best };
  });
  let cumProb = 0;
  const opening0 = n(d.settings.cf_opening);
  const liquidity: CashForecastMonth[] = cash.months.map((r, k) => {
    const probableIn = sum(d.pipeline.filter((p) => inMonth(p.expected_month, r.month)).map((p) => probableValue(p, probs)));
    cumProb += probableIn;
    return {
      month: r.month,
      closing: r.closing,
      probableIn,
      withProbable: r.closing + cumProb,
      target: opening0 + n(d.settings.savings_fixed) * (k + 1),
    };
  });
  const confirmedYear = econ.totals.margine;
  const probableYear = sum(margin.map((m) => m.withProbable));
  const baselineYear = g.baseline * 12;
  return {
    goals: g,
    margin,
    liquidity,
    confirmedYear,
    probableYear,
    baselineYear,
    reached: baselineYear > 0 ? confirmedYear / baselineYear : 0,
    reachedWithProbable: baselineYear > 0 ? probableYear / baselineYear : 0,
    missing: Math.max(0, baselineYear - confirmedYear),
    // from the current month on: a month already past does not count
    firstNegative: liquidity.find((l) => monthIdx(l.month) >= monthIdx(today) && l.closing < 0)?.month ?? null,
    firstNegativeWithProbable: liquidity.find((l) => monthIdx(l.month) >= monthIdx(today) && l.withProbable < 0)?.month ?? null,
    openPipeline: sum(open.map((p) => n(p.amount))),
    probablePipeline: sum(open.map((p) => probableValue(p, probs))),
  };
}

// ---------------------------------------------------------------- credits, payables, debts, clients
export function lateDays(i: Invoice, today: string): number {
  if (i.settled || !i.cash_date) return 0;
  return Math.max(0, daysBetween(i.cash_date, today));
}

export function openInvoices(d: Data, kind: Invoice['kind']): Invoice[] {
  return d.invoices
    .filter((i) => i.kind === kind && !i.settled)
    .sort((a, b) => (a.cash_date ?? '0000').localeCompare(b.cash_date ?? '0000'));
}

export function credits(d: Data, today: string) {
  const open = openInvoices(d, 'ricavo');
  const late = open.filter((i) => !i.cash_date || i.cash_date < today);
  return { open, total: sum(open.map((i) => n(i.amount))), late: sum(late.map((i) => n(i.amount))), lateCount: late.length };
}

export function remainingInstallments(debt: Debt, today: string): number {
  if (!debt.installment || !debt.first_month || !debt.last_month) return 0;
  return Math.max(0, monthIdx(debt.last_month) - Math.max(monthIdx(debt.first_month) - 1, monthIdx(today)));
}

export function debtsSummary(d: Data, today: string) {
  const thisMonth = sum(d.debts.filter((x) => debtActiveIn(x, today)).map((x) => n(x.installment)));
  const residual = sum(d.debts.map((x) => remainingInstallments(x, today) * n(x.installment)));
  return { thisMonth, residual };
}

/**
 * Everything still to pay, as in the "Debiti" sheet: installments left, F24 not yet due,
 * collaborator invoices not yet paid. F24 without an amount are counted apart.
 */
export function debtsOverview(d: Data, today: string) {
  const rate = d.debts
    .map((debt) => {
      const complete = !!(debt.installment && debt.first_month && debt.last_month);
      const left = remainingInstallments(debt, today);
      return { debt, complete, left, residual: left * n(debt.installment) };
    })
    .sort((a, b) => Number(a.complete && !a.left) - Number(b.complete && !b.left) || b.residual - a.residual || a.debt.name.localeCompare(b.debt.name));
  const upcomingTaxes = d.taxes.filter((t) => t.due_date >= today).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const pastTaxes = d.taxes.filter((t) => t.due_date < today).sort((a, b) => b.due_date.localeCompare(a.due_date));
  const payables = openInvoices(d, 'collaboratore');
  const ratesResidual = sum(rate.map((r) => r.residual));
  const taxesTotal = sum(upcomingTaxes.map((t) => n(t.amount)));
  const payablesTotal = sum(payables.map((i) => n(i.amount)));
  return {
    rate,
    ratesResidual,
    ratesThisMonth: debtsSummary(d, today).thisMonth,
    ratesIncomplete: rate.filter((r) => !r.complete).length,
    upcomingTaxes,
    pastTaxes,
    taxesTotal,
    taxesMissing: upcomingTaxes.filter((t) => t.amount == null).length,
    payables,
    payablesTotal,
    total: ratesResidual + taxesTotal + payablesTotal,
  };
}

/**
 * Stato patrimoniale at the end of the month shown on the home screen: the money on the account then,
 * plus the savings kept outside the account, plus what clients still owe after that month,
 * minus what is still owed after it.
 * Whatever falls within the month is already in the account figure, so nothing is counted twice.
 */
export function balanceSheet(d: Data, today: string) {
  const cash = cashflow(d, today);
  const k = Math.max(0, cash.months.findIndex((m) => monthIdx(m.month) === monthIdx(today)));
  const month = cash.months[k].month;
  const end = monthIdx(month);
  // Not in the cash figure: no date, dated before the cashflow starts, or due after this month.
  const stillOpen = (i: Invoice) =>
    !i.settled && (!i.cash_date || i.cash_date < cash.start || monthIdx(i.cash_date) > end);
  const credits = d.invoices.filter((i) => i.kind === 'ricavo' && stillOpen(i));
  const payables = d.invoices.filter((i) => i.kind === 'collaboratore' && stillOpen(i));
  const taxes = d.taxes.filter((t) => monthIdx(t.due_date) > end);
  const hasCash = d.settings.cf_opening != null;
  const onAccount = cash.months[k].closing;
  const creditsTotal = sum(credits.map((i) => n(i.amount)));
  const savings = sum(d.savings.map((s) => n(s.amount)));
  const debts = {
    rates: sum(d.debts.map((x) => remainingInstallments(x, month) * n(x.installment))),
    taxes: sum(taxes.map((t) => n(t.amount))),
    payables: sum(payables.map((i) => n(i.amount))),
  };
  const debtsTotal = debts.rates + debts.taxes + debts.payables;
  return {
    month,
    hasCash,
    onAccount,
    savings,
    credits: creditsTotal,
    assets: onAccount + savings + creditsTotal,
    debts,
    debtsTotal,
    net: hasCash ? onAccount + savings + creditsTotal - debtsTotal : null,
    ratesIncomplete: d.debts.filter((x) => !x.installment || !x.first_month || !x.last_month).length,
    taxesMissing: taxes.filter((t) => t.amount == null).length,
  };
}

/** Installments falling between two dates (inclusive): one entry per month, on the 1st. */
export function installmentsBetween(d: Data, from: string, to: string) {
  const out: { date: string; debts: Debt[]; amount: number }[] = [];
  for (let i = monthIdx(from); i <= monthIdx(to); i++) {
    const date = idxToMonth(i);
    if (date < from || date > to) continue;
    const due = d.debts.filter((x) => debtActiveIn(x, date));
    if (due.length) out.push({ date, debts: due, amount: sum(due.map((x) => n(x.installment))) });
  }
  return out;
}

// ---------------------------------------------------------------- money in and out, one entry per record
export interface Movement {
  /** 'YYYY-MM-DD'. Installments, one-off and yearly expenses and wishes are on the 1st of their month. */
  date: string;
  kind: 'incasso' | 'pagamento' | 'f24' | 'rata' | 'una_tantum' | 'annuale' | 'desiderio';
  text: string;
  /** Money in is positive, money out negative. Null: an F24 whose amount is still missing. */
  amount: number | null;
  settled?: boolean;
  invoice?: Invoice;
  tax?: Tax;
  cost?: FixedCost;
  debts?: Debt[];
  wish?: Wish;
}

/**
 * Everything coming in or going out between two dates (inclusive), as the cashflow counts it:
 * invoices by cash date, F24, installments, one-off expenses, yearly expenses in their payment month,
 * planned wishes. Monthly expenses are left out: they are the same every month.
 * With `openOnly`, invoices already cashed or paid are left out too.
 */
export function movementsBetween(d: Data, from: string, to: string, openOnly = false): Movement[] {
  const within = (date: string | null | undefined): date is string => !!date && date >= from && date <= to;
  const out: Movement[] = [];
  for (const i of d.invoices) {
    if (!within(i.cash_date) || (openOnly && i.settled)) continue;
    const isIn = i.kind === 'ricavo';
    out.push({
      date: i.cash_date, kind: isIn ? 'incasso' : 'pagamento', text: isIn ? `Incasso da ${i.party}` : `Pagamento a ${i.party}`,
      amount: isIn ? n(i.amount) : -n(i.amount), settled: i.settled, invoice: i,
    });
  }
  for (const t of d.taxes) {
    if (within(t.due_date)) out.push({ date: t.due_date, kind: 'f24', text: `F24: ${t.description}`, amount: t.amount == null ? null : -n(t.amount), tax: t });
  }
  for (const c of d.fixed_costs.filter((x) => x.active)) {
    if (isOneOff(c)) {
      if (within(c.due_month)) out.push({ date: c.due_month, kind: 'una_tantum', text: c.name, amount: -n(c.amount), cost: c });
    } else if (c.frequency === 'annuale' && c.pay_month != null) {
      for (let k = monthIdx(from); k <= monthIdx(to); k++) {
        const m = idxToMonth(k);
        if (within(m) && monthOf(m) === c.pay_month && runsIn(c, m)) out.push({ date: m, kind: 'annuale', text: c.name, amount: -n(c.amount), cost: c });
      }
    }
  }
  for (const r of installmentsBetween(d, from, to)) {
    out.push({
      date: r.date, kind: 'rata', text: r.debts.length === 1 ? `Rata ${r.debts[0].name}` : `Rate: ${r.debts.map((x) => x.name).join(', ')}`,
      amount: -r.amount, debts: r.debts,
    });
  }
  for (const w of d.wishes) {
    if (w.planned && within(w.target_month)) out.push({ date: w.target_month, kind: 'desiderio', text: w.name, amount: -n(w.cost), wish: w });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * One month of the cashflow, entry by entry: money on the account on the 1st, what comes in and goes out,
 * the monthly expenses as one line, and the money at the end of the month.
 * Opening + movements + monthly expenses = closing.
 */
export function monthStatement(d: Data, month: string) {
  const first = firstOfMonth(month);
  const row = cashflow(d, first).months.find((m) => m.month === first) ?? null;
  const items = movementsBetween(d, first, addDays(addMonths(first, 1), -1));
  const yearlyListed = sum(items.filter((x) => x.kind === 'annuale').map((x) => -(x.amount ?? 0)));
  const recurring = -(sum([...activeCosts(d, 'personale'), ...activeCosts(d, 'lavoro')].map((c) => cashInMonth(c, first))) - yearlyListed);
  const amounts = [...items.map((x) => x.amount ?? 0), recurring];
  return {
    month: first,
    opening: row ? row.opening : null,
    closing: row ? row.closing : null,
    items,
    recurring,
    in: sum(amounts.filter((a) => a > 0)),
    out: sum(amounts.filter((a) => a < 0)),
  };
}

export function clients(d: Data) {
  const ms = months(d.settings.ce_start);
  const from = ms[0];
  const to = ms[ms.length - 1];
  const rev = d.invoices.filter(
    (i) => i.kind === 'ricavo' && monthIdx(i.invoice_date) >= monthIdx(from) && monthIdx(i.invoice_date) <= monthIdx(to),
  );
  const total = sum(rev.map((i) => n(i.amount)));
  const by = new Map<string, number>();
  rev.forEach((i) => by.set(i.party, (by.get(i.party) ?? 0) + n(i.amount)));
  return [...by.entries()]
    .map(([party, amount]) => ({ party, amount, share: total ? amount / total : 0 }))
    .sort((a, b) => b.amount - a.amount);
}

/** What a "to complete" item opens: the starting balance, or the record with the missing data. */
export type FixTarget =
  | { kind: 'opening' }
  | { kind: 'cost'; row: FixedCost }
  | { kind: 'debt'; row: Debt }
  | { kind: 'tax'; row: Tax };

/** Things to fill in, shown on the home screen. */
export function toComplete(d: Data, today: string) {
  const items: { label: string; target: FixTarget }[] = [];
  if (d.settings.cf_opening == null) items.push({ label: 'Saldo del conto al 1° del mese di partenza', target: { kind: 'opening' } });
  d.fixed_costs
    .filter((c) => c.active && !c.amount)
    .forEach((c) => items.push({ label: `Importo di «${c.name}»`, target: { kind: 'cost', row: c } }));
  d.fixed_costs
    .filter((c) => c.active && c.amount > 0 && c.frequency === 'annuale' && c.pay_month == null)
    .forEach((c) => items.push({ label: `Mese di pagamento di «${c.name}»`, target: { kind: 'cost', row: c } }));
  d.debts
    .filter((x) => !x.installment || !x.first_month || !x.last_month)
    .forEach((x) => items.push({ label: `Dati della rata «${x.name}»`, target: { kind: 'debt', row: x } }));
  d.taxes
    .filter((x) => x.amount == null && x.due_date >= today)
    .forEach((x) => items.push({ label: `Importo dell'F24 «${x.description}»`, target: { kind: 'tax', row: x } }));
  return items;
}
