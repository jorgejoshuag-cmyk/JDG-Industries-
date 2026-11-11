import { normalizeCompanyName, normalizePhone, normalizeZip } from "./normalize";

export type DedupeCandidate = {
  name: string;
  licenseNumber?: string | null;
  phone?: string | null;
  zip?: string | null;
};

export type DedupeExisting = DedupeCandidate & { id: string };

export type DedupeMatch = {
  id: string;
  /** 0..1. At or above AUTO_MERGE_THRESHOLD the records are merged without review. */
  confidence: number;
  reason: string;
};

export const AUTO_MERGE_THRESHOLD = 0.9;
export const REVIEW_THRESHOLD = 0.6;

function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>();
  const t = s.replace(/\s+/g, " ");
  for (let i = 0; i < t.length - 1; i++) {
    const g = t.slice(i, i + 2);
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

/** Sørensen–Dice similarity on character bigrams of the normalized names. 0..1. */
export function nameSimilarity(a: string, b: string): number {
  const na = normalizeCompanyName(a);
  const nb = normalizeCompanyName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.length < 2 || nb.length < 2) return 0;
  const A = bigrams(na);
  const B = bigrams(nb);
  let overlap = 0;
  let total = 0;
  for (const [g, c] of A) {
    total += c;
    overlap += Math.min(c, B.get(g) ?? 0);
  }
  for (const c of B.values()) total += c;
  return (2 * overlap) / total;
}

function normLicense(l: string | null | undefined): string | null {
  if (!l) return null;
  const s = l.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return s.length >= 4 ? s : null;
}

/** Scores one candidate against one existing record. Returns null when they do not look related. */
export function compareRecords(c: DedupeCandidate, e: DedupeExisting): DedupeMatch | null {
  const sim = nameSimilarity(c.name, e.name);
  const cl = normLicense(c.licenseNumber);
  const el = normLicense(e.licenseNumber);
  const cp = normalizePhone(c.phone);
  const ep = normalizePhone(e.phone);
  const cz = normalizeZip(c.zip);
  const ez = normalizeZip(e.zip);

  if (cl && el && cl === el) return { id: e.id, confidence: 1, reason: "Same license number" };
  // Two different licenses means two different license holders, even when names look alike.
  const licenseConflict = Boolean(cl && el && cl !== el);

  if (cp && ep && cp === ep) {
    // A shared phone with an unrelated name is often an answering service or a parent company.
    if (sim >= 0.5 && !licenseConflict) return { id: e.id, confidence: 0.95, reason: "Same phone and similar name" };
    return { id: e.id, confidence: 0.7, reason: "Same phone, different name" };
  }

  if (sim === 1 && cz && ez && cz === ez) {
    return { id: e.id, confidence: licenseConflict ? 0.7 : 0.92, reason: "Same name and ZIP" };
  }
  if (sim >= 0.85 && cz && ez && cz === ez) {
    return { id: e.id, confidence: 0.8, reason: `Similar name (${Math.round(sim * 100)}%) and same ZIP` };
  }
  if (sim === 1) return { id: e.id, confidence: 0.7, reason: "Same name, different or missing ZIP" };
  if (sim >= 0.9) return { id: e.id, confidence: 0.6, reason: `Very similar name (${Math.round(sim * 100)}%)` };
  return null;
}

/** Best match for a candidate among existing records, or null. */
export function findBestMatch(c: DedupeCandidate, existing: DedupeExisting[]): DedupeMatch | null {
  let best: DedupeMatch | null = null;
  for (const e of existing) {
    const m = compareRecords(c, e);
    if (m && (!best || m.confidence > best.confidence)) best = m;
  }
  return best && best.confidence >= REVIEW_THRESHOLD ? best : null;
}
