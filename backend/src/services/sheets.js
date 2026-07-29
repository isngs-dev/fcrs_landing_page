import { google } from "googleapis";
import { getGoogleAuthClient } from "./google-auth.js";

// Google Sheets is the ONLY data store for this app. One row per submission,
// appended in the stable column order below, matching GOOGLE_SHEET_RANGE
// (default Leads!A:I): timestamp + the eight captured fields.
//
// This module also implements the duplicate-submission read-back: because
// this API is serverless-shaped, there is no durable in-memory state between
// requests, so the Sheet itself is read to look for a same-email submission
// within the configured window.

export const COLUMN_ORDER = [
  "timestamp",
  "name",
  "phone",
  "email",
  "service",
  "state",
  "zip",
  "date",
  "notes",
];

const DEFAULT_RANGE = "Leads!A:I";
const DEFAULT_DUPLICATE_WINDOW_MINUTES = 30;

/**
 * Duplicate detection only needs timestamp (A) and email (D). Keeping the
 * configured sheet/tab while narrowing the column span reduces response size
 * as the lead sheet grows without changing the append range.
 */
export function getDuplicateLookupRange(range) {
  const a1Range = /^(.*!)?A(\d*):[A-Z]+(\d*)$/i.exec(range);
  if (!a1Range) return range;

  const [, sheetPrefix = "", startRow, endRow] = a1Range;
  return `${sheetPrefix}A${startRow}:D${endRow}`;
}

function rowFromSubmission(submission, timestamp) {
  return [
    timestamp,
    submission.name,
    submission.phone,
    submission.email,
    submission.service,
    submission.state,
    submission.zip,
    submission.date ?? "",
    submission.notes ?? "",
  ];
}

/**
 * Builds the Sheets service used by the route handler. Accepts an env
 * object (defaults to process.env) so tests can inject fixtures, and
 * returns an interface the route depends on rather than importing
 * `googleapis` directly — this is the seam tests substitute a mock through.
 */
export function createSheetsService(env = process.env) {
  const sheetId = env.GOOGLE_SHEET_ID;
  const range = env.GOOGLE_SHEET_RANGE || DEFAULT_RANGE;
  const duplicateLookupRange = getDuplicateLookupRange(range);
  const duplicateWindowMinutes = Number.parseInt(
    env.DUPLICATE_WINDOW_MINUTES ?? String(DEFAULT_DUPLICATE_WINDOW_MINUTES),
    10
  );

  function getSheetsClient() {
    const auth = getGoogleAuthClient(env);
    if (!auth) {
      throw new Error("Google Sheets is not configured.");
    }
    return google.sheets({ version: "v4", auth });
  }

  return {
    /**
     * Reads back recently appended rows and returns true if the given email
     * (already trimmed/lowercased by the schema) appears with a timestamp
     * within the duplicate window of `now`.
     */
    async isDuplicate(email, now = new Date()) {
      const sheets = getSheetsClient();
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: duplicateLookupRange,
      });

      const rows = response.data.values || [];
      const windowMs = duplicateWindowMinutes * 60 * 1000;

      for (const row of rows) {
        const [rowTimestamp, , , rowEmail] = row;
        if (!rowEmail || !rowTimestamp) continue;
        if (rowEmail.trim().toLowerCase() !== email) continue;

        const rowTime = new Date(rowTimestamp).getTime();
        if (Number.isNaN(rowTime)) continue;

        if (Math.abs(now.getTime() - rowTime) <= windowMs) {
          return true;
        }
      }

      return false;
    },

    /**
     * Appends one row for the submission. This is the PRIMARY write; the
     * route treats a throw here as fatal (500).
     */
    async appendRow(submission, now = new Date()) {
      const sheets = getSheetsClient();
      const timestamp = now.toISOString();

      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [rowFromSubmission(submission, timestamp)],
        },
      });
    },
  };
}
