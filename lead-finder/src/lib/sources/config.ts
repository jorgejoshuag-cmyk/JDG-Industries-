// Default configuration for each external lead source.
//
// IMPORTANT: no endpoint is filled in here on purpose. Open-data portals change their dataset
// addresses and column names, so each one must be looked up and confirmed by a person.
// For every source below:
//   1. Find the official dataset or API (links to look for are in the TODO comments).
//   2. Paste the JSON endpoint into `url` and map its column names in `fieldMap`.
//   3. Either edit this file, or (easier) fill the same values in at Admin → Sources in the app.
// Until `url` is filled in and `enabled` is true, the source is skipped and nothing breaks.

import type { JsonSourceConfig, PlacesSourceConfig, SourceConfig } from "./types";

/** Field names you can map. Left side is ours; put the source's column name on the right. */
export const MAPPABLE_FIELDS = [
  "name", "trade", "licenseNumber", "address", "city", "county", "zip", "lat", "lng", "phone", "email", "website",
  "contactName", "contactTitle",
  "projectNumber", "projectType", "projectDescription", "projectAddress", "projectCity", "projectZip",
  "projectLat", "projectLng", "projectValue", "projectAreaSqFt", "projectIssueDate", "projectStatus",
] as const;

const jsonBase: JsonSourceConfig = {
  kind: "json",
  enabled: false,
  url: "",
  headers: {},
  recordsPath: "",
  fieldMap: {},
  pageSize: 500,
  maxPages: 10,
  defaultTrade: "",
  defaultProjectType: "",
  defaultCounty: "",
};

export const SOURCE_DEFAULTS: Record<string, SourceConfig> = {
  // TODO(you): Building permits. Look on the Miami-Dade County and Broward County open-data portals
  // (and city portals such as Miami, Hialeah, Fort Lauderdale, Hollywood) for a "building permits"
  // dataset with a JSON/API export. Map at least: name (contractor name), projectNumber (permit
  // number), projectDescription, projectAddress, projectValue, projectIssueDate.
  permits: {
    ...jsonBase,
    fieldMap: { name: "", projectNumber: "", projectType: "", projectDescription: "", projectAddress: "", projectValue: "", projectIssueDate: "", projectStatus: "" },
  },

  // TODO(you): Contractor licenses. The Florida DBPR publishes licensee files for construction
  // industry licenses. If it is offered only as a downloadable file, use Import (CSV/Excel) instead
  // of this adapter. Map at least: name, licenseNumber, trade (license type), address, city, county, zip.
  licenses: {
    ...jsonBase,
    fieldMap: { name: "", licenseNumber: "", trade: "", address: "", city: "", county: "", zip: "" },
  },

  // TODO(you): Public bids and solicitations. Look for a JSON/API feed from the county or city
  // procurement portals you are registered with. Map at least: name (issuing agency), projectNumber
  // (solicitation number), projectDescription, projectIssueDate.
  bids: {
    ...jsonBase,
    defaultTrade: "Municipal / Public Works",
    defaultProjectType: "Public Bid",
    fieldMap: { name: "", projectNumber: "", projectDescription: "", projectIssueDate: "", projectStatus: "" },
  },

  // TODO(you): New business registrations. Florida's Division of Corporations (Sunbiz) offers data
  // downloads; if you only have files, use Import (CSV/Excel). Map at least: name, address, city, zip.
  registrations: {
    ...jsonBase,
    fieldMap: { name: "", address: "", city: "", zip: "", contactName: "" },
  },

  // Google Places API (New) Text Search. Needs GOOGLE_PLACES_API_KEY in the environment.
  // TODO(you): review Google Maps Platform terms on storing Places data before turning this on,
  // and edit the searches to the cities and trades you want.
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
