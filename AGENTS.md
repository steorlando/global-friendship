# Global Friendship App

This file is a working memory for future Codex sessions on this repository.
Keep it updated when major routes, data structures, or business rules change.

## Project Summary

- App name: `global-friendship-app`
- Stack: Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Supabase
- Main domain used in production: `https://portal.globalfriendship.eu`
- Main purpose: manage registrations for the Global Friendship event across multiple operational roles
- Roles supported:
  - `admin`
  - `manager`
  - `capogruppo`
  - `partecipante`
  - `alloggi`

## Core Commands

- Start dev server: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Default test script: `npm test`
- Run SQL on the self-hosted production Supabase DB:
  `scripts/selfhosted-db-query.sh supabase/<migration>.sql`

## Git Workflow

- Always push repository changes directly to `main`.
- Never create or switch to a different branch for Codex changes in this repository.

Notes:
- `npm test` runs `tests/email-recipient-id-utils.test.ts` and `tests/bank-statement-import.test.ts`.
- There are many additional `tests/*.test.ts` files in the repo; run them explicitly with `node --test --experimental-strip-types <file>` if needed.

## Environment Variables

Common env vars used by the app:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `GMAIL_USER`
- `GMAIL_APP_PASSWORD`
- `PARTECIPANTE_CONTACT_FROM_EMAIL`
- `TALLY_WEBHOOK_SECRET`

Important:
- Do not copy secrets into commits or docs.
- The service role key is used by server-side operational APIs.

## Authentication / Login Flow

Main files:

- `app/login/page.tsx`
- `app/auth/callback/page.tsx`
- `app/api/auth/login/magic-link/route.ts`
- `app/api/auth/login/preflight/route.ts`
- `lib/auth/login-access.ts`
- `lib/auth/roles.ts`
- `lib/supabase/client.ts`
- `lib/supabase/server.ts`
- `lib/supabase/service.ts`

How it works:

- Login is email magic-link based via Supabase.
- Before sending the magic link, shared logic in `lib/auth/login-access.ts` verifies the email can access the selected role.
- The login page posts to `POST /api/auth/login/magic-link`.
- That route uses the Supabase service role to call Auth admin `generate_link`, builds an app callback URL with `token_hash`, `type`, and `role`, then sends the email through the app Gmail sender.
- This avoids relying on the self-hosted Supabase Auth mailer/redirect configuration for user-facing login links.
- `POST /api/auth/login/preflight` is still available for access checks and uses the same shared helper.
- The requested role is stored in local storage / cookie as `gf_requested_role`.
- Callback page consumes `code`, `token_hash`, or `token`, verifies the session, resolves the actual profile from `profili`, and redirects to the correct dashboard route.
- Callback token-hash verification supports both `magiclink` and `signup` types, because Supabase Auth returns `signup` for first-time Auth users.
- Browser auth uses PKCE flow.

Known auth behavior:

- The callback clears stale Supabase browser session storage before consuming a new login token.
- Refresh-token-related local failures should redirect back to `/login`.

Supabase redirect URLs must allow at least:

- `http://localhost:3000/auth/callback`
- `http://127.0.0.1:3000/auth/callback`
- `https://portal.globalfriendship.eu/auth/callback`
- any deployment URL actually used in Vercel

## Route Structure

Top-level pages:

- `app/page.tsx`
- `app/login/page.tsx`
- `app/auth/callback/page.tsx`
- `app/global_gfhi8y/page.tsx`

Dashboards:

- Admin: `app/dashboard/admin/*`
- Manager: `app/dashboard/manager/*`
- Accommodation: `app/dashboard/alloggi/*`
- Group leader: `app/dashboard/capogruppo/*`
- Participant: `app/dashboard/partecipante/*`

Shared dashboard components live mostly in:

- `app/dashboard/_components/*`

## Role Dashboards

### Admin

Main layout:

- `app/dashboard/admin/layout.tsx`

Sections currently exposed:

- Statistics
- Participants
- Alloggi
- Users & Profiles
- Email Campaigns
- Settings

Important implementation detail:

- `app/dashboard/admin/page.tsx` currently reuses the manager statistics page directly.

