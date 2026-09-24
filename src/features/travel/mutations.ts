import { Linking } from "react-native";
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { toast } from "@/stores/uiStore";
import type { TablesInsert } from "@/lib/database.types";
import { composeSegmentRow, type SegmentFormInput } from "./segmentForm";
import { resolveTrip, segmentSpan, tripSpan, suggestTitle } from "./domain/reconcile";
import { base64ToBytes, type ExpenseFields } from "./expenses";
import type {
  Country,
  TravelAirportRow,
  TravelEntry,
  TravelSegmentRow,
  TripExpenseRow,
} from "./queries";
import {
  buildOptimisticEntry,
  buildOptimisticExpense,
  buildOptimisticSegment,
  byEntryDateDesc,
  byExpenseRecencyDesc,
  bySegmentDepartAsc,
  removeById,
  upsertById,
} from "./offline";

export type TravelEntryInput = {
  id?: string;
  traveler_id: string;
  country_code: string;
  entry_date: string;
  exit_date: string | null;
  notes: string | null;
};

// ── Offline-capable writes ────────────────────────────────────
//
// Trips, segments, entries and expenses are edited on a plane. Each of these
// mutations is registered as a *mutation default* keyed by a stable id, so when
// the device is offline React Query pauses the whole write (never a half-run)
// and replays it on reconnect — and because the paused mutation is persisted to
// MMKV with the query cache, it survives a cold start mid-flight. The onMutate
// paints the change into the (also persisted) query cache through the pure
// builders in `offline.ts`, so an offline add shows instantly and rolls back if
// the eventual write fails. `registerTravelMutationDefaults` is called once from
// `lib/queryClient.ts`; the hooks below are thin and only carry the key.

/** Optimistic rollback handed from onMutate to onError. Undefined after a cold
 * start (the context isn't restored), so every reader guards it. */
type Rollback = { rollback: () => void };

export const OFFLINE_MUTATION_KEYS = {
  saveEntry: ["travel", "saveEntry"],
  deleteEntry: ["travel", "deleteEntry"],
  saveSegment: ["travel", "saveSegment"],
  deleteSegment: ["travel", "deleteSegment"],
  saveExpense: ["travel", "saveExpense"],
  deleteExpense: ["travel", "deleteExpense"],
} as const;

/** Merge every cached airport map into one, so an optimistic segment can resolve
 * zones/countries offline from whatever the app has already seen. */
function mergedAirports(qc: QueryClient): Map<string, TravelAirportRow> {
  const out = new Map<string, TravelAirportRow>();
  for (const [, data] of qc.getQueriesData<Map<string, TravelAirportRow>>({
    queryKey: ["travel_airports"],
  })) {
    if (data) for (const [code, row] of data) out.set(code, row);
  }
  return out;
}

// ── The write bodies (unchanged behaviour; now reused by the defaults) ───────

async function saveEntryFn({ id, ...fields }: TravelEntryInput): Promise<void> {
  if (id) {
    const { error } = await supabase.from("travel_entries").update(fields).eq("id", id);
    if (error) throw error;
  } else {
    const payload: TablesInsert<"travel_entries"> = fields;
    const { error } = await supabase.from("travel_entries").insert(payload);
    if (error) throw error;
  }
}

async function deleteEntryFn(id: string): Promise<void> {
  const { error } = await supabase.from("travel_entries").delete().eq("id", id);
  if (error) throw error;
}

// ── Optimistic cache patches ─────────────────────────────────────────────────

async function optimisticSaveEntry(
  qc: QueryClient,
  vars: TravelEntryInput,
): Promise<Rollback> {
  const key = ["travel", vars.traveler_id];
  await qc.cancelQueries({ queryKey: key });
  const prev = qc.getQueryData<TravelEntry[]>(key);
  const country =
    qc.getQueryData<Country[]>(["countries"])?.find((c) => c.code === vars.country_code) ?? null;
  const existing = prev?.find((e) => e.id === vars.id) ?? null;
  const row = buildOptimisticEntry(vars, country, existing);
  qc.setQueryData<TravelEntry[]>(key, (list) => upsertById(list ?? [], row, byEntryDateDesc));
  return { rollback: () => qc.setQueryData(key, prev) };
}

async function optimisticDeleteFromLists<T extends { id: string }>(
  qc: QueryClient,
  prefix: string,
  id: string,
): Promise<Rollback> {
  await qc.cancelQueries({ queryKey: [prefix] });
  const snaps = qc.getQueriesData<T[]>({ queryKey: [prefix] });
  for (const [key, data] of snaps) if (data) qc.setQueryData(key, removeById(data, id));
  return {
    rollback: () => {
      for (const [key, data] of snaps) qc.setQueryData(key, data);
    },
  };
}

