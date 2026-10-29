import { describe, expect, it } from 'vitest';
import type { Data } from './types';
import {
  balanceSheet, cashflow, clients, credits, debtsOverview, debtsSummary, economic, forecast, goals, installmentsBetween, lateDays,
  cashHorizon, monthlySaving, monthlySeries, shiftMonths, monthStatement, movementsBetween, projections, tierOf,
  toComplete, yearlyPayments, DEFAULT_PROBS,
} from './finance';

const TODAY = '2026-10-25';
let id = 0;
const uid = () => String(++id);

const data: Data = {
  settings: {
    ce_start: '2026-01-01', cf_start: '2026-10-01', cf_opening: 1000, personal_income: 500, personal_auto: false,
    savings_fixed: 400, savings_pct: 0.25, tax_rate: 0.3, phase_probs: DEFAULT_PROBS,
  },
  invoices: [
    { id: uid(), kind: 'ricavo', party: 'Alfa', description: null, amount: 3000, invoice_date: '2026-02-10', cash_date: '2026-03-10', settled: true, note: null },
    { id: uid(), kind: 'collaboratore', party: 'Zeta', description: null, amount: 1000, invoice_date: '2026-02-15', cash_date: '2026-03-01', settled: true, note: null },
    { id: uid(), kind: 'ricavo', party: 'Beta', description: null, amount: 2000, invoice_date: '2026-10-05', cash_date: '2026-11-04', settled: false, note: null },
    { id: uid(), kind: 'ricavo', party: 'Gamma', description: null, amount: 500, invoice_date: '2026-08-01', cash_date: '2026-09-01', settled: false, note: null },
  ],
  fixed_costs: [
    { id: uid(), scope: 'lavoro', family: null, name: 'Studio', amount: 120, frequency: 'mensile', pay_month: null, due_month: null, start_month: null, end_month: null, active: true, note: null },
    { id: uid(), scope: 'lavoro', family: null, name: 'Software', amount: 240, frequency: 'annuale', pay_month: 3, due_month: null, start_month: null, end_month: null, active: true, note: null },
    { id: uid(), scope: 'personale', family: 'Casa', name: 'Affitto', amount: 300, frequency: 'mensile', pay_month: null, due_month: null, start_month: null, end_month: null, active: true, note: null },
    { id: uid(), scope: 'personale', family: 'Motorino', name: 'Assicurazione', amount: 360, frequency: 'annuale', pay_month: 12, due_month: null, start_month: null, end_month: null, active: true, note: null },
    { id: uid(), scope: 'personale', family: 'Motorino', name: 'Bollo', amount: 0, frequency: 'annuale', pay_month: null, due_month: null, start_month: null, end_month: null, active: true, note: null },
    { id: uid(), scope: 'personale', family: 'Altro', name: 'Palestra', amount: 50, frequency: 'mensile', pay_month: null, due_month: null, start_month: null, end_month: null, active: false, note: null },
  ],
  debts: [{ id: uid(), name: 'Rata', installment: 50, first_month: '2026-11-01', last_month: '2027-01-01', note: null }],
  taxes: [{ id: uid(), due_date: '2026-11-30', description: 'Acconto', amount: 700, note: null }],
  pipeline: [
    { id: uid(), name: 'P1', client: null, phase: 'Trattativa', amount: 1000, expected_month: '2026-12-01', prob_override: null, note: null },
    { id: uid(), name: 'P2', client: null, phase: 'Persa', amount: 5000, expected_month: '2026-12-01', prob_override: null, note: null },
    { id: uid(), name: 'P3', client: null, phase: 'Contatto', amount: 2000, expected_month: '2027-02-01', prob_override: 0.5, note: null },
  ],
  wishes: [
    { id: uid(), name: 'W1', cost: 600, priority: 'media', target_month: '2027-03-01', planned: true, note: null },
    { id: uid(), name: 'W2', cost: 1000, priority: 'bassa', target_month: '2027-06-01', planned: false, note: null },
  ],
  savings: [{ id: uid(), name: 'Libretto', amount: 300, note: null }],
  incomes: [],
};

