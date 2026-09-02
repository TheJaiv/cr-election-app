/**
 * GET  — the live tally, seat and open votes compiled per candidate.
 * POST — the same, and also written into the Results tab.
 *
 * Admin cookie required. There is no public results route; results are never
 * reachable without it, whether voting is open or closed.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminGuard";
import { verifyOrigin } from "@/lib/csrf";
import { getLiveTally } from "@/server/adminData";
import { getStore } from "@/server/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  return NextResponse.json(await getLiveTally());
}

export async function POST(request: Request) {
  if (!verifyOrigin(request)) {
    return NextResponse.json({ error: "Bad request origin." }, { status: 403 });
  }
  const denied = await requireAdmin();
  if (denied) return denied;

  const tally = await getLiveTally();
  await getStore().writeResults(tally.combined, new Date().toISOString());
  return NextResponse.json(tally);
}
