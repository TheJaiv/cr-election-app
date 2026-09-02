/**
 * Process-wide singletons for the vote endpoint.
 *
 * On Vercel these live for the lifetime of one warm lambda instance. That is
 * exactly the window we need them for: back-to-back clicks and retries from one
 * browser land on the same instance in practice. Anything that must hold across
 * instances is enforced in the sheet itself (see castVote.ts).
 */
import "server-only";
import { Mutex } from "async-mutex";

type Globals = {
  __crVoteMutex?: Mutex;
  __crNonces?: Map<string, number>;
  __crRateBuckets?: Map<string, { tokens: number; refilledAt: number }>;
};

const g = globalThis as unknown as Globals;

/** One global lock. ~152 voters means contention is irrelevant. */
export const voteMutex: Mutex = (g.__crVoteMutex ??= new Mutex());

const NONCE_TTL_MS = 30 * 60 * 1000;
const seenNonces: Map<string, number> = (g.__crNonces ??= new Map());

/**
 * Idempotency guard. Returns false if this (email, nonce) pair is already in
 * flight or was already accepted, so a replayed submission is rejected instead
 * of re-running.
 */
export function claimNonce(email: string, nonce: string): boolean {
  const now = Date.now();
  for (const [key, expiry] of seenNonces) {
    if (expiry <= now) seenNonces.delete(key);
  }
  const key = `${email}:${nonce}`;
  if (seenNonces.has(key)) return false;
  seenNonces.set(key, now + NONCE_TTL_MS);
  return true;
}

/**
 * Hand the nonce back when the attempt provably changed nothing — a malformed
 * ballot, or voting being closed. Without this, one rejected submission would
 * burn the page's only nonce and lock the voter out until they reloaded.
 *
 * A nonce is NOT released once anything was written, so a successful vote and a
 * half-written one both stay un-replayable.
 */
export function releaseNonce(email: string, nonce: string): void {
  seenNonces.delete(`${email}:${nonce}`);
}

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 1000;
const buckets: Map<string, { tokens: number; refilledAt: number }> =
  (g.__crRateBuckets ??= new Map());

/**
 * Per-session token bucket: at most RATE_LIMIT vote attempts per minute for a
 * given signed-in email.
 */
export function consumeRateToken(key: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.refilledAt >= RATE_WINDOW_MS) {
    buckets.set(key, { tokens: RATE_LIMIT - 1, refilledAt: now });
    return true;
  }
  if (bucket.tokens <= 0) return false;
  bucket.tokens -= 1;
  return true;
}
