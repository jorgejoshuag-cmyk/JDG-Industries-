import { db } from "./db";
import { buildSuppressionSet, contactBlockReason, type SuppressionSet } from "./dnc";

export async function loadSuppressionSet(): Promise<SuppressionSet> {
  return buildSuppressionSet(await db.suppression.findMany({ select: { kind: true, value: true } }));
}

/** Server-side gate used before any draft is generated or outreach is logged. */
export async function outreachBlockReason(companyId: string): Promise<string | null> {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { doNotContact: true, likelyHomeowner: true, phone: true, email: true },
  });
  if (!company) return "Lead not found.";
  return contactBlockReason(company, await loadSuppressionSet());
}

/** Flags the company and permanently records its contact details on the opt-out list. */
export async function markDoNotContact(companyId: string, reason: string) {
  const company = await db.company.findUniqueOrThrow({ where: { id: companyId }, include: { contacts: true } });
  const rows: { kind: string; value: string; reason: string }[] = [];
  for (const e of [company.email, ...company.contacts.map((c) => c.email)]) if (e) rows.push({ kind: "email", value: e.toLowerCase(), reason });
  for (const p of [company.phone, ...company.contacts.map((c) => c.phone)]) if (p) rows.push({ kind: "phone", value: p, reason });
  await db.$transaction([
    db.company.update({ where: { id: companyId }, data: { doNotContact: true, dncReason: reason, dncAt: new Date() } }),
    db.task.updateMany({ where: { companyId, completedAt: null }, data: { completedAt: new Date() } }),
    ...(rows.length ? [db.suppression.createMany({ data: rows, skipDuplicates: true })] : []),
  ]);
}
