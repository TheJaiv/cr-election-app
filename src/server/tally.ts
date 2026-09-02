/**
 * Tally computation. Pure: takes ballots, returns per-seat counts.
 *
 * Every candidate appears in every seat they are eligible for, including with
 * zero votes, so the bar chart has a stable set of bars.
 */
import {
  CANDIDATES,
  FEMALE_CANDIDATES,
  MALE_CANDIDATES,
  candidateName,
} from "@/config/candidates";
import type { BallotRecord, ResultRow } from "./store";

export interface Tally {
  totalBallots: number;
  male: ResultRow[];
  female: ResultRow[];
  open: ResultRow[];
}

function count(
  ballots: readonly BallotRecord[],
  pick: (b: BallotRecord) => string,
  eligible: readonly { id: string }[],
  seat: ResultRow["seat"],
): ResultRow[] {
  const counts = new Map<string, number>(eligible.map((c) => [c.id, 0]));
  for (const ballot of ballots) {
    const id = pick(ballot);
    // Ignore anything not on the current roster rather than inventing a bar.
    if (counts.has(id)) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([candidateId, votes]) => ({
      seat,
      candidateId,
      name: candidateName(candidateId),
      votes,
    }))
    .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name));
}

export function computeTally(ballots: readonly BallotRecord[]): Tally {
  return {
    totalBallots: ballots.length,
    male: count(ballots, (b) => b.malePick, MALE_CANDIDATES, "MALE"),
    female: count(ballots, (b) => b.femalePick, FEMALE_CANDIDATES, "FEMALE"),
    open: count(ballots, (b) => b.openPick, CANDIDATES, "OPEN"),
  };
}

export function tallyToRows(tally: Tally): ResultRow[] {
  return [...tally.male, ...tally.female, ...tally.open];
}

export function tallyToCsv(tally: Tally): string {
  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = ["seat,candidateId,name,votes"];
  for (const row of tallyToRows(tally)) {
    lines.push(
      [row.seat, row.candidateId, row.name, row.votes].map(escape).join(","),
    );
  }
  return lines.join("\n") + "\n";
}
