alter table public.schools
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists allow_student_self_registration boolean not null default false;

alter table public.competitions
  add column if not exists age_cutoff_mode text not null default 'calendar_year' check (age_cutoff_mode in ('calendar_year','custom_date','custom','competition_date')),
  add column if not exists age_cutoff_date date,
  add column if not exists heat_entry_mode text not null default 'sequential',
  add column if not exists registration_opens_at timestamptz,
  add column if not exists registration_closes_at timestamptz,
  add column if not exists max_events_per_student integer check (max_events_per_student > 0);
alter table public.competitions alter column scoring_scheme set default
  '{"placing_points":[10,8,6,5,4,3,2,1],"team_multiplier":1,"allow_ties":true}'::jsonb;
update public.competitions set scoring_scheme = default where scoring_scheme = '{}'::jsonb;
alter table public.event_definitions add column if not exists measurement text;
alter table public.schools alter column code drop not null;

create table public.competition_schools (
  competition_id uuid not null references public.competitions(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  primary key (competition_id, school_id)
);
create table public.event_entries (
  id uuid primary key default gen_random_uuid(),
  competition_event_id uuid not null references public.competition_events(id) on delete cascade,
  school_id uuid not null references public.schools(id),
  house_id uuid,
  team_name text,
  unique (competition_event_id,id),
  foreign key (school_id,house_id) references public.school_houses(school_id,id)
);
create table public.entry_participants (
  entry_id uuid not null references public.event_entries(id) on delete cascade,
  student_id uuid not null references public.students(id),
  leg_order integer not null default 1 check (leg_order > 0),
  primary key (entry_id,student_id),
  unique (entry_id,leg_order)
);
create index entry_participants_student_idx on public.entry_participants(student_id);
create table public.event_rounds (
  id uuid primary key default gen_random_uuid(),
  competition_event_id uuid not null references public.competition_events(id) on delete cascade,
  name text not null,
  round_order integer not null default 1 check (round_order > 0)
);
create index event_rounds_event_idx on public.event_rounds(competition_event_id,round_order);
create table public.event_results (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.event_rounds(id) on delete cascade,
  entry_id uuid not null references public.event_entries(id),
  status public.result_status not null,
  performance_value bigint check (performance_value >= 0),
  placing_position integer check (placing_position > 0),
  points numeric not null default 0,
  published_at timestamptz,
  entered_by uuid default auth.uid() references auth.users(id) on delete set null,
  unique (round_id,entry_id)
);
create index event_results_entry_idx on public.event_results(entry_id);
create table public.field_event_attempts (
  round_id uuid not null references public.event_rounds(id) on delete cascade,
  entry_id uuid not null references public.event_entries(id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0),
  status text not null,
  distance_mm bigint check (distance_mm >= 0),
  primary key (round_id,entry_id,attempt_number)
);
create table public.race_rounds (
  id uuid primary key default gen_random_uuid(),
  competition_event_id uuid not null references public.competition_events(id) on delete cascade,
  round_type text not null check (round_type in ('heat','final')),
  round_number integer not null check (round_number > 0),
  status text not null default 'pending',
  unique (competition_event_id,round_type,round_number)
);
create table public.race_lanes (
  round_id uuid not null references public.race_rounds(id) on delete cascade,
  entry_id uuid not null references public.event_entries(id),
  lane_number integer not null check (lane_number > 0),
  time_ms integer,
  result_status text,
  primary key (round_id,entry_id),
  unique (round_id,lane_number)
);
create table public.race_heat_allocations (
  competition_event_id uuid not null,
  entry_id uuid not null,
  heat_number integer not null check (heat_number > 0),
  lane_number integer not null check (lane_number > 0),
  primary key (competition_event_id,entry_id),
  unique (competition_event_id,heat_number,lane_number),
  foreign key (competition_event_id,entry_id) references public.event_entries(competition_event_id,id) on delete cascade
);
create table public.race_heat_results (
  competition_event_id uuid not null,
  entry_id uuid not null,
  status text not null check (status in ('valid','dns','dnf','dq')),
  performance_value bigint,
  updated_at timestamptz not null default now(),
  primary key (competition_event_id,entry_id),
  foreign key (competition_event_id,entry_id) references public.race_heat_allocations(competition_event_id,entry_id) on delete cascade,
  check ((status = 'valid' and performance_value is not null and performance_value > 0)
      or (status <> 'valid' and performance_value is null))
);
create function public.sst_touch_heat_result() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
create trigger sst_touch_heat_result before insert or update on public.race_heat_results
  for each row execute function public.sst_touch_heat_result();

create trigger prevent_duplicate_individual_event_entry before insert or update of student_id,entry_id
  on public.entry_participants for each row execute function public.prevent_duplicate_individual_event_entry();
create trigger reject_inactive_student_event_entry before insert or update of student_id,entry_id
  on public.entry_participants for each row execute function public.reject_inactive_student_event_entry();
-- The rebuild used 'staff'. V3 invitation RPCs write 'teacher'.
alter table public.school_memberships drop constraint school_memberships_role_check;
alter table public.school_memberships add constraint school_memberships_role_check
  check (role in ('school_admin','staff','teacher'));
alter table public.schools add column if not exists logo_path text;
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text
);
insert into public.profiles(id,display_name)
select id, coalesce(raw_user_meta_data->>'full_name',split_part(email,'@',1)) from auth.users;

