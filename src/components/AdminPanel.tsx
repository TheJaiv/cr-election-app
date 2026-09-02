"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getCandidate } from "@/config/candidates";

const POLL_MS = 8000;

interface Status {
  votingOpen: boolean;
  votesCast: number;
  totalElectorate: number;
  remaining: number;
  percent: number;
}

interface CandidateResult {
  candidateId: string;
  name: string;
  gender: "male" | "female";
  seatVotes: number;
  openVotes: number;
  totalVotes: number;
}

interface SeatRow {
  candidateId: string;
  name: string;
  votes: number;
}

interface Tally {
  totalBallots: number;
  combined: CandidateResult[];
  male: SeatRow[];
  female: SeatRow[];
  open: SeatRow[];
}

interface Student {
  roll: string;
  name: string;
  email?: string;
}

interface Roll {
  voted: Student[];
  notVoted: Student[];
  unknown: string[];
}

/** One candidate's bar, split into seat votes and open-seat votes. */
function ResultRow({ row, max }: { row: CandidateResult; max: number }) {
  const candidate = getCandidate(row.candidateId);
  const pct = (n: number) => `${max === 0 ? 0 : (n / max) * 100}%`;
  return (
    <div className="result-row">
      {candidate?.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={candidate.photo} alt="" />
      ) : (
        <span className="avatar" aria-hidden="true" />
      )}
      <div className="body">
        <div className="name-line">
          <span className="nm">{row.name}</span>
          <span className="total">{row.totalVotes}</span>
        </div>
        <div
          className="bar-track"
          role="img"
          aria-label={`${row.name}: ${row.totalVotes} votes total, ${row.seatVotes} from the ${row.gender} seat and ${row.openVotes} from the open seat`}
        >
          <div className="bar-seat" style={{ width: pct(row.seatVotes) }} />
          <div className="bar-open" style={{ width: pct(row.openVotes) }} />
        </div>
        <div className="split">
          {row.seatVotes} {row.gender} seat · {row.openVotes} open
        </div>
      </div>
    </div>
  );
}