describe('conto economico', () => {
  const e = economic(data);
  it('totali dell anno', () => {
    expect(e.totals.ricavi).toBe(5500);
    expect(e.totals.collaboratori).toBe(-1000);
    expect(e.totals.margine).toBe(4500);
    expect(e.totals.speseLavoro).toBeCloseTo(-1680);
    expect(e.totals.tasse).toBeCloseTo(-846);
    expect(e.totals.nettoLavoro).toBeCloseTo(1974);
    expect(e.totals.spesePersonali).toBeCloseTo(-3960);
    expect(e.totals.resta).toBeCloseTo(-1986);
  });
  it('febbraio', () => {
    const feb = e.months[1];
    expect(feb.margine).toBe(2000);
    expect(feb.tasse).toBeCloseTo(-558);
    expect(feb.resta).toBeCloseTo(972);
  });
});

/** The same data with a one-off personal expense of 300 € in December. */
const withOneOff: Data = {
  ...data,
  fixed_costs: [...data.fixed_costs, { id: 'u', scope: 'personale', family: 'Altro', name: 'Regalo', amount: 300, frequency: 'una_tantum', pay_month: null, due_month: '2026-12-01', start_month: null, end_month: null, active: true, note: null }],
};

describe('cashflow', () => {
  const c = cashflow(data);
  it('saldi a fine mese', () => {
    const closings = c.months.map((m) => Math.round(m.closing));
    expect(closings).toEqual([580, 1410, 580, 110, -310, -1570, -1990, -2410, -2830, -3250, -3670, -4090]);
  });
  it('incassi in ritardo', () => expect(c.lateCredits).toBe(500));
  it('spese una tantum nel loro mese', () => {
    const m = cashflow(withOneOff).months;
    expect(m[2].unaTantum).toBe(-300);
    expect(m[1].unaTantum).toBeCloseTo(0);
    expect(Math.round(m[2].closing)).toBe(280);
    expect(Math.round(m[11].closing)).toBe(-4390);
  });
});

describe('cashflow fino a 2 anni da oggi', () => {
  it('24 mesi a partire da questo, gli stessi saldi nei primi 12', () => {
    const long = cashflow(data, cashHorizon(TODAY));
    expect(long.months).toHaveLength(24);
    expect(long.months[23].month).toBe('2028-09-01');
    expect(long.months.slice(0, 12).map((m) => Math.round(m.closing))).toEqual(cashflow(data).months.map((m) => Math.round(m.closing)));
    expect(Math.round(long.months[12].closing)).toBe(-4510); // October 2027: rent, studio and nothing coming in
  });
  it('col passare dei mesi guarda sempre 2 anni avanti', () => {
    const later = forecast(data, '2027-06-15').liquidity;
    expect(later[0].month).toBe('2026-10-01');
    expect(later[later.length - 1].month).toBe('2029-05-01');
    expect(balanceSheet(data, '2028-01-10').month).toBe('2028-01-01');
    expect(monthStatement(data, '2028-03-01').opening).not.toBeNull();
  });
  it('sotto zero: conta da questo mese in poi', () => {
    const f = forecast(data, TODAY);
    expect(f.firstNegative).toBe('2027-02-01');
    expect(forecast(data, '2027-06-15').firstNegative).toBe('2027-06-01');
  });
});

describe('spese con un mese di inizio e di fine', () => {
  // Studio (120 € al mese) only from March to November, Affitto (300 €) only from December
  const ranged: Data = {
    ...data,
    fixed_costs: data.fixed_costs.map((c) =>
      c.name === 'Studio' ? { ...c, start_month: '2026-03-01', end_month: '2026-11-01' }
        : c.name === 'Affitto' ? { ...c, start_month: '2026-12-01' } : c),
  };
  it('conto economico: contano solo nei loro mesi', () => {
    const e = economic(ranged);
    expect(e.months[0].speseLavoro).toBeCloseTo(-20); // January: only Software (240 € a year)
    expect(e.months[2].speseLavoro).toBeCloseTo(-140);
    expect(e.months[11].speseLavoro).toBeCloseTo(-20);
    expect(e.months[10].spesePersonali).toBeCloseTo(-30); // November: only the scooter insurance (360 € a year)
    expect(e.months[11].spesePersonali).toBeCloseTo(-330);
  });
  it('cashflow: contano solo nei loro mesi', () => {
    const m = cashflow(ranged).months; // from October
    expect(m[1].speseLavoro).toBeCloseTo(-120); // November: Studio still runs
    expect(m[2].speseLavoro).toBeCloseTo(0); // December: Studio ended
    expect(m[1].spesePersonali).toBeCloseTo(0); // November: no rent yet
    expect(m[2].spesePersonali).toBeCloseTo(-660); // December: rent and the yearly insurance
  });
  it('obiettivi: le spese di questo mese', () => {
    const g = goals(ranged, TODAY);
    expect(g.business).toBeCloseTo(140); // October: Studio runs
    expect(g.personalCosts).toBeCloseTo(30); // October: no rent yet
    expect(goals(ranged, '2026-12-10').business).toBeCloseTo(20);
  });
});

