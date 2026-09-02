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
  roll?: string;
  name?: string;
  votingOpen?: boolean;
  hasVoted?: boolean;
}

function readCookie(name: string): string {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
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

function Identity({
  state,
  onSignOut,
}: {
  state: SessionState;
  onSignOut: () => void;
}) {
  return (
    <div className="identity">
      <div>
        {state.name ? (
          <>
            <span className="roll">{state.name}</span>
            {state.roll ? (
              <span className="sub"> · {state.roll}</span>
            ) : null}
          </>
        ) : (
          <span className="roll">{state.email}</span>
        )}
        {state.name ? <div className="sub">{state.email}</div> : null}
      </div>
      <button
        className="ghost"
        style={{ width: "auto", flex: "none" }}
        onClick={onSignOut}
      >
        Sign out
      </button>
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

  // One nonce per page load, reused across retries so a duplicate submission of
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

  const handleOpenChange = useCallback((id: string) => setOpenPick(id), []);

  // If a seat pick changes and invalidates the open pick, clear it.
  useEffect(() => {
    if (openPick && openBlocked.has(openPick)) setOpenPick(null);
  }, [openBlocked, openPick]);

  const complete = Boolean(malePick && femalePick && openPick);
  const picked = [malePick, femalePick, openPick].filter(Boolean).length;

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
    return (
      <p className="footnote">
        <span className="spinner" /> Loading your ballot…
      </p>
    );
  }

  if (state && !state.votingOpen && !state.hasVoted) {
    return (
      <>
        {state ? <Identity state={state} onSignOut={signOutAction} /> : null}
        <div className="card center stack">
          <div style={{ fontSize: 38, lineHeight: 1 }} aria-hidden="true">
            🔒
          </div>
          <h2 style={{ margin: 0, fontSize: 18 }}>Voting is not open</h2>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
            The ballot opens when the election administrator starts voting.
            Check back shortly.
          </p>
        </div>
      </>
    );
  }

  if (stage === "done") {
    return (
      <>
        {state ? <Identity state={state} onSignOut={signOutAction} /> : null}
        <div className="card center stack">
          <div style={{ fontSize: 42, lineHeight: 1 }} aria-hidden="true">
            ✅
          </div>
          <h2 style={{ margin: 0, fontSize: 19 }}>Your vote is recorded</h2>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
            Thanks for voting. Ballots are anonymous and cannot be changed, so
            there is nothing more to do. Results are published once voting
            closes.
          </p>
        </div>
        <p className="footnote">
          Your name is recorded only as having voted. Which candidates you chose
          is stored separately and cannot be traced back to you.
        </p>
      </>
    );
  }

  if (stage === "review") {
    return (
      <>
        <div className="card">
          <div className="seat-head">
            <h2>Check your ballot</h2>
          </div>
          <p className="hint" style={{ margin: "2px 0 10px" }}>
            Once you submit, it cannot be changed.
          </p>
          <ReviewRow seat="Male seat" id={malePick!} />
          <ReviewRow seat="Female seat" id={femalePick!} />
          <ReviewRow seat="Open seat" id={openPick!} />
        </div>
        {error ? <p className="notice error">{error}</p> : null}
        <div className="sticky-actions stack">
          <button className="primary" onClick={submit} disabled={submitting}>
            {submitting ? (
              <>
                <span className="spinner" /> Submitting…
              </>
            ) : (
              "Submit my vote"
            )}
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
      {state ? <Identity state={state} onSignOut={signOutAction} /> : null}
      {error ? <p className="notice error">{error}</p> : null}

      <SeatSection
        step={1}
        title="Male seat"
        hint="Pick one of the seven male candidates."
        candidates={MALE_CANDIDATES}
        value={malePick}
        onChange={setMalePick}
      />

      <SeatSection
        step={2}
        title="Female seat"
        hint="Pick one of the two female candidates."
        candidates={FEMALE_CANDIDATES}
        value={femalePick}
        onChange={setFemalePick}
      />

      <SeatSection
        step={3}
        title="Open seat"
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
          {complete ? "Review my ballot" : `${picked} of 3 seats picked`}
        </button>
      </div>
    </>
  );
}
