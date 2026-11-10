import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, computeScore, tierFor, type ScoreInput } from "@/lib/scoring";

const now = new Date("2026-11-10T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

const base: ScoreInput = {
  trade: "Concrete Contractor",
  county: "Miami-Dade",
  zip: "33166",
  distanceMiles: 4,
  hasPhone: true,
  hasEmail: true,
  hasNamedContact: true,
  projects: [
    { type: "Foundation / Slab", declaredValue: 750_000, issueDate: daysAgo(5), active: true },
    { type: "Driveway", declaredValue: 40_000, issueDate: daysAgo(20), active: true },
    { type: "Paving", declaredValue: 90_000, issueDate: daysAgo(45), active: true },
  ],
  activityOutcomes: ["Interested"],
  serviceCounties: ["Miami-Dade", "Broward"],
  serviceZips: [],
  now,
};

describe("computeScore", () => {
  it("gives a perfect lead 100 and tier Hot", () => {
    const r = computeScore(base);
    expect(r.score).toBe(100);
    expect(r.tier).toBe("Hot");
    expect(r.breakdown).toHaveLength(DEFAULT_RULES.length);
  });

  it("gives a weak lead a low score and tier Cold", () => {
    const r = computeScore({
      ...base, trade: "Other", county: "Palm Beach", zip: "33401", distanceMiles: 60,
      hasPhone: false, hasEmail: false, hasNamedContact: false, projects: [], activityOutcomes: [],
    });
    expect(r.score).toBeLessThan(15);
    expect(r.tier).toBe("Cold");
  });

  it("breakdown points add up to the score", () => {
    const r = computeScore({ ...base, distanceMiles: 18, hasEmail: false, activityOutcomes: ["Spoke"] });
    const sum = r.breakdown.reduce((s, l) => s + l.points, 0);
    expect(Math.abs(sum - r.score)).toBeLessThanOrEqual(1);
    for (const l of r.breakdown) expect(l.points).toBeLessThanOrEqual(l.max);
  });

  it("decays permit recency at 30/60/90 days", () => {
    const at = (age: number) =>
      computeScore({ ...base, projects: [{ type: "Other", declaredValue: null, issueDate: daysAgo(age), active: false }] })
        .breakdown.find((l) => l.key === "recent_permits")!.points;
    expect(at(10)).toBe(15);
    expect(at(45)).toBe(10.5);
    expect(at(80)).toBe(6);
    expect(at(200)).toBe(0);
  });

  it("counts a listed ZIP as in the service area when the county is not", () => {
    const line = computeScore({ ...base, county: "Palm Beach", zip: "33441", serviceZips: ["33441"] })
      .breakdown.find((l) => l.key === "service_area")!;
    expect(line.points).toBe(line.max);
  });

  it("rescales when rules are disabled or reweighted", () => {
    const onlyTrade = DEFAULT_RULES.map((r) => ({ ...r, enabled: r.key === "trade_fit" }));
    expect(computeScore(base, onlyTrade).score).toBe(100);
    expect(computeScore({ ...base, trade: "Landscaper" }, onlyTrade).score).toBe(60);
    expect(computeScore(base, DEFAULT_RULES.map((r) => ({ ...r, enabled: false }))).score).toBe(0);
  });

  it("maps scores to tiers at the documented cut-offs", () => {
    expect(tierFor(75)).toBe("Hot");
    expect(tierFor(74)).toBe("Warm");
    expect(tierFor(50)).toBe("Warm");
    expect(tierFor(49)).toBe("Cold");
  });
});
