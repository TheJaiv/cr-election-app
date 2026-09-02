# Setup guide — CR Election 2026

Everything you need to go from an empty Google account to a live vote at a URL.
Budget about 45 minutes the first time.

You will end up with:

- a Google Cloud project holding the OAuth credentials and a service account,
- one Google Spreadsheet with three tabs,
- a Vercel deployment with roughly a dozen environment variables.

---

## 1. Create the spreadsheet

1. Go to <https://sheets.new> and name the file something like
   `CR Election 2026`.
2. Create **three tabs**, named exactly (capitalisation matters):

   | Tab | Row 1 headers (A, B, C, D, E) |
   | --- | --- |
   | `Voters` | `email`, `timestamp`, `guard` |
   | `Ballots` | `ballotId`, `malePick`, `femalePick`, `openPick`, `votedOn` |
   | `Results` | leave row 1 empty — the app writes the toggle there |

   Rename the default `Sheet1` to `Voters` rather than leaving a stray fourth
   tab lying around.

3. In `Results`, put `votingOpen` in **A1** and `FALSE` in **B1**. The app reads
   B1 to decide whether voting is open, and treats anything that is not `TRUE`
   as closed, so the election starts sealed. You will flip this from the admin
   panel; editing the cell by hand also works.

4. Copy the spreadsheet id out of the URL — it is the long string between
   `/d/` and `/edit`:

   ```
   https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit
                                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^ this
   ```

   That is `GOOGLE_SHEET_ID`.

### Why `guard` is there

The spec called for `email, timestamp` in `Voters`. There is a third column,
`guard`: a random token the server writes with each row. It exists only to
settle a write race — if two server instances both append a row for the same
email at the same instant, every instance can independently agree on which row
won by ordering on `(timestamp, guard)`, and the loser withdraws its row before
writing a ballot. It contains no personal data and is never linked to a ballot.

### Why `Ballots` stores a date, not a time

`votedOn` is `YYYY-MM-DD` with no time of day. This is deliberate. Inserting
ballots at random row positions hides submission *order*, but if each ballot
carried a second-precision timestamp, anyone with the sheet could line those up
against the `Voters` timestamps and de-anonymise most of the election in a
spreadsheet formula. A date-only field kills that correlation.

---

## 2. Google Cloud project + OAuth (the "Sign in with Google" button)

> **Check this first.** Google Sign-In only works if `itbhu.ac.in` addresses are
> Google accounts — i.e. the institute runs Google Workspace for its mail. Open
> an incognito window, go to <https://accounts.google.com>, and type one real
> `<name>.cse26@itbhu.ac.in` address. If Google says "Couldn't find your Google
> Account", no student can sign in and this whole auth approach has to change
> before you go any further.

1. Open <https://console.cloud.google.com/> and create a project — call it
   `cr-election`.
2. Enable the Sheets API: **APIs & Services → Library → Google Sheets API →
   Enable**.
3. Configure the consent screen. Google renamed this to **Google Auth
   Platform** — <https://console.cloud.google.com/auth/overview>. The old
   **APIs & Services → OAuth consent screen** link redirects here.

   Press **Get started** and complete all four steps. You cannot create an
   OAuth client until every one of them is saved:

   - **App name**: `CR Election 2026`. **User support email**: your address.
   - **Audience**:
     - **Internal** if your institute account is a Google Workspace account and
       the option is selectable. Internal means only accounts in your
       organisation can ever complete the flow — a second lock on top of the
       app's own allowlist. Prefer this.
     - **External** if Internal is greyed out (personal Gmail projects only get
       External).
   - **Contact information**: your email again.
   - Agree to the user data policy and **Create**.

   **Scopes: add none.** The app requests `openid email` at sign-in and nothing
   else, so there is no name and no profile picture to collect.

   **User caps — this decides whether 152 voters can actually sign in:**

   | Consent screen state | User cap | Verification review |
   | --- | --- | --- |
   | External + Testing | **100**, each added by hand | n/a |
   | External + Published | none | not required for `openid`/`email` |
   | Internal | none | n/a |

   **If you chose External, you must publish the app.** Go to **Audience →
   Publish app**. Testing mode caps you at **100 test users** and you have 152
   voters, so test users are not an option. Publishing is fine here: `openid`
   and `email` are non-sensitive scopes, so no Google verification review is
   required and voters see a normal consent screen. Your own allowlist is what
   restricts who can actually vote.

