/**
 * GET  — read the tally (403 while voting is open).
 * POST — recompute and write it into the Results tab.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminGuard";
import { verifyOrigin } from "@/lib/csrf";
import { getStore } from "@/server/sheets";
import { tallyToRows } from "@/server/tally";
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
  return NextResponse.json(gated.tally);
}

export async function POST(request: Request) {
  if (!verifyOrigin(request)) {
    return NextResponse.json({ error: "Bad request origin." }, { status: 403 });
  }
  const denied = await requireAdmin();
  if (denied) return denied;

  const gated = await getTallyIfClosed();
  if (!gated.ok) {
    return NextResponse.json({ error: gated.error }, { status: gated.status });
  }

  await getStore().writeResults(
    tallyToRows(gated.tally),
    new Date().toISOString(),
  );
  return NextResponse.json(gated.tally);
}
