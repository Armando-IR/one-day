import { useMemo, useState } from 'react';
import type { Debt, FixedCost, Frequency, Income, Invoice, Kind, Phase, Pipeline, Priority, Saving, Scope, Tax, Wish } from '../lib/types';
import { PHASES } from '../lib/types';
import { useData } from '../state/data';
import { addDays, addMonths, fromMonthInput, monthIdx, toMonthInput } from '../lib/dates';
import { DEFAULT_PROBS, monthlySaving, monthlySeries, probableValue, wishMonthly, yearlyPayments } from '../lib/finance';
import { Field, FormActions, InlineSwitch, MoneyInput, PercentInput, Segmented, Sheet, TextInput } from '../ui/components';
import { eur, monthLong, monthNameByNumber, pct, prepA } from '../ui/format';
import { CalendarActions } from '../ui/calendar';

const blank = (s: string) => (s.trim() ? s.trim() : null);
const DEFAULT_FAMILIES = ['Casa', 'Quotidiane', 'Motorino', 'Abbonamenti', 'Altro'];

function useSave() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<boolean>, onClose: () => void) => {
    setSaving(true);
    const ok = await fn();
    setSaving(false);
    if (ok) onClose();
  };
  return { saving, error, setError, run };
}

// ---------------------------------------------------------------- invoices
export function InvoiceForm({ kind: kind0, initial, onClose }: { kind: Kind; initial?: Invoice; onClose: () => void }) {
  const { data, today, add, addMany, edit, del, notify } = useData();
  const [kind, setKind] = useState<Kind>(initial?.kind ?? kind0);
  const [repeat, setRepeat] = useState(false);
  const [until, setUntil] = useState('');
  const [party, setParty] = useState(initial?.party ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [amount, setAmount] = useState<number | null>(initial?.amount ?? null);
  const [invoiceDate, setInvoiceDate] = useState(initial?.invoice_date ?? today);
  const [cashDate, setCashDate] = useState(initial?.cash_date ?? addDays(today, 30));
  const [settled, setSettled] = useState(initial?.settled ?? false);
  const [note, setNote] = useState(initial?.note ?? '');
  const { saving, error, setError, run } = useSave();
  const parties = useMemo(
    () => [...new Set(data.invoices.filter((i) => i.kind === kind).map((i) => i.party))].sort(),
    [data.invoices, kind],
  );
  const client = kind === 'ricavo';
  const untilMonth = fromMonthInput(until);
  const repeats = !initial && repeat && !!untilMonth && !!invoiceDate && monthIdx(untilMonth) > monthIdx(invoiceDate);
  const repeatCount = repeats ? monthIdx(untilMonth as string) - monthIdx(invoiceDate) + 1 : 1;

  const save = () => {
    if (!party.trim()) return setError(client ? 'Scrivi il nome del cliente.' : 'Scrivi il nome del collaboratore.');
    if (!amount || amount <= 0) return setError("Scrivi l'importo.");
    if (!invoiceDate) return setError('Scrivi la data della fattura.');
    if (!initial && repeat && !repeats) return setError("Scegli l'ultimo mese: deve venire dopo quello della fattura.");
    const row = {
      kind, party: party.trim(), description: blank(description), amount, invoice_date: invoiceDate,
      cash_date: cashDate || null, settled, note: blank(note),
    };
    void run(async () => {
      if (initial) return edit('invoices', initial.id, row);
      if (repeats) {
        const ok = !!(await addMany('invoices', monthlySeries(row, untilMonth as string)));
        if (ok) notify(`${repeatCount} fatture aggiunte, una al mese`);
        return ok;
      }
      const ok = !!(await add('invoices', row));
      if (ok) notify(client ? 'Fattura aggiunta' : 'Fattura del collaboratore aggiunta');
      return ok;
    }, onClose);
  };

  return (
    <Sheet title={initial ? 'Modifica fattura' : client ? 'Fattura a un cliente' : 'Fattura di un collaboratore'} onClose={onClose}>
      {initial && (
        <Segmented options={[{ value: 'ricavo', label: 'Cliente' }, { value: 'collaboratore', label: 'Collaboratore' }]} value={kind} onChange={setKind} />
      )}
      <Field label={client ? 'Cliente' : 'Collaboratore'}>
        <TextInput value={party} onChange={setParty} list="parties" autoFocus={!initial} />
        <datalist id="parties">{parties.map((p) => <option key={p} value={p} />)}</datalist>
      </Field>
      <Field label="Importo (€)" hint={client ? 'Quanto hai fatturato.' : 'Quanto ti fattura.'}>
        <MoneyInput value={amount} onChange={setAmount} />
      </Field>
      <div className="grid-2">
        <Field label="Data della fattura">
          <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
        </Field>
        <Field label={client ? 'Quando arrivano i soldi' : 'Quando la paghi'}>
          <input type="date" value={cashDate ?? ''} onChange={(e) => setCashDate(e.target.value)} />
        </Field>
      </div>
      {!initial && (
        <>
          <InlineSwitch label="Ripeti ogni mese" checked={repeat} onChange={setRepeat} />
          {repeat && (
            <Field label="Fino al mese"
              hint={repeats
                ? `Crea ${repeatCount} fatture, una al mese, da ${monthLong(invoiceDate)} ${prepA(monthLong(untilMonth as string))}. Ognuna la segni come ${client ? 'incassata' : 'pagata'} quando ${client ? 'arrivano i soldi' : 'la paghi'}.`
                : 'Il mese dell’ultima fattura, per esempio la fine del contratto.'}>
              <input type="month" value={until} onChange={(e) => setUntil(e.target.value)} />
            </Field>
          )}
        </>
      )}
      <InlineSwitch label={repeats ? (client ? 'La prima è già incassata' : 'La prima è già pagata') : client ? 'Già incassata' : 'Già pagata'} checked={settled} onChange={setSettled} />
      {!settled && (
        <CalendarActions
          event={cashDate && party.trim() ? {
            uid: `fattura-${initial?.id ?? `${party.trim()}-${cashDate}`}`,
            title: `${client ? 'Incasso da' : 'Pagamento a'} ${party.trim()}${amount ? `, ${eur(amount, true)}` : ''}`,
            date: cashDate,
            monthlyCount: repeats ? repeatCount : undefined,
            details: [description.trim(), note.trim()].filter(Boolean).join('\n') || undefined,
          } : null}
          missing={client ? 'Scrivi il cliente e quando arrivano i soldi.' : 'Scrivi il collaboratore e quando lo paghi.'} />
      )}
      <Field label="Descrizione">
        <TextInput value={description} onChange={setDescription} placeholder="Facoltativa" />
      </Field>
      <Field label="Note">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {error && <p className="field-error">{error}</p>}
      <FormActions saving={saving} onSave={save}
        onDelete={initial ? () => void run(() => del('invoices', initial.id), onClose) : undefined} />
    </Sheet>
  );
}

// ---------------------------------------------------------------- fixed costs
export function CostForm({ scope: scope0, initial, onClose }: { scope: Scope; initial?: FixedCost; onClose: () => void }) {
  const { data, today, add, edit, del, notify } = useData();
  const [scope, setScope] = useState<Scope>(initial?.scope ?? scope0);
  const families = useMemo(
    () => [...new Set([...DEFAULT_FAMILIES, ...data.fixed_costs.filter((c) => c.family).map((c) => c.family as string)])],
    [data.fixed_costs],
  );
  const [family, setFamily] = useState(initial?.family ?? 'Casa');
  const [newFamily, setNewFamily] = useState('');
  const [name, setName] = useState(initial?.name ?? '');
  const [amount, setAmount] = useState<number | null>(initial?.amount ?? null);
  const [frequency, setFrequency] = useState<Frequency>(initial?.frequency ?? 'mensile');
  const [payMonth, setPayMonth] = useState<number | null>(initial?.pay_month ?? null);
  const [dueMonth, setDueMonth] = useState(toMonthInput(initial?.due_month ?? null));
  const [startMonth, setStartMonth] = useState(toMonthInput(initial?.start_month ?? null));
  const [endMonth, setEndMonth] = useState(toMonthInput(initial?.end_month ?? null));
  const [active, setActive] = useState(initial?.active ?? true);
  const [note, setNote] = useState(initial?.note ?? '');
  const { saving, error, setError, run } = useSave();
  const due = fromMonthInput(dueMonth);
  const start = fromMonthInput(startMonth);
  const end = fromMonthInput(endMonth);
  const saveMonthly = frequency === 'una_tantum' && due ? monthlySaving(amount ?? 0, due, today) : 0;
  // next payment of a yearly expense, for the calendar
  const yearly = payMonth ? yearlyPayments(payMonth, today, start, end) : null;

  const save = () => {
    if (!name.trim()) return setError('Scrivi il nome della spesa.');
    const fam = scope === 'personale' ? (family === '__new' ? blank(newFamily) : family) : null;
    if (scope === 'personale' && !fam) return setError('Scegli o scrivi la famiglia.');
    if (frequency === 'una_tantum' && !due) return setError('Scegli il mese della spesa.');
    if (frequency !== 'una_tantum' && start && end && end < start) return setError("L'ultimo mese viene prima del primo.");
    const row = {
      scope, family: fam, name: name.trim(), amount: amount ?? 0, frequency,
      pay_month: frequency === 'annuale' ? payMonth : null,
      due_month: frequency === 'una_tantum' ? due : null,
      start_month: frequency === 'una_tantum' ? null : start,
      end_month: frequency === 'una_tantum' ? null : end,
      active, note: blank(note),
    };
    void run(async () => {
      if (initial) return edit('fixed_costs', initial.id, row);
      const ok = !!(await add('fixed_costs', row));
      if (ok) notify('Spesa aggiunta');
      return ok;
    }, onClose);
  };

  return (
    <Sheet title={initial ? 'Modifica spesa' : 'Spesa'} onClose={onClose}>
      <Segmented options={[{ value: 'personale', label: 'Personale' }, { value: 'lavoro', label: 'Di lavoro' }]} value={scope} onChange={setScope} />
      {scope === 'personale' && (
        <Field label="Famiglia">
          <select value={families.includes(family) ? family : '__new'} onChange={(e) => setFamily(e.target.value)}>
            {families.map((f) => <option key={f} value={f}>{f}</option>)}
            <option value="__new">Nuova famiglia…</option>
          </select>
        </Field>
      )}
      {scope === 'personale' && family === '__new' && (
        <Field label="Nome della nuova famiglia">
          <TextInput value={newFamily} onChange={setNewFamily} placeholder="Per esempio Salute" />
        </Field>
      )}
      <Field label="Spesa">
        <TextInput value={name} onChange={setName} placeholder="Per esempio Assicurazione" autoFocus={!initial} />
      </Field>
      <Segmented
        options={[{ value: 'mensile', label: 'Ogni mese' }, { value: 'annuale', label: 'Ogni anno' }, { value: 'una_tantum', label: 'Una volta' }]}
        value={frequency} onChange={setFrequency} />
      <Field label="Importo (€)" hint={frequency === 'annuale' && amount ? `Pari a ${eur(amount / 12, true)} al mese.` : undefined}>
        <MoneyInput value={amount} onChange={setAmount} />
      </Field>
      {frequency === 'annuale' && (
        <Field label="Mese in cui la paghi" hint="Se non lo sai, il cashflow la divide sui 12 mesi.">
          <select value={payMonth ?? ''} onChange={(e) => setPayMonth(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Non lo so</option>
            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{monthNameByNumber(i + 1)}</option>)}
          </select>
        </Field>
      )}
      {frequency !== 'una_tantum' && (
        <>
          <div className="grid-2">
            <Field label="Dal mese" hint={startMonth ? <button type="button" className="link-btn" onClick={() => setStartMonth('')}>Togli</button> : undefined}>
              <input type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} />
            </Field>
            <Field label="Fino al mese" hint={endMonth ? <button type="button" className="link-btn" onClick={() => setEndMonth('')}>Togli</button> : undefined}>
              <input type="month" value={endMonth} onChange={(e) => setEndMonth(e.target.value)} />
            </Field>
          </div>
          <p className="muted small" style={{ marginTop: -6 }}>
            Lasciali vuoti se la spesa non ha un inizio o una fine. Se la disdici, metti l'ultimo mese: i mesi passati restano nei conti.
          </p>
        </>
      )}
      {frequency === 'annuale' && (
        <CalendarActions
          event={name.trim() && yearly ? {
            uid: `spesa-${initial?.id ?? `${name.trim()}-${payMonth}`}`,
            title: `${name.trim()}${amount ? `, ${eur(amount, true)}` : ''}`,
            date: yearly.first,
            yearly: true,
            yearlyCount: yearly.count,
            details: note.trim() || undefined,
          } : null}
          missing={!payMonth ? 'Scegli il mese in cui la paghi.' : !yearly ? "Dopo l'ultimo mese non ci sono altre scadenze." : 'Scrivi il nome della spesa.'} />
      )}
      {frequency === 'una_tantum' && (
        <>
          <Field label="In che mese" hint="Entra nel cashflow e nel conto economico di quel mese.">
            <input type="month" value={dueMonth} onChange={(e) => setDueMonth(e.target.value)} />
          </Field>
          {due && saveMonthly > 0 && (
            <p className="muted small" style={{ marginTop: -4 }}>
              Metti da parte <strong className="num">{eur(saveMonthly)}</strong> al mese fino {prepA(monthLong(due))}.
            </p>
          )}
          <CalendarActions
            event={name.trim() && due ? {
              uid: `spesa-${initial?.id ?? `${name.trim()}-${due}`}`,
              title: `${name.trim()}${amount ? `, ${eur(amount, true)}` : ''}`,
              date: due,
              details: note.trim() || undefined,
            } : null}
            missing="Scrivi il nome e il mese." />
        </>
      )}
      <InlineSwitch label="Attiva" checked={active} onChange={setActive} />
      {!active && <p className="muted small" style={{ marginTop: -8 }}>Spenta: non conta in nessun mese, nemmeno in quelli passati.</p>}
      <Field label="Note">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {error && <p className="field-error">{error}</p>}
      <FormActions saving={saving} onSave={save}
        onDelete={initial ? () => void run(() => del('fixed_costs', initial.id), onClose) : undefined} />
    </Sheet>
  );
}

