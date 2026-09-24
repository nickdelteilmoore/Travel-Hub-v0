import {
  addDays,
  eachDayOfInterval,
  format,
  isAfter,
  isBefore,
  parseISO,
  subDays,
} from "date-fns";

// DESIGN.md — official EU 90/180 rolling rule. Pure, date-only maths
// (no timezones). Every calendar day from entry to exit counts inclusively.

export const WINDOW_DAYS = 180;
export const DAY_LIMIT = 90;

export type SchengenEntry = {
  entryDate: string; // yyyy-MM-dd
  exitDate: string | null; // null = ongoing → treated as today
  isSchengen: boolean;
};

export type SchengenStatusLevel = "safe" | "warning" | "danger";

export type SchengenStatus = {
  used: number;
  remaining: number;
  level: SchengenStatusLevel;
  /** Last compliant date if you enter today and stay continuously. */
  mustExitBy: Date | null;
  /** Earliest future date the rolling count drops (only when used > 0). */
  nextFreeUp: Date | null;
};

const keyOf = (d: Date): string => format(d, "yyyy-MM-dd");

// Inclusive presence-day keys for one entry. Rule 1 (entry & exit both
// count) + Rule 2 (null exit = today).
function entryDayKeys(entry: SchengenEntry, today: Date): string[] {
  const start = parseISO(entry.entryDate);
  const end = entry.exitDate ? parseISO(entry.exitDate) : today;
  if (isAfter(start, end)) return [];
  return eachDayOfInterval({ start, end }).map(keyOf);
}

/** Distinct Schengen presence-day keys across all of a traveler's entries. */
export function schengenPresenceKeys(
  entries: SchengenEntry[],
  today: Date,
): Set<string> {
  const set = new Set<string>();
  for (const entry of entries) {
    if (!entry.isSchengen) continue;
    for (const key of entryDayKeys(entry, today)) set.add(key);
  }
  return set;
}

function countInWindow(
  keys: Iterable<string>,
  windowStart: Date,
  windowEnd: Date,
): number {
  let n = 0;
  for (const key of keys) {
    const d = parseISO(key);
    if (!isBefore(d, windowStart) && !isAfter(d, windowEnd)) n += 1;
  }
  return n;
}

/** Rule 3 — days used on reference date D (default today). */
export function daysUsed(entries: SchengenEntry[], reference: Date): number {
  const keys = schengenPresenceKeys(entries, reference);
  const windowStart = subDays(reference, WINDOW_DAYS - 1);
  return countInWindow(keys, windowStart, reference);
}

/**
 * How many of a single trip's days currently count against the rolling window.
 * This — not the trip's raw length — is what a trip should display, so a stay
 * that has aged out of the 180 days reads as the nothing it now contributes.
 * Overlapping trips are deduplicated in the total but not here, where each
 * card answers only for itself.
 */
export function daysCountedFor(entry: SchengenEntry, today: Date): number {
  if (!entry.isSchengen) return 0;
  const windowStart = subDays(today, WINDOW_DAYS - 1);
  return countInWindow(entryDayKeys(entry, today), windowStart, today);
}

export function levelFor(used: number): SchengenStatusLevel {
  if (used >= DAY_LIMIT) return "danger";
  if (used >= 75) return "warning";
  return "safe";
}

// Rule 5 — walk forward, adding each day as presence, until >90.
function mustExitBy(entries: SchengenEntry[], today: Date): Date | null {
  const historical = schengenPresenceKeys(entries, today);
  let lastCompliant: Date | null = null;
  // A continuous stay can never legally exceed 90 days, so this bound is ample.
  for (let i = 0; i <= WINDOW_DAYS; i += 1) {
    const cand = addDays(today, i);
    const projected = new Set(historical);
    for (const key of eachDayOfInterval({ start: today, end: cand })) {
      projected.add(keyOf(key));
    }
    const used = countInWindow(projected, subDays(cand, WINDOW_DAYS - 1), cand);
    if (used <= DAY_LIMIT) {
      lastCompliant = cand;
    } else {
      break;
    }
  }
  return lastCompliant;
}

// Rule 6 — day after the oldest in-window presence day leaves the window.
function nextFreeUp(
  keys: Set<string>,
  today: Date,
  used: number,
): Date | null {
  if (used === 0) return null;
  const windowStart = subDays(today, WINDOW_DAYS - 1);
  let oldest: Date | null = null;
  for (const key of keys) {
    const d = parseISO(key);
    if (isBefore(d, windowStart) || isAfter(d, today)) continue;
    if (!oldest || isBefore(d, oldest)) oldest = d;
  }
  return oldest ? addDays(oldest, WINDOW_DAYS) : null;
}

/** Full readout for the Travel screen. */
export function computeSchengenStatus(
  entries: SchengenEntry[],
  today: Date,
): SchengenStatus {
  const keys = schengenPresenceKeys(entries, today);
  const windowStart = subDays(today, WINDOW_DAYS - 1);
  const used = countInWindow(keys, windowStart, today);
  const remaining = Math.max(0, DAY_LIMIT - used);
  return {
    used,
    remaining,
    level: levelFor(used),
    mustExitBy: mustExitBy(entries, today),
    nextFreeUp: nextFreeUp(keys, today, used),
  };
}
