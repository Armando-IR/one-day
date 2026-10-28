import { describe, expect, it } from 'vitest';
import type { Data } from './types';
import { DEFAULT_PROBS } from './finance';
import { analysis } from './analysis';
import { sampleData } from './sample';

const TODAY = '2026-10-28';
const cost = (over: Partial<Data['fixed_costs'][number]>): Data['fixed_costs'][number] => ({
  id: Math.random().toString(36), scope: 'personale', family: 'Casa', name: 'Spesa', amount: 0, frequency: 'mensile',
  pay_month: null, due_month: null, start_month: null, end_month: null, active: true, note: null, ...over,
});

/**
 * From October 2026 with 1.000 € on the account. Beta (2.000 €) was due on 5 October and has not paid,
 * the collaborator Zeta (500 €) had to be paid on 10 October. Palestra ends in January.
 */
const base: Data = {
  settings: {
    ce_start: '2026-01-01', cf_start: '2026-10-01', cf_opening: 1000, personal_income: 500,
    savings_fixed: 400, savings_pct: 0.25, tax_rate: 0.3, phase_probs: DEFAULT_PROBS,
  },
  invoices: [
    { id: 'i1', kind: 'ricavo', party: 'Alfa', description: null, amount: 6000, invoice_date: '2026-03-10', cash_date: '2026-04-10', settled: true, note: null },
    { id: 'i2', kind: 'ricavo', party: 'Beta', description: null, amount: 2000, invoice_date: '2026-09-01', cash_date: '2026-10-05', settled: false, note: null },
    { id: 'i3', kind: 'collaboratore', party: 'Zeta', description: null, amount: 500, invoice_date: '2026-09-01', cash_date: '2026-10-10', settled: false, note: null },
  ],
  fixed_costs: [
    cost({ name: 'Affitto', amount: 400 }),
    cost({ family: 'Abbonamenti', name: 'Palestra', amount: 40, end_month: '2027-01-01' }),
    cost({ family: 'Quotidiane', name: 'Spese quotidiane', amount: 0 }),
    cost({ scope: 'lavoro', family: null, name: 'Software', amount: 30 }),
  ],
  debts: [{ id: 'd1', name: 'Telefono', installment: 30, first_month: '2026-06-01', last_month: '2027-03-01', note: null }],
  taxes: [{ id: 't1', due_date: '2026-11-30', description: 'Acconto', amount: 600, note: null }],
  pipeline: [],
  wishes: [{ id: 'w1', name: 'Bici', cost: 600, priority: 'media', target_month: '2027-04-01', planned: true, note: null }],
  savings: [{ id: 's1', name: 'Libretto', amount: 500, note: null }],
};

// bold marks out, and the no-break spaces of the euro amounts as plain spaces
const plain = (s: string) => s.replace(/\*\*/g, '').replace(/[\u00a0\u202f]/g, ' ');
const section = (d: Data, title: string, today = TODAY) =>
  (analysis(d, today).sections.find((s) => s.title === title)?.points ?? []).map(plain).join(' ');

