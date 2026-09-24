/* Travel Hub — instants in, local wall clocks out.
 *
 * Every time in the database is a timestamptz — the actual moment — carried
 * alongside the IANA zone it should be *read* in. This module is the only place
 * that turns one into the other, so there is exactly one answer to "what does
 * 06:55 UTC say on a Heathrow departure board".
 *
 * The thing this is really for is the day-shift marker. A 22:40 out of JFK
 * arriving 10:25 at LHR is the next morning, and a timeline that prints
 * "22:40 → 10:25" without saying so is lying by omission.
 *
 * Uses Intl.DateTimeFormat with a timeZone, which is core in every browser and
 * in Hermes when built with full ICU. Ported from the web hub's
 * assets/travel/timezone.js.
 */

import { instantToDay, daysBetween } from "./dates";

type Instant = string | number | Date | null | undefined;

const cache = new Map<string, Intl.DateTimeFormat>();

function fmt(tz: string | null | undefined, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = (tz || "UTC") + JSON.stringify(options);
  let f = cache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", { timeZone: tz || "UTC", ...options });
    cache.set(key, f);
  }
  return f;
}

function toDate(instant: Instant): Date | null {
  if (instant == null || instant === "") return null;
  const d = instant instanceof Date ? instant : new Date(instant);
  return isNaN(d.getTime()) ? null : d;
}

/** '06:55' in the given zone. 24-hour, because departure boards are. */
export function localTime(instant: Instant, tz?: string | null): string {
  const d = toDate(instant);
  if (!d) return "";
  return fmt(tz, { hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

/** 'Thu 10 Sep' in the given zone. */
export function localDate(
  instant: Instant,
  tz?: string | null,
  opts: { weekday?: boolean; year?: boolean } = {},
): string {
  const d = toDate(instant);
  if (!d) return "";
  return fmt(tz, {
    weekday: opts.weekday === false ? undefined : "short",
    day: "numeric",
    month: "short",
    year: opts.year ? "numeric" : undefined,
  }).format(d);
}

/** 'GMT+2' / 'BST' — the short zone name, for the segment detail. */
export function zoneLabel(instant: Instant, tz?: string | null): string {
  if (!tz) return "";
  const d = toDate(instant) ?? new Date();
  const parts = fmt(tz, { timeZoneName: "short" }).formatToParts(d);
  const found = parts.find((p) => p.type === "timeZoneName");
  return found ? found.value : "";
}

/** Offset from UTC in minutes for a zone at a given instant. */
export function offsetMinutes(instant: Instant, tz?: string | null): number {
  const d = toDate(instant) ?? new Date();
  const parts = fmt(tz, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((asUTC - d.getTime()) / 60000);
}

/**
 * How many calendar days the journey crosses, in the arrival's own zone.
 * 0 = same day, +1 = lands tomorrow, −1 = lands yesterday (eastbound Pacific).
 */
export function dayShift(
  departAt: Instant,
  departTz: string | null | undefined,
  arriveAt: Instant,
  arriveTz: string | null | undefined,
): number {
  if (!departAt || !arriveAt) return 0;
  const a = instantToDay(departAt as string | Date, departTz || "UTC");
  const b = instantToDay(arriveAt as string | Date, arriveTz || departTz || "UTC");
  return daysBetween(a, b) || 0;
}

/** '2h 10m'. Null-safe, and never negative. */
export function duration(fromInstant: Instant, toInstant: Instant): string {
  const from = toDate(fromInstant);
  const to = toDate(toInstant);
  if (!from || !to) return "";
  const ms = to.getTime() - from.getTime();
  if (!(ms > 0)) return "";
  const mins = Math.round(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Build the timestamptz for a wall-clock the traveller typed. The manual-add
 * form asks for "10 Sep, 06:55 at LHR", and this is what turns that into the
 * instant the rest of the app stores.
 *
 * Solved by iteration rather than algebra because a zone's offset depends on
 * the very instant we are computing: guess with the offset at the naive time,
 * then correct once. Two passes settles every case including DST boundaries.
 */
export function fromLocal(
  dayISO: string | null | undefined,
  timeHHMM: string | null | undefined,
  tz?: string | null,
): Date | null {
  if (!dayISO || !timeHHMM) return null;
  const [y, mo, d] = dayISO.slice(0, 10).split("-").map(Number);
  const [h, mi] = timeHHMM.split(":").map(Number);
  if ([y, mo, d, h, mi].some((n) => n === undefined || Number.isNaN(n))) return null;

  const naive = Date.UTC(y as number, (mo as number) - 1, d as number, h as number, mi as number);
  let guess = new Date(naive - offsetMinutes(naive, tz) * 60000);
  guess = new Date(naive - offsetMinutes(guess, tz) * 60000);
  return guess;
}
