alter table public.partecipanti
  add column if not exists preferenza_alloggio_operatore text;

alter table public.partecipanti
  drop constraint if exists partecipanti_preferenza_alloggio_operatore_check;

alter table public.partecipanti
  add constraint partecipanti_preferenza_alloggio_operatore_check
  check (
    preferenza_alloggio_operatore is null
    or preferenza_alloggio_operatore in ('Hostel with group', 'Hotel')
  );

update public.partecipanti
set preferenza_alloggio_operatore = null
where tipo_iscrizione is null
   or (
    lower(tipo_iscrizione) not like '%operator%'
    and lower(tipo_iscrizione) not like '%operatore%'
  );
