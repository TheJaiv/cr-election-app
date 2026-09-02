/**
 * Tally computation. Pure: takes ballots, returns counts.
 *
 * A candidate's standing is the sum of the votes they received in their own
 * gendered seat and the votes they received in the open seat. Those are two
 * routes to the same person, so they add: a male candidate picked for the male
 * seat by 30 voters and for the open seat by 12 has 42 votes.
 *
 * The per-seat splits are kept alongside, because who wins the reserved female
 * seat is a different question from who has the most votes overall.
 */
import {
  CANDIDATES,
  FEMALE_CANDIDATES,
  MALE_CANDIDATES,
  candidateName,
} from "@/config/candidates";
import type { BallotRecord, CandidateResult } from "./store";

export interface SeatRow {
  candidateId: string;
  name: string;
  votes: number;
}

export interface Tally {
  totalBallots: number;
  /** All nine candidates, seat + open votes combined, highest first. */
  combined: CandidateResult[];
  /** Per-seat detail, each highest first. */
  male: SeatRow[];
  female: SeatRow[];
  open: SeatRow[];
}

function countSeat(
  ballots: readonly BallotRecord[],
  pick: (b: BallotRecord) => string,
  eligible: readonly { id: string }[],
): SeatRow[] {
  const counts = new Map<string, number>(eligible.map((c) => [c.id, 0]));
  for (const ballot of ballots) {
    const id = pick(ballot);
    // Ignore anything not on the current roster rather than inventing a row.
    if (counts.has(id)) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([candidateId, votes]) => ({
      candidateId,
      name: candidateName(candidateId),
      votes,
    }))
    .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name));
}

export function computeTally(ballots: readonly BallotRecord[]): Tally {
  const male = countSeat(ballots, (b) => b.malePick, MALE_CANDIDATES);
  const female = countSeat(ballots, (b) => b.femalePick, FEMALE_CANDIDATES);
  const open = countSeat(ballots, (b) => b.openPick, CANDIDATES);

  const seatVotesOf = new Map<string, number>();
  for (const row of [...male, ...female]) seatVotesOf.set(row.candidateId, row.votes);
  const openVotesOf = new Map(open.map((r) => [r.candidateId, r.votes]));

  const combined: CandidateResult[] = CANDIDATES.map((candidate) => {
    const seatVotes = seatVotesOf.get(candidate.id) ?? 0;
    const openVotes = openVotesOf.get(candidate.id) ?? 0;
    return {
      candidateId: candidate.id,
      name: candidate.name,
      gender: candidate.gender,
      seatVotes,
      openVotes,
      totalVotes: seatVotes + openVotes,
    };
  }).sort((a, b) => b.totalVotes - a.totalVotes || a.name.localeCompare(b.name));

  return { totalBallots: ballots.length, combined, male, female, open };
}

function escapeCsv(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * One row per candidate with the compiled total — a single list, not one block
 * per seat. The seat/open split is kept as columns so the total can be checked.
 */
export function tallyToCsv(tally: Tally): string {
  const lines = [
    "rank,candidateId,name,gender,seatVotes,openVotes,totalVotes",
  ];
  tally.combined.forEach((row, index) => {
    lines.push(
      [
        index + 1,
        row.candidateId,
        row.name,
        row.gender,
        row.seatVotes,
        row.openVotes,
        row.totalVotes,
      ]
        .map(escapeCsv)
        .join(","),
    );
  });
  return lines.join("\n") + "\n";
}

/** Turnout export: who has not voted yet. Names and roll numbers, no ballots. */
export function nonVotersToCsv(
  students: readonly { roll: string; name: string; email: string }[],
): string {
  const lines = ["roll,name,email"];
  for (const student of students) {
    lines.push(
      [student.roll, student.name, student.email].map(escapeCsv).join(","),
    );
  }
  return lines.join("\n") + "\n";
}
