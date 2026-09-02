import { describe, expect, it } from "vitest";
import { validateBallot } from "@/lib/ballot";
import {
  CANDIDATES,
  FEMALE_CANDIDATES,
  MALE_CANDIDATES,
} from "@/config/candidates";

const MALE_A = MALE_CANDIDATES[0].id;
const MALE_B = MALE_CANDIDATES[1].id;
const FEMALE_A = FEMALE_CANDIDATES[0].id;
const FEMALE_B = FEMALE_CANDIDATES[1].id;

describe("candidate roster", () => {
  it("has 9 candidates: 7 male, 2 female", () => {
    expect(CANDIDATES).toHaveLength(9);
    expect(MALE_CANDIDATES).toHaveLength(7);
    expect(FEMALE_CANDIDATES).toHaveLength(2);
  });

  it("has unique ids", () => {
    const ids = CANDIDATES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("the hard rule: open pick must differ from both seat picks", () => {
  it("rejects an open pick equal to the male pick", () => {
    const result = validateBallot({
      malePick: MALE_A,
      femalePick: FEMALE_A,
      openPick: MALE_A,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error).toBe("OPEN_PICK_EQUALS_MALE_PICK");
  });

  it("rejects an open pick equal to the female pick", () => {
    const result = validateBallot({
      malePick: MALE_A,
      femalePick: FEMALE_A,
      openPick: FEMALE_A,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error).toBe("OPEN_PICK_EQUALS_FEMALE_PICK");
  });

  it("accepts a different male candidate in the open seat", () => {
    const result = validateBallot({
      malePick: MALE_A,
      femalePick: FEMALE_A,
      openPick: MALE_B,
    });
    expect(result.ok).toBe(true);
  });

  it("accepts the other female candidate in the open seat", () => {
    const result = validateBallot({
      malePick: MALE_A,
      femalePick: FEMALE_A,
      openPick: FEMALE_B,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects every candidate for the open seat when they were already picked", () => {
    // Exhaustive: for each (male, female) pair, only those two ids may fail.
    for (const male of MALE_CANDIDATES) {
      for (const female of FEMALE_CANDIDATES) {
        for (const open of CANDIDATES) {
          const result = validateBallot({
            malePick: male.id,
            femalePick: female.id,
            openPick: open.id,
          });
          const shouldFail = open.id === male.id || open.id === female.id;
          expect(result.ok).toBe(!shouldFail);
        }
      }
    }
  });
});

describe("seat eligibility", () => {
  it("rejects a female candidate in the male seat", () => {
    const result = validateBallot({
      malePick: FEMALE_A,
      femalePick: FEMALE_B,
      openPick: MALE_A,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error).toBe("MALE_PICK_NOT_MALE");
  });

  it("rejects a male candidate in the female seat", () => {
    const result = validateBallot({
      malePick: MALE_A,
      femalePick: MALE_B,
      openPick: FEMALE_A,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error).toBe("FEMALE_PICK_NOT_FEMALE");
  });
});

describe("malformed input", () => {
  it.each([
    ["missing male", { malePick: "", femalePick: FEMALE_A, openPick: MALE_A }, "MISSING_MALE_PICK"],
    ["missing female", { malePick: MALE_A, femalePick: null, openPick: MALE_B }, "MISSING_FEMALE_PICK"],
    ["missing open", { malePick: MALE_A, femalePick: FEMALE_A, openPick: undefined }, "MISSING_OPEN_PICK"],
    ["unknown male", { malePick: "nobody", femalePick: FEMALE_A, openPick: MALE_A }, "UNKNOWN_MALE_PICK"],
    ["unknown female", { malePick: MALE_A, femalePick: "nobody", openPick: MALE_B }, "UNKNOWN_FEMALE_PICK"],
    ["unknown open", { malePick: MALE_A, femalePick: FEMALE_A, openPick: "nobody" }, "UNKNOWN_OPEN_PICK"],
    ["non-string", { malePick: 42, femalePick: FEMALE_A, openPick: MALE_B }, "MISSING_MALE_PICK"],
    ["object injection", { malePick: { id: MALE_A }, femalePick: FEMALE_A, openPick: MALE_B }, "MISSING_MALE_PICK"],
  ])("rejects %s", (_label, input, expected) => {
    const result = validateBallot(input as never);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error).toBe(expected);
  });
});
