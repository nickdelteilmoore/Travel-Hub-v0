import { addDays, format, parseISO, subDays } from "date-fns";

import {
  computeSchengenStatus,
  daysCountedFor,
  daysUsed,
  levelFor,
  schengenPresenceKeys,
  type SchengenEntry,
} from "./schengen";

const TODAY = parseISO("2024-07-23");
const iso = (d: Date) => format(d, "yyyy-MM-dd");

const schengen = (entryDate: string, exitDate: string | null): SchengenEntry => ({
  entryDate,
  exitDate,
  isSchengen: true,
});

describe("schengen presence days", () => {
  it("counts entry and exit days inclusively (Rule 1)", () => {
    // 12–23 Jul inclusive = 12 days.
    expect(daysUsed([schengen("2024-07-12", "2024-07-23")], TODAY)).toBe(12);
  });

  it("treats a null exit date as ongoing until today (Rule 2)", () => {
    // Entered 5 days ago, still here → today-4 .. today = 5 days.
    const entry = iso(subDays(TODAY, 4));
    expect(daysUsed([schengen(entry, null)], TODAY)).toBe(5);
  });

  it("dedupes overlapping entries as a date set (Rule 3)", () => {
    const entries = [
      schengen("2024-07-12", "2024-07-18"), // 7 days
      schengen("2024-07-15", "2024-07-23"), // 9 days, overlaps 15–18
    ];
    // 16 raw days but only 12 distinct (12–23 Jul).
    expect(schengenPresenceKeys(entries, TODAY).size).toBe(12);
    expect(daysUsed(entries, TODAY)).toBe(12);
  });

  it("ignores non-Schengen countries", () => {
    const entries: SchengenEntry[] = [
      { entryDate: "2024-06-19", exitDate: "2024-07-02", isSchengen: false },
    ];
    expect(daysUsed(entries, TODAY)).toBe(0);
  });

  it("excludes presence days older than the 180-day window", () => {
    const start = iso(subDays(TODAY, 300));
    const end = iso(subDays(TODAY, 290));
    expect(daysUsed([schengen(start, end)], TODAY)).toBe(0);
  });

  it("counts only the in-window portion of a straddling trip", () => {
    // Starts 185 days ago, ends 175 days ago → window edge is day 179.
    const start = iso(subDays(TODAY, 185));
    const end = iso(subDays(TODAY, 175));
    // In-window days: 179..175 ago inclusive = 5 days.
    expect(daysUsed([schengen(start, end)], TODAY)).toBe(5);
  });
});

describe("daysCountedFor (per-trip readout)", () => {
  it("counts the whole trip when it sits inside the window", () => {
    expect(daysCountedFor(schengen("2024-07-12", "2024-07-23"), TODAY)).toBe(12);
  });

  it("counts only the in-window portion of a straddling trip", () => {
    const start = iso(subDays(TODAY, 185));
    const end = iso(subDays(TODAY, 175));
    expect(daysCountedFor(schengen(start, end), TODAY)).toBe(5);
  });

  it("is zero once a trip has aged out of the window", () => {
    const start = iso(subDays(TODAY, 300));
    const end = iso(subDays(TODAY, 290));
    expect(daysCountedFor(schengen(start, end), TODAY)).toBe(0);
  });

  it("is zero for a non-Schengen country", () => {
    const entry: SchengenEntry = {
      entryDate: "2024-07-12",
      exitDate: "2024-07-23",
      isSchengen: false,
    };
    expect(daysCountedFor(entry, TODAY)).toBe(0);
  });

  it("runs an ongoing trip up to today", () => {
    expect(daysCountedFor(schengen(iso(subDays(TODAY, 4)), null), TODAY)).toBe(5);
  });

  it("ignores days a planned trip has not reached yet", () => {
    const start = iso(addDays(TODAY, 3));
    const end = iso(addDays(TODAY, 10));
    expect(daysCountedFor(schengen(start, end), TODAY)).toBe(0);
  });

  it("sums to the headline total across non-overlapping trips", () => {
    const trips = [
      schengen(iso(subDays(TODAY, 300)), iso(subDays(TODAY, 290))), // aged out
      schengen(iso(subDays(TODAY, 40)), iso(subDays(TODAY, 34))),
      schengen(iso(subDays(TODAY, 9)), null),
    ];
    const perTrip = trips.reduce((n, t) => n + daysCountedFor(t, TODAY), 0);
    expect(perTrip).toBe(computeSchengenStatus(trips, TODAY).used);
  });
});

describe("status levels", () => {
  it("maps used counts to colour levels", () => {
    expect(levelFor(0)).toBe("safe");
    expect(levelFor(74)).toBe("safe");
    expect(levelFor(75)).toBe("warning");
    expect(levelFor(89)).toBe("warning");
    expect(levelFor(90)).toBe("danger");
    expect(levelFor(120)).toBe("danger");
  });

  it("floors remaining at zero when over the limit", () => {
    const start = iso(subDays(TODAY, 99));
    const status = computeSchengenStatus([schengen(start, null)], TODAY);
    expect(status.used).toBe(100);
    expect(status.remaining).toBe(0);
    expect(status.level).toBe("danger");
  });
});

describe("mustExitBy (Rule 5)", () => {
  it("allows a full 90-day stay from an empty history", () => {
    const status = computeSchengenStatus([], TODAY);
    // today..today+89 inclusive = 90 days.
    expect(status.mustExitBy).not.toBeNull();
    expect(iso(status.mustExitBy!)).toBe(iso(addDays(TODAY, 89)));
  });

  it("shortens the allowance by prior in-window presence", () => {
    // 10 prior days already used → 80 remaining → exit by today+79.
    const prior = schengen(iso(subDays(TODAY, 20)), iso(subDays(TODAY, 11)));
    const status = computeSchengenStatus([prior], TODAY);
    expect(status.used).toBe(10);
    expect(iso(status.mustExitBy!)).toBe(iso(addDays(TODAY, 79)));
  });
});

describe("nextFreeUp (Rule 6)", () => {
  it("is null when nothing is used", () => {
    expect(computeSchengenStatus([], TODAY).nextFreeUp).toBeNull();
  });

  it("is the oldest in-window day plus 180 days", () => {
    const status = computeSchengenStatus(
      [schengen("2024-07-12", "2024-07-23")],
      TODAY,
    );
    expect(iso(status.nextFreeUp!)).toBe(iso(addDays(parseISO("2024-07-12"), 180)));
  });
});
