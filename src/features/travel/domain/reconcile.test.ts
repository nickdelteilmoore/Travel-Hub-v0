import {
  resolveTrip,
  groupIntoTrips,
  timeline,
  presenceSpans,
  tripSpan,
  suggestTitle,
  segmentSpan,
  type ReconcileSegment,
} from "./reconcile";

const flight = (
  id: string,
  dep: string,
  arr: string,
  extra: Partial<ReconcileSegment> = {},
): ReconcileSegment => ({
  id,
  segment_type: "flight",
  depart_at: dep,
  depart_tz: "Europe/London",
  arrive_at: arr,
  arrive_tz: "Europe/Madrid",
  ...extra,
});

describe("resolveTrip", () => {
  it("joins a trip a segment falls inside", () => {
    const trips = [{ id: "a", start_date: "2026-09-10", end_date: "2026-09-13" }];
    const seg = flight("s", "2026-09-11T09:00:00Z", "2026-09-11T11:00:00Z");
    expect(resolveTrip(seg, trips)?.id).toBe("a");
  });

  it("still joins two days either side", () => {
    const trips = [{ id: "a", start_date: "2026-09-10", end_date: "2026-09-13" }];
    expect(resolveTrip(flight("s", "2026-09-08T09:00:00Z", "2026-09-08T11:00:00Z"), trips)?.id).toBe("a");
    expect(resolveTrip(flight("s", "2026-09-15T09:00:00Z", "2026-09-15T11:00:00Z"), trips)?.id).toBe("a");
  });

  it("starts a new trip three days out", () => {
    const trips = [{ id: "a", start_date: "2026-09-10", end_date: "2026-09-13" }];
    expect(resolveTrip(flight("s", "2026-09-16T09:00:00Z", "2026-09-16T11:00:00Z"), trips)).toBeNull();
  });

  it("joins the nearer of two candidate trips", () => {
    const trips = [
      { id: "far", start_date: "2026-09-01", end_date: "2026-09-05" },
      { id: "near", start_date: "2026-09-08", end_date: "2026-09-12" },
    ];
    expect(resolveTrip(flight("s", "2026-09-07T09:00:00Z", "2026-09-07T11:00:00Z"), trips)?.id).toBe("near");
  });
});

describe("groupIntoTrips", () => {
  it("splits on a gap of more than two days", () => {
    const trips = groupIntoTrips([
      flight("a", "2026-09-10T06:00:00Z", "2026-09-10T09:00:00Z"),
      flight("b", "2026-09-11T17:00:00Z", "2026-09-11T19:00:00Z"),
      flight("c", "2026-10-01T06:00:00Z", "2026-10-01T09:00:00Z"),
    ]);
    expect(trips.length).toBe(2);
    expect(trips[0]?.segments.length).toBe(2);
    expect(trips[0]?.start_date).toBe("2026-09-10");
    expect(trips[0]?.end_date).toBe("2026-09-11");
  });

  it("holds a trip together across a hotel", () => {
    const trips = groupIntoTrips([
      flight("a", "2026-09-10T06:00:00Z", "2026-09-10T09:00:00Z"),
      {
        id: "h",
        segment_type: "hotel",
        depart_at: "2026-09-10T13:00:00Z",
        arrive_at: "2026-09-13T09:00:00Z",
        depart_tz: "Europe/Madrid",
        arrive_tz: "Europe/Madrid",
      },
      flight("b", "2026-09-13T17:00:00Z", "2026-09-13T19:00:00Z"),
    ]);
    expect(trips.length).toBe(1);
    expect(trips[0]?.segments.length).toBe(3);
  });

  it("rejoins a return leg four days later when home is known", () => {
    const out = flight("a", "2026-09-07T06:00:00Z", "2026-09-07T09:00:00Z", {
      depart_country_code: "GB",
      arrive_country_code: "ES",
    });
    const back = flight("b", "2026-09-11T17:00:00Z", "2026-09-11T19:00:00Z", {
      depart_country_code: "ES",
      arrive_country_code: "GB",
    });
    expect(groupIntoTrips([out, back]).length).toBe(2);
    const merged = groupIntoTrips([out, back], { homeCountry: "GB" });
    expect(merged.length).toBe(1);
    expect(merged[0]?.end_date).toBe("2026-09-11");
  });

  it("closes a trip on arriving home, so the next departure is a new trip", () => {
    const segs = [
      flight("a", "2026-09-07T06:00:00Z", "2026-09-07T09:00:00Z", { depart_country_code: "GB", arrive_country_code: "ES" }),
      flight("b", "2026-09-08T17:00:00Z", "2026-09-08T19:00:00Z", { depart_country_code: "ES", arrive_country_code: "GB" }),
      flight("c", "2026-09-09T06:00:00Z", "2026-09-09T09:00:00Z", { depart_country_code: "GB", arrive_country_code: "FR" }),
    ];
    const trips = groupIntoTrips(segs, { homeCountry: "GB" });
    expect(trips.length).toBe(2);
    expect(trips[0]?.segments.length).toBe(2);
  });
});

