alter table public.partecipanti
  add column if not exists email_secondaria text,
  add column if not exists gruppo_leader text,
  add column if not exists partecipa_intero_evento boolean,
  add column if not exists presenza_dettaglio jsonb,
  add column if not exists esigenze_alimentari text,
  add column if not exists disabilita_accessibilita boolean,
  add column if not exists difficolta_accessibilita text;
