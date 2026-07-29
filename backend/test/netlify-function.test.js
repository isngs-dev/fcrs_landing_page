import { describe, expect, it } from "vitest";
import netlifyFunction, { config } from "../../netlify/functions/api.js";

describe("Netlify function adapter", () => {
  it("exposes the API routes at the same-origin /api path", () => {
    expect(config).toEqual({ path: "/api/*" });
  });

  it("adapts a web Request to the Express health route", async () => {
    const response = await netlifyFunction(
      new Request("https://estimate.fcrsga.com/api/health"),
      {}
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("forwards JSON request bodies to the Express validation route", async () => {
    const response = await netlifyFunction(
      new Request("https://estimate.fcrsga.com/api/estimate-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
      {}
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(Object.keys(body.errors)).toEqual(
      expect.arrayContaining(["name", "phone", "email", "service", "state", "zip"])
    );
  });
});
