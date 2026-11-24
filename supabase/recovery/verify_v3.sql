-- Run with BEGIN and ROLLBACK around this script. It inserts disposable test fixtures.
-- Exercise the live roles using transaction-local JWT settings and synthetic fixtures.
insert into auth.users(id,email) values
 ('80000000-0000-4000-8000-000000000001','sst-restore-school-admin@example.invalid'),
 ('80000000-0000-4000-8000-000000000002','sst-restore-outsider@example.invalid');
insert into public.schools(id,name,code) values
 ('80000000-0000-4000-8000-000000000010','V3 rollback test school','SST-RESTORE-TEST');
insert into public.school_memberships(school_id,user_id,role) values
 ('80000000-0000-4000-8000-000000000010','80000000-0000-4000-8000-000000000001','school_admin');
insert into public.school_houses(id,school_id,name) values
 ('80000000-0000-4000-8000-000000000020','80000000-0000-4000-8000-000000000010','Demo House');

set local role authenticated;
select set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000001',true);
do $test$
declare
 school uuid := '80000000-0000-4000-8000-000000000010';
 house uuid := '80000000-0000-4000-8000-000000000020';
 sport uuid;
 track uuid;
 field uuid;
 comp uuid;
 track_event uuid;
 field_event uuid;
 athlete uuid;
 track_entry uuid;
 field_entry uuid;
 track_round uuid;
 field_round uuid;
 heat_timestamp timestamptz;
begin
 select id into strict sport from public.sports where name='Athletics';
 select id into strict track from public.event_definitions where sport_id=sport and name='100 m';
 select id into strict field from public.event_definitions where sport_id=sport and name='Long Jump';
 comp := public.create_school_competition(school,'V3 rollback competition',sport,2026,'2026-12-01');
 insert into public.competition_age_groups(competition_id,name,min_age,max_age) values(comp,'Under 15',12,14);
 insert into public.competition_divisions(competition_id,name) values(comp,'Open');
 insert into public.students(school_id,student_number,given_name,family_name,date_of_birth)
 values(school,'V3-103','Test','Athlete','2012-06-15') returning id into athlete;
 insert into public.student_enrolments(school_id,student_id,school_year,year_level,house_id) values(school,athlete,2026,'Year 8',house);
 update public.competitions set status='registration',age_cutoff_mode='custom_date',age_cutoff_date='2026-06-01' where id=comp;
 insert into public.competition_events(competition_id,event_definition_id,age_group,division,min_age,max_age,race_lanes,race_max_heats)
 values(comp,track,'Under 15','Open',12,13,6,4) returning id into track_event;
 insert into public.competition_events(competition_id,event_definition_id,age_group,division)
 values(comp,field,'Under 15','Open') returning id into field_event;
 track_entry := public.event_entry_add(track_event,athlete);
 field_entry := public.event_entry_add(field_event,athlete);
 update public.competitions set status='active' where id=comp;
 insert into public.event_rounds(competition_event_id,name) values(track_event,'Final') returning id into track_round;
 insert into public.event_rounds(competition_event_id,name) values(field_event,'Final') returning id into field_round;
 insert into public.race_heat_allocations(competition_event_id,entry_id,heat_number,lane_number) values(track_event,track_entry,1,1);
 insert into public.race_heat_results(competition_event_id,entry_id,status,performance_value)
 values(track_event,track_entry,'valid',12900)
 on conflict (competition_event_id,entry_id) do update set status=excluded.status,performance_value=excluded.performance_value
 returning updated_at into heat_timestamp;
 insert into public.race_finalists(competition_event_id,entry_id,lane_number,qualifying_time_ms,qualification_method,heat_result_updated_at)
 values(track_event,track_entry,1,12900,'Heat position',heat_timestamp);
 update public.race_finalists set status='valid',performance_value=12500 where competition_event_id=track_event;
 if public.publish_race_final(track_event) <> 1 then raise exception 'Final publication failed'; end if;
 insert into public.school_records(school_id,event_definition_id,age_group,division,holder_name,performance_value)
 values(school,field,'Under 15','Open','Old Record',3400);
 insert into public.field_event_attempts(round_id,entry_id,attempt_number,status,distance_mm)
 values(field_round,field_entry,1,'valid',3500)
 on conflict (round_id,entry_id,attempt_number) do update set distance_mm=excluded.distance_mm;
 insert into public.event_results(round_id,entry_id,status,performance_value,placing_position)
 values(field_round,field_entry,'valid',3500,1)
 on conflict (round_id,entry_id) do update set status=excluded.status,performance_value=excluded.performance_value,placing_position=excluded.placing_position;
 update public.event_results set published_at=now(),points=999 where round_id=field_round;
 if (select total_points from public.competition_house_totals where competition_id=comp and house_id=house) is distinct from 20::numeric then raise exception 'House scoring failed'; end if;
 if (select performance_value from public.school_records where school_id=school and event_definition_id=field) is distinct from 3500::bigint then raise exception 'Record did not advance'; end if;
 if (select record_badge from public.event_results where round_id=field_round) is distinct from 'SR' then raise exception 'Record badge missing'; end if;
 if (select count(*) from public.school_record_history where school_id=school) <> 1 then raise exception 'Record history missing'; end if;
end;
$test$;
select set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000002',true);
do $test$
begin
 if exists (select 1 from public.competitions where name='V3 rollback competition')
 or exists (select 1 from public.students where student_number='V3-103')
 or exists (select 1 from public.competition_house_totals where school_id='80000000-0000-4000-8000-000000000010')
 then raise exception 'Cross-school reads are possible'; end if;
 begin
   perform public.create_school_competition('80000000-0000-4000-8000-000000000010','Unauthorised Competition',gen_random_uuid(),2026,null);
   raise exception 'Outsider was allowed to create a competition';
 exception when insufficient_privilege then null;
 end;
end;
$test$;
reset role;
set local role anon;
do $test$
begin
 if has_table_privilege(current_user,'public.students','select')
 or has_table_privilege(current_user,'public.event_results','select')
 or has_table_privilege(current_user,'public.competition_house_totals','select')
 then raise exception 'Anonymous role has access to protected tables or views'; end if;
end;
$test$;
reset role;
select 'registration, track final, field attempts, scoring, record history, tenant and anonymous isolation passed' as verification;
