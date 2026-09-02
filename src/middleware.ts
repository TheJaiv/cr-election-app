import { NextResponse, type NextRequest } from "next/server";

/**
 * Security headers for every response.
 *
 * The CSP allows Google's sign-in redirect and the local candidate photos, and
 * nothing else. `unsafe-inline` is present for styles because Next injects its
 * own <style> tags, and for scripts because of Next's inline bootstrap;
 * tighten with a nonce if you ever add third-party scripts.
 *
 * Development needs two extra allowances that production must NOT have:
 * React Fast Refresh compiles modules with eval(), and HMR talks over a
 * websocket. Both are gated on NODE_ENV so the deployed CSP stays strict.
 */
const isDev = process.env.NODE_ENV !== "production";

const SCRIPT_SRC = [
  "'self'",
  "'unsafe-inline'",
  ...(isDev ? ["'unsafe-eval'"] : []),
].join(" ");

const CONNECT_SRC = [
  "'self'",
  ...(isDev ? ["ws:", "wss:"] : []),
].join(" ");

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  );
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  );
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      `script-src ${SCRIPT_SRC}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      `connect-src ${CONNECT_SRC}`,
      "form-action 'self' https://accounts.google.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "object-src 'none'",
    ].join("; "),
  );

  // The admin panel and the ballot must never be cached by a shared proxy.
  if (
    request.nextUrl.pathname.startsWith("/admin") ||
    request.nextUrl.pathname.startsWith("/api")
  ) {
    response.headers.set("Cache-Control", "no-store, max-age=0");
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
