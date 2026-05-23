# Supabase Workflow (Operational)

Questa guida definisce un workflow pratico per leggere e modificare il database del progetto in modo sicuro.

## 1) Prerequisiti

Variabili ambiente minime (già usate dall'app):

- `SUPABASE_URL` (oppure `NEXT_PUBLIC_SUPABASE_URL`)
- `SUPABASE_SERVICE_ROLE_KEY` (oppure `SUPABASE_SECRET_KEY`)

Note:

- Non committare mai chiavi o token.
- `service_role`/`secret` bypassano RLS: usarle solo in backend/strumenti operativi.

## 2) Script operativo locale

Abbiamo aggiunto `scripts/supabase-admin.mjs` con comandi:

- `list-tables`
- `select`
- `insert`
- `update`
- `delete`

Comandi npm:

```bash
npm run supabase:tables
npm run supabase:select -- --table partecipanti --limit 20
npm run supabase:insert -- --table partecipanti --json '{"nome":"Mario"}' --confirm
npm run supabase:update -- --table partecipanti --json '{"citta":"Roma"}' --filter "id:eq:<uuid>" --confirm
npm run supabase:delete -- --table partecipanti --filter "id:eq:<uuid>" --confirm
```

Filtri supportati: `--filter "colonna:operatore:valore"` (ripetibile), ad esempio:

- `--filter "id:eq:<uuid>"`
- `--filter "email:ilike:%@example.com"`
- `--filter "created_at:gte:2026-01-01"`

## 3) Guardrail di sicurezza

I comandi di scrittura (`insert`, `update`, `delete`) richiedono due condizioni:

1. Variabile `SUPABASE_ALLOW_WRITES=1`
2. Flag `--confirm`

Esempio:

```bash
SUPABASE_ALLOW_WRITES=1 npm run supabase:update -- --table partecipanti --json '{"citta":"Roma"}' --filter "id:eq:<uuid>" --confirm
```

Inoltre:

- `update` e `delete` richiedono almeno un filtro, per evitare modifiche massive involontarie.

## 4) Workflow consigliato (team)

Ordine consigliato prima di ogni modifica:

1. `select` per verificare il target.
2. `update`/`delete` con filtro stretto e guardrail attivo.
3. `select` di verifica post-modifica.
4. Se la modifica è strutturale, creare una migrazione SQL in `supabase/*.sql`.

## 5) Quando usare Management API o MCP

### Data/API keys (questo repo)

- Ideale per CRUD applicativi su tabelle del progetto.
- Usa chiavi progetto (`publishable/secret` oppure `anon/service_role` legacy).

### Supabase Management API

- Ideale per operazioni di piattaforma/progetto (configurazioni, network restrictions, ecc.).
- Richiede `Authorization: Bearer <SUPABASE_ACCESS_TOKEN>` (PAT/OAuth account-level).

### Supabase MCP

- Supabase offre MCP hosted (`https://mcp.supabase.com/mcp`) con autenticazione OAuth moderna.
- Puoi limitare scope con `project_ref` e usare `read_only=true`.
- Consigliato per sviluppo/esplorazione assistita, non come canale primario su dati production sensibili.
