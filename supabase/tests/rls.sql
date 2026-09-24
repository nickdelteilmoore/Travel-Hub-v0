-- Row-level-security checks for the travel schema. Every line of output
-- should start with "ok". Run against a throwaway local database that has the
-- migration and seeds applied, e.g. after `supabase start`:
--
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/rls.sql
--
-- It creates three users (two whitelisted, one not) and some rows, so never
-- run it against a real project.
\set QUIET on
\pset tuples_only on
begin;
insert into private.allowed_emails values ('alice@example.com'), ('bob@example.com');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'mallory@example.com');
select case when count(*) = 3 then 'ok' else 'FAIL' end || ': profiles auto-created on sign-up' from profiles;
insert into travel_alerts (traveller_id, kind, title) values ('00000000-0000-0000-0000-00000000000a', 'gate', 'Gate B12');

create function pg_temp.expect_fail(sql text, label text) returns text language plpgsql as $$
begin execute sql; return 'FAIL (allowed): ' || label;
exception when others then return 'ok (blocked: ' || sqlstate || '): ' || label; end $$;
create function pg_temp.expect_rows(sql text, n int, label text) returns text language plpgsql as $$
declare c int; begin execute 'select count(*) from (' || sql || ') x' into c;
return case when c = n then 'ok' else 'FAIL' end || ' (' || c || ' rows, want ' || n || '): ' || label; end $$;
grant execute on all functions in schema pg_temp to anon, authenticated;

-- ── alice, a household member ──
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","email":"alice@example.com"}';
insert into travel_trips (id, title, start_date, end_date, primary_country_code) values ('10000000-0000-0000-0000-000000000001', 'Paris', (now() + interval '30 days')::date, (now() + interval '33 days')::date, 'FR');
insert into travel_segments (id, trip_id, segment_type, depart_at, arrive_at, depart_iata, arrive_iata, depart_country_code, arrive_country_code, arrive_tz, carrier, number)
  values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'flight', now() + interval '30 days', now() + interval '30 days 2 hours', 'LHR', 'CDG', 'GB', 'FR', 'Europe/Paris', 'AF', '1081');
insert into travel_segments (trip_id, segment_type, depart_at, arrive_at, arrive_country_code, arrive_tz)
  values ('10000000-0000-0000-0000-000000000001', 'hotel', now() + interval '30 days 6 hours', now() + interval '33 days', 'FR', 'Europe/Paris');
select 'ok: reconcile wrote ' || reconcile_travel_entries('10000000-0000-0000-0000-000000000001');
select pg_temp.expect_rows($$select * from travel_entries where country_code='FR' and exit_date > entry_date and not transit$$, 1, 'reconcile builds a non-transit FR stay');
select pg_temp.expect_rows('select * from travel_flight_watches', 1, 'flight watch auto-created for alice');
insert into trip_expenses (trip_id, currency, amount, reason) values ('10000000-0000-0000-0000-000000000001', 'EUR', 12.50, 'Lunch');
insert into storage.objects (bucket_id, name) values ('receipts', '00000000-0000-0000-0000-00000000000a/trip/r1.jpg');
select pg_temp.expect_rows('select * from travel_alerts', 1, 'alice sees her alert');
update travel_alerts set read_at = now();
select pg_temp.expect_fail($$update travel_alerts set title = 'phish'$$, 'alice rewrites alert text');
select pg_temp.expect_fail($$insert into storage.objects (bucket_id, name) values ('receipts', '00000000-0000-0000-0000-00000000000b/x.jpg')$$, 'alice writes into bob''s receipt folder');
select pg_temp.expect_fail($$insert into travel_documents (filename, storage_path) values ('x', '00000000-0000-0000-0000-00000000000b/x.pdf')$$, 'alice points a document at bob''s storage path');

