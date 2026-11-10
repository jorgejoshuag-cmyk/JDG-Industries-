// Rough material estimate for a project. Always labelled as an estimate in the UI.

export type Assumption = {
  projectType: string;
  material: string;
  /** Typical placed depth in inches, used when the project area is known. */
  depthInches: number;
  tonsPerCubicYard: number;
  /** Tons of material per $10,000 of declared project value, used when only the value is known. */
  tonsPer10kValue: number;
};

export type MaterialEstimate = {
  cubicYards: number;
  tons: number;
  material: string;
  basis: "area" | "value";
  note: string;
};

export const DEFAULT_ASSUMPTIONS: Assumption[] = [
  { projectType: "New Construction", material: "Fill sand, limerock base, ready-mix concrete", depthInches: 8, tonsPerCubicYard: 1.4, tonsPer10kValue: 4 },
  { projectType: "Foundation / Slab", material: "Fill sand, ready-mix concrete", depthInches: 6, tonsPerCubicYard: 1.5, tonsPer10kValue: 8 },
  { projectType: "Driveway", material: "Limerock base, ready-mix concrete", depthInches: 8, tonsPerCubicYard: 1.4, tonsPer10kValue: 12 },
  { projectType: "Paving", material: "Limerock road base", depthInches: 8, tonsPerCubicYard: 1.4, tonsPer10kValue: 15 },
  { projectType: "Pool", material: "Fill sand, pea rock", depthInches: 6, tonsPerCubicYard: 1.4, tonsPer10kValue: 3 },
  { projectType: "Site Work", material: "Fill sand, limerock, rip rap", depthInches: 12, tonsPerCubicYard: 1.4, tonsPer10kValue: 20 },
  { projectType: "Demolition", material: "Fill sand, topsoil", depthInches: 6, tonsPerCubicYard: 1.3, tonsPer10kValue: 5 },
  { projectType: "Public Bid", material: "Limerock road base, fill sand", depthInches: 8, tonsPerCubicYard: 1.4, tonsPer10kValue: 10 },
  { projectType: "Other", material: "Fill sand, gravel", depthInches: 4, tonsPerCubicYard: 1.4, tonsPer10kValue: 2 },
];

const round1 = (n: number) => Math.round(n * 10) / 10;

export function estimateMaterial(
  project: { type: string; areaSqFt?: number | null; declaredValue?: number | null },
  assumptions: Assumption[] = DEFAULT_ASSUMPTIONS,
): MaterialEstimate | null {
  const a = assumptions.find((x) => x.projectType === project.type) ?? assumptions.find((x) => x.projectType === "Other");
  if (!a) return null;

  const area = project.areaSqFt ?? 0;
  if (area > 0 && a.depthInches > 0 && a.tonsPerCubicYard > 0) {
    const cubicYards = (area * (a.depthInches / 12)) / 27;
    return {
      cubicYards: round1(cubicYards),
      tons: round1(cubicYards * a.tonsPerCubicYard),
      material: a.material,
      basis: "area",
      note: `Rough estimate: ${Math.round(area).toLocaleString("en-US")} sq ft at ${a.depthInches}" depth.`,
    };
  }

  const value = project.declaredValue ?? 0;
  if (value > 0 && a.tonsPer10kValue > 0 && a.tonsPerCubicYard > 0) {
    const tons = (value / 10_000) * a.tonsPer10kValue;
    return {
      cubicYards: round1(tons / a.tonsPerCubicYard),
      tons: round1(tons),
      material: a.material,
      basis: "value",
      note: `Rough estimate from declared value at ${a.tonsPer10kValue} tons per $10,000.`,
    };
  }
  return null;
}