describe('analisi della situazione', () => {
  const raw = analysis(base, TODAY);
  const a = {
    ...raw,
    headline: raw.headline.map(plain),
    actions: raw.actions.map((x) => ({ ...x, text: plain(x.text), sub: plain(x.sub) })),
  };

  it('da tenere d\'occhio: sotto zero fra tre mesi e un incasso in ritardo', () => {
    expect(a.status).toBe('watch');
    expect(a.headline[0]).toBe('Con gli incassi già inseriti, il conto va sotto zero a gennaio 2027 (-100 €).');
  });

  it('cosa fare, con quello che apre', () => {
    const acts = a.actions.map((x) => [x.text, x.target.kind]);
    expect(acts[0]).toEqual(['Trova 100 € entro gennaio 2027', 'cassa']);
    expect(acts).toContainEqual(['Sollecita Beta', 'invoice']);
    expect(acts).toContainEqual(['Paga Zeta', 'invoice']);
    expect(acts).toContainEqual(["Inserisci l'importo di «Spese quotidiane»", 'cost']);
    expect(a.actions.find((x) => x.text === 'Sollecita Beta')?.sub).toBe('2.000 €, in ritardo di 23 giorni');
    expect(a.todo).toBe(a.actions.length);
  });

  it('il conto: quanto manca e quanti mesi di spese copri', () => {
    const t = section(base, 'Il conto');
    expect(t).toContain('A fine ottobre avrai 2.000 € sul conto.');
    expect(t).toContain('ti servono altri 100 € entro gennaio');
    // 2.000 € on the account + 500 € of savings, against 440 + 30 + 30 € a month
    expect(t).toContain('copriresti circa 5 mesi di spese fisse e rate (500 € al mese)');
  });

  it('il lavoro: margine, minimo e cliente principale', () => {
    const t = section(base, 'Il lavoro');
    expect(t).toContain('Da inizio anno il margine (ricavi meno collaboratori) è 7.500 €, in media 750 € al mese.');
    expect(t).toContain('ti mancano 1.431 €: 716 € al mese nei 2 mesi che restano, meno della tua media finora');
    expect(t).toContain('Il 75% dei ricavi dell\'anno viene da Alfa: dipendi molto da un solo cliente.');
  });

  it('le spese: cosa cambia e cosa manca', () => {
    const t = section(base, 'Le spese');
    expect(t).toContain('Le spese personali di ogni mese sono 440 €, dentro i 500 € che vuoi per te.');
    expect(t).toContain('dopo gennaio 2027 non paghi più Palestra (40 € al mese)');
    expect(t).toContain('«Spese quotidiane» non ha ancora un importo');
    const course: Data = { ...base, fixed_costs: [...base.fixed_costs, cost({ family: 'Altro', name: 'Corso', amount: 60, start_month: '2026-12-01', end_month: '2027-03-01' })] };
    expect(section(course, 'Le spese')).toContain('paghi Corso solo da dicembre 2026 a marzo 2027 (60 € al mese)');
  });

  it('debiti e crediti', () => {
    const t = section(base, 'Debiti e crediti');
    expect(t).toContain('Devi ancora 1.250 €: 150 € di rate, 600 € di F24 e 500 € ai collaboratori.');
    expect(t).toContain('Il prossimo F24 è «Acconto» il 30 novembre: 600 €.');
    expect(t).toContain('I clienti ti devono 2.000 €, di cui 2.000 € in ritardo.');
  });

  it('da sistemare: manca il saldo, o il conto va sotto zero entro due mesi', () => {
    const noOpening = analysis({ ...base, settings: { ...base.settings, cf_opening: null } }, TODAY);
    expect(noOpening.status).toBe('act');
    expect(noOpening.actions[0].target.kind).toBe('opening');
    const soon = analysis({ ...base, settings: { ...base.settings, cf_opening: -2500 } }, TODAY);
    expect(soon.status).toBe('act');
  });

  it('tutto in ordine', () => {
    const fine: Data = {
      ...base,
      settings: { ...base.settings, cf_opening: 30000 },
      invoices: [
        { ...base.invoices[0], amount: 8000 },
        { ...base.invoices[1], settled: true },
        { ...base.invoices[2], settled: true },
      ],
    };
    const x = analysis(fine, TODAY);
    expect(x.status).toBe('ok');
    expect(x.headline.map(plain)).toEqual(['Il conto resta sopra zero nei prossimi 12 mesi.', "Il minimo dell'anno è raggiunto."]);
    // "l'80%": the article as the number is read
    expect(section(fine, 'Il lavoro')).toContain("L'80% dei ricavi dell'anno viene da Alfa");
  });

  it("l'anno del conto economico è finito", () => {
    const x = analysis(base, '2027-02-10');
    expect(x.actions.map((y) => y.target.kind)).toContain('year');
    expect(section(base, 'Il lavoro', '2027-02-10')).toContain("L'anno del conto economico è finito a dicembre 2026");
  });

  it('nessun testo rotto, anche con dati vuoti', () => {
    const empty: Data = { ...base, invoices: [], fixed_costs: [], debts: [], taxes: [], pipeline: [], wishes: [], savings: [] };
    for (const [d, today] of [[base, TODAY], [empty, TODAY], [sampleData(), TODAY], [base, '2027-02-10'], [empty, '2025-11-01']] as const) {
      const x = analysis(d, today);
      const all = [...x.headline, ...x.actions.flatMap((y) => [y.text, y.sub]), ...x.sections.flatMap((s) => s.points)].join('\n');
      expect(all).not.toMatch(/undefined|NaN|null|\[object|Infinity/);
      expect(x.headline.length).toBeGreaterThan(0);
    }
  });
});
