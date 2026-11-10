import { describe, expect, it } from "vitest";
import { distanceMiles, formatPhone, looksLikeHomeowner, normalizeAddress, normalizeCompanyName, normalizeCounty, normalizeEmail, normalizePhone, normalizeZip } from "@/lib/normalize";

describe("normalizeCompanyName", () => {
  it("strips legal suffixes, punctuation and case", () => {
    expect(normalizeCompanyName("Sunrise Concrete, LLC")).toBe("sunrise concrete");
    expect(normalizeCompanyName("SUNRISE CONCRETE L.L.C.")).toBe("sunrise concrete");
    expect(normalizeCompanyName("The Acme Paving Co., Inc.")).toBe("acme paving");
    expect(normalizeCompanyName("Smith & Sons Corp")).toBe("smith and sons");
  });
  it("does not strip suffix-like text inside a word", () => {
    expect(normalizeCompanyName("Zinc Pools")).toBe("zinc pools");
    expect(normalizeCompanyName("Coco Masonry")).toBe("coco masonry");
  });
  it("handles empty input", () => {
    expect(normalizeCompanyName("")).toBe("");
  });
});

describe("normalizePhone", () => {
  it("accepts common formats", () => {
    expect(normalizePhone("(305) 555-0142")).toBe("3055550142");
    expect(normalizePhone("305.555.0142")).toBe("3055550142");
    expect(normalizePhone("+1 954-555-0101")).toBe("9545550101");
    expect(normalizePhone("1-954-555-0101 ext. 22")).toBe("9545550101");
    expect(normalizePhone("954 555 0101 x5")).toBe("9545550101");
  });
  it("rejects unusable numbers", () => {
    expect(normalizePhone("555-0142")).toBeNull();
    expect(normalizePhone("055-555-0142")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone("call the office")).toBeNull();
  });
  it("formats for display", () => {
    expect(formatPhone("3055550142")).toBe("(305) 555-0142");
    expect(formatPhone(null)).toBe("");
  });
});

describe("other normalizers", () => {
  it("normalizes addresses", () => {
    expect(normalizeAddress("123 North West 5th Street, Suite #4")).toBe("123 n w 5th st ste 4");
    expect(normalizeAddress("123 NW 5th St.")).toBe("123 nw 5th st");
  });
  it("normalizes zip, email and county", () => {
    expect(normalizeZip("33166-1234")).toBe("33166");
    expect(normalizeZip("n/a")).toBeNull();
    expect(normalizeEmail("  Bob@Example.COM ")).toBe("bob@example.com");
    expect(normalizeEmail("not-an-email")).toBeNull();
    expect(normalizeCounty("MIAMI-DADE COUNTY")).toBe("Miami-Dade");
    expect(normalizeCounty("Dade")).toBe("Miami-Dade");
    expect(normalizeCounty("broward")).toBe("Broward");
    expect(normalizeCounty("Palm Beach")).toBe("Palm Beach");
  });
  it("computes distance", () => {
    expect(distanceMiles(25.77, -80.19, 25.77, -80.19)).toBe(0);
    // Miami to Fort Lauderdale is roughly 24 miles in a straight line.
    const d = distanceMiles(25.7617, -80.1918, 26.1224, -80.1373);
    expect(d).toBeGreaterThan(22);
    expect(d).toBeLessThan(27);
  });
});

describe("looksLikeHomeowner", () => {
  it("flags owner-builder and personal-name records", () => {
    expect(looksLikeHomeowner("OWNER BUILDER")).toBe(true);
    expect(looksLikeHomeowner("Garcia, Maria L")).toBe(true);
    expect(looksLikeHomeowner("John Smith", ["single family residence"])).toBe(true);
  });
  it("does not flag businesses", () => {
    expect(looksLikeHomeowner("Garcia Concrete LLC")).toBe(false);
    expect(looksLikeHomeowner("Blue Rock")).toBe(false);
    expect(looksLikeHomeowner("City of Hialeah")).toBe(false);
    expect(looksLikeHomeowner("John Smith Construction", ["single family residence"])).toBe(false);
  });
});
