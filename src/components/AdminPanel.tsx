"use client";

import { useCallback, useEffect, useState } from "react";

interface Status {
  votingOpen: boolean;
  votesCast: number;
  totalElectorate: number;
  remaining: number;
}

interface ResultRow {
  seat: string;
  candidateId: string;
  name: string;
  votes: number;
}

interface Tally {
  totalBallots: number;
  male: ResultRow[];
  female: ResultRow[];
  open: ResultRow[];
}

function BarChart({ title, rows }: { title: string; rows: ResultRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.votes));
  return (
    <section className="card">
      <h2 style={{ fontSize: 15, margin: "0 0 12px" }}>{title}</h2>
      {rows.map((row) => (
        <div className="bar-row" key={`${row.seat}-${row.candidateId}`}>
          <div className="bar-head">
            <span>{row.name}</span>
            <span>{row.votes}</span>
          </div>
          <div
            className="bar-track"
            role="img"
            aria-label={`${row.name}: ${row.votes} votes`}
          >
            <div
              className="bar-fill"
              style={{ width: `${(row.votes / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </section>
  );
}

export function AdminPanel() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [tally, setTally] = useState<Tally | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadStatus = useCallback(async () => {
    const response = await fetch("/api/admin/status", { cache: "no-store" });
    if (response.status === 401) {
      setAuthed(false);
      return;
    }
    setAuthed(true);
    setStatus((await response.json()) as Status);
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

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
      await loadStatus();
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
      setMessage(open ? "Voting is now OPEN." : "Voting is now CLOSED.");
      // The tally is sealed again the moment voting reopens.
      if (open) setTally(null);
      await loadStatus();
    } finally {
      setBusy(false);
    }
  }

  async function refreshTally() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/tally", { method: "POST" });
      if (response.status === 403) {
        setError("Close voting first — results stay sealed while it is open.");
        return;
      }
      if (!response.ok) {
        setError("Could not compute the tally.");
        return;
      }
      setTally((await response.json()) as Tally);
      setMessage("Tally recomputed and written to the Results tab.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthed(false);
    setStatus(null);
    setTally(null);
  }

  if (!authed) {
    return (
      <form className="card stack" onSubmit={login}>
        <p style={{ margin: 0, fontSize: 15 }}>
          Enter the admin password. This is separate from your Google sign-in.
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

  return (
    <>
      {message ? <p className="notice ok">{message}</p> : null}
      {error ? <p className="notice error">{error}</p> : null}

      <div className="stat-row" style={{ marginBottom: 16 }}>
        <div className="stat">
          <div className="value">{status?.votesCast ?? "—"}</div>
          <div className="label">votes cast</div>
        </div>
        <div className="stat">
          <div className="value">{status?.remaining ?? "—"}</div>
          <div className="label">remaining of {status?.totalElectorate}</div>
        </div>
        <div className="stat">
          <div className="value" style={{ fontSize: 20 }}>
            {status?.votingOpen ? "OPEN" : "CLOSED"}
          </div>
          <div className="label">voting</div>
        </div>
      </div>

      <div className="card stack">
        {status?.votingOpen ? (
          <button
            className="primary"
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
        <button className="secondary" disabled={busy} onClick={refreshTally}>
          Refresh tally
        </button>
        <a
          className="secondary"
          href="/api/admin/export"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 48,
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--text)",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Export CSV
        </a>
        <button className="secondary" onClick={logout}>
          Lock admin panel
        </button>
      </div>

      {status?.votingOpen ? (
        <p className="notice info">
          Results are sealed while voting is open — the tally endpoint returns
          403 for everyone, including this panel. Close voting to see them.
        </p>
      ) : null}

      {tally ? (
        <>
          <p className="footnote" style={{ textAlign: "left" }}>
            {tally.totalBallots} ballots counted.
          </p>
          <BarChart title="Male seat" rows={tally.male} />
          <BarChart title="Female seat" rows={tally.female} />
          <BarChart title="Open seat" rows={tally.open} />
        </>
      ) : null}
    </>
  );
}
