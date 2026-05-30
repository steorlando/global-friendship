alter table public.partecipanti
  add column if not exists deleted_at timestamptz null,
  add column if not exists deleted_by uuid null references auth.users (id) on delete set null,
  add column if not exists deleted_by_email text null,
  add column if not exists deleted_by_role text null,
  add column if not exists restored_at timestamptz null,
  add column if not exists restored_by uuid null references auth.users (id) on delete set null;

create index if not exists partecipanti_deleted_at_idx
  on public.partecipanti (deleted_at);

create index if not exists partecipanti_active_cognome_nome_idx
  on public.partecipanti (cognome, nome)
  where deleted_at is null;
