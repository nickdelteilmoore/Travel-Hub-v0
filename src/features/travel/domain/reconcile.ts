/* Travel Hub — turning segments into trips, days, gaps and presence.
 *
 * The SQL function reconcile_travel_entries() owns the *write* side; this module
 * owns the read side the stem timeline renders from, and the grouping rule that
 * app and any importer all agree on.
 *
 * The grouping rule, once, so nothing re-invents it: **a segment joins the
 * nearest trip whose span it falls inside or within GAP_DAYS of; otherwise it
 * starts a new one.** GAP_DAYS is 2. Ported from the web hub's
 * assets/travel/reconcile.js.
 */

import { addDays, daysBetween, instantToDay, toISO } from "./dates";

export const GAP_DAYS = 2;

/**
 * The loose segment shape these functions read. A superset of the columns the
 * timeline needs; the DB row (Tables<"travel_segments">) is assignable to it.
 * depart_city / arrive_city are not columns — suggestTitle uses them when a
 * caller supplies them and falls back to the place otherwise.
 */
export type ReconcileSegment = {
  id?: string;
  segment_type?: string;
  status?: string | null;
  needs_review?: boolean | null;
  depart_at?: string | null;
  arrive_at?: string | null;
  depart_tz?: string | null;
  arrive_tz?: string | null;
  depart_place?: string | null;
  arrive_place?: string | null;
  depart_city?: string | null;
  arrive_city?: string | null;
  depart_country_code?: string | null;
  arrive_country_code?: string | null;
};

export type TripLike = {
  id?: string;
  start_date?: string | null;
  end_date?: string | null;
};

export type DayGap = { from: string; to: string; hours: number; beforeSegmentId?: string };
export type TimelineDay<S> = { day: string; segments: S[]; gaps: DayGap[] };
export type Timeline<S> = { days: TimelineDay<S>[]; gaps: DayGap[] };

/** The day a segment starts and the day it ends, each in its own zone. */
export function segmentSpan(seg: ReconcileSegment): { from: string | null; to: string | null } {
  const from = instantToDay(seg.depart_at || seg.arrive_at, seg.depart_tz || seg.arrive_tz || "UTC");
  const to = instantToDay(seg.arrive_at || seg.depart_at, seg.arrive_tz || seg.depart_tz || "UTC");
  return { from, to: to && from && to < from ? from : to };
}

/** Sort key: when it happens, cancelled/hotel last within a day. */
export function bySchedule(a: ReconcileSegment, b: ReconcileSegment): number {
  const at = new Date(a.depart_at || a.arrive_at || 0).getTime();
  const bt = new Date(b.depart_at || b.arrive_at || 0).getTime();
  if (at !== bt) return at - bt;
  return (a.segment_type === "hotel" ? 1 : 0) - (b.segment_type === "hotel" ? 1 : 0);
}

/**
 * Which existing trip should this segment join?
 * @returns the trip, or null if it needs a new one.
 */
export function resolveTrip<T extends TripLike>(
  seg: ReconcileSegment,
  trips: T[] | null | undefined,
  gapDays = GAP_DAYS,
): T | null {
  const span = segmentSpan(seg);
  if (!span.from) return null;

  let best: T | null = null;
  let bestDistance = Infinity;
  for (const trip of trips || []) {
    if (!trip.start_date) continue;
    const start = toISO(trip.start_date);
    const end = toISO(trip.end_date || trip.start_date);
    if (!start || !end) continue;

    // Distance from the segment to the trip's span: 0 when it overlaps.
    const before = daysBetween(span.to || span.from, start) ?? 0; // >0 if seg ends before trip
    const after = daysBetween(end, span.from) ?? 0; // >0 if seg starts after trip
    const distance = Math.max(0, before, after);

    if (distance <= gapDays && distance < bestDistance) {
      best = trip;
      bestDistance = distance;
    }
  }
  return best;
}

type GroupedTrip = {
  start_date: string;
  end_date: string;
  closed: boolean;
  segments: ReconcileSegment[];
};

/**
 * Group loose segments into trips from scratch — the backfill's job, and the
 * "these look like one trip" suggestion on the add screen.
 */
export function groupIntoTrips(
  segments: ReconcileSegment[] | null | undefined,
  opts: { gapDays?: number; homeCountry?: string | null; maxTripDays?: number } = {},
): { start_date: string; end_date: string; segments: ReconcileSegment[] }[] {
  const gapDays = opts.gapDays ?? GAP_DAYS;
  const home = opts.homeCountry || null;
  const maxTripDays = opts.maxTripDays ?? 30;

  const sorted = (segments || []).slice().sort(bySchedule);
  const trips: GroupedTrip[] = [];

  for (const seg of sorted) {
    const span = segmentSpan(seg);
    if (!span.from) continue;
    const current = trips[trips.length - 1];
    const gap = current ? daysBetween(current.end_date, span.from) ?? Infinity : Infinity;

    const isReturnHome =
      !!home &&
      !!current &&
      !current.closed &&
      seg.arrive_country_code === home &&
      seg.depart_country_code !== home &&
      (daysBetween(current.start_date, span.from) ?? Infinity) <= maxTripDays;

    if (current && !current.closed && (gap <= gapDays || isReturnHome)) {
      current.segments.push(seg);
      const end = span.to || span.from;
      if (end > current.end_date) current.end_date = end;
      // Once you are back from abroad the trip is over: only a leg that arrives
      // home from elsewhere closes it — a domestic hop mid-trip does not.
      if (
        home &&
        seg.arrive_country_code === home &&
        seg.depart_country_code &&
        seg.depart_country_code !== home
      ) {
        current.closed = true;
      }
    } else {
      trips.push({
        start_date: span.from,
        end_date: span.to || span.from,
        closed: false,
        segments: [seg],
      });
    }
  }

  return trips.map(({ start_date, end_date, segments: segs }) => ({
    start_date,
    end_date,
    segments: segs,
  }));
}

