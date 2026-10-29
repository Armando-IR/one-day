import { useMemo, useState } from 'react';
import { useData } from '../state/data';
import { SPAN_KEY, useUi } from '../state/ui';
import {
  cashflow, credits, debtsOverview, forecast, monthStatement, movementsBetween, openInvoices, sum, toComplete,
  type FixTarget, type Movement,
} from '../lib/finance';
import { analysis, STATUS_LABEL } from '../lib/analysis';
import { addDays, monthIdx } from '../lib/dates';
import { Amount, Block, Progress, Segmented } from '../ui/components';
import { HorizonChart } from '../ui/charts';
import { IconBack, IconDown, IconForward, IconSettings } from '../ui/icons';
import { cap, dayMonth, eur, monthLong, monthName, pct, prepA } from '../ui/format';

/** Under each entry: when it is, and what kind of entry when the title doesn't say it. */
function moveSub(m: Movement, today: string) {
  const late = !m.settled && m.date < today;
  switch (m.kind) {
    case 'incasso': return `${dayMonth(m.date)}${m.settled ? ', già incassato' : late ? ', in ritardo' : ''}`;
    case 'pagamento': return `${dayMonth(m.date)}${m.settled ? ', già pagato' : late ? ', ancora da pagare' : ''}`;
    case 'una_tantum': return `Spesa una tantum, ${monthName(m.date)}`;
    case 'annuale': return `Spesa di ogni anno, ${monthName(m.date)}`;
    case 'desiderio': return `Desiderio, ${monthName(m.date)}`;
    case 'entrata': return `${m.income && m.income.frequency === 'annuale' ? 'Entrata di ogni anno' : 'Entrata una tantum'}, ${monthName(m.date)}`;
    default: return dayMonth(m.date);
  }
}

/** "Nel mese entrano 2.400 € ed escono 900 €", said naturally when one of the two is zero. */
function inOut(inflow: number, outflow: number, past: boolean) {
  const hasIn = inflow > 0.5;
  const hasOut = outflow > 0.5;
  const entra = past ? (hasIn ? `sono entrati ${eur(inflow)}` : 'non è entrato niente') : hasIn ? `entrano ${eur(inflow)}` : 'non entra niente';
  const esce = past ? (hasOut ? `sono usciti ${eur(outflow)}` : 'non è uscito niente') : hasOut ? `escono ${eur(outflow)}` : 'non esce niente';
  if (!hasIn && !hasOut) return past ? 'Nel mese non è entrato né uscito niente.' : 'Nel mese non entra e non esce niente.';
  return `Nel mese ${entra} ${/^e/.test(esce) ? 'ed' : 'e'} ${esce}.`;
}

/** One entry of money in or out. A tap opens its record, where the notes are. */
function MoveRow({ m }: { m: Movement }) {
  const { today } = useData();
  const { go, open } = useUi();
  const onOpen = () => {
    if (m.invoice) open({ type: 'invoice', kind: m.invoice.kind, initial: m.invoice });
    else if (m.tax) open({ type: 'tax', initial: m.tax });
    else if (m.cost) open({ type: 'cost', scope: m.cost.scope, initial: m.cost });
    else if (m.wish) open({ type: 'wish', initial: m.wish });
    else if (m.income) open({ type: 'income', initial: m.income });
    else if (m.debts && m.debts.length === 1) open({ type: 'debt', initial: m.debts[0] });
    else go('conti', { conti: 'patrimonio' });
  };
  return (
    <li>
      <button className="row" onClick={onOpen}>
        <span className="row-main">
          <span className="row-title">{m.text}</span>
          <span className="row-sub">{moveSub(m, today)}</span>
        </span>
        <span className="row-end">{m.amount == null ? <span className="badge todo">Importo da inserire</span> : <Amount value={m.amount} signed />}</span>
      </button>
    </li>
  );
}

