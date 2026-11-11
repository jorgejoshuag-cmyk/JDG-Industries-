// Pure helpers for cleaning up company names, phones, addresses and ZIPs.
// No database access here so everything is unit-testable.

const LEGAL_SUFFIXES = [
  "llc", "l l c", "inc", "incorporated", "corp", "corporation", "co", "company",
  "ltd", "limited", "lp", "llp", "pllc", "pa", "dba",
];

/** Lowercase, strip punctuation and legal suffixes. Used for matching, never for display. */
export function normalizeCompanyName(name: string): string {
  let s = (name ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[.,'"`’()/\\\-_#:;!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  s = s.replace(/^the\s+/, "");
  // Strip suffixes repeatedly ("Acme Co., Inc." -> "acme").
  let changed = true;
  while (changed) {
    changed = false;
    for (const suf of LEGAL_SUFFIXES) {
      if (s.endsWith(" " + suf)) {
        s = s.slice(0, -suf.length - 1).trim();
        changed = true;
      }
    }
  }
  return s;
}

/** Returns a 10-digit US phone number, or null when the input is not a usable number. */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const beforeExt = String(input).split(/\s*(?:ext\.?|x)\s*\d+\s*$/i)[0];
  let digits = beforeExt.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (digits.length !== 10) return null;
  if (digits[0] === "0" || digits[0] === "1") return null;
  return digits;
}

export function formatPhone(digits: string | null | undefined): string {
  if (!digits) return "";
  if (digits.length !== 10) return digits;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function normalizeEmail(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = String(input).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null;
}

export function normalizeZip(input: string | null | undefined): string | null {
  if (!input) return null;
  const m = String(input).match(/\d{5}/);
  return m ? m[0] : null;
}

const STREET_ABBR: Record<string, string> = {
  street: "st", avenue: "ave", boulevard: "blvd", road: "rd", drive: "dr", court: "ct",
  lane: "ln", place: "pl", terrace: "ter", highway: "hwy", parkway: "pkwy", circle: "cir",
  north: "n", south: "s", east: "e", west: "w",
  northwest: "nw", northeast: "ne", southwest: "sw", southeast: "se",
  suite: "ste", apartment: "apt",
};

/** Canonical lowercase address for comparison ("123 North West 5th Street" -> "123 n w 5th st"). */
export function normalizeAddress(input: string | null | undefined): string {
  if (!input) return "";
  return String(input)
    .toLowerCase()
    .replace(/[.,#]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => STREET_ABBR[w] ?? w)
    .join(" ");
}

export function normalizeCounty(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = String(input).toLowerCase().replace(/county/g, "").replace(/[^a-z]/g, "");
  if (s === "miamidade" || s === "dade" || s === "miami") return "Miami-Dade";
  if (s === "broward") return "Broward";
  const t = String(input).trim();
  return t ? t : null;
}

const BUSINESS_WORDS =
  /\b(llc|inc|corp|corporation|company|co|ltd|lp|llp|group|construction|contractors?|contracting|builders?|concrete|paving|pavers?|pools?|landscap\w*|masonry|excavat\w*|plumbing|septic|development|developers?|homes|services?|enterprises?|associates|partners|properties|management|engineering|city of|county|department|authority|district|school|university)\b/i;

/**
 * Heuristic: does this record look like a private homeowner rather than a business?
 * Flagged records are hidden from lead lists and outreach by default; staff can clear the flag.
 */
export function looksLikeHomeowner(name: string | null | undefined, hints: string[] = []): boolean {
  const all = [name ?? "", ...hints].join(" ").toLowerCase();
  if (/\bowner[\s/-]*builder\b|\bhomeowner\b|\bowner occupied\b/.test(all)) return true;
  const n = (name ?? "").trim();
  if (!n) return false;
  if (BUSINESS_WORDS.test(n)) return false;
  // "SMITH, JOHN A" or "John A. Smith" with no business words.
  if (/^[A-Za-z'’-]+,\s*[A-Za-z'’-]+(\s+[A-Za-z]\.?)?$/.test(n)) return true;
  const words = n.split(/\s+/);
  if (words.length >= 2 && words.length <= 3 && words.every((w) => /^[A-Z][a-z'’-]+\.?$|^[A-Z]\.?$/.test(w))) {
    // Two or three capitalised words can also be a small business ("Blue Rock"), so require a
    // homeowner hint elsewhere before flagging.
    return /\bresiden(t|ce|tial)\b|\bsingle family\b/.test(hints.join(" ").toLowerCase()) && !/\bcontractor\b/.test(all);
  }
  return false;
}

/** Great-circle distance in miles. */
export function distanceMiles(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
