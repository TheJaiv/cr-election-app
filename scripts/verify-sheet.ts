/**
 * Preflight check for the Google Sheets wiring.
 *
 *   npm run verify-sheet
 *
 * Confirms the service account can authenticate, that the spreadsheet is shared
 * with it, that all three tabs exist with the right headers, and that the
 * voting toggle is readable. Read-only apart from nothing — it writes nothing.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { google } from "googleapis";

const REQUIRED: Record<string, string[]> = {
  Voters: ["email", "timestamp", "guard"],
  Ballots: ["ballotId", "malePick", "femalePick", "openPick", "votedOn"],
  Results: [],
};

function ok(msg: string) { console.log(`  \x1b[32m✓\x1b[0m ${msg}`); }
function bad(msg: string) { console.log(`  \x1b[31m✗\x1b[0m ${msg}`); }

async function main() {
  let failures = 0;

  const id = process.env.GOOGLE_SHEET_ID;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  for (const [name, value] of Object.entries({
    GOOGLE_SHEET_ID: id,
    GOOGLE_SERVICE_ACCOUNT_EMAIL: email,
    GOOGLE_PRIVATE_KEY: key,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    AUTH_SECRET: process.env.AUTH_SECRET,
    ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH,
  })) {
    if (!value) { bad(`${name} is not set`); failures++; } else ok(`${name} is set`);
  }
  if (!id || !email || !key) process.exit(1);

  const auth = new google.auth.JWT({
    email, key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  try {
    await auth.authorize();
    ok("service account authenticated");
  } catch (error) {
    bad(`service account could not authenticate: ${(error as Error).message}`);
    console.log("    → the GOOGLE_PRIVATE_KEY is probably mangled. Keep the \\n escapes.");
    process.exit(1);
  }

  const sheets = google.sheets({ version: "v4", auth });

  let titles: string[];
  try {
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: id,
      fields: "properties.title,sheets.properties.title",
    });
    titles = (meta.data.sheets ?? []).map((s) => s.properties?.title ?? "");
    ok(`opened spreadsheet "${meta.data.properties?.title}"`);
  } catch (error) {
    const message = (error as Error).message;
    bad(`cannot open the spreadsheet: ${message}`);
    if (message.includes("403") || message.toLowerCase().includes("permission")) {
      console.log(`    → share the sheet with ${email} as Editor (SETUP.md step 3.4)`);
    }
    if (message.includes("404")) {
      console.log("    → GOOGLE_SHEET_ID is wrong; it is the part between /d/ and /edit");
    }
    process.exit(1);
  }

  for (const [tab, headers] of Object.entries(REQUIRED)) {
    if (!titles.includes(tab)) {
      bad(`missing tab "${tab}" (found: ${titles.join(", ")})`);
      failures++;
      continue;
    }
    if (headers.length === 0) { ok(`tab "${tab}" exists`); continue; }

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: id,
      range: `${tab}!A1:${String.fromCharCode(64 + headers.length)}1`,
    });
    const actual = (res.data.values?.[0] ?? []).map((v) => String(v ?? "").trim());
    const matches =
      actual.length === headers.length &&
      headers.every((h, i) => actual[i]?.toLowerCase() === h.toLowerCase());
    if (matches) ok(`tab "${tab}" headers correct`);
    else {
      bad(`tab "${tab}" headers wrong`);
      console.log(`    expected: ${headers.join(" | ")}`);
      console.log(`    found:    ${actual.join(" | ") || "(empty)"}`);
      failures++;
    }
  }

  if (titles.includes("Results")) {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: id,
      range: "Results!A1:B1",
    });
    const label = String(res.data.values?.[0]?.[0] ?? "").trim();
    const value = String(res.data.values?.[0]?.[1] ?? "").trim().toUpperCase();
    if (label.toLowerCase() === "votingopen") {
      ok(`voting toggle readable — currently ${value === "TRUE" ? "OPEN" : "CLOSED"}`);
    } else {
      bad('Results!A1 should be "votingOpen" and B1 "FALSE"');
      console.log(`    found A1="${label}" B1="${value}"`);
      failures++;
    }
  }

  console.log("");
  if (failures === 0) console.log("\x1b[32mAll checks passed.\x1b[0m");
  else { console.log(`\x1b[31m${failures} problem(s) above.\x1b[0m`); process.exit(1); }
}

main().catch((error) => { console.error(error); process.exit(1); });