4. Create the OAuth client: **Google Auth Platform → Clients → Create client**
   (equivalently **APIs & Services → Credentials → Create Credentials → OAuth
   client ID**).
   - Application type: **Web application**.
   - Name: `cr-election-web`.
   - Authorised JavaScript origins:
     - `http://localhost:3000`
     - `https://<your-app>.vercel.app`
   - Authorised redirect URIs:
     - `http://localhost:3000/api/auth/callback/google`
     - `https://<your-app>.vercel.app/api/auth/callback/google`
   - Save, then copy the **Client ID** and **Client secret** into
     `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

   You can add the Vercel URL after the first deploy, once you know it. Come
   back and add it — sign-in will fail with `redirect_uri_mismatch` until the
   deployed URL is listed here exactly, including `https://` and no trailing
   slash.

### If client creation fails with "The attempted action failed, please try again. Request ID: ..."

That is a generic console error. In order of likelihood:

1. **The consent screen is not finished.** This is almost always it. Go to
   <https://console.cloud.google.com/auth/overview> and confirm **Branding**,
   **Audience**, and **Contact Information** are all filled in and saved. The
   Overview page should not be offering you **Get started** any more.
2. **You are signed into several Google accounts.** The console picks the wrong
   one and the write fails. Open an incognito window, sign in with only the
   account that owns the project, and retry.
3. **An ad blocker or privacy extension** is blocking the console's requests.
   Disable it for `console.cloud.google.com` and reload.
4. **The project is brand new.** Permissions take a few minutes to propagate.
   Wait five minutes and retry.
5. **A malformed entry in the origins or redirect boxes.** An origin must have
   no path and no trailing slash (`http://localhost:3000`, not
   `http://localhost:3000/`). A redirect URI must be the full path. Clear both
   lists, save the client empty, then add the URIs and save again.
6. **Your Workspace admin blocks OAuth client creation.** If `itbhu.ac.in`
   restricts this, no amount of retrying helps. Create the project under a
   personal Gmail account instead, choose **External**, and publish it as
   described above — the app's own allowlist still limits voting to
   `*.cse26@itbhu.ac.in`.

---

## 3. Service account (how the server writes to the sheet)

The OAuth client above is how *voters* sign in. The service account is how the
*server* reads and writes the spreadsheet. They are separate things.

1. **IAM & Admin → Service Accounts → Create service account**.
   - Name: `cr-election-sheets`. No roles are needed — access is granted by
     sharing the sheet, not by project IAM.
2. Open the new service account → **Keys → Add key → Create new key → JSON**.
   A `.json` file downloads. Treat it like a password.
