import { Router } from "express";
import { estimateRequestSchema } from "../schema/estimate-request.js";

const GENERIC_SERVER_ERROR = {
  ok: false,
  error: "Something went wrong. Please call us at the number above.",
};

/**
 * Converts zod issues into the flat `{ field: message }` map required by the
 * response contract. Human-facing prose only, never raw zod codes, and
 * unknown-key issues never echo the offending key name back.
 */
function formatZodErrors(zodError) {
  const errors = {};
  for (const issue of zodError.issues) {
    const key = issue.path[0];
    if (typeof key !== "string") continue;
    if (!(key in errors)) {
      errors[key] = issue.message;
    }
  }
  return errors;
}

/**
 * Builds the /api/estimate-request route. Side-effecting collaborators
 * (sheets, email) are passed in through a factory/params object so tests can
 * substitute mocks — nothing here imports googleapis directly.
 */
export function createEstimateRequestRouter({ sheetsService, emailService }) {
  const router = Router();

  router.post("/api/estimate-request", async (req, res) => {
    const parseResult = estimateRequestSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({ ok: false, errors: formatZodErrors(parseResult.error) });
    }

    const submission = parseResult.data;
    const now = new Date();

    try {
      const duplicate = await sheetsService.isDuplicate(submission.email, now);
      if (duplicate) {
        return res.status(200).json({ ok: true });
      }
    } catch (err) {
      console.warn(`Duplicate check failed: ${err && err.message ? err.message : "unknown error"}`);
      // Duplicate suppression is protective, but it must not prevent the
      // primary lead capture. If the read path is temporarily unavailable,
      // continue to the append and accept the small risk of a duplicate row.
    }

    try {
      await sheetsService.appendRow(submission, now);
    } catch (err) {
      console.warn(`Sheets append failed: ${err && err.message ? err.message : "unknown error"}`);
      return res.status(500).json(GENERIC_SERVER_ERROR);
    }

    // Steps 4/5 — secondary, non-fatal. The email service itself wraps each
    // send individually and never throws, but we guard here too so an
    // unexpected error in the email layer can never cost the response.
    try {
      await emailService.sendLeadEmails(submission, { timestamp: now.toISOString() });
    } catch (err) {
      console.warn(`Email dispatch failed: ${err && err.message ? err.message : "unknown error"}`);
    }

    return res.status(200).json({ ok: true });
  });

  return router;
}
