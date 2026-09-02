# CR Election 2026

A single-page class representative election. Google sign-in, three seats per
ballot, Google Sheets as the datastore, deployable on Vercel.

**Setup instructions live in [SETUP.md](./SETUP.md).** Start there.

## The rules

Each voter casts exactly three votes:

1. **Male seat** — one of the seven male candidates
2. **Female seat** — one of the two female candidates
3. **Open seat** — any of the nine, but **not** the same person as either pick
   above

The open-seat rule is enforced on the server before anything is written. The UI
greys out the two already-picked candidates as a convenience only.

**Scoring.** A candidate's total is their own-seat votes plus their open-seat
votes — both are votes for the same person. The per-seat splits are kept too,
since the reserved seats are decided separately.

## Layout

```
src/
  config/candidates.ts     the nine candidates — edit this to change the ballot
  config/roster.ts         the 152-student electoral roll (SERVER ONLY, real PII)
  lib/
    ballot.ts              the election rules (pure, heavily tested)
    allowlist.ts           who may sign in
    auth.ts                NextAuth/Google, email only — no name, no avatar
    adminAuth.ts           scrypt password hash + signed admin cookie
    csrf.ts                double-submit token + origin check
  server/
    store.ts               storage interface
    sheets.ts              Google Sheets implementation
    castVote.ts            the vote pipeline: lock, check, two writes
    tally.ts               counting
    tallyGate.ts           the single gate that seals results while voting is open
  app/                     pages and API routes
tests/                     rule, concurrency, allowlist, admin, CSRF tests
```

## Commands

```bash
npm install
npm run verify-sheet     # preflight the Google Sheets wiring
npm run dev              # http://localhost:3000
npm test                 # 99 tests
npm run typecheck
npm run build
npm run hash-password -- "your admin password"

npm run election status            # voters, ballots, toggle, rule sanity check
npm run election reset -- --confirm  # wipe test data (destructive)
```

## Notes

- Nothing but the email address is collected. The Google scope is
  `openid email`; `name` and `picture` are stripped in the profile callback.
- Ballots carry a random UUID, sit at a random row position, and are dated to
  the day, so they cannot be matched against the Voters tab.
- Results return 403 to everyone until voting is closed from `/admin`.
