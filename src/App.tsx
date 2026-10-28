import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { AUTH_STORAGE_KEY, LocalBackend, OfflineBackend, SupabaseBackend, supabase } from './lib/backend';
import { DataProvider, useData } from './state/data';
import { SPAN_KEY, Ui, useUi, type ContiView, type LavoriFilter, type PianiView, type SheetState, type Tab, type UiCtx } from './state/ui';
import { Home } from './screens/Home';
import { Lavori } from './screens/Lavori';
import { Piani } from './screens/Piani';
import { Conti } from './screens/Conti';
import { Impostazioni } from './screens/Impostazioni';
import { Analisi } from './screens/Analisi';
import { Login, NewPassword } from './screens/Login';
import { CostForm, DebtForm, InvoiceForm, PipelineForm, SavingForm, TaxForm, WishForm } from './forms/forms';
import { ImportSheet, OpeningForm, ParamsForm, ProbsForm, YearForm } from './forms/settingsForms';
import { Sheet } from './ui/components';
import { IconHome, IconInvoices, IconMonths, IconPlans, IconPlus } from './ui/icons';
import { applyUpdate, useNeedRefresh } from './pwa';

// The link in the "nuova password" email lands here with type=recovery in the address.
// Read it now, before the Supabase client cleans up the address bar.
const RECOVERY_IN_URL = typeof window !== 'undefined' && /type=recovery/.test(window.location.hash);

export function App() {
  return supabase ? <AuthGate sb={supabase} /> : <Prova />;
}

// ---------------------------------------------------------------- without a database: data on this device
function Prova() {
  const [backend] = useState(() => new LocalBackend());
  return (
    <DataProvider backend={backend} cacheKey="finanze-prova-cache" fallback={(st) => <LoadScreen {...st} />}>
      <Shell />
    </DataProvider>
  );
}

// ---------------------------------------------------------------- with Supabase: login first
const LAST_USER_KEY = 'finanze-last-user';
const cacheKeyFor = (userId: string) => `finanze-cache-${userId}`;
type LastUser = { id: string; email?: string };

function readLastUser(): LastUser | null {
  try {
    const raw = localStorage.getItem(LAST_USER_KEY);
    return raw ? (JSON.parse(raw) as LastUser) : null;
  } catch {
    return null;
  }
}

function hasStored(key: string): boolean {
  try {
    return !!localStorage.getItem(key);
  } catch {
    return false;
  }
}

/** The last user of this device, if their login and a copy of their data are still saved here. */
function savedUser(): LastUser | null {
  const last = readLastUser();
  return last && hasStored(AUTH_STORAGE_KEY) && hasStored(cacheKeyFor(last.id)) ? last : null;
}

/** Signs out this device only, and removes the copy of the data kept here. Works offline too. */
async function signOutHere(sb: SupabaseClient, userId: string) {
  try {
    localStorage.removeItem(cacheKeyFor(userId));
    localStorage.removeItem(LAST_USER_KEY);
    localStorage.removeItem(SPAN_KEY);
  } catch {
    /* nothing to remove */
  }
  const { error } = await sb.auth.signOut({ scope: 'local' });
  if (error) {
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      /* already gone */
    }
    window.location.reload();
  }
}

function AuthGate({ sb }: { sb: SupabaseClient }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [recovery, setRecovery] = useState(RECOVERY_IN_URL);

  useEffect(() => {
    const { data } = sb.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') setRecovery(false);
      setSession(s);
    });
    return () => data.subscription.unsubscribe();
  }, [sb]);

  // While Supabase checks the login (offline it can take half a minute), and when it could not renew it
  // for lack of connection (it keeps the login saved in that case), show the data saved on this device.
  const saved = session ? null : savedUser();
  if (saved) return <OfflineView sb={sb} user={saved} />;
  if (session === undefined) return <Splash />;
  if (!session) return <Login sb={sb} />;
  if (recovery) return <NewPassword sb={sb} onDone={() => setRecovery(false)} />;
  return <SignedIn sb={sb} session={session} />;
}

function SignedIn({ sb, session }: { sb: SupabaseClient; session: Session }) {
  const userId = session.user.id;
  const email = session.user.email;
  const backend = useMemo(() => new SupabaseBackend(sb, userId), [sb, userId]);
  const cacheKey = cacheKeyFor(userId);
  const signOut = useCallback(() => signOutHere(sb, userId), [sb, userId]);
  useEffect(() => {
    try {
      localStorage.setItem(LAST_USER_KEY, JSON.stringify({ id: userId, email } satisfies LastUser));
    } catch {
      /* only needed for offline use */
    }
  }, [userId, email]);

  return (
    <DataProvider key={userId} backend={backend} cacheKey={cacheKey}
      fallback={(st) => <LoadScreen {...st} onSignOut={() => void signOut()} />}>
      <Shell email={session.user.email} onSignOut={() => void signOut()} />
    </DataProvider>
  );
}

