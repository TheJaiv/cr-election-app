/**
 * In-memory ElectionStore used by the tests.
 *
 * `latencyMs` inserts an await between every operation so the concurrency test
 * exercises real interleaving: without it, each castVote call would run to
 * completion synchronously and the race would never happen.
 */
import type {
  BallotRecord,
  ElectionStore,
  ResultRow,
  VoterRow,
} from "@/server/store";

export class FakeStore implements ElectionStore {
  voters: VoterRow[] = [];
  ballots: BallotRecord[] = [];
  results: ResultRow[] = [];
  votingOpen = true;
  failBallotWrite = false;

  constructor(private readonly latencyMs = 1) {}

  private async tick() {
    await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
  }

  async findVoterRows(email: string): Promise<VoterRow[]> {
    await this.tick();
    const target = email.trim().toLowerCase();
    return this.voters.filter((v) => v.email.toLowerCase() === target);
  }

  async appendVoter(row: VoterRow): Promise<void> {
    await this.tick();
    this.voters.push({ ...row });
  }

  async removeVoterRow(email: string, guard: string): Promise<void> {
    await this.tick();
    const target = email.trim().toLowerCase();
    this.voters = this.voters.filter(
      (v) => !(v.email.toLowerCase() === target && v.guard === guard),
    );
  }

  async insertBallotAtRandomPosition(ballot: BallotRecord): Promise<void> {
    await this.tick();
    if (this.failBallotWrite) throw new Error("simulated Sheets outage");
    const at = Math.floor(Math.random() * (this.ballots.length + 1));
    this.ballots.splice(at, 0, { ...ballot });
  }

  async readBallots(): Promise<BallotRecord[]> {
    await this.tick();
    return [...this.ballots];
  }

  async countVoters(): Promise<number> {
    await this.tick();
    return this.voters.length;
  }

  async isVotingOpen(): Promise<boolean> {
    await this.tick();
    return this.votingOpen;
  }

  async setVotingOpen(open: boolean): Promise<void> {
    await this.tick();
    this.votingOpen = open;
  }

  async writeResults(rows: ResultRow[]): Promise<void> {
    await this.tick();
    this.results = [...rows];
  }
}
