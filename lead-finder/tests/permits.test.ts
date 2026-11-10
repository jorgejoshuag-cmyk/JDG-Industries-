import { describe, expect, it } from "vitest";
import { classifyProjectType, countyFromZip, isUnlikelyBuyer, tradeFromLicense } from "@/lib/classify";
import { parseDate } from "@/lib/csv-mapping";
import { computeScore } from "@/lib/scoring";
import { SOURCE_DEFAULTS } from "@/lib/sources/config";
import { buildPageUrl, normalizeJsonRecord, sinceDate } from "@/lib/sources/json-api";
import type { JsonSourceConfig } from "@/lib/sources/types";

const county = SOURCE_DEFAULTS.permits_miami_dade as JsonSourceConfig;
const city = SOURCE_DEFAULTS.permits_city_miami as JsonSourceConfig;

// Shaped like real records from the two feeds; the companies and addresses are made up.
const countyRow = (over: Record<string, unknown> = {}) => ({
  attributes: {
    PermitIssuedDate: "2026-11-05", ProcessNumber: "C2026999001", PermitType: "BLDG", ResidentialCommercial: "R", EstimatedValue: "175000",
    ApplicationTypeDescription: "NEW", ProposedUseDescription: "SINGLE FAM RES-CLUST-ZERO LOT-TOWN HOUSE", DetailDescriptionComments: "NEW SFR",
    PropertyAddress: "100 SW 999 ST", ContractorNumber: "CGC1599999", ContractorName: "SAMPLE BUILDERS GROUP LLC", ContractorAddress: "1 SAMPLE AVE",
    ContractorCity: "HIALEAH", ContractorZip: "33016", ContractorPhone: "(305)555-0142", SquareFootage: "2400", CategoryDescription1: "BUILDING (COUNTY)",
    ...over,
  },
});
const cityRow = (over: Record<string, unknown> = {}) => ({
  attributes: {
    PermitNumber: "BD26999999001B001", CompanyName: "Sample Concrete Inc", CompanyAddress: "2 Sample St ", CompanyCity: "MIAMI", CompanyZip: 33174,
    DeliveryAddress: "321 NE 999 ST", IssuedDate: 1794182400000, PropertyType: "Residential", ScopeofWork: "REMODELING/REPAIRS",
    WorkItems: "CONCRETE DRIVEWAYS|DRIVEWAY APPROACH", TotalCost: "9505", TotalSQFT: 0, BuildingPermitStatusDescription: "Active",
    Latitude: 25.82, Longitude: -80.19, ...over,
  },
});

