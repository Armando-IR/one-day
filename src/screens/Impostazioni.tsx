import { useRef } from 'react';
import { PHASES } from '../lib/types';
import { useData } from '../state/data';
import { useUi } from '../state/ui';
import { DEFAULT_PROBS, goals } from '../lib/finance';
import { toBackup } from '../lib/backup';
import { supabase } from '../lib/backend';
import { Block, Screen } from '../ui/components';
import { IconBack } from '../ui/icons';
import { eur, monthLong, pct } from '../ui/format';

// The copy built with `npm run build:demo` runs where downloads may be blocked: no backup there.
const DEMO = import.meta.env.MODE === 'demo';

export function Impostazioni({ email, onSignOut }: { email?: string; onSignOut?: () => void }) {
  const { data, today, mode, notify } = useData();
  const { go, open } = useUi();
  const file = useRef<HTMLInputElement>(null);
  const s = data.settings;
  const probs = { ...DEFAULT_PROBS, ...s.phase_probs };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(toBackup(data), null, 1)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finanze-backup-${today}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    notify('Backup esportato');
  };

  const importFile = async (f: File | undefined) => {
    if (!f) return;
    const text = await f.text();
    open({ type: 'import', text });
    if (file.current) file.current.value = '';
  };

  return (
    <Screen title="Impostazioni"
      action={<button className="icon-btn" aria-label="Torna alla home" onClick={() => go('home')}><IconBack /></button>}>
      <Block title="Spese e debiti">
        <ul className="list panel">
          <li><button className="row" onClick={() => go('conti', { conti: 'spese' })}>
            <span className="row-main"><span className="row-title">Spese personali e di lavoro</span>
              <span className="row-sub">Si gestiscono in Conti, Spese</span></span>
          </button></li>
          <li><button className="row" onClick={() => go('conti', { conti: 'patrimonio' })}>
            <span className="row-main"><span className="row-title">Rate, prestiti e F24</span>
              <span className="row-sub">Si gestiscono in Conti, Patrimonio</span></span>
          </button></li>
        </ul>
      </Block>

      <Block title="Parametri">
        <ul className="list panel">
          <li><button className="row" onClick={() => open({ type: 'opening' })}>
            <span className="row-main"><span className="row-title">Partenza del cashflow</span>
              <span className="row-sub">{monthLong(s.cf_start)}, {s.cf_opening == null ? 'saldo da inserire' : `${eur(s.cf_opening)} sul conto`}</span></span>
          </button></li>
          <li><button className="row" onClick={() => open({ type: 'year' })}>
            <span className="row-main"><span className="row-title">Anno del conto economico</span>
              <span className="row-sub">Da {monthLong(s.ce_start)}</span></span>
          </button></li>
          <li><button className="row" onClick={() => open({ type: 'params' })}>
            <span className="row-main"><span className="row-title">Obiettivi e tasse</span>
              <span className="row-sub">{s.personal_auto ? `Per te le spese personali (${eur(goals(data, today).personalCosts)})` : `${eur(s.personal_income)} per te`}, risparmio {eur(s.savings_fixed)} o {pct(s.savings_pct)}, tasse {pct(s.tax_rate)}</span></span>
          </button></li>
          <li><button className="row" onClick={() => open({ type: 'probs' })}>
            <span className="row-main"><span className="row-title">Probabilità per fase</span>
              <span className="row-sub">{PHASES.filter((p) => p !== 'Persa').map((p) => `${p} ${pct(probs[p])}`).join(', ')}</span></span>
          </button></li>
        </ul>
      </Block>

      <Block title="Backup">
        {DEMO ? (
          <p className="panel empty">Nella versione di prova il backup è spento: i dati sono d'esempio.</p>
        ) : (
          <>
            <p className="muted small" style={{ marginTop: 0 }}>Un file con tutti i tuoi dati, da tenere al sicuro o da importare in un'altra installazione.</p>
            <div className="btn-row" style={{ marginTop: 0 }}>
              <button className="btn secondary" onClick={exportData}>Esporta i dati</button>
              <button className="btn secondary" onClick={() => file.current?.click()}>Importa da file</button>
            </div>
            <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => void importFile(e.target.files?.[0])} />
          </>
        )}
      </Block>

      <Block title="Account">
        {mode === 'supabase' && supabase ? (
          <div className="panel row">
            <span className="row-main"><span className="row-title">{email}</span><span className="row-sub">Dati salvati nel tuo database</span></span>
            <button className="link-btn" onClick={onSignOut}>Esci</button>
          </div>
        ) : (
          <p className="panel empty">
            Modalità prova: i dati restano solo su questo dispositivo. Per salvarli online e usarli anche dal computer, collega il database come spiegato nel file README.
          </p>
        )}
      </Block>
    </Screen>
  );
}
