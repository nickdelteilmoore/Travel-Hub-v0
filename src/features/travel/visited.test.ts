import { visitedCountrySet } from "./visited";

const trip = (country_code: string, transit = false) => ({ country_code, transit });

describe("visitedCountrySet", () => {
  it("counts a country with an ordinary trip", () => {
    expect(visitedCountrySet([trip("FR")])).toEqual(new Set(["FR"]));
  });

  it("does not count a country only ever passed through", () => {
    expect(visitedCountrySet([trip("TH", true)])).toEqual(new Set());
  });

  it("counts a country that has both a layover and a real trip", () => {
    expect(visitedCountrySet([trip("TH", true), trip("TH")])).toEqual(new Set(["TH"]));
  });

  it("counts a standalone country with no trip in the log", () => {
    expect(visitedCountrySet([], ["AR"])).toEqual(new Set(["AR"]));
  });

  it("de-duplicates a country that is both logged and recorded standalone", () => {
    expect(visitedCountrySet([trip("GB")], ["GB"])).toEqual(new Set(["GB"]));
  });

  it("is empty for a traveller with nothing recorded", () => {
    expect(visitedCountrySet([])).toEqual(new Set());
  });

  it("keeps the two facts independent: a layover plus a standalone row counts once", () => {
    // A country passed through on a layover, never listed on its own.
    const visited = visitedCountrySet([trip("TH", true), trip("MM")], ["GB", "AR"]);
    expect(visited).toEqual(new Set(["MM", "GB", "AR"]));
  });
});
