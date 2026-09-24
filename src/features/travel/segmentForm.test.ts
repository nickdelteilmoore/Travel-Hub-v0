import { composeSegmentRow } from "./segmentForm";
import type { TravelAirportRow } from "./queries";

const airport = (
  iata: string,
  tz: string,
  country: string,
  city: string,
  lat: number,
  lon: number,
): TravelAirportRow => ({
  iata,
  icao: null,
  name: `${city} Airport`,
  city,
  country_code: country,
  tz,
  latitude: lat,
  longitude: lon,
});

const airports = new Map<string, TravelAirportRow>([
  ["LGW", airport("LGW", "Europe/London", "GB", "London", 51.1537, -0.1821)],
  ["BCN", airport("BCN", "Europe/Madrid", "ES", "Barcelona", 41.2971, 2.0785)],
]);

describe("composeSegmentRow", () => {
  it("turns wall clocks into instants using the airport's zone", () => {
    const row = composeSegmentRow(
      {
        segment_type: "flight",
        carrier: "vy",
        number: "7827",
        depart_iata: "lgw",
        arrive_iata: "bcn",
        depart_day: "2026-09-15",
        depart_time: "14:30",
        arrive_day: "2026-09-15",
        arrive_time: "17:40",
      },
      airports,
    );

    // 14:30 BST = 13:30Z; 17:40 CEST = 15:40Z.
    expect(row.depart_at).toBe("2026-09-15T13:30:00.000Z");
    expect(row.arrive_at).toBe("2026-09-15T15:40:00.000Z");
    expect(row.depart_tz).toBe("Europe/London");
    expect(row.arrive_tz).toBe("Europe/Madrid");
    expect(row.depart_country_code).toBe("GB");
    expect(row.arrive_country_code).toBe("ES");
    expect(row.depart_iata).toBe("LGW");
    expect(row.carrier).toBe("vy");
    expect(row.status).toBe("confirmed");
    expect(row.source).toBe("manual");
  });

  it("stores distance and CO₂ when both airports have coordinates", () => {
    const row = composeSegmentRow(
      {
        segment_type: "flight",
        cabin: "economy",
        depart_iata: "LGW",
        arrive_iata: "BCN",
        depart_day: "2026-09-15",
        depart_time: "14:30",
      },
      airports,
    );
    expect(row.distance_km).toBeGreaterThan(1000);
    expect(row.co2_kg).toBeGreaterThan(0);
  });

  it("falls back to the home zone with no airport, and leaves arrival open", () => {
    const row = composeSegmentRow(
      {
        segment_type: "hotel",
        title: "Catalonia Avinyó",
        depart_day: "2026-09-15",
        depart_time: "15:00",
      },
      airports,
      "Europe/Madrid",
    );
    expect(row.depart_tz).toBe("Europe/Madrid");
    expect(row.arrive_at).toBeNull();
    expect(row.distance_km).toBeUndefined();
    expect(row.title).toBe("Catalonia Avinyó");
  });
});
