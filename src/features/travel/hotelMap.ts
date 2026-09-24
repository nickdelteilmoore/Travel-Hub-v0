/* Travel Hub — pure hotel-location logic (DESIGN.md, hotel map).
 *
 * A hotel segment carries a street address but no coordinates. This module
 * derives a pin location from what a segment already has — coordinates an
 * importer may have tucked into `raw`, or a maps link in
 * `url` — and otherwise leaves the address for the query layer to geocode.
 * Everything here is React-Native-free so it unit-tests in isolation and the
 * HotelMap component stays a thin renderer (hard rule 7).
 */

export type LatLng = { lat: number; lng: number };

export type MetroStation = {
  name: string;
  lat: number;
  lng: number;
  /** Straight-line metres from the hotel, rounded. */
  distanceM: number;
  /** OSM station kind — "subway", "light_rail", … — for the readout label. */
  kind: string | null;
};

/** A raw Overpass element (node, or way/relation with a computed centre). */
export type OverpassElement = {
  type?: string;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

/** Nominatim's usage policy asks apps to identify themselves (hard rule 3 is
 * unaffected — this is an identifier, not a secret). */
// Nominatim's usage policy asks for an identifying User-Agent. Forks should
// set their own app name and contact URL here.
export const NOMINATIM_UA = "TravelHub/1.0 (open-source travel app; hotel map)";
export const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
export const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

/** Valid on the globe, and not Null Island — (0,0) is almost always a
 * failed parse or an empty field rather than a real hotel. */
export function isValidLatLng(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(Math.abs(lat) < 1e-6 && Math.abs(lng) < 1e-6)
  );
}

function toNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function firstNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  const lowered = Object.keys(obj);
  for (const wanted of keys) {
    const key = lowered.find((k) => k.toLowerCase() === wanted);
    if (key !== undefined) {
      const n = toNum(obj[key]);
      if (n != null) return n;
    }
  }
  return null;
}

/**
 * Walk a `raw` payload for a lat/lng pair (any of the common key
 * spellings), depth-first and guarded against cycles. Best-effort: if no
 * importer wrote coordinates, this returns null and geocoding takes over.
 */
export function coordsFromRaw(raw: unknown): LatLng | null {
  const seen = new Set<unknown>();
  function walk(node: unknown, depth: number): LatLng | null {
    if (!node || typeof node !== "object" || depth > 6 || seen.has(node)) return null;
    seen.add(node);
    const obj = node as Record<string, unknown>;
    const lat = firstNumber(obj, ["lat", "latitude"]);
    const lng = firstNumber(obj, ["lng", "lon", "long", "longitude"]);
    if (lat != null && lng != null && isValidLatLng(lat, lng)) return { lat, lng };
    for (const key of Object.keys(obj)) {
      const found = walk(obj[key], depth + 1);
      if (found) return found;
    }
    return null;
  }
  return walk(raw, 0);
}