async function optimisticSaveExpense(qc: QueryClient, input: ExpenseInput): Promise<Rollback> {
  const key = ["trip_expenses", input.tripId];
  await qc.cancelQueries({ queryKey: key });
  const prev = qc.getQueryData<TripExpenseRow[]>(key);
  const existing = prev?.find((e) => e.id === input.id) ?? null;
  const row = buildOptimisticExpense(
    {
      id: input.id,
      tripId: input.tripId,
      travellerId: input.travellerId,
      spent_on: input.fields.spent_on,
      currency: input.fields.currency,
      amount: input.fields.amount,
      reason: input.fields.reason,
      // A freshly captured photo uploads only when the write runs; offline the
      // thumbnail waits, but the amount/reason line shows straight away.
      photoPath: existing?.photo_path ?? input.existingPhotoPath ?? null,
    },
    existing,
  );
  qc.setQueryData<TripExpenseRow[]>(key, (list) =>
    upsertById(list ?? [], row, byExpenseRecencyDesc),
  );
  return { rollback: () => qc.setQueryData(key, prev) };
}

async function optimisticDeleteExpense(
  qc: QueryClient,
  vars: { id: string; tripId: string },
): Promise<Rollback> {
  const key = ["trip_expenses", vars.tripId];
  await qc.cancelQueries({ queryKey: key });
  const prev = qc.getQueryData<TripExpenseRow[]>(key);
  qc.setQueryData<TripExpenseRow[]>(key, (list) => removeById(list ?? [], vars.id));
  return { rollback: () => qc.setQueryData(key, prev) };
}

async function optimisticSaveSegment(
  qc: QueryClient,
  vars: { input: SegmentFormInput; travellerId: string },
): Promise<Rollback> {
  const { input, travellerId } = vars;
  let existing: TravelSegmentRow | null = null;
  if (input.id) {
    existing = qc.getQueryData<TravelSegmentRow | null>(["travel_segment", input.id]) ?? null;
    if (!existing) {
      for (const [, data] of qc.getQueriesData<TravelSegmentRow[]>({
        queryKey: ["travel_segments"],
      })) {
        const found = data?.find((s) => s.id === input.id);
        if (found) {
          existing = found;
          break;
        }
      }
    }
  }
  const row = buildOptimisticSegment(input, mergedAirports(qc), travellerId, existing);
  const rollbacks: Array<() => void> = [];

  // A segment always resolves into a trip on the real write; when the form knew
  // the trip up front (the usual "Add segment" path) we can paint the itinerary.
  if (row.trip_id) {
    const listKey = ["travel_segments", row.trip_id];
    await qc.cancelQueries({ queryKey: listKey });
    const prevList = qc.getQueryData<TravelSegmentRow[]>(listKey);
    qc.setQueryData<TravelSegmentRow[]>(listKey, (list) =>
      upsertById(list ?? [], row, bySegmentDepartAsc),
    );
    rollbacks.push(() => qc.setQueryData(listKey, prevList));
  }
  if (input.id) {
    const detailKey = ["travel_segment", input.id];
    const prevDetail = qc.getQueryData<TravelSegmentRow | null>(detailKey);
    qc.setQueryData(detailKey, row);
    rollbacks.push(() => qc.setQueryData(detailKey, prevDetail));
  }
  return { rollback: () => rollbacks.forEach((fn) => fn()) };
}

/**
 * Register the offline-capable mutation defaults on the app's single query
 * client. Called once at module load from `lib/queryClient.ts`, before the
 * persister restores — so a paused mutation dehydrated on a previous launch
 * finds its function here and can resume.
 */
