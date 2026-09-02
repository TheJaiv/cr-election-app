"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CANDIDATES,
  FEMALE_CANDIDATES,
  MALE_CANDIDATES,
  getCandidate,
} from "@/config/candidates";
import { CSRF_COOKIE, CSRF_HEADER } from "@/lib/csrfShared";
import { SeatSection } from "./SeatSection";

type Stage = "loading" | "picking" | "review" | "done";

interface SessionState {
  signedIn: boolean;
  email?: string;
  votingOpen?: boolean;
  hasVoted?: boolean;
}

function readCookie(name: string): string {
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : "";
}

function ReviewRow({ seat, id }: { seat: string; id: string }) {
  const candidate = getCandidate(id);
  if (!candidate) return null;
  return (
    <div className="review-row">
      {candidate.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={candidate.photo} alt="" />
      ) : (
        <span className="avatar" aria-hidden="true" />
      )}
      <div>
        <div className="seat-label">{seat}</div>
        <div className="who">{candidate.name}</div>
      </div>
    </div>
  );
}

export function Ballot({ signOutAction }: { signOutAction: () => void }) {
  const [stage, setStage] = useState<Stage>("loading");
  const [state, setState] = useState<SessionState | null>(null);
  const [malePick, setMalePick] = useState<string | null>(null);
  const [femalePick, setFemalePick] = useState<string | null>(null);
  const [openPick, setOpenPick] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // One nonce per page load. Reused across retries so a duplicate submission of
  // the same ballot is rejected server-side rather than double-counted.
  const [nonce] = useState(() =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now()) + Math.random().toString(36).slice(2),
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/session-state", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: SessionState) => {
        if (cancelled) return;
        setState(data);
        setStage(data.hasVoted ? "done" : "picking");
      })
      .catch(() => {
        if (!cancelled) setError("Could not reach the server. Try reloading.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // UX only: the server independently rejects an open pick that matches either
  // of the other two.
  const openBlocked = useMemo(
    () => new Set([malePick, femalePick].filter(Boolean) as string[]),
    [malePick, femalePick],
  );

  const handleOpenChange = useCallback((id: string) => {
    setOpenPick(id);
  }, []);

  // If the open pick becomes invalid because a seat pick changed, clear it.
  useEffect(() => {
    if (openPick && openBlocked.has(openPick)) setOpenPick(null);
  }, [openBlocked, openPick]);

  const complete = Boolean(malePick && femalePick && openPick);

  async function submit() {
    if (!complete || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/vote", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [CSRF_HEADER]: readCookie(CSRF_COOKIE),
        },
        body: JSON.stringify({ malePick, femalePick, openPick, nonce }),
      });
      if (response.ok) {
        setStage("done");
        return;
      }
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
      };
      if (data.code === "ALREADY_VOTED") {
        setStage("done");
        setState((s) => (s ? { ...s, hasVoted: true } : s));
        return;
      }
      setError(data.error ?? "Something went wrong. Try again.");
      setStage("picking");
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (stage === "loading") {
    return <p className="footnote">Loading your ballot…</p>;
  }

  if (state && !state.votingOpen && !state.hasVoted) {
    return (
      <div className="card center stack">
        <p className="notice info" style={{ marginBottom: 0 }}>
          Voting is closed right now. If you think this is a mistake, contact the
          election administrator.
        </p>
        <button className="secondary" onClick={signOutAction}>
          Sign out
        </button>
      </div>
    );
  }

  if (stage === "done") {
    return (
      <div className="card center stack">
        <div style={{ fontSize: 44, lineHeight: 1 }} aria-hidden="true">
          ✅
        </div>
        <h2 style={{ margin: 0, fontSize: 19 }}>Your vote is recorded</h2>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
          Thanks for voting. Ballots are anonymous and cannot be changed, so
          there is nothing more to do. Results are published after voting closes.
        </p>
        <button className="secondary" onClick={signOutAction}>
          Sign out
        </button>
      </div>
    );
  }

  if (stage === "review") {
    return (
      <>
        <div className="card">
          <h2 style={{ fontSize: 16, margin: "0 0 4px" }}>Check your ballot</h2>
          <p className="hint" style={{ marginBottom: 8 }}>
            Once you submit, it cannot be changed.
          </p>
          <ReviewRow seat="Male seat" id={malePick!} />
          <ReviewRow seat="Female seat" id={femalePick!} />
          <ReviewRow seat="Open seat" id={openPick!} />
        </div>
        {error ? <p className="notice error">{error}</p> : null}
        <div className="sticky-actions stack">
          <button className="primary" onClick={submit} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit my vote"}
          </button>
          <button
            className="secondary"
            onClick={() => setStage("picking")}
            disabled={submitting}
          >
            Go back and change
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {error ? <p className="notice error">{error}</p> : null}

      <SeatSection
        title="1. Male seat"
        hint="Pick one of the seven male candidates."
        candidates={MALE_CANDIDATES}
        value={malePick}
        onChange={setMalePick}
      />

      <SeatSection
        title="2. Female seat"
        hint="Pick one of the two female candidates."
        candidates={FEMALE_CANDIDATES}
        value={femalePick}
        onChange={setFemalePick}
      />

      <SeatSection
        title="3. Open seat"
        hint="Pick anyone — except the two people you already picked above."
        candidates={CANDIDATES}
        value={openPick}
        onChange={handleOpenChange}
        isDisabled={(c) => openBlocked.has(c.id)}
        disabledNote="Already picked"
      />

      <div className="sticky-actions">
        <button
          className="primary"
          disabled={!complete}
          onClick={() => setStage("review")}
        >
          {complete ? "Review my ballot" : "Pick all three seats"}
        </button>
      </div>

      <p className="footnote">
        Signed in as {state?.email}. Your ballot is stored separately from your
        email — nobody can see how you voted.
      </p>
    </>
  );
}