function OfflineView({ sb, user }: { sb: SupabaseClient; user: LastUser }) {
  // Each load asks for the session again (renewing the login if needed): when there is one, AuthGate switches to SignedIn.
  const backend = useMemo(() => new OfflineBackend(async () => !!(await sb.auth.getSession()).data.session), [sb]);
  const signOut = () => void signOutHere(sb, user.id);
  return (
    <DataProvider backend={backend} cacheKey={cacheKeyFor(user.id)}
      fallback={(st) => (st.error ? <Login sb={sb} /> : <Splash />)}>
      <Shell email={user.email} onSignOut={signOut} />
    </DataProvider>
  );
}

function Splash() {
  return (
    <main className="login" aria-busy="true">
      <h1>Finanze</h1>
      <p>Carico i tuoi dati…</p>
    </main>
  );
}

/** The database answers, but a table or a column of the app is missing: schema.sql has not been run (again). */
const needsUpdate = (error: string | null) => !!error && /does not exist|schema cache|relation/i.test(error);

function LoadScreen({ error, retry, onSignOut }: { error: string | null; retry: () => void; onSignOut?: () => void }) {
  if (!error) return <Splash />;
  const noTables = needsUpdate(error);
  return (
    <main className="login">
      <h1>Finanze</h1>
      <p>{noTables ? "Al database manca un aggiornamento dell'app." : 'Non riesco a caricare i dati.'}</p>
      <p className="banner">
        {noTables
          ? 'In Supabase apri SQL Editor, incolla tutto il file supabase/schema.sql e premi Run: si può rieseguire senza perdere dati. Poi torna qui e tocca Riprova.'
          : /fetch|network/i.test(error)
            ? 'Sembra che manchi la connessione. Quando torna, tocca Riprova.'
            : `Risposta del database: ${error}`}
      </p>
      <button className="btn" onClick={retry}>Riprova</button>
      {onSignOut && <button className="link-btn" style={{ marginTop: 12, justifySelf: 'start' }} onClick={onSignOut}>Esci</button>}
    </main>
  );
}

