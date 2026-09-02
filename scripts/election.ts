/**
 * Operational helper for the election sheet.
 *
 *   npm run election status              show tabs, counts, and the toggle
 *   npm run election reset -- --confirm  wipe ALL voters and ballots
 *
 * `reset` is destructive and refuses to run without --confirm. Use it to clear
 * test data before the real vote; never during one.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { google, type sheets_v4 } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID!;

async function client(): Promise<sheets_v4.Sheets> {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
    key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  await auth.authorize();
  return google.sheets({ version: "v4", auth });
}

async function rows(sheets: sheets_v4.Sheets, range: string) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range,
  });
  return (res.data.values ?? []).filter(
    (r) => String(r?.[0] ?? "").trim() !== "",
  );
}

async function status() {
  const sheets = await client();
  const [voters, ballots, toggle] = await Promise.all([
    rows(sheets, "Voters!A2:C"),
    rows(sheets, "Ballots!A2:E"),
    sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Results!B1",
    }),
  ]);

  const open =
    String(toggle.data.values?.[0]?.[0] ?? "").trim().toUpperCase() === "TRUE";

  console.log("");
  console.log(`  voting     : ${open ? "\x1b[32mOPEN\x1b[0m" : "\x1b[33mCLOSED\x1b[0m"}`);
  console.log(`  voters     : ${voters.length}`);
  console.log(`  ballots    : ${ballots.length}`);

  if (voters.length !== ballots.length) {
    console.log(
      `  \x1b[31mMISMATCH\x1b[0m  ${voters.length} voters vs ${ballots.length} ballots — check the logs for [BALLOT_WRITE_FAILED]`,
    );
  }

  // Sanity check: no ballot may violate the open-seat rule.
  const bad = ballots.filter(
    (b) => b[3] === b[1] || b[3] === b[2],
  );
  if (bad.length > 0) {
    console.log(`  \x1b[31m${bad.length} ballot(s) violate the open-seat rule\x1b[0m`);
  } else if (ballots.length > 0) {
    console.log("  rule check : all ballots valid");
  }
  console.log("");
}

async function reset() {
  if (!process.argv.includes("--confirm")) {
    console.log("");
    console.log("  \x1b[31mThis deletes every row in Voters and Ballots.\x1b[0m");
    console.log("  Re-run with --confirm if that is really what you want:");
    console.log("");
    console.log("    npm run election reset -- --confirm");
    console.log("");
    process.exit(1);
  }
  const sheets = await client();
  await sheets.spreadsheets.values.batchClear({
    spreadsheetId: SHEET_ID,
    requestBody: { ranges: ["Voters!A2:C", "Ballots!A2:E", "Results!A2:D"] },
  });
  console.log("  Voters, Ballots and the Results tally were cleared.");
  console.log("  The voting toggle in Results!B1 was left alone.");
}

const command = process.argv[2];
const run =
  command === "status" ? status : command === "reset" ? reset : null;

if (!run) {
  console.log("usage: npm run election status | npm run election reset -- --confirm");
  process.exit(1);
}
run().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