/**
 * The trip's segments arranged as the stem draws them: one entry per calendar
 * day the trip touches, each carrying the segments that start on it, plus the
 * gaps between them. Lodging covers the time inside it, so a night in a hotel is
 * not a gap; six hours between landing and a hotel check-in is.
 */
export function timeline<S extends ReconcileSegment>(
  segments: S[] | null | undefined,
  opts: { gapHours?: number } = {},
): Timeline<S> {
  const gapHours = opts.gapHours || 6;
  const sorted = (segments || []).slice().sort(bySchedule);
  if (!sorted.length) return { days: [], gaps: [] };

  const gaps: DayGap[] = [];
  // Lodging holds you in place, so the "covered until" watermark is the latest
  // end seen so far rather than the previous segment's end.
  let coveredUntil: Date | null = null;
  for (const seg of sorted) {
    const startsAt = new Date(seg.depart_at || seg.arrive_at || 0);
    if (coveredUntil) {
      const hours = (startsAt.getTime() - coveredUntil.getTime()) / 3600000;
      if (hours >= gapHours) {
        gaps.push({
          from: coveredUntil.toISOString(),
          to: startsAt.toISOString(),
          hours: Math.round(hours * 10) / 10,
          beforeSegmentId: seg.id,
        });
      }
    }
    const endsAt = new Date(seg.arrive_at || seg.depart_at || 0);
    if (!coveredUntil || endsAt > coveredUntil) coveredUntil = endsAt;
  }

  const byDay = new Map<string, S[]>();
  for (const seg of sorted) {
    const day = instantToDay(seg.depart_at || seg.arrive_at, seg.depart_tz || seg.arrive_tz || "UTC");
    if (!day) continue;
    const bucket = byDay.get(day);
    if (bucket) bucket.push(seg);
    else byDay.set(day, [seg]);
  }

  const days = [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([day, segs]) => ({
      day,
      segments: segs,
      gaps: gaps.filter((g) => instantToDay(g.to, "UTC") === day),
    }));

  return { days, gaps };
}

/** Presence spans per country, from segments — the client mirror of the SQL. */
export function presenceSpans(
  segments: ReconcileSegment[] | null | undefined,
  opts: { homeCountry?: string } = {},
): { country_code: string; from: string; to: string }[] {
  const home = opts.homeCountry || "GB";
  const byCountry = new Map<string, { country_code: string; from: string; to: string }>();

  for (const seg of segments || []) {
    if (!seg || seg.status === "cancelled" || seg.needs_review) continue;
    const code = seg.arrive_country_code || seg.depart_country_code;
    if (!code || code === home) continue;
    const span = segmentSpan(seg);
    if (!span.from) continue;
    const to = span.to || span.from;

    const existing = byCountry.get(code);
    if (!existing) {
      byCountry.set(code, { country_code: code, from: span.from, to });
    } else {
      if (span.from < existing.from) existing.from = span.from;
      if (to > existing.to) existing.to = to;
    }
  }
  return [...byCountry.values()];
}

/** The trip's own span, from its segments. */
export function tripSpan(segments: ReconcileSegment[] | null | undefined): {
  start_date: string | null;
  end_date: string | null;
} {
  const spans = (segments || []).map(segmentSpan).filter((s): s is { from: string; to: string | null } => !!s.from);
  const first = spans[0];
  if (!first) return { start_date: null, end_date: null };
  return {
    start_date: spans.reduce<string>((a, s) => (s.from < a ? s.from : a), first.from),
    end_date: spans.reduce<string>((a, s) => {
      const end = s.to || s.from;
      return end > a ? end : a;
    }, first.to || first.from),
  };
}

/**
 * A trip title worth reading, when nobody typed one: "Barcelona", or
 * "Barcelona & Madrid". Built from where each leg arrives, with the first
 * departure (home) struck out.
 */
export function suggestTitle(segments: ReconcileSegment[] | null | undefined): string {
  const sorted = (segments || []).slice().sort(bySchedule);
  const first = sorted[0];
  if (!first) return "Trip";

  const short = (value: string | null | undefined): string =>
    value ? String(value).split(/[,(]/)[0]?.trim() ?? "" : "";
  const origin = short(first.depart_city || first.depart_place);

  const places: string[] = [];
  for (const seg of sorted) {
    const city = short(seg.arrive_city || seg.arrive_place);
    if (!city || city === origin || places.includes(city)) continue;
    places.push(city);
  }
  if (!places.length && origin) return origin;
  if (places.length === 0) return "Trip";
  if (places.length === 1) return places[0] as string;
  if (places.length === 2) return `${places[0]} & ${places[1]}`;
  return `${places[0]} & ${places.length - 1} more`;
}

/** Add days either side of a trip so nearby segments still resolve into it. */
export function tripWindow(
  trip: TripLike,
  gapDays = GAP_DAYS,
): { from: string | null; to: string | null } {
  return {
    from: addDays(toISO(trip.start_date), -gapDays),
    to: addDays(toISO(trip.end_date || trip.start_date), gapDays),
  };
}
