// Default configuration for each external lead source.
//
// The two Miami-Dade permit feeds below are official open-data services that were checked against
// live data when this file was written (November 2026): field names, paging and the filters all
// returned real permits. Open-data portals do change, so if a run starts failing, compare the
// column names here with the dataset and fix them at Admin → Sources (no code change needed).
//
// Everything stored at Admin → Sources overrides what is in this file.

import type { JsonSourceConfig, PlacesSourceConfig, SourceConfig } from "./types";

/** Field names you can map. Left side is ours; put the source's column name on the right. */
export const MAPPABLE_FIELDS = [
  "name", "trade", "licenseNumber", "address", "city", "county", "zip", "lat", "lng", "phone", "email", "website",
  "contactName", "contactTitle",
  "projectNumber", "projectType", "projectDescription", "projectAddress", "projectCity", "projectZip",
  "projectLat", "projectLng", "projectValue", "projectAreaSqFt", "projectIssueDate", "projectStatus",
] as const;

const NOT_A_BUSINESS = ["OWNER", "OWNER BUILDER", "OWNER/BUILDER", "HOMEOWNER", "NOT LISTED", "TO BE DETERMINED", "TBD", "N/A", "NA", "NONE", "UNKNOWN"];

const jsonBase: JsonSourceConfig = {
  kind: "json",
  enabled: false,
  url: "",
  headers: {},
  recordsPath: "",
  fieldMap: {},
  pageSize: 500,
  maxPages: 10,
  lookbackDays: 45,
  defaultTrade: "",
  defaultProjectType: "",
  defaultCounty: "",
  defaultCity: "",
  skipNames: NOT_A_BUSINESS,
  note: "",
};

/** Builds an ArcGIS REST "query" URL with paging placeholders. `where` may contain {since}. */
function arcgisQuery(layerUrl: string, where: string, outFields: string[], orderBy: string, withGeometry = false): string {
  const params = new URLSearchParams({
    where,
    outFields: outFields.join(","),
    orderByFields: orderBy,
    returnGeometry: String(withGeometry),
    f: "json",
  });
  // The placeholders must stay readable for the adapter, so they are appended unencoded.
  return `${layerUrl}/query?${params.toString().replace(/%7Bsince%7D/gi, "{since}")}&resultRecordCount={limit}&resultOffset={offset}`;
}

const like = (column: string, words: string[]) => words.map((w) => `${column} LIKE '%${w}%'`).join(" OR ");

// ---------------------------------------------------------------- Miami-Dade County
// "Building Permits Issued By Miami-Dade County - 2 Previous Years to Present"
// Covers permits issued by the County building department (unincorporated Miami-Dade and
// county-jurisdiction work), not permits issued by individual cities.
const MDC_LAYER = "https://services.arcgis.com/8Pc9XBTAsYuxx9Ny/arcgis/rest/services/miamidade_permit_data/FeatureServer/0";
const MDC_NEW_BUILD = ["NEW", "ADDITION - ATTACHED", "ADDITION - DETACHED", "FOUNDATION ONLY", "SHELL ONLY"];
const MDC_WHERE = [
  "PermitIssuedDate >= DATE '{since}'",
  // Building and zoning-improvement permits only: electrical, mechanical and gas sub-permits are left out.
  "AND (PermitType IN ('BLDG','ZIPS') OR CategoryDescription1 LIKE 'SITE UTILITIES%')",
  "AND (",
  // New buildings, additions, foundations and shells…
  `((CategoryDescription1 LIKE 'BUILDING (COUNTY)%' OR CategoryDescription1 LIKE 'GENERAL (COUNTY)%') AND ApplicationTypeDescription IN (${MDC_NEW_BUILD.map((v) => `'${v}'`).join(",")}))`,
  // …plus the work categories that need concrete, base rock or fill whatever the application type.
  `OR ${like("CategoryDescription1", ["SWIMMING POOL", "PAVING", "DEMOLITION", "SOIL IMPROVEMENT", "SITE UTILITIES", "MARINA", "DOCK", "SEAWALL"])}`,
  ")",
].join(" ");