// ---------------------------------------------------------------- debts
// ---------------------------------------------------------------- incomes that are not invoices
export function IncomeForm({ initial, onClose }: { initial?: Income; onClose: () => void }) {
  const { add, edit, del, notify } = useData();
  const [name, setName] = useState(initial?.name ?? '');
  const [amount, setAmount] = useState<number | null>(initial?.amount ?? null);
  const [frequency, setFrequency] = useState<Frequency>(initial?.frequency ?? 'mensile');
  const [payMonth, setPayMonth] = useState<number | null>(initial?.pay_month ?? null);
  const [dueMonth, setDueMonth] = useState(toMonthInput(initial?.due_month ?? null));
  const [startMonth, setStartMonth] = useState(toMonthInput(initial?.start_month ?? null));
  const [endMonth, setEndMonth] = useState(toMonthInput(initial?.end_month ?? null));
  const [active, setActive] = useState(initial?.active ?? true);
  const [note, setNote] = useState(initial?.note ?? '');
  const { saving, error, setError, run } = useSave();
  const due = fromMonthInput(dueMonth);
  const start = fromMonthInput(startMonth);
  const end = fromMonthInput(endMonth);

  const save = () => {
    if (!name.trim()) return setError("Scrivi il nome dell'entrata.");
    if (frequency === 'una_tantum' && !due) return setError("Scegli il mese dell'entrata.");
    if (frequency !== 'una_tantum' && start && end && end < start) return setError("L'ultimo mese viene prima del primo.");
    const row = {
      name: name.trim(), amount: amount ?? 0, frequency,
      pay_month: frequency === 'annuale' ? payMonth : null,
      due_month: frequency === 'una_tantum' ? due : null,
      start_month: frequency === 'una_tantum' ? null : start,
      end_month: frequency === 'una_tantum' ? null : end,
      active, note: blank(note),
    };
    void run(async () => {
      if (initial) return edit('incomes', initial.id, row);
      const ok = !!(await add('incomes', row));
      if (ok) notify('Entrata aggiunta');
      return ok;
    }, onClose);
  };

  return (
    <Sheet title={initial ? 'Modifica entrata' : 'Entrata'} onClose={onClose}>
      <Field label="Entrata">
        <TextInput value={name} onChange={setName} placeholder="Per esempio Stipendio, Pensione, Affitto" autoFocus={!initial} />
      </Field>
      <Segmented
        options={[{ value: 'mensile', label: 'Ogni mese' }, { value: 'annuale', label: 'Ogni anno' }, { value: 'una_tantum', label: 'Una volta' }]}
        value={frequency} onChange={setFrequency} />
      <Field label="Importo netto (€)" hint={frequency === 'annuale' && amount ? `Pari a ${eur(amount / 12, true)} al mese.` : 'Quello che arriva davvero sul conto, già senza tasse.'}>
        <MoneyInput value={amount} onChange={setAmount} />
      </Field>
      {frequency === 'annuale' && (
        <Field label="Mese in cui arriva" hint="Se non lo sai, il cashflow la divide sui 12 mesi.">
          <select value={payMonth ?? ''} onChange={(e) => setPayMonth(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Non lo so</option>
            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{monthNameByNumber(i + 1)}</option>)}
          </select>
        </Field>
      )}
      {frequency !== 'una_tantum' && (
        <>
          <div className="grid-2">
            <Field label="Dal mese" hint={startMonth ? <button type="button" className="link-btn" onClick={() => setStartMonth('')}>Togli</button> : undefined}>
              <input type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} />
            </Field>
            <Field label="Fino al mese" hint={endMonth ? <button type="button" className="link-btn" onClick={() => setEndMonth('')}>Togli</button> : undefined}>
              <input type="month" value={endMonth} onChange={(e) => setEndMonth(e.target.value)} />
            </Field>
          </div>
          <p className="muted small" style={{ marginTop: -6 }}>Lasciali vuoti se l'entrata non ha un inizio o una fine.</p>
        </>
      )}
      {frequency === 'una_tantum' && (
        <Field label="In che mese" hint="Entra nel cashflow e nel conto economico di quel mese.">
          <input type="month" value={dueMonth} onChange={(e) => setDueMonth(e.target.value)} />
        </Field>
      )}
      <InlineSwitch label="Attiva" checked={active} onChange={setActive} />
      <Field label="Note">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {error && <p className="field-error">{error}</p>}
      <FormActions saving={saving} onSave={save}
        onDelete={initial ? () => void run(() => del('incomes', initial.id), onClose) : undefined} />
    </Sheet>
  );
}