export function registerTravelMutationDefaults(qc: QueryClient): void {
  const rollbackOnError = (message: string) => (_e: unknown, _v: unknown, ctx: unknown) => {
    (ctx as Rollback | undefined)?.rollback();
    toast(message);
  };

  qc.setMutationDefaults(OFFLINE_MUTATION_KEYS.saveEntry, {
    mutationFn: (vars: TravelEntryInput) => saveEntryFn(vars),
    onMutate: (vars: TravelEntryInput) => optimisticSaveEntry(qc, vars),
    onError: rollbackOnError("Couldn't save trip — try again"),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["travel"] });
    },
    retry: 2,
  });

  qc.setMutationDefaults(OFFLINE_MUTATION_KEYS.deleteEntry, {
    mutationFn: (id: string) => deleteEntryFn(id),
    onMutate: (id: string) => optimisticDeleteFromLists<TravelEntry>(qc, "travel", id),
    onError: rollbackOnError("Couldn't delete trip — try again"),
    onSettled: () => qc.invalidateQueries({ queryKey: ["travel"] }),
    retry: 2,
  });

  qc.setMutationDefaults(OFFLINE_MUTATION_KEYS.saveSegment, {
    mutationFn: (vars: { input: SegmentFormInput; travellerId: string }) =>
      persistSegment(vars.input, vars.travellerId),
    onMutate: (vars: { input: SegmentFormInput; travellerId: string }) =>
      optimisticSaveSegment(qc, vars),
    onError: rollbackOnError("Couldn't save — try again"),
    onSettled: () => invalidateTravel(qc),
    retry: 2,
  });

  qc.setMutationDefaults(OFFLINE_MUTATION_KEYS.deleteSegment, {
    mutationFn: (id: string) => deleteSegmentFn(id),
    onMutate: (id: string) => optimisticDeleteFromLists<TravelSegmentRow>(qc, "travel_segments", id),
    onError: rollbackOnError("Couldn't delete — try again"),
    onSettled: () => invalidateTravel(qc),
    retry: 2,
  });

  qc.setMutationDefaults(OFFLINE_MUTATION_KEYS.saveExpense, {
    mutationFn: (input: ExpenseInput) => saveExpenseFn(input),
    onMutate: (input: ExpenseInput) => optimisticSaveExpense(qc, input),
    onError: rollbackOnError("Couldn't save the expense — try again"),
    onSettled: (_d, _e, vars) => qc.invalidateQueries({ queryKey: ["trip_expenses", vars.tripId] }),
    retry: 2,
  });

  qc.setMutationDefaults(OFFLINE_MUTATION_KEYS.deleteExpense, {
    mutationFn: (vars: { id: string; tripId: string; photoPath: string | null }) =>
      deleteExpenseFn(vars),
    onMutate: (vars: { id: string; tripId: string; photoPath: string | null }) =>
      optimisticDeleteExpense(qc, vars),
    onError: rollbackOnError("Couldn't delete — try again"),
    onSettled: (_d, _e, vars) => qc.invalidateQueries({ queryKey: ["trip_expenses", vars.tripId] }),
    retry: 2,
  });
}

export function useSaveTravelEntry() {
  return useMutation<void, unknown, TravelEntryInput, Rollback>({
    mutationKey: OFFLINE_MUTATION_KEYS.saveEntry,
  });
}

export function useDeleteTravelEntry() {
  return useMutation<void, unknown, string, Rollback>({
    mutationKey: OFFLINE_MUTATION_KEYS.deleteEntry,
  });
}

// ── travel_trips / travel_segments (Phase 8) ────────────────────────────────
//
// Every write that could change where you were ends by calling
// reconcile_travel_entries(trip_id): the segments feed travel_entries, which is
// what the map and the 90/180 counter read, so every writer (the app or any
// importer) converges on the same derived rows. Query keys invalidated cover both
// the itinerary views and the derived Schengen/map surfaces.

/** Invalidate everything a trip/segment write can move. */
function invalidateTravel(queryClient: ReturnType<typeof useQueryClient>): void {
  for (const key of [
    "travel_trips",
    "travel_trip",
    "travel_segments",
    "travel_segment",
    "travel", // travel_entries (Schengen / map)
    "visited_countries",
  ]) {
    queryClient.invalidateQueries({ queryKey: [key] });
  }
}

/** Fetch the airports a form input references, so zones/countries resolve. */
async function fetchAirports(codes: (string | undefined)[]): Promise<Map<string, TravelAirportRow>> {
  const wanted = Array.from(
    new Set(codes.map((c) => c?.trim().toUpperCase()).filter((c): c is string => !!c)),
  );
  if (!wanted.length) return new Map();
  const { data, error } = await supabase.from("travel_airports").select("*").in("iata", wanted);
  if (error) throw error;
  return new Map((data ?? []).map((a) => [a.iata, a]));
}

/**
 * The single write path for a segment — by hand, or from an approved email
 * (`opts.source`/`sourceRef`). Composes the instant/zone/CO₂ off the airport
 * table, resolves the segment into an existing trip (or opens a new one on
 *'s rule), widens the trip to cover it, then reconciles. Returns the
 * segment id.
 */
