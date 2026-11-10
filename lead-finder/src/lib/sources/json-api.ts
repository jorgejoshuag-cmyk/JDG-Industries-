import { classifyProjectType, classifyTrade, countyFromZip, isUnlikelyBuyer, tradeFromLicense } from "../classify";
import { parseDate, parseNumber } from "../csv-mapping";
import { fetchJson, getPath, politePause } from "./http";
import type { JsonSourceConfig, LeadSourceAdapter, NormalizedRecord } from "./types";

type Raw = Record<string, unknown>;

const clean = (v: unknown): string | null => {
  if (v == null) return null;
  // Some feeds escape commas as "\,".
  const s = (typeof v === "object" ? JSON.stringify(v) : String(v)).replace(/\\,/g, ",").replace(/\s+/g, " ").trim();
  return s ? s.slice(0, 500) : null;
};
const num = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? v : null;
  return parseNumber(clean(v));
};
const coord = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(clean(v));
  return Number.isFinite(n) && n !== 0 ? n : null;
};

/** YYYY-MM-DD for `days` ago, in UTC. */
export function sinceDate(days: number, now = new Date()): string {
  return new Date(now.getTime() - Math.max(1, days) * 86_400_000).toISOString().slice(0, 10);
}

/** Fills the {limit}, {offset} and {since} placeholders of a source URL. */
export function buildPageUrl(template: string, pageSize: number, page: number, lookbackDays: number, now = new Date()): string {
  return template
    .replace(/\{limit\}/g, String(pageSize))
    .replace(/\{offset\}/g, String(page * pageSize))
    .replace(/\{since\}/g, sinceDate(lookbackDays, now));
}

/**
 * Turns one source record into our shape using the configured field map. Exported for unit tests.
 * Returns null for records with no contractor, or whose "contractor" is a placeholder such as OWNER.
 */
export function normalizeJsonRecord(raw: Raw, cfg: JsonSourceConfig): NormalizedRecord | null {
  // A mapping may join several columns with "+".
  const get = (field: string): unknown => {
    const path = cfg.fieldMap[field];
    if (!path) return undefined;
    if (!path.includes("+")) return getPath(raw, path);
    const parts = path.split("+").map((p) => clean(getPath(raw, p.trim()))).filter(Boolean);
    return parts.length ? parts.join(" | ") : undefined;
  };

  const name = clean(get("name"));
  if (!name) return null;
  const upper = name.toUpperCase().replace(/[^A-Z/ ]/g, "").trim();
  if (cfg.skipNames.some((s) => s.toUpperCase() === upper)) return null;

  const description = clean(get("projectDescription"));
  const rawTrade = clean(get("trade"));
  const license = clean(get("licenseNumber"));
  const zip = clean(get("zip"));
  const projectNumber = clean(get("projectNumber"));

  // On permit feeds, drop sub-trades that work on the same job but never order material.
  if (projectNumber && isUnlikelyBuyer(name, license)) return null;
  const projectType = projectNumber ? cfg.defaultProjectType || classifyProjectType(clean(get("projectType")), description) : "";
  if (projectType === "Pool" && /plumb/i.test(name)) return null;

  let trade = cfg.defaultTrade || classifyTrade(rawTrade, name);
  // A company name like "ABC Group Inc" says little; the state license class is a better hint.
  if (!cfg.defaultTrade && (trade === "Other" || trade === "General Contractor")) trade = tradeFromLicense(license) ?? trade;

  const record: NormalizedRecord = {
    company: {
      name,
      trade,
      licenseNumber: license,
      address: clean(get("address")),
      city: clean(get("city")),
      // The source's default county describes the jobsite, not necessarily the contractor's office.
      county: clean(get("county")) ?? countyFromZip(zip) ?? (projectNumber ? null : cfg.defaultCounty || null),
      zip,
      lat: coord(get("lat")),
      lng: coord(get("lng")),
      phone: clean(get("phone")),
      email: clean(get("email")),
      website: clean(get("website")),
    },
  };
  const contactName = clean(get("contactName"));
  if (contactName) record.contact = { name: contactName, title: clean(get("contactTitle")) };

  if (projectNumber) {
    const area = num(get("projectAreaSqFt"));
    const value = num(get("projectValue"));
    record.project = {
      externalId: projectNumber,
      type: projectType,
      description,
      address: clean(get("projectAddress")),
      city: clean(get("projectCity")) ?? (cfg.defaultCity || null),
      county: cfg.defaultCounty || null,
      zip: clean(get("projectZip")),
      lat: coord(get("projectLat")),
      lng: coord(get("projectLng")),
      declaredValue: value && value > 0 ? value : null,
      areaSqFt: area && area > 0 ? area : null,
      issueDate: parseDate(clean(get("projectIssueDate"))),
      status: clean(get("projectStatus")),
    };
  }
  return record;
}

/** Builds an adapter for any JSON open-data endpoint. All source-specific details live in its config. */
export function jsonApiAdapter(key: string, label: string, description: string): LeadSourceAdapter<Raw, JsonSourceConfig> {
  return {
    key,
    label,
    description,

    notReadyReason(cfg) {
      if (!cfg.enabled) return "Turned off";
      if (!cfg.url.trim()) return "No endpoint URL yet";
      if (!cfg.fieldMap.name) return "The company name field is not mapped";
      return null;
    },

    async fetch(cfg) {
      const out: Raw[] = [];
      const paged = cfg.url.includes("{offset}");
      const pageSize = Math.max(1, Math.min(cfg.pageSize || 500, 5000));
      const maxPages = paged ? Math.max(1, Math.min(cfg.maxPages || 1, 50)) : 1;
      for (let page = 0; page < maxPages; page++) {
        const url = buildPageUrl(cfg.url, pageSize, page, cfg.lookbackDays || 45);
        const body = await fetchJson(url, { headers: { Accept: "application/json", ...cfg.headers } });
        // ArcGIS reports query errors inside a normal 200 response.
        const apiError = getPath(body, "error.message");
        if (apiError) throw new Error(`The source rejected the request: ${String(apiError).slice(0, 200)}`);
        const rows = getPath(body, cfg.recordsPath);
        if (!Array.isArray(rows)) throw new Error(`No list of records found at "${cfg.recordsPath || "(top level)"}". Check the records path.`);
        for (const r of rows) if (r && typeof r === "object") out.push(r as Raw);
        if (rows.length < pageSize && getPath(body, "exceededTransferLimit") !== true) break;
        await politePause();
      }
      return out;
    },

    normalize: normalizeJsonRecord,
  };
}
