/**
 * Double-submit CSRF protection for the vote POST.
 *
 * The token is a random value stored in a non-httpOnly cookie; the client must
 * echo it in the `x-csrf-token` header. A cross-site attacker can cause the
 * cookie to be sent but cannot read it to set the header. Combined with an
 * Origin check, that covers the POST.
 */
import { timingSafeEqual } from "node:crypto";

export { CSRF_COOKIE, CSRF_HEADER } from "./csrfShared";

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function verifyCsrf(
  cookieToken: string | undefined,
  headerToken: string | null,
): boolean {
  if (!cookieToken || !headerToken) return false;
  if (cookieToken.length < 16) return false;
  return safeEqual(cookieToken, headerToken);
}

/** Reject POSTs whose Origin is not this deployment. */
export function verifyOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
