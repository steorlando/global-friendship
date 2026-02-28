-- Refactor Event Finance to single budget plan model.
-- Run AFTER event_finance_migration.sql.

begin;

create table if not exists public.event_finance_settings (
  id boolean primary key default true,
  event_name text not null default 'Global Friendship',
  default_currency public.event_finance_currency not null default 'EUR',
  huf_to_eur_rate numeric(12, 6) not null default 0.0025,
  accounts text[] not null default '{}'::text[],
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_finance_settings_singleton check (id = true),
  constraint event_finance_settings_name_not_blank check (length(trim(event_name)) > 0),
  constraint event_finance_settings_rate_positive check (huf_to_eur_rate > 0)
);

insert into public.event_finance_settings (id, event_name, default_currency, huf_to_eur_rate, notes)
select
  true,
  coalesce(nullif(trim(b.name), ''), 'Global Friendship'),
  b.default_currency,
  b.huf_to_eur_rate,
  b.notes
from public.event_finance_budgets b
order by b.is_active desc, b.created_at asc
limit 1
on conflict (id) do nothing;

insert into public.event_finance_settings (id)
values (true)
on conflict (id) do nothing;

-- Drop indexes that depend on budget_id.
drop index if exists public.event_finance_budget_items_budget_idx;
drop index if exists public.event_finance_transactions_budget_type_date_idx;
drop index if exists public.event_finance_sponsorships_budget_status_idx;

-- Remove budget_id links (single plan model).
alter table public.event_finance_budget_items
  drop column if exists budget_id cascade;

alter table public.event_finance_transactions
  drop column if exists budget_id cascade;

alter table public.event_finance_sponsorships
  drop column if exists budget_id cascade;

-- New useful indexes.
create index if not exists event_finance_transactions_type_date_idx
  on public.event_finance_transactions (transaction_type, transaction_date desc);

create index if not exists event_finance_sponsorships_status_idx
  on public.event_finance_sponsorships (status);

create index if not exists event_finance_budget_items_macro_category_idx
  on public.event_finance_budget_items (macro_category);

-- Trigger for settings updated_at.
drop trigger if exists trg_event_finance_settings_updated_at on public.event_finance_settings;
create trigger trg_event_finance_settings_updated_at
before update on public.event_finance_settings
for each row execute function public.set_event_finance_updated_at();

-- RLS for settings.
alter table public.event_finance_settings enable row level security;

drop policy if exists event_finance_settings_manager_all on public.event_finance_settings;
create policy event_finance_settings_manager_all
on public.event_finance_settings
for all
to authenticated
using (public.can_manage_event_finance(auth.uid()))
with check (public.can_manage_event_finance(auth.uid()));

-- Drop obsolete budgets table/policy/trigger.
drop policy if exists event_finance_budgets_manager_all on public.event_finance_budgets;
drop trigger if exists trg_event_finance_budgets_updated_at on public.event_finance_budgets;
drop table if exists public.event_finance_budgets cascade;

commit;
