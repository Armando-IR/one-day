import { useMemo } from 'react';
import type { FixedCost, Income, Scope } from '../lib/types';
import { useData } from '../state/data';
import { useUi } from '../state/ui';
import { activeCosts, cashInMonth, isOneOff, monthlyCosts, monthlyEquivalent, monthlyIncome, oneOffSaving, runsIn, sum } from '../lib/finance';
import { addMonths, monthIdx, monthOf } from '../lib/dates';
import { Block } from '../ui/components';
import { eur, eurAuto, monthLong, monthNameByNumber, prepA } from '../ui/format';

const FAMILY_ORDER = ['Casa', 'Quotidiane', 'Motorino', 'Abbonamenti'];

/** In this month's costs: switched on, recurring, and between its first and last month. */
const runsNow = (c: FixedCost, today: string) => c.active && !isOneOff(c) && runsIn(c, today);

/** "da marzo a novembre 2026", "da marzo 2026", "fino a novembre 2026", or nothing. */
function rangeText(c: FixedCost) {
  const s = c.start_month;
  const e = c.end_month;
  if (s && e) return `da ${s.slice(0, 4) === e.slice(0, 4) ? monthNameByNumber(monthOf(s)) : monthLong(s)} ${prepA(monthLong(e))}`;
  if (s) return `da ${monthLong(s)}`;
  if (e) return `fino ${prepA(monthLong(e))}`;
  return '';
}

function costSub(c: FixedCost, today: string) {
  if (!c.active) return 'Sospesa';
  if (isOneOff(c)) {
    if (!c.due_month) return 'Una volta, mese da inserire';
    const past = monthIdx(c.due_month) < monthIdx(today);
    return `Una volta, ${past ? 'era ' : ''}${prepA(monthLong(c.due_month))}`;
  }
  if (c.end_month && monthIdx(c.end_month) < monthIdx(today)) return `Finita ${prepA(monthLong(c.end_month))}`;
  if (!c.amount) return 'Importo da inserire';
  const base = c.frequency === 'mensile' ? 'Ogni mese'
    : c.pay_month ? `${eurAuto(c.amount)} ${prepA(monthNameByNumber(c.pay_month))}` : `${eurAuto(c.amount)} l'anno, mese da inserire`;
  const range = rangeText(c);
  return range ? `${base}, ${range}` : base;
}

/** An income that is not an invoice: salary, pension, a rent received. */
function IncomeRow({ x }: { x: Income }) {
  const { today } = useData();
  const { open } = useUi();
  const oneOff = isOneOff(x);
  const sub = costSub({ ...x, scope: 'personale', family: null }, today);
  const past = oneOff && !!x.due_month && monthIdx(x.due_month) < monthIdx(today);
  const dim = oneOff ? !x.active || past : !(x.active && runsIn(x, today));
  return (
    <li>
      <button className="row" onClick={() => open({ type: 'income', initial: x })}>
        <span className="row-main">
          <span className={`row-title ${dim ? 'muted' : ''}`}>{x.name}</span>
          <span className="row-sub">{sub}</span>
        </span>
        <span className={`row-end ${dim ? 'muted' : ''}`}>
          {!x.amount ? <span className="badge todo">Inserisci</span> : <span className="num pos">+{eurAuto(oneOff ? x.amount : monthlyEquivalent(x))}</span>}
        </span>
      </button>
    </li>
  );
}

function CostRow({ c }: { c: FixedCost }) {
  const { today } = useData();
  const { open } = useUi();
  const oneOff = isOneOff(c);
  const past = oneOff && !!c.due_month && monthIdx(c.due_month) < monthIdx(today);
  // grey: not in this month's costs
  const dim = oneOff ? !c.active || past : !runsNow(c, today);
  const aside = c.active ? oneOffSaving(c, today) : 0;
  return (
    <li>
      <button className="row" onClick={() => open({ type: 'cost', scope: c.scope, initial: c })}>
        <span className="row-main">
          <span className={`row-title ${dim ? 'muted' : ''}`}>{c.name}</span>
          <span className="row-sub">{costSub(c, today)}</span>
        </span>
        <span className={`row-end ${dim ? 'muted' : ''}`}>
          {!c.amount ? <span className="badge todo">Inserisci</span> : (
            <>
              <span className="num">{eurAuto(oneOff ? c.amount : monthlyEquivalent(c))}</span>
              {aside > 0 && <span className="row-sub num">{eur(aside)} al mese da parte</span>}
            </>
          )}
        </span>
      </button>
    </li>
  );
}

/** Recurring ones of this month first, then one-off expenses by month, then the ones switched off, ended or not started yet. */
const byOrder = (today: string) => {
  const rank = (c: FixedCost) => (isOneOff(c) ? 1 : runsNow(c, today) ? 0 : 2);
  return (a: FixedCost, b: FixedCost) =>
    rank(a) - rank(b) || (a.due_month ?? '').localeCompare(b.due_month ?? '') || a.name.localeCompare(b.name);
};

