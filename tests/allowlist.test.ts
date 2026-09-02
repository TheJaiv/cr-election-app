import { describe, expect, it } from "vitest";
import { checkAllowlist, normaliseEmail } from "@/lib/allowlist";

const CONFIG = {
  domain: "itbhu.ac.in",
  localSuffix: ".cse26",
  emails: [] as string[],
};

describe("allowlist", () => {
  it("accepts a matching institute address", () => {
    expect(
      checkAllowlist("jaiv.cse26@itbhu.ac.in", CONFIG).allowed,
    ).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(checkAllowlist("Jaiv.CSE26@ITBHU.ac.in", CONFIG).allowed).toBe(true);
  });

  it("rejects the right domain with the wrong batch suffix", () => {
    expect(checkAllowlist("someone.cse25@itbhu.ac.in", CONFIG).allowed).toBe(
      false,
    );
  });

  it("rejects a lookalike domain", () => {
    for (const email of [
      "a.cse26@itbhu.ac.in.evil.com",
      "a.cse26@notitbhu.ac.in",
      "a.cse26@sub.itbhu.ac.in",
    ]) {
      expect(checkAllowlist(email, CONFIG).allowed).toBe(false);
    }
  });

  it("rejects an address that only contains the domain in the local part", () => {
    expect(
      checkAllowlist("itbhu.ac.in.cse26@gmail.com", CONFIG).allowed,
    ).toBe(false);
  });

  it("fails closed when nothing is configured", () => {
    const result = checkAllowlist("anyone@anywhere.com", {
      domain: "",
      localSuffix: "",
      emails: [],
    });
    expect(result.allowed).toBe(false);
    if (result.allowed) throw new Error("unreachable");
    expect(result.reason).toBe("NOT_CONFIGURED");
  });

  it("honours the explicit email list alongside the domain rule", () => {
    const config = { ...CONFIG, emails: ["observer@example.com"] };
    expect(checkAllowlist("observer@example.com", config).allowed).toBe(true);
    expect(checkAllowlist("stranger@example.com", config).allowed).toBe(false);
  });

  it("allows any local part when no suffix is configured", () => {
    const config = { ...CONFIG, localSuffix: "" };
    expect(checkAllowlist("anything@itbhu.ac.in", config).allowed).toBe(true);
  });

  it.each([null, undefined, 42, "", "no-at-sign", "two@@ats.com", "a b@c.com"])(
    "rejects malformed input %s",
    (input) => {
      expect(normaliseEmail(input)).toBeNull();
      expect(checkAllowlist(input, CONFIG).allowed).toBe(false);
    },
  );
});
