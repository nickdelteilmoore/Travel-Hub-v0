import { localTime, localDate, dayShift, duration, fromLocal, offsetMinutes, zoneLabel } from "./timezone";

describe("timezone", () => {
  it("renders an instant in each end's own zone", () => {
    const dep = "2026-09-10T06:55:00Z";
    expect(localTime(dep, "Europe/London")).toBe("07:55"); // BST
    expect(localTime(dep, "Europe/Madrid")).toBe("08:55"); // CEST
  });

  it("marks a red-eye as landing the next day", () => {
    const dep = "2026-11-02T02:40:00Z"; // 22:40 on 1 Nov in New York
    const arr = "2026-11-02T10:25:00Z";
    expect(dayShift(dep, "America/New_York", arr, "Europe/London")).toBe(1);
  });

  it("keeps a westbound long-haul on the same day", () => {
    const dep = "2026-06-01T10:00:00Z"; // 11:00 London
    const arr = "2026-06-01T20:00:00Z"; // 13:00 Los Angeles
    expect(dayShift(dep, "Europe/London", arr, "America/Los_Angeles")).toBe(0);
  });

  it("lands the day before crossing the date line eastbound", () => {
    const dep = "2026-06-01T00:30:00Z"; // 12:30 on 1 Jun, NZST
    const arr = "2026-06-01T09:30:00Z"; // 23:30 on 31 May, HST
    expect(dayShift(dep, "Pacific/Auckland", arr, "Pacific/Honolulu")).toBe(-1);
  });

  it("computes a wall-clock-independent duration", () => {
    expect(duration("2026-09-10T06:55:00Z", "2026-09-10T09:05:00Z")).toBe("2h 10m");
    expect(duration("2026-09-10T06:55:00Z", "2026-09-10T07:55:00Z")).toBe("1h");
    expect(duration("2026-09-10T06:55:00Z", "2026-09-10T07:20:00Z")).toBe("25m");
    expect(duration(null, "2026-09-10T07:20:00Z")).toBe("");
  });

  it("round-trips a wall clock through its zone", () => {
    const instant = fromLocal("2026-09-10", "06:55", "Europe/London");
    expect(instant?.toISOString()).toBe("2026-09-10T05:55:00.000Z");
    expect(localTime(instant, "Europe/London")).toBe("06:55");
  });

  it("survives the spring-forward hour", () => {
    const instant = fromLocal("2026-03-29", "01:30", "Europe/London");
    expect(localDate(instant, "Europe/London", { weekday: false })).toBe("29 Mar");
  });

  it("survives the autumn repeated hour", () => {
    const instant = fromLocal("2026-10-25", "01:30", "Europe/London");
    expect(localDate(instant, "Europe/London", { weekday: false })).toBe("25 Oct");
    expect(localTime(instant, "Europe/London")).toBe("01:30");
  });

  it("follows daylight saving in offsetMinutes", () => {
    expect(offsetMinutes("2026-01-15T12:00:00Z", "Europe/London")).toBe(0);
    expect(offsetMinutes("2026-07-15T12:00:00Z", "Europe/London")).toBe(60);
    expect(offsetMinutes("2026-07-15T12:00:00Z", "Asia/Kolkata")).toBe(330);
  });

  it("names the zone in force at that instant", () => {
    expect(zoneLabel("2026-07-15T12:00:00Z", "Europe/London")).toMatch(/BST|GMT\+1/);
  });
});
