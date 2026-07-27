import { google } from "googleapis";
import readline from "node:readline/promises";

// One-off, run-locally-once script: authorizes a SINGLE OAuth2 credential for
// BOTH scopes the app needs (gmail.send + spreadsheets) in one consent flow,
// so the resulting refresh_token works for both the Gmail and Sheets
// services. Never run this as part of the app itself; it is not imported by
// any backend/src module.
//
// Usage:
//   node scripts/get-refresh-token.js <client-id> <client-secret>
//
// Then paste GOOGLE_OAUTH_REFRESH_TOKEN (and the client id/secret you passed
// in) into backend/.env.

const [clientId, clientSecret] = process.argv.slice(2);

if (!clientId || !clientSecret) {
  console.error("Usage: node scripts/get-refresh-token.js <client-id> <client-secret>");
  process.exit(1);
}

const REDIRECT_URI = "http://localhost";

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

const url = oauth2Client.generateAuthUrl({
  access_type: "offline", // required to receive a refresh_token
  prompt: "consent",      // forces re-issue of refresh_token even if previously authorized
  scope: [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/spreadsheets",
  ],
});

console.log("\n1. Open this URL and sign in as the Gmail account that will send mail:\n");
console.log(url);
console.log(
  "\n2. Approve BOTH permissions on the consent screen.\n" +
  "3. You'll land on a localhost page that fails to load — that's expected.\n" +
  "   Copy the 'code' query param value from that browser address bar.\n"
);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const code = await rl.question("Paste the code here: ");
rl.close();

const { tokens } = await oauth2Client.getToken(code.trim());

console.log("\nSuccess. Put this single value in backend/.env as GOOGLE_OAUTH_REFRESH_TOKEN:\n");
console.log(tokens.refresh_token);
console.log(
  "\nDiscard any other refresh tokens you generated separately for gmail.send " +
  "or spreadsheets alone — only this one, covering both scopes, should be used."
);