create table public.school_email_domains (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  domain text not null unique check (domain = lower(domain)),
  is_primary boolean not null default false,
  is_verified boolean not null default false,
  allow_student_registration boolean not null default false
);
create unique index school_email_domains_primary_idx on public.school_email_domains(school_id) where is_primary;
create table public.school_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references auth.users(id) on delete set null,
  school_name text not null,
  school_domain text not null,
  school_code text,
  contact_name text not null,
  contact_first_name text,
  contact_last_name text,
  contact_email text not null,
  contact_position text,
  contact_phone text,
  school_website text,
  notes text,
  request_ip_hash text,
  logo_path text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_school_id uuid references public.schools(id) on delete set null
);
create table public.school_staff_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  given_name text,
  family_name text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz
);
create table public.school_staff_invitations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table public.school_admin_invitations (
  like public.school_staff_invitations including defaults including indexes,
  request_id uuid references public.school_requests(id) on delete set null,
  foreign key (school_id) references public.schools(id) on delete cascade,
  foreign key (created_by) references auth.users(id)
);
create table public.school_admin_promotion_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz
);
create unique index school_admin_promotion_pending_idx
  on public.school_admin_promotion_requests(school_id,user_id) where status='pending';
create table public.student_account_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid,
  email text not null,
  given_name text not null,
  family_name text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  foreign key (school_id,student_id) references public.students(school_id,id) on delete cascade
);
create unique index student_account_approved_idx on public.student_account_requests(student_id) where status='approved';
create table public.student_email_challenges (
  user_id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  sent_at timestamptz not null default now(),
  attempts integer not null default 0,
  verified_at timestamptz
);
create table public.student_registration_codes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  competition_id uuid not null references public.competitions(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  attempts integer not null default 0,
  consumed_at timestamptz
);
create table public.student_registration_sessions (
  student_id uuid not null references public.students(id) on delete cascade,
  competition_id uuid not null references public.competitions(id) on delete cascade,
  token_hash text primary key,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create table public.school_captcha_attempts (
  nonce text primary key,
  ip_hash text not null,
  valid boolean not null,
  created_at timestamptz not null default now()
);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_table text not null,
  entity_id uuid,
  detail jsonb,
  created_at timestamptz not null default now()
);
create table public.student_sporting_division_audit (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  old_division text,
  new_division text,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);
create trigger audit_student_sporting_division_change after update of sporting_division on public.students
  for each row execute function public.audit_student_sporting_division_change();
create trigger restrict_student_deletion_to_platform_admin before delete on public.students
  for each row execute function public.restrict_student_deletion_to_platform_admin();
alter table public.schools add column if not exists deactivated_by uuid references auth.users(id) on delete set null;
create table public.management_issues
  (like sst_archive.management_issues_legacy_20261121 including constraints including indexes);
alter table public.management_issues alter column id set default gen_random_uuid();
alter table public.management_issues alter column reference_number add generated by default as identity;
alter table public.management_issues alter column created_at set default now();
alter table public.management_issues alter column updated_at set default now();
insert into public.management_issues select * from sst_archive.management_issues_legacy_20261121;
select setval(pg_get_serial_sequence('public.management_issues','reference_number'),
  coalesce(max(reference_number),1), count(*) > 0) from public.management_issues;
create table public.management_issue_comments
  (like sst_archive.management_issue_comments_legacy_20261121 including constraints including indexes,
   foreign key (issue_id) references public.management_issues(id) on delete cascade);
alter table public.management_issue_comments alter column id set default gen_random_uuid();
alter table public.management_issue_comments alter column created_at set default now();
insert into public.management_issue_comments select * from sst_archive.management_issue_comments_legacy_20261121;
create trigger management_issue_guard_creator before update on public.management_issues
  for each row execute function public.management_issue_guard_creator();
create trigger management_issue_set_updated_at before update on public.management_issues
  for each row execute function public.management_issue_set_updated_at();
