import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createEmailService } from "../src/services/email/index.js";
import { buildInternalNotificationEmail, buildConfirmationEmail } from "../src/services/email/templates.js";

const submission = {
  name: "Jane Smith",
  phone: "(989) 843-4628",
  email: "jane@example.com",
  service: "Residential Roofing",
  state: "Alabama",
  zip: "35203",
  date: "2026-08-01T10:00",
  notes: "Leak near the chimney.",
};

const baseEnv = {
  INTERNAL_NOTIFICATION_EMAIL: "leads@example.com",
  GMAIL_SENDER_ADDRESS: "sender@example.com",
};

describe("email templates", () => {
  it("confirmation email is addressed to the submitter and never includes internal-only content", () => {
    const email = buildConfirmationEmail(submission);
    expect(email.to).toBe("jane@example.com");
    expect(email.text).toContain("shortly");
    expect(email.text).toContain("(989) 843-4628");
    expect(email.html).toContain("tel:+19898434628");
  });

  it("internal notification includes every captured field, labelled", () => {
    const email = buildInternalNotificationEmail(submission, {
      to: "leads@example.com",
      timestamp: "2026-07-25T12:00:00.000Z",
    });

    for (const value of [
      submission.name,
      submission.phone,
      submission.email,
      submission.service,
      submission.state,
      submission.zip,
      submission.date,
      submission.notes,
    ]) {
      expect(email.text).toContain(value);
    }
    expect(email.text).toContain("2026-07-25T12:00:00.000Z");
    expect(email.text).toContain("hero estimate form");
  });

  it("internal notification shows 'not specified' and 'none' when date/notes are absent", () => {
    const { date, notes, ...rest } = submission;
    const email = buildInternalNotificationEmail(rest, {
      to: "leads@example.com",
      timestamp: "2026-07-25T12:00:00.000Z",
    });
    expect(email.text).toContain("not specified");
    expect(email.text).toContain("none");
  });
});

describe("createEmailService", () => {
  it("sends both messages with correct recipients on a valid submission", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const emailService = createEmailService({ env: baseEnv, gmailClient: { send } });

    await emailService.sendLeadEmails(submission, { timestamp: "2026-07-25T12:00:00.000Z" });

    expect(send).toHaveBeenCalledTimes(2);
    const recipients = send.mock.calls.map((call) => call[0].to);
    expect(recipients).toContain("jane@example.com");
    expect(recipients).toContain("leads@example.com");
  });

  it("logs a warning and does not throw when a send fails, and the other send still attempts", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const send = vi.fn().mockRejectedValue(new Error("gmail down"));
    const emailService = createEmailService({ env: baseEnv, gmailClient: { send } });

    await expect(
      emailService.sendLeadEmails(submission, { timestamp: "2026-07-25T12:00:00.000Z" })
    ).resolves.toBeUndefined();

    expect(send).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalled();
    // Never log secrets/recipients/payload.
    const loggedText = warnSpy.mock.calls.map((c) => c.join(" ")).join(" ");
    expect(loggedText).not.toContain("jane@example.com");
    expect(loggedText).not.toContain("leads@example.com");

    warnSpy.mockRestore();
  });

  it("warns once per missing config and skips sending without throwing", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const emailService = createEmailService({ env: {}, gmailClient: null });

    await expect(
      emailService.sendLeadEmails(submission, { timestamp: "2026-07-25T12:00:00.000Z" })
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