/** Upcoming one-off expenses of a list: total and what to put aside each month. */
function oneOffNote(rows: FixedCost[], today: string) {
  const ahead = rows.filter((c) => c.active && isOneOff(c) && c.due_month && monthIdx(c.due_month) >= monthIdx(today));
  if (!ahead.length) return null;
  return ` Più ${eur(sum(ahead.map((c) => c.amount)))} di spese una tantum in arrivo: ${eur(sum(ahead.map((c) => oneOffSaving(c, today))))} al mese da mettere da parte.`;
}

/** Spese Base and Business Expenses: every month, once a year, or once. */
export function Spese() {
  const { data, today } = useData();
  const { open } = useUi();

  const families = useMemo(() => {
    const order = byOrder(today);
    const personal = data.fixed_costs.filter((c) => c.scope === 'personale');
    const names = [...new Set(personal.map((c) => c.family ?? 'Altro'))].sort(
      (a, b) => (FAMILY_ORDER.indexOf(a) + 1 || 99) - (FAMILY_ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b),
    );
    return names.map((f) => {
      const rows = personal.filter((c) => (c.family ?? 'Altro') === f).sort(order);
      return { name: f, rows, monthly: sum(rows.filter((c) => runsNow(c, today)).map(monthlyEquivalent)) };
    });
  }, [data.fixed_costs, today]);
  const personal = data.fixed_costs.filter((c) => c.scope === 'personale');
  const work = data.fixed_costs.filter((c) => c.scope === 'lavoro').sort(byOrder(today));
  // what will actually be paid from this month on, each expense in its months only
  const next12 = (scope: Scope) => {
    const ms = Array.from({ length: 12 }, (_, i) => addMonths(today, i));
    return sum(activeCosts(data, scope).flatMap((c) => ms.map((m) => cashInMonth(c, m))));
  };

  const incomes = [...data.incomes].sort((a, b) => Number(isOneOff(a)) - Number(isOneOff(b)) || a.name.localeCompare(b.name));
  return (
    <>
      <Block title="Entrate" action={<button className="link-btn" onClick={() => open({ type: 'income' })}>Aggiungi</button>}>
        {incomes.length ? (
          <>
            <p className="muted small" style={{ marginTop: 0 }}>
              Oggi fanno <span className="num">{eur(monthlyIncome(data, today))}</span> al mese. Sono le entrate che non sono fatture,
              già nette: abbassano il minimo da guadagnare con il lavoro.
            </p>
            <ul className="list panel">{incomes.map((x) => <IncomeRow key={x.id} x={x} />)}</ul>
          </>
        ) : (
          <p className="panel empty">Nessuna entrata fissa. Se hai uno stipendio, una pensione o un affitto che ricevi, aggiungilo qui.</p>
        )}
      </Block>

      <Block title="Spese personali" action={<button className="link-btn" onClick={() => open({ type: 'cost', scope: 'personale' })}>Aggiungi</button>}>
        <p className="muted small" style={{ marginTop: 0 }}>
          Oggi fanno <span className="num">{eur(monthlyCosts(data, 'personale', today))}</span> al mese,
          nei prossimi 12 mesi <span className="num">{eur(next12('personale'))}</span>.
          {oneOffNote(personal, today)}
        </p>
        {families.length === 0 ? (
          <p className="panel empty">Nessuna spesa ancora. Aggiungi l'affitto, le bollette, gli abbonamenti.</p>
        ) : (
          families.map((f) => (
            <div key={f.name} className="panel" style={{ marginBottom: 12 }}>
              <div className="row-group" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{f.name}</span>
                {f.monthly > 0 && <span className="num">{eurAuto(f.monthly)} al mese</span>}
              </div>
              <ul className="list">{f.rows.map((c) => <CostRow key={c.id} c={c} />)}</ul>
            </div>
          ))
        )}
      </Block>

      <Block title="Spese di lavoro" action={<button className="link-btn" onClick={() => open({ type: 'cost', scope: 'lavoro' })}>Aggiungi</button>}>
        <p className="muted small" style={{ marginTop: 0 }}>
          Oggi fanno <span className="num">{eur(monthlyCosts(data, 'lavoro', today))}</span> al mese. Riducono le tasse stimate.{oneOffNote(work, today)}
        </p>
        {work.length ? <ul className="list panel">{work.map((c) => <CostRow key={c.id} c={c} />)}</ul> : <p className="panel empty">Nessuna spesa di lavoro.</p>}
      </Block>

      <p className="muted small">
        Le spese di lavoro di ogni mese e di ogni anno entrano nel minimo da guadagnare; quelle personali dovrebbero stare dentro
        quanto vuoi per te ({eur(data.settings.personal_income)} al mese). Una spesa con il mese di inizio o di fine conta solo
        nei mesi in cui c'è; in grigio quelle finite, spente o che devono ancora iniziare. Le spese una tantum entrano nel
        cashflow e nel conto economico del loro mese e nell'obiettivo «Minimo + accantonamenti».
      </p>
    </>
  );
}
