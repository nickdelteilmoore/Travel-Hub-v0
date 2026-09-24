// Trip cover imagery. Candidate keys derived from the trip resolve to bundled
// require()d assets, and a generated postcard SVG is the fallback so a trip is
// never blank while its photo is still to be sourced.

import type { TravelTrip } from "./queries";

/** Lowercase, hyphenated, ascii-ish slug. "Rome & Florence" → "rome-florence". */
function slugify(s: string | null | undefined): string {
  return String(s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents: Béziers → beziers
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** A trip carrying the fields the resolver reads — a subset of TravelTrip. */
type CoverTrip = Pick<TravelTrip, "title" | "primary_country_code"> & {
  cover_slug?: string | null;
  destination?: string | null;
  city?: string | null;
};

/**
 * Ordered city slugs to try for a trip, most specific first. Several cities can
 * share a country (Paris and Béziers are both FR), so the country file alone
 * can't tell them apart — we derive a slug from the trip title so a trip titled
 * "Palermo" finds it-palermo on its own, no extra field needed.
 */
export function coverSlugs(trip: CoverTrip | null | undefined): string[] {
  const out: string[] = [];
  const add = (s: string | null | undefined) => {
    const v = slugify(s);
    if (v && !out.includes(v)) out.push(v);
  };
  add(trip?.cover_slug); // explicit override, if ever set
  add(trip?.title); // "Lisbon" → lisbon
  if (trip?.title) {
    add(trip.title.split(/[&,/]|\band\b/i)[0]); // "Rome & Florence" → rome
    add(trip.title.split(/\s+/)[0]); // "Nairobi work trip" → nairobi
  }
  add(trip?.destination);
  add(trip?.city);
  return out;
}

/**
 * Ordered candidate cover keys for a trip: each city slug as `<cc>-<slug>`,
 * then the country `<cc>`. Empty when we can't even key a country.
 */
export function coverKeys(trip: CoverTrip | null | undefined): string[] {
  const cc = (trip?.primary_country_code ?? "").trim().toLowerCase();
  if (!cc) return [];
  return [...coverSlugs(trip).map((s) => `${cc}-${s}`), cc];
}

// Bundled cover photos. Metro needs a static require() per asset, so this map
// is the registry: drop a photo you have the rights to into assets/covers and
// add its key here, e.g. "fr-paris": require("../../../assets/covers/fr-paris.jpg").
// City keys (`<cc>-<slug>`) win over country keys (`<cc>`). Empty by default —
// every trip then gets the generated postcard below.
const COVERS: Record<string, number> = {};

/** Most-specific registry hit for a trip, or null. Split out so the lookup
 * order is testable without bundling real photos. */
export function resolveCoverFrom(
  trip: CoverTrip | null | undefined,
  covers: Record<string, number>,
): number | null {
  for (const key of coverKeys(trip)) {
    const img = covers[key];
    if (img !== undefined) return img;
  }
  return null;
}

/**
 * The bundled photo for a trip, most-specific first, or null when none of its
 * candidate keys has an image (the caller then shows the postcard). Returns
 * the require() module id that <Image source={…}> takes directly.
 */
export function resolveCoverImage(trip: CoverTrip | null | undefined): number | null {
  return resolveCoverFrom(trip, COVERS);
}

/* ── Generated fallback — a deterministic "botanical postcard" ───────────────
   A layered SVG scene derived from the destination, so a trip is never blank
   while its photo is still to be sourced. Same seed → same scene, every time.
   Browser-free, string in/out. */

/** Stable 32-bit hash of a seed string (FNV-1a). Deterministic across engines. */
function hash(seed: string): number {
  let h = 0x811c9dc5;
  const s = String(seed || "trip");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

type Mood = {
  sky: [string, string];
  sun: string;
  bands: { y: number; fill: string }[];
  jag: number;
};

// Four scene moods, each a warm, natural-light reading of the Botanical Bright
// palette. The hash picks one, so a given destination is always the same mood.
const MOODS: Mood[] = [
  { sky: ["#AEDCE6", "#EAF3E7"], sun: "#F4E7B0", bands: [{ y: 0.62, fill: "#7FB4C6" }, { y: 0.78, fill: "#E9DCB4" }], jag: 0.04 },
  { sky: ["#DCEFA6", "#F3F0E7"], sun: "#C7EC5B", bands: [{ y: 0.55, fill: "#9AC46E" }, { y: 0.7, fill: "#5F6E33" }], jag: 0.16 },
  { sky: ["#F4C4D4", "#AEDCE6"], sun: "#F6DCA8", bands: [{ y: 0.6, fill: "#B98A6A" }, { y: 0.74, fill: "#7A4E33" }], jag: 0.28 },
  { sky: ["#F6D9A8", "#F4C4D4"], sun: "#FBEFD2", bands: [{ y: 0.6, fill: "#D9A441" }, { y: 0.76, fill: "#C0763F" }], jag: 0.1 },
];

/** A jagged silhouette polygon across the full width at a given base height. */
function silhouette(h: number, w: number, baseY: number, jag: number, seed: string): string {
  const steps = 9;
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * w;
    const n = ((hash(seed + ":" + i) % 1000) / 1000) - 0.5;
    const y = baseY + n * jag * h;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return `${pts.join(" ")} ${w},${h} 0,${h}`;
}

/**
 * A deterministic postcard scene for a seed (the trip title, or the country
 * name — anything stable). Returns a self-contained <svg> string that fills its
 * box; the caller sizes it. No external refs, so it renders under SvgXml.
 */
export function postcardSVG(seed: string, opts: { w?: number; h?: number } = {}): string {
  const { w = 800, h = 500 } = opts;
  const hv = hash(seed);
  // Modulo the array length always lands in range; assert past the strict
  // no-unchecked-index rule rather than thread an impossible undefined branch.
  const mood = MOODS[hv % MOODS.length]!;
  const gid = "sky" + (hv % 100000);
  const sunX = (0.16 + ((hv >> 3) % 68) / 100) * w;
  const sunY = (0.18 + ((hv >> 7) % 22) / 100) * h;
  const sunR = h * 0.11;

  const bands = mood.bands
    .map((b, i) => `<polygon points="${silhouette(h, w, b.y * h, mood.jag, seed + ":" + i)}" fill="${b.fill}"/>`)
    .join("");

  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${mood.sky[0]}"/>
      <stop offset="1" stop-color="${mood.sky[1]}"/>
    </linearGradient></defs>
    <rect width="${w}" height="${h}" fill="url(#${gid})"/>
    <circle cx="${sunX.toFixed(1)}" cy="${sunY.toFixed(1)}" r="${sunR.toFixed(1)}" fill="${mood.sun}" opacity="0.9"/>
    ${bands}
  </svg>`;
}
