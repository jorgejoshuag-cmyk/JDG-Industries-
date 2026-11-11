import { describe, expect, it } from "vitest";
import { applyMapping, autoMapColumns, parseDate, parseNumber, validateMappedRow } from "@/lib/csv-mapping";

describe("autoMapColumns", () => {
  it("maps common header spellings", () => {
    const m = autoMapColumns(["Business Name", "License #", "Phone Number", "E-mail", "Zip Code", "City", "County", "Web Site"]);
    expect(m.name).toBe("Business Name");
    expect(m.phone).toBe("Phone Number");
    expect(m.email).toBe("E-mail");
    expect(m.zip).toBe("Zip Code");
    expect(m.city).toBe("City");
    expect(m.county).toBe("County");
    expect(m.licenseNumber).toBe("License #");
    expect(m.website).toBe("Web Site");
  });
  it("maps permit files and never uses a header twice", () => {
    const m = autoMapColumns(["Permit Number", "Contractor Name", "Job Site Address", "Estimated Value", "Issue Date", "Permit Type"]);
    expect(m.projectNumber).toBe("Permit Number");
    expect(m.name).toBe("Contractor Name");
    expect(m.projectAddress).toBe("Job Site Address");
    expect(m.projectValue).toBe("Estimated Value");
    expect(m.projectIssueDate).toBe("Issue Date");
    expect(m.projectType).toBe("Permit Type");
    const used = Object.values(m);
    expect(new Set(used).size).toBe(used.length);
  });
  it("leaves unknown headers unmapped", () => {
    expect(autoMapColumns(["foo", "bar"])).toEqual({});
  });
});

describe("applyMapping and validation", () => {
  it("picks mapped columns, trims, and drops blanks", () => {
    const row = { Company: "  Sunrise Concrete LLC ", Tel: "305-555-0142", Notes: "x", Mail: "   " };
    const out = applyMapping(row, { name: "Company", phone: "Tel", email: "Mail" });
    expect(out).toEqual({ name: "Sunrise Concrete LLC", phone: "305-555-0142" });
  });
  it("requires a company name", () => {
    expect(validateMappedRow({ phone: "305-555-0142" })).toContain("Missing company name");
    expect(validateMappedRow({ name: "Sunrise Concrete" })).toEqual([]);
  });
  it("parses money and dates", () => {
    expect(parseNumber("$125,000.50")).toBe(125000.5);
    expect(parseNumber("abc")).toBeNull();
    expect(parseNumber("")).toBeNull();
    expect(parseDate("2026-10-01")?.getFullYear()).toBe(2026);
    expect(parseDate("not a date")).toBeNull();
  });
});
