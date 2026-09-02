/**
 * Google Sheets implementation of ElectionStore, via a service account.
 *
 * One spreadsheet, three tabs:
 *   Voters  — email | timestamp | guard         (records only THAT you voted)
 *   Ballots — ballotId | malePick | femalePick | openPick | votedOn (anonymous)
 *   Results — the toggle + the computed tally (one row per candidate, with
 *             seat and open votes added into a single total)
 *
 * The Results tab doubles as the settings store so the whole election lives in
 * three tabs:
 *   A1 "votingOpen"   B1 TRUE|FALSE
 *   A2 "lastComputed" B2 <iso>
 *   A4 header row, A5.. tally rows
 */
import "server-only";
import { google, type sheets_v4 } from "googleapis";
import { env } from "@/lib/env";
import type { ElectionStore, VoterRow } from "./store";

const VOTERS = "Voters";
const BALLOTS = "Ballots";
const RESULTS = "Results";

/** First data row (1-indexed) in every tab; row 1 is the header. */
const FIRST_DATA_ROW = 2;

let clientPromise: Promise<sheets_v4.Sheets> | null = null;

function sheetsClient(): Promise<sheets_v4.Sheets> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const auth = new google.auth.JWT({
        email: env.serviceAccountEmail,
        key: env.servicePrivateKey,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });
      await auth.authorize();
      return google.sheets({ version: "v4", auth });
    })();
  }
  return clientPromise;
}

/** Numeric sheetIds are needed for insertDimension; resolve and cache them. */
let sheetIdsPromise: Promise<Record<string, number>> | null = null;

function sheetIds(): Promise<Record<string, number>> {
  if (!sheetIdsPromise) {
    sheetIdsPromise = (async () => {
      const sheets = await sheetsClient();
      const meta = await sheets.spreadsheets.get({
        spreadsheetId: env.googleSheetId,
        fields: "sheets.properties(sheetId,title)",
      });
      const map: Record<string, number> = {};
      for (const s of meta.data.sheets ?? []) {
        const title = s.properties?.title;
        const id = s.properties?.sheetId;
        if (title && typeof id === "number") map[title] = id;
      }
      for (const tab of [VOTERS, BALLOTS, RESULTS]) {
        if (!(tab in map)) {
          throw new Error(
            `Spreadsheet is missing the "${tab}" tab. See SETUP.md for the required tabs and headers.`,
          );
        }
      }
      return map;
    })();
  }
  return sheetIdsPromise;
}

async function readRows(range: string): Promise<string[][]> {
  const sheets = await sheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: env.googleSheetId,
    range,
    majorDimension: "ROWS",
  });
  return (res.data.values ?? []).map((row) =>
    (row ?? []).map((v) => String(v ?? "")),
  );
}

async function readColumn(range: string): Promise<string[]> {
  const sheets = await sheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: env.googleSheetId,
    range,
    majorDimension: "COLUMNS",
  });
  return (res.data.values?.[0] ?? []).map((v) => String(v ?? ""));
}

