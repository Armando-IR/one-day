// "Analisi": the whole situation in words, from the same numbers as the rest of the app.
// Fixed rules, no AI: it costs nothing, works offline, and the data never leave the app.
// In the text, **…** marks the key figures (shown in bold).
import type { Data, Invoice } from './types';
import {
  balanceSheet, cashflow, clients, credits, debtsOverview, economic, forecast, isOneOff, lateDays, monthlyCosts,
  monthlyEquivalent, oneOffSaving, openInvoices, projections, runsIn, sum, tierOf, toComplete, type FixTarget,
} from './finance';
import { firstOfMonth, monthIdx, parseYMD } from './dates';
import { cap, eur, monthLong, monthName, pct, prepA } from '../ui/format';

export type Status = 'ok' | 'watch' | 'act';
export const STATUS_LABEL: Record<Status, string> = { ok: 'Tutto in ordine', watch: "Da tenere d'occhio", act: 'Da sistemare' };

/** What tapping an action opens. */
export type AnalysisTarget =
  | FixTarget
  | { kind: 'invoice'; row: Invoice }
  | { kind: 'params' }
  | { kind: 'year' }
  | { kind: 'cassa' }
  | { kind: 'home' };

export interface Action {
  text: string;
  sub: string;
  target: AnalysisTarget;
}

export interface Section {
  title: string;
  points: string[];
}

export interface Analysis {
  status: Status;
  /** One or two sentences: the most important things. */
  headline: string[];
  actions: Action[];
  /** How many things there are to do, counting those not listed one by one. */
  todo: number;
  sections: Section[];
}

const RANK: Record<Status, number> = { ok: 0, watch: 1, act: 2 };