### Admin Users & Profiles

Main files:

- `app/dashboard/admin/users-profiles/page.tsx`
- `app/api/admin/profili/route.ts`
- `lib/admin/profili.ts`
- `supabase/profili_capogruppo_host_migration.sql`

Current behavior:

- The admin Users & Profiles table includes a `Host Group Leader` column.
- In row edit mode, admins can set `capogruppo_host` through a checkbox.
- The host checkbox is enabled only when role is `capogruppo`; for other roles it is forced to `false`.
- Backend profile upsert/update logic enforces the same rule server-side.

### Manager

Main layout:

- `app/dashboard/manager/layout.tsx`

Tabs currently exposed:

- Statistics
- Participants
- Accommodation
- Participation Fees
- Event Finance
- Email Campaigns

### Alloggi

Main layout:

- `app/dashboard/alloggi/layout.tsx`

Sections:

- Inventory
- Group allocations
- Room assignment
- Hotel overview
- Hotel rosters
- Room rosters

### Capogruppo

Main layout:

- `app/dashboard/capogruppo/layout.tsx`

Sections:

- Participants
- Room assignment

The participants page shows a payment summary across all groups assigned to the group leader:

- total participation fees due (`quota_totale`)
- total already paid (`fee_paid`)
- outstanding balance (due minus paid)

The participants page also provides a prominent Excel export containing the useful
participant, contact, travel, accommodation, accessibility, and payment fields. The
export uses the four-digit `personal_code` as its human-facing ID and never includes
the internal participant UUID.

### Partecipante

Main files:

- `app/dashboard/partecipante/page.tsx`
- `app/dashboard/partecipante/partecipante-form.tsx`
- `app/dashboard/partecipante/organizers-contact-card.tsx`

The participant profile displays read-only expected (`quota_totale`) and paid (`fee_paid`)
participation fee amounts. The same two values are visible in the participant edit modal
used by capogruppo, manager, and admin. After the participant updates accommodation or
stay details, the saved expected value returned by the database trigger is shown immediately.

### Participation Fee Bank Import

Main files:

- `app/api/manager/participation-fees/import-bank-statement/route.ts`
- `lib/participation-fees/bank-statement.ts`
- `supabase/participation_fee_bank_import_migration.sql`

From the manager Participation Fees tab, an operator can upload an `.xlsx`/`.xls` bank
statement. Incoming entries are considered when the extended description contains
`global` or `budapest` (case-insensitive). The participant is matched through the
four-digit `personal_code`; `ID 16` is normalized to `0016`, and a bare code is accepted
when it uniquely matches an active participant. Imported amounts are added to `fee_paid`.

Imported bank payments are recorded in `participation_fee_bank_payments`. Duplicate
protection uses both the bank movement reference/source key and the combination of
participant, payment date, and amount. The import returns an Excel report with a full
result sheet and a `Da verificare` sheet for keyword-matching entries that could not be
associated automatically.

## Internationalization

Main files:

- `lib/i18n/provider.tsx`
- `lib/i18n/server.ts`
- `lib/i18n/locales/*.ts`

Supported locale files currently include:

- `en`
- `it`
- `es`
- `fr`
- `de`
- `uk`
- `nl-BE`

When adding UI, update both `en.ts` and `it.ts` at minimum.

## Statistics Dashboard

Main files:

- `app/dashboard/manager/page.tsx`
- `app/dashboard/manager/daily-presence-section.tsx`
- `app/dashboard/manager/registrations-tabs-section.tsx`
- `app/dashboard/manager/statistics-sections-sidebar.tsx`
- `app/global_gfhi8y/page.tsx`

Important design:

- Admin statistics page reuses manager statistics.
- Public statistics page is available at `/global_gfhi8y`.
- Public stats route reuses the same `StatisticsDashboard` component with `publicView`.
- In `publicView`, the duplicate/unassigned block is hidden.

Statistics currently implemented:

- Top counters by recoded registration type
- Operator accommodation preference summary, with clickable counts that deep-link to the manager participants table filtered for:
  - hotel preference
  - hostel-with-group preference
  - missing preference
