// Turns a TripIt account export (Settings → Export account data → JSON) into
// travel_entries rows. TripIt records bookings, not presence, so we rebuild a
// timeline of dated country observations per trip and collapse consecutive
// runs: entry = arrival date, exit = departure date (both inclusive, matching
// the Schengen maths in src/features/travel/schengen.ts).
//
//   node scripts/import-tripit.mjs <export.json> --traveler <uuid> \
//     [--home GB] [--until 2026-07-24] [--out supabase/seed/travel_import.sql]
//
// Emits idempotent SQL: each insert is guarded so it is skipped when the same
// stay is already recorded, or when an existing stay elsewhere contradicts it
// (a booking that was never taken). Re-running is a no-op.
//
// Country resolution is deliberately layered because TripIt's own data is
// uneven: flights carry ISO codes, hotels carry a postal address, and rail
// carries neither — only a station name and a timezone that is regularly
// geocoded to the wrong continent ("Bath Spa" → America/New_York). Each
// observation therefore records how it was resolved, and weaker readings lose
// to stronger ones when they disagree.
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const worldCountries = require("world-countries/countries.json");

// ---------------------------------------------------------------- arguments

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const isFlagValue = (a) => {
  const i = args.indexOf(a);
  return i > 0 && args[i - 1].startsWith("--");
};
const inputPath = args.find((a) => !a.startsWith("--") && !isFlagValue(a));
const travelerId = flag("traveler");
const homeCountry = (flag("home", "GB") ?? "GB").toUpperCase();
const until = flag("until"); // ignore stays that start after this date
const outPath = flag("out");
// Trips that were booked but never taken (TripIt keeps cancelled bookings):
// --exclude "Some Trip 2020" --exclude "Another Cancelled Trip"
const excluded = new Set(
  args.flatMap((a, i) => (a === "--exclude" ? [args[i + 1]] : [])),
);

if (!inputPath || !travelerId) {
  console.error(
    "usage: node scripts/import-tripit.mjs <export.json> --traveler <uuid> [--home GB] [--until YYYY-MM-DD] [--out file.sql]",
  );
  process.exit(1);
}

// ------------------------------------------------------- country resolution

// How a country was determined, strongest first. Used to settle disagreements.
const FROM_ISO = 3; // flight segment's ISO country code
const FROM_ADDRESS = 2; // country name written in a postal address
const FROM_STATION = 1; // station name, resolved by majority vote (below)
const FROM_ZONE = 0; // bare IANA timezone — TripIt's least reliable field

const regionOf = new Map();
const codeByName = new Map();
const addName = (name, code) => {
  if (typeof name === "string" && name.length > 3) {
    codeByName.set(name.toLowerCase(), code);
  }
};
for (const c of worldCountries) {
  const code = c.cca2?.toUpperCase();
  if (!code) continue;
  regionOf.set(code, c.region || "");
  addName(c.name.common, code);
  addName(c.name.official, code);
  for (const alt of c.altSpellings ?? []) addName(alt, code);
  for (const t of Object.values(c.translations ?? {})) {
    addName(t.common, code);
    addName(t.official, code);
  }
}
// Postal spellings the dataset doesn't carry.
for (const [name, code] of [
  ["usa", "US"], ["u.s.a.", "US"], ["u.s.a", "US"], ["united states of america", "US"],
  ["england", "GB"], ["scotland", "GB"], ["wales", "GB"], ["northern ireland", "GB"],
  ["great britain", "GB"], ["holland", "NL"], ["czech republic", "CZ"],
  ["ivory coast", "CI"], ["burma", "MM"], ["russia", "RU"], ["south korea", "KR"],
  ["republic of ireland", "IE"], ["cape verde", "CV"],
]) codeByName.set(name, code);

