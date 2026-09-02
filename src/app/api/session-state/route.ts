/**
 * What the vote page needs on load: whether you are signed in, whether voting
 * is open, and whether you have already voted.
 *
 * Deliberately returns only the caller's own email — never a list, never
 * anything from the Voters tab about anyone else.
 */
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { requireVoterEmail } from "@/lib/auth";
import { CSRF_COOKIE } from "@/lib/csrf";
import { getStore } from "@/server/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const email = await requireVoterEmail();
  if (!email) {
    return NextResponse.json({ signedIn: false }, { status: 200 });
  }

  const store = getStore();
  const [votingOpen, rows] = await Promise.all([
    store.isVotingOpen(),
    store.findVoterRows(email),
  ]);

  const response = NextResponse.json({
    signedIn: true,
    email,
    votingOpen,
    hasVoted: rows.length > 0,
  });

  // Issue (or refresh) the double-submit CSRF token the vote POST must echo.
  response.cookies.set(CSRF_COOKIE, randomBytes(32).toString("base64url"), {
    httpOnly: false, // must be readable by the client to echo in the header
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 4,
  });
  return response;
}
