create extension if not exists pgcrypto;

create type public.event_finance_currency as enum ('EUR', 'HUF');
create type public.event_finance_transaction_type as enum ('INCOME', 'EXPENSE');
create type public.event_finance_payment_method as enum ('bank transfer', 'card', 'cash', 'other');
create type public.event_finance_sponsorship_status as enum (
  'pledged',
  'partially_paid',
  'paid',
  'cancelled'
);

create table public.event_finance_budgets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_label text null,
  is_active boolean not null default false,
  default_currency public.event_finance_currency not null default 'EUR',
  huf_to_eur_rate numeric(12, 6) not null default 0.0025,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_finance_budgets_name_not_blank check (length(trim(name)) > 0),
  constraint event_finance_budgets_huf_rate_positive check (huf_to_eur_rate > 0)
);

create table public.event_finance_budget_items (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.event_finance_budgets(id) on delete cascade,
  category_name text not null,
  macro_category text not null,
  unit_cost_original numeric(14, 2) not null,
  currency public.event_finance_currency not null default 'EUR',
  quantity numeric(14, 2) not null default 1,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_finance_budget_items_category_not_blank check (length(trim(category_name)) > 0),
  constraint event_finance_budget_items_macro_not_blank check (length(trim(macro_category)) > 0),
  constraint event_finance_budget_items_unit_cost_non_negative check (unit_cost_original >= 0),
  constraint event_finance_budget_items_quantity_positive check (quantity > 0)
);

create table public.event_finance_transactions (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.event_finance_budgets(id) on delete cascade,
  transaction_type public.event_finance_transaction_type not null,
  transaction_date date not null,
  description text not null,
  party text null,
  amount_original numeric(14, 2) not null,
  currency public.event_finance_currency not null,
  payment_method public.event_finance_payment_method not null default 'other',
  account text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint event_finance_transactions_description_not_blank check (length(trim(description)) > 0),
  constraint event_finance_transactions_amount_positive check (amount_original > 0)
);

create table public.event_finance_transaction_allocations (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.event_finance_transactions(id) on delete cascade,
  budget_item_id uuid not null references public.event_finance_budget_items(id) on delete cascade,
  amount_original numeric(14, 2) not null,
  created_at timestamptz not null default now(),
  constraint event_finance_tx_alloc_amount_positive check (amount_original > 0),
  constraint event_finance_tx_alloc_unique unique (transaction_id, budget_item_id)
);

create table public.event_finance_sponsorships (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.event_finance_budgets(id) on delete cascade,
  sponsor_name text not null,
  description text null,
  pledged_amount_original numeric(14, 2) not null,
  paid_amount_original numeric(14, 2) not null default 0,
  currency public.event_finance_currency not null default 'EUR',
  status public.event_finance_sponsorship_status not null default 'pledged',
  expected_date date null,
  received_date date null,
  payment_method public.event_finance_payment_method not null default 'other',
  account text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint event_finance_sponsorships_name_not_blank check (length(trim(sponsor_name)) > 0),
  constraint event_finance_sponsorships_pledged_non_negative check (pledged_amount_original >= 0),
  constraint event_finance_sponsorships_paid_non_negative check (paid_amount_original >= 0)
);

create table public.event_finance_sponsorship_allocations (
  id uuid primary key default gen_random_uuid(),
  sponsorship_id uuid not null references public.event_finance_sponsorships(id) on delete cascade,
  budget_item_id uuid not null references public.event_finance_budget_items(id) on delete cascade,
  amount_original numeric(14, 2) not null,
  created_at timestamptz not null default now(),
  constraint event_finance_sp_alloc_amount_positive check (amount_original > 0),
  constraint event_finance_sp_alloc_unique unique (sponsorship_id, budget_item_id)
);

create index event_finance_budget_items_budget_idx
  on public.event_finance_budget_items (budget_id);
create index event_finance_transactions_budget_type_date_idx
  on public.event_finance_transactions (budget_id, transaction_type, transaction_date desc);
create index event_finance_tx_alloc_tx_idx
  on public.event_finance_transaction_allocations (transaction_id);
create index event_finance_tx_alloc_budget_item_idx
  on public.event_finance_transaction_allocations (budget_item_id);
create index event_finance_sponsorships_budget_status_idx
  on public.event_finance_sponsorships (budget_id, status);
create index event_finance_sp_alloc_sponsorship_idx
  on public.event_finance_sponsorship_allocations (sponsorship_id);
create index event_finance_sp_alloc_budget_item_idx
  on public.event_finance_sponsorship_allocations (budget_item_id);

create or replace function public.set_event_finance_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_event_finance_budgets_updated_at
before update on public.event_finance_budgets
for each row execute function public.set_event_finance_updated_at();

create trigger trg_event_finance_budget_items_updated_at
before update on public.event_finance_budget_items
for each row execute function public.set_event_finance_updated_at();

create trigger trg_event_finance_transactions_updated_at
before update on public.event_finance_transactions
for each row execute function public.set_event_finance_updated_at();

create trigger trg_event_finance_sponsorships_updated_at
before update on public.event_finance_sponsorships
for each row execute function public.set_event_finance_updated_at();

create or replace function public.can_manage_event_finance(user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profili p
    where p.id = user_id
      and p.ruolo = 'manager'
  );
$$;

grant execute on function public.can_manage_event_finance(uuid) to authenticated;

alter table public.event_finance_budgets enable row level security;
alter table public.event_finance_budget_items enable row level security;
alter table public.event_finance_transactions enable row level security;
alter table public.event_finance_transaction_allocations enable row level security;
alter table public.event_finance_sponsorships enable row level security;
alter table public.event_finance_sponsorship_allocations enable row level security;

create policy event_finance_budgets_manager_all
on public.event_finance_budgets
for all
to authenticated
using (public.can_manage_event_finance(auth.uid()))
with check (public.can_manage_event_finance(auth.uid()));

create policy event_finance_budget_items_manager_all
on public.event_finance_budget_items
for all
to authenticated
using (public.can_manage_event_finance(auth.uid()))
with check (public.can_manage_event_finance(auth.uid()));

create policy event_finance_transactions_manager_all
on public.event_finance_transactions
for all
to authenticated
using (public.can_manage_event_finance(auth.uid()))
with check (public.can_manage_event_finance(auth.uid()));

create policy event_finance_tx_alloc_manager_all
on public.event_finance_transaction_allocations
for all
to authenticated
using (public.can_manage_event_finance(auth.uid()))
with check (public.can_manage_event_finance(auth.uid()));

create policy event_finance_sponsorships_manager_all
on public.event_finance_sponsorships
for all
to authenticated
using (public.can_manage_event_finance(auth.uid()))
with check (public.can_manage_event_finance(auth.uid()));

create policy event_finance_sp_alloc_manager_all
on public.event_finance_sponsorship_allocations
for all
to authenticated
using (public.can_manage_event_finance(auth.uid()))
with check (public.can_manage_event_finance(auth.uid()));
