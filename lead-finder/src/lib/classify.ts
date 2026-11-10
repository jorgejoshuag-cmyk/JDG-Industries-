// Keyword classifiers that turn free text from source records into our trade and project-type lists. Pure.

const TRADE_RULES: [RegExp, string][] = [
  [/public works|city of|county|municipal|department of|school board|authority|district/i, "Municipal / Public Works"],
  [/septic|drain ?field/i, "Septic / Drainfield"],
  [/pool|spa\b/i, "Pool Builder"],
  [/paver|brick pav/i, "Paver Installer"],
  [/pav(ing|ement)|asphalt|driveway|sealcoat/i, "Paving / Driveway"],
  [/excavat|site ?work|grading|earthwork|underground util|demolition|land clearing/i, "Site Work / Excavation"],
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

const PROJECT_RULES: [RegExp, string][] = [
  [/\bbid\b|solicitation|rfp\b|itb\b|rfq\b/i, "Public Bid"],
  [/demo(lition)?\b/i, "Demolition"],
  [/pool|spa\b/i, "Pool"],
  [/driveway/i, "Driveway"],
  [/pav(ing|ement|er)|asphalt|parking lot|resurfac/i, "Paving"],
  [/foundation|slab|footing|concrete/i, "Foundation / Slab"],
  [/site ?work|grading|excavat|fill\b|drainage|earthwork|land clearing/i, "Site Work"],
  [/new (construction|building|single|commercial|residen)|\bnew\b.*\b(sfr|duplex|townhouse|warehouse)\b/i, "New Construction"],
];

export function classifyProjectType(...texts: (string | null | undefined)[]): string {
  const t = texts.filter(Boolean).join(" ");
  for (const [re, type] of PROJECT_RULES) if (re.test(t)) return type;
  return "Other";
}
