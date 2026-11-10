import { db } from "../db";
import { ingestRecords } from "../ingest";
import { SOURCE_DEFAULTS } from "./config";
import { googlePlacesAdapter } from "./google-places";
import { jsonApiAdapter } from "./json-api";
import type { LeadSourceAdapter, NormalizedRecord, SourceConfig } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ADAPTERS: LeadSourceAdapter<any, any>[] = [
  jsonApiAdapter("permits_miami_dade", "Permits — Miami-Dade County", "Recently issued County building permits for new buildings, additions, pools, paving, demolition and site work."),
  jsonApiAdapter("permits_city_miami", "Permits — City of Miami", "Recently issued City of Miami permits for new construction, pools, driveways, paving, demolition and seawalls."),
  jsonApiAdapter("permits_fort_lauderdale", "Permits — Fort Lauderdale (Broward)", "City of Fort Lauderdale permits. Off by default because the City's feed stopped updating in March 2026."),
  jsonApiAdapter("permits", "Permits — another feed", "A blank slot for one more permit feed, for example a Broward city that publishes one."),
  jsonApiAdapter("licenses", "Contractor licenses", "State contractor license records for the service-area counties."),
  jsonApiAdapter("bids", "Public bids", "Government solicitations that need aggregate, concrete, paving or site work."),
  jsonApiAdapter("registrations", "New business registrations", "Newly formed construction-related companies."),
  googlePlacesAdapter,
];

/** Labels for every value that can appear in Company.sources, including the non-scheduled ones. */
export const SOURCE_LABELS: Record<string, string> = {
  ...Object.fromEntries(ADAPTERS.map((a) => [a.key, a.label])),
  csv_import: "File import",
  manual: "Manual entry",
  seed: "Sample data",
};

export async function getSourceConfig(key: string): Promise<SourceConfig> {
  const base = SOURCE_DEFAULTS[key];
  if (!base) throw new Error(`Unknown source: ${key}`);
  const row = await db.setting.findUnique({ where: { key: `source:${key}` } });
  if (!row) return base;
  try {
    const stored = JSON.parse(row.value);
    // Settings saved before a field existed fall back to the default for that field.
    return { ...base, ...stored, kind: base.kind } as SourceConfig;
  } catch {
    return base;
  }
}

export async function saveSourceConfig(key: string, config: SourceConfig) {
  if (!SOURCE_DEFAULTS[key]) throw new Error(`Unknown source: ${key}`);
  const value = JSON.stringify(config);
  await db.setting.upsert({ where: { key: `source:${key}` }, update: { value }, create: { key: `source:${key}`, value } });
}

export type RunSummary = { sourceKey: string; status: "success" | "skipped" | "failed"; message: string; found: number; added: number; updated: number };

/** Runs one source end to end and records the run. Never throws. */
export async function runSource(key: string): Promise<RunSummary> {
  const adapter = ADAPTERS.find((a) => a.key === key);
  if (!adapter) return { sourceKey: key, status: "failed", message: "Unknown source", found: 0, added: 0, updated: 0 };
  const config = await getSourceConfig(key);
  const notReady = adapter.notReadyReason(config);
  if (notReady) return { sourceKey: key, status: "skipped", message: notReady, found: 0, added: 0, updated: 0 };

  const run = await db.sourceRun.create({ data: { sourceKey: key } });
  try {
    const raw = await adapter.fetch(config);
    const records: NormalizedRecord[] = [];
    let unusable = 0;
    for (const r of raw) {
      const n = adapter.normalize(r, config);
      if (n) records.push(n);
      else unusable++;
    }
    const result = await ingestRecords(key, records);
    const errorCount = result.errors.length;
    const message = [
      result.review ? `${result.review} possible duplicate(s) sent to review` : "",
      unusable ? `${unusable} record(s) skipped (no contractor named, owner-builder, or a trade that does not buy material)` : "",
      result.errors[0] ?? "",
    ].filter(Boolean).join("; ") || null;
    await db.sourceRun.update({
      where: { id: run.id },
      data: { status: "success", finishedAt: new Date(), found: raw.length, added: result.added, updated: result.updated, errorCount, message },
    });
    return { sourceKey: key, status: "success", message: message ?? "OK", found: raw.length, added: result.added, updated: result.updated };
  } catch (e) {
    const message = (e instanceof Error ? e.message : "Unknown error").slice(0, 500);
    await db.sourceRun.update({ where: { id: run.id }, data: { status: "failed", finishedAt: new Date(), errorCount: 1, message } });
    return { sourceKey: key, status: "failed", message, found: 0, added: 0, updated: 0 };
  }
}

export async function runAllSources(): Promise<RunSummary[]> {
  const out: RunSummary[] = [];
  for (const a of ADAPTERS) out.push(await runSource(a.key));
  return out;
}
