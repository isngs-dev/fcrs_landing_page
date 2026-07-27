import { google } from "googleapis";

// The ONE shared OAuth2 credential used by BOTH the Sheets service and the
// Gmail service. No service account, no domain-wide delegation — a single
// user credential authorized for gmail.send + spreadsheets scopes.
//
// This module only builds the client; it never logs the secret values it
// reads from the environment.

let cachedClient = null;

/**
 * Builds (and memoizes for the lifetime of this process/invocation) the
 * shared OAuth2 client. Safe to call repeatedly — memoization is a plain
 * perf optimization, not something correctness depends on, since a
 * serverless cold start will simply rebuild it.
 */
export function getGoogleAuthClient(env = process.env) {
  if (cachedClient) return cachedClient;

  const clientId = env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = env.GOOGLE_OAUTH_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  cachedClient = oauth2Client;
  return cachedClient;
}

// Exposed for tests that need to force a rebuild between cases.
export function resetGoogleAuthClientForTests() {
  cachedClient = null;
}