const miamiDadeCounty: JsonSourceConfig = {
  ...jsonBase,
  enabled: true,
  url: arcgisQuery(
    MDC_LAYER,
    MDC_WHERE,
    [
      "PermitIssuedDate", "ProcessNumber", "PermitType", "ResidentialCommercial", "EstimatedValue", "ApplicationTypeDescription",
      "ProposedUseDescription", "DetailDescriptionComments", "PropertyAddress", "ContractorNumber", "ContractorName",
      "ContractorAddress", "ContractorCity", "ContractorZip", "ContractorPhone", "SquareFootage", "CategoryDescription1",
    ],
    "PermitIssuedDate DESC,ObjectId DESC",
  ),
  recordsPath: "features",
  pageSize: 1000,
  maxPages: 5,
  defaultCounty: "Miami-Dade",
  fieldMap: {
    name: "attributes.ContractorName",
    licenseNumber: "attributes.ContractorNumber",
    address: "attributes.ContractorAddress",
    city: "attributes.ContractorCity",
    zip: "attributes.ContractorZip",
    phone: "attributes.ContractorPhone",
    projectNumber: "attributes.ProcessNumber",
    projectType: "attributes.ApplicationTypeDescription+attributes.CategoryDescription1+attributes.DetailDescriptionComments",
    projectDescription: "attributes.ApplicationTypeDescription+attributes.CategoryDescription1+attributes.DetailDescriptionComments+attributes.ProposedUseDescription",
    projectAddress: "attributes.PropertyAddress",
    projectValue: "attributes.EstimatedValue",
    projectAreaSqFt: "attributes.SquareFootage",
    projectIssueDate: "attributes.PermitIssuedDate",
  },
  note: "Official Miami-Dade County open data: building permits issued by the County (unincorporated areas and county-jurisdiction work). Includes the contractor's license number, address and phone. Updated by the County about weekly. Permits issued by cities other than Miami are not in this feed.",
};

// ---------------------------------------------------------------- City of Miami
// "Building Permits Since 2014", City of Miami Building Department. Reloaded daily by the City.
const MIAMI_LAYER = "https://services1.arcgis.com/CvuPhqcTQpZPT9qY/arcgis/rest/services/Building_Permits_Since_2014/FeatureServer/0";
const MIAMI_WHERE = [
  "IssuedDate >= DATE '{since}'",
  "AND (",
  `(ScopeofWork IN ('NEW CONSTRUCTION','ADDITION AND REMODELING','PHASED PERMIT') AND (${like("WorkItems", ["SINGLE FAMILY RESIDENCE", "TWO-FAMILY", "MULTI-FAMILY", "POST TENSION", "SHORING", "PARKING GARAGE", "PRE-CAST"])}))`,
  `OR ${like("WorkItems", [
    "NEW POOL", "POOL / SPA", "POOL OR SPA", "COMBINATION POOL", "POOL DECK", "CONCRETE DRIVEWAYS", "DRIVEWAY APPROACH", "PAVERS", "PAVING",
    "DEMOLITION - TOTAL", "SEAWALL", "SIDEWALK CONSTRUCTION", "EXCAVATION", "RIPRAP", "FRENCH DRAIN", "CONCRETE RESTORATION", "STAIRS - CONCRETE",
  ])}`,
  ")",
].join(" ");

const cityOfMiami: JsonSourceConfig = {
  ...jsonBase,
  enabled: true,
  url: arcgisQuery(
    MIAMI_LAYER,
    MIAMI_WHERE,
    [
      "PermitNumber", "CompanyName", "CompanyAddress", "CompanyCity", "CompanyZip", "DeliveryAddress", "IssuedDate", "PropertyType",
      "ScopeofWork", "WorkItems", "TotalCost", "TotalSQFT", "BuildingPermitStatusDescription", "Latitude", "Longitude",
    ],
    "IssuedDate DESC,ObjectId DESC",
  ),
  recordsPath: "features",
  pageSize: 1000,
  maxPages: 5,
  defaultCounty: "Miami-Dade",
  defaultCity: "Miami",
  fieldMap: {
    name: "attributes.CompanyName",
    address: "attributes.CompanyAddress",
    city: "attributes.CompanyCity",
    zip: "attributes.CompanyZip",
    projectNumber: "attributes.PermitNumber",
    projectType: "attributes.ScopeofWork+attributes.WorkItems",
    projectDescription: "attributes.ScopeofWork+attributes.WorkItems+attributes.PropertyType",
    projectAddress: "attributes.DeliveryAddress",
    projectValue: "attributes.TotalCost",
    projectAreaSqFt: "attributes.TotalSQFT",
    projectIssueDate: "attributes.IssuedDate",
    projectStatus: "attributes.BuildingPermitStatusDescription",
    projectLat: "attributes.Latitude",
    projectLng: "attributes.Longitude",
  },
  note: "Official City of Miami open data: building permits issued by the City's Building Department, reloaded daily. Gives the contractor's company name and address but no phone number or license number.",
};

