import {
  buildLeafletHtml,
  coordsFromRaw,
  haversineMeters,
  hotelQuery,
  isValidLatLng,
  metroDistanceLabel,
  metroKindLabel,
  nearestMetroFrom,
  overpassQuery,
  parseCoordsFromUrl,
  resolveHotelCoords,
  type OverpassElement,
} from "./hotelMap";

describe("isValidLatLng", () => {
  it("accepts a real point", () => {
    expect(isValidLatLng(48.8584, 2.2945)).toBe(true);
  });
  it("rejects out-of-range and Null Island", () => {
    expect(isValidLatLng(91, 0)).toBe(false);
    expect(isValidLatLng(0, 200)).toBe(false);
    expect(isValidLatLng(0, 0)).toBe(false);
    expect(isValidLatLng(NaN, 1)).toBe(false);
  });
});

describe("coordsFromRaw", () => {
  it("reads flat lat/lng", () => {
    expect(coordsFromRaw({ lat: 51.5, lng: -0.12 })).toEqual({ lat: 51.5, lng: -0.12 });
  });
  it("reads latitude/longitude and numeric strings", () => {
    expect(coordsFromRaw({ latitude: "40.4168", longitude: "-3.7038" })).toEqual({
      lat: 40.4168,
      lng: -3.7038,
    });
  });
  it("digs into a nested geo object", () => {
    expect(coordsFromRaw({ hotel: { geo: { lat: 41.9, lon: 12.5 } } })).toEqual({
      lat: 41.9,
      lng: 12.5,
    });
  });
  it("returns null when there are no coordinates", () => {
    expect(coordsFromRaw({ name: "Grand Hotel", city: "Rome" })).toBeNull();
    expect(coordsFromRaw(null)).toBeNull();
    expect(coordsFromRaw("nope")).toBeNull();
  });
  it("ignores a (0,0) pair", () => {
    expect(coordsFromRaw({ lat: 0, lng: 0 })).toBeNull();
  });
});

describe("parseCoordsFromUrl", () => {
  it("parses a google maps @lat,lng link", () => {
    expect(parseCoordsFromUrl("https://www.google.com/maps/@48.8584,2.2945,17z")).toEqual({
      lat: 48.8584,
      lng: 2.2945,
    });
  });
  it("parses a google place !3d!4d link", () => {
    expect(parseCoordsFromUrl("https://maps.google.com/x!3d40.6892!4d-74.0445")).toEqual({
      lat: 40.6892,
      lng: -74.0445,
    });
  });
  it("parses a q= query link", () => {
    expect(parseCoordsFromUrl("https://maps.apple.com/?q=35.6586,139.7454")).toEqual({
      lat: 35.6586,
      lng: 139.7454,
    });
  });
  it("parses an osm #map fragment and a geo: URI", () => {
    expect(parseCoordsFromUrl("https://www.openstreetmap.org/#map=17/52.5200/13.4050")).toEqual({
      lat: 52.52,
      lng: 13.405,
    });
    expect(parseCoordsFromUrl("geo:59.3293,18.0686")).toEqual({ lat: 59.3293, lng: 18.0686 });
  });
  it("returns null for a plain booking link or nothing", () => {
    expect(parseCoordsFromUrl("https://booking.com/hotel/fr/grand.html")).toBeNull();
    expect(parseCoordsFromUrl(null)).toBeNull();
  });
});

describe("resolveHotelCoords", () => {
  it("prefers raw coordinates over a url", () => {
    expect(
      resolveHotelCoords({ raw: { lat: 51.5, lng: -0.12 }, url: "https://maps.google.com/@1,1,17z" }),
    ).toEqual({ lat: 51.5, lng: -0.12 });
  });
  it("falls back to the url when raw has none", () => {
    expect(resolveHotelCoords({ raw: { ref: "ABC" }, url: "geo:41.9,12.5" })).toEqual({
      lat: 41.9,
      lng: 12.5,
    });
  });
  it("returns null when neither carries coordinates", () => {
    expect(resolveHotelCoords({ raw: null, url: null })).toBeNull();
  });
});

describe("hotelQuery", () => {
  it("uses the street address when present", () => {
    expect(hotelQuery({ address: "10 Rue de Rivoli, Paris", title: "Hôtel X" })).toBe(
      "10 Rue de Rivoli, Paris",
    );
  });
  it("falls back to name plus place", () => {
    expect(hotelQuery({ address: null, title: "Hôtel X", arrive_place: "Paris" })).toBe(
      "Hôtel X, Paris",
    );
  });
  it("returns null with nothing to place", () => {
    expect(hotelQuery({ address: "  ", title: null, arrive_place: null, depart_place: null })).toBeNull();
  });
});

