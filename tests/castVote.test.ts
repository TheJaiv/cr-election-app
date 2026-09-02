import { Mutex } from "async-mutex";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FEMALE_CANDIDATES, MALE_CANDIDATES } from "@/config/candidates";
import { castVote } from "@/server/castVote";
import { FakeStore } from "./fakeStore";

const MALE_A = MALE_CANDIDATES[0].id;
const MALE_B = MALE_CANDIDATES[1].id;
const FEMALE_A = FEMALE_CANDIDATES[0].id;
const EMAIL = "someone.cse26@itbhu.ac.in";

const goodBallot = {
  malePick: MALE_A,
  femalePick: FEMALE_A,
  openPick: MALE_B,
};

const silentLogger = { error: vi.fn(), warn: vi.fn() };

let store: FakeStore;
let mutex: Mutex;

beforeEach(() => {
  store = new FakeStore();
  mutex = new Mutex();
  silentLogger.error.mockClear();
});

function deps() {
  return { store, mutex, logger: silentLogger };
}

describe("castVote", () => {
  it("records one voter row and one ballot on success", async () => {
    const result = await castVote({ email: EMAIL, ...goodBallot }, deps());
    expect(result.ok).toBe(true);
    expect(store.voters).toHaveLength(1);
    expect(store.ballots).toHaveLength(1);
    expect(store.ballots[0]).toMatchObject({
      malePick: MALE_A,
      femalePick: FEMALE_A,
      openPick: MALE_B,
    });
  });

  it("never links a ballot to an email", async () => {
    await castVote({ email: EMAIL, ...goodBallot }, deps());
    const serialised = JSON.stringify(store.ballots);
    expect(serialised).not.toContain(EMAIL);
    expect(serialised).not.toContain("@");
    // And the ballot carries a date, not a time that could be matched against
    // the Voters timestamp.
    expect(store.ballots[0].votedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(store.voters[0].timestamp).not.toBe(store.ballots[0].votedOn);
  });

  it("uses a random UUID as the ballot id, not a sequence", async () => {
    const emails = ["a.cse26@itbhu.ac.in", "b.cse26@itbhu.ac.in"];
    for (const email of emails) {
      await castVote({ email, ...goodBallot }, deps());
    }
    const ids = store.ballots.map((b) => b.ballotId);
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) {
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    }
  });

  it("rejects an open pick equal to the male pick without writing anything", async () => {
    const result = await castVote(
      { email: EMAIL, malePick: MALE_A, femalePick: FEMALE_A, openPick: MALE_A },
      deps(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.code).toBe("INVALID_BALLOT");
    expect(store.voters).toHaveLength(0);
    expect(store.ballots).toHaveLength(0);
  });

  it("rejects an open pick equal to the female pick without writing anything", async () => {
    const result = await castVote(
      {
        email: EMAIL,
        malePick: MALE_A,
        femalePick: FEMALE_A,
        openPick: FEMALE_A,
      },
      deps(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.code).toBe("INVALID_BALLOT");
    expect(store.voters).toHaveLength(0);
    expect(store.ballots).toHaveLength(0);
  });

  it("rejects an unknown candidate id", async () => {
    const result = await castVote(
      {
        email: EMAIL,
        malePick: "not-a-candidate",
        femalePick: FEMALE_A,
        openPick: MALE_B,
      },
      deps(),
    );
    expect(result.ok).toBe(false);
    expect(store.ballots).toHaveLength(0);
  });

  it("rejects a second vote from the same email", async () => {
    const first = await castVote({ email: EMAIL, ...goodBallot }, deps());
    expect(first.ok).toBe(true);

    const second = await castVote({ email: EMAIL, ...goodBallot }, deps());
    expect(second.ok).toBe(false);
    if (second.ok) throw new Error("unreachable");
    expect(second.code).toBe("ALREADY_VOTED");
    expect(second.message).toBe("You have already voted.");

    expect(store.voters).toHaveLength(1);
    expect(store.ballots).toHaveLength(1);
  });

  it("treats the email case-insensitively when blocking a second vote", async () => {
    await castVote({ email: EMAIL, ...goodBallot }, deps());
    const second = await castVote(
      { email: EMAIL.toUpperCase(), ...goodBallot },
      deps(),
    );
    expect(second.ok).toBe(false);
    expect(store.ballots).toHaveLength(1);
  });

  it("rejects a vote while voting is closed", async () => {
    store.votingOpen = false;
    const result = await castVote({ email: EMAIL, ...goodBallot }, deps());
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.code).toBe("VOTING_CLOSED");
    expect(store.voters).toHaveLength(0);
  });

  it("logs loudly and reports failure when the Ballots write fails", async () => {
    store.failBallotWrite = true;
    const result = await castVote({ email: EMAIL, ...goodBallot }, deps());
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.code).toBe("BALLOT_WRITE_FAILED");
    expect(silentLogger.error).toHaveBeenCalledOnce();
    expect(silentLogger.error.mock.calls[0][0]).toContain(
      "[BALLOT_WRITE_FAILED]",
    );
    // The voter is still marked as having voted — Voters is written first on
    // purpose, so a retry cannot slip a second ballot through.
    expect(store.voters).toHaveLength(1);
    expect(store.ballots).toHaveLength(0);
  });
});

describe("concurrency", () => {
  it("two simultaneous submissions from the same email produce exactly one ballot", async () => {
    const [a, b] = await Promise.all([
      castVote({ email: EMAIL, ...goodBallot }, deps()),
      castVote({ email: EMAIL, ...goodBallot }, deps()),
    ]);

    const succeeded = [a, b].filter((r) => r.ok);
    const failed = [a, b].filter((r) => !r.ok);

    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect((failed[0] as { code: string }).code).toBe("ALREADY_VOTED");

    expect(store.voters).toHaveLength(1);
    expect(store.ballots).toHaveLength(1);
  });

  it("ten simultaneous submissions from the same email produce exactly one ballot", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        castVote({ email: EMAIL, ...goodBallot }, deps()),
      ),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(store.voters).toHaveLength(1);
    expect(store.ballots).toHaveLength(1);
  });

  it("simultaneous submissions from different emails all succeed", async () => {
    const emails = Array.from(
      { length: 12 },
      (_, i) => `student${i}.cse26@itbhu.ac.in`,
    );
    const results = await Promise.all(
      emails.map((email) => castVote({ email, ...goodBallot }, deps())),
    );
    expect(results.every((r) => r.ok)).toBe(true);
    expect(store.voters).toHaveLength(12);
    expect(store.ballots).toHaveLength(12);
  });

  it("survives two independent processes racing (separate mutexes, shared sheet)", async () => {
    // Simulates two warm Vercel lambdas: each has its own in-process lock, so
    // only the sheet-level claim check can decide the winner.
    const storeA = store;
    const mutexA = new Mutex();
    const mutexB = new Mutex();
    const withdrawals = vi.spyOn(storeA, "removeVoterRow");

    const [a, b] = await Promise.all([
      castVote(
        { email: EMAIL, ...goodBallot },
        { store: storeA, mutex: mutexA, logger: silentLogger },
      ),
      castVote(
        { email: EMAIL, ...goodBallot },
        { store: storeA, mutex: mutexB, logger: silentLogger },
      ),
    ]);

    expect([a, b].filter((r) => r.ok)).toHaveLength(1);
    expect(storeA.voters).toHaveLength(1);
    expect(storeA.ballots).toHaveLength(1);
    // Proves the race actually happened and the sheet-level claim check — not
    // the in-process mutex — is what resolved it.
    expect(withdrawals).toHaveBeenCalledOnce();
  });
});
