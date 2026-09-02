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
      {selected ? (
        <span className="tick" aria-hidden="true">
          ✓
        </span>
      ) : null}
      {candidate.photo ? (
        // Plain <img>: photos are local and already sized, so the image
        // optimiser would add a round trip for nothing.
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
