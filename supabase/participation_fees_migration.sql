alter table public.partecipanti
  add column if not exists fee_paid numeric(10, 2);

create or replace function public.manager_mark_participants_fully_paid(
  participant_ids uuid[],
  actor_id uuid
)
returns table (
  id uuid,
  fee_paid numeric
)
language plpgsql
security definer
set search_path = public
as $$
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

  return query
  update public.partecipanti pa
  set fee_paid = pa.quota_totale
  where pa.id = any(coalesce(participant_ids, array[]::uuid[]))
  returning pa.id, pa.fee_paid;
end;
$$;

grant execute on function public.manager_mark_participants_fully_paid(uuid[], uuid) to authenticated;
grant execute on function public.manager_mark_participants_fully_paid(uuid[], uuid) to service_role;
