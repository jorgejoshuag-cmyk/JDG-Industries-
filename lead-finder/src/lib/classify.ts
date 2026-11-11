// Keyword classifiers that turn free text from source records into our trade and project-type lists. Pure.

const TRADE_RULES: [RegExp, string][] = [
  [/public works|city of|county|municipal|department of|school board|authority|district/i, "Municipal / Public Works"],
  [/septic|drain ?field/i, "Septic / Drainfield"],
  [/pool|spa\b/i, "Pool Builder"],
  [/paver|brick pav/i, "Paver Installer"],
  [/pav(ing|ement)|asphalt|driveway|sealcoat/i, "Paving / Driveway"],
  [/excavat|site ?work|grading|earthwork|underground|demolition|land clearing/i, "Site Work / Excavation"],
  [/concrete|cement|ready ?mix|flatwork|slab/i, "Concrete Contractor"],
  [/mason|foundation|block|stucco/i, "Masonry / Foundation"],
  [/landscap|lawn|nursery|irrigation|sod\b/i, "Landscaper"],
  [/plumb/i, "Plumbing (Underground)"],
  [/property manage|realty|hoa\b|association/i, "Property Manager"],
  [/home ?builder|homes\b|residential builder|building contractor|\bcbc\b|\bcrc\b/i, "Home Builder"],
  [/develop/i, "Developer"],
  [/general contractor|\bcgc\b|construction|contracting|contractor|builders?/i, "General Contractor"],
];

export function classifyTrade(...texts: (string | null | undefined)[]): string {
  const t = texts.filter(Boolean).join(" ");
  for (const [re, trade] of TRADE_RULES) if (re.test(t)) return trade;
  return "Other";
}

// Trades that pull sub-permits on the same jobs (pool wiring, A/C, roofing…) but do not buy
// concrete or aggregate. Permit records from these companies are not leads.
const NOT_A_BUYER = /electric|\ba\/?c\b|air[- ]?cond|\bcooling\b|mechanical|hvac|refrigerat|roof|window|glass|glazing|elevator|\bsigns?\b|alarm|security|fire (protection|sprinkler|equipment)|sprinkler|solar|\bdoors?\b|shutter|awning|fenc(e|ing)|paint|floor(ing)?\b|cabinet|kitchen|\bgas\b|propane|screen|aluminum|insulation|drywall|tile\b|marble|granite|carpet|\btents?\b|scaffold|cable|communicat|wireless|telecom|low voltage/i;
const NOT_A_BUYER_LICENSE = /^(EC|ER|ES|EF|EG|EH|EI|EJ|EL|CAC|CMC|RA|RM|CCC|RC|SCC|FRO|CVC)\d/i;

/** True when a permit's contractor is clearly a trade that will not need concrete or aggregate. */
export function isUnlikelyBuyer(name: string, license?: string | null): boolean {
  // A general or building contractor license outranks a misleading word in the company name.
  const lic = (license ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (/^(CGC|CBC|CRC|CPC|CUC|RG|RB|RR|RP|RU)\d/.test(lic)) return false;
  return NOT_A_BUYER_LICENSE.test(lic) || NOT_A_BUYER.test(name);
}

// Florida state contractor license prefixes (the letters before the number).
const LICENSE_PREFIX_TRADE: Record<string, string> = {
  CGC: "General Contractor", RG: "General Contractor",
  CBC: "Home Builder", RB: "Home Builder", CRC: "Home Builder", RR: "Home Builder",
  CPC: "Pool Builder", RP: "Pool Builder",
  CUC: "Site Work / Excavation", RU: "Site Work / Excavation",
  CFC: "Plumbing (Underground)", RF: "Plumbing (Underground)",
};

/** Trade suggested by a Florida license number such as "CGC1538636", or null when the prefix is not one we map. */
export function tradeFromLicense(license: string | null | undefined): string | null {
  const m = (license ?? "").toUpperCase().match(/^([A-Z]{2,3})\s?-?\d/);
  return m ? (LICENSE_PREFIX_TRADE[m[1]] ?? null) : null;
}

const DWELLING = "single fam|sfr\\b|two-family|duplex|multi-family|townhouse|town house|residence|guest ?house|adu\\b|apartment|condo|warehouse|commercial|shell";

const PROJECT_RULES: [RegExp, string][] = [
  [/\bbid\b|solicitation|rfp\b|itb\b|rfq\b/i, "Public Bid"],
  // "PAVERS: DRIVEWAY / POOL DECK / OTHER" is paver work, wherever it is laid.
  [/\bpavers?\b/i, "Paving"],
  // A pool, driveway or paving permit says so in its category, even when filed as "new" or "addition".
  [/swimming pool|\bnew pool|pool \/ spa|pool or spa|combination pool|pool deck|\bpool\b.*\bspa\b/i, "Pool"],
  [/driveway/i, "Driveway"],
  [/pav(ing|ement|ers?)\b|asphalt|parking lot|resurfac|sidewalk/i, "Paving"],
  [/demoli/i, "Demolition"],
  [/foundation only|\bslab\b|footing|post tension|shoring|pre-cast|concrete restoration|stairs - concrete/i, "Foundation / Slab"],
  [/site ?work|site utilit|grading|excavat|soil improvement|\bfill\b|drainage|french drain|earthwork|land clearing|seawall|bulkhead|riprap|marina|\bdock\b/i, "Site Work"],
  [new RegExp(`\\baddition\\b.*(building|general) \\(county\\)|\\baddition\\b.*(${DWELLING})|\\badd (attached|detached)\\b`, "i"), "Addition"],
  [new RegExp(`\\bnew\\b.*(building|general) \\(county\\)|new construction|\\bnew\\b.*(${DWELLING})|shell only`, "i"), "New Construction"],
  [/\bpool\b|\bspa\b/i, "Pool"],
];

export function classifyProjectType(...texts: (string | null | undefined)[]): string {
  const t = texts.filter(Boolean).join(" ");
  for (const [re, type] of PROJECT_RULES) if (re.test(t)) return type;
  return "Other";
}

/**
 * Best-effort county for a South Florida ZIP code, used when a source gives a contractor's ZIP but
 * no county. Based on the general USPS ZIP ranges for the two counties; not exact at the edges.
 */
export function countyFromZip(zip: string | null | undefined): string | null {
  const n = Number((zip ?? "").slice(0, 5));
  if (!Number.isInteger(n) || n < 33000 || n > 33499) return null;
  const inRange = (a: number, b: number) => n >= a && n <= b;
  if (n === 33004 || n === 33009 || inRange(33019, 33029) || inRange(33060, 33069) || [33071, 33073, 33076, 33441, 33442].includes(n) || inRange(33301, 33399)) return "Broward";
  if (inRange(33010, 33018) || inRange(33030, 33035) || n === 33039 || inRange(33054, 33056) || inRange(33101, 33299)) return "Miami-Dade";
  return null;
}
