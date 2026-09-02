/**
 * Ballot validation. Pure functions, no I/O — this is the module the rule tests
 * exercise directly, and it is the only place the election rules are encoded.
 *
 * Rules:
 *   - malePick   must be a male candidate
 *   - femalePick must be a female candidate
 *   - openPick   may be any candidate, but must differ from BOTH other picks
 */

import { getCandidate } from "@/config/candidates";

export interface BallotInput {
  malePick: unknown;
  femalePick: unknown;
  openPick: unknown;
}

export interface ValidBallot {
  malePick: string;
  femalePick: string;
  openPick: string;
}

export type ValidationError =
  | "MISSING_MALE_PICK"
  | "MISSING_FEMALE_PICK"
  | "MISSING_OPEN_PICK"
  | "UNKNOWN_MALE_PICK"
  | "UNKNOWN_FEMALE_PICK"
  | "UNKNOWN_OPEN_PICK"
  | "MALE_PICK_NOT_MALE"
  | "FEMALE_PICK_NOT_FEMALE"
  | "OPEN_PICK_EQUALS_MALE_PICK"
  | "OPEN_PICK_EQUALS_FEMALE_PICK";

export const VALIDATION_MESSAGES: Record<ValidationError, string> = {
  MISSING_MALE_PICK: "Pick a candidate for the male seat.",
  MISSING_FEMALE_PICK: "Pick a candidate for the female seat.",
  MISSING_OPEN_PICK: "Pick a candidate for the open seat.",
  UNKNOWN_MALE_PICK: "That male-seat candidate does not exist.",
  UNKNOWN_FEMALE_PICK: "That female-seat candidate does not exist.",
  UNKNOWN_OPEN_PICK: "That open-seat candidate does not exist.",
  MALE_PICK_NOT_MALE: "The male seat must go to a male candidate.",
  FEMALE_PICK_NOT_FEMALE: "The female seat must go to a female candidate.",
  OPEN_PICK_EQUALS_MALE_PICK:
    "Your open-seat pick cannot be the same person as your male-seat pick.",
  OPEN_PICK_EQUALS_FEMALE_PICK:
    "Your open-seat pick cannot be the same person as your female-seat pick.",
};

export type ValidationResult =
  | { ok: true; ballot: ValidBallot }
  | { ok: false; error: ValidationError; message: string };

function fail(error: ValidationError): ValidationResult {
  return { ok: false, error, message: VALIDATION_MESSAGES[error] };
}

function asId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function validateBallot(input: BallotInput): ValidationResult {
  const malePick = asId(input.malePick);
  const femalePick = asId(input.femalePick);
  const openPick = asId(input.openPick);

  if (!malePick) return fail("MISSING_MALE_PICK");
  if (!femalePick) return fail("MISSING_FEMALE_PICK");
  if (!openPick) return fail("MISSING_OPEN_PICK");

  const male = getCandidate(malePick);
  const female = getCandidate(femalePick);
  const open = getCandidate(openPick);

  if (!male) return fail("UNKNOWN_MALE_PICK");
  if (!female) return fail("UNKNOWN_FEMALE_PICK");
  if (!open) return fail("UNKNOWN_OPEN_PICK");

  if (male.gender !== "male") return fail("MALE_PICK_NOT_MALE");
  if (female.gender !== "female") return fail("FEMALE_PICK_NOT_FEMALE");

  // The hard rule. Checked here on the server; the UI greys these two out but
  // that is UX only and is never trusted.
  if (openPick === malePick) return fail("OPEN_PICK_EQUALS_MALE_PICK");
  if (openPick === femalePick) return fail("OPEN_PICK_EQUALS_FEMALE_PICK");

  return { ok: true, ballot: { malePick, femalePick, openPick } };
}
