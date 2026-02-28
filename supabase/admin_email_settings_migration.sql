create table if not exists public.admin_email_settings (
  id boolean primary key default true,
  sender_email text not null default 'europeanyouthmeeting@gmail.com',
  gmail_app_password text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_email_settings_singleton check (id = true),
  constraint admin_email_settings_sender_email_not_blank check (length(trim(sender_email)) > 0)
);

insert into public.admin_email_settings (id)
values (true)
on conflict (id) do nothing;

create or replace function public.can_manage_admin_email_settings(user_id uuid)
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

grant execute on function public.can_manage_admin_email_settings(uuid) to authenticated;

create or replace function public.set_admin_email_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_admin_email_settings_updated_at on public.admin_email_settings;
create trigger trg_admin_email_settings_updated_at
before update on public.admin_email_settings
for each row execute function public.set_admin_email_settings_updated_at();

alter table public.admin_email_settings enable row level security;

drop policy if exists admin_email_settings_admin_all on public.admin_email_settings;
create policy admin_email_settings_admin_all
on public.admin_email_settings
for all
to authenticated
using (public.can_manage_admin_email_settings(auth.uid()))
with check (public.can_manage_admin_email_settings(auth.uid()));