describe('quanto vuoi per te calcolato dalle spese personali', () => {
  const auto: Data = { ...data, settings: { ...data.settings, personal_auto: true } };
  it('il minimo parte dalle spese personali del mese', () => {
    const g = goals(auto, TODAY);
    expect(g.personalAuto).toBe(true);
    expect(g.personal).toBeCloseTo(330); // rent 300 + insurance 360 / 12
    expect(g.baseline).toBeCloseTo(330 / 0.7 + 140);
    expect(g.plusFixed).toBeCloseTo((330 + 400) / 0.7 + 140);
  });
  it('segue le spese che iniziano o finiscono', () => {
    const later: Data = { ...auto, fixed_costs: auto.fixed_costs.map((c) => (c.name === 'Affitto' ? { ...c, end_month: '2026-11-01' } : c)) };
    expect(goals(later, '2026-12-05').personal).toBeCloseTo(30);
  });
  it('spento, vale la cifra scritta a mano', () => {
    expect(goals(data, TODAY).personal).toBe(500);
  });
});

describe('fattura ripetuta ogni mese', () => {
  it('stesso giorno, il 31 diventa la fine del mese', () => {
    expect(shiftMonths('2026-10-15', 1)).toBe('2026-11-15');
    expect(shiftMonths('2027-01-31', 1)).toBe('2027-02-28');
    expect(shiftMonths('2026-12-10', 2)).toBe('2027-02-10');
  });
  it('una fattura per mese fino al mese scelto; solo la prima può essere già incassata', () => {
    const s = monthlySeries({ party: 'Alfa', amount: 1000, invoice_date: '2026-10-31', cash_date: '2026-11-30', settled: true }, '2027-01-01');
    expect(s.map((x) => [x.invoice_date, x.cash_date, x.settled])).toEqual([
      ['2026-10-31', '2026-11-30', true],
      ['2026-11-30', '2026-12-30', false],
      ['2026-12-31', '2027-01-30', false],
      ['2027-01-31', '2027-02-28', false], // January included
    ]);
  });
});

describe('entrate che non sono fatture', () => {
  const inc = (over: Partial<Data['incomes'][number]>): Data['incomes'][number] => ({
    id: uid(), name: 'Entrata', amount: 0, frequency: 'mensile', pay_month: null, due_month: null,
    start_month: null, end_month: null, active: true, note: null, ...over,
  });
  const withIncome: Data = {
    ...data,
    incomes: [
      inc({ name: 'Pensione', amount: 300 }),
      inc({ name: 'Rimborso', amount: 1000, frequency: 'una_tantum', due_month: '2026-12-01' }),
      inc({ name: 'Premio', amount: 1200, frequency: 'annuale', pay_month: 3 }),
      inc({ name: 'Vecchio affitto', amount: 200, end_month: '2026-09-01' }),
    ],
  };
  it('entrano nel cashflow nel loro mese', () => {
    const base = cashflow(data).months;
    const m = cashflow(withIncome).months;
    expect(m[0].entrate).toBe(300);
    expect(m[2].entrate).toBe(1300);
    expect(m[5].entrate).toBe(1500); // March: pension and yearly bonus
    expect(m[2].closing - base[2].closing).toBeCloseTo(300 * 3 + 1000);
  });
  it('nel conto economico non cambiano le tasse', () => {
    const e = economic(withIncome);
    const e0 = economic(data);
    expect(e.months[11].altreEntrate).toBeCloseTo(300 + 100 + 1000);
    expect(e.months[11].tasse).toBeCloseTo(e0.months[11].tasse);
    expect(e.months[11].resta - e0.months[11].resta).toBeCloseTo(1400);
    expect(e.months[0].altreEntrate).toBeCloseTo(300 + 100 + 200); // January: the old rent still ran
  });
  it('abbassano il minimo da guadagnare', () => {
    const g = goals(withIncome, TODAY);
    expect(g.otherIncome).toBeCloseTo(400); // 300 + 1200 / 12; the old rent has ended
    expect(g.baseline).toBeCloseTo(100 / 0.7 + 140);
    const rich: Data = { ...withIncome, incomes: [inc({ name: 'Stipendio', amount: 2000 })] };
    expect(goals(rich, TODAY).baseline).toBeCloseTo(140); // never below the work expenses
  });
  it('nel mese: in una riga quelle di ogni mese, una per una le altre', () => {
    const st = monthStatement(withIncome, '2026-12-01');
    expect(st.recurringIn).toBeCloseTo(300); // the yearly bonus is paid in March, not spread
    expect(st.items.filter((x) => x.kind === 'entrata').map((x) => [x.text, x.amount])).toEqual([['Rimborso', 1000]]);
    for (const m of cashflow(withIncome).months) {
      const x = monthStatement(withIncome, m.month);
      expect(x.opening! + x.in + x.out).toBeCloseTo(x.closing!);
    }
    expect(monthStatement(withIncome, '2027-03-01').items.some((x) => x.text === 'Premio')).toBe(true);
  });
  it('senza importo va completata', () => {
    const t = toComplete({ ...data, incomes: [inc({ name: 'Stipendio' })] }, TODAY);
    expect(t.some((x) => x.target.kind === 'income' && x.label === 'Importo di «Stipendio»')).toBe(true);
  });
});

