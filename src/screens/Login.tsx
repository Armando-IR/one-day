import { useState, type FormEvent } from 'react';
import type { AuthError, SupabaseClient } from '@supabase/supabase-js';

function authMessage(e: AuthError | Error): string {
  const code = 'code' in e ? (e as AuthError).code : undefined;
  if (code === 'invalid_credentials' || e.message === 'Invalid login credentials') return 'Email o password non corrette.';
  if (code === 'email_not_confirmed') return "L'utente non è confermato. In Supabase, apri l'utente e confermalo.";
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit') return 'Troppi tentativi. Riprova tra qualche minuto.';
  if (code === 'weak_password') return 'Password troppo debole: usane una più lunga.';
  if (code === 'same_password') return 'È uguale a quella di prima: scegline una diversa.';
  if (/fetch|network/i.test(e.message)) return 'Non riesco a collegarmi. Controlla la connessione e riprova.';
  return e.message;
}

export function Login({ sb }: { sb: SupabaseClient }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return setError('Scrivi email e password.');
    setBusy(true);
    setError(null);
    setInfo(null);
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setError(authMessage(error));
  };

  const forgot = async () => {
    setInfo(null);
    if (!email.trim()) return setError('Scrivi la tua email qui sopra, poi tocca di nuovo «Password dimenticata».');
    setBusy(true);
    setError(null);
    const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + window.location.pathname });
    setBusy(false);
    if (error) setError(authMessage(error));
    else setInfo('Controlla la posta: c’è un link per scegliere una nuova password.');
  };

  return (
    <main className="login">
      <h1>Finanze</h1>
      <p>Entra per vedere i tuoi conti.</p>
      <form onSubmit={submit} noValidate>
        <label className="field">
          <span>Email</span>
          <input type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="field-error" role="alert">{error}</p>}
        {info && <p className="banner" role="status">{info}</p>}
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Entro…' : 'Entra'}</button>
      </form>
      <button className="link-btn" style={{ marginTop: 14, justifySelf: 'start' }} onClick={() => void forgot()} disabled={busy}>
        Password dimenticata
      </button>
    </main>
  );
}

/** Shown after opening the link in the "nuova password" email. */
export function NewPassword({ sb, onDone }: { sb: SupabaseClient; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError('Usa almeno 8 caratteri.');
    if (password !== again) return setError('Le due password non coincidono.');
    setBusy(true);
    setError(null);
    const { error } = await sb.auth.updateUser({ password });
    setBusy(false);
    if (error) setError(authMessage(error));
    else onDone();
  };

  return (
    <main className="login">
      <h1>Nuova password</h1>
      <p>Scegli la password che userai per entrare.</p>
      <form onSubmit={submit} noValidate>
        <label className="field">
          <span>Nuova password</span>
          <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label className="field">
          <span>Ripeti la password</span>
          <input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
        </label>
        {error && <p className="field-error" role="alert">{error}</p>}
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Salvo…' : 'Salva la password'}</button>
      </form>
    </main>
  );
}