describe("timeline", () => {
  it("counts a hotel's nights as covered, not as gaps", () => {
    const segs = [
      flight("a", "2026-09-10T06:00:00Z", "2026-09-10T09:00:00Z"),
      {
        id: "h",
        segment_type: "hotel",
        depart_at: "2026-09-10T13:00:00Z",
        arrive_at: "2026-09-13T09:00:00Z",
        depart_tz: "Europe/Madrid",
        arrive_tz: "Europe/Madrid",
      },
      flight("b", "2026-09-13T17:00:00Z", "2026-09-13T19:00:00Z"),
    ];
    const { gaps } = timeline(segs, { gapHours: 6 });
    expect(gaps.map((g) => g.beforeSegmentId)).toEqual(["b"]);
    expect(gaps[0]?.hours).toBe(8);
  });

  it("flags an unaccounted afternoon", () => {
    const segs = [
      flight("a", "2026-09-10T06:00:00Z", "2026-09-10T09:00:00Z"),
      flight("b", "2026-09-10T21:00:00Z", "2026-09-10T23:00:00Z"),
    ];
    const { gaps } = timeline(segs, { gapHours: 6 });
    expect(gaps.length).toBe(1);
    expect(gaps[0]?.hours).toBe(12);
    expect(gaps[0]?.beforeSegmentId).toBe("b");
  });

  it("does not flag a two-hour layover at the six-hour threshold", () => {
    const segs = [
      flight("a", "2026-09-10T06:00:00Z", "2026-09-10T09:00:00Z"),
      flight("b", "2026-09-10T11:00:00Z", "2026-09-10T13:00:00Z"),
    ];
    expect(timeline(segs, { gapHours: 6 }).gaps.length).toBe(0);
  });

  it("groups by the departure's own calendar day", () => {
    const segs = [
      {
        id: "a",
        segment_type: "flight",
        depart_at: "2026-09-10T22:40:00Z",
        depart_tz: "Europe/London",
        arrive_at: "2026-09-11T02:00:00Z",
        arrive_tz: "Europe/Madrid",
      },
    ];
    expect(timeline(segs).days.map((d) => d.day)).toEqual(["2026-09-10"]);
  });
});

describe("presenceSpans / tripSpan / segmentSpan / suggestTitle", () => {
  it("presenceSpans skips home, cancellations and unreviewed rows", () => {
    const spans = presenceSpans(
      [
        {
          segment_type: "flight",
          depart_at: "2026-09-10T06:00:00Z",
          depart_tz: "Europe/London",
          arrive_at: "2026-09-10T09:00:00Z",
          arrive_tz: "Europe/Madrid",
          depart_country_code: "GB",
          arrive_country_code: "ES",
        },
        {
          segment_type: "flight",
          depart_at: "2026-09-13T17:00:00Z",
          depart_tz: "Europe/Madrid",
          arrive_at: "2026-09-13T19:00:00Z",
          arrive_tz: "Europe/London",
          depart_country_code: "ES",
          arrive_country_code: "GB",
        },
        {
          segment_type: "flight",
          depart_at: "2026-09-11T09:00:00Z",
          arrive_country_code: "FR",
          depart_tz: "Europe/Paris",
          status: "cancelled",
        },
        {
          segment_type: "flight",
          depart_at: "2026-09-11T09:00:00Z",
          arrive_country_code: "IT",
          depart_tz: "Europe/Rome",
          needs_review: true,
        },
      ],
      { homeCountry: "GB" },
    );
    expect(spans).toEqual([{ country_code: "ES", from: "2026-09-10", to: "2026-09-10" }]);
  });

  it("tripSpan takes the outermost days", () => {
    expect(
      tripSpan([
        flight("a", "2026-09-10T06:00:00Z", "2026-09-10T09:00:00Z"),
        flight("b", "2026-09-13T17:00:00Z", "2026-09-13T19:00:00Z"),
      ]),
    ).toEqual({ start_date: "2026-09-10", end_date: "2026-09-13" });
  });

  it("segmentSpan never returns a reversed span", () => {
    const span = segmentSpan({
      depart_at: "2026-09-10T22:00:00Z",
      depart_tz: "Pacific/Auckland",
      arrive_at: "2026-09-11T05:00:00Z",
      arrive_tz: "Pacific/Honolulu",
    });
    expect(span.to! >= span.from!).toBe(true);
  });

  it("suggests a title from where you went, not where you left", () => {
    expect(
      suggestTitle([
        { depart_at: "2026-09-10T06:00:00Z", depart_place: "London", arrive_place: "Barcelona" },
        { depart_at: "2026-09-13T17:00:00Z", depart_place: "Barcelona", arrive_place: "London" },
      ]),
    ).toBe("Barcelona");
  });
});
