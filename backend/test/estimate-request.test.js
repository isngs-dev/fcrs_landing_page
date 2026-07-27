import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

const validPayload = {
  name: "Jane Smith",
  phone: "(989) 843-4628",
  email: "jane@example.com",
  service: "Residential Roofing",
  state: "Alabama",
  zip: "35203",
};

const testEnv = {
  ALLOWED_ORIGIN: "http://localhost:4321",
  GOOGLE_SHEET_ID: "fake-sheet-id",
  GOOGLE_SHEET_RANGE: "Leads!A:I",
  DUPLICATE_WINDOW_MINUTES: "30",
  INTERNAL_NOTIFICATION_EMAIL: "leads@example.com",
  GMAIL_SENDER_ADDRESS: "sender@example.com",
};

/** Builds an in-memory fake sheets service backed by an array of rows. */
function createFakeSheetsService({ throwOnAppend = false, throwOnDuplicateCheck = false } = {}) {
  const rows = [];
  return {
    rows,
    async isDuplicate(email, now = new Date()) {
      if (throwOnDuplicateCheck) throw new Error("read failed");
      const windowMs = 30 * 60 * 1000;
      return rows.some((row) => {
        const sameEmail = row.email.trim().toLowerCase() === email;
        const withinWindow = Math.abs(now.getTime() - new Date(row.timestamp).getTime()) <= windowMs;
        return sameEmail && withinWindow;
      });
    },
    async appendRow(submission, now = new Date()) {
      if (throwOnAppend) throw new Error("append failed");
      rows.push({ ...submission, timestamp: now.toISOString() });
    },
  };
}

function createFakeEmailService({ throwOnSend = false } = {}) {
  const sent = [];
  return {
    sent,
    async sendLeadEmails(submission) {
      if (throwOnSend) throw new Error("send failed");
      sent.push({ to: submission.email, kind: "confirmation" });
      sent.push({ to: "internal", kind: "internal-notification" });
    },
  };
}

describe("POST /api/estimate-request", () => {
  it("returns 200 ok:true, appends one row, and sends two emails on a valid submission", async () => {
    const sheetsService = createFakeSheetsService();
    const emailService = createFakeEmailService();
    const app = createApp({ env: testEnv, sheetsService, emailService });

    const res = await request(app).post("/api/estimate-request").send(validPayload);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(sheetsService.rows).toHaveLength(1);
    expect(emailService.sent).toHaveLength(2);
  });

  it("returns 400 with field errors and performs no writes or sends on invalid input", async () => {
    const sheetsService = createFakeSheetsService();
    const emailService = createFakeEmailService();
    const app = createApp({ env: testEnv, sheetsService, emailService });

    const res = await request(app)
      .post("/api/estimate-request")
      .send({ ...validPayload, email: "not-an-email", zip: "" });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.errors).toHaveProperty("email");
    expect(res.body.errors).toHaveProperty("zip");
    expect(sheetsService.rows).toHaveLength(0);
    expect(emailService.sent).toHaveLength(0);
  });

  it("still appends the row and returns 200 when email sending throws", async () => {
    const sheetsService = createFakeSheetsService();
    const emailService = createFakeEmailService({ throwOnSend: true });
    const app = createApp({ env: testEnv, sheetsService, emailService });

    const res = await request(app).post("/api/estimate-request").send(validPayload);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(sheetsService.rows).toHaveLength(1);
  });

  it("returns 500 and attempts no emails when the Sheets append throws", async () => {
    const sheetsService = createFakeSheetsService({ throwOnAppend: true });
    const emailService = createFakeEmailService();
    const app = createApp({ env: testEnv, sheetsService, emailService });

    const res = await request(app).post("/api/estimate-request").send(validPayload);

    expect(res.status).toBe(500);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/something went wrong/i);
    expect(emailService.sent).toHaveLength(0);
  });

  it("collapses a same-email resubmit within the window into one row and one email set, still 200", async () => {
    const sheetsService = createFakeSheetsService();
    const emailService = createFakeEmailService();
    const app = createApp({ env: testEnv, sheetsService, emailService });

    const first = await request(app).post("/api/estimate-request").send(validPayload);
    const second = await request(app).post("/api/estimate-request").send(validPayload);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body).toEqual({ ok: true });
    expect(sheetsService.rows).toHaveLength(1);
    expect(emailService.sent).toHaveLength(2);
  });

  it("never collapses two different emails", async () => {
    const sheetsService = createFakeSheetsService();
    const emailService = createFakeEmailService();
    const app = createApp({ env: testEnv, sheetsService, emailService });

    await request(app).post("/api/estimate-request").send(validPayload);
    await request(app)
      .post("/api/estimate-request")
      .send({ ...validPayload, email: "someone.else@example.com" });

    expect(sheetsService.rows).toHaveLength(2);
    expect(emailService.sent).toHaveLength(4);
  });

  it("treats a same-email submission outside the window as a new submission", async () => {
    const sheetsService = createFakeSheetsService();
    const emailService = createFakeEmailService();
    const app = createApp({ env: testEnv, sheetsService, emailService });

    // Seed a row 45 minutes in the past — outside the 30-minute window.
    const past = new Date(Date.now() - 45 * 60 * 1000);
    await sheetsService.appendRow(
      { name: "Jane Smith", phone: "555", email: "jane@example.com", service: "Residential Roofing", state: "Alabama", zip: "35203" },
      past
    );

    const res = await request(app).post("/api/estimate-request").send(validPayload);

    expect(res.status).toBe(200);
    expect(sheetsService.rows).toHaveLength(2);
    expect(emailService.sent).toHaveLength(2);
  });

  it("health check responds ok without touching sheets or email", async () => {
    const sheetsService = createFakeSheetsService();
    const emailService = createFakeEmailService();
    const app = createApp({ env: testEnv, sheetsService, emailService });

    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(sheetsService.rows).toHaveLength(0);
  });
});
