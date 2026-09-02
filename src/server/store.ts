/**
 * Storage contract for the election.
 *
 * The vote pipeline talks to this interface, never to googleapis directly, so
 * the concurrency and double-vote tests can drive the real pipeline against an
 * in-memory fake.
 */

export interface BallotRecord {
  ballotId: string;
  malePick: string;
  femalePick: string;
  openPick: string;
  /**
   * Date only (YYYY-MM-DD), never a precise time. A second-precision timestamp
   * here would let anyone with the sheet correlate a ballot against the Voters
   * tab timestamp and de-anonymise the vote, which random row ordering alone
   * does not prevent.
   */
  votedOn: string;
}

/**
 * A row of the Voters tab.
 *
 * `guard` is a random token written alongside the email. It exists purely to
 * break write races deterministically: if two serverless instances both append
 * a row for the same email, every instance can independently agree on which row
 * wins by ordering on (timestamp, guard). It is not linked to a ballot and
 * carries no information about the vote.
 */
export interface VoterRow {
  email: string;
  timestamp: string;
  guard: string;
}

export interface ElectionStore {
  /** Every Voters row matching `email`, in sheet order. */
  findVoterRows(email: string): Promise<VoterRow[]>;
  /** Append `email` + precise ISO timestamp + race guard to the Voters tab. */
  appendVoter(row: VoterRow): Promise<void>;
  /** Remove the single Voters row with this email + guard. */
  removeVoterRow(email: string, guard: string): Promise<void>;
  /** Insert a ballot at a uniformly random row position in the Ballots tab. */
  insertBallotAtRandomPosition(ballot: BallotRecord): Promise<void>;
  /** Every ballot, for tallying. */
  readBallots(): Promise<BallotRecord[]>;
  /** Total rows in the Voters tab (excluding the header). */
  countVoters(): Promise<number>;
  isVotingOpen(): Promise<boolean>;
  setVotingOpen(open: boolean): Promise<void>;
  /** Overwrite the Results tab tally block. */
  writeResults(rows: ResultRow[], computedAtIso: string): Promise<void>;
}

export interface ResultRow {
  seat: "MALE" | "FEMALE" | "OPEN";
  candidateId: string;
  name: string;
  votes: number;
}
