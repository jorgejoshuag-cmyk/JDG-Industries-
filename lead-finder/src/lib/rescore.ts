import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { distanceMiles } from "./normalize";
import { computeScore, DEFAULT_RULES, type RuleConfig } from "./scoring";
import { getSettings, serviceCounties, yardCoords } from "./settings";

type Ctx = { rules: RuleConfig[]; counties: string[]; zips: string[]; yard: { lat: number; lng: number } | null };

export async function loadScoreContext(): Promise<Ctx> {
  const [rules, settings, zips] = await Promise.all([db.scoringRule.findMany(), getSettings(), db.serviceZip.findMany({ select: { zip: true } })]);
  return {
    rules: rules.length ? rules : DEFAULT_RULES,
    counties: serviceCounties(settings),
    zips: zips.map((z) => z.zip),
    yard: yardCoords(settings),
  };
}

/** Distance from the yard to the closest office or jobsite that has coordinates. */
function nearestMiles(yard: { lat: number; lng: number } | null, points: { lat: number | null; lng: number | null }[]): number | null {
  if (!yard) return null;
  const miles = points.filter((p) => p.lat != null && p.lng != null).map((p) => distanceMiles(yard.lat, yard.lng, p.lat as number, p.lng as number));
  return miles.length ? Math.min(...miles) : null;
}

const CLOSED = /closed|final|complete|expired|cancel|void/i;

export async function rescoreCompanies(ids: string[], ctx?: Ctx) {
  if (!ids.length) return;
  const c = ctx ?? (await loadScoreContext());
  const companies = await db.company.findMany({
    where: { id: { in: ids } },
    include: {
      projects: { select: { type: true, declaredValue: true, issueDate: true, status: true, county: true, lat: true, lng: true } },
      contacts: { select: { id: true }, take: 1 },
      activities: { select: { outcome: true }, where: { outcome: { not: null } } },
    },
  });
  for (const co of companies) {
    const result = computeScore(
      {
        trade: co.trade,
        county: co.county,
        zip: co.zip,
        distanceMiles: nearestMiles(c.yard, [co, ...co.projects]),
        hasPhone: Boolean(co.phone),
        hasEmail: Boolean(co.email),
        hasNamedContact: co.contacts.length > 0,
        projects: co.projects.map((p) => ({ type: p.type, declaredValue: p.declaredValue, issueDate: p.issueDate, active: !CLOSED.test(p.status ?? ""), county: p.county })),
        activityOutcomes: co.activities.map((a) => a.outcome as string),
        serviceCounties: c.counties,
        serviceZips: c.zips,
      },
      c.rules,
    );
    await db.company.update({
      where: { id: co.id },
      data: { score: result.score, tier: result.tier, scoreBreakdown: result.breakdown as unknown as Prisma.InputJsonValue },
    });
  }
}

export async function rescoreAll() {
  const ctx = await loadScoreContext();
  let cursor: string | undefined;
  for (;;) {
    const batch = await db.company.findMany({ select: { id: true }, take: 200, orderBy: { id: "asc" }, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
    if (!batch.length) break;
    await rescoreCompanies(batch.map((b) => b.id), ctx);
    cursor = batch[batch.length - 1].id;
  }
}
