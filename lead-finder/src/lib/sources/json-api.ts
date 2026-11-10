import { classifyProjectType, classifyTrade } from "../classify";
import { parseDate, parseNumber } from "../csv-mapping";
import { fetchJson, getPath, politePause } from "./http";
import type { JsonSourceConfig, LeadSourceAdapter, NormalizedRecord } from "./types";

type Raw = Record<string, unknown>;

const str = (v: unknown): string | null => {
  if (v == null) return null;
  const s = (typeof v === "object" ? JSON.stringify(v) : String(v)).trim();
  return s ? s.slice(0, 500) : null;
};
const num = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  return parseNumber(str(v));
};
const coord = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(str(v));
  return Number.isFinite(n) && n !== 0 ? n : null;
};

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
        const url = cfg.url.replace("{limit}", String(pageSize)).replace("{offset}", String(page * pageSize));
        const body = await fetchJson(url, { headers: { Accept: "application/json", ...cfg.headers } });
        const rows = getPath(body, cfg.recordsPath);
        if (!Array.isArray(rows)) throw new Error(`No list of records found at "${cfg.recordsPath || "(top level)"}". Check the records path.`);
        for (const r of rows) if (r && typeof r === "object") out.push(r as Raw);
        if (rows.length < pageSize) break;
        await politePause();
      }
      return out;
    },

    normalize(raw, cfg): NormalizedRecord | null {
      const get = (field: string) => (cfg.fieldMap[field] ? getPath(raw, cfg.fieldMap[field]) : undefined);
      const name = str(get("name"));
      if (!name) return null;
      const description = str(get("projectDescription"));
      const rawTrade = str(get("trade"));
      const record: NormalizedRecord = {
        company: {
          name,
          trade: cfg.defaultTrade || classifyTrade(rawTrade, name),
          licenseNumber: str(get("licenseNumber")),
          address: str(get("address")),
          city: str(get("city")),
          county: str(get("county")) ?? (cfg.defaultCounty || null),
          zip: str(get("zip")),
          lat: coord(get("lat")),
          lng: coord(get("lng")),
          phone: str(get("phone")),
          email: str(get("email")),
          website: str(get("website")),
        },
      };
      const contactName = str(get("contactName"));
      if (contactName) record.contact = { name: contactName, title: str(get("contactTitle")) };
      const projectNumber = str(get("projectNumber"));
      if (projectNumber) {
        record.project = {
          externalId: projectNumber,
          type: cfg.defaultProjectType || classifyProjectType(str(get("projectType")), description),
          description,
          address: str(get("projectAddress")),
          city: str(get("projectCity")),
          county: cfg.defaultCounty || null,
          zip: str(get("projectZip")),
          lat: coord(get("projectLat")),
          lng: coord(get("projectLng")),
          declaredValue: num(get("projectValue")),
          areaSqFt: num(get("projectAreaSqFt")),
          issueDate: parseDate(str(get("projectIssueDate"))),
          status: str(get("projectStatus")),
        };
      }
      return record;
    },
  };
}
