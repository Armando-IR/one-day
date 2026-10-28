import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { IconClose } from './icons';
import { amountToText, eur, parseAmount } from './format';

export function Amount({ value, decimals = false, signed = false, className = '' }: {
  value: number;
  decimals?: boolean;
  signed?: boolean;
  className?: string;
}) {
  const neg = value < -0.004;
  const text = eur(value, decimals);
  return <span className={`num ${neg ? 'neg' : ''} ${className}`}>{signed && value > 0.004 ? `+${text}` : text}</span>;
}

export function Screen({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <main className="screen">
      <header className="screen-head">
        <h1>{title}</h1>
        {action}
      </header>
      {children}
    </main>
  );
}

export function Block({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="block">
      <div className="block-head">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Chiudi">
            <IconClose />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function TextInput({ value, onChange, placeholder, list, autoFocus }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  list?: string;
  autoFocus?: boolean;
}) {
  return (
    <input type="text" value={value} placeholder={placeholder} list={list} autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)} />
  );
}

/** Money input that accepts Italian decimals ("11,99") and keeps the text while typing. */
export function MoneyInput({ value, onChange, placeholder = '0', autoFocus }: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState(amountToText(value));
  useEffect(() => {
    if (parseAmount(text) !== value) setText(amountToText(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input type="text" inputMode="decimal" value={text} placeholder={placeholder} autoFocus={autoFocus}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parseAmount(e.target.value));
      }} />
  );
}

export function PercentInput({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <MoneyInput value={value === null ? null : Math.round(value * 1000) / 10} placeholder="0"
      onChange={(v) => onChange(v === null ? null : v / 100)} />
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)} />
  );
}

export function InlineSwitch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className="field-inline">
      <span id={id}>{label}</span>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange, className = '', label }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  label?: string;
}) {
  return (
    <div className={`seg ${options.length > 3 ? 'compact' : ''} ${className}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chips<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="chips" role="group">
      {options.map((o) => (
        <button key={o.value} type="button" className="chip" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Save / delete buttons used at the bottom of every form. Delete asks for a second tap. */
export function FormActions({ onSave, onDelete, saving, saveLabel = 'Salva' }: {
  onSave: () => void;
  onDelete?: () => void;
  saving?: boolean;
  saveLabel?: string;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="btn-row">
      {onDelete && (
        <button type="button" className="btn danger" onClick={() => (confirm ? onDelete() : setConfirm(true))}>
          {confirm ? 'Conferma eliminazione' : 'Elimina'}
        </button>
      )}
      <button type="button" className="btn" disabled={saving} onClick={onSave}>
        {saving ? 'Salvo…' : saveLabel}
      </button>
    </div>
  );
}

export function Progress({ confirmed, probable }: { confirmed: number; probable?: number }) {
  const c = Math.max(0, Math.min(1, confirmed));
  const p = Math.max(c, Math.min(1, probable ?? c));
  return (
    <div className="bar" role="img" aria-label={`${Math.round(c * 100)}% raggiunto`}>
      <span className="bar-prob" style={{ width: `${p * 100}%` }} />
      <span className="bar-conf" style={{ width: `${c * 100}%` }} />
    </div>
  );
}

export const money = (v: number) => eur(v);
