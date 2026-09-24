import { firstNameFrom } from "./displayName";

describe("firstNameFrom", () => {
  it("takes the first word of a real name", () => {
    expect(firstNameFrom("Jane Traveller")).toBe("Jane");
    expect(firstNameFrom("Sam")).toBe("Sam");
  });

  it("humanises an email local part seeded as the display name", () => {
    expect(firstNameFrom("jane.q.traveller")).toBe("Jane");
    expect(firstNameFrom("sam_smith")).toBe("Sam");
  });

  it("keeps hyphenated first names intact", () => {
    expect(firstNameFrom("Anne-Marie Dupont")).toBe("Anne-Marie");
  });

  it("leaves internal capitals alone", () => {
    expect(firstNameFrom("McKenzie Brown")).toBe("McKenzie");
  });

  it("falls back when there is nothing to greet", () => {
    expect(firstNameFrom(null)).toBe("there");
    expect(firstNameFrom("   ")).toBe("there");
    expect(firstNameFrom(undefined, "friend")).toBe("friend");
  });
});
