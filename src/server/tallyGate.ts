import "server-only";
import { computeTally, type Tally } from "@/server/tally";
import { getStore } from "@/server/sheets";

export type GatedTally =
  | { ok: true; tally: Tally }
  | { ok: false; status: 403; error: string };

/**
 * Results are sealed while voting is open. This gate is the ONLY way any route
 * gets a tally, so there is no path — public or admin — that leaks a running
 * count before the toggle is flipped.
 */
export async function getTallyIfClosed(): Promise<GatedTally> {
  const store = getStore();
  if (await store.isVotingOpen()) {
    return {
      ok: false,
      status: 403,
      error: "Results are sealed until voting is closed.",
    };
  }
  return { ok: true, tally: computeTally(await store.readBallots()) };
}
