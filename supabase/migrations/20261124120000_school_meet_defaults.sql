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

create function public.sst_can_manage_school_meet_defaults(p_school_id uuid)
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

create function public.sst_apply_school_meet_defaults()
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
