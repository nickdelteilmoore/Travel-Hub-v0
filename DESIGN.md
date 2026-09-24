# DESIGN.md — Travel Hub

The design system, data model and contracts for Travel Hub. Code comments cite
sections here; when the two disagree, fix one of them.

---

## 1. Principles

* **Tactile & organic.** Botanical forms and physical-stationery textures
  instead of generic digital "squircles": the asymmetric leaf corner (§4) is
  the signature shape.
* **Calm.** Generous breathing room, editorial type, warm earth tones, and
  zero-guilt microcopy.
* **Private by default.** Every row belongs to one traveller. The only thing a
  household shares is *where each person has been* (the Schengen count and
  map), so household members can check each other's days (§5.1).
* **Works on a plane.** Reads are cached and writes queue offline (§5.7).

---

## 2. Assets

| File | Use |
| :--- | :--- |
| `assets/Lead-Icon-Transparent.png` | The keyed leaf mark and the single source for the app icon. `npm run gen:appicon` derives `icon.png` (leaf on Cream Linen, opaque on purpose — a keyed legacy launcher icon renders on whatever the launcher puts behind it) and `icon-leaf-foreground.png` (for the Android adaptive icon, at 0.584 of its canvas because Android only guarantees the central 0.611 survives the mask). Never hand-edit either derived file. |
| `assets/fonts/` | Albert Sans and Inter, SIL Open Font License (licence texts alongside). |
| `assets/covers/` | Optional trip cover photos (§5.5). Ships empty. |

---

## 3. Tokens

All values live in `src/theme/tokens.ts`; components read them through
`useTheme()` / `useMiniAppPalette("travel")` and never hardcode a hex.

### Canvas & text
* **Light canvas:** Cream Linen `#F5F3ED` · card Surface White `#FFFFFF`
* **Dark canvas:** Deep Moss & Spruce (`#1C241B` base / `#161D15` background) · card `#243023`
* **Primary text:** Deep Charcoal `#1C2217` / Cream Linen `#F5F3ED`
* **Secondary text:** Muted Slate `#606859` / Soft Sage `#A2AA9A`

### Accents
* **Leaf Primary** `#55632E` (Botanical Olive) · **Terracotta** `#C87443` (CTA)
* **Amber warning** `#C08A2E` · **Terracotta danger** `#B3502F` · **Star gold** `#D9A441`

### Travel palette
| Surface (light) | Surface (dark) | Text | Accent |
| :--- | :--- | :--- | :--- |
| `#C8DCE0` Soft Slate | `#203236` Deep Slate | `#23464C` | `#23464C` Deep Slate |

Soft Slate is a pale grey-cyan chosen to sit *under* the world-map
choropleth without competing with it.

### Typography
Loaded via `@expo-google-fonts/*` in `app/_layout.tsx`. Two families:
* **Albert Sans** (SemiBold/Bold) for display and UI — hero 32pt, card titles
  18–24pt, list headings 16pt, tracked uppercase eyebrows 10pt.
* **Inter** (Regular/Medium/Bold) for body (14–15pt), captions (12–13pt), and
  numbers — always with `tabular-nums`, big stats 36–56pt.

---

## 4. Geometry & components

### The leaf corner
Every major card, list item, hero and modal uses the asymmetric leaf radius:
20px top-left, top-right and bottom-right, and a **sharp 0px bottom-left stem
point** (`leafRadii`, spread onto a style; `LeafCard` applies it).

### Filters
Text-only: unselected Inter Medium 14pt in Muted Slate with no background;
selected Inter Bold 14pt in the app's text colour with a 2px accent underline.
No chips, pills or boxes.

### Flag badges
Country flags sit inside a **36×36 white circle** in both schemes.

### Touch & motion
* Touch targets ≥ 48dp (use `hitSlop` rather than growing dense rows).
* Springs: damping 18–20, stiffness 150–180 (`motion.spring`).
* Pressable cards compress to `scale(0.98)`.
* Haptics: `selectionAsync()` for taps/copy; success notification for saves.

### Microcopy
Plain-spoken and warm; no guilt, no red banners for things not done. Toasts
confirm what happened ("Expense saved").

---

## 5. Travel Hub

### 5.1 The hub (`app/travel/index.tsx` → `TravelHome`)
* **Whose data** — the hub shows the signed-in traveller. `travel_entries`,
  `visited_countries` and `profiles` are household-readable, and `TravelHome`
  keeps the viewed traveller in state (`useProfiles()` lists members), so a
  switcher is a UI addition only. Trips, segments, documents and expenses are
  always the signed-in user's own.
* **World map** — an SVG choropleth (`react-native-svg`) filling visited
  countries in the Travel accent. Paths are generated offline by
  `npm run gen:worldmap` (Natural Earth projection of the 110m world atlas,
  keyed by ISO alpha-2) into `src/features/travel/worldMap.ts`.
* **Progress readout** — `44 / 197 countries (22%) · Schengen: 42 / 90 days`.
  197 is a fixed denominator (sovereign states).
