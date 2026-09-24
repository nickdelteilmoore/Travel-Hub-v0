import { coverSlugs, coverKeys, resolveCoverFrom, resolveCoverImage, postcardSVG } from "./cover";
import type { TravelTrip } from "./queries";

// A trip carrying only the fields the resolver reads.
const trip = (title: string, cc: string | null): TravelTrip =>
  ({ title, primary_country_code: cc } as unknown as TravelTrip);

describe("coverSlugs", () => {
  it("slugifies the title and strips accents", () => {
    expect(coverSlugs(trip("Béziers", "fr"))).toContain("beziers");
    expect(coverSlugs(trip("Palermo", "it"))).toContain("palermo");
  });

  it("offers the first place of a multi-city title, most specific first", () => {
    const slugs = coverSlugs(trip("Rome & Florence", "it"));
    expect(slugs[0]).toBe("rome-florence");
    expect(slugs).toContain("rome");
  });

  it("offers the first word of a descriptive title", () => {
    expect(coverSlugs(trip("Nairobi work trip", "ke"))).toContain("nairobi");
  });

  it("dedupes and is empty for an empty title", () => {
    expect(coverSlugs(trip("", "fr"))).toEqual([]);
    const s = coverSlugs(trip("Paris", "fr"));
    expect(new Set(s).size).toBe(s.length);
  });
});

describe("coverKeys", () => {
  it("puts each city key before the bare country key", () => {
    expect(coverKeys(trip("Palermo", "IT"))).toEqual(["it-palermo", "it"]);
  });

  it("lowercases and trims the country code", () => {
    expect(coverKeys(trip("Geneva", " CH "))).toEqual(["ch-geneva", "ch"]);
  });

  it("is empty without a country code — nothing to key on", () => {
    expect(coverKeys(trip("Somewhere", null))).toEqual([]);
    expect(coverKeys(trip("Somewhere", ""))).toEqual([]);
  });
});

describe("resolveCoverFrom", () => {
  const covers = { "it-palermo": 1, "es-barcelona": 2, fr: 3 };

  it("matches a city photo from the trip title", () => {
    expect(resolveCoverFrom(trip("Palermo, Sicily", "it"), covers)).toBe(1);
    expect(resolveCoverFrom(trip("Barcelona", "es"), covers)).toBe(2);
  });

  it("falls back to the country photo when no city matches", () => {
    expect(resolveCoverFrom(trip("Vernon", "fr"), covers)).toBe(3);
  });

  it("returns null when no candidate key has a photo", () => {
    expect(resolveCoverFrom(trip("Lisbon", "pt"), covers)).toBeNull();
  });

  it("returns null without a country code", () => {
    expect(resolveCoverFrom(trip("Palermo", null), covers)).toBeNull();
  });
});

describe("resolveCoverImage", () => {
  it("returns null with no photos bundled, so the postcard shows", () => {
    expect(resolveCoverImage(trip("Palermo, Sicily", "it"))).toBeNull();
  });
});

describe("postcardSVG", () => {
  it("is deterministic for a given seed", () => {
    expect(postcardSVG("Palermo")).toBe(postcardSVG("Palermo"));
  });

  it("differs across seeds and returns a self-contained svg", () => {
    const a = postcardSVG("Palermo");
    expect(a.startsWith("<svg")).toBe(true);
    expect(a).not.toBe(postcardSVG("Reykjavik"));
  });
});
