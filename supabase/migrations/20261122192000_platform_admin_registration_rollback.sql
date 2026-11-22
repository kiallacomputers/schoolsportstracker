-- Platform Admin emergency correction for an accidentally activated competition.
create or replace function public.return_competition_to_registration(p_competition_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_status text;
begin
 if auth.uid() is null or not public.is_platform_admin() then
  raise exception 'Only a Platform Admin can return a competition to registrations';
 end if;
 select status::text into v_status from public.competitions where id=p_competition_id for update;
 if not found then raise exception 'Competition not found'; end if;
 if v_status <> 'active' then raise exception 'Only active competitions can return to registration'; end if;
 if exists(select 1 from public.event_results er join public.event_rounds rd on rd.id=er.round_id join public.competition_events ce on ce.id=rd.competition_event_id where ce.competition_id=p_competition_id) then
  raise exception 'Competition has results. Returning to registration is blocked to preserve competition history';
 end if;
 update public.competitions set status='registration' where id=p_competition_id;
end $$;
revoke all on function public.return_competition_to_registration(uuid) from public,anon;
grant execute on function public.return_competition_to_registration(uuid) to authenticated;
create or replace function public.guard_competition_registration_rollback()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
 if old.status::text='active' and new.status::text='registration' then
  if not public.is_platform_admin() then raise exception 'Only a Platform Admin can reopen registration'; end if;
  if exists(select 1 from public.event_results er join public.event_rounds rd on rd.id=er.round_id join public.competition_events ce on ce.id=rd.competition_event_id where ce.competition_id=new.id) then
   raise exception 'Competition has results. Returning to registration is blocked';
  end if;
 end if;
 return new;
end $$;
drop trigger if exists guard_competition_registration_rollback on public.competitions;
create trigger guard_competition_registration_rollback before update of status on public.competitions for each row execute function public.guard_competition_registration_rollback();