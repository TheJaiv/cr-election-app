/**
 * Who has voted and who has not. Admin cookie required.
 *
 * This says nothing about how anyone voted — it is the Voters tab checked
 * against the electoral roll, which is exactly what turnout chasing needs.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminGuard";
import { getTurnoutRoll } from "@/server/adminData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { voted, notVoted, unknown } = await getTurnoutRoll();
  return NextResponse.json({
    voted: voted.map((s) => ({ roll: s.roll, name: s.name })),
    notVoted: notVoted.map((s) => ({
      roll: s.roll,
      name: s.name,
      email: s.email,
    })),
    unknown,
  });
}
