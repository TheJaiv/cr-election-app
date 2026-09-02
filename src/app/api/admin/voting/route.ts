import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminGuard";
import { verifyOrigin } from "@/lib/csrf";
import { getStore } from "@/server/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!verifyOrigin(request)) {
    return NextResponse.json({ error: "Bad request origin." }, { status: 403 });
  }
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as { open?: unknown };
  if (typeof body.open !== "boolean") {
    return NextResponse.json(
      { error: "Body must be { open: boolean }." },
      { status: 400 },
    );
  }

  await getStore().setVotingOpen(body.open);
  return NextResponse.json({ ok: true, votingOpen: body.open });
}
