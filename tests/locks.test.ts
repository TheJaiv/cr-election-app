import { beforeEach, describe, expect, it } from "vitest";
import { claimNonce, consumeRateToken, releaseNonce } from "@/server/locks";

const EMAIL = "nonce.cse26@itbhu.ac.in";

let counter = 0;
function freshNonce() {
  return `nonce-${counter++}`;
}

describe("nonce idempotency guard", () => {
  it("accepts a nonce once", () => {
    const nonce = freshNonce();
    expect(claimNonce(EMAIL, nonce)).toBe(true);
  });

  it("rejects a replay of the same nonce", () => {
    const nonce = freshNonce();
    expect(claimNonce(EMAIL, nonce)).toBe(true);
    expect(claimNonce(EMAIL, nonce)).toBe(false);
    expect(claimNonce(EMAIL, nonce)).toBe(false);
  });

  it("scopes the nonce to the email", () => {
    const nonce = freshNonce();
    expect(claimNonce("a.cse26@itbhu.ac.in", nonce)).toBe(true);
    expect(claimNonce("b.cse26@itbhu.ac.in", nonce)).toBe(true);
  });

  it("lets a released nonce be retried", () => {
    const nonce = freshNonce();
    expect(claimNonce(EMAIL, nonce)).toBe(true);
    releaseNonce(EMAIL, nonce);
    expect(claimNonce(EMAIL, nonce)).toBe(true);
  });
});

describe("rate limit", () => {
  let key: string;

  beforeEach(() => {
    key = `rate-${counter++}`;
  });

  it("allows a burst up to the limit then blocks", () => {
    const allowed = Array.from({ length: 8 }, () => consumeRateToken(key));
    expect(allowed.filter(Boolean)).toHaveLength(5);
    expect(allowed.slice(5).every((v) => v === false)).toBe(true);
  });

  it("tracks each key independently", () => {
    for (let i = 0; i < 5; i++) consumeRateToken(key);
    expect(consumeRateToken(key)).toBe(false);
    expect(consumeRateToken(`${key}-other`)).toBe(true);
  });
});