// IANA zone → country, for the legs TripIt stores without an ISO code. An
// unknown zone is reported at the end of the run rather than guessed.
const countryByZone = new Map(Object.entries({
  "Europe/London": "GB", "Europe/Dublin": "IE", "Europe/Paris": "FR",
  "Europe/Brussels": "BE", "Europe/Amsterdam": "NL", "Europe/Berlin": "DE",
  "Europe/Vienna": "AT", "Europe/Zurich": "CH", "Europe/Madrid": "ES",
  "Europe/Lisbon": "PT", "Europe/Rome": "IT", "Europe/Stockholm": "SE",
  "Europe/Warsaw": "PL", "Europe/Budapest": "HU", "Europe/Belgrade": "RS",
  "Europe/Moscow": "RU", "Europe/Istanbul": "TR", "Atlantic/Reykjavik": "IS",
  "Atlantic/Cape_Verde": "CV", "Africa/Casablanca": "MA", "Africa/Abidjan": "CI",
  "Africa/Nairobi": "KE", "Africa/Kampala": "UG", "Africa/Johannesburg": "ZA",
  "Asia/Dubai": "AE", "Asia/Qatar": "QA", "Asia/Baku": "AZ", "Asia/Kolkata": "IN",
  "Asia/Colombo": "LK", "Asia/Bangkok": "TH", "Asia/Yangon": "MM",
  "Asia/Manila": "PH", "Asia/Tokyo": "JP", "America/New_York": "US",
  "America/Chicago": "US", "America/Los_Angeles": "US", "America/Mexico_City": "MX",
  "America/Monterrey": "MX", "America/Jamaica": "JM", "America/Santo_Domingo": "DO",
  "America/Sao_Paulo": "BR", "America/Campo_Grande": "BR",
  "America/Argentina/Cordoba": "AR",
}));

// Stations TripIt only ever geocodes wrongly, so majority vote can't save them.
const STATION_OVERRIDES = new Map([["geneva", "CH"]]);

const unknownZones = new Set();

function countryFromZone(dateTime) {
  const zone = dateTime?.timezone;
  if (!zone || zone === "UTC") return null;
  const hit = countryByZone.get(zone);
  if (!hit) unknownZones.add(zone);
  return hit ?? null;
}

function countryFromAddress(address) {
  if (typeof address !== "string") return null;
  const parts = address
    .split(/[,\n\r]/)
    .map((p) => p.replace(/[\d\t]/g, " ").trim())
    .filter(Boolean);
  // The country, when written at all, is last — so read from the end.
  for (const part of parts.slice(-2).reverse()) {
    const hit = codeByName.get(part.toLowerCase());
    if (hit) return hit;
  }
  return null;
}

const addressOf = (value) =>
  typeof value === "string" ? value : (value?.address ?? null);

const asArray = (value) =>
  value == null ? [] : Array.isArray(value) ? value : [value];

const segmentsOf = (obj) =>
  asArray(obj.Segment).filter((s) => s && Object.keys(s).length > 0);

// ------------------------------------------------- station name → country

/**
 * A station's timezone is wrong often enough to matter, but wrong
 * inconsistently: "Bath Spa" is Europe/London 54 times and America/New_York
 * 10. Pooling every sighting of a name across the export and taking the
 * majority recovers the right country.
 */
function buildStationIndex(trips) {
  const votes = new Map();
  for (const trip of trips) {
    for (const obj of asArray(trip.Objects)) {
      for (const seg of segmentsOf(obj)) {
        if (seg.start_country_code || seg.end_country_code) continue;
        for (const [address, name, dateTime] of [
          [seg.StartStationAddress ?? seg.StartLocationAddress, seg.start_station_name, seg.StartDateTime],
          [seg.EndStationAddress ?? seg.EndLocationAddress, seg.end_station_name, seg.EndDateTime],
        ]) {
          const station = (addressOf(address) ?? name)?.trim().toLowerCase();
          const country = countryFromAddress(addressOf(address)) ?? countryFromZone(dateTime);
          if (!station || !country) continue;
          const tally = votes.get(station) ?? new Map();
          tally.set(country, (tally.get(country) ?? 0) + 1);
          votes.set(station, tally);
        }
      }
    }
  }
  const index = new Map(STATION_OVERRIDES);
  for (const [station, tally] of votes) {
    if (index.has(station)) continue;
    const [winner] = [...tally.entries()].sort((a, b) => b[1] - a[1]);
    index.set(station, winner[0]);
  }
  return index;
}