describe('entrate e uscite di un mese', () => {
  it('ogni mese: saldo del 1° + movimenti + spese di ogni mese = saldo a fine mese', () => {
    for (const d of [data, withOneOff]) {
      for (const m of cashflow(d).months) {
        const st = monthStatement(d, m.month);
        const total = st.opening! + st.items.reduce((a, x) => a + (x.amount ?? 0), 0) + st.recurring;
        expect(total).toBeCloseTo(st.closing!);
        expect(st.opening! + st.in + st.out).toBeCloseTo(st.closing!);
      }
    }
  });
  it('dicembre: la spesa di ogni anno e quella una tantum una per una', () => {
    const st = monthStatement(withOneOff, '2026-12-01');
    expect(st.items.map((x) => [x.kind, x.text, x.amount])).toEqual([
      ['annuale', 'Assicurazione', -360],
      ['una_tantum', 'Regalo', -300],
      ['rata', 'Rata Rata', -50],
    ]);
    expect(st.recurring).toBeCloseTo(-420); // Studio 120 + Affitto 300; the Bollo has no amount, Palestra is off
  });
  it('novembre: incasso, F24 e rata', () => {
    const st = monthStatement(data, '2026-11-15');
    expect(st.month).toBe('2026-11-01');
    expect(st.items.map((x) => [x.date, x.kind, x.amount])).toEqual([
      ['2026-11-01', 'rata', -50],
      ['2026-11-04', 'incasso', 2000],
      ['2026-11-30', 'f24', -700],
    ]);
    expect(st.in).toBe(2000);
  });
  it('fuori dal cashflow: nessun saldo', () => {
    const st = monthStatement(data, '2026-05-01');
    expect(st.opening).toBeNull();
    expect(st.closing).toBeNull();
  });
  it('prossime settimane: solo quello ancora da incassare o pagare, con desideri e spese di ogni anno', () => {
    const settled: Data = { ...data, invoices: data.invoices.map((i) => (i.party === 'Beta' ? { ...i, settled: true } : i)) };
    expect(movementsBetween(settled, '2026-10-25', '2026-12-31', true).map((x) => x.kind)).toEqual(['rata', 'f24', 'annuale', 'rata']);
    expect(movementsBetween(data, '2027-03-01', '2027-03-31').map((x) => [x.kind, x.text])).toEqual([['annuale', 'Software'], ['desiderio', 'W1']]);
  });
  it("una spesa di ogni anno conta solo finché c'è", () => {
    const ended: Data = { ...data, fixed_costs: data.fixed_costs.map((c) => (c.name === 'Assicurazione' ? { ...c, end_month: '2026-11-01' } : c)) };
    expect(monthStatement(ended, '2026-12-01').items.some((x) => x.text === 'Assicurazione')).toBe(false);
  });
});