/** Another month than the current one: money on the 1st, every entry, the monthly expenses, money at the end. */
function MonthEntries({ month, showBalance }: { month: string; showBalance: boolean }) {
  const { data } = useData();
  const { go } = useUi();
  const st = useMemo(() => monthStatement(data, month), [data, month]);
  const name = monthName(month);
  const hasRecurring = Math.abs(st.recurring) > 0.004;
  const hasRecurringIn = Math.abs(st.recurringIn) > 0.004;
  if (!st.items.length && !hasRecurring && !hasRecurringIn && !(showBalance && st.opening != null)) {
    return <p className="panel empty">Nessuna entrata o uscita {prepA(name)}.</p>;
  }
  return (
    <ul className="list panel">
      {showBalance && st.opening != null && (
        <li className="row edge"><span className="row-main">Sul conto il 1° {name}</span><Amount value={st.opening} /></li>
      )}
      {hasRecurringIn && (
        <li>
          <button className="row" onClick={() => go('conti', { conti: 'spese' })}>
            <span className="row-main">
              <span className="row-title">Entrate di ogni mese</span>
              <span className="row-sub">Stipendio, pensione e le altre che non sono fatture</span>
            </span>
            <span className="row-end"><Amount value={st.recurringIn} signed /></span>
          </button>
        </li>
      )}
      {st.items.map((m, i) => <MoveRow key={i} m={m} />)}
      {hasRecurring && (
        <li>
          <button className="row" onClick={() => go('conti', { conti: 'spese' })}>
            <span className="row-main">
              <span className="row-title">Spese di ogni mese</span>
              <span className="row-sub">Personali e di lavoro</span>
            </span>
            <span className="row-end"><Amount value={st.recurring} signed /></span>
          </button>
        </li>
      )}
      {showBalance && st.closing != null && (
        <li className="row edge total"><span className="row-main">Sul conto a fine {name}</span><Amount value={st.closing} /></li>
      )}
    </ul>
  );
}

/** How many months the chart shows, from the current one. Remembered on this device. */
type Span = '6' | '12' | '24';
const SPANS: { value: Span; label: string }[] = [
  { value: '6', label: '6 mesi' },
  { value: '12', label: '1 anno' },
  { value: '24', label: '2 anni' },
];
function readSpan(): Span {
  try {
    const v = localStorage.getItem(SPAN_KEY);
    return v === '6' || v === '24' ? v : '12';
  } catch {
    return '12';
  }
}

