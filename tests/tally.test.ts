import { describe, expect, it } from "vitest";
import { FEMALE_CANDIDATES, MALE_CANDIDATES } from "@/config/candidates";
import { computeTally, tallyToCsv } from "@/server/tally";
import type { BallotRecord } from "@/server/store";

const [maleA, maleB] = MALE_CANDIDATES;
const [femaleA, femaleB] = FEMALE_CANDIDATES;

function ballot(
  malePick: string,
  femalePick: string,
  openPick: string,
): BallotRecord {
  return {
    ballotId: crypto.randomUUID(),
    malePick,
    femalePick,
    openPick,
    votedOn: "2026-09-02",
  };
}

describe("computeTally", () => {
  it("counts each seat independently", () => {
    const tally = computeTally([
      ballot(maleA.id, femaleA.id, maleB.id),
      ballot(maleA.id, femaleB.id, femaleA.id),
      ballot(maleB.id, femaleA.id, maleA.id),
    ]);

    expect(tally.totalBallots).toBe(3);
    expect(tally.male.find((r) => r.candidateId === maleA.id)?.votes).toBe(2);
    expect(tally.male.find((r) => r.candidateId === maleB.id)?.votes).toBe(1);
    expect(tally.female.find((r) => r.candidateId === femaleA.id)?.votes).toBe(2);
    expect(tally.open.find((r) => r.candidateId === maleA.id)?.votes).toBe(1);
  });

  it("lists every eligible candidate for a seat, including zeroes", () => {
    const tally = computeTally([]);
    expect(tally.male).toHaveLength(7);
    expect(tally.female).toHaveLength(2);
    expect(tally.open).toHaveLength(9);
    expect(tally.open.every((r) => r.votes === 0)).toBe(true);
  });

  it("ignores ids that are not on the current roster", () => {
    const tally = computeTally([ballot("ghost", femaleA.id, maleA.id)]);
    expect(tally.male.reduce((sum, r) => sum + r.votes, 0)).toBe(0);
    expect(tally.female.reduce((sum, r) => sum + r.votes, 0)).toBe(1);
  });

  it("sorts each seat by votes descending", () => {
    const tally = computeTally([
      ballot(maleB.id, femaleA.id, maleA.id),
      ballot(maleB.id, femaleA.id, maleA.id),
      ballot(maleA.id, femaleB.id, maleB.id),
    ]);
    expect(tally.male[0].candidateId).toBe(maleB.id);
  });

  it("exports a CSV with a header and one row per seat entry", () => {
    const csv = tallyToCsv(computeTally([ballot(maleA.id, femaleA.id, maleB.id)]));
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe("seat,candidateId,name,votes");
    expect(lines).toHaveLength(1 + 7 + 2 + 9);
    expect(csv).not.toContain("@");
  });
});
