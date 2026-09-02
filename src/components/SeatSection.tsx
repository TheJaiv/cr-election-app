"use client";

import type { Candidate } from "@/config/candidates";
import { CandidateCard } from "./CandidateCard";

export function SeatSection({
  step,
  title,
  hint,
  candidates,
  value,
  onChange,
  isDisabled,
  disabledNote,
}: {
  step: number;
  title: string;
  hint: string;
  candidates: readonly Candidate[];
  value: string | null;
  onChange: (id: string) => void;
  isDisabled?: (candidate: Candidate) => boolean;
  disabledNote?: string;
}) {
  return (
    <section className="card seat">
      <div className="seat-head">
        <span className="step" aria-hidden="true">
          {step}
        </span>
        <h2>{title}</h2>
      </div>
      <p className="hint">{hint}</p>
      <div className="grid" role="group" aria-label={title}>
        {candidates.map((candidate) => (
          <CandidateCard
            key={candidate.id}
            candidate={candidate}
            selected={value === candidate.id}
            disabled={isDisabled?.(candidate) ?? false}
            disabledNote={disabledNote}
            onSelect={onChange}
          />
        ))}
      </div>
    </section>
  );
}