- Registrations by country
- Registrations by group
- Registrations by Italian city
- Daily presence table with accommodation filter
- Registration trend chart
- Duplicate candidates and unassigned-group participants

Registration type recoding used in stats:

- `Higher student - liceale (14-18 years old)` -> `Higher students`
- `Undergraduate - universitario(18-25 years old)` -> `University-Worker`
- `Worker - lavoratore (18-25 years old)` -> `University-Worker`
- `Operator - Operatore` -> `Operator`
- `Driver - Autista` is excluded from registration-type stats

### Trend Chart

Data sources:

- Historical CSVs in `data/history_2023.csv`, `data/history_2024.csv`, `data/history_2025.csv`
- Current year is derived from `partecipanti.created_at`

Expected CSV structure:

- `data_registrazione`
- `cumulativo`
- `data_evento`

Event date source:

- Do not hardcode event date in statistics
- Trend chart now reads the start date from `admin_event_settings` through `lib/event/settings.ts`

Forecast method:

- Shape-based forecast using historical average curve as the growth profile
- Conservative cap added to prevent explosive overestimation

Current conservative limits:

- Forecast final cannot exceed `120%` of historical average final
- Forecast final cannot exceed current observed value plus the largest remaining gain historically observed from the same point to day 0

Other trend notes:

- The resulting forecast curve is compressed to the capped final value instead of only clipping the last point
- This keeps the curve shape coherent in the graph

### Duplicate Handling

Feature:

- The stats dashboard can surface likely duplicates
- False positives can be ignored so they stop appearing in the table

Files / data:

- API: `app/api/manager/duplicate-false-positives/route.ts`
- Migration: `supabase/duplicate_false_positives_migration.sql`
- Table: `duplicate_false_positives`

## Participants Table

Main shared component:

- `app/dashboard/_components/participants-table.tsx`

Used by:

- `app/dashboard/admin/participants/page.tsx`
- `app/dashboard/manager/participants/page.tsx`
- `app/dashboard/capogruppo/page.tsx`

API:

- `app/api/manager/participants/route.ts`
- `app/api/capogruppo/participants/route.ts`
- `app/api/admin/deleted-participants/route.ts`

Important behavior:

- Admin and manager participant pages currently use the same manager participants API
- Edit modal allows updating participant data
- The edit modal shows the read-only four-digit `personal_code` as a badge beside the participant name.
- Edit modal includes `tipo_iscrizione`; it is editable from manager/admin and capogruppo participant views.
- The participant table shows participation fees as paid/expected (for example `€ 200/235`) for manager, admin, and capogruppo views. Fully paid rows receive a light green background.
- Participant names are clickable and open the edit modal; the separate Actions column is intentionally omitted to keep the table compact.
- Delete is available from the edit modal with confirmation
- Participant deletion is a soft delete: records remain in `partecipanti` with `deleted_at` / deletion metadata and are hidden from operational dashboards, login, stats, accommodation, email campaigns, and fee screens.
- Admins can review and restore soft-deleted participants at `/dashboard/admin/deleted-participants`.

Optional columns feature:

- Table has a local `Extra columns` control
- Optional columns currently available:
  - `Registration type`
  - `City`
  - `Age`

Rules:

- Optional columns are not permanently saved; they are session/UI state only
- If an optional column is shown, its filter and sort are also enabled
- `Age` uses numeric sort and min/max filter

Existing permanent/default columns include:

- Group
- First name
- Last name
- Arrival date
- Departure date
- Accommodation
- Registration date
- Actions

Special participant table logic:

- There is a `Roma` quick toggle
- If a participant is in Italy and city is Rome, group assignment behavior differs
- Operators (`Operator - Operatore`) can store `preferenza_alloggio_operatore`, with values:
  - `Hostel with group`
  - `Hotel`
- The operator accommodation preference applies only to organization-provided accommodation. Operators with autonomous accommodation are classified as `Not applicable` in statistics, and any stored preference is cleared on update.
- This operator accommodation preference is visible/editable only for operator registrations; non-operator updates clear/ignore it.
- Host-city attendance fields (`partecipa_intero_evento`, `presenza_dettaglio`) are visible/editable in the capogruppo participant edit modal only for participants whose city (`città`) matches the configured event `host_city`.
- Capogruppo users do not see these host-city specific fields for non-host-city participants in the same group.
- In the participant self-service dashboard (`/dashboard/partecipante`), host-city attendance fields are visible/editable only when participant city (`città`) matches the configured event `host_city` from `admin_event_settings`.