describe("permit feed presets", () => {
  it("are turned on and ask only for recent, relevant permits", () => {
    for (const cfg of [county, city]) {
      expect(cfg.enabled).toBe(true);
      expect(cfg.url).toMatch(/^https:\/\/services1?\.arcgis\.com\//);
      expect(cfg.url).toContain("{since}");
      expect(cfg.url).toContain("resultRecordCount={limit}&resultOffset={offset}");
      expect(decodeURIComponent(cfg.url.replace(/\+/g, " "))).toMatch(/POOL/);
    }
    expect((SOURCE_DEFAULTS.permits_fort_lauderdale as JsonSourceConfig).enabled).toBe(false);
  });

  it("fills paging and the start date into the URL", () => {
    const now = new Date("2026-11-10T15:00:00Z");
    expect(sinceDate(45, now)).toBe("2026-09-26");
    const url = buildPageUrl(county.url, 1000, 2, 45, now);
    expect(url).toContain("resultRecordCount=1000&resultOffset=2000");
    expect(url).toContain("2026-09-26");
    expect(url).not.toMatch(/\{(limit|offset|since)\}/);
    // LIKE patterns must stay percent-encoded so "%DE…" is not read as a byte.
    expect(url).toContain("%25DEMOLITION%25");
  });
});

describe("normalizing Miami-Dade County permits", () => {
  it("builds a contractor lead with a new-construction project", () => {
    const r = normalizeJsonRecord(countyRow(), county)!;
    expect(r.company).toMatchObject({ name: "SAMPLE BUILDERS GROUP LLC", licenseNumber: "CGC1599999", phone: "(305)555-0142", zip: "33016", county: "Miami-Dade", trade: "General Contractor" });
    expect(r.project).toMatchObject({ externalId: "C2026999001", type: "New Construction", address: "100 SW 999 ST", county: "Miami-Dade", declaredValue: 175000, areaSqFt: 2400 });
    expect(r.project!.issueDate!.toISOString().slice(0, 10)).toBe("2026-11-05");
  });
  it("classifies pools, additions and demolitions from the category", () => {
    const type = (o: Record<string, unknown>) => normalizeJsonRecord(countyRow(o), county)!.project!.type;
    expect(type({ ApplicationTypeDescription: "ADDITION - DETACHED", CategoryDescription1: "SWIMMING POOL", DetailDescriptionComments: "NEW SWIMMING POOL" })).toBe("Pool");
    expect(type({ ApplicationTypeDescription: "ADDITION - ATTACHED", DetailDescriptionComments: "ADDITION TO SFR" })).toBe("Addition");
    expect(type({ ApplicationTypeDescription: "DEMOLISH", CategoryDescription1: "DEMOLITION", DetailDescriptionComments: "TOTAL DEMO SFR" })).toBe("Demolition");
    expect(type({ ApplicationTypeDescription: "ALTER - EXTERIOR", CategoryDescription1: "PAVING, DRAINAGE OF EXISTING FACILITY", DetailDescriptionComments: "" })).toBe("Paving");
  });
  it("skips owner-builders, blanks and trades that do not buy material", () => {
    expect(normalizeJsonRecord(countyRow({ ContractorName: "OWNER", ContractorNumber: null }), county)).toBeNull();
    expect(normalizeJsonRecord(countyRow({ ContractorName: "   " }), county)).toBeNull();
    expect(normalizeJsonRecord(countyRow({ ContractorName: "BRIGHT SPARK ELECTRIC INC", ContractorNumber: "EC13099999" }), county)).toBeNull();
    expect(normalizeJsonRecord(countyRow({ ContractorName: "COOL BREEZE AIR CONDITIONING CORP", ContractorNumber: "CAC1899999" }), county)).toBeNull();
  });
  it("keeps a licensed general contractor even if its name has a misleading word", () => {
    expect(normalizeJsonRecord(countyRow({ ContractorName: "GLASS HOUSE BUILDERS LLC", ContractorNumber: "CGC1599998" }), county)).not.toBeNull();
  });
  it("leaves the county blank for an out-of-area contractor office", () => {
    const r = normalizeJsonRecord(countyRow({ ContractorCity: "TAMPA", ContractorZip: "33602" }), county)!;
    expect(r.company.county).toBeNull();
    expect(r.project!.county).toBe("Miami-Dade");
  });
});

describe("normalizing City of Miami permits", () => {
  it("reads epoch dates, coordinates and joined work items", () => {
    const r = normalizeJsonRecord(cityRow(), city)!;
    expect(r.company).toMatchObject({ name: "Sample Concrete Inc", trade: "Concrete Contractor", zip: "33174", county: "Miami-Dade" });
    expect(r.project).toMatchObject({ externalId: "BD26999999001B001", type: "Driveway", city: "Miami", county: "Miami-Dade", declaredValue: 9505, areaSqFt: null, lat: 25.82, lng: -80.19, status: "Active" });
    expect(r.project!.issueDate!.getUTCFullYear()).toBe(2026);
    expect(r.project!.description).toContain("CONCRETE DRIVEWAYS|DRIVEWAY APPROACH");
  });
  it("drops the pool plumber but keeps the pool builder", () => {
    const pool = { ScopeofWork: "NEW CONSTRUCTION", WorkItems: "NEW POOL / SPA OR FOUNTAIN" };
    expect(normalizeJsonRecord(cityRow({ ...pool, CompanyName: "Sample Plumbing Services LLC" }), city)).toBeNull();
    expect(normalizeJsonRecord(cityRow({ ...pool, CompanyName: "Sample Pools & Patio Inc" }), city)!.project!.type).toBe("Pool");
  });
});

describe("helpers", () => {
  it("parses ArcGIS epoch dates and date-only strings", () => {
    expect(parseDate("1794182400000")!.getUTCFullYear()).toBe(2026);
    expect(parseDate("2026-11-05")!.toISOString().slice(0, 10)).toBe("2026-11-05");
    expect(parseDate("12")).toBeNull();
  });
  it("classifies work from permit text", () => {
    expect(classifyProjectType("NEW CONSTRUCTION | SINGLE FAMILY RESIDENCE")).toBe("New Construction");
    expect(classifyProjectType("ADDITION AND REMODELING | SEAWALL OR BULKHEAD")).toBe("Site Work");
    expect(classifyProjectType("NEW CONSTRUCTION | POST TENSION")).toBe("Foundation / Slab");
    expect(classifyProjectType("REMODELING/REPAIRS | PAVERS: DRIVEWAY / POOL DECK / OTHER")).toBe("Paving");
    expect(classifyProjectType("DEMOLITION | DEMOLITION - TOTAL")).toBe("Demolition");
    expect(classifyProjectType("ELECTRICAL")).toBe("Other");
  });
  it("reads trade and buyer hints from Florida license prefixes", () => {
    expect(tradeFromLicense("CPC1459999")).toBe("Pool Builder");
    expect(tradeFromLicense("CUC1229999")).toBe("Site Work / Excavation");
    expect(tradeFromLicense("XYZ")).toBeNull();
    expect(isUnlikelyBuyer("Any Name LLC", "EC13099999")).toBe(true);
    expect(isUnlikelyBuyer("Sample Roofing Corp")).toBe(true);
    expect(isUnlikelyBuyer("Sample Site Development Inc")).toBe(false);
  });
  it("guesses the county from South Florida ZIP codes", () => {
    expect(countyFromZip("33016")).toBe("Miami-Dade");
    expect(countyFromZip("33186")).toBe("Miami-Dade");
    expect(countyFromZip("33314")).toBe("Broward");
    expect(countyFromZip("33024")).toBe("Broward");
    expect(countyFromZip("33602")).toBeNull();
    expect(countyFromZip(null)).toBeNull();
  });
  it("scores an out-of-area contractor as in-area when the job is here", () => {
    const line = computeScore({
      trade: "Concrete Contractor", county: null, zip: "33602", distanceMiles: null, hasPhone: true, hasEmail: false, hasNamedContact: false,
      projects: [{ type: "Foundation / Slab", declaredValue: 400000, issueDate: new Date(), active: true, county: "Miami-Dade" }],
      activityOutcomes: [], serviceCounties: ["Miami-Dade", "Broward"], serviceZips: [],
    }).breakdown.find((l) => l.key === "service_area")!;
    expect(line.points).toBe(line.max);
    expect(line.detail).toMatch(/job in Miami-Dade/);
  });
});
