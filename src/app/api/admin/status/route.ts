/**
 * Turnout + voting state. Never returns any email or any per-seat numbers —
 * the tally lives behind /api/admin/tally and stays 403 until voting closes.
 */
import { NextResponse } from "next/server";
import { TOTAL_ELECTORATE } from "@/config/candidates";
import { requireAdmin } from "@/lib/adminGuard";
import { getStore } from "@/server/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const store = getStore();
  const [votingOpen, votesCast] = await Promise.all([
    store.isVotingOpen(),
    store.countVoters(),
  ]);

  return NextResponse.json({
    votingOpen,
    votesCast,
    totalElectorate: TOTAL_ELECTORATE,
    remaining: Math.max(0, TOTAL_ELECTORATE - votesCast),
  });
}