function SeatBreakdown({ title, rows }: { title: string; rows: SeatRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.votes));
  return (
    <div style={{ marginBottom: 18 }}>
      <div className="seat-label" style={{ marginBottom: 8 }}>
        {title}
      </div>
      {rows.map((row) => (
        <div key={row.candidateId} style={{ marginBottom: 9 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 13,
              marginBottom: 4,
            }}
          >
            <span>{row.name}</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {row.votes}
            </span>
          </div>
          <div className="bar-track">
            <div
              className="bar-seat"
              style={{ width: `${(row.votes / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AdminPanel() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [tally, setTally] = useState<Tally | null>(null);
  const [roll, setRoll] = useState<Roll | null>(null);
  const [tab, setTab] = useState<"results" | "pending" | "seats">("results");
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const inFlight = useRef(false);

  /** One pass over every admin endpoint. Silent — it runs on a timer. */
  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const [statusRes, tallyRes, rollRes] = await Promise.all([
        fetch("/api/admin/status", { cache: "no-store" }),
        fetch("/api/admin/tally", { cache: "no-store" }),
        fetch("/api/admin/roll", { cache: "no-store" }),
      ]);
      if (statusRes.status === 401) {
        setAuthed(false);
        return;
      }
      setAuthed(true);
      if (statusRes.ok) setStatus((await statusRes.json()) as Status);
      if (tallyRes.ok) setTally((await tallyRes.json()) as Tally);
      if (rollRes.ok) setRoll((await rollRes.json()) as Roll);
      setLastUpdated(new Date());
    } catch {
      // A dropped poll is not worth a banner; the next tick retries.
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Live updates. Polling stops while the tab is hidden so a laptop left open
  // on this page does not hammer the Sheets API all day.
  useEffect(() => {
    if (!authed) return;
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const id = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [authed, refresh]);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "Login failed.");
        return;
      }
      setPassword("");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function setVoting(open: boolean) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/voting", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ open }),
      });
      if (!response.ok) {
        setError("Could not change the voting state.");
        return;
      }
      setMessage(open ? "Voting is now open." : "Voting is now closed.");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function saveTally() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/tally", { method: "POST" });
      if (!response.ok) {
        setError("Could not write the tally.");
        return;
      }
      setTally((await response.json()) as Tally);
      setMessage("Tally written to the Results tab.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthed(false);
    setStatus(null);
    setTally(null);
    setRoll(null);
  }

  if (authed === null) {
    return (
      <p className="footnote">
        <span className="spinner" /> Loading…
      </p>
    );
  }

  if (!authed) {
    return (
      <form className="card stack" onSubmit={login}>
        <p style={{ margin: 0, fontSize: 15, color: "var(--muted)" }}>
          Enter the admin password. This is separate from the Google sign-in
          voters use.
        </p>
        <input
          type="password"
          value={password}
          autoComplete="current-password"
          placeholder="Admin password"
          onChange={(event) => setPassword(event.target.value)}
        />
        {error ? (
          <p className="notice error" style={{ margin: 0 }}>
            {error}
          </p>
        ) : null}
        <button className="primary" type="submit" disabled={busy || !password}>
          {busy ? "Checking…" : "Unlock"}
        </button>
      </form>
    );
  }

  const pending = roll?.notVoted ?? [];
  const needle = filter.trim().toLowerCase();
  const visiblePending = needle
    ? pending.filter(
        (s) =>
          s.name.toLowerCase().includes(needle) || s.roll.includes(needle),
      )
    : pending;

  const maxTotal = Math.max(1, ...(tally?.combined ?? []).map((c) => c.totalVotes));

  return (
    <>
      {message ? <p className="notice ok">{message}</p> : null}
      {error ? <p className="notice error">{error}</p> : null}
      {roll?.unknown?.length ? (
        <p className="notice warn">
          {roll.unknown.length} voter(s) in the sheet are not on the roll:{" "}
          {roll.unknown.join(", ")}
        </p>
      ) : null}

      <div className="stat-row">
        <div className="stat">
          <div className="value">{status?.votesCast ?? "—"}</div>
          <div className="label">votes cast</div>
        </div>
        <div className="stat">
          <div className="value">{status?.remaining ?? "—"}</div>
          <div className="label">yet to vote</div>
        </div>
        <div className="stat">
          <div className="value">
            {status ? `${Math.round(status.percent)}%` : "—"}
          </div>
          <div className="label">turnout</div>
        </div>
      </div>

      <div className="card">
        <div className="section-title">
          <span>
            Turnout{" "}
            <span
              className={`pill ${status?.votingOpen ? "open" : "closed"}`}
              style={{ marginLeft: 6 }}
            >
              <span className="dot" />
              {status?.votingOpen ? "Voting open" : "Voting closed"}
            </span>
          </span>
          <span className="meta">
            {status?.votesCast ?? 0} / {status?.totalElectorate ?? 0}
          </span>
        </div>
        <div className="turnout-track">
          <div
            className="turnout-fill"
            style={{ width: `${status?.percent ?? 0}%` }}
          />
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          {status?.votingOpen ? (
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setVoting(false)}
            >
              Close voting
            </button>
          ) : (
            <button
              className="primary"
              disabled={busy}
              onClick={() => setVoting(true)}
            >
              Open voting
            </button>
          )}
          <button className="secondary" disabled={busy} onClick={saveTally}>
            Save tally to sheet
          </button>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <a className="btn" href="/api/admin/export">
            Results CSV
          </a>
          <a className="btn" href="/api/admin/export?what=pending">
            Pending CSV
          </a>
        </div>
      </div>

      <div className="tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === "results"}
          onClick={() => setTab("results")}
        >
          Results
        </button>
        <button
          role="tab"
          aria-selected={tab === "seats"}
          onClick={() => setTab("seats")}
        >
          By seat
        </button>
        <button
          role="tab"
          aria-selected={tab === "pending"}
          onClick={() => setTab("pending")}
        >
          Not voted ({pending.length})
        </button>
      </div>

      {tab === "results" ? (
        <div className="card">
          <div className="section-title">
            <span>
              Standings <span className="live-dot" aria-hidden="true" />
            </span>
            <span className="meta">
              {tally?.totalBallots ?? 0} ballots
              {lastUpdated
                ? ` · ${lastUpdated.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}`
                : ""}
            </span>
          </div>
          <div className="legend">
            <span>
              <i /> own seat
            </span>
            <span>
              <i className="soft" /> open seat
            </span>
          </div>
          {tally?.combined.map((row) => (
            <ResultRow key={row.candidateId} row={row} max={maxTotal} />
          ))}
          <p className="footnote" style={{ textAlign: "left", marginTop: 14 }}>
            A candidate&apos;s total is their own-seat votes plus their
            open-seat votes, since both are votes for the same person.
          </p>
        </div>
      ) : null}

      {tab === "seats" ? (
        <div className="card">
          <div className="section-title">
            <span>Per-seat breakdown</span>
            <span className="meta">{tally?.totalBallots ?? 0} ballots</span>
          </div>
          {tally ? (
            <>
              <SeatBreakdown title="Male seat" rows={tally.male} />
              <SeatBreakdown title="Female seat" rows={tally.female} />
              <SeatBreakdown title="Open seat" rows={tally.open} />
            </>
          ) : null}
        </div>
      ) : null}

      {tab === "pending" ? (
        <div className="card">
          <div className="section-title">
            <span>Yet to vote</span>
            <span className="meta">{pending.length} students</span>
          </div>
          <input
            type="search"
            placeholder="Filter by name or roll number"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
          <div className="pending-list">
            {visiblePending.length === 0 ? (
              <div className="pending-item" style={{ color: "var(--muted)" }}>
                {pending.length === 0
                  ? "Everyone has voted."
                  : "No one matches that filter."}
              </div>
            ) : (
              visiblePending.map((student) => (
                <div className="pending-item" key={student.roll}>
                  <span className="roll">{student.roll}</span>
                  <span className="nm">{student.name}</span>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      <button className="ghost" onClick={logout}>
        Lock admin panel
      </button>
    </>
  );
}
