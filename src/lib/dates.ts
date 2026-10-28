// Date helpers working on plain 'YYYY-MM-DD' strings, without time zones.

export const pad = (n: number) => String(n).padStart(2, '0');

export function parseYMD(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m, d: d || 1 };
}

/** Months since year 0: comparable and easy to add. */
export function monthIdx(s: string): number {
  const { y, m } = parseYMD(s);
  return y * 12 + (m - 1);
}

export function idxToMonth(i: number): string {
  const y = Math.floor(i / 12);
  const m = i - y * 12 + 1;
  return `${y}-${pad(m)}-01`;
}

export const firstOfMonth = (s: string) => idxToMonth(monthIdx(s));
export const addMonths = (s: string, n: number) => idxToMonth(monthIdx(s) + n);
export const monthOf = (s: string) => parseYMD(s).m;

export function todayYMD(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function addDays(s: string, n: number): string {
  const { y, m, d } = parseYMD(s);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

export function daysBetween(a: string, b: string): number {
  const A = parseYMD(a);
  const B = parseYMD(b);
  return Math.round((Date.UTC(B.y, B.m - 1, B.d) - Date.UTC(A.y, A.m - 1, A.d)) / 86400000);
}

export const inMonth = (date: string | null | undefined, month: string) =>
  !!date && monthIdx(date) === monthIdx(month);

export function months(start: string, count = 12): string[] {
  const first = monthIdx(start);
  return Array.from({ length: count }, (_, k) => idxToMonth(first + k));
}

/** 'YYYY-MM' (value of <input type="month">) to 'YYYY-MM-01' and back. */
export const fromMonthInput = (v: string) => (v ? `${v}-01` : null);
export const toMonthInput = (s: string | null | undefined) => (s ? s.slice(0, 7) : '');