export async function persistSegment(
  input: SegmentFormInput,
  travellerId: string,
  opts: { source?: string; sourceRef?: string } = {},
): Promise<string> {
  const airports = await fetchAirports([input.depart_iata, input.arrive_iata]);
  const row = composeSegmentRow(input, airports);
  if (opts.source) row.source = opts.source;
  if (opts.sourceRef) row.source_ref = opts.sourceRef;

  // Trip resolution — the same rule the backfill and ingestion use.
  let tripId = input.trip_id ?? row.trip_id ?? null;
  if (!tripId) {
    const { data: trips } = await supabase
      .from("travel_trips")
      .select("id, start_date, end_date")
      .eq("traveller_id", travellerId);
    const match = resolveTrip(row, trips ?? []);
    if (match?.id) {
      tripId = match.id;
    } else {
      const span = segmentSpan(row);
      const { data: trip, error } = await supabase
        .from("travel_trips")
        .insert({
          traveller_id: travellerId,
          title: suggestTitle([row]),
          start_date: span.from,
          end_date: span.to ?? span.from,
          primary_country_code: row.arrive_country_code ?? row.depart_country_code ?? null,
          source: opts.source ?? "manual",
        })
        .select("id")
        .single();
      if (error) throw error;
      tripId = trip.id;
    }
  }
  row.trip_id = tripId;

  let segmentId = input.id ?? "";
  if (input.id) {
    const { error } = await supabase.from("travel_segments").update(row).eq("id", input.id);
    if (error) throw error;
  } else {
    const { data, error } = await supabase
      .from("travel_segments")
      .insert({ ...row, traveller_id: travellerId })
      .select("id")
      .single();
    if (error) throw error;
    segmentId = data.id;
  }

  // Keep the trip's span covering its segments, then rebuild presence.
  const { data: segs } = await supabase
    .from("travel_segments")
    .select("depart_at, arrive_at, depart_tz, arrive_tz")
    .eq("trip_id", tripId);
  const span = tripSpan(segs ?? []);
  if (span.start_date) {
    await supabase
      .from("travel_trips")
      .update({ start_date: span.start_date, end_date: span.end_date })
      .eq("id", tripId);
  }
  await supabase.rpc("reconcile_travel_entries", { p_trip_id: tripId });
  return segmentId;
}

async function deleteSegmentFn(id: string): Promise<void> {
  const { data: seg } = await supabase
    .from("travel_segments")
    .select("trip_id")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase.from("travel_segments").delete().eq("id", id);
  if (error) throw error;
  if (seg?.trip_id) await supabase.rpc("reconcile_travel_entries", { p_trip_id: seg.trip_id });
}

/** Save (insert or update) one segment by hand. Offline-capable. */
export function useSaveSegment() {
  return useMutation<string, unknown, { input: SegmentFormInput; travellerId: string }, Rollback>({
    mutationKey: OFFLINE_MUTATION_KEYS.saveSegment,
  });
}

export function useDeleteSegment() {
  return useMutation<void, unknown, string, Rollback>({
    mutationKey: OFFLINE_MUTATION_KEYS.deleteSegment,
  });
}

/** Merge one trip into another (moves segments, widens dates, reconciles). */
export function useMergeTrips() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ from, into }: { from: string; into: string }) => {
      const { error } = await supabase.rpc("travel_merge_trips", { p_from: from, p_into: into });
      if (error) throw error;
    },
    onSettled: () => invalidateTravel(queryClient),
    onError: () => toast("Couldn't merge trips — try again"),
  });
}

// ── Documents / alerts / flight watches (Phase C) ───────────────────────────

/**
 * Open a private travel document. The bucket is private, so a short-lived
 * signed URL is the only way out of it — mint one and hand it to the OS.
 */
export async function openDocument(storagePath: string): Promise<void> {
  const { data, error } = await supabase.storage.from("travel-docs").createSignedUrl(storagePath, 3600);
  if (error || !data?.signedUrl) {
    toast("Couldn't open the document");
    return;
  }
  await Linking.openURL(data.signedUrl);
}

/** Pin/unpin a document. Pinning marks it to keep offline. */
export function usePinDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      const { error } = await supabase.from("travel_documents").update({ pinned }).eq("id", id);
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["travel_documents"] }),
    onError: () => toast("Couldn't update the document — try again"),
  });
}

/** Mark one alert read. */
export function useMarkAlertRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("travel_alerts")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["travel_alerts"] }),
    onError: () => toast("Couldn't update — try again"),
  });
}

/**
 * Pause or resume the auto-created status watch for a flight (the trg_travel_flight_watch trigger
 * makes the watch; this only flips `paused`). Resuming a flight whose watch was
 * never created — a manual add before the trigger ran — upserts a fresh one.
 */
