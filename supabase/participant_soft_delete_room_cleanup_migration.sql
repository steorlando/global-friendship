create or replace function public.cleanup_participant_room_on_soft_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.deleted_at is null and new.deleted_at is not null then
    delete from public.partecipanti_stanze
    where partecipante_id = new.id;

    new.stanza_id := null;
    new.albergo_id := null;
  end if;

  return new;
end;
$$;

revoke all on function public.cleanup_participant_room_on_soft_delete() from public;

drop trigger if exists partecipanti_cleanup_room_on_soft_delete
on public.partecipanti;

create trigger partecipanti_cleanup_room_on_soft_delete
before update of deleted_at on public.partecipanti
for each row
execute function public.cleanup_participant_room_on_soft_delete();

delete from public.partecipanti_stanze assignment
using public.partecipanti participant
where participant.id = assignment.partecipante_id
  and participant.deleted_at is not null;

update public.partecipanti
set stanza_id = null,
    albergo_id = null
where deleted_at is not null
  and (stanza_id is not null or albergo_id is not null);