// ---------------------------------------------------------------- the app itself
function Shell({ email, onSignOut }: { email?: string; onSignOut?: () => void }) {
  const { toasts, stale, loadError, mode, reload, notify } = useData();
  const needRefresh = useNeedRefresh();
  const [tab, setTab] = useState<Tab>('home');
  const [lavoriFilter, setLavoriFilter] = useState<LavoriFilter>('incassare');
  const [pianiView, setPianiView] = useState<PianiView>('obiettivi');
  const [contiView, setContiView] = useState<ContiView>('cassa');
  const [sheet, setSheet] = useState<{ s: SheetState; key: number } | null>(null);
  const sheetKey = useRef(0);
  const sheetInHistory = useRef(false);

  const go = useCallback((t: Tab, opts?: { lavori?: LavoriFilter; piani?: PianiView; conti?: ContiView }) => {
    if (opts?.lavori) setLavoriFilter(opts.lavori);
    if (opts?.piani) setPianiView(opts.piani);
    if (opts?.conti) setContiView(opts.conti);
    setTab(t);
    window.scrollTo({ top: 0 });
  }, []);

  // An open sheet takes a step in the history, so the phone's back button closes it.
  const open = useCallback((s: SheetState) => {
    if (!sheetInHistory.current) {
      try {
        history.pushState({ finanzeSheet: true }, '');
        sheetInHistory.current = true;
      } catch {
        /* some embedded views refuse it: the sheet still opens, the back button just won't close it */
      }
    }
    setSheet({ s, key: ++sheetKey.current });
  }, []);
  const close = useCallback(() => {
    if (sheetInHistory.current) {
      sheetInHistory.current = false;
      history.back();
    }
    setSheet(null);
  }, []);
  useEffect(() => {
    const onPop = () => {
      if (sheetInHistory.current) {
        sheetInHistory.current = false;
        setSheet(null);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Coming back to the app (or back online): fetch what may have changed from another device.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void reload();
    };
    const onOnline = () => void reload();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [reload]);

  const ui = useMemo<UiCtx>(
    () => ({ tab, go, lavoriFilter, setLavoriFilter, pianiView, setPianiView, contiView, setContiView, open, close }),
    [tab, go, lavoriFilter, pianiView, contiView, open, close],
  );

  return (
    <Ui.Provider value={ui}>
      <div className="app">
        {needRefresh && (
          <div className="banner app-banner">
            <span>C'è una versione nuova dell'app.</span>
            <button className="link-btn" onClick={applyUpdate}>Aggiorna</button>
          </div>
        )}
        {stale && (
          <div className="banner app-banner">
            <span>
              {needsUpdate(loadError)
                ? "Al database manca un aggiornamento dell'app: in Supabase apri SQL Editor e riesegui tutto supabase/schema.sql. Intanto vedi i dati salvati su questo dispositivo."
                : `${navigator.onLine ? 'Il database non risponde' : 'Sei offline'}: vedi i dati salvati su questo dispositivo. Le modifiche non vengono salvate.`}
            </span>
            <button className="link-btn"
              onClick={async () => !(await reload()) && notify('Ancora nessuna risposta. Riprovo da solo quando torna la connessione.', 'error')}>
              Riprova
            </button>
          </div>
        )}
        {mode === 'prova' && tab === 'home' && (
          <div className="banner app-banner">
            <span>Modalità prova: si parte con dati di esempio inventati, e tutto resta solo in questo browser.</span>
          </div>
        )}
        {tab === 'home' && <Home />}
        {tab === 'lavori' && <Lavori />}
        {tab === 'piani' && <Piani />}
        {tab === 'conti' && <Conti />}
        {tab === 'impostazioni' && <Impostazioni email={email} onSignOut={onSignOut} />}
        {tab === 'analisi' && <Analisi />}
      </div>

      <Nav tab={tab} go={go} onAdd={() => open({ type: 'add' })} />

      {sheet && <SheetHost key={sheet.key} sheet={sheet.s} onClose={close} />}

      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone === 'error' ? 'error' : ''}`}>{t.text}</div>
        ))}
      </div>
    </Ui.Provider>
  );
}

const NAV: { tab: Tab; label: string; icon: ComponentType }[] = [
  { tab: 'home', label: 'Home', icon: IconHome },
  { tab: 'lavori', label: 'Lavori', icon: IconInvoices },
  { tab: 'piani', label: 'Piani', icon: IconPlans },
  { tab: 'conti', label: 'Conti', icon: IconMonths },
];

function Nav({ tab, go, onAdd }: { tab: Tab; go: (t: Tab) => void; onAdd: () => void }) {
  const item = ({ tab: t, label, icon: Icon }: (typeof NAV)[number]) => (
    <button key={t} aria-current={tab === t ? 'page' : undefined} onClick={() => go(t)}>
      <Icon />
      {label}
    </button>
  );
  return (
    <nav className="nav" aria-label="Sezioni">
      <div className="nav-inner">
        {NAV.slice(0, 2).map(item)}
        <button className="plus" aria-label="Aggiungi" onClick={onAdd}><IconPlus /></button>
        {NAV.slice(2).map(item)}
      </div>
    </nav>
  );
}

const ADD: { title: string; sub: string; sheet: SheetState; wide?: boolean }[] = [
  { title: 'Fattura a un cliente', sub: 'Un lavoro da incassare', sheet: { type: 'invoice', kind: 'ricavo' } },
  { title: 'Fattura di un collaboratore', sub: 'Da pagare a chi ha lavorato con te', sheet: { type: 'invoice', kind: 'collaboratore' } },
  { title: 'Ipotesi di lavoro', sub: 'Un lavoro possibile, con la sua probabilità', sheet: { type: 'pipeline' } },
  { title: 'Desiderio', sub: 'Una cosa che vuoi comprare', sheet: { type: 'wish' } },
  { title: 'Spesa', sub: 'Ogni mese, ogni anno o una volta', sheet: { type: 'cost', scope: 'personale' } },
  { title: 'Debito a rate', sub: 'Un prestito o un acquisto a rate', sheet: { type: 'debt' } },
  { title: 'Tasse (F24)', sub: 'Una scadenza da pagare', sheet: { type: 'tax' } },
  { title: 'Risparmio', sub: 'Soldi da parte, fuori dal conto', sheet: { type: 'saving' } },
];

function AddMenu({ onClose }: { onClose: () => void }) {
  const { open } = useUi();
  return (
    <Sheet title="Aggiungi" onClose={onClose}>
      <div className="tiles">
        {ADD.map((t) => (
          <button key={t.title} className={`tile ${t.wide ? 'wide' : ''}`} onClick={() => open(t.sheet)}>
            <strong>{t.title}</strong>
            <span>{t.sub}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

function SheetHost({ sheet, onClose }: { sheet: SheetState; onClose: () => void }) {
  switch (sheet.type) {
    case 'add': return <AddMenu onClose={onClose} />;
    case 'invoice': return <InvoiceForm kind={sheet.kind} initial={sheet.initial} onClose={onClose} />;
    case 'cost': return <CostForm scope={sheet.scope} initial={sheet.initial} onClose={onClose} />;
    case 'debt': return <DebtForm initial={sheet.initial} onClose={onClose} />;
    case 'tax': return <TaxForm initial={sheet.initial} onClose={onClose} />;
    case 'pipeline': return <PipelineForm initial={sheet.initial} onClose={onClose} />;
    case 'wish': return <WishForm initial={sheet.initial} onClose={onClose} />;
    case 'saving': return <SavingForm initial={sheet.initial} onClose={onClose} />;
    case 'opening': return <OpeningForm onClose={onClose} />;
    case 'year': return <YearForm onClose={onClose} />;
    case 'params': return <ParamsForm onClose={onClose} />;
    case 'probs': return <ProbsForm onClose={onClose} />;
    case 'import': return <ImportSheet text={sheet.text} onClose={onClose} />;
  }
}
