create table if not exists public.duplicate_false_positives (
  participant_a_id uuid not null,
  participant_b_id uuid not null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  constraint duplicate_false_positives_pk primary key (participant_a_id, participant_b_id),
  constraint duplicate_false_positives_order_chk check (participant_a_id < participant_b_id)
);

create index if not exists duplicate_false_positives_created_at_idx
  on public.duplicate_false_positives (created_at desc);