export function useToggleFlightWatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ segmentId, watching }: { segmentId: string; watching: boolean }) => {
      if (watching) {
        const { error } = await supabase
          .from("travel_flight_watches")
          .update({ paused: true, active: false })
          .eq("segment_id", segmentId);
        if (error) throw error;
        return;
      }
      const { data: seg, error: segErr } = await supabase
        .from("travel_segments")
        .select("carrier, number, depart_at, traveller_id")
        .eq("id", segmentId)
        .maybeSingle();
      if (segErr) throw segErr;
      if (!seg?.depart_at) throw new Error("no departure");
      const flightIata = `${seg.carrier ?? ""}${seg.number ?? ""}`.replace(/\s+/g, "").toUpperCase();
      const { error } = await supabase.from("travel_flight_watches").upsert({
        segment_id: segmentId,
        traveller_id: seg.traveller_id,
        flight_iata: flightIata,
        scheduled_date: seg.depart_at.slice(0, 10),
        paused: false,
        active: true,
        next_check_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSettled: (_d, _e, vars) => {
      queryClient.invalidateQueries({ queryKey: ["travel_flight_watch", vars.segmentId] });
    },
    onError: () => toast("Couldn't update the watch — try again"),
  });
}

// ── Trip expenses (receipt tracking, DESIGN.md) ──────────────────────────

function receiptKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Upload a receipt photo (base64 from the picker/manipulator) to the private
 * `receipts` bucket under <uid>/<trip>/, matching the storage RLS. Returns the
 * stored path. */
export async function uploadReceipt(opts: {
  userId: string;
  tripId: string;
  base64: string;
}): Promise<string> {
  const path = `${opts.userId}/${opts.tripId}/${receiptKey()}.jpg`;
  const { error } = await supabase.storage
    .from("receipts")
    .upload(path, base64ToBytes(opts.base64), { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  return path;
}

/** Open a receipt photo via a short-lived signed URL (private bucket). */
export async function openReceipt(storagePath: string): Promise<void> {
  const { data, error } = await supabase.storage.from("receipts").createSignedUrl(storagePath, 3600);
  if (error || !data?.signedUrl) {
    toast("Couldn't open the receipt");
    return;
  }
  await Linking.openURL(data.signedUrl);
}

export type ExpenseInput = {
  id?: string;
  tripId: string;
  travellerId: string;
  fields: ExpenseFields;
  /** A freshly captured photo to upload, if the user added or replaced one. */
  photoBase64?: string | null;
  /** The path already stored on the expense (kept when no new photo). */
  existingPhotoPath?: string | null;
};

/** The write body for an expense: upload a new photo first when present, then
 * insert/update, then clear a replaced photo so the bucket doesn't accumulate
 * orphans. When this runs on reconnect the photo (base64, persisted with the
 * paused mutation) uploads then. */
async function saveExpenseFn(input: ExpenseInput): Promise<void> {
  let photoPath = input.existingPhotoPath ?? null;
  if (input.photoBase64) {
    photoPath = await uploadReceipt({
      userId: input.travellerId,
      tripId: input.tripId,
      base64: input.photoBase64,
    });
  }
  const row = {
    trip_id: input.tripId,
    traveller_id: input.travellerId,
    spent_on: input.fields.spent_on,
    currency: input.fields.currency,
    amount: input.fields.amount,
    reason: input.fields.reason,
    photo_path: photoPath,
  };
  if (input.id) {
    const { error } = await supabase.from("trip_expenses").update(row).eq("id", input.id);
    if (error) throw error;
  } else {
    const payload: TablesInsert<"trip_expenses"> = row;
    const { error } = await supabase.from("trip_expenses").insert(payload);
    if (error) throw error;
  }
  // A replaced photo is now unreferenced — remove it best-effort.
  if (input.photoBase64 && input.existingPhotoPath && input.existingPhotoPath !== photoPath) {
    await supabase.storage.from("receipts").remove([input.existingPhotoPath]);
  }
}

async function deleteExpenseFn(vars: {
  id: string;
  tripId: string;
  photoPath: string | null;
}): Promise<void> {
  const { error } = await supabase.from("trip_expenses").delete().eq("id", vars.id);
  if (error) throw error;
  if (vars.photoPath) await supabase.storage.from("receipts").remove([vars.photoPath]);
}

/** Create or update an expense. Offline-capable. */
export function useSaveExpense() {
  return useMutation<void, unknown, ExpenseInput, Rollback>({
    mutationKey: OFFLINE_MUTATION_KEYS.saveExpense,
  });
}

/** Delete an expense and its photo. Offline-capable. */
export function useDeleteExpense() {
  return useMutation<void, unknown, { id: string; tripId: string; photoPath: string | null }, Rollback>(
    { mutationKey: OFFLINE_MUTATION_KEYS.deleteExpense },
  );
}
