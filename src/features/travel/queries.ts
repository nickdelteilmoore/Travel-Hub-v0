import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import type { Tables } from "@/lib/database.types";
import {
  isValidLatLng,
  nearestMetroFrom,
  nominatimSearchUrl,
  overpassQuery,
  NOMINATIM_UA,
  OVERPASS_URL,
  type LatLng,
  type MetroStation,
  type OverpassElement,
} from "./hotelMap";

export type Country = Tables<"countries">;
export type TravelEntryRow = Tables<"travel_entries">;
export type TravelEntry = TravelEntryRow & {
  country: Pick<Country, "code" | "name" | "flag_emoji" | "is_schengen"> | null;
};

export type TravelTripRow = Tables<"travel_trips">;
export type TravelTrip = TravelTripRow & {
  country: Pick<Country, "code" | "name" | "flag_emoji"> | null;
};
export type TravelSegmentRow = Tables<"travel_segments">;
export type SegmentTypeRow = Tables<"travel_segment_types">;
export type FlightStatusRow = Tables<"travel_flight_status">;
export type TravelAirportRow = Tables<"travel_airports">;
export type TravelDocumentRow = Tables<"travel_documents">;
export type TravelAlertRow = Tables<"travel_alerts">;
export type FlightWatchRow = Tables<"travel_flight_watches">;

export type TripExpenseRow = Tables<"trip_expenses">;

export type HouseholdProfile = Pick<Tables<"profiles">, "id" | "display_name">;

