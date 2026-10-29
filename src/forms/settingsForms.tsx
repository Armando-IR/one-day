import { useMemo, useState } from 'react';
import type { Phase } from '../lib/types';
import { PHASES, TABLES } from '../lib/types';
import { useData } from '../state/data';
import { fromMonthInput, toMonthInput } from '../lib/dates';
import { DEFAULT_PROBS } from '../lib/finance';
import { parseBackup } from '../lib/backup';
import { Field, FormActions, MoneyInput, PercentInput, Sheet } from '../ui/components';
import { monthName } from '../ui/format';

function useSaving(onClose: () => void) {
  const [saving, setSaving] = useState(false);
  return {
    saving,
    run: async (fn: () => Promise<boolean>) => {
      setSaving(true);
      const ok = await fn();
      setSaving(false);
      if (ok) onClose();
    },
  };
}

export function OpeningForm({ onClose }: { onClose: () => void }) {
  const { data, saveSettings } = useData();
  const [month, setMonth] = useState(toMonthInput(data.settings.cf_start));
  const [opening, setOpening] = useState<number | null>(data.settings.cf_opening);
  const { saving, run } = useSaving(onClose);
  const start = fromMonthInput(month);
  return (
    <Sheet title="Da dove parte il cashflow" onClose={onClose}>
      <Field label="Mese di partenza">
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </Field>
      <Field label={start ? `Soldi sul conto il 1° ${monthName(start)} (€)` : 'Soldi sul conto il 1° del mese (€)'}
        hint="Il conto che usi per entrate e spese, al primo giorno del mese: lo trovi nell'app della banca. I risparmi messi da parte non vanno qui: aggiungili in Conti, Patrimonio.">
        <MoneyInput value={opening} onChange={setOpening} autoFocus />
      </Field>
      <FormActions saving={saving} onSave={() => start && void run(() => saveSettings({ cf_start: start, cf_opening: opening }))} />
    </Sheet>
  );
}

export function YearForm({ onClose }: { onClose: () => void }) {
  const { data, saveSettings } = useData();
  const [month, setMonth] = useState(toMonthInput(data.settings.ce_start));
  const { saving, run } = useSaving(onClose);
  const start = fromMonthInput(month);
  return (
    <Sheet title="Anno del conto economico" onClose={onClose}>
      <Field label="Primo mese" hint="Il conto economico e gli obiettivi mostrano i 12 mesi a partire da qui.">
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </Field>
      <FormActions saving={saving} onSave={() => start && void run(() => saveSettings({ ce_start: start }))} />
    </Sheet>
  );
}

export function ParamsForm({ onClose }: { onClose: () => void }) {
  const { data, saveSettings } = useData();
  const s = data.settings;
  const [income, setIncome] = useState<number | null>(s.personal_income);
  const [fixed, setFixed] = useState<number | null>(s.savings_fixed);
  const [pctSave, setPctSave] = useState<number | null>(s.savings_pct);
  const [tax, setTax] = useState<number | null>(s.tax_rate);
  const { saving, run } = useSaving(onClose);
  return (
    <Sheet title="Da cosa dipendono gli obiettivi" onClose={onClose}>
      <Field label="Quanto vuoi per te al mese (€, netto)">
        <MoneyInput value={income} onChange={setIncome} />
      </Field>
      <Field label="Risparmio fisso al mese (€)">
        <MoneyInput value={fixed} onChange={setFixed} />
      </Field>
      <Field label="Oppure risparmio in percentuale (%)">
        <PercentInput value={pctSave} onChange={setPctSave} />
      </Field>
      <Field label="Tasse (% sul reddito)" hint="Usata anche per le tasse stimate nel conto economico.">
        <PercentInput value={tax} onChange={setTax} />
      </Field>
      <FormActions saving={saving}
        onSave={() => void run(() => saveSettings({
          personal_income: income ?? 0, savings_fixed: fixed ?? 0, savings_pct: Math.min(0.95, pctSave ?? 0),
          tax_rate: Math.min(0.95, tax ?? 0),
        }))} />
    </Sheet>
  );
}

export function ProbsForm({ onClose }: { onClose: () => void }) {
  const { data, saveSettings } = useData();
  const [probs, setProbs] = useState<Record<Phase, number>>({ ...DEFAULT_PROBS, ...data.settings.phase_probs });
  const { saving, run } = useSaving(onClose);
  return (
    <Sheet title="Probabilità per fase" onClose={onClose}>
      <p className="muted small" style={{ marginTop: 0 }}>Quanto è probabile che un lavoro vada in porto, a seconda di dove si trova.</p>
      {PHASES.map((p) => (
        <Field key={p} label={`${p} (%)`}>
          <PercentInput value={probs[p]} onChange={(v) => setProbs({ ...probs, [p]: Math.min(1, Math.max(0, v ?? 0)) })} />
        </Field>
      ))}
      <FormActions saving={saving} onSave={() => void run(() => saveSettings({ phase_probs: probs }))} />
    </Sheet>
  );
}

const LABELS: Record<(typeof TABLES)[number], string> = {
  invoices: 'fatture', fixed_costs: 'spese fisse', incomes: 'entrate', debts: 'rate', taxes: 'scadenze F24', pipeline: 'ipotesi', wishes: 'desideri',
  savings: 'risparmi fuori dal conto',
};

export function ImportSheet({ text, onClose }: { text: string; onClose: () => void }) {
  const { data, importBackup, notify } = useData();
  const [busy, setBusy] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const parsed = useMemo(() => {
    try {
      return { backup: parseBackup(text), error: null };
    } catch (e) {
      return { backup: null, error: (e as Error).message };
    }
  }, [text]);
  const hasData = TABLES.some((t) => data[t].length > 0);
  const go = async (replace: boolean) => {
    if (!parsed.backup) return;
    setBusy(true);
    const ok = await importBackup(parsed.backup, replace);
    setBusy(false);
    if (ok) {
      notify('Dati importati');
      onClose();
    }
  };
  return (
    <Sheet title="Importa da file" onClose={onClose}>
      {parsed.error && <p className="field-error">{parsed.error}</p>}
      {parsed.backup && (
        <>
          <p style={{ marginTop: 0 }}>Il file contiene:</p>
          <ul className="muted">
            {TABLES.filter((t) => parsed.backup![t].length).map((t) => (
              <li key={t}>{parsed.backup![t].length} {LABELS[t]}</li>
            ))}
            <li>le impostazioni (obiettivi, tasse, mesi di partenza)</li>
          </ul>
          {hasData ? (
            <>
              <p>Hai già dei dati nell'app. Puoi sostituirli con quelli del file, oppure aggiungere quelli del file ai tuoi.</p>
              {confirmReplace && (
                <p className="banner">I dati che hai ora verranno cancellati. Se vuoi tenerne una copia, prima usa Esporta i dati.</p>
              )}
              <div className="btn-row">
                <button className="btn secondary" disabled={busy} onClick={() => void go(false)}>Aggiungi ai miei</button>
                <button className={`btn ${confirmReplace ? 'danger-solid' : ''}`} disabled={busy}
                  onClick={() => (confirmReplace ? void go(true) : setConfirmReplace(true))}>
                  {busy ? 'Importo…' : confirmReplace ? 'Conferma: sostituisci' : 'Sostituisci i miei'}
                </button>
              </div>
            </>
          ) : (
            <div className="btn-row">
              <button className="btn" disabled={busy} onClick={() => void go(false)}>{busy ? 'Importo…' : 'Importa'}</button>
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}