describe('calendario delle spese di ogni anno', () => {
  it('la prossima volta, non prima del primo mese', () => {
    expect(yearlyPayments(3, TODAY, null, null)).toEqual({ first: '2027-03-01' });
    expect(yearlyPayments(12, TODAY, null, null)).toEqual({ first: '2026-12-01' });
    expect(yearlyPayments(1, TODAY, '2027-03-01', null)).toEqual({ first: '2028-01-01' });
    expect(yearlyPayments(3, TODAY, '2027-03-01', null)).toEqual({ first: '2027-03-01' });
    expect(yearlyPayments(12, TODAY, '2026-02-01', null)).toEqual({ first: '2026-12-01' }); // already started
  });
  it("quante volte fino all'ultimo mese", () => {
    expect(yearlyPayments(3, TODAY, '2027-03-01', '2029-06-01')).toEqual({ first: '2027-03-01', count: 3 });
    expect(yearlyPayments(5, TODAY, null, '2027-05-01')).toEqual({ first: '2027-05-01', count: 1 });
    expect(yearlyPayments(7, TODAY, null, '2027-06-01')).toBeNull(); // ends before the next payment
    expect(yearlyPayments(3, TODAY, null, '2026-05-01')).toBeNull(); // already ended
  });
});

describe('conto economico con una spesa una tantum', () => {
  it('conta nel suo mese, personale o di lavoro', () => {
    const e = economic(withOneOff);
    expect(e.months[11].spesePersonali).toBeCloseTo(-330 - 300);
    expect(e.months[10].spesePersonali).toBeCloseTo(-330);
    const work: Data = { ...withOneOff, fixed_costs: withOneOff.fixed_costs.map((c) => (c.name === 'Regalo' ? { ...c, scope: 'lavoro', family: null } : c)) };
    const w = economic(work);
    expect(w.months[11].speseLavoro).toBeCloseTo(-140 - 300);
    expect(w.months[11].tasse).toBeCloseTo(-0.3 * (0 - 440));
  });
  it('non cambia le spese mensili e quindi il minimo', () => {
    expect(goals(withOneOff, TODAY).personalCosts).toBeCloseTo(330);
    expect(goals(withOneOff, TODAY).baseline).toBeCloseTo(854.2857, 3);
  });
});

describe('obiettivi', () => {
  const g = goals(data, TODAY);
  it('soglie', () => {
    expect(g.business).toBeCloseTo(140);
    expect(g.personalCosts).toBeCloseTo(330);
    expect(g.wishesMonthly).toBeCloseTo(120);
    expect(g.baseline).toBeCloseTo(854.2857, 3);
    expect(g.plusPct).toBeCloseTo(1092.381, 2);
    expect(g.plusFixed).toBeCloseTo(1425.714, 2);
    expect(g.plusWishes).toBeCloseTo(1025.714, 2);
    expect(g.covers).toBe(true);
  });
  it('una tantum e desideri: quanto mettere da parte', () => {
    expect(monthlySaving(600, '2027-03-01', TODAY)).toBe(120);
    expect(monthlySaving(600, '2026-10-01', TODAY)).toBe(600); // this month: all of it now
    expect(monthlySaving(600, '2026-09-01', TODAY)).toBe(0); // already past
    const g2 = goals(withOneOff, TODAY);
    expect(g2.oneOffMonthly).toBeCloseTo(150); // 300 € in December: 2 months from October
    expect(g2.plusWishes).toBeCloseTo((500 + 150 + 120) / 0.7 + 140, 1);
  });
  it('fasce', () => {
    expect(tierOf(500, g)).toBe(0);
    expect(tierOf(1000, g)).toBe(1);
    expect(tierOf(1100, g)).toBe(2);
    expect(tierOf(2000, g)).toBe(3);
  });
});

describe('previsioni', () => {
  const f = forecast(data, TODAY);
  it('margine con le ipotesi', () => {
    const dec = f.margin[11];
    expect(dec.probable).toBeCloseTo(600);
    expect(dec.best).toBe(1000);
    expect(f.probableYear).toBeCloseTo(5100);
    expect(f.reached).toBeCloseTo(4500 / (854.2857 * 12), 4);
    expect(f.missing).toBeCloseTo(854.2857 * 12 - 4500, 2);
  });
  it('liquidità con le ipotesi', () => {
    expect(f.liquidity.map((l) => Math.round(l.withProbable)).slice(0, 7)).toEqual([580, 1410, 1180, 710, 1290, 30, -390]);
    expect(f.firstNegative).toBe('2027-02-01');
    expect(f.firstNegativeWithProbable).toBe('2027-04-01');
    expect(f.liquidity[11].target).toBe(5800);
    expect(f.openPipeline).toBe(3000);
    expect(f.probablePipeline).toBeCloseTo(1600);
  });
});

