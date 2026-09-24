/* Travel Hub — pure segment/trip presentation helpers.
 *
 * The screen-facing counterparts of the web hub's typeOf()/statusOf()/spanLabel
 * (travel/app.js). Kept free of React Native so they unit-test in isolation and
 * the timeline components stay thin. Colour is expressed as a semantic `tone`
 * the components resolve against the theme — never a hex here (hard rule 2).
 */

import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { enGB } from "date-fns/locale";

import type { Tables } from "@/lib/database.types";
import { daysBetween, instantToDay } from "./domain/dates";
import { duration } from "./domain/timezone";

export type TravelTrip = Tables<"travel_trips">;
export type TravelSegment = Tables<"travel_segments">;
export type SegmentTypeRow = Tables<"travel_segment_types">;
export type FlightStatus = Tables<"travel_flight_status">;
export type TravelAirport = Tables<"travel_airports">;

/** A status tone the components map to a theme colour. */
export type StatusTone = "ontime" | "delayed" | "alert" | "cancelled" | "stale" | "info";
export type SegmentStatus = { tone: StatusTone; label: string };

/** Which broad silhouette a type draws as — used to tint and pick a glyph. */
export type SegmentShape = "move" | "stay" | "other";

const FALLBACK_TYPE = (code: string): SegmentTypeRow => ({
  code,
  label: code,
  leaf: "generic",
  is_extractable: false,
  is_lodging: false,
  is_transport: false,
  position: 100,
});

/** Resolve a segment type against the loaded travel_segment_types rows. */
export function typeOf(code: string, types: Map<string, SegmentTypeRow>): SegmentTypeRow {
  return types.get(code) ?? FALLBACK_TYPE(code);
}

export function shapeOf(type: SegmentTypeRow): SegmentShape {
  if (type.is_lodging) return "stay";
  if (type.is_transport) return "move";
  return "other";
}

/**
 * The status line for a segment, folding in live flight status when present.
 * Mirrors travel/app.js:481 exactly, but returns a semantic tone.
 */
export function statusOf(seg: TravelSegment, live: FlightStatus | null | undefined): SegmentStatus {
  if (seg.status === "cancelled" || live?.flight_status === "cancelled") {
    return { tone: "cancelled", label: "Cancelled" };
  }
  if (live?.flight_status === "diverted") return { tone: "alert", label: "Diverted" };
  if (live?.flight_status === "landed") return { tone: "ontime", label: "Landed" };

  const delay = Math.max(live?.depart_delay_min || 0, live?.arrive_delay_min || 0);
  if (delay >= 60) return { tone: "alert", label: `Delayed ${Math.floor(delay / 60)}h ${delay % 60}m` };
  if (delay >= 15) return { tone: "delayed", label: `Delayed ${delay}m` };

  if (seg.status === "changed") return { tone: "delayed", label: "Changed" };
  if (seg.status === "pending") return { tone: "stale", label: "Unconfirmed" };
  if (live?.depart_gate) return { tone: "info", label: `Gate ${live.depart_gate}` };
  if (live) return { tone: "ontime", label: "On time" };
  return { tone: "ontime", label: "Confirmed" };
}

/** The title a segment shows: its own, else operator+number, else the type. */
export function segmentTitle(seg: TravelSegment, type: SegmentTypeRow): string {
  return (
    seg.title ||
    [seg.carrier, seg.number].filter(Boolean).join(" ") ||
    type.label
  );
}

/** "3 nights", "2h 10m", or "". */
export function spanLabel(seg: TravelSegment, type: SegmentTypeRow): string {
  if (type.is_lodging && seg.depart_at && seg.arrive_at) {
    const nights = daysBetween(
      instantToDay(seg.depart_at, seg.depart_tz || undefined),
      instantToDay(seg.arrive_at, seg.arrive_tz || seg.depart_tz || undefined),
    );
    if (nights == null) return "";
    return nights > 0 ? `${nights} night${nights === 1 ? "" : "s"}` : "Same day";
  }
  return duration(seg.depart_at, seg.arrive_at);
}

/** "12–23 Jul", "19 Aug–5 Sep", or "3 Jul" for a single-day trip. en-GB. */
export function tripRange(startIso: string | null, endIso: string | null): string {
  if (!startIso) return "Dates TBC";
  const start = parseISO(startIso);
  const d = (date: Date, withMonth: boolean) => format(date, withMonth ? "d MMM" : "d", { locale: enGB });
  if (!endIso || endIso === startIso) return d(start, true);
  const end = parseISO(endIso);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  return sameMonth ? `${d(start, false)}–${d(end, true)}` : `${d(start, true)}–${d(end, true)}`;
}

/**
 * The right-hand count on a trip row: days to go, Today, Ongoing, or Been.
 * Mirrors the web home screen's tripBlock/recentRow logic.
 */
export type TripCountdown = { kind: "days"; days: number } | { kind: "today" | "ongoing" | "been" };

export function tripCountdown(trip: TravelTrip, today: Date): TripCountdown {
  if (!trip.start_date) return { kind: "been" };
  const days = differenceInCalendarDays(parseISO(trip.start_date), today);
  if (days > 0) return { kind: "days", days };
  if (days === 0) return { kind: "today" };
  const end = trip.end_date || trip.start_date;
  const ended = differenceInCalendarDays(parseISO(end), today) < 0;
  return ended ? { kind: "been" } : { kind: "ongoing" };
}
