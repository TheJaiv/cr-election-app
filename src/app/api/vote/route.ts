/**
 * POST /api/vote — cast a ballot.
 *
 * The email comes from the server-side session only. Anything resembling an
 * email in the request body is ignored.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireVoterEmail } from "@/lib/auth";
import { CSRF_COOKIE, CSRF_HEADER, verifyCsrf, verifyOrigin } from "@/lib/csrf";
import { castVote } from "@/server/castVote";
import {
  claimNonce,
  consumeRateToken,
  releaseNonce,
  voteMutex,
} from "@/server/locks";
import { getStore } from "@/server/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!verifyOrigin(request)) {
    return NextResponse.json({ error: "Bad request origin." }, { status: 403 });
  }

  const email = await requireVoterEmail();
  if (!email) {
    return NextResponse.json(
      { error: "Sign in with your institute Google account to vote." },
      { status: 401 },
    );
  }

  const cookieStore = await cookies();
  if (
    !verifyCsrf(
      cookieStore.get(CSRF_COOKIE)?.value,
      request.headers.get(CSRF_HEADER),
    )
  ) {
    return NextResponse.json(
      { error: "Your session expired. Reload the page and try again." },
      { status: 403 },
    );
  }

  if (!consumeRateToken(email)) {
    return NextResponse.json(
      { error: "Too many attempts. Wait a minute and try again." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }
  const payload = (body ?? {}) as Record<string, unknown>;

  const nonce = typeof payload.nonce === "string" ? payload.nonce.trim() : "";
  if (nonce.length < 8 || nonce.length > 100) {
    return NextResponse.json(
      { error: "Missing submission id. Reload the page and try again." },
      { status: 400 },
    );
  }
  if (!claimNonce(email, nonce)) {
    // Either this exact submission is still in flight, or it already got far
    // enough to write. Refusing to guess which: a reload asks the server for
    // the truth and shows the right screen.
    return NextResponse.json(
      {
        error:
          "This ballot was already submitted. Reload the page to see your status.",
      },
      { status: 409 },
    );
  }

  const result = await castVote(
    {
      email,
      malePick: payload.malePick,
      femalePick: payload.femalePick,
      openPick: payload.openPick,
    },
    { store: getStore(), mutex: voteMutex },
  );

  if (!result.ok) {
    // Nothing was written for these two, so the voter may retry with the same
    // nonce after fixing their ballot or once voting opens.
    if (result.code === "INVALID_BALLOT" || result.code === "VOTING_CLOSED") {
      releaseNonce(email, nonce);
    }
    return NextResponse.json(
      { error: result.message, code: result.code },
      { status: result.status },
    );
  }

  // The ballotId is intentionally NOT returned: handing the voter a receipt
  // that maps to a row in the Ballots tab would break ballot secrecy.
  return NextResponse.json({ ok: true });
}
