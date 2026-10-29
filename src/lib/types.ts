export type Kind = 'ricavo' | 'collaboratore';
export type Scope = 'personale' | 'lavoro';
/** How often an expense comes back: every month, once a year, or just once (in a given month). */
export type Frequency = 'mensile' | 'annuale' | 'una_tantum';
export type Priority = 'alta' | 'media' | 'bassa';
export type Phase = 'Contatto' | 'Proposta inviata' | 'Trattativa' | 'Confermato a voce' | 'Persa';

export const PHASES: Phase[] = ['Contatto', 'Proposta inviata', 'Trattativa', 'Confermato a voce', 'Persa'];

/** Date are strings 'YYYY-MM-DD'; "month" fields always use the first day: 'YYYY-MM-01'. */
export interface Invoice {
  id: string;
  kind: Kind;
  party: string;
  description: string | null;
  amount: number;
  invoice_date: string;
  cash_date: string | null;
  settled: boolean;
  note: string | null;
}

export interface FixedCost {
  id: string;
  scope: Scope;
  family: string | null;
  name: string;
  amount: number;
  frequency: Frequency;
  /** Yearly expenses: the month they are paid (1-12). */
  pay_month: number | null;
  /** One-off expenses: the month they fall in ('YYYY-MM-01'). */
  due_month: string | null;
  /** Recurring expenses: first and last month they run ('YYYY-MM-01'); empty means no limit. */
  start_month: string | null;
  end_month: string | null;
  active: boolean;
  note: string | null;
}

/**
 * Money coming in that is not an invoice: salary, pension, a rent you receive, a gift. Net amount, as it
 * arrives on the account. Like an expense: every month, once a year, or once, with a first and last month.
 */
export interface Income {
  id: string;
  name: string;
  amount: number;
  frequency: Frequency;
  pay_month: number | null;
  due_month: string | null;
  start_month: string | null;
  end_month: string | null;
  active: boolean;
  note: string | null;
}

export interface Debt {
  id: string;
  name: string;
  installment: number | null;
  first_month: string | null;
  last_month: string | null;
  note: string | null;
}

export interface Tax {
  id: string;
  due_date: string;
  description: string;
  amount: number | null;
  note: string | null;
}

export interface Pipeline {
  id: string;
  name: string;
  client: string | null;
  phase: Phase;
  amount: number;
  expected_month: string;
  prob_override: number | null;
  note: string | null;
}

export interface Wish {
  id: string;
  name: string;
  cost: number;
  priority: Priority;
  target_month: string | null;
  planned: boolean;
  note: string | null;
}

/** Money put aside outside the everyday account: counted in the patrimonio, not in the cashflow. */
export interface Saving {
  id: string;
  name: string;
  amount: number;
  note: string | null;
}

export interface Settings {
  ce_start: string;
  cf_start: string;
  cf_opening: number | null;
  personal_income: number;
  /** When on, "quanto vuoi per te" is the sum of this month's personal expenses instead of personal_income. */
  personal_auto: boolean;
  savings_fixed: number;
  savings_pct: number;
  tax_rate: number;
  phase_probs: Record<Phase, number>;
}

export interface Data {
  settings: Settings;
  invoices: Invoice[];
  fixed_costs: FixedCost[];
  incomes: Income[];
  debts: Debt[];
  taxes: Tax[];
  pipeline: Pipeline[];
  wishes: Wish[];
  savings: Saving[];
}

export type TableName = 'invoices' | 'fixed_costs' | 'incomes' | 'debts' | 'taxes' | 'pipeline' | 'wishes' | 'savings';

export type RowOf<T extends TableName> = T extends 'invoices' ? Invoice
  : T extends 'fixed_costs' ? FixedCost
  : T extends 'incomes' ? Income
  : T extends 'debts' ? Debt
  : T extends 'taxes' ? Tax
  : T extends 'pipeline' ? Pipeline
  : T extends 'wishes' ? Wish
  : Saving;

export const TABLES: TableName[] = ['invoices', 'fixed_costs', 'incomes', 'debts', 'taxes', 'pipeline', 'wishes', 'savings'];
