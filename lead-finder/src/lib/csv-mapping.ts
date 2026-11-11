// Column mapping for CSV / Excel imports. Pure so it can run in the browser preview and on the server.

export const IMPORT_FIELDS = [
  { key: "name", label: "Company name", required: true },
  { key: "trade", label: "Trade / category" },
  { key: "licenseNumber", label: "License number" },
  { key: "address", label: "Address" },
  { key: "city", label: "City" },
  { key: "county", label: "County" },
  { key: "zip", label: "ZIP" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "website", label: "Website" },
  { key: "contactName", label: "Contact name" },
  { key: "contactTitle", label: "Contact title" },
  { key: "projectNumber", label: "Permit / bid number" },
  { key: "projectType", label: "Project type" },
  { key: "projectDescription", label: "Project description" },
  { key: "projectAddress", label: "Jobsite address" },
  { key: "projectValue", label: "Declared value" },
  { key: "projectAreaSqFt", label: "Area (sq ft)" },
  { key: "projectIssueDate", label: "Permit issue date" },
] as const;

export type ImportFieldKey = (typeof IMPORT_FIELDS)[number]["key"];
export type ColumnMapping = Partial<Record<ImportFieldKey, string>>;
export type MappedRow = Partial<Record<ImportFieldKey, string>>;

const ALIASES: Record<ImportFieldKey, string[]> = {
  name: ["company", "companyname", "business", "businessname", "name", "contractor", "contractorname", "dba", "firm", "licensee", "applicant"],
  trade: ["trade", "category", "type", "licensetype", "classification", "specialty", "industry"],
  licenseNumber: ["license", "licensenumber", "licenseno", "lic", "licnumber", "licno"],
  address: ["address", "street", "streetaddress", "address1", "mailingaddress", "businessaddress"],
  city: ["city", "town", "municipality"],
  county: ["county"],
  zip: ["zip", "zipcode", "postalcode", "postal"],
  phone: ["phone", "phonenumber", "telephone", "tel", "mobile", "cell", "businessphone"],
  email: ["email", "emailaddress", "mail"],
  website: ["website", "web", "url", "site"],
  contactName: ["contact", "contactname", "owner", "ownername", "principal", "qualifier", "fullname"],
  contactTitle: ["title", "contacttitle", "position", "role"],
  projectNumber: ["permit", "permitnumber", "permitno", "bidnumber", "solicitation", "projectnumber", "folio"],
  projectType: ["projecttype", "permittype", "worktype", "scope"],
  projectDescription: ["description", "projectdescription", "workdescription", "permitdescription"],
  projectAddress: ["jobsite", "jobsiteaddress", "jobaddress", "siteaddress", "projectaddress", "propertyaddress"],
  projectValue: ["value", "declaredvalue", "jobvalue", "estimatedvalue", "projectvalue", "valuation", "cost"],
  projectAreaSqFt: ["area", "sqft", "squarefeet", "squarefootage"],
  projectIssueDate: ["issuedate", "issued", "permitdate", "dateissued", "date"],
};

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Best-guess mapping from the file's headers to lead fields. Each header is used at most once. */
export function autoMapColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<string>();
  // Pass 1: exact alias match. Pass 2: header contains an alias.
  for (const exact of [true, false]) {
    for (const f of IMPORT_FIELDS) {
      if (mapping[f.key]) continue;
      const aliases = ALIASES[f.key];
      const hit = headers.find((h) => {
        if (used.has(h)) return false;
        const k = key(h);
        if (!k) return false;
        return exact ? aliases.includes(k) : aliases.some((a) => a.length >= 4 && k.includes(a));
      });
      if (hit) {
        mapping[f.key] = hit;
        used.add(hit);
      }
    }
  }
  return mapping;
}

export function applyMapping(row: Record<string, unknown>, mapping: ColumnMapping): MappedRow {
  const out: MappedRow = {};
  for (const f of IMPORT_FIELDS) {
    const col = mapping[f.key];
    if (!col) continue;
    const v = row[col];
    if (v == null) continue;
    const s = (v instanceof Date ? v.toISOString() : String(v)).trim();
    if (s) out[f.key] = s;
  }
  return out;
}

/** Returns a list of problems that would stop a row from being imported. Empty means OK. */
export function validateMappedRow(row: MappedRow): string[] {
  const problems: string[] = [];
  if (!row.name || row.name.length < 2) problems.push("Missing company name");
  if (row.name && row.name.length > 200) problems.push("Company name is too long");
  return problems;
}

/** "$125,000.50" -> 125000.5. Returns null for blanks and junk. */
export function parseNumber(input: string | null | undefined): number | null {
  if (!input) return null;
  const n = Number(String(input).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function parseDate(input: string | null | undefined): Date | null {
  if (!input) return null;
  const s = String(input).trim();
  // A bare number such as "12" is not a date (JavaScript would read it as a month).
  if (/^\d{1,10}$/.test(s)) return null;
  // ArcGIS services send dates as milliseconds since 1970.
  const d = /^\d{11,14}$/.test(s) ? new Date(Number(s)) : /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T12:00:00Z`) : new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  return y >= 1990 && y <= 2100 ? d : null;
}