export function DebtForm({ initial, onClose }: { initial?: Debt; onClose: () => void }) {
  const { today, add, edit, del, notify } = useData();
  const [name, setName] = useState(initial?.name ?? '');
  const [installment, setInstallment] = useState<number | null>(initial?.installment ?? null);
  const [first, setFirst] = useState(toMonthInput(initial?.first_month ?? `${today.slice(0, 7)}-01`));
  const initialCount =
    initial?.first_month && initial.last_month ? monthIdx(initial.last_month) - monthIdx(initial.first_month) + 1 : null;
  const [count, setCount] = useState<number | null>(initialCount);
  const [note, setNote] = useState(initial?.note ?? '');
  const { saving, error, setError, run } = useSave();
  const firstMonth = fromMonthInput(first);
  const lastMonth = firstMonth && count && count > 0 ? addMonths(firstMonth, Math.round(count) - 1) : null;

  const save = () => {
    if (!name.trim()) return setError('Scrivi cosa stai pagando a rate.');
    const row = { name: name.trim(), installment, first_month: firstMonth, last_month: lastMonth, note: blank(note) };
    void run(async () => {
      if (initial) return edit('debts', initial.id, row);
      const ok = !!(await add('debts', row));
      if (ok) notify('Debito aggiunto');
      return ok;
    }, onClose);
  };

  return (
    <Sheet title={initial ? 'Modifica debito' : 'Debito a rate'} onClose={onClose}>
      <Field label="Cosa stai pagando a rate">
        <TextInput value={name} onChange={setName} placeholder="Per esempio Klarna, viaggio" autoFocus={!initial} />
      </Field>
      <Field label="Rata al mese (€)">
        <MoneyInput value={installment} onChange={setInstallment} />
      </Field>
      <div className="grid-2">
        <Field label="Prima rata">
          <input type="month" value={first} onChange={(e) => setFirst(e.target.value)} />
        </Field>
        <Field label="Numero di rate">
          <MoneyInput value={count} onChange={setCount} />
        </Field>
      </div>
      {lastMonth && <p className="muted small" style={{ marginTop: -4 }}>Ultima rata {prepA(monthLong(lastMonth))}.</p>}
      <CalendarActions
        event={name.trim() && installment && firstMonth && lastMonth && count ? {
          uid: `rata-${initial?.id ?? `${name.trim()}-${firstMonth}`}`,
          title: `Rata ${name.trim()}, ${eur(installment, true)}`,
          date: firstMonth,
          monthlyCount: Math.round(count),
          details: `Rata mensile da ${monthLong(firstMonth)} ${prepA(monthLong(lastMonth))}.`,
        } : null}
        missing="Scrivi rata, prima rata e numero di rate." />
      <Field label="Note">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {error && <p className="field-error">{error}</p>}
      <FormActions saving={saving} onSave={save}
        onDelete={initial ? () => void run(() => del('debts', initial.id), onClose) : undefined} />
    </Sheet>
  );
}

