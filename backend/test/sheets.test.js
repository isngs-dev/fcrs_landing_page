import { describe, expect, it } from "vitest";
import { getDuplicateLookupRange } from "../src/services/sheets.js";

describe("Google Sheets duplicate lookup range", () => {
  it("keeps a configured sheet name and reads only the required columns", () => {
    expect(getDuplicateLookupRange("Leads!A:I")).toBe("Leads!A:D");
    expect(getDuplicateLookupRange("'Estimate Leads'!A:I")).toBe("'Estimate Leads'!A:D");
  });

  it("supports an unqualified range", () => {
    expect(getDuplicateLookupRange("A:I")).toBe("A:D");
  });

  it("preserves configured row bounds", () => {
    expect(getDuplicateLookupRange("Leads!A2:I1000")).toBe("Leads!A2:D1000");
  });

  it("leaves named or nonstandard ranges unchanged", () => {
    expect(getDuplicateLookupRange("LeadData")).toBe("LeadData");
    expect(getDuplicateLookupRange("Leads!B:I")).toBe("Leads!B:I");
  });
});
