create table if not exists public.participation_fee_bank_payments (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.partecipanti(id) on delete restrict,
  payment_date date not null,
  amount numeric(10, 2) not null check (amount > 0),
  bank_reference text,
  source_key text not null unique,
  source_filename text not null,
  source_row integer not null check (source_row > 0),
  description text not null,
  imported_by uuid not null,
  created_at timestamptz not null default now(),
  unique (participant_id, payment_date, amount)
);

create index if not exists participation_fee_bank_payments_participant_idx
  on public.participation_fee_bank_payments(participant_id, payment_date desc);

alter table public.participation_fee_bank_payments enable row level security;

create or replace function public.manager_import_participation_fee_bank_payments(
  payments jsonb,
  actor_id uuid
)
returns table (
  source_key text,
  imported boolean,
  fee_paid numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  payment jsonb;
  inserted_id uuid;
  target_participant_id uuid;
  current_fee_paid numeric;
begin
  if actor_id is null then
    raise exception 'actor_id is required';
  end if;

  if auth.uid() is not null and auth.uid() <> actor_id then
    raise exception 'forbidden';
  end if;

  if not exists (
    select 1
    from public.profili p
    where p.id = actor_id
      and p.ruolo = 'manager'
  ) then
    raise exception 'forbidden';
  end if;

  if jsonb_typeof(coalesce(payments, '[]'::jsonb)) <> 'array' then
    raise exception 'payments must be a JSON array';
  end if;

  for payment in select value from jsonb_array_elements(coalesce(payments, '[]'::jsonb))
  loop
    target_participant_id := (payment->>'participant_id')::uuid;
    inserted_id := null;

    insert into public.participation_fee_bank_payments (
      participant_id,
      payment_date,
      amount,
      bank_reference,
      source_key,
      source_filename,
      source_row,
      description,
      imported_by
    )
    select
      target_participant_id,
      (payment->>'payment_date')::date,
      (payment->>'amount')::numeric,
      nullif(payment->>'bank_reference', ''),
      payment->>'source_key',
      payment->>'source_filename',
      (payment->>'source_row')::integer,
      payment->>'description',
      actor_id
    where exists (
      select 1
      from public.partecipanti pa
      where pa.id = target_participant_id
        and pa.deleted_at is null
    )
    on conflict do nothing
    returning id into inserted_id;

    if inserted_id is not null then
      update public.partecipanti pa
      set fee_paid = coalesce(pa.fee_paid, 0) + (payment->>'amount')::numeric
      where pa.id = target_participant_id
      returning pa.fee_paid into current_fee_paid;
    else
      select pa.fee_paid
      into current_fee_paid
      from public.partecipanti pa
      where pa.id = target_participant_id;
    end if;

    source_key := payment->>'source_key';
    imported := inserted_id is not null;
    fee_paid := current_fee_paid;
    return next;
  end loop;
end;
$$;

revoke all on function public.manager_import_participation_fee_bank_payments(jsonb, uuid) from public;
grant execute on function public.manager_import_participation_fee_bank_payments(jsonb, uuid) to authenticated;
grant execute on function public.manager_import_participation_fee_bank_payments(jsonb, uuid) to service_role;
