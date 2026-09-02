/**
 * CSV exports. Admin cookie required.
 *
 *   /api/admin/export             one row per candidate, compiled totals
 *   /api/admin/export?what=pending  roll + name + email of everyone yet to vote
 *
 * Neither export contains a ballot or links anyone to a vote.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminGuard";
import { getLiveTally, getTurnoutRoll } from "@/server/adminData";
import { nonVotersToCsv, tallyToCsv } from "@/server/tally";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csv(body: string, filename: string) {
  return new NextResponse(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function GET(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const what = new URL(request.url).searchParams.get("what");

  if (what === "pending") {
    const { notVoted } = await getTurnoutRoll();
    return csv(nonVotersToCsv(notVoted), "cr-election-not-voted.csv");
  }

  return csv(tallyToCsv(await getLiveTally()), "cr-election-results.csv");
}
