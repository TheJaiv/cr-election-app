import { describe, expect, it } from "vitest";
import { verifyCsrf, verifyOrigin } from "@/lib/csrf";

const TOKEN = "a".repeat(32);

describe("CSRF double-submit", () => {
  it("accepts a matching cookie and header", () => {
    expect(verifyCsrf(TOKEN, TOKEN)).toBe(true);
  });

  it.each([
    ["missing cookie", undefined, TOKEN],
    ["missing header", TOKEN, null],
    ["mismatch", TOKEN, "b".repeat(32)],
    ["too short", "abc", "abc"],
    ["length mismatch", TOKEN, TOKEN + "a"],
  ])("rejects %s", (_label, cookie, header) => {
    expect(verifyCsrf(cookie as string | undefined, header)).toBe(false);
  });
});

function request(headers: Record<string, string>) {
  return new Request("https://vote.example.com/api/vote", {
    method: "POST",
    headers,
  });
}

describe("origin check", () => {
  it("accepts a same-origin POST", () => {
    expect(
      verifyOrigin(
        request({
          origin: "https://vote.example.com",
          host: "vote.example.com",
        }),
      ),
    ).toBe(true);
  });

  it.each([
    ["cross-site", { origin: "https://evil.com", host: "vote.example.com" }],
    ["no origin", { host: "vote.example.com" }],
    ["garbage origin", { origin: "not-a-url", host: "vote.example.com" }],
  ])("rejects %s", (_label, headers) => {
    expect(verifyOrigin(request(headers as Record<string, string>))).toBe(false);
  });
});
