/* Travel Hub — distance and CO2e.
 *
 * DEFRA/BEIS 2024 conversion factors, per passenger-kilometre, duplicated here
 * as DEFAULT_FACTORS so the module works with no database — great-circle
 * distance, radiative forcing included. Ported from the web hub's
 * assets/travel/carbon.js.
 */

const EARTH_KM = 6371.0088; // mean radius, matching travel_haversine_km()
const DETOUR = 1.08; // DEFRA indirect-routing uplift for flights

export type EmissionFactor = {
  mode: string;
  cabin: string;
  minKm: number;
  maxKm: number;
  kgPerPkm: number;
  uplift: number;
};

export type Point = { lat: number | null | undefined; lon: number | null | undefined };

export const DEFAULT_FACTORS: EmissionFactor[] = [
  { mode: "flight", cabin: "economy", minKm: 0, maxKm: 1500, kgPerPkm: 0.15298, uplift: 1.19 },
  { mode: "flight", cabin: "economy", minKm: 1500, maxKm: 3700, kgPerPkm: 0.08654, uplift: 1.19 },
  { mode: "flight", cabin: "economy", minKm: 3700, maxKm: Infinity, kgPerPkm: 0.14775, uplift: 1.19 },
  { mode: "flight", cabin: "premium", minKm: 3700, maxKm: Infinity, kgPerPkm: 0.2364, uplift: 1.19 },
  { mode: "flight", cabin: "business", minKm: 1500, maxKm: 3700, kgPerPkm: 0.12654, uplift: 1.19 },
  { mode: "flight", cabin: "business", minKm: 3700, maxKm: Infinity, kgPerPkm: 0.42848, uplift: 1.19 },
  { mode: "flight", cabin: "first", minKm: 3700, maxKm: Infinity, kgPerPkm: 0.59102, uplift: 1.19 },
  { mode: "train", cabin: "any", minKm: 0, maxKm: Infinity, kgPerPkm: 0.03549, uplift: 1.13 },
  { mode: "ferry", cabin: "any", minKm: 0, maxKm: Infinity, kgPerPkm: 0.11131, uplift: 1.14 },
  { mode: "bus", cabin: "any", minKm: 0, maxKm: Infinity, kgPerPkm: 0.0273, uplift: 1.14 },
  { mode: "car_hire", cabin: "any", minKm: 0, maxKm: Infinity, kgPerPkm: 0.16843, uplift: 1.24 },
];

const rad = (deg: number): number => (deg * Math.PI) / 180;

/** Great-circle distance in km, to one decimal. Null if either point is short. */
export function haversineKm(a: Point | null | undefined, b: Point | null | undefined): number | null {
  if (!a || !b || a.lat == null || a.lon == null || b.lat == null || b.lon == null) return null;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * EARTH_KM * Math.asin(Math.sqrt(h)) * 10) / 10;
}

/** Pick the factor row for a mode, cabin and distance, falling down the ladder. */
export function pickFactor(
  mode: string,
  cabin: string | null | undefined,
  km: number,
  factors: EmissionFactor[] = DEFAULT_FACTORS,
): EmissionFactor | null {
  const wanted = String(cabin || "any").toLowerCase();
  const candidates = factors.filter((f) => f.mode === mode && km >= f.minKm && km < f.maxKm);
  if (!candidates.length) return null;
  return (
    candidates.find((f) => f.cabin === wanted) ||
    candidates.find((f) => f.cabin === "economy") ||
    candidates.find((f) => f.cabin === "any") ||
    candidates[0] ||
    null
  );
}

export type CarbonSegment = {
  segment_type?: string;
  cabin?: string | null;
  distance_km?: number | null;
  co2_kg?: number | null;
  from?: Point | null;
  to?: Point | null;
};

/** kg CO2e for one passenger on one leg. */
export function estimate(
  input: { mode: string; cabin?: string | null; km?: number | null; from?: Point | null; to?: Point | null },
  factors: EmissionFactor[] = DEFAULT_FACTORS,
): { kg: number; km: number; factor: EmissionFactor; detour: boolean } | null {
  let distance = input.km != null ? input.km : haversineKm(input.from, input.to);
  if (distance == null || !(distance > 0)) return null;

  const detour = input.mode === "flight";
  if (detour) distance = Math.round(distance * DETOUR * 10) / 10;

  const factor = pickFactor(input.mode, input.cabin, distance, factors);
  if (!factor) return null;

  const kg = distance * factor.kgPerPkm * factor.uplift;
  return { kg: Math.round(kg * 10) / 10, km: distance, factor, detour };
}

/** Sum a set of segments. Anything unpriceable is skipped, and counted. */
export function total(
  segments: CarbonSegment[] | null | undefined,
  factors: EmissionFactor[] = DEFAULT_FACTORS,
): { kg: number; km: number; priced: number; skipped: number } {
  let kg = 0;
  let km = 0;
  let priced = 0;
  let skipped = 0;
  for (const seg of segments || []) {
    if (seg.co2_kg != null) {
      kg += Number(seg.co2_kg);
      km += Number(seg.distance_km || 0);
      priced += 1;
      continue;
    }
    const est = estimate(
      { mode: seg.segment_type || "", cabin: seg.cabin, km: seg.distance_km, from: seg.from, to: seg.to },
      factors,
    );
    if (est) {
      kg += est.kg;
      km += est.km;
      priced += 1;
    } else {
      skipped += 1;
    }
  }
  return { kg: Math.round(kg * 10) / 10, km: Math.round(km), priced, skipped };
}

/** "1.2 t" past a tonne, "340 kg" below it — nobody reads 1,240.7 kg. */
export function formatKg(kg: number | null | undefined): string {
  if (kg == null) return "—";
  if (kg >= 1000) return `${(kg / 1000).toFixed(kg >= 10000 ? 0 : 1)} t`;
  return `${Math.round(kg)} kg`;
}
