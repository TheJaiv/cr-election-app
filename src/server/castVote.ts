/**
 * The vote pipeline.
 *
 * Everything is injected so the tests can drive the real logic against an
 * in-memory store and a real async-mutex.
 *
 * Ordering matters and is deliberate:
 *   1. voting-open check
 *   2. has-this-email-already-voted check
 *   3. write Voters  (claim the slot)
 *   4. re-read Voters and confirm we own the winning claim
 *   5. write Ballots (anonymous, random row position)
 *
 * Steps 2-4 run inside a mutex. Google Sheets has no atomic insert or unique
 * constraint, so the lock is what makes check-then-write safe. The lock is
 * per-process, which is enough for two near-simultaneous clicks from one user
 * hitting the same lambda; step 4 is the cross-instance backstop for the case
 * where two lambdas are warm at once and each passes step 2 before the other's
 * append lands.
 */

import type { Mutex } from "async-mutex";
import { validateBallot, type BallotInput } from "@/lib/ballot";
import type { BallotRecord, ElectionStore, VoterRow } from "./store";

export type CastVoteCode =
  | "OK"
  | "VOTING_CLOSED"
  | "ALREADY_VOTED"
  | "INVALID_BALLOT"
  | "BALLOT_WRITE_FAILED";

export type CastVoteResult =
  | { ok: true; ballotId: string }
  | { ok: false; code: Exclude<CastVoteCode, "OK">; status: number; message: string };

export interface CastVoteDeps {
  store: ElectionStore;
  mutex: Mutex;
  /** Injected for determinism in tests. */
  now?: () => Date;
  newId?: () => string;
  logger?: Pick<Console, "error" | "warn">;
}

export interface CastVoteRequest extends BallotInput {
  email: string;
}

/**
 * Deterministic across processes: the winning Voters row for an email is the
 * one with the smallest (timestamp, guard). Both fields are written by the
 * claimant, so every instance computes the same winner from the same rows.
 */
function winningClaim(rows: readonly VoterRow[]): VoterRow | undefined {
  return [...rows].sort((a, b) =>
    a.timestamp === b.timestamp
      ? a.guard.localeCompare(b.guard)
      : a.timestamp.localeCompare(b.timestamp),
  )[0];
}

export async function castVote(
  request: CastVoteRequest,
  deps: CastVoteDeps,
): Promise<CastVoteResult> {
  const { store, mutex } = deps;
  const now = deps.now ?? (() => new Date());
  const newId = deps.newId ?? (() => crypto.randomUUID());
  const log = deps.logger ?? console;

  const email = request.email.trim().toLowerCase();

  // Validate before taking the lock — a malformed ballot should not make other
  // voters wait, and it must never reach the sheet.
  const validation = validateBallot(request);
  if (!validation.ok) {
    return {
      ok: false,
      code: "INVALID_BALLOT",
      status: 400,
      message: validation.message,
    };
  }
  const ballot = validation.ballot;

  // The lock spans the read AND both writes, as required: releasing it after
  // the Voters write would let a second request pass the has-voted check while
  // the first is still mid-flight.
  return mutex.runExclusive(async (): Promise<CastVoteResult> => {
    if (!(await store.isVotingOpen())) {
      return {
        ok: false,
        code: "VOTING_CLOSED",
        status: 403,
        message: "Voting is not open right now.",
      };
    }

    const existing = await store.findVoterRows(email);
    if (existing.length > 0) {
      return {
        ok: false,
        code: "ALREADY_VOTED",
        status: 409,
        message: "You have already voted.",
      };
    }

    const row: VoterRow = {
      email,
      timestamp: now().toISOString(),
      guard: newId(),
    };
    await store.appendVoter(row);

    // Cross-instance backstop: if another lambda also appended for this email,
    // exactly one of us owns the winning claim; the other withdraws its row and
    // never writes a ballot.
    const after = await store.findVoterRows(email);
    const winner = winningClaim(after);
    if (!winner || winner.guard !== row.guard) {
      await store.removeVoterRow(email, row.guard);
      return {
        ok: false,
        code: "ALREADY_VOTED",
        status: 409,
        message: "You have already voted.",
      };
    }

    const record: BallotRecord = {
      ballotId: newId(),
      malePick: ballot.malePick,
      femalePick: ballot.femalePick,
      openPick: ballot.openPick,
      // Date only. See the comment on BallotRecord.votedOn.
      votedOn: row.timestamp.slice(0, 10),
    };

    try {
      await store.insertBallotAtRandomPosition(record);
    } catch (error) {
      // Loud on purpose: the voter is marked as having voted but their ballot
      // is not in the sheet. This needs a human. SETUP.md documents the fix
      // (delete their Voters row so they can vote again).
      log.error(
        "[BALLOT_WRITE_FAILED] Voters row was written but the Ballots write failed. " +
          `ballotId=${record.ballotId} voterTimestamp=${row.timestamp} ` +
          `guard=${row.guard} — remove this Voters row to let the voter retry.`,
        error,
      );
      return {
        ok: false,
        code: "BALLOT_WRITE_FAILED",
        status: 500,
        message:
          "Your vote could not be recorded. Please contact the election administrator before trying again.",
      };
    }

    return { ok: true, ballotId: record.ballotId };
  });
}
