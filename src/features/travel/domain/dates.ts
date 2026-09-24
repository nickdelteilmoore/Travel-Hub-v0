/* Travel Hub — date arithmetic, day-only.
 *
 * Everything in the Schengen calculation is a *calendar day*, never an instant:
 * the rule counts the day you land and the day you leave, and it does not care
 * what time the plane was. So the vocabulary here is 'YYYY-MM-DD' strings in
 * and out, with Date used only as a stepping mechanism — anchored at noon UTC
 * so that no daylight-saving transition can ever move a day by one.
 *
 * Ported verbatim from the web hub's assets/travel/dates.js: the
 * same day maths runs in the browser client and here, so a trip reads
 * identically in both. No imports, no globals, no DOM.
 */

const DAY_MS = 86400000;

/** 'YYYY-MM-DD' → a Date at noon UTC on that day. */
export function toDay(iso: string | Date | null | undefined): Date | null {
  if (!iso) return null;
  if (iso instanceof Date) return iso;
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d, 12));
}

/** A Date (or day) → 'YYYY-MM-DD'. */
export function toISO(day: string | Date | null | undefined): string | null {
  if (!day) return null;
  if (typeof day === "string") return day.slice(0, 10);
  return day.toISOString().slice(0, 10);
}

/** Whole days between two ISO days, b − a. Same day is 0. */
export function daysBetween(
  a: string | Date | null | undefined,
  b: string | Date | null | undefined,
): number | null {
  const x = toDay(a);
  const y = toDay(b);
  if (!x || !y) return null;
  return Math.round((y.getTime() - x.getTime()) / DAY_MS);
}

/** ISO day n days after `iso` (n may be negative). */
export function addDays(iso: string | Date | null | undefined, n: number): string | null {
  const d = toDay(iso);
  if (!d) return null;
  return toISO(new Date(d.getTime() + n * DAY_MS));
}

/** Today, in the given IANA zone rather than the machine's. */
export function todayISO(tz?: string): string {
  const now = new Date();
  if (!tz) {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate(),
    ).padStart(2, "0")}`;
  }
  // en-CA formats as YYYY-MM-DD, which is the one locale that gives us the
  // shape we want without reassembling parts by hand.
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now);
}

/** The calendar day an instant falls on, in a given zone. */
export function instantToDay(
  instant: string | Date | null | undefined,
  tz?: string,
): string | null {
  if (!instant) return null;
  const d = instant instanceof Date ? instant : new Date(instant);
  if (isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz || "UTC" }).format(d);
}

export type Span = { from: string; to?: string | null };

/**
 * Every ISO day in an inclusive span. An open-ended span (no `to`) is one day.
 * Guards against a reversed span rather than looping for ever on it.
 */
export function daysIn(
  from: string | Date | null | undefined,
  to: string | Date | null | undefined,
): string[] {
  const start = toDay(from);
  if (!start) return [];
  const end = toDay(to) || start;
  const startISO = toISO(start);
  if (!startISO) return [];
  if (end < start) return [startISO];
  const out: string[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
    const iso = toISO(new Date(t));
    if (iso) out.push(iso);
  }
  return out;
}

/** Merge overlapping/adjacent {from,to} spans into the fewest that cover them. */
export function mergeSpans(spans: Span[]): { from: string; to: string }[] {
  const clean = (spans || [])
    .filter((s): s is Span => !!s && !!s.from)
    .map((s) => ({ from: toISO(s.from) as string, to: (toISO(s.to || s.from) as string) }))
    .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));

  const out: { from: string; to: string }[] = [];
  for (const span of clean) {
    const last = out[out.length - 1];
    // Adjacent counts as overlapping: leaving on the 10th and arriving on the
    // 11th is one continuous presence, not two.
    const gap = last ? daysBetween(last.to, span.from) : null;
    if (last && gap !== null && gap <= 1) {
      if (span.to > last.to) last.to = span.to;
    } else {
      out.push({ ...span });
    }
  }
  return out;
}
