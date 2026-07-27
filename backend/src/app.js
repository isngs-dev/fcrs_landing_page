import express from "express";
import cors from "cors";
import { createEstimateRequestRouter } from "./routes/estimate-request.js";
import { createSheetsService } from "./services/sheets.js";
import { createEmailService } from "./services/email/index.js";

const JSON_BODY_LIMIT = "50kb";

/**
 * Builds and returns the configured Express app. Side-effecting
 * collaborators default to the real Google-backed implementations but can be
 * overridden — this is the seam integration tests use to inject mocks so no
 * test ever reaches the real Google APIs.
 */
export function createApp({
  env = process.env,
  sheetsService = createSheetsService(env),
  emailService = createEmailService({ env }),
} = {}) {
  const app = express();

  app.use(
    cors({
      origin: env.ALLOWED_ORIGIN || false,
    })
  );
  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  app.get("/api/health", (req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use(createEstimateRequestRouter({ sheetsService, emailService }));

  // Final error handler — catches anything unexpected (malformed JSON body,
  // etc.) and always returns the generic client-facing shape, never a stack
  // trace or internal detail.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.warn(`Unhandled request error: ${err && err.message ? err.message : "unknown error"}`);
    res.status(500).json({
      ok: false,
      error: "Something went wrong. Please call us at the number above.",
    });
  });

  return app;
}
