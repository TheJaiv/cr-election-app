import { NextResponse } from "next/server";
import { ADMIN_COOKIE, issueAdminToken, verifyPassword } from "@/lib/adminAuth";
import { verifyOrigin } from "@/lib/csrf";
import { env } from "@/lib/env";
import { consumeRateToken } from "@/server/locks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!verifyOrigin(request)) {
    return NextResponse.json({ error: "Bad request origin." }, { status: 403 });
  }
  // Throttle brute force by client IP.
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!consumeRateToken(`admin-login:${ip}`)) {
    return NextResponse.json(
      { error: "Too many attempts. Wait a minute." },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    password?: unknown;
  };
  const password = typeof body.password === "string" ? body.password : "";

  if (!(await verifyPassword(password, env.adminPasswordHash))) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, issueAdminToken(), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 2 * 60 * 60,
  });
  return response;
}