// ---------------------------------------------------------------- taxes
export function TaxForm({ initial, onClose }: { initial?: Tax; onClose: () => void }) {
  const { today, add, edit, del, notify } = useData();
  const [due, setDue] = useState(initial?.due_date ?? today);
  const [description, setDescription] = useState(initial?.description ?? '');
  const [amount, setAmount] = useState<number | null>(initial?.amount ?? null);
  const [note, setNote] = useState(initial?.note ?? '');
  const { saving, error, setError, run } = useSave();

  const save = () => {
    if (!due) return setError('Scrivi la scadenza.');
    if (!description.trim()) return setError('Scrivi una descrizione, per esempio "Secondo acconto".');
    const row = { due_date: due, description: description.trim(), amount, note: blank(note) };
    void run(async () => {
      if (initial) return edit('taxes', initial.id, row);
      const ok = !!(await add('taxes', row));
      if (ok) notify('Scadenza aggiunta');
      return ok;
    }, onClose);
  };

  return (
    <Sheet title={initial ? 'Modifica F24' : 'Tasse (F24)'} onClose={onClose}>
      <Field label="Descrizione">
        <TextInput value={description} onChange={setDescription} placeholder="Per esempio Secondo acconto" autoFocus={!initial} />
      </Field>
      <div className="grid-2">
        <Field label="Scadenza">
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
        <Field label="Importo (€)">
          <MoneyInput value={amount} onChange={setAmount} placeholder="Da sapere" />
        </Field>
      </div>
      <CalendarActions
        event={due && description.trim() ? {
          uid: `f24-${initial?.id ?? `${description.trim()}-${due}`}`,
          title: `F24: ${description.trim()}${amount ? `, ${eur(amount, true)}` : ''}`,
          date: due,
          details: amount ? undefined : 'Importo ancora da sapere.',
        } : null}
        missing="Scrivi la descrizione e la scadenza." />
      <Field label="Note">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {error && <p className="field-error">{error}</p>}
      <FormActions saving={saving} onSave={save}
        onDelete={initial ? () => void run(() => del('taxes', initial.id), onClose) : undefined} />
    </Sheet>
  );
}

