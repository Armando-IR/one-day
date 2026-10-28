import { useMemo } from 'react';
import type { Invoice } from '../lib/types';
import { useData } from '../state/data';
import { useUi, type LavoriFilter } from '../state/ui';
import { credits, lateDays, openInvoices, sum } from '../lib/finance';
import { Chips, Screen } from '../ui/components';
import { IconCheck } from '../ui/icons';
import { cap, dayMonth, eur, monthLong } from '../ui/format';

function status(i: Invoice, today: string) {
  const client = i.kind === 'ricavo';
  if (i.settled) return { text: client ? 'Incassata' : 'Pagata', cls: 'done' };
  if (!i.cash_date) return { text: 'Data di incasso da inserire', cls: 'todo' };
  const late = lateDays(i, today);
  if (late > 0) return { text: late === 1 ? 'In ritardo di 1 giorno' : `In ritardo di ${late} giorni`, cls: 'late' };
  return { text: `${client ? 'Arriva il' : 'Da pagare il'} ${dayMonth(i.cash_date)}`, cls: '' };
}

function InvoiceRow({ i }: { i: Invoice }) {
  const { today, edit } = useData();
  const { open } = useUi();
  const s = status(i, today);
  const client = i.kind === 'ricavo';
  return (
    <li className="row">
      <button type="button" role="checkbox" aria-checked={i.settled} className="check"
        aria-label={client ? 'Incassata' : 'Pagata'} onClick={() => void edit('invoices', i.id, { settled: !i.settled })}>
        <IconCheck />
      </button>
      <button type="button" className="row" style={{ padding: 0 }} onClick={() => open({ type: 'invoice', kind: i.kind, initial: i })}>
        <span className="row-main">
          <span className="row-title">{i.party}</span>
          <span className="row-sub">
            {i.description ? `${i.description}, ` : ''}fattura del {dayMonth(i.invoice_date)}
          </span>
          <span className={`badge ${s.cls}`} style={{ marginTop: 4 }}>{s.text}</span>
        </span>
        <span className={`row-end num ${client ? '' : 'muted'}`}>{client ? eur(i.amount) : eur(-i.amount)}</span>
      </button>
    </li>
  );
}

export function Lavori() {
  const { data, today } = useData();
  const { lavoriFilter, setLavoriFilter, open } = useUi();
  const cr = useMemo(() => credits(data, today), [data, today]);
  const payables = useMemo(() => openInvoices(data, 'collaboratore'), [data]);

  const groups = useMemo(() => {
    if (lavoriFilter !== 'tutte') return null;
    const sorted = [...data.invoices].sort((a, b) => b.invoice_date.localeCompare(a.invoice_date));
    const by = new Map<string, Invoice[]>();
    sorted.forEach((i) => {
      const k = `${i.invoice_date.slice(0, 7)}-01`;
      by.set(k, [...(by.get(k) ?? []), i]);
    });
    return [...by.entries()];
  }, [data.invoices, lavoriFilter]);

  const list = lavoriFilter === 'incassare' ? cr.open : lavoriFilter === 'pagare' ? payables : [];
  const options: { value: LavoriFilter; label: string }[] = [
    { value: 'incassare', label: `Da incassare (${cr.open.length})` },
    { value: 'pagare', label: `Da pagare (${payables.length})` },
    { value: 'tutte', label: 'Tutte' },
  ];

  return (
    <Screen title="Lavori">
      <Chips options={options} value={lavoriFilter} onChange={setLavoriFilter} />
      {lavoriFilter === 'incassare' && (
        <p className="muted">
          {cr.open.length ? (
            <>
              <strong className="num" style={{ color: 'var(--ink)' }}>{eur(cr.total)}</strong> da incassare
              {cr.late > 0 && <>, di cui <strong className="num neg">{eur(cr.late)}</strong> in ritardo</>}.
            </>
          ) : 'Tutte le fatture sono incassate.'}
        </p>
      )}
      {lavoriFilter === 'pagare' && (
        <p className="muted">
          {payables.length ? <><strong className="num" style={{ color: 'var(--ink)' }}>{eur(sum(payables.map((p) => p.amount)))}</strong> da pagare ai collaboratori.</> : 'Nessun collaboratore da pagare.'}
        </p>
      )}

      {groups ? (
        groups.length === 0 ? (
          <p className="panel empty">Non hai ancora fatture. Aggiungi la prima con il pulsante +.</p>
        ) : (
          groups.map(([m, rows]) => (
            <section key={m} className="block">
              <div className="block-head">
                <h2>{cap(monthLong(m))}</h2>
                <span className="muted small num">
                  margine {eur(sum(rows.map((r) => (r.kind === 'ricavo' ? r.amount : -r.amount))))}
                </span>
              </div>
              <ul className="list panel">{rows.map((i) => <InvoiceRow key={i.id} i={i} />)}</ul>
            </section>
          ))
        )
      ) : list.length ? (
        <ul className="list panel">{list.map((i) => <InvoiceRow key={i.id} i={i} />)}</ul>
      ) : null}

      <div className="btn-row">
        <button className="btn secondary" onClick={() => open({ type: 'invoice', kind: lavoriFilter === 'pagare' ? 'collaboratore' : 'ricavo' })}>
          {lavoriFilter === 'pagare' ? 'Aggiungi una fattura di un collaboratore' : 'Aggiungi una fattura'}
        </button>
      </div>
    </Screen>
  );
}