describe("haversineMeters", () => {
  it("measures a known short distance", () => {
    // Eiffel Tower → Arc de Triomphe ≈ 2.8 km.
    const d = haversineMeters({ lat: 48.8584, lng: 2.2945 }, { lat: 48.8738, lng: 2.295 });
    expect(d).toBeGreaterThan(1600);
    expect(d).toBeLessThan(1800);
  });
  it("is zero for the same point", () => {
    expect(haversineMeters({ lat: 1, lng: 1 }, { lat: 1, lng: 1 })).toBe(0);
  });
});

describe("metroDistanceLabel", () => {
  it("rounds metres to 10 under a km", () => {
    expect(metroDistanceLabel(243)).toBe("240 m");
  });
  it("switches to km above 1000 m", () => {
    expect(metroDistanceLabel(1240)).toBe("1.2 km");
  });
});

describe("metroKindLabel", () => {
  it("maps subway to Metro and passes others through", () => {
    expect(metroKindLabel("subway")).toBe("Metro");
    expect(metroKindLabel("light_rail")).toBe("Light rail");
    expect(metroKindLabel(null)).toBe("Metro");
  });
});

describe("nearestMetroFrom", () => {
  const hotel = { lat: 48.8584, lng: 2.2945 };
  it("picks the nearest named station and reads its kind", () => {
    const els: OverpassElement[] = [
      { type: "node", lat: 48.87, lon: 2.3, tags: { name: "Far", station: "subway" } },
      { type: "node", lat: 48.859, lon: 2.293, tags: { name: "Near", railway: "station", station: "subway" } },
    ];
    const metro = nearestMetroFrom(els, hotel);
    expect(metro?.name).toBe("Near");
    expect(metro?.kind).toBe("subway");
    expect(metro?.distanceM).toBeGreaterThan(0);
  });
  it("uses a way/relation centre and skips unnamed or coord-less elements", () => {
    const els: OverpassElement[] = [
      { type: "way", center: { lat: 48.8585, lon: 2.2946 }, tags: { name: "Centre", railway: "station" } },
      { type: "node", lat: 48.8585, lon: 2.2946, tags: { railway: "station" } }, // unnamed
      { type: "node", tags: { name: "No coords" } },
    ];
    expect(nearestMetroFrom(els, hotel)?.name).toBe("Centre");
  });
  it("returns null when there are no usable stations", () => {
    expect(nearestMetroFrom([], hotel)).toBeNull();
  });
});

describe("overpassQuery", () => {
  it("embeds the radius and coordinates", () => {
    const q = overpassQuery({ lat: 48.8584, lng: 2.2945 }, 1500);
    expect(q).toContain("around:1500,48.8584,2.2945");
    expect(q).toContain('["station"="subway"]');
    expect(q.startsWith("[out:json]")).toBe(true);
  });
});

describe("buildLeafletHtml", () => {
  const base = {
    hotel: { lat: 48.8584, lng: 2.2945 },
    hotelColor: "#23464C",
    metroColor: "#C87443",
    pinStroke: "#FFFFFF",
    background: "#FFFFFF",
    hotelLabel: 'The "Grand" Hotel',
  };
  it("includes the hotel coordinates and injected colours", () => {
    const html = buildLeafletHtml({ ...base, metro: null });
    expect(html).toContain("48.8584");
    expect(html).toContain("#23464C");
    expect(html).toContain("leaflet@1.9.4");
    // A quote in the label must be JSON-escaped, not left to break the script.
    expect(html).toContain('The \\"Grand\\" Hotel');
  });
  it("draws the metro pin only when a station is given", () => {
    const withMetro = buildLeafletHtml({
      ...base,
      metro: { name: "Trocadéro", lat: 48.8637, lng: 2.2876, distanceM: 600, kind: "subway" },
    });
    expect(withMetro).toContain("Trocadéro");
    expect(withMetro).toContain("fitBounds");
  });
  it("can't be broken out of the script tag by a hostile hotel name", () => {
    const html = buildLeafletHtml({
      ...base,
      metro: null,
      hotelLabel: "</script><img src=x onerror=alert(1)>",
    });
    // Only the page's own two script tags close; the label's stays escaped.
    expect(html.match(/<\/script>/g)).toHaveLength(2);
    expect(html).not.toContain("<img");
    expect(html).toContain("\\u003c/script>");
  });
  it("pins the Leaflet assets with subresource integrity", () => {
    const html = buildLeafletHtml({ ...base, metro: null });
    expect(html.match(/integrity="sha256-/g)).toHaveLength(2);
  });
});