export function createSheetsStore(): ElectionStore {
  return {
    async findVoterRows(email) {
      const target = email.trim().toLowerCase();
      const rows = await readRows(`${VOTERS}!A${FIRST_DATA_ROW}:C`);
      return rows
        .map((row) => ({
          email: String(row[0] ?? "").trim(),
          timestamp: String(row[1] ?? ""),
          guard: String(row[2] ?? ""),
        }))
        .filter((r) => r.email.toLowerCase() === target);
    },

    async listVoterEmails() {
      const column = await readColumn(`${VOTERS}!A${FIRST_DATA_ROW}:A`);
      return column.map((v) => v.trim()).filter((v) => v !== "");
    },

    async appendVoter(row) {
      const sheets = await sheetsClient();
      await sheets.spreadsheets.values.append({
        spreadsheetId: env.googleSheetId,
        range: `${VOTERS}!A:C`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [[row.email, row.timestamp, row.guard]] },
      });
    },

    async removeVoterRow(email, guard) {
      const target = email.trim().toLowerCase();
      const ids = await sheetIds();
      const rows = await readRows(`${VOTERS}!A${FIRST_DATA_ROW}:C`);
      const rowIndexes: number[] = [];
      rows.forEach((row, i) => {
        const matches =
          String(row[0] ?? "").trim().toLowerCase() === target &&
          String(row[2] ?? "") === guard;
        if (matches) rowIndexes.push(i + FIRST_DATA_ROW - 1); // 0-indexed
      });
      if (rowIndexes.length === 0) return;
      const sheets = await sheetsClient();
      // Delete bottom-up so earlier indexes stay valid.
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: env.googleSheetId,
        requestBody: {
          requests: rowIndexes
            .sort((a, b) => b - a)
            .map((index) => ({
              deleteDimension: {
                range: {
                  sheetId: ids[VOTERS],
                  dimension: "ROWS",
                  startIndex: index,
                  endIndex: index + 1,
                },
              },
            })),
        },
      });
    },

    async insertBallotAtRandomPosition(ballot) {
      const ids = await sheetIds();
      const sheets = await sheetsClient();
      const existing = await readColumn(`${BALLOTS}!A${FIRST_DATA_ROW}:A`);
      const filled = existing.filter((v) => v.trim() !== "").length;

      // Uniformly random slot among the `filled + 1` possible positions, so row
      // order in Ballots carries no information about submission order.
      const offset = Math.floor(Math.random() * (filled + 1));
      const insertAt = FIRST_DATA_ROW - 1 + offset; // 0-indexed row for the API

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: env.googleSheetId,
        requestBody: {
          requests: [
            {
              insertDimension: {
                range: {
                  sheetId: ids[BALLOTS],
                  dimension: "ROWS",
                  startIndex: insertAt,
                  endIndex: insertAt + 1,
                },
                inheritFromBefore: false,
              },
            },
          ],
        },
      });

      await sheets.spreadsheets.values.update({
        spreadsheetId: env.googleSheetId,
        range: `${BALLOTS}!A${insertAt + 1}:E${insertAt + 1}`,
        valueInputOption: "RAW",
        requestBody: {
          values: [
            [
              ballot.ballotId,
              ballot.malePick,
              ballot.femalePick,
              ballot.openPick,
              ballot.votedOn,
            ],
          ],
        },
      });
    },

    async readBallots() {
      const sheets = await sheetsClient();
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: env.googleSheetId,
        range: `${BALLOTS}!A${FIRST_DATA_ROW}:E`,
      });
      return (res.data.values ?? [])
        .filter((row) => String(row?.[0] ?? "").trim() !== "")
        .map((row) => ({
          ballotId: String(row[0] ?? ""),
          malePick: String(row[1] ?? ""),
          femalePick: String(row[2] ?? ""),
          openPick: String(row[3] ?? ""),
          votedOn: String(row[4] ?? ""),
        }));
    },

    async isVotingOpen() {
      const sheets = await sheetsClient();
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: env.googleSheetId,
        range: `${RESULTS}!B1`,
      });
      const raw = String(res.data.values?.[0]?.[0] ?? "").trim().toUpperCase();
      // Default to CLOSED. A misconfigured or empty cell must never silently
      // open the election.
      return raw === "TRUE" || raw === "OPEN" || raw === "YES";
    },

    async setVotingOpen(open) {
      const sheets = await sheetsClient();
      await sheets.spreadsheets.values.update({
        spreadsheetId: env.googleSheetId,
        range: `${RESULTS}!A1:B1`,
        valueInputOption: "RAW",
        requestBody: { values: [["votingOpen", open ? "TRUE" : "FALSE"]] },
      });
    },

    async writeResults(rows, computedAtIso) {
      const sheets = await sheetsClient();
      // Clear the old tally block but leave the toggle in row 1 untouched.
      await sheets.spreadsheets.values.clear({
        spreadsheetId: env.googleSheetId,
        range: `${RESULTS}!A2:G`,
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId: env.googleSheetId,
        range: `${RESULTS}!A2:G${4 + rows.length}`,
        valueInputOption: "RAW",
        requestBody: {
          values: [
            ["lastComputed", computedAtIso, "", "", "", "", ""],
            ["", "", "", "", "", "", ""],
            [
              "rank",
              "candidateId",
              "name",
              "gender",
              "seatVotes",
              "openVotes",
              "totalVotes",
            ],
            ...rows.map((r, i) => [
              i + 1,
              r.candidateId,
              r.name,
              r.gender,
              r.seatVotes,
              r.openVotes,
              r.totalVotes,
            ]),
          ],
        },
      });
    },
  };
}

let storeSingleton: ElectionStore | null = null;

export function getStore(): ElectionStore {
  if (!storeSingleton) storeSingleton = createSheetsStore();
  return storeSingleton;
}
