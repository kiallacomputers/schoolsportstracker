-- Stage 3.5B automatic competition scoring and house totals.
-- Published valid placings earn configured points; team results use multiplier.
create or replace function public.sst_assign_result_points()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare scheme jsonb; team_event boolean; event_id uuid; entry_event_id uuid;
        placing_points jsonb; multiplier numeric; value numeric;
begin
  select r.competition_event_id into event_id from public.event_rounds r where r.id = new.round_id;
  select e.competition_event_id into entry_event_id from public.event_entries e where e.id = new.entry_id;
  if event_id is null or entry_event_id is null or event_id <> entry_event_id then
    raise exception 'Result entry and round must belong to the same competition event';
  end if;
  select c.scoring_scheme, ce.is_team into scheme, team_event
    from public.competition_events ce join public.competitions c on c.id = ce.competition_id
    where ce.id = event_id;
  new.points := 0;
  if new.published_at is not null and new.status::text = 'valid' and new.placing_position is not null then
    placing_points := scheme -> 'placing_points';
    if jsonb_typeof(placing_points) = 'array'
       and new.placing_position between 1 and jsonb_array_length(placing_points) then
      value := (placing_points ->> (new.placing_position - 1))::numeric;
      multiplier := case when coalesce(team_event,false)
        then coalesce((scheme ->> 'team_multiplier')::numeric,1) else 1 end;
      new.points := round(value * multiplier,2);
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists sst_assign_result_points_trigger on public.event_results;
create trigger sst_assign_result_points_trigger
before insert or update of round_id,entry_id,status,placing_position,published_at
on public.event_results for each row execute function public.sst_assign_result_points();

create or replace view public.competition_house_totals
with (security_invoker = true) as
select ce.competition_id, ee.school_id, ee.house_id,
       count(er.id) filter (where er.published_at is not null and er.status::text = 'valid')::bigint as scored_results,
       coalesce(sum(er.points) filter (where er.published_at is not null and er.status::text = 'valid'),0)::numeric as total_points
from public.event_results er
join public.event_entries ee on ee.id = er.entry_id
join public.event_rounds rounds on rounds.id = er.round_id
join public.competition_events ce on ce.id = rounds.competition_event_id and ce.id = ee.competition_event_id
where ee.house_id is not null
group by ce.competition_id,ee.school_id,ee.house_id;
