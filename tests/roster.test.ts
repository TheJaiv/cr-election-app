import { describe, expect, it } from "vitest";
import { CANDIDATES, TOTAL_ELECTORATE } from "@/config/candidates";
import { ROSTER, splitByTurnout, studentByEmail } from "@/config/roster";

describe("electoral roll", () => {
  it("holds the whole electorate", () => {
    expect(ROSTER).toHaveLength(152);
    expect(ROSTER).toHaveLength(TOTAL_ELECTORATE);
  });

  it("has unique roll numbers and unique emails", () => {
    expect(new Set(ROSTER.map((s) => s.roll)).size).toBe(ROSTER.length);
    expect(new Set(ROSTER.map((s) => s.email.toLowerCase())).size).toBe(
      ROSTER.length,
    );
  });

  it("has roll numbers running 26075001 to 26075152 with no gaps", () => {
    const rolls = ROSTER.map((s) => Number(s.roll)).sort((a, b) => a - b);
    expect(rolls[0]).toBe(26075001);
    expect(rolls[rolls.length - 1]).toBe(26075152);
    for (let i = 1; i < rolls.length; i++) {
      expect(rolls[i]).toBe(rolls[i - 1] + 1);
    }
  });

  it("gives every student a well-formed institute address", () => {
    for (const student of ROSTER) {
      expect(student.email).toMatch(/^[a-z0-9.]+\.cse26@itbhu\.ac\.in$/);
      expect(student.name.trim()).not.toBe("");
      expect(student.roll).toMatch(/^\d{8}$/);
    }
  });

  it("matches the allowlist rule, so every student can actually sign in", () => {
    for (const student of ROSTER) {
      const [local, domain] = student.email.split("@");
      expect(domain).toBe("itbhu.ac.in");
      expect(local.endsWith(".cse26")).toBe(true);
    }
  });

  it("contains all nine candidates", () => {
    const namesOnRoll = new Set(ROSTER.map((s) => s.name.toLowerCase()));
    for (const candidate of CANDIDATES) {
      expect(namesOnRoll.has(candidate.name.toLowerCase())).toBe(true);
    }
  });

  it("looks a student up by email, case-insensitively", () => {
    expect(studentByEmail("jaiv.patel.cse26@itbhu.ac.in")?.roll).toBe(
      "26075057",
    );
    expect(studentByEmail("JAIV.PATEL.CSE26@ITBHU.AC.IN")?.name).toBe(
      "Jaiv Patel",
    );
    expect(studentByEmail("nobody@itbhu.ac.in")).toBeUndefined();
  });
});

describe("turnout split", () => {
  it("puts everyone in notVoted when nobody has voted", () => {
    const { voted, notVoted, unknown } = splitByTurnout([]);
    expect(voted).toHaveLength(0);
    expect(notVoted).toHaveLength(152);
    expect(unknown).toHaveLength(0);
  });

  it("moves a voter across and never loses anyone", () => {
    const { voted, notVoted } = splitByTurnout([
      "jaiv.patel.cse26@itbhu.ac.in",
      "SOMA.SRINIDHI.CSE26@itbhu.ac.in",
    ]);
    expect(voted.map((s) => s.roll).sort()).toEqual(["26075057", "26075131"]);
    expect(notVoted).toHaveLength(150);
    expect(voted.length + notVoted.length).toBe(152);
  });

  it("flags a voter who is not on the roll instead of hiding them", () => {
    const { unknown, notVoted } = splitByTurnout(["stranger@itbhu.ac.in"]);
    expect(unknown).toEqual(["stranger@itbhu.ac.in"]);
    expect(notVoted).toHaveLength(152);
  });

  it("ignores blank rows in the Voters tab", () => {
    const { voted, unknown } = splitByTurnout(["", "   "]);
    expect(voted).toHaveLength(0);
    expect(unknown).toHaveLength(0);
  });
});
