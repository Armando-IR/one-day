import { useMemo, useState } from 'react';
import { useData } from '../state/data';
import { useUi, type ContiView } from '../state/ui';
import { Patrimonio } from './Patrimonio';
import { Spese } from './Spese';
import { cashHorizon, cashflow, economic, forecast, type CashMonth, type EconomicMonth } from '../lib/finance';
import { monthIdx } from '../lib/dates';
import { Amount, Block, Screen, Segmented } from '../ui/components';
import { cap, eur, monthLong, monthName, pct } from '../ui/format';

function Line({ label, value, total }: { label: string; value: number; total?: boolean }) {
  return (
    <div className={total ? 'total' : undefined}>
      <span>{label}</span>
      <Amount value={value} />
    </div>
  );
}

function CashCard({ m, probable, open, onToggle }: { m: CashMonth; probable: number | null; open: boolean; onToggle: () => void }) {
  const lines: [string, number][] = [
    ['Incassi dai clienti', m.incassi],
    ['Altre entrate', m.entrate],
    ['Pagamenti ai collaboratori', m.collaboratori],
    ['Spese di lavoro', m.speseLavoro],
    ['Spese personali', m.spesePersonali],
    ['Rate', m.rate],
    ['Tasse (F24)', m.tasse],
    ['Spese una tantum', m.unaTantum],
    ['Wishlist', m.desideri],
  ];
  return (
    <li className="month">
      <button className="month-head" aria-expanded={open} onClick={onToggle}>
        <strong>{cap(monthLong(m.month))}</strong>
        <span className="muted small">fine mese <Amount value={m.closing} className="strong" /></span>
      </button>
      {open && (
        <div className="month-lines">
          <Line label="Sul conto a inizio mese" value={m.opening} />
          {lines.filter(([, v]) => Math.abs(v) > 0.004).map(([l, v]) => <Line key={l} label={l} value={v} />)}
          <Line label="Sul conto a fine mese" value={m.closing} total />
          {probable !== null && (
            <div className="muted"><span>Con i lavori probabili</span><Amount value={probable} /></div>
          )}
        </div>
      )}
    </li>
  );
}

function EconomicCard({ m, open, onToggle }: { m: EconomicMonth; open: boolean; onToggle: () => void }) {
  return (
    <li className="month">
      <button className="month-head" aria-expanded={open} onClick={onToggle}>
        <strong>{cap(monthLong(m.month))}</strong>
        <span className="muted small">ti resta <Amount value={m.resta} /></span>
      </button>
      {open && (
        <div className="month-lines">
          <Line label="Ricavi" value={m.ricavi} />
          <Line label="Collaboratori" value={m.collaboratori} />
          <Line label="Margine" value={m.margine} total />
          <Line label="Spese di lavoro" value={m.speseLavoro} />
          <Line label="Tasse stimate" value={m.tasse} />
          {Math.abs(m.altreEntrate) > 0.004 && <Line label="Altre entrate" value={m.altreEntrate} />}
          <Line label="Spese personali" value={m.spesePersonali} />
          <Line label="Ti resta" value={m.resta} total />
        </div>
      )}
    </li>
  );
}

function Cassa() {
  const { data, today } = useData();
  const { open } = useUi();
  // the same months as the forecast: from the start of the cashflow to two years from now
  const cash = useMemo(() => cashflow(data, cashHorizon(today)), [data, today]);
  const f = useMemo(() => forecast(data, today), [data, today]);
  const current = cash.months.findIndex((m) => monthIdx(m.month) === monthIdx(today));
  const [expanded, setExpanded] = useState<number>(current >= 0 ? current : 0);
  const hasPipeline = f.liquidity.some((l) => l.probableIn > 0);
  return (
    <>
      <div className="panel row" style={{ marginBottom: 16 }}>
        <span className="row-main">
          <span className="row-title">Si parte dal 1° {monthLong(cash.start)}</span>
          <span className="row-sub">
            {data.settings.cf_opening == null ? 'Saldo iniziale da inserire' : <>con <span className="num">{eur(data.settings.cf_opening)}</span> sul conto</>}
          </span>
        </span>
        <button className="link-btn" onClick={() => open({ type: 'opening' })}>Modifica</button>
      </div>
      {cash.lateCredits > 0 && (
        <p className="banner">
          {eur(cash.lateCredits)} di incassi in ritardo non sono contati. Se pensi che arriveranno, sposta la data di incasso in Lavori.
        </p>
      )}
      <ul className="list panel">
        {cash.months.map((m, i) => (
          <CashCard key={m.month} m={m} open={expanded === i} onToggle={() => setExpanded(expanded === i ? -1 : i)}
            probable={hasPipeline ? f.liquidity[i].withProbable : null} />
        ))}
      </ul>
      <p className="muted small" style={{ marginTop: 14 }}>
        Contano le date di incasso e di pagamento. Le spese annuali cadono nel mese in cui le paghi; le rate il 1° del mese.
      </p>
    </>
  );
}

function Economico() {
  const { data } = useData();
  const { open } = useUi();
  const e = useMemo(() => economic(data), [data]);
  const [expanded, setExpanded] = useState(-1);
  const t = e.totals;
  return (
    <>
      <div className="panel row" style={{ marginBottom: 16 }}>
        <span className="row-main">
          <span className="row-title">Da {monthLong(data.settings.ce_start)}</span>
          <span className="row-sub">12 mesi, per data della fattura</span>
        </span>
        <button className="link-btn" onClick={() => open({ type: 'year' })}>Modifica</button>
      </div>
      <Block title="Nell'anno">
        <div className="panel kv">
          <Line label="Ricavi" value={t.ricavi} />
          <Line label="Collaboratori" value={t.collaboratori} />
          <Line label="Margine" value={t.margine} total />
          <Line label="Spese di lavoro" value={t.speseLavoro} />
          <Line label={`Tasse stimate (${pct(data.settings.tax_rate)})`} value={t.tasse} />
          <Line label="Netto dal lavoro" value={t.nettoLavoro} total />
          {Math.abs(t.altreEntrate) > 0.004 && <Line label="Altre entrate (nette)" value={t.altreEntrate} />}
          <Line label="Spese personali" value={t.spesePersonali} />
          <Line label="Ti resta" value={t.resta} total />
        </div>
      </Block>
      <Block title="Mese per mese">
        <ul className="list panel">
          {e.months.map((m, i) => (
            <EconomicCard key={m.month} m={m} open={expanded === i} onToggle={() => setExpanded(expanded === i ? -1 : i)} />
          ))}
        </ul>
      </Block>
      <p className="muted small">
        Le tasse sono una stima sul reddito di ogni mese: nei mesi in perdita il valore è positivo, perché riduce le tasse dell'anno.
        Le spese annuali qui sono divise per 12; nel cashflow, che parte da {monthName(data.settings.cf_start)}, cadono nel mese in cui le paghi.
      </p>
    </>
  );
}

const VIEWS: { value: ContiView; label: string }[] = [
  { value: 'cassa', label: 'Cassa' },
  { value: 'economico', label: 'Economico' },
  { value: 'patrimonio', label: 'Patrimonio' },
  { value: 'spese', label: 'Spese' },
];

export function Conti() {
  const { contiView, setContiView } = useUi();
  return (
    <Screen title="Conti">
      <Segmented options={VIEWS} value={contiView} onChange={setContiView} />
      {contiView === 'cassa' && <Cassa />}
      {contiView === 'economico' && <Economico />}
      {contiView === 'patrimonio' && <Patrimonio />}
      {contiView === 'spese' && <Spese />}
    </Screen>
  );
}
