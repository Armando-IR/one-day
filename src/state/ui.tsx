import { createContext, useContext } from 'react';
import type { Debt, FixedCost, Invoice, Kind, Pipeline, Saving, Scope, Tax, Wish } from '../lib/types';

export type Tab = 'home' | 'lavori' | 'piani' | 'conti' | 'impostazioni' | 'analisi';
export type LavoriFilter = 'incassare' | 'pagare' | 'tutte';
export type PianiView = 'obiettivi' | 'ipotesi' | 'desideri';
export type ContiView = 'cassa' | 'economico' | 'patrimonio' | 'spese';

export type SheetState =
  | { type: 'add' }
  | { type: 'invoice'; kind: Kind; initial?: Invoice }
  | { type: 'cost'; scope: Scope; initial?: FixedCost }
  | { type: 'debt'; initial?: Debt }
  | { type: 'tax'; initial?: Tax }
  | { type: 'pipeline'; initial?: Pipeline }
  | { type: 'wish'; initial?: Wish }
  | { type: 'saving'; initial?: Saving }
  | { type: 'opening' }
  | { type: 'year' }
  | { type: 'params' }
  | { type: 'probs' }
  | { type: 'import'; text: string };

export interface UiCtx {
  tab: Tab;
  go(tab: Tab, opts?: { lavori?: LavoriFilter; piani?: PianiView; conti?: ContiView }): void;
  lavoriFilter: LavoriFilter;
  setLavoriFilter(f: LavoriFilter): void;
  pianiView: PianiView;
  setPianiView(v: PianiView): void;
  contiView: ContiView;
  setContiView(v: ContiView): void;
  open(s: SheetState): void;
  close(): void;
}

/** Where this device remembers how many months the home chart shows. */
export const SPAN_KEY = 'finanze-span';

export const Ui = createContext<UiCtx | null>(null);

export function useUi() {
  const c = useContext(Ui);
  if (!c) throw new Error('useUi outside provider');
  return c;
}
