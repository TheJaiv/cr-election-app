/**
 * Admin panel authentication.
 *
 * Separate from the Google login on purpose: signing in with Google proves you
 * are a voter, not that you run the election.
 *
 * The password is never stored. ADMIN_PASSWORD_HASH holds
 * `scrypt:<N>:<r>:<p>:<saltB64>:<hashB64>`, and verification uses
 * crypto.timingSafeEqual so a wrong guess takes the same time as a near-miss.
 *
 * The separator is ":" and NOT "$" on purpose. This value lives in a .env file,
 * and Next's env loader expands `$NAME` references — a "$"-delimited hash comes
 * back mangled ("scrypt$16384$8$1$..." loads as "scrypt6384==="), and the only
 * symptom is a permanently wrong password. Base64 never contains ":", so this
 * separator is unambiguous and survives every env loader.
 */
import "server-only";
import {
  createHmac,
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { env } from "@/lib/env";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem?: number },
) => Promise<Buffer>;

const KEYLEN = 32;
const PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEYLEN, PARAMS);
  return [
    "scrypt",
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join(":");
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  if (expected.length !== KEYLEN) return false;
  let derived: Buffer;
  try {
    derived = await scrypt(password, salt, KEYLEN, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: PARAMS.maxmem,
    });
  } catch {
    return false;
  }
  return timingSafeEqual(derived, expected);
}

// ---- Admin session cookie (HMAC-signed, httpOnly) ----

export const ADMIN_COOKIE = "cr-admin";
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

function sign(payload: string): string {
  return createHmac("sha256", env.authSecret).update(payload).digest("base64url");
}

export function issueAdminToken(): string {
  const payload = String(Date.now() + SESSION_TTL_MS);
  return `${payload}.${sign(payload)}`;
}

export function verifyAdminToken(token: string | undefined): boolean {
  if (!token) return false;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  const expiry = Number(payload);
  return Number.isFinite(expiry) && expiry > Date.now();
}
