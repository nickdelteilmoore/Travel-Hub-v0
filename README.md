# Travel Hub 🧳

An Android app for keeping track of where you've been and where you're going:
trips and itineraries, a running **Schengen 90/180** calculator, a
visited-countries world map, receipt capture for trip expenses, and a hotel map
with the nearest metro. It works offline and syncs when you land.

It's a template: you bring your own [Supabase](https://supabase.com) project,
and only the email addresses you whitelist can use it.


## Features

- **Schengen 90/180.** Rolling-window calculator (`src/features/travel/schengen.ts`,
  pure and unit-tested), including per-trip days still inside the window.
- **World map.** Visited countries on an SVG choropleth; layovers don't count
  as visits.
- **Trips & itineraries.** Flights, trains, hotels and more on a day-by-day
  timeline, shown in each place's local time, with CO₂ estimates.
- **Expenses.** Photograph a receipt; on-device OCR fills the form. Nothing is
  sent to a third party. Export to PDF or CSV.
- **Hotel map.** OpenStreetMap, no API key, with the nearest metro station.
- **Offline.** Browse and edit on a plane; changes sync on reconnect.

## Stack

Expo SDK 54 (dev client) · expo-router · TypeScript strict · TanStack Query ·
Zustand · MMKV · Supabase (Postgres + RLS + Auth + Storage) · react-native-svg.

> This is a **development build**; Expo Go can't run it (native modules).

## Setup

### 1. Backend

1. Create a Supabase project.
2. Apply the schema and reference data:
   ```bash
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push                       # supabase/migrations
   psql "<connection string>" -f supabase/seed/countries.sql \
                              -f supabase/seed/segment_types.sql \
                              -f supabase/seed/airports.sql
   ```
   (For local development, `npx supabase start` does both.)
3. **Lock it down.** In *Authentication → Providers → Email*, turn off
   **Allow new users to sign up**. Create each account under
   *Authentication → Users*, then whitelist those emails. The app shows
   nothing to anyone who isn't on this list:
   ```sql
   insert into private.allowed_emails (email) values ('you@example.com');
   ```

### 2. App

```bash
npm install
cp .env.example .env     # your project URL + anon key (Settings → API)
npm run typecheck && npm test
npx expo run:android     # dev build on a device or emulator
```

Before publishing a build, change `android.package` in `app.config.ts` to an id
you own. For EAS cloud builds, run `eas init` and set the two
`EXPO_PUBLIC_SUPABASE_*` values with `eas env:create`. The **Build Android
APK** workflow reads them from the repository's Actions secrets.

## Optional: flight status

Flight segments create a `travel_flight_watches` row. If you run your own worker
(with the service role) that polls a flight-data API and writes
`travel_flight_status` and `travel_alerts`, gate changes and delays will show
in the app. None is included.

## Scripts

| Command | What it does |
| :--- | :--- |
| `npm run gen:worldmap` | Regenerates the map paths from the bundled atlas |
| `npm run gen:countries` | Regenerates `supabase/seed/countries.sql` |
| `npm run gen:airports` | Regenerates `supabase/seed/airports.sql` (downloads [mwgg/Airports](https://github.com/mwgg/Airports), MIT) |
| `npm run gen:appicon` | Rebuilds launcher icons from `assets/Lead-Icon-Transparent.png` |
| `node scripts/import-tripit.mjs` | Turns a TripIt export into `travel_entries` SQL |

## Security

See [SECURITY.md](SECURITY.md) for how access is enforced and how to report a
vulnerability. `supabase/tests/rls.sql` checks the row-level security rules.

## Licence

[MIT](LICENSE). Bundled fonts (Albert Sans, Inter) are under the SIL Open Font
License; see `assets/fonts/`. Airport data is from mwgg/Airports (MIT).
