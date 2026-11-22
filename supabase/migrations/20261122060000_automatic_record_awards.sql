alter table public.school_records add column if not exists record_scope text not null default 'SR' check (record_scope in ('SR','ISR'));
alter table public.school_records add column if not exists source_result_id uuid references public.event_results(id) on delete set null;
alter table public.school_records drop constraint if exists school_records_school_id_event_definition_id_age_group_division_key;
create unique index if not exists school_records_scope_unique on public.school_records(school_id,event_definition_id,age_group,division,record_scope);
alter table public.event_results add column if not exists record_badge text check (record_badge in ('SR','ISR'));
create table if not exists public.school_record_history (
 id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id) on delete cascade,
 event_definition_id uuid not null references public.event_definitions(id),age_group text not null,division text not null,
 record_scope text not null check (record_scope in ('SR','ISR')),holder_name text not null,performance_value bigint not null,
 achieved_on date,source_result_id uuid references public.event_results(id) on delete set null,
 superseded_at timestamptz not null default now()
);
alter table public.school_record_history enable row level security;
drop policy if exists school_record_history_read on public.school_record_history;
create policy school_record_history_read on public.school_record_history for select to authenticated using (exists(select 1 from public.competitions c where c.organiser_school_id=school_record_history.school_id and public.can_view_competition(c.id)));
grant select on public.school_record_history to authenticated;
CREATE OR REPLACE FUNCTION public.sst_publish_record_check()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
 v_event record; v_baseline record; v_best bigint; v_holder text; v_date date; v_scope text; v_better boolean;
begin
 if new.published_at is null or new.status::text <> 'valid' or new.performance_value is null or new.performance_value <= 0 then return new; end if;
 if tg_op='UPDATE' and old.published_at is not distinct from new.published_at and old.performance_value is not distinct from new.performance_value and old.status is not distinct from new.status then return new; end if;
 select ce.id event_id,ce.event_definition_id,co.organiser_school_id school_id,co.competition_type::text competition_type,
 co.starts_on,ce.age_group,ce.division,ed.measurement
 into v_event from public.event_rounds er
 join public.competition_events ce on ce.id=er.competition_event_id
 join public.competitions co on co.id=ce.competition_id
 join public.event_definitions ed on ed.id=ce.event_definition_id
 where er.id=new.round_id;
 if not found then return new; end if;
 v_scope:=case when v_event.competition_type='inter_school' then 'ISR' else 'SR' end;
 select * into v_baseline from public.school_records
 where school_id=v_event.school_id and event_definition_id=v_event.event_definition_id
 and age_group=coalesce(v_event.age_group,'') and division=coalesce(v_event.division,'') and record_scope=v_scope for update;
 if not found then return new; end if;
 select case when v_event.measurement like 'time%' then min(res.performance_value) else max(res.performance_value) end
 into v_best from public.event_results res
 join public.event_rounds rnd on rnd.id=res.round_id
 where rnd.competition_event_id=v_event.event_id and res.published_at is not null
 and res.status::text='valid' and res.performance_value>0;
 if v_best is null then return new; end if;
 v_better:=case when v_event.measurement like 'time%' then v_best<v_baseline.performance_value else v_best>v_baseline.performance_value end;
 if v_better then
  insert into public.school_record_history(school_id,event_definition_id,age_group,division,record_scope,holder_name,performance_value,achieved_on,source_result_id)
  values(v_baseline.school_id,v_baseline.event_definition_id,v_baseline.age_group,v_baseline.division,v_scope,v_baseline.holder_name,v_baseline.performance_value,v_baseline.achieved_on,v_baseline.source_result_id);
  select coalesce(en.team_name,string_agg(trim(s.given_name||' '||s.family_name),', ' order by ep.leg_order)),v_event.starts_on
  into v_holder,v_date
  from public.event_results res
  join public.event_entries en on en.id=res.entry_id
  left join public.entry_participants ep on ep.entry_id=en.id
  left join public.students s on s.id=ep.student_id
  where res.id=(select rr.id from public.event_results rr join public.event_rounds rrr on rrr.id=rr.round_id where rrr.competition_event_id=v_event.event_id and rr.published_at is not null and rr.status::text='valid' and rr.performance_value=v_best order by rr.id limit 1)
  group by en.team_name;
  update public.school_records set performance_value=v_best,holder_name=coalesce(nullif(v_holder,''),'Unknown participant'),achieved_on=v_date,source_result_id=(
   select rr.id from public.event_results rr join public.event_rounds rrr on rrr.id=rr.round_id where rrr.competition_event_id=v_event.event_id and rr.published_at is not null and rr.status::text='valid' and rr.performance_value=v_best order by rr.id limit 1
  ),updated_at=now() where id=v_baseline.id;
 end if;
 if v_better or (v_baseline.source_result_id is not null and exists(
 select 1 from public.event_results sr join public.event_rounds srnd on srnd.id=sr.round_id
 where sr.id=v_baseline.source_result_id and srnd.competition_event_id=v_event.event_id
 )) then
  update public.event_results res set record_badge=case when res.published_at is not null and res.status::text='valid' and res.performance_value=v_best then v_scope else null end
  from public.event_rounds rnd
  where res.round_id=rnd.id and rnd.competition_event_id=v_event.event_id and res.record_badge is distinct from case when res.published_at is not null and res.status::text='valid' and res.performance_value=v_best then v_scope else null end;
 end if;
 return new;
end $function$
;
revoke all on function public.sst_publish_record_check() from public,anon,authenticated;
drop trigger if exists sst_publish_record_check on public.event_results;
create trigger sst_publish_record_check after insert or update of published_at,performance_value,status on public.event_results for each row execute function public.sst_publish_record_check();
