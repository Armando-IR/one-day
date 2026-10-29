import { useMemo, useState, type ReactNode } from 'react';
import { useData } from '../state/data';
import { useUi, type PianiView } from '../state/ui';
import { clients, DEFAULT_PROBS, forecast, probability, probableValue, projections, sum, tierOf, wishMonthly } from '../lib/finance';
import { Block, Screen, Segmented } from '../ui/components';
import { MarginBars } from '../ui/charts';
import { cap, eur, monthLong, monthName, monthShort, pct } from '../ui/format';

const TIER_COLORS = ['var(--t0)', 'var(--t1)', 'var(--t2)', 'var(--t3)'];

/** An amount on the colour of the goal it reaches, like the cells of the Projections sheet. */
function TierCell({ value, tier }: { value: number; tier: number | null }) {
  return <span className={`cell num ${tier === null ? '' : `tier-${tier}`}`}>{eur(value)}</span>;
}

/** The Projections sheet as a table, with every number: margin, average and total, quarters. */
function ProjectionsTable({ p }: { p: ReturnType<typeof projections> }) {
  const g = p.goals;
  const rows: ReactNode[] = [];
  p.rows.forEach((m, i) => {
    rows.push(
      <tr key={m.month} className={m.future ? 'future' : undefined}>
        <th scope="row">{monthShort(m.month)}</th>
        <td><TierCell value={m.margin} tier={m.future ? null : tierOf(m.margin, g)} /></td>
        <td>{!m.future && <TierCell value={m.average} tier={tierOf(m.average, g)} />}</td>
        <td className="num">{!m.future && eur(m.total)}</td>
      </tr>,
    );
    if (i % 3 === 2) {
      const q = p.quarters[(i - 2) / 3];
      rows.push(
        <tr key={`q${q.n}`} className={`quarter ${q.started ? '' : 'future'}`}>
          <th scope="row">{q.n}° trim.</th>
          <td><TierCell value={q.total} tier={q.started ? tierOf(q.total / 3, g) : null} /></td>
          <td colSpan={2} className="muted small">
            {q.started && `${q.complete ? '' : 'in corso, '}minimo ${eur(g.baseline * 3)}`}
          </td>
        </tr>,
      );
    }
  });
  return (
    <div className="panel proj-wrap">
      <table className="proj">
        <thead>
          <tr><th scope="col"><span className="sr-only">Mese</span></th><th scope="col">Margine</th><th scope="col">Media</th><th scope="col">Totale</th></tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  );
}

const PRIORITY: Record<string, string> = { alta: 'Priorità alta', media: 'Priorità media', bassa: 'Priorità bassa' };

