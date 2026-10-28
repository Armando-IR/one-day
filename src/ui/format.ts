import { parseYMD } from '../lib/dates';

// Thousands separator always ("2.670 €"): by default Italian leaves four-digit numbers ungrouped.
const grouping = { useGrouping: 'always' } as unknown as Intl.NumberFormatOptions;
const eur0 = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, minimumFractionDigits: 0, ...grouping });
const eur2 = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2, ...grouping });
const pct0 = new Intl.NumberFormat('it-IT', { style: 'percent', maximumFractionDigits: 0 });

/** Rounds to whole euros, avoiding "-0 €". */
export function eur(v: number, decimals = false): string {
  const x = decimals ? v : Math.round(v);
  if (Object.is(x, -0) || (Math.abs(x) < 0.005)) return decimals ? eur2.format(0) : eur0.format(0);
  return decimals ? eur2.format(x) : eur0.format(x);
}

/** Cents only when there are any: "450 €", "11,99 €". */
export const eurAuto = (v: number) => eur(v, Math.abs(v - Math.round(v)) >= 0.005);

export const pct = (v: number) => pct0.format(v);

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "a ottobre", but "ad aprile", "ad agosto". */
export const prepA = (s: string) => (/^a/i.test(s) ? `ad ${s}` : `a ${s}`);

const MONTHS_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const MONTHS_LONG = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

export const monthShort = (s: string) => {
  const { y, m } = parseYMD(s);
  return `${MONTHS_SHORT[m - 1]} ${String(y).slice(2)}`;
};
export const monthName = (s: string) => MONTHS_LONG[parseYMD(s).m - 1];
export const monthLong = (s: string) => {
  const { y, m } = parseYMD(s);
  return `${MONTHS_LONG[m - 1]} ${y}`;
};
export const monthNameByNumber = (m: number) => MONTHS_LONG[m - 1];
export const dayMonth = (s: string) => {
  const { d, m } = parseYMD(s);
  return `${d} ${MONTHS_SHORT[m - 1]}`;
};
export const dayMonthYear = (s: string) => {
  const { y, m, d } = parseYMD(s);
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
};

/**
 * Reads an amount typed the Italian (or Swiss) way: "1.200,50", "2.000", "2'000", "11,99", "€ 300".
 * A dot followed by groups of three digits is a thousands separator; otherwise it is a decimal point ("11.99").
 */
export function parseAmount(text: string): number | null {
  const t = text.replace(/[€\s'’]/g, '');
  if (!t) return null;
  let normalized = t;
  if (t.includes(',')) normalized = t.replace(/\./g, '').replace(',', '.');
  else if (/^-?[1-9]\d{0,2}(\.\d{3})+$/.test(t)) normalized = t.replace(/\./g, '');
  const v = Number(normalized);
  return Number.isFinite(v) ? v : null;
}

export const amountToText = (v: number | null | undefined) =>
  v === null || v === undefined ? '' : String(Math.round(v * 100) / 100).replace('.', ',');
