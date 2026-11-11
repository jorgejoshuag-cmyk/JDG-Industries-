import { db } from "./db";
import { rescoreCompanies } from "./rescore";

const FILL = ["licenseNumber", "address", "city", "county", "zip", "lat", "lng", "phone", "email", "website", "ownerId", "lastContactedAt", "quoteValue", "wonValue"] as const;

/** Merges `dropId` into `keepId`: moves all history, fills blanks, keeps any do-not-contact flag. */
export async function mergeCompanies(keepId: string, dropId: string) {
  if (keepId === dropId) throw new Error("Cannot merge a lead into itself.");
  await db.$transaction(async (tx) => {
    const keep = await tx.company.findUniqueOrThrow({ where: { id: keepId } });
    const drop = await tx.company.findUniqueOrThrow({ where: { id: dropId } });
    const patch: Record<string, unknown> = {
      sources: [...new Set([...keep.sources, ...drop.sources])],
      tags: [...new Set([...keep.tags, ...drop.tags])],
    };
    for (const k of FILL) if (keep[k] == null && drop[k] != null) patch[k] = drop[k];
    if (keep.trade === "Other" && drop.trade !== "Other") patch.trade = drop.trade;
    if (drop.doNotContact && !keep.doNotContact) Object.assign(patch, { doNotContact: true, dncReason: drop.dncReason, dncAt: drop.dncAt });
    await tx.contact.updateMany({ where: { companyId: dropId }, data: { companyId: keepId } });
    await tx.project.updateMany({ where: { companyId: dropId }, data: { companyId: keepId } });
    await tx.activity.updateMany({ where: { companyId: dropId }, data: { companyId: keepId } });
    await tx.task.updateMany({ where: { companyId: dropId }, data: { companyId: keepId } });
    await tx.company.update({ where: { id: keepId }, data: patch });
    await tx.company.delete({ where: { id: dropId } });
  });
  await rescoreCompanies([keepId]);
}
