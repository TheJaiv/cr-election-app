/**
 * Admin-only reads. Everything here exposes information about *who* voted, so
 * every caller must already have passed requireAdmin().
 *
 * Nothing here reveals *how* anyone voted: the Voters tab and the Ballots tab
 * are never joined, and no function in this file reads both for the same
 * person.
 */
import "server-only";
import { ROSTER, splitByTurnout, type Student } from "@/config/roster";
import { getStore } from "@/server/sheets";
import { computeTally, type Tally } from "@/server/tally";

export interface Turnout {
  votingOpen: boolean;
  votesCast: number;
  totalElectorate: number;
  remaining: number;
  percent: number;
}

export async function getTurnout(): Promise<Turnout> {
  const store = getStore();
  const [votingOpen, emails] = await Promise.all([
    store.isVotingOpen(),
    store.listVoterEmails(),
  ]);
  const votesCast = emails.length;
  const totalElectorate = ROSTER.length;
  return {
    votingOpen,
    votesCast,
    totalElectorate,
    remaining: Math.max(0, totalElectorate - votesCast),
    percent: totalElectorate === 0 ? 0 : (votesCast / totalElectorate) * 100,
  };
}

export interface TurnoutRoll {
  voted: Student[];
  notVoted: Student[];
  /** Emails in the Voters tab that are not on the roll. Should always be empty. */
  unknown: string[];
}

export async function getTurnoutRoll(): Promise<TurnoutRoll> {
  const emails = await getStore().listVoterEmails();
  return splitByTurnout(emails);
}

/**
 * The live tally.
 *
 * This is reachable only behind the admin cookie. There is no public results
 * route of any kind, and none of the voter-facing endpoints call this.
 */
export async function getLiveTally(): Promise<Tally> {
  return computeTally(await getStore().readBallots());
}