/** Both household members, for the traveler segmented control. */
export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    staleTime: 1000 * 60 * 10,
    queryFn: async (): Promise<HouseholdProfile[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useTravelEntry(id: string | undefined) {
  return useQuery({
    queryKey: ["travel_entry", id],
    enabled: !!id,
    queryFn: async (): Promise<TravelEntryRow | null> => {
      const { data, error } = await supabase
        .from("travel_entries")
        .select("*")
        .eq("id", id as string)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useCountries() {
  return useQuery({
    queryKey: ["countries"],
    staleTime: 1000 * 60 * 60,
    queryFn: async (): Promise<Country[]> => {
      const { data, error } = await supabase
        .from("countries")
        .select("*")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Countries visited without a trip in the log — the map and the
 * counter read these alongside the countries of non-transit trips. The log
 * starts partway through a life, so "no row here" was never the same fact as
 * "never been".
 */
export function useVisitedCountries(travelerId: string | null) {
  return useQuery({
    queryKey: ["visited_countries", travelerId],
    enabled: !!travelerId,
    staleTime: 1000 * 60 * 10,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("visited_countries")
        .select("country_code")
        .eq("traveler_id", travelerId as string);
      if (error) throw error;
      return (data ?? []).map((r) => r.country_code);
    },
  });
}

export function useTravelEntries(travelerId: string | null) {
  return useQuery({
    queryKey: ["travel", travelerId],
    enabled: !!travelerId,
    staleTime: 30_000,
    queryFn: async (): Promise<TravelEntry[]> => {
      const { data, error } = await supabase
        .from("travel_entries")
        .select(
          "*, country:countries(code, name, flag_emoji, is_schengen)",
        )
        .eq("traveler_id", travelerId as string)
        .order("entry_date", { ascending: false });
      if (error) throw error;
      return (data as TravelEntry[]) ?? [];
    },
  });
}

/**
 * The real trips — `travel_trips`. These are the containers
 * segments are grouped into, and the itinerary layer the app reads. Owner-scoped by `traveller_id = auth.uid()`, so a single
 * traveller filter matches the signed-in user. Newest first.
 */
export function useTrips(travelerId: string | null) {
  return useQuery({
    queryKey: ["travel_trips", travelerId],
    enabled: !!travelerId,
    staleTime: 30_000,
    queryFn: async (): Promise<TravelTrip[]> => {
      const { data, error } = await supabase
        .from("travel_trips")
        .select("*, country:countries(code, name, flag_emoji)")
        .eq("traveller_id", travelerId as string)
        .order("start_date", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data as TravelTrip[]) ?? [];
    },
  });
}

export function useTrip(id: string | undefined) {
  return useQuery({
    queryKey: ["travel_trip", id],
    enabled: !!id,
    queryFn: async (): Promise<TravelTrip | null> => {
      const { data, error } = await supabase
        .from("travel_trips")
        .select("*, country:countries(code, name, flag_emoji)")
        .eq("id", id as string)
        .maybeSingle();
      if (error) throw error;
      return (data as TravelTrip) ?? null;
    },
  });
}

/** A trip's segments, in schedule order — the itinerary of one trip. */
export function useTripSegments(tripId: string | undefined) {
  return useQuery({
    queryKey: ["travel_segments", tripId],
    enabled: !!tripId,
    staleTime: 30_000,
    queryFn: async (): Promise<TravelSegmentRow[]> => {
      const { data, error } = await supabase
        .from("travel_segments")
        .select("*")
        .eq("trip_id", tripId as string)
        .order("depart_at", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSegment(id: string | undefined) {
  return useQuery({
    queryKey: ["travel_segment", id],
    enabled: !!id,
    queryFn: async (): Promise<TravelSegmentRow | null> => {
      const { data, error } = await supabase
        .from("travel_segments")
        .select("*")
        .eq("id", id as string)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}

/** The segment-type reference rows (labels, leaf silhouettes), keyed by code. */
export function useSegmentTypes() {
  return useQuery({
    queryKey: ["travel_segment_types"],
    staleTime: 1000 * 60 * 60,
    queryFn: async (): Promise<Map<string, SegmentTypeRow>> => {
      const { data, error } = await supabase
        .from("travel_segment_types")
        .select("*")
        .order("position");
      if (error) throw error;
      return new Map((data ?? []).map((t) => [t.code, t]));
    },
  });
}

/** Airports for a set of IATA codes, keyed by code — for names, zones, coords. */
export function useAirports(codes: (string | null | undefined)[]) {
  const wanted = Array.from(new Set(codes.filter((c): c is string => !!c))).sort();
  return useQuery({
    queryKey: ["travel_airports", wanted.join(",")],
    enabled: wanted.length > 0,
    staleTime: 1000 * 60 * 60,
    queryFn: async (): Promise<Map<string, TravelAirportRow>> => {
      const { data, error } = await supabase
        .from("travel_airports")
        .select("*")
        .in("iata", wanted);
      if (error) throw error;
      return new Map((data ?? []).map((a) => [a.iata, a]));
    },
  });
}

/** Documents (boarding passes, tickets, vouchers) for a trip or a segment. */
export function useTravelDocuments(opts: { tripId?: string; segmentId?: string }) {
  const { tripId, segmentId } = opts;
  return useQuery({
    queryKey: ["travel_documents", segmentId ?? tripId ?? ""],
    enabled: !!(tripId || segmentId),
    staleTime: 60_000,
    queryFn: async (): Promise<TravelDocumentRow[]> => {
      let q = supabase.from("travel_documents").select("*");
      q = segmentId ? q.eq("segment_id", segmentId) : q.eq("trip_id", tripId as string);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Flight status/gate/baggage alerts the poller wrote; newest first. */
export function useAlerts() {
  return useQuery({
    queryKey: ["travel_alerts"],
    staleTime: 60_000,
    queryFn: async (): Promise<TravelAlertRow[]> => {
      const { data, error } = await supabase
        .from("travel_alerts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** The auto-created status watch for a flight segment, if any. */
export function useFlightWatch(segmentId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["travel_flight_watch", segmentId],
    enabled: !!segmentId && enabled,
    queryFn: async (): Promise<FlightWatchRow | null> => {
      const { data, error } = await supabase
        .from("travel_flight_watches")
        .select("*")
        .eq("segment_id", segmentId as string)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}

/**
 * Hotel map data (DESIGN.md, hotel map). The travel_* tables carry no
 * hotel coordinates, so a pin has to be derived: `coords` are whatever `resolveHotelCoords()` already
 * found on the segment, else the `query` address is geocoded here through
 * OpenStreetMap's Nominatim (no API key — hard rule 3). The nearest metro is a
 * best-effort Overpass lookup that never fails the whole map. Cached for a week
 * — an address resolves to the same point every time — and persisted with the
 * rest of the query cache, so a revisit is instant and survives offline.
 */
export type HotelLocation = { hotel: LatLng; metro: MetroStation | null };

async function geocodeAddress(address: string): Promise<LatLng | null> {
  const res = await fetch(nominatimSearchUrl(address), {
    headers: { Accept: "application/json", "Accept-Language": "en-GB", "User-Agent": NOMINATIM_UA },
  });
  if (!res.ok) throw new Error(`Geocode failed (${res.status})`);
  const json: unknown = await res.json();
  const first = (Array.isArray(json) ? json[0] : undefined) as
    | { lat?: unknown; lon?: unknown }
    | undefined;
  const lat = Number(first?.lat);
  const lng = Number(first?.lon);
  return isValidLatLng(lat, lng) ? { lat, lng } : null;
}

async function fetchNearestMetro(hotel: LatLng): Promise<MetroStation | null> {
  try {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: overpassQuery(hotel),
    });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    const elements = (json as { elements?: unknown }).elements;
    return nearestMetroFrom(Array.isArray(elements) ? (elements as OverpassElement[]) : [], hotel);
  } catch {
    // The metro pin is an enhancement; a lookup failure leaves the hotel pin.
    return null;
  }
}

export function useHotelLocation(input: {
  segmentId: string | undefined;
  coords: LatLng | null;
  query: string | null;
}) {
  const { segmentId, coords, query } = input;
  return useQuery({
    queryKey: ["hotel_location", segmentId, coords?.lat ?? null, coords?.lng ?? null, query],
    enabled: !!segmentId && !!(coords || query),
    staleTime: 1000 * 60 * 60 * 24 * 7,
    gcTime: 1000 * 60 * 60 * 24 * 14,
    retry: 1,
    queryFn: async (): Promise<HotelLocation> => {
      const hotel = coords ?? (query ? await geocodeAddress(query) : null);
      if (!hotel) throw new Error("Couldn't find this hotel on the map");
      const metro = await fetchNearestMetro(hotel);
      return { hotel, metro };
    },
  });
}

/**
 * A trip's expenses (DESIGN.md, expenses), newest first. Owner-scoped by
 * RLS (traveller_id = auth.uid()), app-written unlike the read-only travel_*
 * tables. Ordered by the purchase date when known, else by when it was logged,
 * so an expense with a blank date still sits sensibly in the running list.
 */
export function useTripExpenses(tripId: string | undefined) {
  return useQuery({
    queryKey: ["trip_expenses", tripId],
    enabled: !!tripId,
    staleTime: 30_000,
    queryFn: async (): Promise<TripExpenseRow[]> => {
      const { data, error } = await supabase
        .from("trip_expenses")
        .select("*")
        .eq("trip_id", tripId as string)
        .order("spent_on", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** One expense, for the edit form. */
export function useExpense(id: string | undefined) {
  return useQuery({
    queryKey: ["trip_expense", id],
    enabled: !!id,
    queryFn: async (): Promise<TripExpenseRow | null> => {
      const { data, error } = await supabase
        .from("trip_expenses")
        .select("*")
        .eq("id", id as string)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}

/**
 * Short-lived signed URLs for a set of receipt photos, keyed by storage path —
 * the `receipts` bucket is private (like travel-docs), so the list thumbnails
 * and the PDF export both mint URLs rather than linking the bucket directly.
 */
export function useReceiptUrls(paths: (string | null)[]) {
  const wanted = Array.from(new Set(paths.filter((p): p is string => !!p))).sort();
  return useQuery({
    queryKey: ["receipt_urls", wanted.join(",")],
    enabled: wanted.length > 0,
    staleTime: 1000 * 60 * 30,
    queryFn: async (): Promise<Map<string, string>> => {
      const { data, error } = await supabase.storage.from("receipts").createSignedUrls(wanted, 3600);
      if (error) throw error;
      const map = new Map<string, string>();
      for (const row of data ?? []) {
        if (row.path && row.signedUrl) map.set(row.path, row.signedUrl);
      }
      return map;
    },
  });
}

/** Live flight status for a set of segment ids, keyed by segment_id. */
export function useFlightStatuses(segmentIds: string[]) {
  const ids = Array.from(new Set(segmentIds)).sort();
  return useQuery({
    queryKey: ["travel_flight_status", ids.join(",")],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<Map<string, FlightStatusRow>> => {
      const { data, error } = await supabase
        .from("travel_flight_status")
        .select("*")
        .in("segment_id", ids);
      if (error) throw error;
      return new Map((data ?? []).map((r) => [r.segment_id, r]));
    },
  });
}