function Obiettivi() {
  const { data, today } = useData();
  const { open } = useUi();
  const f = useMemo(() => forecast(data, today), [data, today]);
  const p = useMemo(() => projections(data, today), [data, today]);
  const g = f.goals;
  const s = data.settings;
  const cl = useMemo(() => clients(data), [data]);
  const pctLabel = `Minimo + ${pct(s.savings_pct)} di risparmio`;
  const fixedLabel = `Minimo + ${eur(s.savings_fixed)} di risparmio`;
  const goalsList = [
    { label: 'Minimo', value: g.baseline, note: 'Copre spese di lavoro, tasse e quanto vuoi per te.', color: TIER_COLORS[1] },
    { label: pctLabel, value: g.plusPct, note: 'In più mette da parte una percentuale.', color: TIER_COLORS[tierOf(g.plusPct, g)] },
    { label: fixedLabel, value: g.plusFixed, note: 'In più mette da parte una cifra fissa.', color: TIER_COLORS[tierOf(g.plusFixed, g)] },
    { label: 'Minimo + accantonamenti', value: g.plusWishes, note: 'In più mette da parte per le spese una tantum e la wishlist in programma.', color: 'var(--accent-soft)' },
  ];
  const [lowLabel, highLabel] = g.plusPct <= g.plusFixed ? [pctLabel, fixedLabel] : [fixedLabel, pctLabel];
  // Short names of the four levels, for chips and quarter tiles.
  const short = (l: string) => l.replace(' di risparmio', '');
  const TIER_TEXT = ['Sotto il minimo', 'Minimo', short(lowLabel), short(highLabel)];

  // The month to read: the current one, or the last of the year if the year is over.
  const lastPast = p.rows.reduce((k, r, i) => (r.future ? k : i), 0);
  const [sel, setSel] = useState(lastPast);
  const r = p.rows[Math.min(sel, p.rows.length - 1)];
  const cur = p.rows[lastPast];
  const tAvg = tierOf(cur.average, g);
  const from = monthName(s.ce_start);
  const [showTable, setShowTable] = useState(false);

  return (
    <>
      <Block title="Da inizio anno">
        <div className="panel goal">
          <p className="muted small">Margine medio al mese, da {from}</p>
          <p className="goal-line">
            <span className="goal-figure num">{eur(cur.average)}</span>
            <span className={`cell tier-${tAvg}`}>{TIER_TEXT[tAvg]}</span>
          </p>
          <p className="muted small">
            In tutto {eur(cur.total)} di margine.{' '}
            {f.missing > 0
              ? `Per il minimo dell'anno, ${eur(f.baselineYear)}, mancano ${eur(f.missing)}.`
              : "Il minimo dell'anno è raggiunto."}
          </p>
        </div>
      </Block>

      <Block title="Mese per mese">
        <div className="panel" style={{ padding: '14px 12px 12px' }}>
          <MarginBars months={p.rows.map((m) => m.month)} values={f.margin.map((m) => m.confirmed)}
            probable={f.margin.map((m) => m.probable)} baseline={g.baseline}
            colorOf={(v) => TIER_COLORS[tierOf(v, g)]}
            average={p.rows.map((m) => (m.future ? null : m.average))}
            selected={sel} onSelect={setSel}
            describe={(i) => `${monthLong(p.rows[i].month)}: margine ${eur(p.rows[i].margin)}`} />
          <div className="readout" aria-live="polite">
            <p className="readout-month">{cap(monthLong(r.month))}</p>
            <div className="kv compact">
              <div><span>Margine del mese</span><TierCell value={r.margin} tier={r.future ? null : tierOf(r.margin, g)} /></div>
              <div><span>Media da {from}</span>{r.future ? <span className="muted">ancora da venire</span> : <TierCell value={r.average} tier={tierOf(r.average, g)} />}</div>
              <div><span>Totale da {from}</span>{r.future ? <span className="muted">ancora da venire</span> : <span className="num">{eur(r.total)}</span>}</div>
            </div>
          </div>
          <ul className="legend">
            <li><i style={{ background: 'var(--t0)' }} />Sotto il minimo</li>
            <li><i style={{ background: 'var(--t1)' }} />Minimo</li>
            <li><i style={{ background: 'var(--t2)' }} />{lowLabel}</li>
            <li><i style={{ background: 'var(--t3)' }} />{highLabel}</li>
            <li><i className="avg" />Media da {from}</li>
            <li><i className="dash" />Il minimo, {eur(g.baseline)} al mese</li>
            <li><i style={{ background: 'var(--accent-soft)', outline: '1px dashed var(--accent)' }} />Lavori probabili</li>
          </ul>
        </div>
        <p className="muted small">Tocca un mese per vedere i suoi numeri.</p>
      </Block>

      <Block title="Trimestri">
        <div className="quarters">
          {p.quarters.map((q) => {
            const t = q.started ? tierOf(q.total / 3, g) : null;
            return (
              <div key={q.n} className={`quarter-tile ${t === null ? 'future' : `tier-${t}`}`}>
                <span className="q-label">{q.n}° trimestre</span>
                <span className="q-amount num">{eur(q.total)}</span>
                <span className="q-status">
                  {t === null ? 'Non ancora iniziato' : q.complete ? TIER_TEXT[t] : `In corso, finora ${TIER_TEXT[t].toLowerCase()}`}
                </span>
              </div>
            );
          })}
        </div>
        <p className="muted small">Per un trimestre gli obiettivi valgono per tre: il minimo è {eur(g.baseline * 3)}.</p>
        <button className="link-btn" aria-expanded={showTable} onClick={() => setShowTable(!showTable)}>
          {showTable ? 'Nascondi la tabella' : 'Vedi tutti i numeri in tabella'}
        </button>
        {showTable && <ProjectionsTable p={p} />}
      </Block>

      <Block title="Quanto ti serve al mese" action={<button className="link-btn" onClick={() => open({ type: 'params' })}>Modifica</button>}>
        <ul className="list panel">
          {goalsList.map((x) => (
            <li key={x.label} className="row">
              <span style={{ width: 12, height: 12, borderRadius: 4, background: x.color, flex: 'none' }} />
              <span className="row-main">
                <span className="row-title">{x.label}</span>
                <span className="row-sub">{x.note}</span>
              </span>
              <span className="row-end num">{eur(x.value)}</span>
            </li>
          ))}
        </ul>
        <p className="muted small">
          Margine vuol dire ricavi meno collaboratori. Dipende da quanto vuoi per te ({eur(s.personal_income)} al mese),
          dalle spese di lavoro ({eur(g.business)} al mese) e dalle tasse ({pct(s.tax_rate)}).
          {g.otherIncome > 0.5 && ` Le altre entrate (${eur(g.otherIncome)} al mese, come stipendio o pensione) lo abbassano: coprono già una parte di quello che vuoi per te.`}
        </p>
      </Block>

      {cl.length > 0 && (
        <Block title="Da chi arriva il fatturato">
          <ul className="list panel">
            {cl.slice(0, 6).map((c) => (
              <li key={c.party} className="row">
                <span className="row-main">
                  <span className="row-title">{c.party}</span>
                  <span className="bar" style={{ margin: '6px 0 0', height: 6 }}>
                    <span className="bar-conf" style={{ width: `${c.share * 100}%` }} />
                  </span>
                </span>
                <span className="row-end">
                  <span className="num">{pct(c.share)}</span>
                  <span className="row-sub num">{eur(c.amount)}</span>
                </span>
              </li>
            ))}
          </ul>
        </Block>
      )}

      <p className="muted small">
        {Math.abs(s.personal_income - g.personalCosts) < 0.5
          ? 'Quello che vuoi per te copre giusto le spese personali.'
          : g.covers
            ? `Quello che vuoi per te copre le spese personali: avanzano ${eur(s.personal_income - g.personalCosts)} al mese.`
            : `Quello che vuoi per te non copre le spese personali: mancano ${eur(g.personalCosts - s.personal_income)} al mese.`}
      </p>
    </>
  );
}

