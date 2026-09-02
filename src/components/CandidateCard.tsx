"use client";

import type { Candidate } from "@/config/candidates";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function CandidateCard({
  candidate,
  selected,
  disabled,
  disabledNote,
  onSelect,
}: {
  candidate: Candidate;
  selected: boolean;
  disabled?: boolean;
  disabledNote?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      className="candidate"
      aria-pressed={selected}
      disabled={disabled}
      onClick={() => onSelect(candidate.id)}
    >
      {candidate.photo ? (
        // Plain <img>: photos are local, already sized, and this keeps the page
        // free of the image optimiser on Vercel's free tier.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={candidate.photo} alt="" loading="lazy" />
      ) : (
        <span className="avatar" aria-hidden="true">
          {initials(candidate.name)}
        </span>
      )}
      <span className="who">{candidate.name}</span>
      {disabled && disabledNote ? (
        <span className="note">{disabledNote}</span>
      ) : null}
    </button>
  );
}
