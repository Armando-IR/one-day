import { useMemo } from 'react';
import { useData } from '../state/data';
import { useUi } from '../state/ui';
import { balanceSheet, debtsOverview, economic } from '../lib/finance';
import { monthIdx } from '../lib/dates';
import { Amount, Block } from '../ui/components';
import { dayMonth, dayMonthYear, eur, monthLong, monthName, prepA } from '../ui/format';

const rateCount = (k: number) => (k === 1 ? '1 rata' : `${k} rate`);

/**
 * Stato patrimoniale at the end of the month (what you have, what you owe, the difference),
 * then the debts one by one, as the "Debiti" sheet had them: installments, F24, collaborators.
 */
export function Patrimonio() {
  const { data, today } = useData();
  const { open, go } = useUi();
  const b = useMemo(() => balanceSheet(data, today), [data, today]);
  const o = useMemo(() => debtsOverview(data, today), [data, today]);
  const e = useMemo(() => economic(data), [data]);
  const year = data.settings.ce_start.slice(0, 4);
  const mese = monthName(b.month);
  const missing = [
    b.ratesIncomplete > 0 && (b.ratesIncomplete === 1 ? '1 rata senza dati' : `${b.ratesIncomplete} rate senza dati`),
    b.taxesMissing > 0 && (b.taxesMissing === 1 ? '1 F24 senza importo' : `${b.taxesMissing} F24 senza importo`),
  ].filter(Boolean);

  return (
    <>
      <Block title={`Stato patrimoniale a fine ${mese}`}>
        <div className="panel kv">
          <div className="kv-head"><span>Quello che hai</span></div>
          <div>
            <span>Sul conto</span>
            {b.hasCash ? <Amount value={b.onAccount} />
              : <button className="link-btn inline" onClick={() => open({ type: 'opening' })}>Inserisci il saldo</button>}
          </div>
          <div><span>Risparmi fuori dal conto</span><span className="num">{eur(b.savings)}</span></div>
          <div><span>Fatture da incassare</span><span className="num">{eur(b.credits)}</span></div>
          {b.hasCash && <div className="subtotal"><span>Totale</span><Amount value={b.assets} /></div>}
          <div className="kv-head"><span>Quello che devi</span></div>
          <div><span>Rate e prestiti</span><span className="num">{eur(b.debts.rates)}</span></div>
          <div><span>Tasse (F24)</span><span className="num">{eur(b.debts.taxes)}</span></div>
          <div><span>Collaboratori da pagare</span><span className="num">{eur(b.debts.payables)}</span></div>
          <div className="subtotal"><span>Totale</span><span className="num">{eur(b.debtsTotal)}</span></div>
          <div className="total">
            <span>Patrimonio netto</span>
            {b.net === null ? <span className="muted">serve il saldo del conto</span> : <Amount value={b.net} />}
          </div>
        </div>
        <p className="muted small">
          Crediti e debiti sono quelli che restano aperti dopo {mese}: incassi e pagamenti di {mese} sono già nel saldo del conto.
          {missing.length > 0 && ` Non contati: ${missing.join(' e ')}.`}
        </p>
      </Block>

      <Block title="Risparmi fuori dal conto" action={<button className="link-btn" onClick={() => open({ type: 'saving' })}>Aggiungi</button>}>
        {data.savings.length ? (
          <ul className="list panel">
            {[...data.savings].sort((x, y) => y.amount - x.amount).map((s) => (
              <li key={s.id}>
                <button className="row" onClick={() => open({ type: 'saving', initial: s })}>
                  <span className="row-main">
                    <span className="row-title">{s.name}</span>
                    {s.note && <span className="row-sub">{s.note}</span>}
                  </span>
                  <span className="row-end num">{eur(s.amount)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="panel empty">
            Soldi messi da parte che non sono sul conto, come un conto deposito o un libretto. Contano nel patrimonio, non nel cashflow.
          </p>
        )}
      </Block>

      <Block title="Rate e prestiti" action={<button className="link-btn" onClick={() => open({ type: 'debt' })}>Aggiungi</button>}>
        {o.ratesThisMonth > 0 && (
          <p className="muted small" style={{ marginTop: 0 }}>
            Questo mese paghi <span className="num">{eur(o.ratesThisMonth)}</span> di rate, addebitate il 1°.
          </p>
        )}
        {o.rate.length ? (
          <ul className="list panel">
            {o.rate.map(({ debt: d, complete, left, residual }) => {
              const notStarted = complete && monthIdx(d.first_month!) > monthIdx(today);
              const finished = complete && left === 0;
              const sub = !complete
                ? 'Rata, prima e ultima rata da inserire'
                : finished
                  ? `Finita ${prepA(monthLong(d.last_month!))}`
                  : notStarted
                    ? `${eur(d.installment!)} al mese da ${monthLong(d.first_month!)}, ${rateCount(left)}`
                    : `${eur(d.installment!)} al mese fino ${prepA(monthLong(d.last_month!))}, ${left === 1 ? 'ne resta 1' : `ne restano ${left}`}`;
              return (
                <li key={d.id}>
                  <button className="row" onClick={() => open({ type: 'debt', initial: d })}>
                    <span className="row-main">
                      <span className={`row-title ${finished ? 'muted' : ''}`}>{d.name}</span>
                      <span className="row-sub">{sub}</span>
                    </span>
                    <span className="row-end">
                      {!complete ? <span className="badge todo">Inserisci</span>
                        : finished ? <span className="badge done">Pagato</span>
                        : <span className="num">{eur(residual)}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="panel empty">Nessun debito a rate. Quelli che aggiungi entrano nel cashflow, mese per mese.</p>
        )}
      </Block>

      <Block title="Tasse (F24)" action={<button className="link-btn" onClick={() => open({ type: 'tax' })}>Aggiungi</button>}>
        {o.upcomingTaxes.length || o.pastTaxes.length ? (
          <ul className="list panel">
            {o.upcomingTaxes.map((t) => (
              <li key={t.id}>
                <button className="row" onClick={() => open({ type: 'tax', initial: t })}>
                  <span className="row-main">
                    <span className="row-title">{t.description}</span>
                    <span className="row-sub">Entro il {dayMonthYear(t.due_date)}</span>
                  </span>
                  <span className="row-end">{t.amount == null ? <span className="badge todo">Inserisci</span> : <span className="num">{eur(t.amount)}</span>}</span>
                </button>
              </li>
            ))}
            {o.pastTaxes.map((t) => (
              <li key={t.id}>
                <button className="row" onClick={() => open({ type: 'tax', initial: t })}>
                  <span className="row-main">
                    <span className="row-title muted">{t.description}</span>
                    <span className="row-sub">Scadenza passata, il {dayMonthYear(t.due_date)}</span>
                  </span>
                  <span className="row-end num muted">{t.amount == null ? '' : eur(t.amount)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="panel empty">Nessuna scadenza. Aggiungi gli F24 con la data e, appena lo sai, l'importo.</p>
        )}
        {e.totals.tasse < 0 && (
          <p className="muted small">
            Per orientarti: le tasse stimate dal conto economico del {year} sono <span className="num">{eur(-e.totals.tasse)}</span>.
          </p>
        )}
      </Block>

      <Block title="Collaboratori da pagare"
        action={<button className="link-btn" onClick={() => go('lavori', { lavori: 'pagare' })}>Vai a Lavori</button>}>
        {o.payables.length ? (
          <ul className="list panel">
            {o.payables.map((i) => (
              <li key={i.id}>
                <button className="row" onClick={() => open({ type: 'invoice', kind: i.kind, initial: i })}>
                  <span className="row-main">
                    <span className="row-title">{i.party}</span>
                    <span className="row-sub">
                      {i.description ? `${i.description}, ` : ''}
                      {i.cash_date ? `da pagare il ${dayMonth(i.cash_date)}` : 'data di pagamento da inserire'}
                    </span>
                  </span>
                  <span className="row-end num">{eur(i.amount)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="panel empty">Nessun collaboratore da pagare.</p>
        )}
      </Block>

      <p className="muted small">
        Le fatture da incassare, una per una, sono in{' '}
        <button className="link-btn" onClick={() => go('lavori', { lavori: 'incassare' })}>Lavori, Da incassare</button>.
      </p>
    </>
  );
}