// ------------------------------------------------------------- observations

/** One dated sighting of the traveller in a country. */
const observation = (dateTime, country, source) =>
  dateTime?.date && country
    ? { date: dateTime.date, time: dateTime.time ?? "00:00:00", country, source }
    : null;

function segmentEnds(seg, stations) {
  return [
    {
      dateTime: seg.StartDateTime,
      iso: seg.start_country_code,
      address: addressOf(seg.StartStationAddress ?? seg.StartLocationAddress),
      name: seg.start_station_name,
    },
    {
      dateTime: seg.EndDateTime,
      iso: seg.end_country_code,
      address: addressOf(seg.EndStationAddress ?? seg.EndLocationAddress),
      name: seg.end_station_name,
    },
  ].map((end) => {
    const station = (end.address ?? end.name)?.trim().toLowerCase();
    if (end.iso) return { ...end, country: end.iso.toUpperCase(), source: FROM_ISO };
    const fromAddress = countryFromAddress(end.address);
    if (fromAddress) return { ...end, country: fromAddress, source: FROM_ADDRESS };
    const fromStation = station ? stations.get(station) : null;
    if (fromStation) return { ...end, country: fromStation, source: FROM_STATION };
    return { ...end, country: countryFromZone(end.dateTime), source: FROM_ZONE };
  });
}

function observationsFor(trip, stations) {
  const segmentPairs = [];
  const list = [];
  for (const obj of asArray(trip.Objects)) {
    const segments = segmentsOf(obj);
    for (const seg of segments) {
      const ends = segmentEnds(seg, stations);
      for (const end of ends) {
        end.observation = observation(end.dateTime, end.country, end.source);
        list.push(end.observation);
      }
      segmentPairs.push(ends);
    }
    if (segments.length > 0) continue;

    // Hotels, activities, restaurants: one place, held for the whole booking.
    const start = obj.StartDateTime ?? obj.DateTime;
    const end = obj.EndDateTime ?? start;
    const address = countryFromAddress(addressOf(obj.Address));
    const country = address ?? countryFromZone(start ?? end);
    const source = address ? FROM_ADDRESS : FROM_ZONE;
    list.push(observation(start, country, source), observation(end, country, source));
  }

  // No train or bus crosses continents: when a segment's two ends land in
  // different world regions, one is a bad geocode. The trip as a whole knows
  // which — take the country its other bookings corroborate best.
  const support = new Map();
  for (const obs of list.filter(Boolean)) {
    support.set(obs.country, (support.get(obs.country) ?? 0) + obs.source + 1);
  }
  for (const [from, to] of segmentPairs) {
    if (from.iso || to.iso || !from.country || !to.country) continue;
    if (regionOf.get(from.country) === regionOf.get(to.country)) continue;
    const better =
      (support.get(from.country) ?? 0) >= (support.get(to.country) ?? 0) ? from : to;
    for (const end of [from, to]) {
      if (end.observation) end.observation.country = better.country;
    }
  }

  const observations = list
    .filter(Boolean)
    .sort((a, b) =>
      a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date),
    );

  // Nobody is in two countries on one day: a timezone-only reading loses to a
  // better-sourced one that covers the same date (TripIt files some hotels
  // with nothing but a mis-geocoded zone).
  return observations.filter(
    (obs) =>
      obs.source > FROM_ZONE ||
      !observations.some(
        (other) =>
          other.date === obs.date && other.country !== obs.country && other.source > obs.source,
      ),
  );
}

/** Consecutive same-country observations = one continuous stay. */
function staysFor(trip, stations) {
  const stays = [];
  for (const obs of observationsFor(trip, stations)) {
    const current = stays[stays.length - 1];
    if (current && current.country === obs.country) {
      if (obs.date > current.exit) current.exit = obs.date;
      continue;
    }
    stays.push({
      country: obs.country,
      entry: obs.date,
      exit: obs.date,
      trip: trip.TripData?.display_name ?? null,
    });
  }
  return stays;
}

