import { requireAdmin } from "@/lib/adminGuard";
import { NextResponse } from "next/server";
import { tallyToCsv } from "@/server/tally";
import { getTallyIfClosed } from "@/server/tallyGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const gated = await getTallyIfClosed();
  if (!gated.ok) {
    return NextResponse.json({ error: gated.error }, { status: gated.status });
  }

  // Tally only — the CSV never contains emails or individual ballots.
  return new NextResponse(tallyToCsv(gated.tally), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="cr-election-results.csv"',
    },
  });
}