## Admin Settings

Main files:

- `app/dashboard/admin/settings/layout.tsx`
- `app/dashboard/admin/settings/page.tsx`
- `app/dashboard/admin/settings/event/page.tsx`
- `app/dashboard/admin/settings/email/page.tsx`
- `app/dashboard/_components/admin-event-settings.tsx`
- `app/dashboard/_components/admin-email-settings.tsx`

Current settings sections:

- `Event informations`
- `Email`

### Event Informations

Files:

- `lib/event/settings.ts`
- `app/api/admin/settings/event/route.ts`
- `supabase/admin_event_settings_migration.sql`

Current fields:

- `event_start_date`
- `event_end_date`
- `host_city`

Default values:

- Start date: `2026-08-28`
- End date: `2026-08-30`
- Host city: `Budapest`

Important implementation note:

- `lib/event/settings.ts` gracefully falls back to defaults if `admin_event_settings` is missing from Supabase / schema cache
- This prevents the app from crashing before the migration is applied

### Email Settings

Files:

- `lib/email/settings.ts`
- `app/api/admin/settings/email/route.ts`
- `app/api/admin/settings/email/test/route.ts`
- `supabase/admin_email_settings_migration.sql`

Main tables:

- `admin_email_settings`
- `email_templates`
- `email_send_logs`
- `email_send_log_recipients`

Important note:

- Email sender settings have at times been temporarily locked in UI
- Check `EMAIL_SETTINGS_FROZEN` in `admin-email-settings.tsx`

## Email Campaigns

Main files:

- `app/dashboard/_components/manager-admin-email-page.tsx`
- `app/dashboard/_components/participant-email-campaign.tsx`
- `app/dashboard/_components/manager-admin-email-send-log-list-page.tsx`
- `app/dashboard/_components/manager-admin-email-send-log-detail-page.tsx`
- `app/dashboard/_components/email-send-log-recipient-list.tsx`
- `app/api/manager/email-campaign/route.ts`
- `app/api/manager/email-templates/route.ts`

Capabilities:

- Manage reusable email templates
- Send campaigns to filtered recipients
- View send logs and recipient logs

Template tables:

- `email_templates`
- `email_send_logs`
- `email_send_log_recipients`

## Event Finance

Main files:

- `app/dashboard/_components/event-finance-manager.tsx`
- `app/api/manager/event-finance/route.ts`

Main tables used:

- `event_finance_settings`
- `event_finance_budget_items`
- `event_finance_transactions`
- `event_finance_transaction_allocations`
- `event_finance_sponsorships`
- `event_finance_sponsorship_allocations`

Relevant migrations:

- `supabase/event_finance_migration.sql`
- `supabase/event_finance_single_plan_refactor.sql`
- `supabase/event_finance_settings_accounts_migration.sql`

## Accommodation / Alloggi

Main files:

- `app/dashboard/alloggi/page.tsx`
- `app/dashboard/_components/accommodation-inventory-manager.tsx`
- `app/dashboard/_components/accommodation-group-allocations-manager.tsx`
- `app/dashboard/_components/accommodation-hotel-overview-manager.tsx`
- `app/dashboard/_components/accommodation-hotel-roster-manager.tsx`
- `app/dashboard/_components/accommodation-room-roster-manager.tsx`
- `app/dashboard/_components/group-leader-room-assignment-manager.tsx`
- `lib/alloggi/inventory.ts`
- `lib/alloggi/group-allocations.ts`
- `lib/alloggi/hotel-overview.ts`
- `lib/alloggi/operations.ts`
- `lib/alloggi/operations-presentation.ts`
- `lib/alloggi/group-allocation-presentation.ts`

Core accommodation tables:

- `alberghi`
- `stanze`
- `stanze_gruppi`
- `partecipanti_stanze`
- `partecipanti`

