import { useMemo } from 'react';
import { useData } from '../state/data';
import { useUi } from '../state/ui';
import { analysis, STATUS_LABEL, type AnalysisTarget } from '../lib/analysis';
import { parseYMD } from '../lib/dates';
import { Block, Screen } from '../ui/components';
import { IconBack, IconForward } from '../ui/icons';
import { monthName } from '../ui/format';

/** The text of the analysis, with the key figures (between **) in bold. */
function Rich({ text }: { text: string }) {
  return <>{text.split('**').map((part, i) => (i % 2 ? <strong key={i} className="num">{part}</strong> : part))}</>;
}

/** The whole situation in words: what to do first, then the account, work, expenses, debts, wishes. */
export function Analisi() {
  const { data, today } = useData();
  const { go, open } = useUi();
  const a = useMemo(() => analysis(data, today), [data, today]);
  const { d, y } = parseYMD(today);

  const show = (t: AnalysisTarget) => {
    switch (t.kind) {
      case 'opening': return open({ type: 'opening' });
      case 'cost': return open({ type: 'cost', scope: t.row.scope, initial: t.row });
      case 'debt': return open({ type: 'debt', initial: t.row });
      case 'income': return open({ type: 'income', initial: t.row });
      case 'tax': return open({ type: 'tax', initial: t.row });
      case 'invoice': return open({ type: 'invoice', kind: t.row.kind, initial: t.row });
      case 'params': return open({ type: 'params' });
      case 'year': return open({ type: 'year' });
      case 'cassa': return go('conti', { conti: 'cassa' });
      case 'home': return go('home');
    }
  };

  return (
    <Screen title="Analisi"
      action={<button className="icon-btn" aria-label="Torna alla home" onClick={() => go('home')}><IconBack /></button>}>
      <section className={`verdict ${a.status}`}>
        <p className="verdict-label"><i aria-hidden="true" />{STATUS_LABEL[a.status]}</p>
        <p className="verdict-text">{a.headline.join(' ')}</p>
        <p className="muted small">Al {d} {monthName(today)} {y}, con i dati che hai inserito nell'app.</p>
      </section>

      {a.actions.length > 0 && (
        <Block title="Cosa fare adesso">
          <ul className="list panel">
            {a.actions.map((x, i) => (
              <li key={i}>
                <button className="row" onClick={() => show(x.target)}>
                  <span className="row-main">
                    <span className="row-title wrap">{x.text}</span>
                    <span className="row-sub">{x.sub}</span>
                  </span>
                  <span className="row-chevron"><IconForward /></span>
                </button>
              </li>
            ))}
          </ul>
        </Block>
      )}

      {a.sections.map((s) => (
        <Block key={s.title} title={s.title}>
          <div className="panel prose">
            {s.points.map((p, i) => <p key={i}><Rich text={p} /></p>)}
          </div>
        </Block>
      ))}

      <p className="muted small">
        L'analisi usa gli stessi conti delle altre pagine. Per i mesi futuri conta solo quello che hai già inserito:
        fatture, spese, rate, F24 e desideri. Gli incassi che non hai ancora scritto non ci sono.
      </p>
    </Screen>
  );
}
