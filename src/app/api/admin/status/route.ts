/**
 * Turnout headline figures. No per-candidate numbers and no emails — the tally
 * lives at /api/admin/tally and the roll at /api/admin/roll.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminGuard";
import { getTurnout } from "@/server/adminData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  return NextResponse.json(await getTurnout());
}