-- ── bob, the other household member ──
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","email":"bob@example.com"}';
select pg_temp.expect_rows('select * from travel_trips', 0, 'bob cannot see alice''s trips');
select pg_temp.expect_rows('select * from travel_segments', 0, 'bob cannot see alice''s segments (booking refs etc.)');
select pg_temp.expect_rows('select * from trip_expenses', 0, 'bob cannot see alice''s expenses');
select pg_temp.expect_rows('select * from travel_alerts', 0, 'bob cannot see alice''s alerts');
select pg_temp.expect_rows('select * from storage.objects', 0, 'bob cannot see alice''s receipt files');
select pg_temp.expect_rows('select * from travel_entries', 1, 'bob CAN read alice''s entries (household switcher, by design)');
select pg_temp.expect_rows('select * from profiles', 3, 'bob reads profiles');
select pg_temp.expect_fail($$insert into travel_entries (traveler_id, country_code, entry_date) values ('00000000-0000-0000-0000-00000000000a', 'US', '2026-01-01')$$, 'bob writes an entry as alice');
select pg_temp.expect_fail($$insert into travel_segments (trip_id, segment_type, depart_at) values ('10000000-0000-0000-0000-000000000001', 'note', now())$$, 'bob files a segment under alice''s trip');
select pg_temp.expect_fail($$insert into trip_expenses (trip_id, amount) values ('10000000-0000-0000-0000-000000000001', 1)$$, 'bob adds an expense to alice''s trip');
select pg_temp.expect_fail($$insert into travel_trips (traveller_id, title) values ('00000000-0000-0000-0000-00000000000a', 'x')$$, 'bob creates a trip owned by alice');
insert into travel_trips (id, title) values ('10000000-0000-0000-0000-000000000002', 'Bob trip');
select pg_temp.expect_fail($$select travel_merge_trips('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002')$$, 'bob merges alice''s trip into his');
select case when reconcile_travel_entries('10000000-0000-0000-0000-000000000001') = 0 then 'ok' else 'FAIL' end || ': bob cannot reconcile alice''s trip';
update travel_trips set title = 'hacked' where id = '10000000-0000-0000-0000-000000000001';
reset role;
select pg_temp.expect_rows($$select * from travel_trips where title = 'hacked'$$, 0, 'bob''s update of alice''s trip changed nothing');
select pg_temp.expect_rows('select * from travel_entries', 1, 'alice''s entries survive bob''s reconcile attempt');

-- ── mallory: signed up, but not whitelisted ──
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c","email":"mallory@example.com"}';
select pg_temp.expect_rows('select * from travel_entries', 0, 'mallory reads no entries');
select pg_temp.expect_rows('select * from profiles', 0, 'mallory reads no profiles');
select pg_temp.expect_rows('select * from countries', 0, 'mallory reads no reference data');
select pg_temp.expect_fail($$insert into travel_trips (title) values ('squat')$$, 'mallory creates a trip');
select pg_temp.expect_fail($$insert into storage.objects (bucket_id, name) values ('receipts', '00000000-0000-0000-0000-00000000000c/free-hosting.jpg')$$, 'mallory uploads to her own folder');
select case when not is_household_member() then 'ok' else 'FAIL' end || ': mallory is not a member';
select pg_temp.expect_fail($$select * from private.allowed_emails$$, 'mallory reads the whitelist');
select pg_temp.expect_fail($$insert into private.allowed_emails values ('mallory@example.com')$$, 'mallory whitelists herself');

-- ── anon: no session at all ──
set role anon;
set request.jwt.claims = '';
select pg_temp.expect_fail('select * from travel_trips', 'anon reads trips');
select pg_temp.expect_fail('select * from travel_entries', 'anon reads entries');
select pg_temp.expect_fail('select * from countries', 'anon reads countries');
select pg_temp.expect_fail('select public.is_household_member()', 'anon calls is_household_member()');
select pg_temp.expect_fail($$select public.reconcile_travel_entries('10000000-0000-0000-0000-000000000001')$$, 'anon calls reconcile');
select pg_temp.expect_rows('select * from storage.objects', 0, 'anon sees no stored files');
reset role;
rollback;
