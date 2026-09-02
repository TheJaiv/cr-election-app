import { describe, expect, it } from "vitest";
import {
  CANDIDATES,
  FEMALE_CANDIDATES,
  MALE_CANDIDATES,
} from "@/config/candidates";
import { computeTally, nonVotersToCsv, tallyToCsv } from "@/server/tally";
import type { BallotRecord } from "@/server/store";

const [maleA, maleB, maleC] = MALE_CANDIDATES;
const [femaleA, femaleB] = FEMALE_CANDIDATES;

/**
 * Build a ballot fixture, refusing any combination a real voter could never
 * cast. Without this guard a test can quietly assert on impossible data.
 */
function ballot(
  malePick: string,
  femalePick: string,
  openPick: string,
): BallotRecord {
  if (openPick === malePick || openPick === femalePick) {
    throw new Error(
      `invalid fixture: open pick "${openPick}" repeats a seat pick`,
    );
  }
  return {
    ballotId: crypto.randomUUID(),
    malePick,
    femalePick,
    openPick,
    votedOn: "2026-09-02",
  };
}

function totalFor(
  tally: ReturnType<typeof computeTally>,
  candidateId: string,
) {
  return tally.combined.find((c) => c.candidateId === candidateId)!;
}

describe("compiled totals", () => {
  it("adds a male candidate's open-seat votes to his male-seat votes", () => {
    const tally = computeTally([
      // maleA takes the male seat twice...
      ballot(maleA.id, femaleA.id, maleB.id),
      ballot(maleA.id, femaleA.id, maleB.id),
      // ...and the open seat three times.
      ballot(maleB.id, femaleA.id, maleA.id),
      ballot(maleB.id, femaleA.id, maleA.id),
      ballot(maleC.id, femaleA.id, maleA.id),
    ]);

    const a = totalFor(tally, maleA.id);
    expect(a.seatVotes).toBe(2);
    expect(a.openVotes).toBe(3);
    expect(a.totalVotes).toBe(5);
  });

  it("adds a female candidate's open-seat votes to her female-seat votes", () => {
    const tally = computeTally([
      ballot(maleA.id, femaleA.id, maleB.id),
      ballot(maleA.id, femaleA.id, femaleB.id),
      ballot(maleA.id, femaleB.id, femaleA.id),
    ]);

    const a = totalFor(tally, femaleA.id);
    expect(a.seatVotes).toBe(2);
    expect(a.openVotes).toBe(1);
    expect(a.totalVotes).toBe(3);

    const b = totalFor(tally, femaleB.id);
    expect(b.seatVotes).toBe(1);
    expect(b.openVotes).toBe(1);
    expect(b.totalVotes).toBe(2);
  });

  it("lists all nine candidates exactly once, zeroes included", () => {
    const tally = computeTally([]);
    expect(tally.combined).toHaveLength(9);
    expect(new Set(tally.combined.map((c) => c.candidateId)).size).toBe(9);
    expect(tally.combined.every((c) => c.totalVotes === 0)).toBe(true);
  });

  it("conserves votes: every ballot contributes exactly three", () => {
    const ballots = [
      ballot(maleA.id, femaleA.id, maleB.id),
      ballot(maleB.id, femaleB.id, femaleA.id),
      ballot(maleC.id, femaleA.id, maleA.id),
      ballot(maleA.id, femaleB.id, maleC.id),
    ];
    const tally = computeTally(ballots);
    const sum = tally.combined.reduce((n, c) => n + c.totalVotes, 0);
    expect(sum).toBe(ballots.length * 3);
  });

  it("sorts the combined list by total votes, highest first", () => {
    const tally = computeTally([
      ballot(maleB.id, femaleA.id, maleA.id),
      ballot(maleB.id, femaleA.id, maleC.id),
      ballot(maleA.id, femaleB.id, maleB.id),
      ballot(maleC.id, femaleB.id, maleB.id),
    ]);
    // maleB: 2 in the male seat + 2 in the open seat.
    expect(tally.combined[0].candidateId).toBe(maleB.id);
    expect(tally.combined[0].totalVotes).toBe(4);
    for (let i = 1; i < tally.combined.length; i++) {
      expect(tally.combined[i - 1].totalVotes).toBeGreaterThanOrEqual(
        tally.combined[i].totalVotes,
      );
    }
  });

  it("keeps the per-seat breakdown alongside the totals", () => {
    const tally = computeTally([ballot(maleA.id, femaleA.id, maleB.id)]);
    expect(tally.male).toHaveLength(7);
    expect(tally.female).toHaveLength(2);
    expect(tally.open).toHaveLength(9);
    expect(tally.male.find((r) => r.candidateId === maleA.id)?.votes).toBe(1);
    expect(tally.open.find((r) => r.candidateId === maleB.id)?.votes).toBe(1);
  });

  it("ignores ids that are not on the current roster", () => {
    const tally = computeTally([ballot("ghost", femaleA.id, maleA.id)]);
    expect(tally.combined.reduce((n, c) => n + c.totalVotes, 0)).toBe(2);
    expect(totalFor(tally, femaleA.id).totalVotes).toBe(1);
    expect(totalFor(tally, maleA.id).totalVotes).toBe(1);
  });
});

describe("CSV export", () => {
  it("is one list of all candidates with compiled totals", () => {
    const csv = tallyToCsv(
      computeTally([
        ballot(maleA.id, femaleA.id, maleB.id),
        ballot(maleA.id, femaleA.id, femaleB.id),
      ]),
    );
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe(
      "rank,candidateId,name,gender,seatVotes,openVotes,totalVotes",
    );
    // One row per candidate, not one block per seat.
    expect(lines).toHaveLength(1 + CANDIDATES.length);
    expect(csv).not.toContain("@");
  });

  it("numbers the ranks from 1 in order", () => {
    const csv = tallyToCsv(computeTally([]));
    const ranks = csv.trim().split("\n").slice(1).map((l) => Number(l.split(",")[0]));
    expect(ranks).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("quotes fields containing a comma", () => {
    const csv = nonVotersToCsv([
      { roll: "26075001", name: "Doe, Jane", email: "a@b.com" },
    ]);
    expect(csv).toContain('"Doe, Jane"');
  });
});
