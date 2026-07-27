import { createGmailClient } from "./gmail-client.js";
import { buildConfirmationEmail, buildInternalNotificationEmail } from "./templates.js";

// Public interface consumed by the route handler. Both sends are attempted
// independently and are always non-fatal: a failure (including missing
// config) logs a warning and resolves normally — it never throws across the
// request path and never blocks or rolls back the primary Sheets write.

/**
 * Builds the email service. Accepts an env object (defaults to process.env)
 * and an optional gmailClient override so tests can inject a mock without
 * touching real credentials or performing real sends.
 */
export function createEmailService({ env = process.env, gmailClient } = {}) {
  const client = gmailClient !== undefined ? gmailClient : createGmailClient(env);
  const internalRecipient = env.INTERNAL_NOTIFICATION_EMAIL;

  async function safeSend(message, label) {
    if (!client) {
      console.warn(`Email skipped (${label}): email sending is not configured.`);
      return;
    }
    try {
      await client.send(message);
    } catch (err) {
      console.warn(`Email send failed (${label}): ${err && err.message ? err.message : "unknown error"}`);
    }
  }

  return {
    /**
     * Sends the confirmation email to the submitter and the internal lead
     * notification to INTERNAL_NOTIFICATION_EMAIL. Never throws.
     */
    async sendLeadEmails(submission, { timestamp } = { timestamp: new Date().toISOString() }) {
      const confirmation = buildConfirmationEmail(submission);
      await safeSend(confirmation, "confirmation");

      if (!internalRecipient) {
        console.warn("Email skipped (internal-notification): INTERNAL_NOTIFICATION_EMAIL is not configured.");
      } else {
        const internal = buildInternalNotificationEmail(submission, {
          to: internalRecipient,
          timestamp,
        });
        await safeSend(internal, "internal-notification");
      }
    },
  };
}