describe('projections', () => {
  const p = projections(data, TODAY);
  it('media e totale da inizio anno', () => {
    expect(p.rows.map((r) => r.margin)).toEqual([0, 2000, 0, 0, 0, 0, 0, 500, 0, 2000, 0, 0]);
    expect(p.rows[1].average).toBe(1000);
    expect(p.rows[2].average).toBeCloseTo(666.667);
    expect(p.rows[9].total).toBe(4500);
    expect(p.rows[9].average).toBe(450);
    expect(p.rows.filter((r) => r.future).map((r) => r.month)).toEqual(['2026-11-01', '2026-12-01']);
  });
  it('trimestri', () => {
    expect(p.quarters.map((q) => q.total)).toEqual([2000, 0, 500, 2000]);
    expect(p.quarters.map((q) => [q.started, q.complete])).toEqual([[true, true], [true, true], [true, true], [true, false]]);
  });
});

describe('crediti, debiti, clienti', () => {
  it('crediti', () => {
    const c = credits(data, TODAY);
    expect(c.total).toBe(2500);
    expect(c.late).toBe(500);
    expect(lateDays(data.invoices[3], TODAY)).toBe(54);
  });
  it('rate', () => {
    const d = debtsSummary(data, TODAY);
    expect(d.thisMonth).toBe(0);
    expect(d.residual).toBe(150);
  });
  it('clienti', () => {
    const cl = clients(data);
    expect(cl[0].party).toBe('Alfa');
    expect(cl[0].share).toBeCloseTo(3000 / 5500);
  });
  it('debiti', () => {
    const o = debtsOverview(data, TODAY);
    expect(o.ratesResidual).toBe(150);
    expect(o.taxesTotal).toBe(700);
    expect(o.payablesTotal).toBe(0);
    expect(o.total).toBe(850);
    expect(o.rate[0].left).toBe(3);
    const withPayable: Data = {
      ...data,
      invoices: [...data.invoices, { id: 'x', kind: 'collaboratore', party: 'Eta', description: null, amount: 250, invoice_date: '2026-10-01', cash_date: '2026-11-15', settled: false, note: null }],
      taxes: [...data.taxes, { id: 'y', due_date: '2027-06-30', description: 'Saldo', amount: null, note: null }, { id: 'z', due_date: '2026-06-30', description: 'Vecchio', amount: 300, note: null }],
    };
    const o2 = debtsOverview(withPayable, TODAY);
    expect(o2.total).toBe(1100);
    expect(o2.taxesMissing).toBe(1);
    expect(o2.pastTaxes.map((t) => t.description)).toEqual(['Vecchio']);
  });
  it('stato patrimoniale a fine ottobre', () => {
    const b = balanceSheet(data, TODAY);
    expect(b.month).toBe('2026-10-01');
    expect(b.onAccount).toBe(580);
    expect(b.credits).toBe(2500); // Beta in novembre + Gamma, in ritardo da prima della partenza
    expect(b.debtsTotal).toBe(850); // 3 rate da 50 + F24 di novembre
    expect(b.savings).toBe(300); // fuori dal conto: nel patrimonio, non nel cashflow
    expect(b.net).toBe(2530);
    // a payment due within October is already in the account figure, not among the debts
    const withPayable: Data = {
      ...data,
      invoices: [...data.invoices, { id: 'p', kind: 'collaboratore', party: 'Eta', description: null, amount: 100, invoice_date: '2026-10-02', cash_date: '2026-10-30', settled: false, note: null }],
    };
    const b2 = balanceSheet(withPayable, TODAY);
    expect(b2.onAccount).toBe(480);
    expect(b2.debts.payables).toBe(0);
    expect(b2.net).toBe(2430);
    expect(balanceSheet({ ...data, settings: { ...data.settings, cf_opening: null } }, TODAY).net).toBeNull();
  });
  it('rate nelle prossime settimane', () => {
    expect(installmentsBetween(data, TODAY, '2026-12-09').map((r) => [r.date, r.amount])).toEqual([
      ['2026-11-01', 50],
      ['2026-12-01', 50],
    ]);
  });
  it('da completare', () => {
    const items = toComplete(data, TODAY);
    expect(items.map((x) => x.label)).toEqual(['Importo di «Bollo»']);
    expect(items[0].target.kind).toBe('cost');
  });
});
