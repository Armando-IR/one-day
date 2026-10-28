// Data for "prova" mode (no database configured): a small invented example,
// so the app can be tried before connecting the database. No real data here.
import type { Data } from './types';
import { DEFAULT_PROBS } from './finance';
import { addDays, addMonths, todayYMD } from './dates';

export function sampleData(): Data {
  const today = todayYMD();
  const month = `${today.slice(0, 7)}-01`;
  let n = 0;
  const id = () => `s${++n}`;
  return {
    settings: {
      ce_start: `${today.slice(0, 4)}-01-01`, cf_start: month, cf_opening: 2500, personal_income: 500,
      savings_fixed: 400, savings_pct: 0.25, tax_rate: 0.3, phase_probs: { ...DEFAULT_PROBS },
    },
    invoices: [
      { id: id(), kind: 'ricavo', party: 'Studio Rossi', description: 'Identità visiva', amount: 3200, invoice_date: addMonths(month, -3), cash_date: addMonths(month, -2), settled: true, note: null },
      { id: id(), kind: 'collaboratore', party: 'Fotografa', description: 'Shooting', amount: 600, invoice_date: addMonths(month, -3), cash_date: addMonths(month, -2), settled: true, note: null },
      { id: id(), kind: 'ricavo', party: 'Festival', description: 'Comunicazione', amount: 2400, invoice_date: addDays(today, -20), cash_date: addDays(today, 10), settled: false, note: null },
      { id: id(), kind: 'ricavo', party: 'Associazione', description: 'Workshop', amount: 800, invoice_date: addMonths(month, -2), cash_date: addDays(today, -15), settled: false, note: 'Sollecitata una volta. La segreteria dice che il bonifico parte a fine mese.' },
    ],
    fixed_costs: [
      { id: id(), scope: 'personale', family: 'Casa', name: 'Affitto', amount: 450, frequency: 'mensile', pay_month: null, due_month: null, start_month: null, end_month: null, active: true, note: 'Bonifico al proprietario entro il 5 del mese.' },
      { id: id(), scope: 'personale', family: 'Casa', name: 'Bollette', amount: 80, frequency: 'mensile', pay_month: null, due_month: null, start_month: null, end_month: null, active: true, note: null },
      { id: id(), scope: 'personale', family: 'Quotidiane', name: 'Spese quotidiane', amount: 300, frequency: 'mensile', pay_month: null, due_month: null, start_month: null, end_month: null, active: true, note: 'Media mensile delle spese con la carta: supermercato, uscite, imprevisti.' },
      { id: id(), scope: 'personale', family: 'Motorino', name: 'Assicurazione', amount: 260, frequency: 'annuale', pay_month: 3, due_month: null, start_month: null, end_month: null, active: true, note: null },
      { id: id(), scope: 'personale', family: 'Abbonamenti', name: 'Palestra', amount: 35, frequency: 'mensile', pay_month: null, due_month: null, start_month: addMonths(month, -1), end_month: addMonths(month, 4), active: true, note: 'Abbonamento di sei mesi, poi si vede.' },
      { id: id(), scope: 'personale', family: 'Abbonamenti', name: 'Telefono', amount: 10, frequency: 'mensile', pay_month: null, due_month: null, start_month: null, end_month: null, active: true, note: null },
      { id: id(), scope: 'personale', family: 'Altro', name: 'Regalo di nozze', amount: 250, frequency: 'una_tantum', pay_month: null, due_month: addMonths(month, 3), start_month: null, end_month: null, active: true, note: 'Lista nozze in agenzia.' },
      { id: id(), scope: 'lavoro', family: null, name: 'Software', amount: 30, frequency: 'mensile', pay_month: null, due_month: null, start_month: null, end_month: null, active: true, note: null },
    ],
    debts: [{ id: id(), name: 'Computer portatile', installment: 60, first_month: addMonths(month, -2), last_month: addMonths(month, 6), note: 'Finanziamento a tasso zero, addebito sulla carta.' }],
    taxes: [{ id: id(), due_date: addDays(addMonths(month, 1), 29), description: 'Acconto', amount: 900, note: 'Importo indicato dal commercialista.' }],
    pipeline: [
      { id: id(), name: 'Catalogo mostra', client: 'Museo', phase: 'Proposta inviata', amount: 3000, expected_month: addMonths(month, 2), prob_override: null, note: null },
    ],
    savings: [{ id: id(), name: 'Conto deposito', amount: 1500, note: 'Vincolato fino a giugno.' }],
    wishes: [{ id: id(), name: 'Bici', cost: 900, priority: 'media', target_month: addMonths(month, 6), planned: true, note: null }],
  };
}