// ---------------------------------------------------------------- pipeline
export function PipelineForm({ initial, onClose }: { initial?: Pipeline; onClose: () => void }) {
  const { data, today, add, edit, del, notify } = useData();
  const probs = { ...DEFAULT_PROBS, ...data.settings.phase_probs };
  const [name, setName] = useState(initial?.name ?? '');
  const [client, setClient] = useState(initial?.client ?? '');
  const [phase, setPhase] = useState<Phase>(initial?.phase ?? 'Contatto');
  const [amount, setAmount] = useState<number | null>(initial?.amount ?? null);
  const [month, setMonth] = useState(toMonthInput(initial?.expected_month ?? addMonths(`${today.slice(0, 7)}-01`, 1)));
  const [custom, setCustom] = useState(initial?.prob_override != null);
  const [override, setOverride] = useState<number | null>(initial?.prob_override ?? null);
  const [note, setNote] = useState(initial?.note ?? '');
  const { saving, error, setError, run } = useSave();
  const preview: Pipeline = {
    id: '', name, client: null, phase, amount: amount ?? 0, expected_month: fromMonthInput(month) ?? today,
    prob_override: custom ? override : null, note: null,
  };

  const save = () => {
    if (!name.trim()) return setError('Scrivi di che lavoro si tratta.');
    const expected = fromMonthInput(month);
    if (!expected) return setError('Scegli il mese in cui pensi di fatturare.');
    const row = {
      name: name.trim(), client: blank(client), phase, amount: amount ?? 0, expected_month: expected,
      prob_override: custom ? Math.min(1, Math.max(0, override ?? 0)) : null, note: blank(note),
    };
    void run(async () => {
      if (initial) return edit('pipeline', initial.id, row);
      const ok = !!(await add('pipeline', row));
      if (ok) notify('Ipotesi aggiunta');
      return ok;
    }, onClose);
  };

  return (
    <Sheet title={initial ? 'Modifica ipotesi' : 'Ipotesi di lavoro'} onClose={onClose}>
      <Field label="Lavoro">
        <TextInput value={name} onChange={setName} placeholder="Per esempio Sito per il festival" autoFocus={!initial} />
      </Field>
      <Field label="Cliente">
        <TextInput value={client} onChange={setClient} placeholder="Facoltativo" />
      </Field>
      <Field label="A che punto è">
        <select value={phase} onChange={(e) => setPhase(e.target.value as Phase)}>
          {PHASES.map((p) => <option key={p} value={p}>{p} ({pct(probs[p])})</option>)}
        </select>
      </Field>
      <div className="grid-2">
        <Field label="Importo (€)" hint="Al netto dei collaboratori.">
          <MoneyInput value={amount} onChange={setAmount} />
        </Field>
        <Field label="Mese della fattura">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </Field>
      </div>
      <InlineSwitch label="Uso una mia probabilità" checked={custom} onChange={setCustom} />
      {custom && (
        <Field label="Probabilità (%)">
          <PercentInput value={override} onChange={setOverride} />
        </Field>
      )}
      <p className="muted small">
        Valore probabile: <strong className="num">{eur(probableValue(preview, probs))}</strong>
      </p>
      <Field label="Note">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {error && <p className="field-error">{error}</p>}
      <FormActions saving={saving} onSave={save}
        onDelete={initial ? () => void run(() => del('pipeline', initial.id), onClose) : undefined} />
    </Sheet>
  );
}

