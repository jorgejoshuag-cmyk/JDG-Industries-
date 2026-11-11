// Single write path for every lead source: clean up, de-duplicate, save, estimate material, score.

import type { Prisma } from "@prisma/client";
import { classifyTrade } from "./classify";
import { TRADES, PROJECT_TYPES } from "./constants";
import { db } from "./db";
import { AUTO_MERGE_THRESHOLD, findBestMatch } from "./dedupe";
import { estimateMaterial, DEFAULT_ASSUMPTIONS, type Assumption } from "./materials";
import { looksLikeHomeowner, normalizeCompanyName, normalizeCounty, normalizeEmail, normalizePhone, normalizeZip } from "./normalize";
import { rescoreCompanies } from "./rescore";
import type { NormalizedRecord } from "./sources/types";

export type IngestResult = { found: number; added: number; updated: number; review: number; skipped: number; errors: string[]; companyIds: string[] };

const clean = (s: string | null | undefined, max = 300) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
};

function cleanWebsite(s: string | null | undefined): string | null {
  const t = clean(s, 300);
  if (!t) return null;
  const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withScheme);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export async function loadAssumptions(): Promise<Assumption[]> {
  const rows = await db.materialAssumption.findMany();
  return rows.length ? rows : DEFAULT_ASSUMPTIONS;
}

async function findCandidates(name: string, normalizedName: string, license: string | null, phone: string | null, zip: string | null) {
  const firstWord = normalizedName.split(" ").find((w) => w.length >= 4);
  const or: Prisma.CompanyWhereInput[] = [{ normalizedName }];
  if (license) or.push({ licenseNumber: { equals: license, mode: "insensitive" } });
  if (phone) or.push({ phone });
  if (zip) or.push({ zip });
  if (firstWord) or.push({ normalizedName: { contains: firstWord } });
  return db.company.findMany({
    where: { OR: or },
    select: { id: true, name: true, licenseNumber: true, phone: true, zip: true },
    take: 300,
  });
}

export async function ingestRecords(sourceKey: string, records: NormalizedRecord[], opts: { ownerId?: string | null } = {}): Promise<IngestResult> {
  const result: IngestResult = { found: records.length, added: 0, updated: 0, review: 0, skipped: 0, errors: [], companyIds: [] };
  const assumptions = await loadAssumptions();
  const now = new Date();
  const touched = new Set<string>();

  for (const rec of records) {
    try {
      const name = clean(rec.company.name, 200);
      if (!name || name.length < 2) {
        result.skipped++;
        continue;
      }
      const normalizedName = normalizeCompanyName(name);
      const phone = normalizePhone(rec.company.phone);
      const email = normalizeEmail(rec.company.email);
      const zip = normalizeZip(rec.company.zip);
      const license = clean(rec.company.licenseNumber, 40);
      const rawTrade = clean(rec.company.trade, 80);
      const trade = rawTrade && (TRADES as readonly string[]).includes(rawTrade) ? rawTrade : classifyTrade(rawTrade, name);

      const fields = {
        trade,
        licenseNumber: license,
        address: clean(rec.company.address),
        city: clean(rec.company.city, 80),
        county: normalizeCounty(rec.company.county),
        zip,
        lat: rec.company.lat ?? null,
        lng: rec.company.lng ?? null,
        phone,
        email,
        website: cleanWebsite(rec.company.website),
      };

      const match = findBestMatch({ name, licenseNumber: license, phone, zip }, await findCandidates(name, normalizedName, license, phone, zip));
      let companyId: string;

      if (match && match.confidence >= AUTO_MERGE_THRESHOLD) {
        // Confident match: fill in blanks on the existing record, never overwrite what staff may have edited.
        const existing = await db.company.findUniqueOrThrow({ where: { id: match.id } });
        const patch: Prisma.CompanyUpdateInput = { sourceRetrievedAt: now };
        for (const [k, v] of Object.entries(fields)) {
          const cur = (existing as Record<string, unknown>)[k];
          if (v != null && (cur == null || cur === "" || (k === "trade" && cur === "Other" && v !== "Other"))) (patch as Record<string, unknown>)[k] = v;
        }
        if (!existing.sources.includes(sourceKey)) patch.sources = { push: sourceKey };
        await db.company.update({ where: { id: existing.id }, data: patch });
        companyId = existing.id;
        result.updated++;
      } else {
        const suppressed = await db.suppression.findFirst({
          where: { OR: [...(email ? [{ kind: "email", value: email }] : []), ...(phone ? [{ kind: "phone", value: phone }] : [])] },
        });
        const created = await db.company.create({
          data: {
            name,
            normalizedName,
            ...fields,
            sources: [sourceKey],
            sourceRetrievedAt: now,
            ownerId: opts.ownerId ?? null,
            likelyHomeowner: looksLikeHomeowner(name, [rec.project?.description ?? "", rawTrade ?? ""]),
            ...(suppressed ? { doNotContact: true, dncReason: "Contact details are on the opt-out list", dncAt: now } : {}),
          },
        });
        companyId = created.id;
        result.added++;
        if (match) {
          // Not sure enough to merge automatically: queue the pair for a person to review.
          const [a, b] = [match.id, created.id].sort();
          await db.duplicateCandidate.upsert({
            where: { companyAId_companyBId: { companyAId: a, companyBId: b } },
            update: {},
            create: { companyAId: a, companyBId: b, reason: match.reason, confidence: match.confidence },
          });
          result.review++;
        }
      }
      touched.add(companyId);

      if (rec.contact?.name) {
        const cname = clean(rec.contact.name, 120);
        if (cname) {
          const exists = await db.contact.findFirst({ where: { companyId, name: { equals: cname, mode: "insensitive" } } });
          if (!exists) {
            await db.contact.create({
              data: { companyId, name: cname, title: clean(rec.contact.title, 80), phone: normalizePhone(rec.contact.phone), email: normalizeEmail(rec.contact.email) },
            });
          }
        }
      }

      if (rec.project?.externalId) {
        const p = rec.project;
        const externalId = clean(p.externalId, 80) as string;
        const rawType = clean(p.type, 60);
        const type = rawType && (PROJECT_TYPES as readonly string[]).includes(rawType) ? rawType : "Other";
        const est = estimateMaterial({ type, areaSqFt: p.areaSqFt, declaredValue: p.declaredValue }, assumptions);
        const data = {
          companyId,
          type,
          description: clean(p.description, 1000),
          address: clean(p.address),
          city: clean(p.city, 80),
          county: normalizeCounty(p.county),
          zip: normalizeZip(p.zip),
          lat: p.lat ?? null,
          lng: p.lng ?? null,
          declaredValue: p.declaredValue ?? null,
          areaSqFt: p.areaSqFt ?? null,
          issueDate: p.issueDate ?? null,
          estimatedStart: p.estimatedStart ?? null,
          status: clean(p.status, 60),
          estCubicYards: est?.cubicYards ?? null,
          estTons: est?.tons ?? null,
          estNote: est ? `${est.material}. ${est.note}` : null,
          retrievedAt: now,
        };
        await db.project.upsert({
          where: { source_externalId: { source: sourceKey, externalId } },
          update: data,
          create: { source: sourceKey, externalId, ...data },
        });
      }
    } catch (e) {
      if (result.errors.length < 20) result.errors.push(`${rec.company?.name ?? "record"}: ${e instanceof Error ? e.message.slice(0, 200) : "failed"}`);
      result.skipped++;
    }
  }

  result.companyIds = [...touched];
  await rescoreCompanies(result.companyIds);
  return result;
}
