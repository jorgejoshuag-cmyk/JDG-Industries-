// Explainable 0–100 lead score. Pure: takes plain data, returns the score plus a breakdown.

export type RuleConfig = { key: string; label: string; weight: number; enabled: boolean };

export type ScoreInput = {
  trade: string;
  county: string | null;
  zip: string | null;
  /** Miles from the yard to the nearest known jobsite or office, or null when there are no coordinates. */
  distanceMiles: number | null;
  hasPhone: boolean;
  hasEmail: boolean;
  hasNamedContact: boolean;
  projects: { type: string; declaredValue: number | null; issueDate: Date | null; active: boolean; county?: string | null }[];
  activityOutcomes: string[];
  serviceCounties: string[];
  serviceZips: string[];
  now?: Date;
};

export type ScoreLine = { key: string; label: string; points: number; max: number; detail: string };
export type ScoreResult = { score: number; tier: "Hot" | "Warm" | "Cold"; breakdown: ScoreLine[] };

export const DEFAULT_RULES: RuleConfig[] = [
  { key: "trade_fit", label: "Trade fit", weight: 20, enabled: true },
  { key: "service_area", label: "Inside service area", weight: 15, enabled: true },
  { key: "distance", label: "Distance from yard", weight: 10, enabled: true },
  { key: "recent_permits", label: "Recent permit activity", weight: 15, enabled: true },
  { key: "project_type", label: "Project type", weight: 10, enabled: true },
  { key: "project_value", label: "Project value", weight: 10, enabled: true },
  { key: "active_projects", label: "Active projects", weight: 5, enabled: true },
  { key: "contact_info", label: "Contact info completeness", weight: 10, enabled: true },
  { key: "engagement", label: "Past engagement", weight: 5, enabled: true },
];

const TRADE_FIT: Record<string, number> = {
  "Concrete Contractor": 1,
  "Site Work / Excavation": 1,
  "Paving / Driveway": 1,
  "General Contractor": 0.8,
  "Paver Installer": 0.8,
  "Pool Builder": 0.8,
  "Masonry / Foundation": 0.8,
  "Home Builder": 0.8,
  "Septic / Drainfield": 0.7,
  Developer: 0.7,
  Landscaper: 0.6,
  "Municipal / Public Works": 0.6,
  "Plumbing (Underground)": 0.5,
  "Property Manager": 0.4,
  Other: 0.2,
};

const PROJECT_FIT: Record<string, number> = {
  "Foundation / Slab": 1,
  Driveway: 1,
  Paving: 1,
  "Site Work": 1,
  "New Construction": 0.9,
  Addition: 0.8,
  "Public Bid": 0.9,
  Pool: 0.8,
  Demolition: 0.5,
  Other: 0.3,
};

type Frac = { fraction: number; detail: string };

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 86_400_000);
}

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