// ---------------------------------------------------------------- wishes
export function WishForm({ initial, onClose }: { initial?: Wish; onClose: () => void }) {
  const { today, add, edit, del, notify } = useData();
  const [name, setName] = useState(initial?.name ?? '');
  const [cost, setCost] = useState<number | null>(initial?.cost ?? null);
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? 'media');
  const [month, setMonth] = useState(toMonthInput(initial?.target_month ?? null));
  const [planned, setPlanned] = useState(initial?.planned ?? true);
  const [note, setNote] = useState(initial?.note ?? '');
  const { saving, error, setError, run } = useSave();
  const target = fromMonthInput(month);
  const monthly = target ? wishMonthly({ id: '', name, cost: cost ?? 0, priority, target_month: target, planned, note: null }, today) : 0;

  const save = () => {
    if (!name.trim()) return setError('Scrivi cosa vuoi comprare.');
    const row = { name: name.trim(), cost: cost ?? 0, priority, target_month: target, planned, note: blank(note) };
    void run(async () => {
      if (initial) return edit('wishes', initial.id, row);
      const ok = !!(await add('wishes', row));
      if (ok) notify('Desiderio aggiunto');
      return ok;
    }, onClose);
  };

  return (
    <Sheet title={initial ? 'Modifica desiderio' : 'Desiderio'} onClose={onClose}>
      <Field label="Cosa vuoi comprare">
        <TextInput value={name} onChange={setName} autoFocus={!initial} />
      </Field>
      <div className="grid-2">
        <Field label="Costo (€)">
          <MoneyInput value={cost} onChange={setCost} />
        </Field>
        <Field label="Entro quando">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </Field>
      </div>
      <Field label="Priorità">
        <Segmented options={[{ value: 'alta', label: 'Alta' }, { value: 'media', label: 'Media' }, { value: 'bassa', label: 'Bassa' }]} value={priority} onChange={setPriority} />
      </Field>
      <InlineSwitch label="In programma" checked={planned} onChange={setPlanned} />
      {planned && target && (
        <p className="muted small">Metti da parte <strong className="num">{eur(monthly)}</strong> al mese fino {prepA(monthLong(target))}.</p>
      )}
      <Field label="Note">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {error && <p className="field-error">{error}</p>}
      <FormActions saving={saving} onSave={save}
        onDelete={initial ? () => void run(() => del('wishes', initial.id), onClose) : undefined} />
    </Sheet>
  );
}