function Ipotesi() {
  const { data, today } = useData();
  const { open } = useUi();
  const probs = { ...DEFAULT_PROBS, ...data.settings.phase_probs };
  const f = useMemo(() => forecast(data, today), [data, today]);
  const rows = [...data.pipeline].sort((a, b) => a.expected_month.localeCompare(b.expected_month));
  return (
    <>
      <p className="muted">
        {rows.length ? (
          <>Ipotesi aperte per <strong className="num" style={{ color: 'var(--ink)' }}>{eur(f.openPipeline)}</strong>, con un valore probabile di <strong className="num" style={{ color: 'var(--ink)' }}>{eur(f.probablePipeline)}</strong>.</>
        ) : 'Qui segni i lavori possibili, prima che diventino fatture: ogni ipotesi conta in base a quanto è probabile.'}
      </p>
      {rows.length > 0 && (
        <ul className="list panel">
          {rows.map((p) => (
            <li key={p.id}>
              <button className="row" onClick={() => open({ type: 'pipeline', initial: p })}>
                <span className="row-main">
                  <span className="row-title">{p.name}</span>
                  <span className="row-sub">{[p.client, monthShort(p.expected_month)].filter(Boolean).join(', ')}</span>
                  <span className={`badge ${p.phase === 'Persa' ? 'done' : ''}`} style={{ marginTop: 4 }}>
                    {p.phase}, {pct(probability(p, probs))}
                  </span>
                </span>
                <span className="row-end">
                  <span className="num">{eur(probableValue(p, probs))}</span>
                  <span className="row-sub num">su {eur(p.amount)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="btn-row">
        <button className="btn secondary" onClick={() => open({ type: 'pipeline' })}>Aggiungi un'ipotesi</button>
      </div>
      <p className="muted small" style={{ marginTop: 16 }}>
        Valore probabile = importo per probabilità. Le probabilità per fase si cambiano in{' '}
        <button className="link-btn" onClick={() => open({ type: 'probs' })}>Probabilità per fase</button>.
      </p>
    </>
  );
}

function Desideri() {
  const { data, today } = useData();
  const { open } = useUi();
  const rows = [...data.wishes].sort((a, b) => Number(b.planned) - Number(a.planned) || (a.target_month ?? '9').localeCompare(b.target_month ?? '9'));
  const planned = rows.filter((w) => w.planned);
  return (
    <>
      <p className="muted">
        {planned.length ? (
          <>In programma <strong className="num" style={{ color: 'var(--ink)' }}>{eur(sum(planned.map((w) => w.cost)))}</strong>: metti da parte <strong className="num" style={{ color: 'var(--ink)' }}>{eur(sum(planned.map((w) => wishMonthly(w, today))))}</strong> al mese.</>
        ) : 'Le cose che vuoi comprare. Quelle in programma entrano nel cashflow nel mese scelto e alzano il tuo obiettivo.'}
      </p>
      {rows.length > 0 && (
        <ul className="list panel">
          {rows.map((w) => (
            <li key={w.id}>
              <button className="row" onClick={() => open({ type: 'wish', initial: w })}>
                <span className="row-main">
                  <span className="row-title">{w.name}</span>
                  <span className="row-sub">{PRIORITY[w.priority]}{w.target_month ? `, entro ${monthLong(w.target_month)}` : ''}</span>
                  <span className={`badge ${w.planned ? '' : 'done'}`} style={{ marginTop: 4 }}>{w.planned ? 'In programma' : 'Non in programma'}</span>
                </span>
                <span className="row-end">
                  <span className="num">{eur(w.cost)}</span>
                  {w.planned && w.target_month && <span className="row-sub num">{eur(wishMonthly(w, today))} al mese</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="btn-row">
        <button className="btn secondary" onClick={() => open({ type: 'wish' })}>Aggiungi alla wishlist</button>
      </div>
    </>
  );
}

export function Piani() {
  const { pianiView, setPianiView } = useUi();
  const options: { value: PianiView; label: string }[] = [
    { value: 'obiettivi', label: 'Obiettivi' },
    { value: 'ipotesi', label: 'Ipotesi' },
    { value: 'desideri', label: 'Wishlist' },
  ];
  return (
    <Screen title="Piani">
      <Segmented options={options} value={pianiView} onChange={setPianiView} />
      {pianiView === 'obiettivi' && <Obiettivi />}
      {pianiView === 'ipotesi' && <Ipotesi />}
      {pianiView === 'desideri' && <Desideri />}
    </Screen>
  );
}