const EVALUATORS: Record<string, (i: ScoreInput, now: Date) => Frac> = {
  trade_fit: (i) => ({ fraction: TRADE_FIT[i.trade] ?? 0.2, detail: i.trade }),

  service_area: (i) => {
    // Where the work is matters more than where the office is.
    const job = i.projects.find((p) => p.county && i.serviceCounties.includes(p.county));
    if (job) return { fraction: 1, detail: `Has a job in ${job.county} County` };
    if (i.county && i.serviceCounties.includes(i.county)) return { fraction: 1, detail: `${i.county} County` };
    if (i.zip && i.serviceZips.includes(i.zip)) return { fraction: 1, detail: `ZIP ${i.zip} is on the service list` };
    if (!i.county && !i.zip) return { fraction: 0.3, detail: "Location unknown" };
    return { fraction: 0, detail: "Outside service area" };
  },

  distance: (i) => {
    const d = i.distanceMiles;
    if (d == null) return { fraction: 0.3, detail: "No coordinates on file" };
    const label = `${d.toFixed(1)} mi from yard`;
    if (d <= 10) return { fraction: 1, detail: label };
    if (d <= 20) return { fraction: 0.7, detail: label };
    if (d <= 35) return { fraction: 0.4, detail: label };
    return { fraction: 0.1, detail: label };
  },

  recent_permits: (i, now) => {
    const dates = i.projects.map((p) => p.issueDate).filter((d): d is Date => !!d);
    if (!dates.length) return { fraction: 0, detail: "No permits or bids on file" };
    const newest = new Date(Math.max(...dates.map((d) => d.getTime())));
    const age = Math.max(0, daysBetween(now, newest));
    const label = `Most recent ${age} day${age === 1 ? "" : "s"} ago`;
    if (age <= 30) return { fraction: 1, detail: label };
    if (age <= 60) return { fraction: 0.7, detail: label };
    if (age <= 90) return { fraction: 0.4, detail: label };
    return { fraction: 0, detail: label };
  },

  project_type: (i) => {
    if (!i.projects.length) return { fraction: 0, detail: "No projects on file" };
    let best = i.projects[0];
    for (const p of i.projects) if ((PROJECT_FIT[p.type] ?? 0.3) > (PROJECT_FIT[best.type] ?? 0.3)) best = p;
    return { fraction: PROJECT_FIT[best.type] ?? 0.3, detail: best.type };
  },

  project_value: (i) => {
    const max = Math.max(0, ...i.projects.map((p) => p.declaredValue ?? 0));
    if (max <= 0) return { fraction: 0, detail: "No declared value" };
    const label = `Largest project ${money(max)}`;
    if (max >= 500_000) return { fraction: 1, detail: label };
    if (max >= 100_000) return { fraction: 0.7, detail: label };
    if (max >= 25_000) return { fraction: 0.4, detail: label };
    return { fraction: 0.2, detail: label };
  },

  active_projects: (i) => {
    const n = i.projects.filter((p) => p.active).length;
    const label = `${n} active project${n === 1 ? "" : "s"}`;
    if (n >= 3) return { fraction: 1, detail: label };
    if (n === 2) return { fraction: 0.7, detail: label };
    if (n === 1) return { fraction: 0.4, detail: label };
    return { fraction: 0, detail: label };
  },

  contact_info: (i) => {
    const parts: string[] = [];
    let f = 0;
    if (i.hasPhone) { f += 0.4; parts.push("phone"); }
    if (i.hasEmail) { f += 0.4; parts.push("email"); }
    if (i.hasNamedContact) { f += 0.2; parts.push("named contact"); }
    return { fraction: Math.min(1, f), detail: parts.length ? `Has ${parts.join(", ")}` : "No contact info" };
  },

  engagement: (i) => {
    const o = i.activityOutcomes;
    if (o.includes("Requested quote") || o.includes("Interested")) return { fraction: 1, detail: "Showed interest" };
    if (o.includes("Spoke")) return { fraction: 0.5, detail: "Had a conversation" };
    if (o.includes("Not interested")) return { fraction: 0, detail: "Said not interested" };
    return { fraction: 0, detail: "No engagement yet" };
  },
};

export function tierFor(score: number): "Hot" | "Warm" | "Cold" {
  if (score >= 75) return "Hot";
  if (score >= 50) return "Warm";
  return "Cold";
}

export function computeScore(input: ScoreInput, rules: RuleConfig[] = DEFAULT_RULES): ScoreResult {
  const now = input.now ?? new Date();
  const active = rules.filter((r) => r.enabled && r.weight > 0 && EVALUATORS[r.key]);
  const totalWeight = active.reduce((s, r) => s + r.weight, 0);
  if (!totalWeight) return { score: 0, tier: "Cold", breakdown: [] };

  // Scale so the enabled rules always add up to 100, whatever weights the admin picked.
  const scale = 100 / totalWeight;
  let raw = 0;
  const breakdown: ScoreLine[] = active.map((r) => {
    const { fraction, detail } = EVALUATORS[r.key](input, now);
    const max = r.weight * scale;
    const points = max * Math.max(0, Math.min(1, fraction));
    raw += points;
    return { key: r.key, label: r.label, points: Math.round(points * 10) / 10, max: Math.round(max * 10) / 10, detail };
  });
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  return { score, tier: tierFor(score), breakdown };
}
