create table if not exists public.discussion_meeting_group_assignments (
  group_id text primary key,
  higher_meeting_number smallint null,
  university_worker_meeting_number smallint null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint discussion_meeting_group_assignments_group_fkey
    foreign key (group_id)
    references public.gruppi (id)
    on delete cascade,
  constraint discussion_meeting_group_assignments_has_value_chk
    check (
      higher_meeting_number is not null
      or university_worker_meeting_number is not null
    ),
  constraint discussion_meeting_group_assignments_higher_range_chk
    check (
      higher_meeting_number is null
      or higher_meeting_number between 1 and 25
    ),
  constraint discussion_meeting_group_assignments_university_range_chk
    check (
      university_worker_meeting_number is null
      or university_worker_meeting_number between 1 and 25
    )
);

create index if not exists discussion_meeting_group_assignments_higher_idx
  on public.discussion_meeting_group_assignments (higher_meeting_number)
  where higher_meeting_number is not null;

create index if not exists discussion_meeting_group_assignments_university_idx
  on public.discussion_meeting_group_assignments (university_worker_meeting_number)
  where university_worker_meeting_number is not null;

create or replace function public.set_discussion_meeting_group_assignment_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_discussion_meeting_group_assignment_updated_at
  on public.discussion_meeting_group_assignments;
create trigger trg_discussion_meeting_group_assignment_updated_at
before update on public.discussion_meeting_group_assignments
for each row execute function public.set_discussion_meeting_group_assignment_updated_at();

alter table public.discussion_meeting_group_assignments enable row level security;

revoke all on public.discussion_meeting_group_assignments from anon, authenticated;
grant select, insert, update, delete
  on public.discussion_meeting_group_assignments
  to service_role;