// Coordinate shapes seen in the maps links bookings tend to carry.
const URL_COORD_PATTERNS: RegExp[] = [
  /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/, // google maps /@lat,lng,zoom
  /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/, // google place !3dlat!4dlng
  /[?&](?:mlat)=(-?\d+(?:\.\d+)?)&(?:mlon)=(-?\d+(?:\.\d+)?)/i, // osm marker
  /#map=\d+\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/, // osm #map=z/lat/lng
  /^geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i, // geo: URI
  /[?&#](?:q|query|ll|sll|center|coordinate|destination|daddr)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i,
];

/** Pull a hotel pin out of a maps link (Google / Apple / OSM / geo:), if any. */
export function parseCoordsFromUrl(url: string | null | undefined): LatLng | null {
  if (!url) return null;
  for (const re of URL_COORD_PATTERNS) {
    const m = url.match(re);
    if (m && m[1] && m[2]) {
      const lat = parseFloat(m[1]);
      const lng = parseFloat(m[2]);
      if (isValidLatLng(lat, lng)) return { lat, lng };
    }
  }
  return null;
}

type HotelLike = { raw?: unknown; url?: string | null };

/** Coordinates already knowable from the segment, preferring an explicit
 * `raw` payload over a link parsed out of `url`. Null ⇒ geocode the address. */
export function resolveHotelCoords(seg: HotelLike): LatLng | null {
  return coordsFromRaw(seg.raw) ?? parseCoordsFromUrl(seg.url);
}

type AddressLike = {
  address?: string | null;
  title?: string | null;
  arrive_place?: string | null;
  depart_place?: string | null;
};

/** The best free-text query to hand a geocoder: the street address if we have
 * one, else the hotel name plus its city. Null when there's nothing to place. */
export function hotelQuery(seg: AddressLike): string | null {
  if (seg.address && seg.address.trim()) return seg.address.trim();
  const parts = [seg.title, seg.arrive_place ?? seg.depart_place].filter(
    (p): p is string => !!p && !!p.trim(),
  );
  return parts.length ? parts.join(", ") : null;
}

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "240 m" (rounded to 10 m) under a kilometre, else "1.2 km". en-GB. */
export function metroDistanceLabel(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/** A human label for the station kind — subway reads as "Metro" everywhere. */
export function metroKindLabel(kind: string | null): string {
  switch (kind) {
    case "subway":
      return "Metro";
    case "light_rail":
      return "Light rail";
    case "monorail":
      return "Monorail";
    case "tram":
      return "Tram";
    default:
      return "Metro";
  }
}

/** The Overpass QL for metro-like stations within `radiusM` of the hotel. */
export function overpassQuery(hotel: LatLng, radiusM = 2000): string {
  const around = `around:${radiusM},${hotel.lat},${hotel.lng}`;
  return [
    "[out:json][timeout:20];",
    "(",
    `node["railway"="station"]["station"="subway"](${around});`,
    `node["railway"="station"]["subway"="yes"](${around});`,
    `node["station"="subway"](${around});`,
    `node["railway"="station"]["station"="light_rail"](${around});`,
    `node["railway"="station"]["station"="monorail"](${around});`,
    ");",
    "out body;",
  ].join("");
}

/** The Nominatim search URL for a free-text address. */
export function nominatimSearchUrl(address: string): string {
  return `${NOMINATIM_URL}?format=jsonv2&limit=1&addressdetails=0&q=${encodeURIComponent(address)}`;
}

/** The nearest *named* station among Overpass elements, or null if none. */
export function nearestMetroFrom(elements: OverpassElement[], hotel: LatLng): MetroStation | null {
  let best: MetroStation | null = null;
  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    const name = el.tags?.name;
    if (lat == null || lon == null || !name) continue;
    const distanceM = Math.round(haversineMeters(hotel, { lat, lng: lon }));
    if (!best || distanceM < best.distanceM) {
      best = { name, lat, lng: lon, distanceM, kind: el.tags?.station ?? el.tags?.railway ?? null };
    }
  }
  return best;
}

/**
 * A self-contained Leaflet page for the WebView: OpenStreetMap tiles (no API
 * key — hard rule 3), a hotel pin, the nearest-metro pin and a dashed link
 * between them. Colours are injected from the theme, never baked in (rule 2);
 * every dynamic value is JSON-encoded so a hotel name with quotes can't break
 * the script, and `<` is escaped so a name containing `</script>` (hotel
 * titles arrive from forwarded booking emails) can't close the tag and inject
 * its own markup into the WebView.
 */
export function buildLeafletHtml(opts: {
  hotel: LatLng;
  metro: MetroStation | null;
  hotelColor: string;
  metroColor: string;
  pinStroke: string;
  background: string;
  hotelLabel: string;
}): string {
  const data = JSON.stringify({
    hotel: opts.hotel,
    metro: opts.metro,
    hotelColor: opts.hotelColor,
    metroColor: opts.metroColor,
    pinStroke: opts.pinStroke,
    hotelLabel: opts.hotelLabel,
  }).replace(/</g, "\\u003c");
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; }
  #map, .leaflet-container { background: ${opts.background}; }
  .leaflet-control-attribution { font-size: 9px; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
<script>
  var D = ${data};
  var map = L.map('map', { zoomControl: true, scrollWheelZoom: false });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  function dot(latlng, color, radius, label) {
    var m = L.circleMarker(latlng, {
      radius: radius, color: D.pinStroke, weight: 2, fillColor: color, fillOpacity: 1
    }).addTo(map);
    if (label) m.bindTooltip(label, { direction: 'top', offset: [0, -radius] });
    return m;
  }
  var hotel = [D.hotel.lat, D.hotel.lng];
  dot(hotel, D.hotelColor, 9, D.hotelLabel);
  if (D.metro) {
    var metro = [D.metro.lat, D.metro.lng];
    dot(metro, D.metroColor, 7, D.metro.name);
    L.polyline([hotel, metro], { color: D.metroColor, weight: 2, dashArray: '4,6', opacity: 0.85 }).addTo(map);
    map.fitBounds([hotel, metro], { padding: [42, 42], maxZoom: 16 });
  } else {
    map.setView(hotel, 15);
  }
</script>
</body>
</html>`;
}