Main accommodation APIs:

- `app/api/alloggi/hotels/route.ts`
- `app/api/alloggi/rooms/route.ts`
- `app/api/alloggi/rooms/import/route.ts`
- `app/api/alloggi/rooms/occupants/route.ts`
- `app/api/alloggi/group-rooms/route.ts`
- `app/api/alloggi/group-room-summary/route.ts`
- `app/api/alloggi/room-assignments/route.ts`
- `app/api/alloggi/hotel-overview/route.ts`
- `app/api/alloggi/operational-rosters/route.ts`

Recent state:

- Accommodation inventory / hardening work exists in the repo
- Review `supabase/accommodation_hardening_migration.sql` when debugging alloggi features

## Supabase / Database Notes

Important:

- Do not rely on static schema snapshots. They become stale quickly.
- Use the live self-hosted database for current schema inspection.
- Always cross-check structural changes with files in `supabase/*.sql`.

Operational note for Codex sessions:

- When needed, Codex can access Supabase directly to inspect live tables/data for database context.
- When a DB change is required, Codex can write SQL directly (migration-style or targeted statements) to implement the necessary schema/data updates.
- The current production database is self-hosted on Hetzner. The Supabase Cloud CLI `supabase link` flow is not applicable for this target; use `scripts/selfhosted-db-query.sh`, which reads `/Users/stefanolaptop/Documents/codex_new/migrazione-supabase/.env.global-friendship-event.local` and executes SQL through SSH into the Postgres container.
- For schema inspection, run read-only SQL through the same self-hosted path, for example:
  `echo "select table_name from information_schema.tables where table_schema = 'public' order by table_name;" | ssh ... docker exec -i ... psql ...`
  or create a temporary `.sql` file and run `scripts/selfhosted-db-query.sh <file>`.

High-value migrations to know:

- `supabase/tally_webhook_migration.sql`
- `supabase/tally_webhook_extended_columns.sql`
- `supabase/tally_webhook_alloggio_short_migration.sql`
- `supabase/tally_webhook_age_columns.sql`
- `supabase/login_profiles_guard_migration.sql`
- `supabase/profili_gruppi_migration.sql`
- `supabase/profili_capogruppo_host_migration.sql`
- `supabase/admin_email_settings_migration.sql`
- `supabase/admin_event_settings_migration.sql`
- `supabase/duplicate_false_positives_migration.sql`
- `supabase/email_templates_migration.sql`
- `supabase/email_send_logs_migration.sql`
- `supabase/participation_fees_migration.sql`
- `supabase/participation_fee_db_calculation_migration.sql`
- `supabase/participation_fee_nullable_host_city_migration.sql`
- `supabase/participation_fee_business_rules_migration.sql`
- `supabase/event_finance_migration.sql`
- `supabase/event_finance_single_plan_refactor.sql`
- `supabase/event_finance_settings_accounts_migration.sql`
- `supabase/accommodation_hardening_migration.sql`
- `supabase/operator_accommodation_preference_migration.sql`
- `supabase/operator_hotel_fee_surcharge_migration.sql`
- `supabase/participants_soft_delete_migration.sql`
- `supabase/participant_personal_code_migration.sql`
- `supabase/participation_fee_bank_import_migration.sql`

Main business tables encountered frequently:

- `partecipanti`
- `profili`
- `profili_gruppi`
- `gruppi`
- `admin_email_settings`
- `admin_event_settings`
- `duplicate_false_positives`
- `email_templates`
- `email_send_logs`
- `email_send_log_recipients`
- `event_finance_settings`
- `event_finance_budget_items`
- `event_finance_transactions`
- `event_finance_transaction_allocations`
- `event_finance_sponsorships`
- `event_finance_sponsorship_allocations`
- `alberghi`
- `stanze`
- `stanze_gruppi`
- `partecipanti_stanze`
- `participation_fee_bank_payments`

Participant identifiers:

- `partecipanti.id` remains the internal UUID primary key.
- `partecipanti.personal_code` is an automatically generated unique four-digit code used
  for human-facing communications.
