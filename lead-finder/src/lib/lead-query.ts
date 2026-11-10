import type { Prisma } from "@prisma/client";
import { PAGE_SIZE, STAGES, TIERS } from "./constants";

export type LeadFilters = {
  q: string; county: string; city: string; zip: string; trade: string; tier: string; stage: string; source: string;
  owner: string; contacted: string; hasPhone: string; hasEmail: string; show: string; tag: string; sort: string;
};

const KEYS: (keyof LeadFilters)[] = ["q", "county", "city", "zip", "trade", "tier", "stage", "source", "owner", "contacted", "hasPhone", "hasEmail", "show", "tag", "sort"];

type Params = Record<string, string | string[] | undefined> | URLSearchParams;

function read(params: Params, key: string): string {
  const v = params instanceof URLSearchParams ? params.get(key) : params[key];
  return (Array.isArray(v) ? v[0] : v ?? "").toString().trim().slice(0, 100);
}

export function parseLeadFilters(params: Params): { filters: LeadFilters; page: number } {
  const filters = Object.fromEntries(KEYS.map((k) => [k, read(params, k)])) as LeadFilters;
  const page = Math.max(1, Math.min(10_000, parseInt(read(params, "page") || "1", 10) || 1));
  return { filters, page };
}

/** Only the filters that are set, for building links and saved filters. */
export function activeParams(filters: LeadFilters): Record<string, string> {
  return Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
}

export function buildLeadWhere(f: LeadFilters, currentUserId: string): Prisma.CompanyWhereInput {
  const and: Prisma.CompanyWhereInput[] = [];
  // Private homeowners and do-not-contact records are hidden unless asked for explicitly.
  if (f.show === "homeowners") and.push({ likelyHomeowner: true });
  else if (f.show === "dnc") and.push({ doNotContact: true });
  else if (f.show !== "all") and.push({ likelyHomeowner: false });

  if (f.q) {
    const digits = f.q.replace(/\D/g, "");
    and.push({
      OR: [
        { name: { contains: f.q, mode: "insensitive" } },
        { city: { contains: f.q, mode: "insensitive" } },
        { licenseNumber: { contains: f.q, mode: "insensitive" } },
        { email: { contains: f.q, mode: "insensitive" } },
        ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : []),
        { contacts: { some: { name: { contains: f.q, mode: "insensitive" } } } },
      ],
    });
  }
  if (f.county) and.push({ county: f.county });
  if (f.city) and.push({ city: { equals: f.city, mode: "insensitive" } });
  if (f.zip) and.push({ zip: f.zip });
  if (f.trade) and.push({ trade: f.trade });
  if (f.tier && (TIERS as readonly string[]).includes(f.tier)) and.push({ tier: f.tier });
  if (f.stage && (STAGES as readonly string[]).includes(f.stage)) and.push({ stage: f.stage as (typeof STAGES)[number] });
  if (f.source) and.push({ sources: { has: f.source } });
  if (f.tag) and.push({ tags: { has: f.tag } });
  if (f.owner === "me") and.push({ ownerId: currentUserId });
  else if (f.owner === "none") and.push({ ownerId: null });
  else if (f.owner) and.push({ ownerId: f.owner });
  if (f.contacted === "never") and.push({ lastContactedAt: null });
  else if (["7", "14", "30", "60"].includes(f.contacted)) {
    const cutoff = new Date(Date.now() - Number(f.contacted) * 86_400_000);
    and.push({ OR: [{ lastContactedAt: null }, { lastContactedAt: { lt: cutoff } }] });
  }
  if (f.hasPhone === "1") and.push({ phone: { not: null } });
  if (f.hasEmail === "1") and.push({ email: { not: null } });
  return and.length ? { AND: and } : {};
}

export function leadOrderBy(sort: string): Prisma.CompanyOrderByWithRelationInput[] {
  switch (sort) {
    case "name": return [{ name: "asc" }];
    case "newest": return [{ createdAt: "desc" }];
    case "contacted": return [{ lastContactedAt: { sort: "asc", nulls: "first" } }, { score: "desc" }];
    default: return [{ score: "desc" }, { name: "asc" }];
  }
}

export { PAGE_SIZE };