3. From that JSON, take two fields:
   - `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
     (looks like `cr-election-sheets@cr-election.iam.gserviceaccount.com`)
   - `private_key` → `GOOGLE_PRIVATE_KEY`

   The private key is one long string containing literal `\n` sequences. Copy it
   verbatim, `\n` and all, and wrap the whole thing in double quotes:

   ```
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQI...\n-----END PRIVATE KEY-----\n"
   ```

   The app normalises `\n` back into real newlines, so both the escaped and the
   multi-line form work.

4. **Share the spreadsheet with the service account.** Open the sheet, click
   **Share**, paste the `client_email` address, give it **Editor**, and untick
   "Notify people". Without this the app gets a 403 on every read and the
   sheet's own permissions are what stop it, not the API key.

---

## 4. Restricting the spreadsheet itself to specific Google accounts

The app never exposes the sheet, but the sheet is still a Google Doc that anyone
with the link could open if you let them. Lock it down:

1. Open the sheet → **Share** → under **General access**, set
   **Restricted**. This is the important one: it means link-sharing is off and
   only explicitly listed accounts can open the file.
2. Under **People with access**, the list should be exactly:
   - **you** (Owner),
   - the **service account** (Editor) — from step 3.4,
   - optionally one or two co-admins you actually trust with raw ballots
     (Viewer is enough for them; Editor lets them alter results).

   Remove everyone else. If the file was created inside a Workspace domain,
   check that "Anyone in <your org> with the link" is **not** selected.
3. Click the gear icon in the Share dialog and turn **off**:
   - "Editors can change permissions and share" — stops a co-admin re-sharing
     the ballots,
   - "Viewers and commenters can see the option to download, print, and copy"
     — stops a casual viewer walking off with a copy.
4. Do not put the sheet in a shared drive or a shared folder. Folder permissions
   are inherited and quietly re-open the file to everyone in the folder.
5. Never publish it: **File → Share → Publish to web** must stay unpublished.

Worth knowing: anyone who can read this sheet can read every ballot in it. That
is why `Ballots` holds no email and only a date — even a full leak of the sheet
does not tell you how any individual voted. Keep the access list short anyway.

---

## 5. Environment variables

Copy `.env.example` to `.env.local` and fill it in.

```bash
cp .env.example .env.local
```

Generate the auth secret:

```bash
openssl rand -base64 32
```

Generate the admin password hash — this prints the whole line to paste:

```bash
npm run hash-password -- "some long admin password"
```

The plaintext password is never stored anywhere. Only the scrypt hash goes into
the environment, and login compares with a constant-time comparison.

The hash uses `:` between its fields, not `$`. That matters: Next expands
`$NAME` inside `.env` files, so a `$`-separated hash arrives corrupted and every
login attempt fails with "Incorrect password". Paste the line exactly as
printed.

Full list of variables:

| Variable | Required | What it is |
| --- | --- | --- |
| `AUTH_SECRET` | yes | Signs the session cookie and the admin token. |
| `AUTH_URL` | dev/preview | The origin you browse to. Vercel sets production automatically. |
| `GOOGLE_CLIENT_ID` | yes | From step 2.4. |
| `GOOGLE_CLIENT_SECRET` | yes | From step 2.4. |
| `ALLOWED_EMAIL_DOMAIN` | one of these two | e.g. `itbhu.ac.in`. |
| `ALLOWED_EMAILS` | one of these two | Comma-separated exact addresses. |
| `ALLOWED_EMAIL_LOCAL_SUFFIX` | no | e.g. `.cse26`, so only `<name>.cse26@<domain>` may vote. |
| `GOOGLE_SHEET_ID` | yes | From step 1.4. |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | yes | From step 3.3. |
| `GOOGLE_PRIVATE_KEY` | yes | From step 3.3, quoted. |
| `ADMIN_PASSWORD_HASH` | yes | Output of `npm run hash-password`. |

If neither `ALLOWED_EMAIL_DOMAIN` nor `ALLOWED_EMAILS` is set, **everyone is
rejected**. That is intentional — a misconfigured allowlist must not open the
election to the internet.

---

## 6. Run it locally

First, check the Sheets wiring without starting the app:

```bash
npm install
npm run verify-sheet
```

That authenticates the service account, opens the spreadsheet, checks all three
tabs and their headers, and reads the voting toggle. It writes nothing. Fix
anything it flags before going further — every failure it reports names the
SETUP.md step that fixes it.

Then:

```bash
npm run dev
```

Open <http://localhost:3000>. Sign in, and you should see the three seat
sections. Nothing will be castable until you open voting at
<http://localhost:3000/admin>.

Run the tests:

```bash
npm test
```

---

## 7. Deploy to Vercel

1. Push this directory to a GitHub repository. `.env.local` is gitignored —
   double-check it is not in the commit before pushing.
2. <https://vercel.com/new> → import the repository. Framework preset is
   detected as Next.js; leave the build settings alone.
3. **Before the first deploy**, add every variable from the table above under
   **Environment Variables**, for the **Production** environment. For
   `GOOGLE_PRIVATE_KEY`, paste the value *without* the surrounding quotes into
   Vercel's input box — Vercel stores it literally.
4. Deploy. Note the assigned URL.
5. Go back to **Google Cloud → Credentials → your OAuth client** and add:
   - origin `https://<your-app>.vercel.app`
   - redirect URI `https://<your-app>.vercel.app/api/auth/callback/google`
6. Redeploy if you changed any environment variable after the buildr — Vercel
   bakes them in at build time.

`vercel.json` pins the deployment to the `bom1` (Mumbai) region. A single region
means requests are more likely to reuse one warm instance, which makes the
in-process vote lock effective more often. Change it if your voters are
elsewhere; correctness does not depend on it (see "double voting" below).

---

## 8. Running the election

1. Open `/admin` and enter the admin password. This is separate from the Google
   login — being a voter does not make you an administrator.