- The participant email-campaign token `{{id}}` renders `personal_code`; it must not be
  treated as an authentication secret.

## Tally Webhook / Data Ingestion

Relevant files:

- `app/api/tally/webhook/route.ts`
- `supabase/tally_webhook_migration.sql`
- `supabase/tally_webhook_extended_columns.sql`
- `supabase/tally_webhook_age_columns.sql`
- `supabase/tally_webhook_alloggio_short_migration.sql`

Purpose:

- Ingest registration data from Tally into `partecipanti`
- Additional columns such as age-related fields and accommodation short labels were added via later migrations

Current Tally form:

- Form: `Registration form Global 2026`
- Public link / id: `https://tally.so/r/dWxYro`
- Operator accommodation preference question:
  - questionUuid: `0bce5b48-7b30-4cd6-990b-f6c21eb7dc3a`
  - title block: `1737c513-b46e-4bd2-a50c-fa81df237ec8`
  - options:
    - `Hostel with the young people from my group / Ostello insieme ai giovani del mio gruppo`
    - `Hotel`
  - hidden by default and shown only when:
    - `Type of registration` is `Operator - Operatore`
    - `Where are you staying?` is organization-provided accommodation
  - logic rule block: `387ba15d-d11c-4fce-bd78-27545b923524`

## Known Implementation Decisions / Gotchas

- `middleware.ts` still exists; Next.js 16 emits a deprecation warning suggesting `proxy` instead. This is currently a warning, not a blocking issue.
- Admin statistics page reuses manager statistics implementation.
- Public statistics page is intentionally obfuscated but not authenticated.
- Event settings are designed to fail soft with defaults if the DB table is missing.
- Manager/admin participants use the same API path.
- Host-city attendance fields (`partecipa_intero_evento`, `presenza_dettaglio`) are gated by role-specific rules:
  - capogruppo: visibility/edit allowed only for participants whose city (`partecipanti.città`) matches `admin_event_settings.host_city`
  - partecipante: visibility/edit allowed only when participant city (`partecipanti.città`) matches `admin_event_settings.host_city`
- `quota_totale` is derived automatically in PostgreSQL by `partecipanti_set_stay_and_fee`:
  - `100` for autonomous accommodation or participants whose city matches `admin_event_settings.host_city`
  - `235` for non-host/non-autonomous participants staying from `2026-08-27` through `2026-08-31`
  - `200` for every other participant
  - operators with `preferenza_alloggio_operatore = 'Hotel'` pay an additional `100`
  - changing participant accommodation, city, arrival, or departure recalculates the fee; changing `host_city` recalculates all participant fees
- When changing statistics logic, check both manager/admin dashboards and the public stats page.
- When changing participants table columns, update:
  - API payload
  - table headers
  - filters
  - sort logic
  - i18n strings
- When debugging magic link issues, check both app code and Supabase redirect URL configuration.

## Useful Files to Reopen First

For login/auth:

- `app/login/page.tsx`
- `app/auth/callback/page.tsx`
- `app/api/auth/login/preflight/route.ts`

For statistics:

- `app/dashboard/manager/page.tsx`
- `app/dashboard/manager/daily-presence-section.tsx`
- `app/dashboard/manager/registrations-tabs-section.tsx`
- `lib/event/settings.ts`

For participants:

- `app/dashboard/_components/participants-table.tsx`
- `app/api/manager/participants/route.ts`

For settings:

- `app/dashboard/admin/settings/layout.tsx`
- `app/dashboard/_components/admin-event-settings.tsx`
- `app/dashboard/_components/admin-email-settings.tsx`

For email campaigns:

- `app/dashboard/_components/manager-admin-email-page.tsx`
- `app/api/manager/email-campaign/route.ts`
- `app/api/manager/email-templates/route.ts`

For accommodation:

- `app/dashboard/alloggi/page.tsx`
- `lib/alloggi/inventory.ts`
- `lib/alloggi/group-allocations.ts`
- `app/api/alloggi/room-assignments/route.ts`

## Maintenance Guideline

When making a substantial change, update this file with:

- new routes
- new tables / migrations
- changed business rules
- new hidden/public links
- shared components that multiple dashboards depend on
