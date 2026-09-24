/* Travel Hub — pure optimistic-cache helpers for offline editing.
 *
 * When the device is offline a write can't reach Supabase, so React Query
 * *pauses* the mutation and replays it on reconnect (see `mutations.ts` +
 * `lib/connectivity.ts`). For the edit to *show* in the meantime, the mutation's
 * onMutate patches the query cache — which is persisted to MMKV, so an offline
 * add survives a cold start mid-flight. Everything that shapes those cache
 * writes lives here, side-effect-free, so it unit-tests without React Native
 * (hard rule 7). The mutations only glue these to the query client.
 */

import type { TablesInsert } from "@/lib/database.types";
import { composeSegmentRow, type SegmentFormInput } from "./segmentForm";
import type {
  Country,
  TravelAirportRow,
  TravelEntry,
  TravelSegmentRow,
  TripExpenseRow,
} from "./queries";

const OFFLINE_PREFIX = "offline-";

/** A client-only id for a row created offline, before the server assigns one.
 * Distinguishable from a real UUID so a re-edit before sync can be reasoned
 * about, and swept away wholesale when the resumed mutation refetches. */
export function tempId(kind: string): string {
  return `${OFFLINE_PREFIX}${kind}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/** Whether an id was minted offline (never round-tripped through the server). */
export function isTempId(id: string): boolean {
  return id.startsWith(OFFLINE_PREFIX);
}

type HasId = { id: string };

/**
 * Insert `row` into `list`, replacing any existing row with the same id. A
 * comparator keeps the list in the same order the query returns it in; without
 * one a replaced row keeps its place and a new row goes to the front.
 */
export function upsertById<T extends HasId>(
  list: readonly T[],
  row: T,
  compare?: (a: T, b: T) => number,
): T[] {
  const idx = list.findIndex((r) => r.id === row.id);
  if (idx >= 0) {
    const next = list.slice();
    next[idx] = row;
    return compare ? next.sort(compare) : next;
  }
  const next = [row, ...list];
  return compare ? next.sort(compare) : next;
}

export function removeById<T extends HasId>(list: readonly T[], id: string): T[] {
  return list.filter((r) => r.id !== id);
}

// ── Ordering comparators, matching each list query's ORDER BY ────────────────

/** `useTravelEntries`: entry_date descending. */
export function byEntryDateDesc(a: TravelEntry, b: TravelEntry): number {
  return b.entry_date.localeCompare(a.entry_date);
}

/** `useTripExpenses`: spent_on desc (nulls last), then created_at desc. */
export function byExpenseRecencyDesc(a: TripExpenseRow, b: TripExpenseRow): number {
  if (a.spent_on !== b.spent_on) {
    if (!a.spent_on) return 1;
    if (!b.spent_on) return -1;
    return b.spent_on.localeCompare(a.spent_on);
  }
  return b.created_at.localeCompare(a.created_at);
}

/** `useTripSegments`: depart_at ascending (nulls last). */
export function bySegmentDepartAsc(a: TravelSegmentRow, b: TravelSegmentRow): number {
  if (a.depart_at === b.depart_at) return 0;
  if (!a.depart_at) return 1;
  if (!b.depart_at) return -1;
  return a.depart_at.localeCompare(b.depart_at);
}

// ── Optimistic row builders ──────────────────────────────────────────────────

export type OptimisticEntryInput = {
  id?: string;
  traveler_id: string;
  country_code: string;
  entry_date: string;
  exit_date: string | null;
  notes: string | null;
};

/** Build the `travel_entries` row (with its joined country) to show while a
 * save is pending. Preserves an edited row's created_at/transit; a new row gets
 * a temp id and the country is looked up from the cached countries list. */
export function buildOptimisticEntry(
  input: OptimisticEntryInput,
  country: Country | null,
  existing: TravelEntry | null,
): TravelEntry {
  const now = new Date().toISOString();
  return {
    id: input.id ?? existing?.id ?? tempId("entry"),
    traveler_id: input.traveler_id,
    country_code: input.country_code,
    entry_date: input.entry_date,
    exit_date: input.exit_date,
    notes: input.notes,
    transit: existing?.transit ?? false,
    created_at: existing?.created_at ?? now,
    country:
      existing?.country && existing.country_code === input.country_code
        ? existing.country
        : country
          ? {
              code: country.code,
              name: country.name,
              flag_emoji: country.flag_emoji,
              is_schengen: country.is_schengen,
            }
          : null,
  };
}

export type OptimisticExpenseInput = {
  id?: string;
  tripId: string;
  travellerId: string;
  spent_on: string | null;
  currency: string | null;
  amount: number | null;
  reason: string | null;
  /** The path already on the expense; a freshly captured photo uploads only
   * when the mutation actually runs, so offline it stays as-is (or null). */
  photoPath: string | null;
};

/** Build the `trip_expenses` row to show while a save is pending. */
export function buildOptimisticExpense(
  input: OptimisticExpenseInput,
  existing: TripExpenseRow | null,
): TripExpenseRow {
  const now = new Date().toISOString();
  return {
    id: input.id ?? existing?.id ?? tempId("expense"),
    trip_id: input.tripId,
    traveller_id: input.travellerId,
    spent_on: input.spent_on,
    currency: input.currency,
    amount: input.amount,
    reason: input.reason,
    photo_path: input.photoPath,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
}

/** All-null segment row skeleton — the fields `composeSegmentRow` doesn't set. */
function emptySegmentRow(id: string, travellerId: string, now: string): TravelSegmentRow {
  return {
    id,
    trip_id: null,
    traveller_id: travellerId,
    created_at: now,
    updated_at: now,
    address: null,
    arrive_at: null,
    arrive_country_code: null,
    arrive_iata: null,
    arrive_place: null,
    arrive_tz: null,
    booking_ref: null,
    cabin: null,
    carrier: null,
    co2_kg: null,
    confidence: null,
    depart_at: null,
    depart_country_code: null,
    depart_iata: null,
    depart_place: null,
    depart_tz: null,
    distance_km: null,
    needs_review: false,
    notes: null,
    number: null,
    phone: null,
    raw: null,
    seat: null,
    segment_type: "flight",
    source: "manual",
    source_ref: null,
    status: "confirmed",
    title: null,
    url: null,
  };
}

/**
 * Build the `travel_segments` row to show while a save is pending, reusing the
 * same pure `composeSegmentRow` the real write uses so the optimistic instant,
 * zone and CO₂ match what lands. The full trip resolution and reconcile happen
 * for real when the mutation runs; here we only paint the itinerary line.
 */
export function buildOptimisticSegment(
  input: SegmentFormInput,
  airports: Map<string, TravelAirportRow>,
  travellerId: string,
  existing: TravelSegmentRow | null,
): TravelSegmentRow {
  const now = new Date().toISOString();
  const id = input.id ?? existing?.id ?? tempId("seg");
  const composed: Omit<TablesInsert<"travel_segments">, "traveller_id"> = composeSegmentRow(
    input,
    airports,
  );
  const base = existing ?? emptySegmentRow(id, travellerId, now);
  return {
    ...base,
    ...composed,
    id,
    traveller_id: travellerId,
    trip_id: input.trip_id ?? base.trip_id ?? null,
    created_at: base.created_at,
    updated_at: now,
  };
}