2. Press **Open voting**. Share the URL.
3. Watch **votes cast / remaining** during the day. The tally is *not* visible
   here and the tally endpoint returns **403** for everyone, including you,
   while voting is open. That is the point of the toggle.
4. The **Results** tab shows live standings and refreshes every 8 seconds while
   the page is visible. **By seat** breaks the same ballots down per seat, and
   **Not voted** lists everyone still outstanding, searchable by name or roll
   number.
5. When you are done, press **Close voting**, then **Save tally to sheet** to
   write the final numbers into the `Results` tab.
6. **Results CSV** downloads one row per candidate with compiled totals.
   **Pending CSV** downloads roll number, name and email of everyone who has not
   voted. Neither contains a ballot.

### Checking on the election from the terminal

```bash
npm run election status
```

Prints whether voting is open, how many voters and ballots exist, and whether
the two counts agree. A mismatch means a ballot write failed — see below. It
also re-checks every stored ballot against the open-seat rule.

To clear test data before the real vote:

```bash
npm run election reset -- --confirm
```

That empties `Voters`, `Ballots` and the tally block. It refuses to run without
`--confirm`. Do not run it during a live election.

### If a voter says their vote did not go through

Check the Vercel logs for `[BALLOT_WRITE_FAILED]`. That line means their
`Voters` row was written but the `Ballots` write failed, so they are marked as
having voted with no ballot recorded. To let them vote again, delete their row
from the `Voters` tab. The log line includes the timestamp and guard of the
exact row to delete.

---

## 9. How the guarantees actually work

**One ballot per person.** On submit, the server reads the `Voters` tab for the
signed-in email and rejects with "You have already voted." if a row exists. The
read and both writes run inside a single `async-mutex` lock, so two clicks that
arrive milliseconds apart cannot both pass the check — the second one blocks
until the first has finished writing, then sees the row.

That lock is per-process, and Vercel can run several instances. So there is a
second, cross-instance guard: after appending its `Voters` row, the server
re-reads the tab. If two instances both appended, both see two rows, both
compute the same winner from `(timestamp, guard)`, and the loser deletes its own
row and never writes a ballot. Exactly one ballot survives either way. There is
a test for precisely this (`survives two independent processes racing`).

On top of that, the browser disables the submit button after the first click and
sends a per-page-load nonce; a replay of the same nonce is rejected outright.

**Ballot secrecy.** `Voters` records only *that* you voted. `Ballots` records
only *what* was voted for, with a random UUID, at a random row position, dated
to the day. Nothing joins the two. The API never returns a ballot id to the
voter, because a receipt is a link.

**Results are admin-only.** There is no public results route of any kind. Every
tally endpoint requires the admin cookie and returns 401 without it, whether
voting is open or closed. The admin panel shows live standings while voting runs
— useful for spotting a stuck election — and no voter can reach those numbers.

**How a candidate's total is worked out.** A vote in a candidate's own gendered
seat and a vote for them in the open seat are both votes for the same person, so
they add up. Sahil Gupta with 30 male-seat votes and 12 open-seat votes has 42.
The per-seat splits are kept alongside, because winning the reserved female seat
is a different question from having the most votes overall.

**The open-seat rule** is enforced on the server in `src/lib/ballot.ts` before
anything is written. Greying out the two picked candidates in the UI is a
convenience; it is not what enforces the rule.

---

## 10. Changing the candidates and the roll

Edit `src/config/candidates.ts` and put the photos in `public/candidates/`.

The electoral roll — roll number, name and email for all 152 students — lives in
`src/config/roster.ts`. It drives the voter's own roll number on the ballot, the
turnout figures, and the "not voted" list.

That file is **server-only**: it holds real students' names and addresses, and
the `import "server-only"` at the top makes it a build error if anything ever
pulls it into the browser bundle. Keep it that way, and keep the repository
private.

Emails in the source PDF were truncated at the column edge, so each address was
rebuilt as `<local part>@itbhu.ac.in`, and names the PDF also truncated were
reconstructed from the email. `npm test` checks the roll for duplicates, gaps in
the roll numbers, malformed addresses, and that every candidate appears on it —
but it cannot catch a plausible-looking wrong spelling, so skim the file once.

Do not reuse an id for a different person once voting has started — ballots
store ids, so recycling one silently reassigns votes already cast.
