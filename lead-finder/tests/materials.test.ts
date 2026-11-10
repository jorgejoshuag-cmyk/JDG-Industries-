import { describe, expect, it } from "vitest";
import { estimateMaterial } from "@/lib/materials";

const assumptions = [
  { projectType: "Driveway", material: "Limerock base", depthInches: 6, tonsPerCubicYard: 1.5, tonsPer10kValue: 10 },
  { projectType: "Other", material: "Fill sand", depthInches: 4, tonsPerCubicYard: 1.4, tonsPer10kValue: 2 },
];

describe("estimateMaterial", () => {
  it("uses area when it is known", () => {
    // 2,700 sq ft at 6 inches = 1,350 cu ft = 50 cu yd = 75 tons.
    const e = estimateMaterial({ type: "Driveway", areaSqFt: 2700, declaredValue: 999_999 }, assumptions)!;
    expect(e.basis).toBe("area");
    expect(e.cubicYards).toBe(50);
    expect(e.tons).toBe(75);
    expect(e.note).toMatch(/rough estimate/i);
  });
  it("falls back to declared value", () => {
    // $50,000 at 10 tons per $10k = 50 tons = 33.3 cu yd.
    const e = estimateMaterial({ type: "Driveway", declaredValue: 50_000 }, assumptions)!;
    expect(e.basis).toBe("value");
    expect(e.tons).toBe(50);
    expect(e.cubicYards).toBe(33.3);
  });
  it("uses the Other row for unknown project types", () => {
    const e = estimateMaterial({ type: "Seawall", declaredValue: 100_000 }, assumptions)!;
    expect(e.material).toBe("Fill sand");
    expect(e.tons).toBe(20);
  });
  it("returns null without area or value", () => {
    expect(estimateMaterial({ type: "Driveway" }, assumptions)).toBeNull();
    expect(estimateMaterial({ type: "Driveway", areaSqFt: 0, declaredValue: 0 }, assumptions)).toBeNull();
  });
});
