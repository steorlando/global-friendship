create extension if not exists pgcrypto;

create table if not exists public.email_send_logs (
  id uuid primary key default gen_random_uuid(),
  sent_at timestamptz not null default now(),
  recipient_type text not null,
  subject text not null,
  body_content text not null,
  sender_user_id uuid null references auth.users (id) on delete set null,
  recipient_count integer not null,
  recipient_ids_snapshot jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint email_send_logs_recipient_type_check
    check (recipient_type in ('participants', 'group_leaders')),
  constraint email_send_logs_subject_not_blank
    check (length(trim(subject)) > 0),
  constraint email_send_logs_body_not_blank
    check (length(trim(body_content)) > 0),
  constraint email_send_logs_recipient_count_non_negative
    check (recipient_count >= 0),
  constraint email_send_logs_recipient_snapshot_is_array
    check (jsonb_typeof(recipient_ids_snapshot) = 'array')
);

create table if not exists public.email_send_log_recipients (
  id uuid primary key default gen_random_uuid(),
  send_log_id uuid not null references public.email_send_logs (id) on delete cascade,
  recipient_type text not null,
  recipient_id uuid not null,
  created_at timestamptz not null default now(),
  constraint email_send_log_recipients_type_check
    check (recipient_type in ('participants', 'group_leaders')),
  constraint email_send_log_recipients_unique
    unique (send_log_id, recipient_type, recipient_id)
);

create index if not exists email_send_logs_sent_at_idx
  on public.email_send_logs (sent_at desc);

create index if not exists email_send_logs_sender_user_idx
  on public.email_send_logs (sender_user_id);

create index if not exists email_send_log_recipients_send_log_idx
  on public.email_send_log_recipients (send_log_id);

create index if not exists email_send_log_recipients_type_id_idx
  on public.email_send_log_recipients (recipient_type, recipient_id);

create or replace function public.can_manage_email_send_logs(user_id uuid)
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

grant execute on function public.can_manage_email_send_logs(uuid) to authenticated;

alter table public.email_send_logs enable row level security;
alter table public.email_send_log_recipients enable row level security;

drop policy if exists email_send_logs_select on public.email_send_logs;
create policy email_send_logs_select
on public.email_send_logs
for select
to authenticated
using (public.can_manage_email_send_logs(auth.uid()));

drop policy if exists email_send_logs_insert on public.email_send_logs;
create policy email_send_logs_insert
on public.email_send_logs
for insert
to authenticated
with check (public.can_manage_email_send_logs(auth.uid()));

drop policy if exists email_send_log_recipients_select on public.email_send_log_recipients;
create policy email_send_log_recipients_select
on public.email_send_log_recipients
for select
to authenticated
using (public.can_manage_email_send_logs(auth.uid()));

drop policy if exists email_send_log_recipients_insert on public.email_send_log_recipients;
create policy email_send_log_recipients_insert
on public.email_send_log_recipients
for insert
to authenticated
with check (public.can_manage_email_send_logs(auth.uid()));
