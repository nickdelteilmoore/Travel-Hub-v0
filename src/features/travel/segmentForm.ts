/* Travel Hub — composing a segment row from what a person typed.
 *
 * The add/edit form asks for a wall-clock ("10 Sep, 06:55 at LGW"); the database
 * stores an instant plus the zone to read it in. This pure module turns one into
 * the other and fills the zone, country and CO₂ from the airport table — the RN
 * counterpart of the web hub's saveSegment() field-prep (travel/app.js:1353).
 * Kept side-effect-free so it unit-tests, per hard rule 7; the mutation does the
 * trip resolution and the writes.
 */

import type { TablesInsert } from "@/lib/database.types";
import { fromLocal } from "./domain/timezone";
import { estimate } from "./domain/carbon";
import type { TravelAirportRow } from "./queries";

export type SegmentFormInput = {
  id?: string;
  trip_id?: string | null;
  segment_type: string;
  status?: string;
  title?: string;
  carrier?: string;
  number?: string;
  cabin?: string;
  seat?: string;
  booking_ref?: string;
  address?: string;
  phone?: string;
  url?: string;
  notes?: string;
  depart_iata?: string;
  depart_place?: string;
  arrive_iata?: string;
  arrive_place?: string;
  /** Local wall-clock the traveller typed. */
  depart_day: string;
  depart_time: string;
  arrive_day?: string;
  arrive_time?: string;
};

export type ComposedSegment = Omit<TablesInsert<"travel_segments">, "traveller_id">;

const clean = (v: string | undefined): string | null => {
  const t = (v ?? "").trim();
  return t ? t : null;
};

const upper = (v: string | undefined): string | null => {
  const t = clean(v);
  return t ? t.toUpperCase() : null;
};

/**
 * Build the travel_segments row from the form input. Zones, countries and
 * places come from the airport row when an IATA code is known — a hand-typed
 * zone is a hand-typed mistake — falling back to `homeTz` for the departure.
 * Distance/CO₂ are stored when both ends have coordinates, so a two-year-old
 * trip keeps the number that was true when it was taken.
 */
export function composeSegmentRow(
  input: SegmentFormInput,
  airports: Map<string, TravelAirportRow>,
  homeTz = "Europe/London",
): ComposedSegment {
  const departIata = upper(input.depart_iata);
  const arriveIata = upper(input.arrive_iata);
  const from = departIata ? airports.get(departIata) : undefined;
  const to = arriveIata ? airports.get(arriveIata) : undefined;

  const departTz = from?.tz || homeTz;
  const arriveTz = to?.tz || departTz;

  const departAt = fromLocal(input.depart_day, input.depart_time, departTz);
  const arriveAt =
    input.arrive_day && input.arrive_time ? fromLocal(input.arrive_day, input.arrive_time, arriveTz) : null;

  const row: ComposedSegment = {
    segment_type: input.segment_type,
    status: input.status || "confirmed",
    title: clean(input.title),
    carrier: clean(input.carrier),
    number: clean(input.number),
    cabin: clean(input.cabin),
    seat: clean(input.seat),
    booking_ref: clean(input.booking_ref),
    address: clean(input.address),
    phone: clean(input.phone),
    url: clean(input.url),
    notes: clean(input.notes),
    depart_at: departAt ? departAt.toISOString() : null,
    depart_tz: departTz,
    depart_iata: departIata,
    depart_place: clean(input.depart_place) || from?.city || from?.name || null,
    depart_country_code: from?.country_code ?? null,
    arrive_at: arriveAt ? arriveAt.toISOString() : null,
    arrive_tz: arriveTz,
    arrive_iata: arriveIata,
    arrive_place: clean(input.arrive_place) || to?.city || to?.name || null,
    arrive_country_code: to?.country_code ?? null,
    source: "manual",
  };

  if (input.trip_id) row.trip_id = input.trip_id;

  if (from && to && from.latitude != null && to.latitude != null) {
    const est = estimate({
      mode: input.segment_type,
      cabin: input.cabin,
      from: { lat: from.latitude, lon: from.longitude },
      to: { lat: to.latitude, lon: to.longitude },
    });
    if (est) {
      row.distance_km = est.km;
      row.co2_kg = est.kg;
    }
  }

  return row;
}
