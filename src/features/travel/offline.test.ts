import {
  buildOptimisticEntry,
  buildOptimisticExpense,
  buildOptimisticSegment,
  byEntryDateDesc,
  byExpenseRecencyDesc,
  bySegmentDepartAsc,
  isTempId,
  removeById,
  tempId,
  upsertById,
} from "./offline";
import type {
  Country,
  TravelAirportRow,
  TravelEntry,
  TravelSegmentRow,
  TripExpenseRow,
} from "./queries";

const airports = new Map<string, TravelAirportRow>([
  [
    "LGW",
    {
      iata: "LGW",
      icao: null,
      name: "London Airport",
      city: "London",
      country_code: "GB",
      tz: "Europe/London",
      latitude: 51.1537,
      longitude: -0.1821,
    },
  ],
]);

describe("temp ids", () => {
  it("mints distinguishable offline ids", () => {
    const id = tempId("seg");
    expect(isTempId(id)).toBe(true);
    expect(isTempId("a1b2c3d4-0000-0000-0000-000000000000")).toBe(false);
  });
});

describe("upsertById / removeById", () => {
  const rows = [
    { id: "a", n: 1 },
    { id: "b", n: 2 },
  ];

  it("prepends a new row", () => {
    expect(upsertById(rows, { id: "c", n: 3 }).map((r) => r.id)).toEqual(["c", "a", "b"]);
  });

  it("replaces an existing row in place", () => {
    const next = upsertById(rows, { id: "b", n: 9 });
    expect(next.map((r) => r.id)).toEqual(["a", "b"]);
    expect(next.find((r) => r.id === "b")?.n).toBe(9);
  });

  it("applies a comparator when given", () => {
    const next = upsertById(rows, { id: "c", n: 0 }, (x, y) => x.n - y.n);
    expect(next.map((r) => r.id)).toEqual(["c", "a", "b"]);
  });

  it("removes by id without mutating the input", () => {
    const next = removeById(rows, "a");
    expect(next.map((r) => r.id)).toEqual(["b"]);
    expect(rows).toHaveLength(2);
  });
});

describe("comparators match each list's ORDER BY", () => {
  it("orders entries by entry_date descending", () => {
    const a = { id: "a", entry_date: "2026-01-01" } as TravelEntry;
    const b = { id: "b", entry_date: "2026-03-01" } as TravelEntry;
    expect([a, b].sort(byEntryDateDesc).map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("orders expenses by spent_on desc with nulls last", () => {
    const dated = { id: "d", spent_on: "2026-02-02", created_at: "x" } as TripExpenseRow;
    const undated = { id: "u", spent_on: null, created_at: "x" } as TripExpenseRow;
    expect([undated, dated].sort(byExpenseRecencyDesc).map((r) => r.id)).toEqual(["d", "u"]);
  });

  it("orders segments by depart_at asc with nulls last", () => {
    const first = { id: "f", depart_at: "2026-01-01T00:00:00Z" } as TravelSegmentRow;
    const later = { id: "l", depart_at: "2026-01-02T00:00:00Z" } as TravelSegmentRow;
    const undated = { id: "n", depart_at: null } as TravelSegmentRow;
    expect([later, undated, first].sort(bySegmentDepartAsc).map((r) => r.id)).toEqual([
      "f",
      "l",
      "n",
    ]);
  });
});

describe("buildOptimisticEntry", () => {
  const country: Country = {
    code: "ES",
    name: "Spain",
    flag_emoji: "🇪🇸",
    is_schengen: true,
  } as Country;

  it("mints a temp id and attaches the country for a new entry", () => {
    const row = buildOptimisticEntry(
      {
        traveler_id: "me",
        country_code: "ES",
        entry_date: "2026-05-01",
        exit_date: null,
        notes: null,
      },
      country,
      null,
    );
    expect(isTempId(row.id)).toBe(true);
    expect(row.country?.name).toBe("Spain");
    expect(row.transit).toBe(false);
  });

  it("keeps the existing id and created_at when editing", () => {
    const existing = {
      id: "real",
      created_at: "2020-01-01T00:00:00Z",
      transit: true,
      country_code: "ES",
      country: { code: "ES", name: "Spain", flag_emoji: "🇪🇸", is_schengen: true },
    } as TravelEntry;
    const row = buildOptimisticEntry(
      {
        id: "real",
        traveler_id: "me",
        country_code: "ES",
        entry_date: "2026-05-02",
        exit_date: "2026-05-09",
        notes: "beach",
      },
      country,
      existing,
    );
    expect(row.id).toBe("real");
    expect(row.created_at).toBe("2020-01-01T00:00:00Z");
    expect(row.transit).toBe(true);
    expect(row.exit_date).toBe("2026-05-09");
  });
});

describe("buildOptimisticExpense", () => {
  it("mints a temp id and carries the fields for a new expense", () => {
    const row = buildOptimisticExpense(
      {
        tripId: "t1",
        travellerId: "me",
        spent_on: "2026-05-01",
        currency: "EUR",
        amount: 12.5,
        reason: "Dinner",
        photoPath: null,
      },
      null,
    );
    expect(isTempId(row.id)).toBe(true);
    expect(row.trip_id).toBe("t1");
    expect(row.amount).toBe(12.5);
    expect(row.photo_path).toBeNull();
  });

  it("preserves created_at when editing", () => {
    const existing = {
      id: "e1",
      created_at: "2020-01-01T00:00:00Z",
    } as TripExpenseRow;
    const row = buildOptimisticExpense(
      {
        id: "e1",
        tripId: "t1",
        travellerId: "me",
        spent_on: null,
        currency: null,
        amount: null,
        reason: null,
        photoPath: "me/t1/x.jpg",
      },
      existing,
    );
    expect(row.id).toBe("e1");
    expect(row.created_at).toBe("2020-01-01T00:00:00Z");
    expect(row.photo_path).toBe("me/t1/x.jpg");
  });
});

describe("buildOptimisticSegment", () => {
  it("composes an instant off the airport zone under a temp id", () => {
    const row = buildOptimisticSegment(
      {
        trip_id: "t1",
        segment_type: "flight",
        carrier: "BA",
        number: "2760",
        depart_iata: "lgw",
        depart_day: "2026-09-15",
        depart_time: "06:55",
      },
      airports,
      "me",
      null,
    );
    expect(isTempId(row.id)).toBe(true);
    expect(row.trip_id).toBe("t1");
    expect(row.traveller_id).toBe("me");
    // 06:55 BST = 05:55Z, read through the LGW zone.
    expect(row.depart_at).toBe("2026-09-15T05:55:00.000Z");
    expect(row.depart_tz).toBe("Europe/London");
    expect(row.segment_type).toBe("flight");
  });

  it("keeps an edited segment's id and created_at", () => {
    const existing = {
      id: "seg-real",
      created_at: "2020-01-01T00:00:00Z",
      trip_id: "t1",
    } as TravelSegmentRow;
    const row = buildOptimisticSegment(
      {
        id: "seg-real",
        trip_id: "t1",
        segment_type: "flight",
        depart_day: "2026-09-15",
        depart_time: "06:55",
      },
      airports,
      "me",
      existing,
    );
    expect(row.id).toBe("seg-real");
    expect(row.created_at).toBe("2020-01-01T00:00:00Z");
  });
});
