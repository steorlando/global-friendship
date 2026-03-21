create table if not exists public.admin_event_settings (
  id boolean primary key default true,
  event_start_date date not null default '2026-08-28',
  event_end_date date not null default '2026-08-30',
  host_city text not null default 'Budapest',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_event_settings_singleton check (id = true),
  constraint admin_event_settings_host_city_not_blank check (length(trim(host_city)) > 0),
  constraint admin_event_settings_date_order check (event_end_date >= event_start_date)
);

insert into public.admin_event_settings (id)
values (true)
on conflict (id) do nothing;

create or replace function public.can_manage_admin_event_settings(user_id uuid)
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
      and p.ruolo = 'admin'
  );
$$;

grant execute on function public.can_manage_admin_event_settings(uuid) to authenticated;

create or replace function public.set_admin_event_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_admin_event_settings_updated_at on public.admin_event_settings;
create trigger trg_admin_event_settings_updated_at
before update on public.admin_event_settings
for each row execute function public.set_admin_event_settings_updated_at();

alter table public.admin_event_settings enable row level security;

drop policy if exists admin_event_settings_admin_all on public.admin_event_settings;
create policy admin_event_settings_admin_all
on public.admin_event_settings
for all
to authenticated
using (public.can_manage_admin_event_settings(auth.uid()))
with check (public.can_manage_admin_event_settings(auth.uid()));
