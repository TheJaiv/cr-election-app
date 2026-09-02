/**
 * Candidate roster for the CR election.
 *
 * This is the single source of truth. The server validates every submitted
 * candidate id against this list, so editing this file is how you change the
 * ballot. Ids are stable strings — do NOT reuse an id for a different person
 * once voting has started, or historical ballots become misattributed.
 *
 * `photo` is a path under /public.
 */

export type Gender = "male" | "female";

export interface Candidate {
  id: string;
  name: string;
  gender: Gender;
  photo?: string;
}

export const CANDIDATES: readonly Candidate[] = [
  // ---- Female candidates (2) ----
  {
    id: "soma-srinidhi",
    name: "Soma Srinidhi",
    gender: "female",
    photo: "/candidates/soma_srinidhi.jpeg",
  },
  {
    id: "ashika-agrawal",
    name: "Ashika Agrawal",
    gender: "female",
    photo: "/candidates/ashika.jpeg",
  },

  // ---- Male candidates (7) ----
  {
    id: "sumit-kasaudhan",
    name: "Sumit Kasaudhan",
    gender: "male",
    photo: "/candidates/sumit.jpeg",
  },
  {
    id: "rajat-dubey",
    name: "Rajat Dubey",
    gender: "male",
    photo: "/candidates/rajat.jpeg",
  },
  {
    id: "aditya-narayan",
    name: "Aditya Narayan",
    gender: "male",
    photo: "/candidates/aditya.jpeg",
  },
  {
    id: "harsh-modi",
    name: "Harsh Modi",
    gender: "male",
    photo: "/candidates/harsh_modi.jpeg",
  },
  {
    id: "maddi-saketh",
    name: "Maddi Saketh",
    gender: "male",
    photo: "/candidates/maddi-saketh.jpeg",
  },
  {
    id: "sahil-gupta",
    name: "Sahil Gupta",
    gender: "male",
    photo: "/candidates/sahil-gupta.jpeg",
  },
  {
    id: "gopal-saxena",
    name: "Gopal Saxena",
    gender: "male",
    photo: "/candidates/gopal.jpeg",
  },
] as const;

/** Size of the electorate, used to show "votes remaining" in the admin panel. */
export const TOTAL_ELECTORATE = 152;

export const MALE_CANDIDATES = CANDIDATES.filter((c) => c.gender === "male");
export const FEMALE_CANDIDATES = CANDIDATES.filter((c) => c.gender === "female");

const BY_ID = new Map(CANDIDATES.map((c) => [c.id, c]));

export function getCandidate(id: string): Candidate | undefined {
  return BY_ID.get(id);
}

export function candidateName(id: string): string {
  return BY_ID.get(id)?.name ?? id;
}