* **Upcoming trips / Trip history** — `travel_trips`, split on end date.
* **Alerts** — an unread-count card linking to `app/travel/alerts.tsx`, shown
  only when a flight-status worker has written alerts (§5.6).

### 5.2 What counts as visited
`visitedCountrySet()` (`visited.ts`, pure, tested) is the union of two facts:
* non-transit `travel_entries` — a row flagged `transit` (a layover) stays in
  history but colours nothing in;
* standalone `visited_countries` rows — for countries visited before the log
  began.

### 5.3 Schengen 90/180
`schengen.ts` (pure, tested) computes days used in the rolling 180-day window
from `travel_entries`, **transit included** — over-counting is the safe
direction to err. Entry and exit days both count. A trip card's day figure is
that trip's days still *inside* the window (`daysCountedFor()`), so cards and
the headline always agree; aged-out or not-yet-started trips show none, and an
ongoing trip shows a *Still here* pill.

### 5.4 Trips, segments and reconcile
`travel_trips` are containers; `travel_segments` are the itinerary (flights,
trains, hotels… see `travel_segment_types`). The trip screen is a day-by-day
stem timeline with notes for unaccounted time; the segment screen shows local
times in each end's own zone.

One write path — `persistSegment()` in `mutations.ts`, over the pure
`composeSegmentRow()` — turns typed wall-clock times into instants using the
airport's zone, stores distance/CO₂, files the segment into a trip (or opens
one via `resolveTrip`), widens the trip, then calls
`reconcile_travel_entries(trip_id)`. That function rebuilds the
`travel_entries` rows the trip implies (tagged `notes = 'travel-hub:<trip>'`,
so it only ever replaces its own rows), which is what the map and Schengen
count read. The pure domain modules (`domain/reconcile.ts`, `timezone.ts`,
`dates.ts`, `carbon.ts`) are unit-tested; `timezone.ts` needs full ICU in
Hermes.

### 5.5 Covers
`resolveCoverImage()` (`cover.ts`) looks for a bundled photo keyed
`<cc>-<city-slug>` then `<cc>`; with none, a deterministic generated
"botanical postcard" SVG is drawn, so a trip is never blank. To add photos,
drop images you have the rights to in `assets/covers/` and register them in
the `COVERS` map.

### 5.6 Documents, flight status, alerts
* `travel_documents` open through short-lived signed URLs from the private
  `travel-docs` bucket and can be pinned.
* Flight segments show `travel_flight_status` and a pause/resume toggle on
  their `travel_flight_watches` row (created by a trigger for upcoming
  flights).
* **Status and alerts need a worker you run** — something with the service
  role that polls a flight-data API for due watches and writes
  `travel_flight_status` / `travel_alerts`. None is included; without one these
  sections simply stay empty.

### 5.7 Hotel map
Lodging segments get a Location block: a Leaflet map (WebView, OSM tiles, no
API key) with the hotel and nearest metro pinned. Coordinates come from the
segment (`raw` or a maps link in `url`, `resolveHotelCoords`) or a Nominatim
geocode; the nearest station is a best-effort Overpass query. Results are
cached for a week. All maths, URL parsing and the Leaflet document builder are
pure and tested in `hotelMap.test.ts`; embedded values are JSON-encoded with
`<` escaped, and Leaflet is pinned with subresource integrity. The map always
sits over the plain address, so every failure still leaves something useful.

### 5.8 Expenses
Per-trip expenses (`app/travel/expenses/[tripId].tsx`) with per-currency
totals. *Add expense* photographs a receipt and reads it with **on-device OCR
only** (ML Kit; `parseReceiptText` in `expenses.ts`) — receipt images and text
never leave the phone except to your own storage bucket. Unreadable fields come
back blank on an editable form; nothing is auto-saved. Photos live in the
private `receipts` bucket at `<uid>/<trip>/…`. Export is PDF (summary table plus
one annex page per receipt) or CSV, via the OS share sheet.

### 5.9 Offline
The query cache persists to MMKV. Trip, segment, entry and expense writes are
paused (whole, never half-applied) while offline and replayed on reconnect;
optimistic updates paint through the pure builders in `offline.ts` and roll
back on failure. Paused mutations persist too, so an edit made on a plane
survives a cold start. `OfflineBanner` shows the state and queue length.

---

## 6. Data model & security

The schema is `supabase/migrations/20260101000000_travel_schema.sql`;
reference data is in `supabase/seed/`.

* **Whitelist.** Every policy requires `is_household_member()`, which checks
  the JWT email against `private.allowed_emails`. Signing up does not grant
  access.
* **Ownership.** Personal tables are `traveller_id = auth.uid()`; inserts also
  check that any referenced trip/segment is the caller's own.
* **Household reads.** Only `profiles`, `travel_entries` and
  `visited_countries` are readable across members (§5.1).
* **Worker-owned.** `travel_alerts` (app may only set `read_at`) and
  `travel_flight_status` (read-only) are written by the service role.
* **anon** holds no table grants and cannot execute any function.
* **Storage.** Both buckets are private with size and MIME limits; objects are
  confined to the caller's `<uid>/` folder.
