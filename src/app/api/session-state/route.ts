/**
 * What the vote page needs on load: whether you are signed in, who you are on
 * the roll, whether voting is open, and whether you have already voted.
 *
 * Returns only the caller's OWN roll entry. Never a list, never anything about
 * another student.
 */
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { studentByEmail } from "@/config/roster";
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

  const student = studentByEmail(email);

  const response = NextResponse.json({
    signedIn: true,
    email,
    // Undefined when an allowlisted account is not on the roll (e.g. a test
    // address added to ALLOWED_EMAILS). The ballot still works.
    roll: student?.roll,
    name: student?.name,
    votingOpen,
    hasVoted: rows.length > 0,
  });

  response.cookies.set(CSRF_COOKIE, randomBytes(32).toString("base64url"), {
    httpOnly: false, // must be readable by the client to echo in the header
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 4,
  });
  return response;
}