// ---------------------------------------------------------------- Fort Lauderdale (Broward)
// Off by default: when checked in November 2026 the newest record in this feed was from March 2026
// and most rows had no contractor, so it does not show recent permits. Left here, ready to turn on
// if the City resumes updating it.
const FTL_LAYER = "https://gis.fortlauderdale.gov/server/rest/services/BuildingPermits/FeatureServer/0";
const fortLauderdale: JsonSourceConfig = {
  ...jsonBase,
  enabled: false,
  url: arcgisQuery(
    FTL_LAYER,
    `SUBMITDT >= DATE '{since}' AND CONTRACTOR IS NOT NULL AND (${like("PERMITDESC", ["Pool", "Driveway", "Pav", "New", "Addition", "Demol", "Seawall", "Dock", "Foundation", "Site"])})`,
    ["PERMITID", "CASEKEY", "PERMITTYPE", "PERMITSTAT", "PERMITDESC", "SUBMITDT", "FULLADDR", "CONTRACTOR", "CONTRACTPH", "CONTRACTID", "ESTCOST"],
    "SUBMITDT DESC,OBJECTID DESC",
  ),
  recordsPath: "features",
  pageSize: 1000,
  maxPages: 5,
  defaultCounty: "Broward",
  defaultCity: "Fort Lauderdale",
  fieldMap: {
    name: "attributes.CONTRACTOR",
    licenseNumber: "attributes.CONTRACTID",
    phone: "attributes.CONTRACTPH",
    projectNumber: "attributes.CASEKEY",
    projectType: "attributes.PERMITDESC+attributes.PERMITTYPE",
    projectDescription: "attributes.PERMITDESC+attributes.PERMITTYPE",
    projectAddress: "attributes.FULLADDR",
    projectValue: "attributes.ESTCOST",
    projectIssueDate: "attributes.SUBMITDT",
    projectStatus: "attributes.PERMITSTAT",
  },
  note: "City of Fort Lauderdale permit feed. OFF by default: when checked in November 2026 its newest record was from March 2026, so it has no recent permits. Turn it on only if the City resumes updates.",
};

export const SOURCE_DEFAULTS: Record<string, SourceConfig> = {
  permits_miami_dade: miamiDadeCounty,
  permits_city_miami: cityOfMiami,
  permits_fort_lauderdale: fortLauderdale,

  // A blank slot for one more permit feed (for example a Broward city that publishes one).
  // Map at least: name (contractor), projectNumber, projectDescription, projectAddress, projectIssueDate.
  permits: {
    ...jsonBase,
    note: "Blank slot for another permit feed. Paste the dataset's JSON endpoint and column names.",
    fieldMap: { name: "", projectNumber: "", projectType: "", projectDescription: "", projectAddress: "", projectValue: "", projectIssueDate: "", projectStatus: "" },
  },

  // TODO(you): Contractor licenses. The Florida DBPR publishes licensee files for construction
  // industry licenses. If it is offered only as a downloadable file, use Import (CSV/Excel) instead.
  licenses: {
    ...jsonBase,
    fieldMap: { name: "", licenseNumber: "", trade: "", address: "", city: "", county: "", zip: "" },
  },

  // TODO(you): Public bids and solicitations: a JSON feed from the procurement portals you are registered with.
  bids: {
    ...jsonBase,
    defaultTrade: "Municipal / Public Works",
    defaultProjectType: "Public Bid",
    skipNames: [],
    fieldMap: { name: "", projectNumber: "", projectDescription: "", projectIssueDate: "", projectStatus: "" },
  },

  // TODO(you): New business registrations (Florida Division of Corporations). If you only have files, use Import.
  registrations: {
    ...jsonBase,
    fieldMap: { name: "", address: "", city: "", zip: "", contactName: "" },
  },

  // Google Places API (New) Text Search. Needs GOOGLE_PLACES_API_KEY in the environment.
  // TODO(you): review Google Maps Platform terms on storing Places data before turning this on.
  google_places: {
    kind: "places",
    enabled: false,
    queries: [
      "concrete contractor in Miami, FL",
      "paving contractor in Hialeah, FL",
      "site work contractor in Fort Lauderdale, FL",
      "pool builder in Pembroke Pines, FL",
    ],
    maxPagesPerQuery: 1,
  } satisfies PlacesSourceConfig,
};

/** Sources that read building permits. Used by the "Scan for new permits" button and the Permits page. */
export const PERMIT_SOURCE_KEYS = ["permits_miami_dade", "permits_city_miami", "permits_fort_lauderdale", "permits"];
