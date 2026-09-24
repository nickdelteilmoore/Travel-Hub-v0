-- Travel Hub — the complete schema, from an empty Supabase project.
--
-- Security model (read this before changing anything):
--   * Nobody gets in by signing up. Every policy also requires
--     public.is_household_member(), which checks the signed-in email against
--     private.allowed_emails — a table only the database owner can write.
--     Add your household's emails there (see README) and turn off public
--     sign-ups in Supabase Auth.
--   * Personal rows are owner-scoped (traveller_id = auth.uid()). The one
--     deliberate share is travel_entries / visited_countries / profiles, which
--     household members can *read* so the traveller switcher can show each
--     other's Schengen count and map.
--   * The anon role gets nothing: no table grants, no function execute.
--   * Every function pins search_path, so a caller can't shadow the objects
--     it references.

-- ── Whitelist ──────────────────────────────────────────────────────────────

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.allowed_emails (
  email text primary key check (email = lower(email))
);

create or replace function public.is_household_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.allowed_emails
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke execute on function public.is_household_member() from public, anon;
grant execute on function public.is_household_member() to authenticated;

-- ── Profiles ───────────────────────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

-- A profile row per auth user, named from sign-up metadata or the email's
-- local part (the app's firstNameFrom() tidies the latter for greetings).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Reference data (seeded by supabase/seed.sql) ───────────────────────────

create table public.countries (
  code char(2) primary key,
  name text not null,
  flag_emoji text not null,
  is_schengen boolean not null default false,
  fcdo_slug text
);

create table public.travel_segment_types (
  code text primary key,
  label text not null,
  is_extractable boolean not null default true,
  is_lodging boolean not null default false,
  is_transport boolean not null default false,
  leaf text not null default 'generic',
  position integer not null default 100
);

create table public.travel_airports (
  iata char(3) primary key,
  icao char(4),
  name text not null,
  city text,
  country_code char(2) references public.countries(code),
  tz text not null,
  latitude double precision,
  longitude double precision
);

create index idx_travel_airports_country on public.travel_airports (country_code);
create index idx_travel_airports_city on public.travel_airports (lower(city));

-- ── Personal data ──────────────────────────────────────────────────────────

create table public.travel_preferences (
  traveller_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  home_country_code char(2) not null default 'GB' references public.countries(code),
  created_at timestamptz not null default now()
);

create table public.travel_trips (
  id uuid primary key default gen_random_uuid(),
  traveller_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (length(title) <= 200),
  start_date date,
  end_date date,
  primary_country_code char(2) references public.countries(code),
  purpose text not null default 'personal' check (purpose in ('personal', 'work', 'mixed')),
  notes text check (length(notes) <= 10000),
  source text not null default 'manual' check (source in ('manual', 'email', 'derived', 'api', 'import')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_travel_trips_traveller on public.travel_trips (traveller_id, start_date desc);
create index idx_travel_trips_span on public.travel_trips (start_date, end_date);

create table public.travel_segments (
  id uuid primary key default gen_random_uuid(),
  traveller_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  trip_id uuid references public.travel_trips(id) on delete set null,
  segment_type text not null references public.travel_segment_types(code),
  status text not null default 'confirmed' check (status in ('confirmed', 'pending', 'changed', 'cancelled')),
  title text,
  depart_at timestamptz,
  depart_tz text,
  depart_place text,
  depart_iata char(3) references public.travel_airports(iata),
  depart_country_code char(2) references public.countries(code),
  arrive_at timestamptz,
  arrive_tz text,
  arrive_place text,
  arrive_iata char(3) references public.travel_airports(iata),
  arrive_country_code char(2) references public.countries(code),
  carrier text,
  number text,
  cabin text,
  seat text,
  booking_ref text,
  address text,
  phone text,
  url text,
  distance_km numeric,
  co2_kg numeric,
  source text not null default 'manual' check (source in ('manual', 'email', 'derived', 'api', 'import')),
  source_ref uuid,
  confidence numeric,
  needs_review boolean not null default false,
  raw jsonb,
  notes text check (length(notes) <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint travel_segments_has_a_time check (depart_at is not null or arrive_at is not null),
  constraint travel_segments_ordered check (arrive_at is null or depart_at is null or arrive_at >= depart_at)
);

create index idx_travel_segments_trip on public.travel_segments (trip_id, depart_at);
create index idx_travel_segments_when on public.travel_segments (traveller_id, depart_at);
create index idx_travel_segments_review on public.travel_segments (traveller_id) where needs_review;
create index idx_travel_segments_flights on public.travel_segments (depart_at)
  where segment_type = 'flight' and status <> 'cancelled';

create table public.travel_entries (
  id uuid primary key default gen_random_uuid(),
  traveler_id uuid not null references public.profiles(id) on delete cascade,
  country_code char(2) not null references public.countries(code),
  entry_date date not null,
  exit_date date,
  notes text,
  transit boolean not null default false,
  created_at timestamptz not null default now(),
  check (exit_date is null or exit_date >= entry_date)
);

create index travel_by_traveler_idx on public.travel_entries (traveler_id, entry_date desc);

create table public.visited_countries (
  traveler_id uuid not null references public.profiles(id) on delete cascade,
  country_code char(2) not null references public.countries(code),
  created_at timestamptz not null default now(),
  primary key (traveler_id, country_code)
);

create table public.travel_documents (
  id uuid primary key default gen_random_uuid(),
  traveller_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  trip_id uuid references public.travel_trips(id) on delete cascade,
  segment_id uuid references public.travel_segments(id) on delete cascade,
  kind text not null default 'attachment'
    check (kind in ('boarding_pass', 'ticket', 'voucher', 'invoice', 'visa', 'insurance', 'attachment')),
  filename text not null,
  storage_path text not null unique,
  mime_type text,
  bytes bigint,
  pinned boolean not null default false,
  source text not null default 'manual',
  created_at timestamptz not null default now()
);

create index idx_travel_documents_trip on public.travel_documents (trip_id);
create index idx_travel_documents_segment on public.travel_documents (segment_id);

-- Written by a flight-status worker you run yourself (not included); the app
-- reads them and can mark alerts read.
create table public.travel_alerts (
  id uuid primary key default gen_random_uuid(),
  traveller_id uuid not null references auth.users(id) on delete cascade,
  segment_id uuid references public.travel_segments(id) on delete cascade,
  kind text not null
    check (kind in ('gate', 'terminal', 'delay', 'cancelled', 'diverted', 'baggage', 'landed', 'advice')),
  severity text not null default 'info' check (severity in ('info', 'warn', 'alert')),
  title text not null,
  body text,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  pushed_at timestamptz
);

create index idx_travel_alerts_unread on public.travel_alerts (traveller_id, created_at desc) where read_at is null;

create table public.travel_flight_watches (
  segment_id uuid primary key references public.travel_segments(id) on delete cascade,
  traveller_id uuid not null references auth.users(id) on delete cascade,
  flight_iata text not null,
  scheduled_date date not null,
  next_check_at timestamptz,
  checks_used integer not null default 0,
  active boolean not null default true,
  paused boolean not null default false,
  last_error text,
  created_at timestamptz not null default now()
);

create index idx_travel_watches_due on public.travel_flight_watches (next_check_at) where active;

create table public.travel_flight_status (
  segment_id uuid primary key references public.travel_segments(id) on delete cascade,
  flight_status text,
  depart_terminal text,
  depart_gate text,
  depart_delay_min integer,
  depart_estimated timestamptz,
  depart_actual timestamptz,
  arrive_terminal text,
  arrive_gate text,
  arrive_belt text,
  arrive_delay_min integer,
  arrive_estimated timestamptz,
  arrive_actual timestamptz,
  raw jsonb,
  checked_at timestamptz not null default now()
);

create table public.trip_expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.travel_trips(id) on delete cascade,
  traveller_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  spent_on date,
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  amount numeric(12, 2),
  reason text check (length(reason) <= 500),
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index trip_expenses_trip_id_idx on public.trip_expenses (trip_id);
create index trip_expenses_traveller_id_idx on public.trip_expenses (traveller_id);

-- ── Functions & triggers ───────────────────────────────────────────────────

create or replace function public.travel_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_travel_trips_touch before update on public.travel_trips
  for each row execute function public.travel_touch_updated_at();
create trigger trg_travel_segments_touch before update on public.travel_segments
  for each row execute function public.travel_touch_updated_at();
create trigger trg_trip_expenses_touch before update on public.trip_expenses
  for each row execute function public.travel_touch_updated_at();

-- The countries a segment puts you in, and on which local dates.
create or replace function public.travel_segment_countries(seg public.travel_segments)
returns table (country_code char(2), from_date date, to_date date)
language sql
stable
set search_path = ''
as $$
  select
    coalesce(seg.arrive_country_code, seg.depart_country_code)::char(2),
    (seg.depart_at at time zone coalesce(seg.arrive_tz, seg.depart_tz, 'UTC'))::date,
    (coalesce(seg.arrive_at, seg.depart_at) at time zone coalesce(seg.arrive_tz, seg.depart_tz, 'UTC'))::date
  where coalesce(seg.arrive_country_code, seg.depart_country_code) is not null
    and seg.status <> 'cancelled'
    and not seg.needs_review;
$$;

-- Rebuild the travel_entries rows a trip's segments imply. Runs as the caller,
-- so RLS keeps it to the caller's own trips; it only ever deletes rows it
-- wrote itself (tagged in `notes`).
create or replace function public.reconcile_travel_entries(p_trip_id uuid)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_traveller uuid;
  v_home      char(2);
  v_written   integer := 0;
begin
  select traveller_id into v_traveller from public.travel_trips where id = p_trip_id;
  if v_traveller is null or v_traveller <> auth.uid() then
    return 0;
  end if;

  select home_country_code into v_home from public.travel_preferences where traveller_id = v_traveller;
  v_home := coalesce(v_home, 'GB');

  delete from public.travel_entries
   where traveler_id = v_traveller
     and notes = 'travel-hub:' || p_trip_id::text;

  -- One presence span per country. A day spent only in transit is flagged
  -- `transit`: the map leaves it out of "visited", the Schengen count doesn't.
  with presence as (
    select
      c.country_code,
      min(c.from_date) as entry_date,
      max(c.to_date)   as exit_date,
      bool_and(s.segment_type not in ('hotel', 'apartment')) and
        max(c.to_date) - min(c.from_date) < 1 as transit
    from public.travel_segments s
    cross join lateral public.travel_segment_countries(s) c
    where s.trip_id = p_trip_id
      and c.country_code <> v_home
    group by c.country_code
  )
  insert into public.travel_entries (traveler_id, country_code, entry_date, exit_date, transit, notes)
  select v_traveller, country_code, entry_date, nullif(exit_date, entry_date), transit,
         'travel-hub:' || p_trip_id::text
  from presence;

  get diagnostics v_written = row_count;
  return v_written;
end;
$$;

create or replace function public.travel_merge_trips(p_from uuid, p_into uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_from_traveller uuid;
  v_into_traveller uuid;
begin
  if p_from = p_into then
    raise exception 'cannot merge a trip into itself';
  end if;

  select traveller_id into v_from_traveller from public.travel_trips where id = p_from;
  select traveller_id into v_into_traveller from public.travel_trips where id = p_into;
  if v_from_traveller is null or v_into_traveller is null
     or v_from_traveller <> auth.uid() or v_into_traveller <> auth.uid() then
    raise exception 'trip not found';
  end if;

  update public.travel_segments set trip_id = p_into where trip_id = p_from;

  update public.travel_trips t set
    start_date = least(t.start_date, s.start_date),
    end_date   = greatest(t.end_date, s.end_date)
  from public.travel_trips s
  where t.id = p_into and s.id = p_from;

  delete from public.travel_entries
   where traveler_id = v_from_traveller
     and notes = 'travel-hub:' || p_from::text;
  delete from public.travel_trips where id = p_from;

  perform public.reconcile_travel_entries(p_into);
end;
$$;

-- Keep a flight watch in step with each upcoming flight, for a status worker
-- to poll. Runs as the caller; RLS on travel_flight_watches applies.
create or replace function public.travel_sync_flight_watch()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_iata text;
begin
  if new.segment_type <> 'flight' or new.carrier is null or new.number is null then
    return new;
  end if;

  if new.status = 'cancelled' then
    update public.travel_flight_watches set active = false where segment_id = new.id;
    return new;
  end if;

  if new.depart_at is null or new.depart_at < now() - interval '3 hours' then
    return new;
  end if;

  v_iata := upper(regexp_replace(new.carrier || new.number, '\s', '', 'g'));

  insert into public.travel_flight_watches
    (segment_id, traveller_id, flight_iata, scheduled_date, next_check_at, active)
  values
    (new.id, new.traveller_id, v_iata, (new.depart_at at time zone 'UTC')::date, now(), true)
  on conflict (segment_id) do update set
    flight_iata    = excluded.flight_iata,
    scheduled_date = excluded.scheduled_date,
    next_check_at  = case
                       when public.travel_flight_watches.flight_iata <> excluded.flight_iata
                         or public.travel_flight_watches.scheduled_date <> excluded.scheduled_date
                       then now()
                       else public.travel_flight_watches.next_check_at
                     end,
    active         = case when public.travel_flight_watches.paused
                          then public.travel_flight_watches.active else true end;

  return new;
end;
$$;

create trigger trg_travel_flight_watch
  after insert or update of segment_type, carrier, number, depart_at, status on public.travel_segments
  for each row execute function public.travel_sync_flight_watch();

revoke execute on function
  public.travel_touch_updated_at(),
  public.travel_segment_countries(public.travel_segments),
  public.reconcile_travel_entries(uuid),
  public.travel_merge_trips(uuid, uuid),
  public.travel_sync_flight_watch()
from public, anon;
grant execute on function
  public.travel_segment_countries(public.travel_segments),
  public.reconcile_travel_entries(uuid),
  public.travel_merge_trips(uuid, uuid)
to authenticated;

-- ── Row-level security ─────────────────────────────────────────────────────

alter table public.profiles              enable row level security;
alter table public.countries             enable row level security;
alter table public.travel_segment_types  enable row level security;
alter table public.travel_airports       enable row level security;
alter table public.travel_preferences    enable row level security;
alter table public.travel_trips          enable row level security;
alter table public.travel_segments       enable row level security;
alter table public.travel_entries        enable row level security;
alter table public.visited_countries     enable row level security;
alter table public.travel_documents      enable row level security;
alter table public.travel_alerts         enable row level security;
alter table public.travel_flight_watches enable row level security;
alter table public.travel_flight_status  enable row level security;
alter table public.trip_expenses         enable row level security;

-- Defence in depth: RLS already stops anon, but it shouldn't even hold grants.
revoke all on
  public.profiles, public.countries, public.travel_segment_types, public.travel_airports,
  public.travel_preferences, public.travel_trips, public.travel_segments,
  public.travel_entries, public.visited_countries, public.travel_documents,
  public.travel_alerts, public.travel_flight_watches, public.travel_flight_status,
  public.trip_expenses
from anon;

create policy "members read profiles" on public.profiles
  for select to authenticated using (public.is_household_member());
create policy "own profile update" on public.profiles
  for update to authenticated
  using (public.is_household_member() and id = auth.uid())
  with check (public.is_household_member() and id = auth.uid());

create policy "members read countries" on public.countries
  for select to authenticated using (public.is_household_member());
create policy "members read segment types" on public.travel_segment_types
  for select to authenticated using (public.is_household_member());
create policy "members read airports" on public.travel_airports
  for select to authenticated using (public.is_household_member());

create policy "own preferences" on public.travel_preferences
  for all to authenticated
  using (public.is_household_member() and traveller_id = auth.uid())
  with check (public.is_household_member() and traveller_id = auth.uid());

create policy "own trips" on public.travel_trips
  for all to authenticated
  using (public.is_household_member() and traveller_id = auth.uid())
  with check (public.is_household_member() and traveller_id = auth.uid());

-- A segment can only be filed under a trip its owner also owns.
create policy "own segments" on public.travel_segments
  for all to authenticated
  using (public.is_household_member() and traveller_id = auth.uid())
  with check (
    public.is_household_member() and traveller_id = auth.uid()
    and (trip_id is null or exists (
      select 1 from public.travel_trips t where t.id = trip_id and t.traveller_id = auth.uid()))
  );

-- Entries and visited countries: readable across the household (the traveller
-- switcher), writable only by their owner.
create policy "members read entries" on public.travel_entries
  for select to authenticated using (public.is_household_member());
create policy "own entries insert" on public.travel_entries
  for insert to authenticated
  with check (public.is_household_member() and traveler_id = auth.uid());
create policy "own entries update" on public.travel_entries
  for update to authenticated
  using (public.is_household_member() and traveler_id = auth.uid())
  with check (public.is_household_member() and traveler_id = auth.uid());
create policy "own entries delete" on public.travel_entries
  for delete to authenticated
  using (public.is_household_member() and traveler_id = auth.uid());

create policy "members read visited" on public.visited_countries
  for select to authenticated using (public.is_household_member());
create policy "own visited insert" on public.visited_countries
  for insert to authenticated
  with check (public.is_household_member() and traveler_id = auth.uid());
create policy "own visited delete" on public.visited_countries
  for delete to authenticated
  using (public.is_household_member() and traveler_id = auth.uid());

create policy "own documents" on public.travel_documents
  for all to authenticated
  using (public.is_household_member() and traveller_id = auth.uid())
  with check (
    public.is_household_member() and traveller_id = auth.uid()
    and split_part(storage_path, '/', 1) = auth.uid()::text
  );

-- Alerts come from the worker (service role); the app may only read them and
-- mark them read.
create policy "own alerts read" on public.travel_alerts
  for select to authenticated
  using (public.is_household_member() and traveller_id = auth.uid());
create policy "own alerts mark read" on public.travel_alerts
  for update to authenticated
  using (public.is_household_member() and traveller_id = auth.uid())
  with check (public.is_household_member() and traveller_id = auth.uid());
revoke update on public.travel_alerts from authenticated;
grant update (read_at) on public.travel_alerts to authenticated;

create policy "own flight watches" on public.travel_flight_watches
  for all to authenticated
  using (public.is_household_member() and traveller_id = auth.uid())
  with check (
    public.is_household_member() and traveller_id = auth.uid()
    and exists (select 1 from public.travel_segments s
                where s.id = segment_id and s.traveller_id = auth.uid())
  );

create policy "own flight status read" on public.travel_flight_status
  for select to authenticated
  using (public.is_household_member() and exists (
    select 1 from public.travel_segments s
    where s.id = travel_flight_status.segment_id and s.traveller_id = auth.uid()));

create policy "own expenses" on public.trip_expenses
  for all to authenticated
  using (public.is_household_member() and traveller_id = auth.uid())
  with check (
    public.is_household_member() and traveller_id = auth.uid()
    and exists (select 1 from public.travel_trips t where t.id = trip_id and t.traveller_id = auth.uid())
  );

-- ── Storage ────────────────────────────────────────────────────────────────
-- Private buckets; objects live under <uid>/..., and only that user can touch
-- them. Size and type limits stop the buckets being used as free hosting.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('travel-docs', 'travel-docs', false, 26214400,
   array['application/pdf', 'image/png', 'image/jpeg', 'text/calendar']),
  ('receipts', 'receipts', false, 10485760,
   array['image/jpeg', 'image/png'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "own travel docs" on storage.objects
  for all to authenticated
  using (bucket_id = 'travel-docs' and public.is_household_member()
         and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'travel-docs' and public.is_household_member()
              and (storage.foldername(name))[1] = auth.uid()::text);

create policy "own receipts" on storage.objects
  for all to authenticated
  using (bucket_id = 'receipts' and public.is_household_member()
         and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'receipts' and public.is_household_member()
              and (storage.foldername(name))[1] = auth.uid()::text);
