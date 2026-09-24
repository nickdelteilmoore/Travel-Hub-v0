import { haversineKm, pickFactor, estimate, total, formatKg } from "./carbon";

const LHR = { lat: 51.4706, lon: -0.461941 };
const BCN = { lat: 41.297077, lon: 2.078463 };
const JFK = { lat: 40.639801, lon: -73.7789 };

describe("carbon", () => {
  it("matches the published great-circle distance", () => {
    expect(Math.abs((haversineKm(LHR, BCN) ?? 0) - 1147.7)).toBeLessThan(1);
    expect(Math.abs((haversineKm(LHR, JFK) ?? 0) - 5539.7)).toBeLessThan(1);
  });

  it("agrees with the SQL function to a tenth", () => {
    expect(haversineKm(LHR, BCN)).toBe(1147.7);
  });

  it("returns null rather than zero for a missing point", () => {
    expect(haversineKm(LHR, null)).toBeNull();
    expect(haversineKm(LHR, { lat: 1, lon: null })).toBeNull();
  });

  it("picks different factors by distance band", () => {
    expect(pickFactor("flight", "economy", 800)?.kgPerPkm).toBe(0.15298);
    expect(pickFactor("flight", "economy", 2000)?.kgPerPkm).toBe(0.08654);
    expect(pickFactor("flight", "economy", 6000)?.kgPerPkm).toBe(0.14775);
  });

  it("falls an unknown cabin back to economy", () => {
    expect(pickFactor("flight", "sardine", 6000)?.cabin).toBe("economy");
  });

  it("prices business long-haul at about three times economy", () => {
    const eco = estimate({ mode: "flight", cabin: "economy", from: LHR, to: JFK });
    const biz = estimate({ mode: "flight", cabin: "business", from: LHR, to: JFK });
    const ratio = (biz?.kg ?? 0) / (eco?.kg ?? 1);
    expect(ratio).toBeGreaterThan(2.5);
    expect(ratio).toBeLessThan(3.5);
  });

  it("adds the indirect-routing detour to flights but not trains", () => {
    const flight = estimate({ mode: "flight", cabin: "economy", km: 1000 });
    const train = estimate({ mode: "train", km: 1000 });
    expect(flight?.km).toBe(1080);
    expect(flight?.detour).toBe(true);
    expect(train?.km).toBe(1000);
    expect(train?.detour).toBe(false);
  });

  it("returns null for an unpriceable segment", () => {
    expect(estimate({ mode: "note", km: 100 })).toBeNull();
    expect(estimate({ mode: "flight", cabin: "economy" })).toBeNull();
  });

  it("prefers a stored figure and counts what it could not price", () => {
    const sum = total([
      { segment_type: "flight", co2_kg: 120, distance_km: 800 },
      { segment_type: "train", distance_km: 500 },
      { segment_type: "note" },
    ]);
    expect(sum.priced).toBe(2);
    expect(sum.skipped).toBe(1);
    expect(sum.kg).toBeGreaterThan(120);
    expect(sum.kg).toBeLessThan(160);
  });

  it("switches to tonnes past 1000", () => {
    expect(formatKg(340)).toBe("340 kg");
    expect(formatKg(1240.7)).toBe("1.2 t");
    expect(formatKg(12400)).toBe("12 t");
    expect(formatKg(null)).toBe("—");
  });
});