// ------------------------------------------------------------------- import

const data = JSON.parse(readFileSync(inputPath, "utf8"));
const trips = asArray(data.Trips);
const stations = buildStationIndex(trips);

let stays = trips
  .filter((trip) => !excluded.has(trip.TripData?.display_name))
  .flatMap((trip) => staysFor(trip, stations));

stays = stays
  .filter((s) => s.country !== homeCountry)
  .filter((s) => !until || s.entry <= until)
  .map((s) => (until && s.exit > until ? { ...s, exit: until } : s))
  .sort((a, b) => (a.entry === b.entry ? a.exit.localeCompare(b.exit) : a.entry.localeCompare(b.entry)));

// Trips overlap (a rebooked flight, a stopover filed twice) — fold stays in the
// same country that touch or overlap into one.
const nextDay = (date) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};
const merged = [];
for (const stay of stays) {
  const prior = merged.find(
    (m) => m.country === stay.country && stay.entry <= nextDay(m.exit) && stay.exit >= m.entry,
  );
  if (!prior) {
    merged.push({ ...stay });
    continue;
  }
  if (stay.exit > prior.exit) prior.exit = stay.exit;
  if (stay.trip && prior.trip && !prior.trip.includes(stay.trip)) {
    prior.trip = `${prior.trip} · ${stay.trip}`;
  }
}
merged.sort((a, b) => a.entry.localeCompare(b.entry));

// Two countries at once means one of the bookings was never taken. The export
// can't tell which, so report them for a human rather than guessing.
const contradictions = [];
for (const [i, a] of merged.entries()) {
  for (const b of merged.slice(i + 1)) {
    if (b.entry >= a.exit) continue; // touching on a travel day is normal
    if (a.country !== b.country) contradictions.push([a, b]);
  }
}

const esc = (s) => s.replace(/'/g, "''");
const values = merged
  .map(
    (e) =>
      `  ('${e.country}', date '${e.entry}', date '${e.exit}', ${e.trip ? `'${esc(e.trip.slice(0, 120))}'` : "null"})`,
  )
  .join(",\n");

const sql = `insert into public.travel_entries (traveler_id, country_code, entry_date, exit_date, notes)
select '${travelerId}', s.country_code, s.entry_date, s.exit_date, s.notes
from (values
${values}
) as s (country_code, entry_date, exit_date, notes)
where not exists (
  -- skip stays already recorded, and stays contradicted by a recorded stay
  -- somewhere else over the same dates (a booking that was never taken)
  select 1 from public.travel_entries t
  where t.traveler_id = '${travelerId}'
    and case when t.country_code = s.country_code
      then t.entry_date <= s.exit_date and coalesce(t.exit_date, t.entry_date) >= s.entry_date
      else t.entry_date < s.exit_date and coalesce(t.exit_date, t.entry_date) > s.entry_date
    end
);`;

const countries = new Set(merged.map((e) => e.country));
const header = `-- Generated by scripts/import-tripit.mjs from a TripIt export.
-- ${merged.length} stays across ${countries.size} countries (home ${homeCountry} excluded).

`;

if (outPath) {
  writeFileSync(outPath, `${header}${sql}\n`);
  console.error(`Wrote ${merged.length} stays across ${countries.size} countries to ${outPath}`);
} else {
  process.stdout.write(`${header}${sql}\n`);
}

for (const [a, b] of contradictions) {
  console.error(
    `Overlapping stays — one booking was probably cancelled: ${a.country} ${a.entry}→${a.exit} (${a.trip}) vs ${b.country} ${b.entry}→${b.exit} (${b.trip})`,
  );
}
if (unknownZones.size > 0) {
  console.error(`Unmapped timezones (observations dropped): ${[...unknownZones].join(", ")}`);
}
