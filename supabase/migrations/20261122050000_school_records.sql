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
