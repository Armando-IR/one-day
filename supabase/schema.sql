-- Finanze: struttura del database.
-- Dove incollarlo: Supabase > SQL Editor > New query > incolla tutto > Run.
-- Si può rieseguire senza perdere dati: crea solo quello che manca.
-- Quando l'app si aggiorna e arriva una tabella nuova, basta rieseguirlo tutto.
--
-- Ogni tabella ha una colonna user_id: le regole in fondo (Row Level Security)
-- fanno sì che ogni utente veda e modifichi solo le proprie righe.

-- Impostazioni (una riga per utente)
create table if not exists public.settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  ce_start date not null default date_trunc('year', now())::date,
  cf_start date not null default date_trunc('month', now())::date,
  cf_opening numeric,
  personal_income numeric not null default 500,
  savings_fixed numeric not null default 400,
  savings_pct numeric not null default 0.25,
  tax_rate numeric not null default 0.30,
  phase_probs jsonb not null default
    '{"Contatto":0.1,"Proposta inviata":0.3,"Trattativa":0.6,"Confermato a voce":0.9,"Persa":0}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Lavori: fatture emesse ai clienti e ricevute dai collaboratori
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('ricavo', 'collaboratore')),
  party text not null,
  description text,
  amount numeric not null check (amount >= 0),
  invoice_date date not null,
  cash_date date,
  settled boolean not null default false,
  note text,
  created_at timestamptz not null default now()
);

-- Spese: personali (Spese Base, per famiglia) e di lavoro (Business Expenses),
-- ogni mese, ogni anno (pay_month) o una volta sola (due_month)
create table if not exists public.fixed_costs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  scope text not null check (scope in ('personale', 'lavoro')),
  family text,
  name text not null,
  amount numeric not null default 0 check (amount >= 0),
  frequency text not null default 'mensile',
  pay_month int check (pay_month between 1 and 12),
  due_month date,
  start_month date,
  end_month date,
  active boolean not null default true,
  note text,
  created_at timestamptz not null default now()
);
-- Aggiornamento per chi aveva già eseguito questo script: le spese una volta sola,
-- il mese di inizio e il mese di fine delle spese di ogni mese e di ogni anno
alter table public.fixed_costs add column if not exists due_month date;
alter table public.fixed_costs add column if not exists start_month date;
alter table public.fixed_costs add column if not exists end_month date;
alter table public.fixed_costs drop constraint if exists fixed_costs_frequency_check;
alter table public.fixed_costs add constraint fixed_costs_frequency_check
  check (frequency in ('mensile', 'annuale', 'una_tantum'));

-- Entrate che non sono fatture: stipendio, pensione, un affitto che ricevi (importo netto)
create table if not exists public.incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  amount numeric not null default 0 check (amount >= 0),
  frequency text not null default 'mensile' check (frequency in ('mensile', 'annuale', 'una_tantum')),
  pay_month int check (pay_month between 1 and 12),
  due_month date,
  start_month date,
  end_month date,
  active boolean not null default true,
  note text,
  created_at timestamptz not null default now()
);

-- Rate
create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  installment numeric check (installment >= 0),
  first_month date,
  last_month date,
  note text,
  created_at timestamptz not null default now()
);

-- Tasse da pagare (F24)
create table if not exists public.taxes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  due_date date not null,
  description text not null,
  amount numeric check (amount >= 0),
  note text,
  created_at timestamptz not null default now()
);

-- Ipotesi di lavoro
create table if not exists public.pipeline (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  client text,
  phase text not null default 'Contatto'
    check (phase in ('Contatto', 'Proposta inviata', 'Trattativa', 'Confermato a voce', 'Persa')),
  amount numeric not null default 0 check (amount >= 0),
  expected_month date not null,
  prob_override numeric check (prob_override between 0 and 1),
  note text,
  created_at timestamptz not null default now()
);

-- Desideri
create table if not exists public.wishes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  cost numeric not null default 0 check (cost >= 0),
  priority text not null default 'media' check (priority in ('alta', 'media', 'bassa')),
  target_month date,
  planned boolean not null default false,
  note text,
  created_at timestamptz not null default now()
);

-- Risparmi messi da parte fuori dal conto: contano nel patrimonio, non nel cashflow
create table if not exists public.savings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  amount numeric not null default 0,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists invoices_user_idx on public.invoices (user_id);
create index if not exists fixed_costs_user_idx on public.fixed_costs (user_id);
create index if not exists incomes_user_idx on public.incomes (user_id);
create index if not exists debts_user_idx on public.debts (user_id);
create index if not exists taxes_user_idx on public.taxes (user_id);
create index if not exists pipeline_user_idx on public.pipeline (user_id);
create index if not exists wishes_user_idx on public.wishes (user_id);
create index if not exists savings_user_idx on public.savings (user_id);

-- Row Level Security: ognuno vede e modifica solo i propri dati
do $$
declare t text;
begin
  foreach t in array array['settings', 'invoices', 'fixed_costs', 'incomes', 'debts', 'taxes', 'pipeline', 'wishes', 'savings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "solo i miei dati" on public.%I', t);
    execute format(
      'create policy "solo i miei dati" on public.%I for all to authenticated '
      'using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- Permessi per l'app (solo utenti con login; i visitatori anonimi non vedono nulla)
grant usage on schema public to authenticated;
grant select, insert, update, delete
  on public.settings, public.invoices, public.fixed_costs, public.incomes, public.debts, public.taxes, public.pipeline, public.wishes,
     public.savings
  to authenticated;
revoke all
  on public.settings, public.invoices, public.fixed_costs, public.incomes, public.debts, public.taxes, public.pipeline, public.wishes,
     public.savings
  from anon;

-- L'app vede subito tabelle e campi nuovi
notify pgrst, 'reload schema';