/** "a, b e c" */
const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`);
const count = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);
/** The article before a percentage, as it is read: "il 25%", but "l'85%", "l'11%", "l'8%". */
function vowel(v: number) {
  const n = Math.round(v * 100);
  return n === 1 || n === 8 || n === 11 || (n >= 80 && n <= 89);
}
const il = (v: number, bold = false) => `${vowel(v) ? "l'" : 'il '}${bold ? `**${pct(v)}**` : pct(v)}`;
const al = (v: number, bold = false) => `${vowel(v) ? "all'" : 'al '}${bold ? `**${pct(v)}**` : pct(v)}`;
/** A "to complete" label as something to do: "Importo di «Bollo»" becomes "Inserisci l'importo di «Bollo»". */
const toDo = (label: string) =>
  label.replace(/^Importo /, "Inserisci l'importo ").replace(/^Mese di pagamento /, 'Inserisci il mese di pagamento ').replace(/^Dati della rata /, 'Completa i dati della rata ');

/** "30 novembre", with the year when it is not this year's. */
function dayLong(date: string, today: string) {
  const { y, d } = parseYMD(date);
  return `${d} ${monthName(date)}${y !== parseYMD(today).y ? ` ${y}` : ''}`;
}

export function analysis(d: Data, today: string): Analysis {
  const s = d.settings;
  const cur = firstOfMonth(today);
  const ci = monthIdx(cur);
  const f = forecast(d, today);
  const g = f.goals;
  const bs = balanceSheet(d, today);
  const dov = debtsOverview(d, today);
  const cr = credits(d, today);
  const personal = monthlyCosts(d, 'personale', cur);
  const work = monthlyCosts(d, 'lavoro', cur);
  let status: Status = 'ok';
  const raise = (x: Status) => {
    if (RANK[x] > RANK[status]) status = x;
  };
  const headline: string[] = [];
  const actions: Action[] = [];

  // ------------------------------------------------ the account
  const conto: string[] = [];
  const next12 = f.liquidity.filter((l) => monthIdx(l.month) >= ci && monthIdx(l.month) < ci + 12);
  const now = next12[0];
  if (s.cf_opening == null) {
    raise('act');
    conto.push(`Manca il saldo del conto al 1° ${monthLong(s.cf_start)}: senza, l'app non sa quanto avrai sul conto.`);
    headline.push('Manca il saldo di partenza del conto: inseriscilo per sapere quanto avrai.');
    actions.push({ text: 'Inserisci il saldo di partenza', sub: `Quanto avevi sul conto il 1° ${monthLong(s.cf_start)}`, target: { kind: 'opening' } });
  } else if (now) {
    const low = next12.reduce((a, b) => (b.closing < a.closing ? b : a), now);
    const neg = next12.find((l) => l.closing < 0) ?? null;
    conto.push(`A fine ${monthName(now.month)} avrai **${eur(now.closing)}** sul conto.`);
    if (neg) {
      // what is missing in the first month below zero, and at the lowest point
      const needFirst = -neg.closing;
      const needAll = -low.closing;
      conto.push(
        low.month === neg.month
          ? `Contando solo gli incassi già inseriti, il conto va sotto zero ${prepA(monthLong(neg.month))} (**${eur(neg.closing)}**): per restare sopra zero ti servono altri **${eur(needFirst)}** entro quel mese.`
          : `Contando solo gli incassi già inseriti, il conto va sotto zero ${prepA(monthLong(neg.month))} (**${eur(neg.closing)}**) e scende fino a **${eur(low.closing)}** ${prepA(monthLong(low.month))}. Per restare sopra zero ti servono altri **${eur(needFirst)}** entro ${monthName(neg.month)}, e **${eur(needAll)}** in tutto entro ${monthLong(low.month)}.`,
      );
      // urgent within three months; further away, new work usually comes in first
      const ahead = monthIdx(neg.month) - ci;
      if (ahead <= 2) raise('act');
      else if (ahead <= 5) raise('watch');
      headline.push(`Con gli incassi già inseriti, il conto va sotto zero ${prepA(monthLong(neg.month))} (${eur(neg.closing)}).`);
      actions.push({
        text: `Trova ${eur(needFirst)} entro ${monthLong(neg.month)}`,
        sub: needAll > needFirst + 0.5 ? `E ${eur(needAll)} in tutto entro ${monthLong(low.month)}, se non entra altro` : 'Anticipa un incasso o rimanda una spesa',
        target: { kind: 'cassa' },
      });
      if (f.probablePipeline > 0) {
        const negProb = next12.find((l) => l.withProbable < 0) ?? null;
        if (!negProb) conto.push('Con i lavori probabili resteresti sopra zero.');
        else if (monthIdx(negProb.month) > monthIdx(neg.month)) conto.push(`Con i lavori probabili andresti sotto zero solo ${prepA(monthLong(negProb.month))}.`);
        else conto.push('Anche con i lavori probabili il conto va sotto zero.');
      }
      if (bs.savings > 0) {
        conto.push(bs.savings >= needAll
          ? `I **${eur(bs.savings)}** di risparmi fuori dal conto basterebbero a coprire tutto.`
          : bs.savings >= needFirst
            ? `I **${eur(bs.savings)}** di risparmi fuori dal conto coprirebbero ${monthName(neg.month)}, non i mesi dopo.`
            : `I **${eur(bs.savings)}** di risparmi fuori dal conto ne coprirebbero solo una parte.`);
      }
    } else {
      conto.push(`Nei prossimi 12 mesi il conto resta sopra zero: il punto più basso è **${eur(low.closing)}** ${prepA(monthLong(low.month))}.`);
      headline.push('Il conto resta sopra zero nei prossimi 12 mesi.');
      if (bs.savings > 0) conto.push(`In più hai **${eur(bs.savings)}** di risparmi fuori dal conto.`);
    }
    // how long the money lasts if nothing else comes in
    const monthlyOut = personal + work + dov.ratesThisMonth;
    const have = now.closing + bs.savings;
    if (monthlyOut > 0 && have > 0) {
      const m = Math.floor(have / monthlyOut);
      conto.push(m >= 1
        ? `Se non entrasse più niente, con il conto e i risparmi copriresti circa **${count(m, 'mese', 'mesi')}** di spese fisse e rate (${eur(monthlyOut)} al mese).`
        : `Se non entrasse più niente, con il conto e i risparmi non copriresti un mese di spese fisse e rate (${eur(monthlyOut)} al mese).`);
    }
    const lateBefore = cashflow(d, cur).lateCredits;
    if (lateBefore > 0) conto.push(`**${eur(lateBefore)}** di incassi in ritardo non sono contati: se arrivano, il conto sta meglio.`);
  }

  // ------------------------------------------------ work: margin and goals of the year
  const lavoro: string[] = [];
  const proj = projections(d, today);
  const rows = proj.rows;
  const yi = rows.findIndex((r) => monthIdx(r.month) === ci);
  const lastMonth = rows[rows.length - 1].month;
  let average: number | null = null;
  if (yi < 0 && ci > monthIdx(lastMonth)) {
    raise('watch');
    lavoro.push(`L'anno del conto economico è finito ${prepA(monthLong(lastMonth))}: nell'anno il margine è stato **${eur(f.confirmedYear)}**, ${il(f.reached)} del minimo. Aggiorna l'anno per vedere quello in corso.`);
    actions.push({ text: "Aggiorna l'anno del conto economico", sub: `È finito ${prepA(monthLong(lastMonth))}`, target: { kind: 'year' } });
  } else if (yi < 0) {
    lavoro.push(`L'anno del conto economico parte ${prepA(monthLong(rows[0].month))}.`);
  } else {
    const ytd = rows[yi].total;
    average = rows[yi].average;
    const remaining = rows.length - 1 - yi;
    const planned = f.confirmedYear - ytd;
    lavoro.push(`Da inizio anno il margine (ricavi meno collaboratori) è **${eur(ytd)}**, in media **${eur(average)}** al mese. Il minimo da guadagnare è **${eur(g.baseline)}** al mese, **${eur(f.baselineYear)}** nell'anno.`);
    lavoro.push(cap(`${planned > 0.5 ? `con le fatture già in programma arrivi a **${eur(f.confirmedYear)}**: ` : ''}sei ${al(f.reached, true)} del minimo dell'anno.`));
    if (f.missing > 0.5) {
      if (remaining > 0) {
        const need = f.missing / remaining;
        const rest = remaining === 1 ? 'nel mese che resta' : `nei ${remaining} mesi che restano`;
        const vsAverage = average > 0 ? (need > average ? ', più della tua media finora' : ', meno della tua media finora') : '';
        lavoro.push(`Per arrivare al minimo ti mancano **${eur(f.missing)}**: **${eur(need)}** al mese ${rest}${vsAverage}.`);
        if (need > average) raise('watch');
        headline.push(`Al minimo dell'anno mancano ${eur(f.missing)}, cioè ${eur(need)} al mese fino ${prepA(monthName(lastMonth))}.`);
      } else {
        lavoro.push(`Al minimo dell'anno mancano **${eur(f.missing)}**.`);
        headline.push(`Al minimo dell'anno mancano ${eur(f.missing)}.`);
      }
    } else {
      lavoro.push("Il minimo dell'anno è già raggiunto.");
      headline.push("Il minimo dell'anno è raggiunto.");
    }
    if (f.openPipeline > 0) {
      lavoro.push(`Le ipotesi di lavoro aperte valgono **${eur(f.openPipeline)}**; contando la probabilità di ciascuna, **${eur(f.probablePipeline)}**${
        f.reachedWithProbable > f.reached + 0.005 ? `. Con quelle di quest'anno arriveresti ${al(f.reachedWithProbable)} del minimo` : ''}.`);
    }
    const cl = clients(d);
    if (cl.length === 1) lavoro.push(`Tutti i ricavi dell'anno vengono da **${cl[0].party}**: dipendi da un solo cliente.`);
    else if (cl.length > 1 && cl[0].share >= 0.5) lavoro.push(`${cap(il(cl[0].share, true))} dei ricavi dell'anno viene da **${cl[0].party}**: dipendi molto da un solo cliente.`);
    else if (cl.length > 1) lavoro.push(`Il cliente più importante dell'anno è **${cl[0].party}**, con ${il(cl[0].share)} dei ricavi: i ricavi sono ben distribuiti.`);
    const taxes = -economic(d).totals.tasse;
    if (taxes > 0.5) lavoro.push(`Sul margine dell'anno, tolte le spese di lavoro, le tasse stimate sono **${eur(taxes)}** (${pct(s.tax_rate)}).`);
  }

  // ------------------------------------------------ expenses
  const spese: string[] = [];
  const mine = s.personal_income;
  if (personal > 0) {
    spese.push(`Le spese personali di ogni mese sono **${eur(personal)}**${
      mine > 0 ? (personal <= mine ? `, dentro i ${eur(mine)} che vuoi per te` : `: superano di **${eur(personal - mine)}** i ${eur(mine)} che vuoi per te`) : ''}.`);
    if (mine > 0 && personal > mine) {
      raise('watch');
      spese.push('Il minimo da guadagnare si calcola su quanto vuoi per te: se le spese sono di più, il minimo è troppo basso. Alza «quanto vuoi per te» o taglia una spesa.');
      actions.push({ text: 'Rivedi quanto vuoi per te', sub: `Le spese personali (${eur(personal)} al mese) superano i ${eur(mine)} che hai indicato`, target: { kind: 'params' } });
    }
    const byFamily = new Map<string, number>();
    d.fixed_costs
      .filter((c) => c.scope === 'personale' && c.active && !isOneOff(c) && runsIn(c, cur))
      .forEach((c) => byFamily.set(c.family ?? 'Altro', (byFamily.get(c.family ?? 'Altro') ?? 0) + monthlyEquivalent(c)));
    const families = [...byFamily.entries()].sort((a, b) => b[1] - a[1]);
    if (families.length > 1) {
      spese.push(`La famiglia di spese più pesante è **${families[0][0]}**: ${eur(families[0][1])} al mese, ${il(families[0][1] / personal)} delle spese personali.`);
    }
  }
  if (work > 0) spese.push(`Le spese di lavoro sono **${eur(work)}** al mese e riducono le tasse stimate.`);
  const oneOffs = d.fixed_costs.filter((c) => c.active && isOneOff(c) && c.due_month && monthIdx(c.due_month) >= ci && monthIdx(c.due_month) < ci + 12);
  if (oneOffs.length) {
    const aside = sum(oneOffs.map((c) => oneOffSaving(c, today)));
    spese.push(`Nei prossimi 12 mesi hai **${eur(sum(oneOffs.map((c) => c.amount)))}** di spese una tantum (${list(oneOffs.map((c) => c.name))})${
      aside > 0.5 ? `: per averle, metti da parte **${eur(aside)}** al mese` : ''}.`);
  }
  const within12 = (m: string | null, from: number) => !!m && monthIdx(m) >= from && monthIdx(m) < ci + 12;
  const changes = d.fixed_costs
    .filter((c) => c.active && !isOneOff(c) && c.amount > 0)
    .flatMap((c) => {
      const each = `${eur(monthlyEquivalent(c))} al mese`;
      const starts = within12(c.start_month, ci + 1);
      const ends = within12(c.end_month, ci);
      if (starts && ends) return [{ at: c.start_month as string, text: `paghi ${c.name} solo da ${monthLong(c.start_month as string)} a ${monthLong(c.end_month as string)} (${each})` }];
      if (starts) return [{ at: c.start_month as string, text: `da ${monthLong(c.start_month as string)} paghi anche ${c.name} (${each})` }];
      if (ends) return [{ at: c.end_month as string, text: `dopo ${monthLong(c.end_month as string)} non paghi più ${c.name} (${each})` }];
      return [];
    })
    .sort((a, b) => a.at.localeCompare(b.at));
  if (changes.length) spese.push(`Nei prossimi mesi cambia qualcosa: ${changes.map((x) => x.text).join('; ')}.`);
  const noAmount = d.fixed_costs.filter((c) => c.active && !c.amount && (isOneOff(c) || !c.end_month || monthIdx(c.end_month) >= ci));
  if (noAmount.length) {
    const shown = noAmount.slice(0, 3).map((c) => `«${c.name}»`);
    const which = noAmount.length > 3 ? `${shown.join(', ')} e altre` : list(shown);
    spese.push(`${noAmount.length === 1 ? `${shown[0]} non ha ancora un importo` : `${noAmount.length} spese non hanno ancora un importo (${which})`}: finché manca, le spese sembrano più basse del vero.`);
  }
  if (!spese.length) spese.push("Non ci sono ancora spese: aggiungi almeno quelle di ogni mese, così l'analisi del conto è giusta.");

  // ------------------------------------------------ debts and credits
  const dc: string[] = [];
  if (dov.total > 0) {
    const parts = [
      dov.ratesResidual > 0 ? ['di rate', dov.ratesResidual] : null,
      dov.taxesTotal > 0 ? ['di F24', dov.taxesTotal] : null,
      dov.payablesTotal > 0 ? ['ai collaboratori', dov.payablesTotal] : null,
    ].filter((x): x is [string, number] => x !== null);
    dc.push(parts.length === 1
      ? `Devi ancora **${eur(dov.total)}** ${parts[0][0]}.`
      : `Devi ancora **${eur(dov.total)}**: ${list(parts.map(([what, v]) => `${eur(v)} ${what}`))}.`);
  }
  const incomplete = [
    dov.ratesIncomplete ? count(dov.ratesIncomplete, 'rata senza dati', 'rate senza dati') : '',
    dov.taxesMissing ? count(dov.taxesMissing, 'F24 senza importo', 'F24 senza importo') : '',
  ].filter(Boolean);
  if (incomplete.length) dc.push(`Nel totale non ci sono ${list(incomplete)}.`);
  const running = dov.rate.filter((r) => r.complete && r.left > 0);
  if (running.length) {
    const first = [...running].sort((a, b) => (a.debt.last_month ?? '').localeCompare(b.debt.last_month ?? ''))[0];
    dc.push(`Le rate pesano **${eur(dov.ratesThisMonth)}** al mese. La prima a finire è ${first.debt.name}, ${prepA(monthLong(first.debt.last_month as string))}: poi avrai ${eur(first.debt.installment ?? 0)} al mese in più.`);
  }
  const nextTax = dov.upcomingTaxes[0];
  if (nextTax) {
    dc.push(`Il prossimo F24 è «${nextTax.description}» il ${dayLong(nextTax.due_date, today)}${nextTax.amount != null ? `: **${eur(nextTax.amount)}**` : ', ancora senza importo'}.`);
  }
  if (cr.total > 0) dc.push(`I clienti ti devono **${eur(cr.total)}**${cr.late > 0 ? `, di cui **${eur(cr.late)}** in ritardo` : ''}.`);
  if (cr.lateCount > 0) {
    raise('watch');
    headline.push(`${eur(cr.late)} di incassi sono in ritardo.`);
    cr.open
      .filter((i) => !i.cash_date || i.cash_date < today)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3)
      .forEach((i) => actions.push({
        text: `Sollecita ${i.party}`,
        sub: i.cash_date ? `${eur(i.amount)}, in ritardo di ${count(lateDays(i, today), 'giorno', 'giorni')}` : `${eur(i.amount)}, senza data di incasso`,
        target: { kind: 'invoice', row: i },
      }));
  }
  openInvoices(d, 'collaboratore')
    .filter((i) => i.cash_date && i.cash_date < today)
    .slice(0, 2)
    .forEach((i) => actions.push({ text: `Paga ${i.party}`, sub: `${eur(i.amount)}, da pagare dal ${dayLong(i.cash_date as string, today)}`, target: { kind: 'invoice', row: i } }));
  if (bs.net != null) dc.push(`A fine ${monthName(bs.month)} il patrimonio netto, cioè conto, risparmi e crediti meno i debiti, è **${eur(bs.net)}**.`);
  if (!dc.length) dc.push('Non hai debiti e nessun cliente ti deve soldi.');

  // ------------------------------------------------ wishes and savings
  const ds: string[] = [];
  const planned = d.wishes.filter((w) => w.planned && w.target_month && monthIdx(w.target_month) >= ci);
  if (planned.length) ds.push(`Per i desideri in programma (${list(planned.map((w) => w.name))}) metti da parte **${eur(g.wishesMonthly)}** al mese.`);
  const unplanned = d.wishes.filter((w) => !w.planned).length;
  if (unplanned) ds.push(`${cap(count(unplanned, 'desiderio è', 'desideri sono'))} ancora senza un mese in programma.`);
  ds.push(`Per mettere da parte ${eur(s.savings_fixed)} al mese ti serve un margine di **${eur(g.plusFixed)}** al mese; per risparmiare il ${pct(s.savings_pct)}, **${eur(g.plusPct)}**.`);
  if (g.oneOffMonthly + g.wishesMonthly > 0.5) {
    ds.push(`Contando anche quello da mettere da parte per spese una tantum e desideri, il margine che ti serve è **${eur(g.plusWishes)}** al mese.`);
  }
  if (average !== null) {
    const reach = ['resti sotto il minimo', 'copri il minimo, ma non ancora gli obiettivi di risparmio', 'raggiungi il primo obiettivo di risparmio', 'raggiungi tutti e due gli obiettivi di risparmio'];
    ds.push(`Con la media di finora (${eur(average)} al mese) ${reach[tierOf(average, g)]}.`);
  }

  // ------------------------------------------------ missing data, last among the things to do
  const todo = toComplete(d, today).filter((t) => t.target.kind !== 'opening');
  todo.slice(0, 3).forEach((t) => actions.push({ text: toDo(t.label), sub: 'Da completare', target: t.target }));
  const more = Math.max(0, todo.length - 3);
  if (more) actions.push({ text: `Altre ${more} cose da completare`, sub: 'Le trovi tutte in Home, sotto «Da sistemare»', target: { kind: 'home' } });

  return {
    status,
    headline: headline.slice(0, 2),
    actions,
    todo: actions.filter((a) => a.target.kind !== 'home').length + more,
    sections: [
      { title: 'Il conto', points: conto },
      { title: 'Il lavoro', points: lavoro },
      { title: 'Le spese', points: spese },
      { title: 'Debiti e crediti', points: dc },
      { title: 'Desideri e risparmio', points: ds },
    ].filter((x) => x.points.length > 0),
  };
}
