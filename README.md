# Finanze

App per il telefono che prende il posto del foglio «Personal Finance»: fatture, spese fisse, rate, F24, ipotesi di lavoro, desideri, cashflow, conto economico e obiettivi.

- **Home**: quanto avrai sul conto a fine mese, il grafico dei prossimi mesi (sotto il grafico scegli quanti: 6 mesi, 1 anno o 2 anni; la scelta resta salvata sul telefono), quanto del minimo dell'anno hai raggiunto, quanto devi ancora, le cose da sistemare (un tocco apre la voce da completare) e incassi, pagamenti, rate, F24, spese di ogni anno o una tantum e desideri delle prossime settimane. Toccando il nome del mese in alto scegli un altro mese del cashflow da un elenco (oppure usa le frecce, o tocca un mese sul grafico): quanto avrai (o avevi) sul conto a fine mese e le sue entrate e uscite una per una, con le spese di ogni mese in una riga sola. Se il mese scelto è fuori dal grafico, il grafico si sposta per mostrarlo. «Torna a…» riporta al mese in corso.
- **Lavori**: fatture da incassare e da pagare ai collaboratori. Un tocco sul cerchio la segna come incassata o pagata. Per un cliente che paga ogni mese, nella nuova fattura accendi «Ripeti ogni mese» e scegli l'ultimo mese: l'app crea una fattura per mese, con le date spostate di un mese alla volta, da segnare come incassate una per una.
- **Piani**: obiettivi (a che punto sei da inizio anno; il margine mese per mese con la linea della media: tocca un mese per vederne margine, media e totale; i trimestri; la tabella completa come nel foglio Projections; il minimo e i due obiettivi di risparmio), ipotesi di lavoro con la loro probabilità, desideri.
- **Conti**: il cashflow mese per mese fino a 2 anni da oggi (per data di incasso e pagamento), il conto economico (per data della fattura), le spese (personali per famiglia e di lavoro: ogni mese o ogni anno, anche solo per un periodo, oppure una volta sola) e il patrimonio: lo stato patrimoniale a fine mese (quello che hai, quello che devi, la differenza), i risparmi messi da parte fuori dal conto e i debiti uno per uno, cioè rate e prestiti con il residuo, tasse (F24) in scadenza, collaboratori da pagare.
- **Analisi** (dalla Home, «Analisi della situazione»): la situazione scritta in parole semplici. In cima com'è (tutto in ordine, da tenere d'occhio, da sistemare) e cosa fare adesso, con un tocco che apre la voce giusta; poi il conto (quando va sotto zero, quanto serve e quanti mesi di spese copri), il lavoro (minimo dell'anno, quanto ti serve al mese, quanto dipendi da un cliente, tasse stimate), le spese, debiti e crediti, desideri e risparmio. Il testo lo scrive l'app con regole fisse sugli stessi conti delle altre pagine: nessuna AI, niente esce dal tuo database.
- **Impostazioni** (l'ingranaggio in Home): parametri, backup, account.

I dati stanno in un database Supabase tuo, protetto da login. L'app si pubblica gratis su Vercel e si installa sul telefono come un'app normale.

---

## Mettere online l'app

Servono tre account gratuiti: Supabase, GitHub, Vercel. Circa 20 minuti.

### 1. Supabase, il database

1. Su [supabase.com](https://supabase.com) crea un nuovo progetto. Come regione scegli una in Europa (per esempio Frankfurt). La password del database generala e conservala: all'app non serve.
2. Apri **SQL Editor**, poi **New query**. Incolla tutto il contenuto di `supabase/schema.sql` e premi **Run**. Deve rispondere «Success. No rows returned».
3. Apri **Authentication → Users → Add user → Create new user**. Scrivi la tua email e una password, spunta **Auto Confirm User** e conferma.
4. Apri **Authentication → Sign In / Providers** e spegni **Allow new users to sign up**. Così nessun altro può crearsi un account.
5. Apri **Project Settings → API Keys** e copia due valori:
   - il **Project URL** (tipo `https://abcd1234.supabase.co`, lo trovi anche nel pulsante **Connect**);
   - la chiave **publishable** (inizia con `sb_publishable_`) oppure, nei progetti più vecchi, la chiave **anon public**.

> **Mai la chiave `service_role` o `secret`.** Quella dà accesso a tutto il database senza login: non va messa nell'app, su GitHub, su Vercel, né mandata a nessuno.

### 2. GitHub, dove sta il codice

1. Su [github.com](https://github.com) crea un repository **privato**, per esempio `finanze`.
2. Carica i file di questa cartella (tutto, tranne `node_modules` e `dist` se ci sono). Dalla pagina del repository: **Add file → Upload files**, trascina dentro i file e le cartelle, poi **Commit changes**.

   Oppure dal terminale:

   ```sh
   git init && git add . && git commit -m "Prima versione"
   git branch -M main
   git remote add origin https://github.com/TUO-UTENTE/finanze.git
   git push -u origin main
   ```

### 3. Vercel, che pubblica l'app

1. Su [vercel.com](https://vercel.com) entra con GitHub, poi **Add New → Project** e importa il repository `finanze`.
2. Vercel riconosce da solo che è un progetto Vite: lascia le impostazioni come sono.
3. In **Environment Variables** aggiungi:

   | Nome | Valore |
   | --- | --- |
   | `VITE_SUPABASE_URL` | il Project URL di Supabase |
   | `VITE_SUPABASE_ANON_KEY` | la chiave publishable (o anon public) |

4. Premi **Deploy**. Alla fine Vercel ti dà l'indirizzo dell'app, tipo `https://finanze-tuonome.vercel.app`.
5. Torna in Supabase, **Authentication → URL Configuration**, e metti quell'indirizzo in **Site URL**. Serve al link «Password dimenticata».

### 4. Sul telefono

- **iPhone**: apri l'indirizzo con Safari, tocca **Condividi → Aggiungi alla schermata Home**.
- **Android**: apri l'indirizzo con Chrome, menu **⋮ → Installa app** (o **Aggiungi a schermata Home**).

Entra con l'email e la password create al punto 1.3. Il login resta salvato sul telefono.

### 5. I tuoi dati

Il file `dati-iniziali.json` contiene i dati del foglio. Non sta in questo repository, di proposito: tienilo sul telefono o sul computer.

1. Nell'app: **Impostazioni → Backup → Importa da file**, scegli `dati-iniziali.json`, poi **Importa**.
2. In Home, sotto **Da sistemare**, l'app elenca quello che manca: il saldo del conto al 1° del mese di partenza, le spese quotidiane, gli importi delle spese del motorino, le rate Klarna e PayPal, gli importi degli F24. Tocca una voce per completarla.

**Spese quotidiane.** Supermercato, drink e uscite restano su Revolut: nell'app c'è solo la loro media mensile, come spesa fissa della famiglia «Quotidiane». Così il cashflow e il conto economico ne tengono conto senza registrare le singole spese. La media la trovi nelle statistiche di Revolut; aggiornala ogni tanto.

---

## Aggiungi al calendario

Nelle schede di F24, rate, fatture non ancora incassate o pagate, spese di ogni anno e spese una tantum c'è «Aggiungi al calendario»:
- **Calendario del telefono**: sull'app pubblicata su Vercel, il file dell'evento arriva dall'indirizzo dell'app stessa (`api/ics.js`), così l'iPhone lo apre direttamente in Calendario. La funzione non salva niente: l'evento va e torna nella stessa richiesta.
- **Google Calendar**: apre Google Calendar con l'evento già compilato.

Ogni evento è alle 9, con un promemoria il giorno prima. Le rate si ripetono ogni mese per il numero di rate, le spese di ogni anno ogni anno (fino all'ultimo mese, se l'hai indicato).

## Sicurezza

- La chiave publishable/anon è fatta per stare in un'app pubblica: da sola non legge niente. Le regole del database (Row Level Security, in `schema.sql`) fanno vedere a ogni utente solo le proprie righe, e solo dopo il login.
- La registrazione è spenta (punto 1.4): l'unico utente sei tu.
- Nel repository non c'è nessun dato personale. Il file `.gitignore` esclude i backup e `dati-iniziali.json`.
- Sul telefono l'app tiene una copia dei dati per funzionare anche senza rete. **Esci** (in Impostazioni) cancella anche quella copia.
- Ogni tanto fai **Impostazioni → Backup → Esporta i dati**: è il tuo backup completo, reimportabile.

## Da sapere

- **Aggiornamenti del database.** Se una nuova versione dell'app aggiunge una tabella (come quella dei risparmi fuori dal conto o delle entrate) o un campo (come il mese delle spese una tantum, o il mese di inizio e di fine delle spese), riesegui tutto `supabase/schema.sql` nello SQL Editor: crea solo quello che manca e non tocca i dati. Se te ne dimentichi, l'app te lo ricorda all'avvio.
- **Progetti gratuiti in pausa.** Supabase mette in pausa i progetti gratuiti dopo una settimana senza attività. Se succede, l'app mostra i dati salvati sul telefono con l'avviso «Il database non risponde»: entra in Supabase e premi **Restore project**, poi tocca **Riprova**.
- **Aggiornamenti.** Ogni modifica caricata su GitHub viene pubblicata da Vercel in un paio di minuti. L'app sul telefono mostra «C'è una versione nuova dell'app» con il pulsante **Aggiorna**.
- **Più dispositivi.** Puoi aprire la stessa app dal computer: i dati sono gli stessi. Quando torni sull'app dal telefono, si aggiorna da sola.
- **Senza database.** Se l'app parte senza le due variabili di Vercel, si apre in **modalità prova** con dati di esempio inventati, salvati solo in quel browser.

## Come fa i conti

- **Cashflow (Conti → Cassa)**: parte dal saldo del conto al 1° del mese di partenza e arriva sempre fino a 2 anni da oggi. Contano le date di incasso e di pagamento. Le spese annuali cadono nel mese in cui le paghi (o divise per 12 se il mese non è indicato), le rate il 1° del mese, gli F24 alla scadenza, i desideri in programma nel mese scelto. Le fatture non incassate con data di incasso prima del mese di partenza sono «incassi in ritardo»: non vengono contate finché non sposti la data. Le entrate e le uscite di un mese che vedi in Home sono le stesse: saldo del 1° + entrate − uscite = saldo a fine mese.
- **Conto economico (Conti → Economico)**: conta la data della fattura. Margine = ricavi − collaboratori. Le tasse sono una stima: aliquota × (margine − spese di lavoro).
- **Obiettivi (Piani)**, in margine al mese:
  - Minimo = quanto vuoi per te ÷ (1 − aliquota tasse) + spese di lavoro;
  - Minimo + % di risparmio = (quanto vuoi per te ÷ (1 − %)) ÷ (1 − aliquota) + spese di lavoro;
  - Minimo + cifra fissa = (quanto vuoi per te + cifra fissa) ÷ (1 − aliquota) + spese di lavoro;
  - Minimo + accantonamenti = (quanto vuoi per te + quanto mettere da parte al mese per spese una tantum e desideri in programma) ÷ (1 − aliquota) + spese di lavoro.

  Le spese di lavoro sono quelle del mese in corso: una spesa già finita o che deve ancora iniziare non conta.
- **Patrimonio (Conti → Patrimonio)**: a fine mese, quello che hai (saldo del conto, risparmi fuori dal conto, fatture ancora da incassare) meno quello che devi (rate, F24, collaboratori). I risparmi fuori dal conto contano solo qui, non nel cashflow. Contano solo crediti e debiti che restano aperti dopo il mese, perché incassi e pagamenti del mese sono già nel saldo del conto.
- **Debiti (in Conti → Patrimonio)**: per ogni rata, residuo = rata × rate ancora da pagare (quella del mese in corso si considera già addebitata il 1°). Poi gli F24 con scadenza da oggi in avanti e le fatture dei collaboratori non ancora pagate. Rate senza dati e F24 senza importo restano fuori dal totale, segnalati.
- **Media, trimestri e totale (Piani → Obiettivi)**: come il foglio Projections. Margine del mese; media al mese e totale da inizio anno; trimestri confrontati con gli obiettivi moltiplicati per tre. La media parte sempre da inizio anno (nel foglio, da luglio ripartiva da zero).
- **Spese (Conti → Spese)**: ogni spesa è personale (in una famiglia: Casa, Quotidiane, Motorino…) o di lavoro, e capita ogni mese, ogni anno o una volta sola. Quelle di ogni mese e di ogni anno fanno il costo mensile (le annuali divise per 12 nel conto economico, nel loro mese nel cashflow). Quelle una tantum entrano nel cashflow e nel conto economico del loro mese (se di lavoro, riducono le tasse stimate) e nell'obiettivo «Minimo + accantonamenti», con quanto mettere da parte ogni mese fino a quel mese. Una spesa una tantum serve anche per stimare un F24 di cui non sai ancora l'importo: quando arriva quello vero, scrivilo nell'F24 e cancella la spesa.
  - **Mese di inizio e di fine.** Una spesa di ogni mese o di ogni anno può avere un primo e un ultimo mese (un affitto nuovo, un abbonamento disdetto, un corso): conta solo in quei mesi, nel cashflow e nel conto economico. Lasciati vuoti, la spesa vale sempre. Quando disdici una spesa, metti l'ultimo mese invece di spegnerla: spenta, sparisce anche dai mesi passati.
  - In Conti → Spese, «oggi fanno» è il costo del mese in corso (le spese di ogni anno divise per 12); «nei prossimi 12 mesi» è quanto pagherai davvero da questo mese in poi, ogni spesa solo nei suoi mesi. In grigio le spese finite, spente o che devono ancora iniziare.
- **Analisi**: «da sistemare» se manca il saldo di partenza o se il conto va sotto zero entro due mesi; «da tenere d'occhio» se va sotto zero entro sei mesi, se ci sono incassi in ritardo, se le spese personali superano quanto vuoi per te, se per arrivare al minimo ti serve più della tua media o se l'anno del conto economico è finito. Il conto conta solo gli incassi già inseriti: per i mesi lontani, quello che serve è un ordine di grandezza, non una previsione.
- **Entrate (Conti → Spese, o + → Entrata)**: stipendio, pensione, un affitto che ricevi, un rimborso: tutto quello che arriva sul conto e non è una fattura. Come le spese: ogni mese, ogni anno o una volta, con mese di inizio e di fine. Va scritto l'importo netto. Entrano nel cashflow nel loro mese e nel conto economico in «Altre entrate», senza cambiare le tasse stimate. Quelle di ogni mese abbassano il minimo da guadagnare: Minimo = (quanto vuoi per te − altre entrate) ÷ (1 − aliquota) + spese di lavoro, e così gli obiettivi di risparmio.
- **Ipotesi**: valore probabile = importo × probabilità. La probabilità viene dalla fase (Contatto 10%, Proposta inviata 30%, Trattativa 60%, Confermato a voce 90%, Persa 0%), oppure da una tua per la singola ipotesi. Le linee «con i lavori probabili» aggiungono questi valori.

---

## Per lo sviluppo

Serve Node 22 o più recente.

```sh
npm install
npm run dev          # app sul computer: senza .env.local parte in modalità prova
npm test             # verifica dei calcoli
npm run build        # versione da pubblicare, in dist/
npm run build:demo   # copia con dati di esempio, senza service worker, in dist-demo/
```

Per usare il database anche in locale, copia `.env.example` in `.env.local` e inserisci i due valori.

Struttura: `src/lib` calcoli, date, accesso ai dati; `src/state` stato dell'app; `src/screens` le schermate; `src/forms` i moduli; `src/ui` componenti, grafici, formati; `supabase/schema.sql` il database.