export function Home() {
  const { data, today } = useData();
  const { go, open } = useUi();
  const f = useMemo(() => forecast(data, today), [data, today]);
  const cash = useMemo(() => cashflow(data), [data]);
  const [span, setSpanState] = useState<Span>(readSpan);
  const setSpan = (v: Span) => {
    setSpanState(v);
    try {
      localStorage.setItem(SPAN_KEY, v);
    } catch {
      /* the choice then lasts until the app is closed */
    }
  };
  const spanMonths = Number(span);
  const cr = useMemo(() => credits(data, today), [data, today]);
  const payables = useMemo(() => openInvoices(data, 'collaboratore'), [data]);
  const todo = useMemo(() => toComplete(data, today), [data, today]);
  const dov = useMemo(() => debtsOverview(data, today), [data, today]);
  const [allTodo, setAllTodo] = useState(false);
  const year = data.settings.ce_start.slice(0, 4);

  // The month shown: the current one, or another month of the cashflow chosen from the list, with the arrows or on the chart.
  const months = f.liquidity.map((l) => l.month);
  const todayIdx = months.findIndex((m) => monthIdx(m) === monthIdx(today));
  const home = todayIdx >= 0 ? todayIdx : monthIdx(today) > monthIdx(months[months.length - 1]) ? months.length - 1 : 0;
  const [picked, setPicked] = useState<string | null>(null);
  const k = picked && months.includes(picked) ? months.indexOf(picked) : home;
  const pick = (i: number) => setPicked(i === home ? null : months[i]);
  const atHome = k === home;
  const sel = f.liquidity[k];
  const past = monthIdx(sel.month) < monthIdx(today);
  const st = useMemo(() => (atHome ? null : monthStatement(data, sel.month)), [atHome, data, sel.month]);

  // The chart: the chosen number of months from the current one, moved just enough to include the month shown.
  let from = Math.min(home, k);
  let to = Math.min(months.length - 1, from + spanMonths - 1);
  if (k > to) {
    to = k;
    from = Math.max(0, k - spanMonths + 1);
  }
  const win = f.liquidity.slice(from, to + 1);
  const ahead = f.liquidity.slice(home, home + spanMonths);
  const firstNeg = ahead.find((l) => l.closing < 0) ?? null;
  const lastAhead = ahead[ahead.length - 1];

  // A "to complete" item opens the form of the record with the missing data.
  const fix = (t: FixTarget) => {
    if (t.kind === 'opening') open({ type: 'opening' });
    else if (t.kind === 'cost') open({ type: 'cost', scope: t.row.scope, initial: t.row });
    else if (t.kind === 'debt') open({ type: 'debt', initial: t.row });
    else if (t.kind === 'income') open({ type: 'income', initial: t.row });
    else open({ type: 'tax', initial: t.row });
  };

  const debtsMissing = dov.ratesIncomplete + dov.taxesMissing;
  const hasDebts = dov.total > 0 || debtsMissing > 0;
  const debtParts = [
    dov.ratesResidual > 0 && `rate ${eur(dov.ratesResidual)}`,
    dov.taxesTotal > 0 && `F24 ${eur(dov.taxesTotal)}`,
    dov.payablesTotal > 0 && `collaboratori ${eur(dov.payablesTotal)}`,
    debtsMissing > 0 && (debtsMissing === 1 ? '1 voce senza importo' : `${debtsMissing} voci senza importo`),
  ].filter(Boolean).join(', ');

  const hasPipeline = win.some((l) => l.withProbable - l.closing > 0.5);
  const noOpening = data.settings.cf_opening == null;
  const upcoming = useMemo(() => movementsBetween(data, today, addDays(today, 45), true), [data, today]);
  const an = useMemo(() => analysis(data, today), [data, today]);

  return (
    <main className="screen">
      <header className="screen-head home-head">
        {/* the title opens the list of the months: a native menu, quick on the phone */}
        <div className="month-pick">
          <h1 aria-live="polite"><span>{cap(monthLong(sel.month))}</span><IconDown /></h1>
          <select aria-label="Scegli il mese" value={sel.month} onChange={(e) => pick(months.indexOf(e.target.value))}>
            {months.map((m, i) => (
              <option key={m} value={m}>{cap(monthLong(m))}{i === todayIdx ? ' (questo mese)' : ''}</option>
            ))}
          </select>
        </div>
        <div className="head-actions">
          <button className="icon-btn" aria-label="Mese prima" disabled={k === 0} onClick={() => pick(k - 1)}><IconBack /></button>
          <button className="icon-btn" aria-label="Mese dopo" disabled={k === months.length - 1} onClick={() => pick(k + 1)}><IconForward /></button>
          <button className="icon-btn gear" aria-label="Impostazioni" onClick={() => go('impostazioni')}><IconSettings /></button>
        </div>
      </header>
      {!atHome && (
        <button className="link-btn back-home" onClick={() => setPicked(null)}>Torna {prepA(monthName(months[home]))}</button>
      )}

      <div className="horizon">
        {noOpening ? (
          <>
            <p className="horizon-sentence">Per sapere quanto avrai sul conto, parti da quanto avevi il 1° {monthName(cash.start)}.</p>
            <button className="btn" style={{ margin: '14px 0 10px' }} onClick={() => open({ type: 'opening' })}>
              Inserisci il saldo
            </button>
          </>
        ) : (
          <>
            <p className="horizon-sentence">A fine {monthName(sel.month)} {past ? 'avevi' : 'avrai'} sul conto</p>
            <p className={`horizon-figure num ${sel.closing < 0 ? 'neg' : ''}`}>{eur(sel.closing)}</p>
            {atHome || !st ? (
              <p className="horizon-note">
                {firstNeg
                  ? `Il conto va sotto zero ${prepA(monthLong(firstNeg.month))}.`
                  : `Nei prossimi ${spanMonths} mesi il conto resta sopra zero.`}{' '}
                {lastAhead.withProbable - lastAhead.closing > 0.5 &&
                  `Con i lavori probabili, ${prepA(monthLong(lastAhead.month))} avresti ${eur(lastAhead.withProbable)}.`}
              </p>
            ) : (
              <p className="horizon-note">
                {inOut(st.in, -st.out, past)}{' '}
                {!past && sel.withProbable - sel.closing > 0.5 && `Con i lavori probabili avresti ${eur(sel.withProbable)}.`}
              </p>
            )}
          </>
        )}
        {!noOpening && (
          <>
            <HorizonChart months={win.map((l) => l.month)} values={win.map((l) => l.closing)}
              probable={hasPipeline ? win.map((l) => l.withProbable) : undefined}
              selected={k - from} onSelect={(i) => pick(from + i)}
              describe={(i) => `${cap(monthLong(win[i].month))}: ${eur(win[i].closing)} a fine mese`} />
            <Segmented className="span-seg" label="Mesi nel grafico" options={SPANS} value={span} onChange={setSpan} />
            <ul className="legend">
              <li><i style={{ background: 'var(--accent)' }} />Saldo a fine mese</li>
              {hasPipeline && <li><i style={{ background: 'var(--accent-soft)', outline: '1px dashed var(--accent)' }} />Con i lavori probabili</li>}
            </ul>
          </>
        )}
      </div>

      {!atHome ? (
        <Block title={`Entrate e uscite di ${monthName(sel.month)}`}>
          <MonthEntries month={sel.month} showBalance={!noOpening} />
        </Block>
      ) : (
        <>
          <button className="panel row analysis-entry" onClick={() => go('analisi')}>
            <span className={`status-dot ${an.status}`} aria-hidden="true" />
            <span className="row-main">
              <span className="row-title">Analisi della situazione</span>
              <span className="row-sub">
                {STATUS_LABEL[an.status]}{an.todo > 0 ? `, ${an.todo === 1 ? '1 cosa da fare' : `${an.todo} cose da fare`}` : ''}
              </span>
            </span>
            <span className="row-chevron"><IconForward /></span>
          </button>

          <Block title={`Il minimo del ${year}`} action={<button className="link-btn" onClick={() => go('piani', { piani: 'obiettivi' })}>Obiettivi</button>}>
            <div className="panel goal">
              <p><span className="goal-figure num">{pct(f.reached)}</span> <span className="muted">raggiunto</span></p>
              <Progress confirmed={f.reached} probable={f.reachedWithProbable} />
              <p className="muted small">
                Margine di {eur(f.confirmedYear)} su un minimo di {eur(f.baselineYear)}.{' '}
                {f.missing > 0 ? `Ti mancano ${eur(f.missing)}.` : 'Minimo raggiunto.'}{' '}
                {f.reachedWithProbable > f.reached + 0.005 && `Con i lavori probabili arrivi al ${pct(f.reachedWithProbable)}.`}
              </p>
            </div>
          </Block>

          {hasDebts && (
            <Block title="Debiti">
              <button className="panel row" onClick={() => go('conti', { conti: 'patrimonio' })}>
                <span className="row-main">
                  <span className="row-title"><span className="num">{eur(dov.total)}</span> ancora da pagare</span>
                  <span className="row-sub">{cap(debtParts)}</span>
                </span>
              </button>
            </Block>
          )}

          {(cr.lateCount > 0 || payables.length > 0 || todo.length > 0) && (
            <Block title="Da sistemare">
              <ul className="list panel">
                {cr.lateCount > 0 && (
                  <li>
                    <button className="row" onClick={() => go('lavori', { lavori: 'incassare' })}>
                      <span className="row-main">
                        <span className="row-title">{cr.lateCount === 1 ? '1 incasso in ritardo' : `${cr.lateCount} incassi in ritardo`}</span>
                        <span className="row-sub">Sollecita o sposta la data di incasso</span>
                      </span>
                      <span className="row-end num">{eur(cr.late)}</span>
                    </button>
                  </li>
                )}
                {payables.length > 0 && (
                  <li>
                    <button className="row" onClick={() => go('lavori', { lavori: 'pagare' })}>
                      <span className="row-main">
                        <span className="row-title">Collaboratori da pagare</span>
                        <span className="row-sub">{payables.length === 1 ? '1 fattura' : `${payables.length} fatture`}</span>
                      </span>
                      <span className="row-end num">{eur(sum(payables.map((p) => p.amount)))}</span>
                    </button>
                  </li>
                )}
                {(allTodo ? todo : todo.slice(0, 6)).map((t) => (
                  <li key={t.label}>
                    <button className="row" onClick={() => fix(t.target)}>
                      <span className="row-main">
                        <span className="row-title">{t.target.kind === 'opening' ? `Saldo del conto al 1° ${monthName(cash.start)}` : t.label}</span>
                        <span className="row-sub">Da completare</span>
                      </span>
                      <span className="badge todo">Inserisci</span>
                    </button>
                  </li>
                ))}
                {todo.length > 6 && !allTodo && (
                  <li><button className="row" onClick={() => setAllTodo(true)}><span className="row-main muted">Altre {todo.length - 6} cose da completare</span></button></li>
                )}
              </ul>
            </Block>
          )}

          <Block title="Nelle prossime settimane">
            {upcoming.length === 0 ? (
              <p className="panel empty">Nessun incasso o pagamento in programma nei prossimi 45 giorni.</p>
            ) : (
              <ul className="list panel">
                {upcoming.slice(0, 6).map((m, i) => <MoveRow key={i} m={m} />)}
              </ul>
            )}
          </Block>
        </>
      )}
    </main>
  );
}
