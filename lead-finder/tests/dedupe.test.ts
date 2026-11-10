import { describe, expect, it } from "vitest";
import { AUTO_MERGE_THRESHOLD, REVIEW_THRESHOLD, compareRecords, findBestMatch, nameSimilarity } from "@/lib/dedupe";

const existing = [
  { id: "a", name: "Sunrise Concrete LLC", licenseNumber: "CGC1512345", phone: "3055550142", zip: "33166" },
  { id: "b", name: "Atlantic Paving Inc", licenseNumber: null, phone: "9545550101", zip: "33301" },
  { id: "c", name: "Coral Pool Builders", licenseNumber: null, phone: null, zip: "33065" },
];

describe("nameSimilarity", () => {
  it("is 1 for names that differ only by suffix and punctuation", () => {
    expect(nameSimilarity("Sunrise Concrete, L.L.C.", "SUNRISE CONCRETE")).toBe(1);
  });
  it("is high for small typos and low for unrelated names", () => {
    expect(nameSimilarity("Atlantic Paving", "Atlantic Pavng")).toBeGreaterThan(0.85);
    expect(nameSimilarity("Atlantic Paving", "Coral Pool Builders")).toBeLessThan(0.3);
  });
});

describe("findBestMatch", () => {
  it("auto-merges on license number even when the name differs", () => {
    const m = findBestMatch({ name: "Sunrise Concrete & Pumping", licenseNumber: "cgc-1512345" }, existing);
    expect(m?.id).toBe("a");
    expect(m!.confidence).toBeGreaterThanOrEqual(AUTO_MERGE_THRESHOLD);
  });
  it("auto-merges on phone plus similar name", () => {
    const m = findBestMatch({ name: "Atlantic Paving", phone: "(954) 555-0101" }, existing);
    expect(m?.id).toBe("b");
    expect(m!.confidence).toBeGreaterThanOrEqual(AUTO_MERGE_THRESHOLD);
  });
  it("sends same phone with a different name to review", () => {
    const m = findBestMatch({ name: "Gold Coast Holdings", phone: "9545550101" }, existing);
    expect(m?.id).toBe("b");
    expect(m!.confidence).toBeLessThan(AUTO_MERGE_THRESHOLD);
    expect(m!.confidence).toBeGreaterThanOrEqual(REVIEW_THRESHOLD);
  });
  it("auto-merges on exact name plus ZIP", () => {
    const m = findBestMatch({ name: "Coral Pool Builders, Inc.", zip: "33065-1200" }, existing);
    expect(m?.id).toBe("c");
    expect(m!.confidence).toBeGreaterThanOrEqual(AUTO_MERGE_THRESHOLD);
  });
  it("sends fuzzy name plus ZIP to review, not auto-merge", () => {
    const m = findBestMatch({ name: "Coral Pool Builder", zip: "33065" }, existing);
    expect(m?.id).toBe("c");
    expect(m!.confidence).toBeLessThan(AUTO_MERGE_THRESHOLD);
  });
  it("does not auto-merge when license numbers conflict", () => {
    const m = compareRecords(
      { name: "Sunrise Concrete LLC", licenseNumber: "CGC9999999", zip: "33166" },
      existing[0],
    );
    expect(m!.confidence).toBeLessThan(AUTO_MERGE_THRESHOLD);
  });
  it("returns null for unrelated companies", () => {
    expect(findBestMatch({ name: "Everglades Septic Services", phone: "3055550199", zip: "33030" }, existing)).toBeNull();
  });
});
