create extension if not exists pgcrypto;

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null default '',
  html text not null,
  created_by uuid not null references auth.users (id) on delete cascade,
  updated_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint email_templates_name_not_blank check (length(trim(name)) > 0),
  constraint email_templates_html_not_blank check (length(trim(html)) > 0)
);

create index if not exists email_templates_updated_at_idx
  on public.email_templates (updated_at desc);

create index if not exists email_templates_name_idx
  on public.email_templates (lower(name));

create or replace function public.set_email_templates_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_email_templates_updated_at on public.email_templates;
create trigger trg_email_templates_updated_at
before update on public.email_templates
for each row
execute function public.set_email_templates_updated_at();

create or replace function public.can_manage_email_templates(user_id uuid)
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
      and p.ruolo in ('manager', 'admin')
  );
$$;

grant execute on function public.can_manage_email_templates(uuid) to authenticated;

alter table public.email_templates enable row level security;

drop policy if exists email_templates_select on public.email_templates;
create policy email_templates_select
on public.email_templates
for select
to authenticated
using (public.can_manage_email_templates(auth.uid()));

drop policy if exists email_templates_insert on public.email_templates;
create policy email_templates_insert
on public.email_templates
for insert
to authenticated
with check (
  public.can_manage_email_templates(auth.uid())
  and created_by = auth.uid()
  and updated_by = auth.uid()
);

drop policy if exists email_templates_update on public.email_templates;
create policy email_templates_update
on public.email_templates
for update
to authenticated
using (public.can_manage_email_templates(auth.uid()))
with check (
  public.can_manage_email_templates(auth.uid())
  and updated_by = auth.uid()
);

drop policy if exists email_templates_delete on public.email_templates;
create policy email_templates_delete
on public.email_templates
for delete
to authenticated
using (public.can_manage_email_templates(auth.uid()));
