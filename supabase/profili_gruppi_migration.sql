create table if not exists public.profili_gruppi (
  profilo_id uuid not null,
  gruppo_id text not null,
  created_at timestamp with time zone not null default now(),
  constraint profili_gruppi_pkey primary key (profilo_id, gruppo_id),
  constraint profili_gruppi_profilo_id_fkey
    foreign key (profilo_id)
    references public.profili (id)
    on delete cascade,
  constraint profili_gruppi_gruppo_id_fkey
    foreign key (gruppo_id)
    references public.gruppi (id)
    on delete cascade
);

create index if not exists profili_gruppi_profilo_idx
  on public.profili_gruppi (profilo_id);

create index if not exists profili_gruppi_gruppo_idx
  on public.profili_gruppi (gruppo_id);