create table if not exists public.race_finalists (
 competition_event_id uuid not null references public.competition_events(id) on delete cascade,
 entry_id uuid not null references public.event_entries(id) on delete cascade,
 lane_number integer not null check(lane_number between 1 and 12),
 qualifying_time_ms bigint not null check(qualifying_time_ms>0),
 qualification_method text not null check(qualification_method in ('Heat position','Fastest remaining')),
 heat_result_updated_at timestamptz not null,
 status text check(status in ('valid','dns','dnf','dq')),
 performance_value bigint check(performance_value>0),
 primary key(competition_event_id,entry_id),
 unique(competition_event_id,lane_number),
 check((status='valid' and performance_value is not null) or (status is distinct from 'valid' and performance_value is null))
);
create index if not exists race_finalists_event_idx on public.race_finalists(competition_event_id);
alter table public.race_finalists enable row level security;
create policy race_finalists_read on public.race_finalists for select to authenticated using(exists(select 1 from public.competition_events e where e.id=competition_event_id and public.can_view_competition(e.competition_id)));
create policy race_finalists_insert on public.race_finalists for insert to authenticated with check(exists(select 1 from public.competition_events e where e.id=competition_event_id and public.can_manage_competition(e.competition_id)) and exists(select 1 from public.event_entries en where en.id=entry_id and en.competition_event_id=race_finalists.competition_event_id));
create policy race_finalists_update on public.race_finalists for update to authenticated using(exists(select 1 from public.competition_events e where e.id=competition_event_id and public.can_manage_competition(e.competition_id))) with check(exists(select 1 from public.competition_events e where e.id=competition_event_id and public.can_manage_competition(e.competition_id)));
grant select,insert,update on public.race_finalists to authenticated;
alter table public.race_finalists add column published_at timestamptz;
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
-- School records baseline, manually verified by authorised school staff.
create table if not exists public.school_records (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id) on delete cascade,
 event_definition_id uuid not null references public.event_definitions(id),
 age_group text not null default '',
 division text not null default '',
 performance_value bigint not null check (performance_value > 0),
 holder_name text not null,
 achieved_on date,
 notes text not null default '',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(school_id,event_definition_id,age_group,division)
);
create index if not exists school_records_school_idx on public.school_records(school_id);
alter table public.school_records enable row level security;
drop policy if exists school_records_read on public.school_records;
create policy school_records_read on public.school_records for select to authenticated using (exists(select 1 from public.competitions c where c.organiser_school_id=school_records.school_id and public.can_view_competition(c.id)));
drop policy if exists school_records_insert on public.school_records;
create policy school_records_insert on public.school_records for insert to authenticated with check (exists(select 1 from public.competitions c where c.organiser_school_id=school_records.school_id and public.can_manage_competition(c.id)));
drop policy if exists school_records_update on public.school_records;
create policy school_records_update on public.school_records for update to authenticated using (exists(select 1 from public.competitions c where c.organiser_school_id=school_records.school_id and public.can_manage_competition(c.id))) with check (exists(select 1 from public.competitions c where c.organiser_school_id=school_records.school_id and public.can_manage_competition(c.id)));
drop policy if exists school_records_delete on public.school_records;
create policy school_records_delete on public.school_records for delete to authenticated using (exists(select 1 from public.competitions c where c.organiser_school_id=school_records.school_id and public.can_manage_competition(c.id)));
grant select,insert,update,delete on public.school_records to authenticated;
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
create table if not exists public.platform_admin_invitations(
 id uuid primary key default gen_random_uuid(),
 email text not null,
 token_hash text not null unique,
 expires_at timestamptz not null,
 accepted_at timestamptz,
 revoked_at timestamptz,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
alter table public.platform_admin_invitations enable row level security;
drop policy if exists platform_admin_invites_read on public.platform_admin_invitations;
create policy platform_admin_invites_read on public.platform_admin_invitations for select to authenticated using (public.is_platform_admin());
grant select on public.platform_admin_invitations to authenticated;
create or replace function public.issue_platform_admin_invitation(p_email text) returns text
language plpgsql security definer set search_path='' as $$
declare v_email text:=lower(trim(p_email));v_token text;
begin
 if not public.is_platform_admin() then raise exception 'Platform Administrator required'; end if;
 if length(v_email)>254 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Invalid email'; end if;
 if exists(select 1 from public.platform_admins pa join auth.users u on u.id=pa.user_id where lower(u.email)=v_email) then raise exception 'This user is already a Platform Administrator'; end if;
 update public.platform_admin_invitations set revoked_at=now() where email=v_email and accepted_at is null and revoked_at is null;
 v_token:=encode(extensions.gen_random_bytes(32),'hex');
 insert into public.platform_admin_invitations(email,token_hash,expires_at,created_by)
 values(v_email,encode(extensions.digest(v_token,'sha256'),'hex'),now()+interval '7 days',auth.uid());
 return v_token;
end $$;
create or replace function public.accept_platform_admin_invitation(p_token text) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_inv public.platform_admin_invitations%rowtype;v_email text;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select lower(email) into v_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if v_email is null then raise exception 'Confirm your email before accepting the invitation'; end if;
 select * into v_inv from public.platform_admin_invitations where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
 if not found or v_inv.revoked_at is not null or v_inv.accepted_at is not null or v_inv.expires_at<=now() then raise exception 'Invitation is invalid or expired'; end if;
 if v_inv.email<>v_email then raise exception 'Sign in using the invited email address'; end if;
 insert into public.platform_admins(user_id) values(auth.uid()) on conflict do nothing;
 update public.platform_admin_invitations set accepted_at=now() where id=v_inv.id;
 return true;
end $$;
revoke all on function public.issue_platform_admin_invitation(text),public.accept_platform_admin_invitation(text) from public,anon;
grant execute on function public.issue_platform_admin_invitation(text),public.accept_platform_admin_invitation(text) to authenticated;CREATE OR REPLACE FUNCTION public.private_invitation_email(p_kind text, p_token text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_email text;
BEGIN
 IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF p_token !~ '^[a-f0-9]{64}$' THEN RETURN NULL; END IF;
 IF p_kind = 'school_admin' THEN
   SELECT i.email INTO v_email FROM public.school_admin_invitations i
   WHERE i.token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
     AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>now();
 ELSIF p_kind = 'platform_admin' THEN
   SELECT i.email INTO v_email FROM public.platform_admin_invitations i
   WHERE i.token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
     AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>now();
 ELSIF p_kind = 'staff' THEN
   SELECT i.email INTO v_email FROM public.school_staff_invitations i
   WHERE i.token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
     AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>now();
 END IF;
 RETURN lower(v_email);
END $function$
;alter table public.competition_schools enable row level security;
revoke all on public.competition_schools from public, anon, authenticated;
grant select on public.competition_schools to authenticated;
create policy v3_competition_schools_select on public.competition_schools for select to authenticated using (public.can_view_competition(competition_id));
drop policy competition_read on public.competitions;
create policy v3_competitions_select on public.competitions for select to authenticated using (public.can_view_competition(id));
grant update(name,sport_id,school_year,starts_on,status,heat_entry_mode,age_cutoff_mode,age_cutoff_date,scoring_scheme) on public.competitions to authenticated;
create policy v3_competitions_update on public.competitions for update to authenticated using (public.can_manage_competition(id)) with check (public.can_manage_competition(id));
drop policy competition_event_read on public.competition_events;
create policy v3_competition_events_select on public.competition_events for select to authenticated using (public.can_view_competition(competition_id));
grant insert,update,delete on public.competition_events to authenticated;
create policy v3_competition_events_insert on public.competition_events for insert to authenticated with check (public.can_manage_competition(competition_id));
create policy v3_competition_events_update on public.competition_events for update to authenticated using (public.can_manage_competition(competition_id)) with check (public.can_manage_competition(competition_id));
create policy v3_competition_events_delete on public.competition_events for delete to authenticated using (public.can_manage_competition(competition_id));
grant insert on public.event_definitions to authenticated;
create policy v3_event_definitions_insert on public.event_definitions for insert to authenticated with check (public.is_platform_admin());
alter table public.event_entries enable row level security;
revoke all on public.event_entries from public, anon, authenticated;
grant select,insert,update,delete on public.event_entries to authenticated;
create policy v3_event_entries_select on public.event_entries for select to authenticated using (exists (select 1 from public.competition_events e where e.id=event_entries.competition_event_id and public.can_view_competition(e.competition_id)));
create policy v3_event_entries_insert on public.event_entries for insert to authenticated with check (exists (select 1 from public.competition_events e where e.id=event_entries.competition_event_id and public.can_manage_competition(e.competition_id)) and exists (
  select 1 from public.competition_events e join public.competitions c on c.id=e.competition_id
  where e.id=event_entries.competition_event_id and
    (c.organiser_school_id=event_entries.school_id or exists (
      select 1 from public.competition_schools cs where cs.competition_id=c.id and cs.school_id=event_entries.school_id))
));
create policy v3_event_entries_update on public.event_entries for update to authenticated using (exists (select 1 from public.competition_events e where e.id=event_entries.competition_event_id and public.can_manage_competition(e.competition_id)) and exists (
  select 1 from public.competition_events e join public.competitions c on c.id=e.competition_id
  where e.id=event_entries.competition_event_id and
    (c.organiser_school_id=event_entries.school_id or exists (
      select 1 from public.competition_schools cs where cs.competition_id=c.id and cs.school_id=event_entries.school_id))
)) with check (exists (select 1 from public.competition_events e where e.id=event_entries.competition_event_id and public.can_manage_competition(e.competition_id)) and exists (
  select 1 from public.competition_events e join public.competitions c on c.id=e.competition_id
  where e.id=event_entries.competition_event_id and
    (c.organiser_school_id=event_entries.school_id or exists (
      select 1 from public.competition_schools cs where cs.competition_id=c.id and cs.school_id=event_entries.school_id))
));
create policy v3_event_entries_delete on public.event_entries for delete to authenticated using (exists (select 1 from public.competition_events e where e.id=event_entries.competition_event_id and public.can_manage_competition(e.competition_id)) and exists (
  select 1 from public.competition_events e join public.competitions c on c.id=e.competition_id
  where e.id=event_entries.competition_event_id and
    (c.organiser_school_id=event_entries.school_id or exists (
      select 1 from public.competition_schools cs where cs.competition_id=c.id and cs.school_id=event_entries.school_id))
));
alter table public.event_rounds enable row level security;
revoke all on public.event_rounds from public, anon, authenticated;
grant select,insert,update,delete on public.event_rounds to authenticated;
create policy v3_event_rounds_select on public.event_rounds for select to authenticated using (exists (select 1 from public.competition_events e where e.id=event_rounds.competition_event_id and public.can_view_competition(e.competition_id)));
create policy v3_event_rounds_insert on public.event_rounds for insert to authenticated with check (exists (select 1 from public.competition_events e where e.id=event_rounds.competition_event_id and public.can_manage_competition(e.competition_id)));
create policy v3_event_rounds_update on public.event_rounds for update to authenticated using (exists (select 1 from public.competition_events e where e.id=event_rounds.competition_event_id and public.can_manage_competition(e.competition_id))) with check (exists (select 1 from public.competition_events e where e.id=event_rounds.competition_event_id and public.can_manage_competition(e.competition_id)));
create policy v3_event_rounds_delete on public.event_rounds for delete to authenticated using (exists (select 1 from public.competition_events e where e.id=event_rounds.competition_event_id and public.can_manage_competition(e.competition_id)));
alter table public.race_heat_allocations enable row level security;
revoke all on public.race_heat_allocations from public, anon, authenticated;
grant select,insert on public.race_heat_allocations to authenticated;
create policy v3_race_heat_allocations_select on public.race_heat_allocations for select to authenticated using (exists (select 1 from public.competition_events e where e.id=race_heat_allocations.competition_event_id and public.can_view_competition(e.competition_id)));
create policy v3_race_heat_allocations_insert on public.race_heat_allocations for insert to authenticated with check (exists (select 1 from public.competition_events e where e.id=race_heat_allocations.competition_event_id and public.can_manage_competition(e.competition_id)));
alter table public.race_heat_results enable row level security;
revoke all on public.race_heat_results from public, anon, authenticated;
grant select,insert,update(status,performance_value) on public.race_heat_results to authenticated;
create policy v3_race_heat_results_select on public.race_heat_results for select to authenticated using (exists (select 1 from public.competition_events e where e.id=race_heat_results.competition_event_id and public.can_view_competition(e.competition_id)));
create policy v3_race_heat_results_insert on public.race_heat_results for insert to authenticated with check (exists (select 1 from public.competition_events e where e.id=race_heat_results.competition_event_id and public.can_manage_competition(e.competition_id)));
create policy v3_race_heat_results_update on public.race_heat_results for update to authenticated using (exists (select 1 from public.competition_events e where e.id=race_heat_results.competition_event_id and public.can_manage_competition(e.competition_id))) with check (exists (select 1 from public.competition_events e where e.id=race_heat_results.competition_event_id and public.can_manage_competition(e.competition_id)));
alter table public.entry_participants enable row level security;
revoke all on public.entry_participants from public, anon, authenticated;
grant select,insert,update,delete on public.entry_participants to authenticated;
create policy v3_entry_participants_select on public.entry_participants for select to authenticated using (exists (select 1 from public.event_entries en join public.competition_events e on e.id=en.competition_event_id where en.id=entry_participants.entry_id and public.can_view_competition(e.competition_id)));
create policy v3_entry_participants_insert on public.entry_participants for insert to authenticated with check (exists (select 1 from public.event_entries en join public.competition_events e on e.id=en.competition_event_id where en.id=entry_participants.entry_id and public.can_manage_competition(e.competition_id)) and exists (
  select 1 from public.event_entries en join public.students s on s.school_id=en.school_id
  where en.id=entry_participants.entry_id and s.id=entry_participants.student_id
));
create policy v3_entry_participants_update on public.entry_participants for update to authenticated using (exists (select 1 from public.event_entries en join public.competition_events e on e.id=en.competition_event_id where en.id=entry_participants.entry_id and public.can_manage_competition(e.competition_id)) and exists (
  select 1 from public.event_entries en join public.students s on s.school_id=en.school_id
  where en.id=entry_participants.entry_id and s.id=entry_participants.student_id
)) with check (exists (select 1 from public.event_entries en join public.competition_events e on e.id=en.competition_event_id where en.id=entry_participants.entry_id and public.can_manage_competition(e.competition_id)) and exists (
  select 1 from public.event_entries en join public.students s on s.school_id=en.school_id
  where en.id=entry_participants.entry_id and s.id=entry_participants.student_id
));
create policy v3_entry_participants_delete on public.entry_participants for delete to authenticated using (exists (select 1 from public.event_entries en join public.competition_events e on e.id=en.competition_event_id where en.id=entry_participants.entry_id and public.can_manage_competition(e.competition_id)) and exists (
  select 1 from public.event_entries en join public.students s on s.school_id=en.school_id
  where en.id=entry_participants.entry_id and s.id=entry_participants.student_id
));
alter table public.event_results enable row level security;
revoke all on public.event_results from public, anon, authenticated;
grant select,insert(round_id,entry_id,status,performance_value,placing_position,points,published_at,entered_by),update(status,performance_value,placing_position,points,published_at,entered_by) on public.event_results to authenticated;
create policy v3_event_results_select on public.event_results for select to authenticated using (exists (select 1 from public.event_rounds r join public.competition_events e on e.id=r.competition_event_id where r.id=event_results.round_id and public.can_view_competition(e.competition_id)));
create policy v3_event_results_insert on public.event_results for insert to authenticated with check (exists (select 1 from public.event_rounds r join public.competition_events e on e.id=r.competition_event_id where r.id=event_results.round_id and public.can_manage_competition(e.competition_id)));
create policy v3_event_results_update on public.event_results for update to authenticated using (exists (select 1 from public.event_rounds r join public.competition_events e on e.id=r.competition_event_id where r.id=event_results.round_id and public.can_manage_competition(e.competition_id))) with check (exists (select 1 from public.event_rounds r join public.competition_events e on e.id=r.competition_event_id where r.id=event_results.round_id and public.can_manage_competition(e.competition_id)));
alter table public.field_event_attempts enable row level security;
revoke all on public.field_event_attempts from public, anon, authenticated;
grant select,insert,update,delete on public.field_event_attempts to authenticated;
create policy v3_field_event_attempts_select on public.field_event_attempts for select to authenticated using (exists (select 1 from public.event_rounds r join public.competition_events e on e.id=r.competition_event_id where r.id=field_event_attempts.round_id and public.can_view_competition(e.competition_id)));
create policy v3_field_event_attempts_insert on public.field_event_attempts for insert to authenticated with check (exists (select 1 from public.event_rounds r join public.competition_events e on e.id=r.competition_event_id where r.id=field_event_attempts.round_id and public.can_manage_competition(e.competition_id)) and exists (
  select 1 from public.event_entries en join public.event_rounds r on r.competition_event_id=en.competition_event_id
  where en.id=field_event_attempts.entry_id and r.id=field_event_attempts.round_id
));
create policy v3_field_event_attempts_update on public.field_event_attempts for update to authenticated using (exists (select 1 from public.event_rounds r join public.competition_events e on e.id=r.competition_event_id where r.id=field_event_attempts.round_id and public.can_manage_competition(e.competition_id)) and exists (
  select 1 from public.event_entries en join public.event_rounds r on r.competition_event_id=en.competition_event_id
  where en.id=field_event_attempts.entry_id and r.id=field_event_attempts.round_id
)) with check (exists (select 1 from public.event_rounds r join public.competition_events e on e.id=r.competition_event_id where r.id=field_event_attempts.round_id and public.can_manage_competition(e.competition_id)) and exists (
  select 1 from public.event_entries en join public.event_rounds r on r.competition_event_id=en.competition_event_id
  where en.id=field_event_attempts.entry_id and r.id=field_event_attempts.round_id
));
create policy v3_field_event_attempts_delete on public.field_event_attempts for delete to authenticated using (exists (select 1 from public.event_rounds r join public.competition_events e on e.id=r.competition_event_id where r.id=field_event_attempts.round_id and public.can_manage_competition(e.competition_id)) and exists (
  select 1 from public.event_entries en join public.event_rounds r on r.competition_event_id=en.competition_event_id
  where en.id=field_event_attempts.entry_id and r.id=field_event_attempts.round_id
));
alter table public.race_rounds enable row level security;
revoke all on public.race_rounds from public, anon, authenticated;
grant select on public.race_rounds to authenticated;
create policy v3_race_rounds_select on public.race_rounds for select to authenticated using (exists (select 1 from public.competition_events e where e.id=race_rounds.competition_event_id and public.can_view_competition(e.competition_id)));
alter table public.race_lanes enable row level security;
revoke all on public.race_lanes from public, anon, authenticated;
grant select on public.race_lanes to authenticated;
create policy v3_race_lanes_select on public.race_lanes for select to authenticated using (exists(select 1 from public.race_rounds r where r.id=race_lanes.round_id));
alter table public.race_finalists add foreign key (competition_event_id,entry_id) references public.race_heat_results(competition_event_id,entry_id);
revoke update on public.race_finalists from authenticated;
grant update(status,performance_value,published_at) on public.race_finalists to authenticated;
alter policy race_finalists_update on public.race_finalists using (published_at is null and exists (select 1 from public.competition_events e where e.id=race_finalists.competition_event_id and public.can_manage_competition(e.competition_id)));
revoke all on public.race_finalists from public,anon;
revoke all on public.competition_house_totals from public,anon;
grant select on public.competition_house_totals to authenticated;
grant delete on public.students to authenticated;
create policy v3_students_delete on public.students for delete to authenticated using (public.is_platform_admin());
drop policy student_read on public.students;
create policy v3_students_select on public.students for select to authenticated using (public.has_school_permission(school_id,'students.view') or public.has_school_permission(school_id,'competitions.manage') or public.has_school_permission(school_id,'registrations.view'));
drop policy student_insert on public.students;
create policy v3_students_insert on public.students for insert to authenticated with check (public.has_school_permission(school_id,'students.create'));
drop policy student_update on public.students;
create policy v3_students_update on public.students for update to authenticated using (public.has_school_permission(school_id,'students.edit')) with check (public.has_school_permission(school_id,'students.edit'));
drop policy enrolment_read on public.student_enrolments;
create policy v3_student_enrolments_select on public.student_enrolments for select to authenticated using (public.has_school_permission(school_id,'students.view') or public.has_school_permission(school_id,'competitions.manage') or public.has_school_permission(school_id,'registrations.view'));
drop policy enrolment_insert on public.student_enrolments;
create policy v3_student_enrolments_insert on public.student_enrolments for insert to authenticated with check (public.has_school_permission(school_id,'students.create'));
drop policy enrolment_update on public.student_enrolments;
create policy v3_student_enrolments_update on public.student_enrolments for update to authenticated using (public.has_school_permission(school_id,'students.edit') or public.has_school_permission(school_id,'students.create')) with check (public.has_school_permission(school_id,'students.edit') or public.has_school_permission(school_id,'students.create'));
create policy v3_schools_select on public.schools for select to authenticated using (public.is_platform_admin());
create policy v3_school_memberships_select on public.school_memberships for select to authenticated using (public.is_platform_admin() or public.has_school_permission(school_id,'staff.view'));
alter table public.profiles enable row level security;
revoke all on public.profiles from public, anon, authenticated;
grant select,update(display_name) on public.profiles to authenticated;
create policy v3_profiles_select on public.profiles for select to authenticated using (id=auth.uid() or public.is_platform_admin());
create policy v3_profiles_update on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid());
alter table public.school_email_domains enable row level security;
revoke all on public.school_email_domains from public, anon, authenticated;
grant select on public.school_email_domains to authenticated;
create policy v3_school_email_domains_select on public.school_email_domains for select to authenticated using ((public.is_platform_admin() or public.is_school_admin(school_id)));
alter table public.school_requests enable row level security;
revoke all on public.school_requests from public, anon, authenticated;
grant select on public.school_requests to authenticated;
create policy v3_school_requests_select on public.school_requests for select to authenticated using (public.is_platform_admin());
alter table public.school_staff_requests enable row level security;
revoke all on public.school_staff_requests from public, anon, authenticated;
grant select on public.school_staff_requests to authenticated;
create policy v3_school_staff_requests_select on public.school_staff_requests for select to authenticated using ((public.is_platform_admin() or public.is_school_admin(school_id)) or user_id=auth.uid());
alter table public.school_staff_invitations enable row level security;
revoke all on public.school_staff_invitations from public, anon, authenticated;
grant select(id,email,school_id,expires_at,accepted_at,revoked_at,created_at) on public.school_staff_invitations to authenticated;
create policy v3_school_staff_invitations_select on public.school_staff_invitations for select to authenticated using ((public.is_platform_admin() or public.is_school_admin(school_id)));
alter table public.school_admin_promotion_requests enable row level security;
revoke all on public.school_admin_promotion_requests from public, anon, authenticated;
grant select on public.school_admin_promotion_requests to authenticated;
create policy v3_school_admin_promotion_requests_select on public.school_admin_promotion_requests for select to authenticated using ((public.is_platform_admin() or public.is_school_admin(school_id)) or user_id=auth.uid());
alter table public.school_admin_invitations enable row level security;
revoke all on public.school_admin_invitations from public, anon, authenticated;
alter table public.student_account_requests enable row level security;
revoke all on public.student_account_requests from public, anon, authenticated;
grant select on public.student_account_requests to authenticated;
create policy v3_student_account_requests_select on public.student_account_requests for select to authenticated using ((public.is_platform_admin() or public.is_school_admin(school_id)) or user_id=auth.uid());
alter table public.student_email_challenges enable row level security;
revoke all on public.student_email_challenges from public, anon, authenticated;
alter table public.student_registration_codes enable row level security;
revoke all on public.student_registration_codes from public, anon, authenticated;
alter table public.student_registration_sessions enable row level security;
revoke all on public.student_registration_sessions from public, anon, authenticated;
alter table public.school_captcha_attempts enable row level security;
revoke all on public.school_captcha_attempts from public, anon, authenticated;
alter table public.audit_logs enable row level security;
revoke all on public.audit_logs from public, anon, authenticated;
alter table public.student_sporting_division_audit enable row level security;
revoke all on public.student_sporting_division_audit from public, anon, authenticated;
alter table public.management_issues enable row level security;
revoke all on public.management_issues from public, anon, authenticated;
grant select,insert,update on public.management_issues to authenticated;
create policy v3_management_issues_select on public.management_issues for select to authenticated using (public.is_platform_admin());
create policy v3_management_issues_insert on public.management_issues for insert to authenticated with check (public.is_platform_admin() and created_by=auth.uid() and updated_by=auth.uid());
create policy v3_management_issues_update on public.management_issues for update to authenticated using (public.is_platform_admin() and updated_by=auth.uid()) with check (public.is_platform_admin() and updated_by=auth.uid());
alter table public.management_issue_comments enable row level security;
revoke all on public.management_issue_comments from public, anon, authenticated;
grant select,insert on public.management_issue_comments to authenticated;
create policy v3_management_issue_comments_select on public.management_issue_comments for select to authenticated using (public.is_platform_admin());
create policy v3_management_issue_comments_insert on public.management_issue_comments for insert to authenticated with check (public.is_platform_admin() and created_by=auth.uid());
grant usage on sequence public.management_issues_reference_number_seq to authenticated;
grant select,insert,update,delete on public.school_requests to service_role;
grant select on public.school_email_domains to service_role;
create trigger guard_competition_registration_rollback before update of status on public.competitions for each row execute function public.guard_competition_registration_rollback();
create policy v3_scope_assignment_read_own on public.school_staff_scope_assignments
  for select to authenticated using (user_id=(select auth.uid()));
create policy v3_scope_read_assigned on public.school_access_scopes
  for select to authenticated using (exists (
    select 1 from public.school_staff_scope_assignments a
    where a.scope_id=school_access_scopes.id and a.school_id=school_access_scopes.school_id
      and a.user_id=(select auth.uid())
  ));
create policy v3_memberships_read_school_admin on public.school_memberships
  for select to authenticated using (public.is_school_admin(school_id));
create policy v3_profiles_read_school_admin on public.profiles
  for select to authenticated using (exists(
    select 1 from public.school_memberships m where m.user_id=profiles.id and public.is_school_admin(m.school_id)
  ));
revoke all on function public.student_registration_issue_code(uuid,text,text),
  public.student_registration_verify_code(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.student_registration_issue_code(uuid,text,text),
  public.student_registration_verify_code(uuid,text,text,text) to service_role;
-- Recalculate even when an API caller updates only points.
drop trigger sst_assign_result_points_trigger on public.event_results;
create trigger sst_assign_result_points_trigger
  before insert or update of round_id,entry_id,status,placing_position,published_at,points
  on public.event_results for each row execute function public.sst_assign_result_points();
CREATE OR REPLACE FUNCTION public.student_is_event_age_eligible(p_student uuid, p_event uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT COALESCE((
  SELECT s.date_of_birth IS NOT NULL
    AND public.student_sporting_age(s.date_of_birth,
      CASE c.age_cutoff_mode
       WHEN 'competition_date' THEN c.starts_on
       WHEN 'custom_date' THEN c.age_cutoff_date
       WHEN 'custom' THEN c.age_cutoff_date
       ELSE make_date(c.school_year::integer,12,31)
      END) IS NOT NULL
    AND (ce.min_age IS NULL OR public.student_sporting_age(s.date_of_birth,
      CASE c.age_cutoff_mode
       WHEN 'competition_date' THEN c.starts_on
       WHEN 'custom_date' THEN c.age_cutoff_date
       WHEN 'custom' THEN c.age_cutoff_date
       ELSE make_date(c.school_year::integer,12,31)
      END) >= ce.min_age)
    AND (ce.max_age IS NULL OR public.student_sporting_age(s.date_of_birth,
      CASE c.age_cutoff_mode
       WHEN 'competition_date' THEN c.starts_on
       WHEN 'custom_date' THEN c.age_cutoff_date
       WHEN 'custom' THEN c.age_cutoff_date
       ELSE make_date(c.school_year::integer,12,31)
      END) <= ce.max_age)
  FROM public.students s
  JOIN public.competition_events ce ON ce.id=p_event
  JOIN public.competitions c ON c.id=ce.competition_id
  WHERE s.id=p_student AND s.school_id=c.organiser_school_id
 ),false);
$function$
;
create table public.school_meet_defaults (
  school_id uuid primary key references public.schools(id) on delete cascade,
  age_reference_date date not null default date '2000-12-31'
    check (age_reference_date between date '2000-01-01' and date '2000-12-31'),
  race_lanes integer not null default 8 check (race_lanes between 1 and 12),
  event_capacity integer check (event_capacity between 1 and 10000),
  placing_points numeric[] not null default array[10,8,6,5,4,3,2,1]::numeric[]
    check (array_ndims(placing_points) = 1 and cardinality(placing_points) between 1 and 30
      and array_position(placing_points, null) is null
      and 0 <= all(placing_points) and 10000 >= all(placing_points)),
  team_multiplier numeric(4,2) not null default 1 check (team_multiplier between 0 and 20),
  allow_ties boolean not null default true
);

alter table public.school_meet_defaults enable row level security;
revoke all on public.school_meet_defaults from public, anon, authenticated;
grant select, insert, update on public.school_meet_defaults to authenticated;

create or replace function public.sst_can_manage_school_meet_defaults(p_school_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    public.is_platform_admin() or exists (
      select 1 from public.school_memberships m
      where m.school_id = p_school_id and m.user_id = auth.uid() and m.role = 'school_admin'
    )
  );
$$;
revoke all on function public.sst_can_manage_school_meet_defaults(uuid) from public, anon;
grant execute on function public.sst_can_manage_school_meet_defaults(uuid) to authenticated;

create policy school_meet_defaults_manage on public.school_meet_defaults
for all to authenticated
using (public.sst_can_manage_school_meet_defaults(school_id))
with check (public.sst_can_manage_school_meet_defaults(school_id));

alter table public.competitions
  add column default_race_lanes integer check (default_race_lanes between 1 and 12),
  add column default_event_capacity integer check (default_event_capacity between 1 and 10000);

create or replace function public.sst_apply_school_meet_defaults()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  defaults public.school_meet_defaults%rowtype;
  month_start date;
  last_day integer;
begin
  if new.competition_type::text is distinct from 'intra_school' then
    return new;
  end if;

  select * into defaults from public.school_meet_defaults
    where school_id = new.organiser_school_id;
  if not found then
    return new;
  end if;

  if defaults.age_reference_date = date '2000-12-31' then
    new.age_cutoff_mode := 'calendar_year';
    new.age_cutoff_date := null;
  else
    month_start := make_date(new.school_year::integer, extract(month from defaults.age_reference_date)::integer, 1);
    last_day := extract(day from month_start + interval '1 month - 1 day')::integer;
    new.age_cutoff_mode := 'custom_date';
    new.age_cutoff_date := month_start + (least(last_day, extract(day from defaults.age_reference_date)::integer) - 1);
  end if;

  new.scoring_scheme := jsonb_build_object(
    'placing_points', defaults.placing_points,
    'team_multiplier', defaults.team_multiplier,
    'allow_ties', defaults.allow_ties
  );
  new.default_race_lanes := defaults.race_lanes;
  new.default_event_capacity := defaults.event_capacity;
  return new;
end;
$$;
revoke all on function public.sst_apply_school_meet_defaults() from public, anon, authenticated;

create trigger sst_apply_school_meet_defaults
before insert on public.competitions
for each row execute function public.sst_apply_school_meet_defaults();
insert into public.event_definitions(sport_id,name,measurement)
select s.id,e.name,e.measurement from public.sports s
join (values
 ('Athletics','100 m','time_ms'),('Athletics','200 m','time_ms'),('Athletics','400 m','time_ms'),
 ('Athletics','800 m','time_ms'),('Athletics','1500 m','time_ms'),('Athletics','4 × 100 m Relay','time_ms'),
 ('Athletics','Long Jump','distance_mm'),('Athletics','Triple Jump','distance_mm'),
 ('Athletics','High Jump','distance_mm'),('Athletics','Shot Put','distance_mm'),
 ('Athletics','Discus','distance_mm'),('Athletics','Javelin','distance_mm'),
 ('Swimming','50 m Freestyle','time_ms'),('Swimming','50 m Breaststroke','time_ms'),
 ('Swimming','50 m Backstroke','time_ms'),('Swimming','50 m Butterfly','time_ms'),
 ('Swimming','100 m Freestyle','time_ms'),('Swimming','4 × 50 m Freestyle Relay','time_ms'),
 ('Cross Country','Cross Country','time_ms')
) e(sport,name,measurement) on s.name=e.sport
on conflict (sport_id,name) do update set measurement=excluded.measurement
where event_definitions.measurement is null;
-- Copy the retained synthetic demo only, using its existing school and source row IDs.
insert into public.students(id,school_id,student_number,given_name,family_name,date_of_birth)
select c.id,c.school_id,c.student_number,split_part(trim(c.name),' ',1),
       coalesce(nullif(ltrim(substr(trim(c.name),length(split_part(trim(c.name),' ',1))+1)),''),'Demo'),
       make_date(2026-5-c.year_level,6,15)
from public.carnival_students c join public.schools s on s.id=c.school_id
where s.name='Demo School' and s.code='DEMO'
on conflict do nothing;

insert into public.student_enrolments(school_id,student_id,school_year,year_level,house_id)
select c.school_id,c.id,2026,'Year '||c.year_level,h.id
from public.carnival_students c
join public.students st on st.id=c.id and st.school_id=c.school_id
join public.schools s on s.id=c.school_id
left join public.school_houses h on h.id=c.house_id and h.school_id=c.school_id
where s.name='Demo School' and s.code='DEMO'
on conflict do nothing;

insert into public.competitions(id,name,sport_id,organiser_school_id,school_year,starts_on,status,scoring_scheme)
select m.id,m.name,sp.id,m.school_id,extract(year from m.meet_date)::integer,m.meet_date,'draft',
       jsonb_build_object('placing_points',m.points,'team_multiplier',1,'allow_ties',true)
from public.carnival_meets m join public.schools s on s.id=m.school_id
join public.sports sp on sp.name=m.sport
where s.name='Demo School' and s.code='DEMO'
  and m.status='Draft'
on conflict do nothing;

insert into public.competition_age_groups(competition_id,name)
select distinct c.id,e.division
from public.carnival_events e join public.competitions c on c.id=e.meet_id and c.organiser_school_id=e.school_id
where exists (select 1 from public.schools s where s.id=c.organiser_school_id and s.name='Demo School' and s.code='DEMO')
on conflict do nothing;

insert into public.competition_events(id,competition_id,event_definition_id,age_group,division,race_lanes,race_max_heats,scheduled_on,venue,schedule_order)
select e.id,c.id,d.id,e.division,'Open',
       case when d.measurement='time_ms' then m.lane_count end,
       case when d.measurement='time_ms' then 4 end,
       m.meet_date,m.venue,e.event_number
from public.carnival_events e
join public.carnival_meets m on m.id=e.meet_id
join public.competitions c on c.id=m.id and c.organiser_school_id=e.school_id
join public.event_definitions d on d.sport_id=c.sport_id and lower(d.name)=lower(e.name)
where exists (select 1 from public.schools s where s.id=c.organiser_school_id and s.name='Demo School' and s.code='DEMO')
on conflict do nothing;
