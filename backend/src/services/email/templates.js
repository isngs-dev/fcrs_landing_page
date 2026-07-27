// The two transactional email templates. Plain text bodies (the primary,
// always-present content) plus a light HTML alternative for the tel:/mailto:
// links. Copy mirrors the landing page's promises verbatim — "free",
// "zero-obligation", "no pressure, just an honest assessment" — and never
// invents a response-time commitment beyond "shortly".

const PHONE_DISPLAY = "(989) 843-4628";
const PHONE_TEL_HREF = "tel:+19898434628";
const ENTRY_POINT = "hero estimate form";

function formatDate(dateValue) {
  return dateValue && dateValue.trim() !== "" ? dateValue : null;
}

/**
 * Builds the confirmation email sent to the submitter.
 */
export function buildConfirmationEmail(submission) {
  const preferredDate = formatDate(submission.date);

  const recapLines = [
    `Service requested: ${submission.service}`,
    `State: ${submission.state}`,
  ];
  if (preferredDate) {
    recapLines.push(`Preferred date/time: ${preferredDate}`);
  }

  const text = [
    `Hi ${submission.name},`,
    "",
    "Thanks for requesting a free roofing estimate from First Class Roofing & Solar. We've received your request.",
    "",
    "A specialist will reach out to you shortly to schedule your free, zero-obligation inspection — no pressure, just an honest assessment.",
    "",
    "Here's a quick recap of what you requested:",
    ...recapLines.map((line) => `- ${line}`),
    "",
    `Need help sooner? Call us at ${PHONE_DISPLAY}.`,
    "",
    "Thanks again,",
    "First Class Roofing & Solar",
  ].join("\n");

  const html = [
    `<p>Hi ${escapeHtml(submission.name)},</p>`,
    "<p>Thanks for requesting a free roofing estimate from First Class Roofing &amp; Solar. We've received your request.</p>",
    "<p>A specialist will reach out to you shortly to schedule your free, zero-obligation inspection &mdash; no pressure, just an honest assessment.</p>",
    "<p>Here's a quick recap of what you requested:</p>",
    "<ul>",
    ...recapLines.map((line) => `<li>${escapeHtml(line)}</li>`),
    "</ul>",
    `<p>Need help sooner? Call us at <a href="${PHONE_TEL_HREF}">${PHONE_DISPLAY}</a>.</p>`,
    "<p>Thanks again,<br>First Class Roofing &amp; Solar</p>",
  ].join("\n");

  return {
    to: submission.email,
    subject: "We received your free roofing estimate request",
    text,
    html,
  };
}

/**
 * Builds the internal lead notification sent to INTERNAL_NOTIFICATION_EMAIL.
 * Every captured field must be present here — this is the template that must
 * stay in sync with the schema, since a field silently missing here is data
 * loss for the sales team.
 */
export function buildInternalNotificationEmail(submission, { to, timestamp }) {
  const dateDisplay = formatDate(submission.date) || "not specified";
  const notesDisplay =
    submission.notes && submission.notes.trim() !== "" ? submission.notes : "none";

  const subject = `New lead: ${submission.service} — ${submission.state} — ${submission.name}`;

  const text = [
    "New estimate request captured.",
    "",
    `Name: ${submission.name}`,
    `Phone: ${submission.phone}`,
    `Email: ${submission.email}`,
    `Service: ${submission.service}`,
    `State: ${submission.state}`,
    `Zip: ${submission.zip}`,
    `Preferred date/time: ${dateDisplay}`,
    `Notes: ${notesDisplay}`,
    "",
    `Submitted: ${timestamp}`,
    `Entry point: ${ENTRY_POINT}`,
  ].join("\n");

  const html = [
    "<p>New estimate request captured.</p>",
    "<ul>",
    `<li>Name: ${escapeHtml(submission.name)}</li>`,
    `<li>Phone: <a href="tel:${escapeHtml(submission.phone)}">${escapeHtml(submission.phone)}</a></li>`,
    `<li>Email: <a href="mailto:${escapeHtml(submission.email)}">${escapeHtml(submission.email)}</a></li>`,
    `<li>Service: ${escapeHtml(submission.service)}</li>`,
    `<li>State: ${escapeHtml(submission.state)}</li>`,
    `<li>Zip: ${escapeHtml(submission.zip)}</li>`,
    `<li>Preferred date/time: ${escapeHtml(dateDisplay)}</li>`,
    `<li>Notes: ${escapeHtml(notesDisplay)}</li>`,
    "</ul>",
    `<p>Submitted: ${escapeHtml(timestamp)}<br>Entry point: ${escapeHtml(ENTRY_POINT)}</p>`,
  ].join("\n");

  return { to, subject, text, html };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
