import { google } from "googleapis";
import { getGoogleAuthClient } from "../google-auth.js";

// Thin wrapper around the Gmail API `users.messages.send` call. Sends the
// SAME shared OAuth2 credential the Sheets service uses — no SMTP, no
// service account, no third-party ESP.
//
// This is the seam the route/tests substitute a mock through: consumers
// depend on the { send } interface, never on `googleapis` directly.

/**
 * Builds the real Gmail-sending client. Returns null if required config is
 * missing so callers can log-and-skip rather than throw.
 */
export function createGmailClient(env = process.env) {
  const senderAddress = env.GMAIL_SENDER_ADDRESS;
  const auth = getGoogleAuthClient(env);

  if (!auth || !senderAddress) {
    return null;
  }

  const gmail = google.gmail({ version: "v1", auth });

  return {
    /**
     * @param {{ to: string, subject: string, text: string, html?: string }} message
     */
    async send(message) {
      const raw = buildRawMessage({ from: senderAddress, ...message });
      await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw },
      });
    },
  };
}

/**
 * Builds a base64url-encoded RFC 2822 message for `users.messages.send`.
 * Supports a plain-text body and an optional HTML alternative.
 */
export function buildRawMessage({ from, to, subject, text, html }) {
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject, "utf-8").toString("base64")}?=`;
  const boundary = "fcrs_boundary";

  let mime;
  if (html) {
    mime = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${encodedSubject}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "",
      text,
      "",
      `--${boundary}`,
      "Content-Type: text/html; charset=UTF-8",
      "",
      html,
      "",
      `--${boundary}--`,
    ].join("\r\n");
  } else {
    mime = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${encodedSubject}`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "",
      text,
    ].join("\r\n");
  }

  return Buffer.from(mime, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