// ---------------------------------------------------------------- savings outside the account
export function SavingForm({ initial, onClose }: { initial?: Saving; onClose: () => void }) {
  const { add, edit, del, notify } = useData();
  const [name, setName] = useState(initial?.name ?? '');
  const [amount, setAmount] = useState<number | null>(initial?.amount ?? null);
  const [note, setNote] = useState(initial?.note ?? '');
  const { saving, error, setError, run } = useSave();

  const save = () => {
    if (!name.trim()) return setError('Scrivi un nome, per esempio Conto deposito.');
    if (amount === null) return setError("Scrivi l'importo.");
    const row = { name: name.trim(), amount, note: blank(note) };
    void run(async () => {
      if (initial) return edit('savings', initial.id, row);
      const ok = !!(await add('savings', row));
      if (ok) notify('Risparmio aggiunto');
      return ok;
    }, onClose);
  };

  return (
    <Sheet title={initial ? 'Modifica risparmio' : 'Risparmio fuori dal conto'} onClose={onClose}>
      <Field label="Nome">
        <TextInput value={name} onChange={setName} placeholder="Per esempio Conto deposito" autoFocus={!initial} />
      </Field>
      <Field label="Importo (€)" hint="Quanto c'è adesso. Conta nel patrimonio, non nel cashflow.">
        <MoneyInput value={amount} onChange={setAmount} />
      </Field>
      <Field label="Note">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {error && <p className="field-error">{error}</p>}
      <FormActions saving={saving} onSave={save}
        onDelete={initial ? () => void run(() => del('savings', initial.id), onClose) : undefined} />
    </Sheet>
  );
}
