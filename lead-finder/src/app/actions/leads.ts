"use server";

import { z } from "zod";
import { done, fail, goTo, zodMessage, type ActionState } from "@/lib/action-state";
import { audit } from "@/lib/audit";
import { ACTIVITY_TYPES, OUTCOMES, PROJECT_TYPES, STAGES, TRADES } from "@/lib/constants";
import { parseDate, parseNumber } from "@/lib/csv-mapping";
import { db } from "@/lib/db";
import { ingestRecords, loadAssumptions } from "@/lib/ingest";
import { estimateMaterial } from "@/lib/materials";
import { mergeCompanies } from "@/lib/merge";
import { normalizeCompanyName, normalizeCounty, normalizeEmail, normalizePhone, normalizeZip } from "@/lib/normalize";
import { rescoreCompanies } from "@/lib/rescore";
import { requireAdmin, requireUser } from "@/lib/session";
import { markDoNotContact, outreachBlockReason } from "@/lib/suppression";

const text = (max: number) => z.string().trim().max(max);
const optional = (max: number) => text(max).optional().transform((v) => v || null);
const id = z.string().min(1).max(40);
const form = (fd: FormData) => Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string"));


// ---------------------------------------------------------------- create / edit

const leadSchema = z.object({
  name: text(200).min(2, "Enter a company name"),
  trade: z.enum(TRADES),
  licenseNumber: optional(40),
  address: optional(300),
  city: optional(80),
  county: optional(40),
  zip: optional(10),
  phone: optional(40),
  email: optional(200),
  website: optional(300),
  contactName: optional(120),
  contactTitle: optional(80),
  note: optional(2000),
});

export async function quickAddLead(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = leadSchema.safeParse(form(fd));
  if (!parsed.success) return fail(zodMessage(parsed.error));
  const d = parsed.data;
  if (d.phone && !normalizePhone(d.phone)) return fail("That phone number does not look like a 10-digit US number.");
  if (d.email && !normalizeEmail(d.email)) return fail("That email address does not look right.");

  const result = await ingestRecords(
    "manual",
    [{
      company: { name: d.name, trade: d.trade, licenseNumber: d.licenseNumber, address: d.address, city: d.city, county: d.county, zip: d.zip, phone: d.phone, email: d.email, website: d.website },
      contact: d.contactName ? { name: d.contactName, title: d.contactTitle } : undefined,
    }],
    { ownerId: user.id },
  );
  const companyId = result.companyIds[0];
  if (!companyId) return fail(result.errors[0] ?? "Could not save this lead.");
  if (d.note) await db.activity.create({ data: { companyId, userId: user.id, type: "NOTE", body: d.note } });
  await audit(user.id, result.added ? "lead.create" : "lead.merge_on_add", "Company", companyId, { name: d.name });
  return goTo(`/leads/${companyId}${result.added ? "" : "?merged=1"}`);
}

const editSchema = leadSchema.omit({ contactName: true, contactTitle: true, note: true }).extend({
  id,
  lat: optional(20),
  lng: optional(20),
  tags: optional(300),
  quoteValue: optional(20),
  wonValue: optional(20),
});

export async function updateLead(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = editSchema.safeParse(form(fd));
  if (!parsed.success) return fail(zodMessage(parsed.error));
  const d = parsed.data;
  const phone = d.phone ? normalizePhone(d.phone) : null;
  const email = d.email ? normalizeEmail(d.email) : null;
  if (d.phone && !phone) return fail("That phone number does not look like a 10-digit US number.");
  if (d.email && !email) return fail("That email address does not look right.");
  const lat = d.lat ? Number(d.lat) : null;
  const lng = d.lng ? Number(d.lng) : null;
  if ((lat != null && !(lat >= -90 && lat <= 90)) || (lng != null && !(lng >= -180 && lng <= 180))) return fail("Latitude or longitude is out of range.");
  let website: string | null = null;
  if (d.website) {
    try {
      const u = new URL(/^https?:\/\//i.test(d.website) ? d.website : `https://${d.website}`);
      if (!["http:", "https:"].includes(u.protocol)) throw new Error();
      website = u.toString();
    } catch {
      return fail("That website address does not look right.");
    }
  }
  await db.company.update({
    where: { id: d.id },
    data: {
      name: d.name, normalizedName: normalizeCompanyName(d.name), trade: d.trade, licenseNumber: d.licenseNumber, address: d.address, city: d.city,
      county: normalizeCounty(d.county), zip: normalizeZip(d.zip), phone, email, website, lat, lng,
      tags: d.tags ? [...new Set(d.tags.split(",").map((t) => t.trim().slice(0, 30)).filter(Boolean))].slice(0, 15) : [],
      quoteValue: parseNumber(d.quoteValue), wonValue: parseNumber(d.wonValue),
    },
  });
  await rescoreCompanies([d.id]);
  await audit(user.id, "lead.update", "Company", d.id);
  return done("Lead updated.");
}

export async function deleteLead(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = id.safeParse(fd.get("id"));
  if (!parsed.success) return fail("Missing lead.");
  const company = await db.company.findUnique({ where: { id: parsed.data }, select: { name: true } });
  if (!company) return fail("Lead not found.");
  await db.company.delete({ where: { id: parsed.data } });
  await audit(admin.id, "lead.delete", "Company", parsed.data, { name: company.name });
  return goTo("/leads");
}

// ---------------------------------------------------------------- pipeline

const stageSchema = z.object({ id, stage: z.enum(STAGES), lostReason: z.string().trim().max(100).optional() });

export async function setStage(input: { id: string; stage: string; lostReason?: string }): Promise<ActionState> {
  const user = await requireUser();
  const parsed = stageSchema.safeParse(input);
  if (!parsed.success) return fail(zodMessage(parsed.error));
  const { id: companyId, stage } = parsed.data;
  if (stage === "LOST" && !parsed.data.lostReason) return fail("Choose a lost reason.");
  const before = await db.company.findUnique({ where: { id: companyId }, select: { stage: true, quoteValue: true, wonValue: true } });
  if (!before) return fail("Lead not found.");
  await db.company.update({
    where: { id: companyId },
    data: {
      stage,
      lostReason: stage === "LOST" ? parsed.data.lostReason : null,
      wonValue: stage === "WON" ? (before.wonValue ?? before.quoteValue) : before.wonValue,
    },
  });
  await audit(user.id, "lead.stage", "Company", companyId, { from: before.stage, to: stage, lostReason: parsed.data.lostReason ?? null });
  return done("Stage updated.");
}

export async function setStageForm(_: ActionState, fd: FormData): Promise<ActionState> {
  return setStage({ id: String(fd.get("id") ?? ""), stage: String(fd.get("stage") ?? ""), lostReason: String(fd.get("lostReason") ?? "") || undefined });
}

export async function setOwner(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = z.object({ id, ownerId: z.string().max(40) }).safeParse(form(fd));
  if (!parsed.success) return fail(zodMessage(parsed.error));
  const ownerId = parsed.data.ownerId || null;
  if (ownerId && !(await db.user.findFirst({ where: { id: ownerId, active: true } }))) return fail("That user is not available.");
  await db.company.update({ where: { id: parsed.data.id }, data: { ownerId } });
  await audit(user.id, "lead.assign", "Company", parsed.data.id, { ownerId });
  return done("Owner updated.");
}

// ---------------------------------------------------------------- contacts / projects

export async function addContact(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = z
    .object({ companyId: id, name: text(120).min(2, "Enter a name"), title: optional(80), phone: optional(40), email: optional(200), preferredChannel: z.enum(["EMAIL", "TEXT", "CALL", ""]).optional() })
    .safeParse(form(fd));
  if (!parsed.success) return fail(zodMessage(parsed.error));
  const d = parsed.data;
  if (d.phone && !normalizePhone(d.phone)) return fail("That phone number does not look like a 10-digit US number.");
  if (d.email && !normalizeEmail(d.email)) return fail("That email address does not look right.");
  await db.contact.create({
    data: { companyId: d.companyId, name: d.name, title: d.title, phone: normalizePhone(d.phone), email: normalizeEmail(d.email), preferredChannel: d.preferredChannel || null },
  });
  await rescoreCompanies([d.companyId]);
  return done("Contact added.");
}

export async function deleteContact(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = id.safeParse(fd.get("id"));
  if (!parsed.success) return fail("Missing contact.");
  const contact = await db.contact.delete({ where: { id: parsed.data } }).catch(() => null);
  if (contact) {
    await rescoreCompanies([contact.companyId]);
  }
  return done("Contact removed.");
}

export async function addProject(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = z
    .object({
      companyId: id, externalId: optional(80), type: z.enum(PROJECT_TYPES), description: optional(1000), address: optional(300), city: optional(80),
      county: optional(40), zip: optional(10), declaredValue: optional(20), areaSqFt: optional(20), issueDate: optional(30),
    })
    .safeParse(form(fd));
  if (!parsed.success) return fail(zodMessage(parsed.error));
  const d = parsed.data;
  const declaredValue = parseNumber(d.declaredValue);
  const areaSqFt = parseNumber(d.areaSqFt);
  const est = estimateMaterial({ type: d.type, declaredValue, areaSqFt }, await loadAssumptions());
  const externalId = d.externalId || `MANUAL-${Date.now().toString(36).toUpperCase()}`;
  try {
    await db.project.create({
      data: {
        companyId: d.companyId, source: "manual", externalId, type: d.type, description: d.description, address: d.address, city: d.city,
        county: normalizeCounty(d.county), zip: normalizeZip(d.zip), declaredValue, areaSqFt, issueDate: parseDate(d.issueDate) ?? new Date(), status: "Active",
        estCubicYards: est?.cubicYards ?? null, estTons: est?.tons ?? null, estNote: est ? `${est.material}. ${est.note}` : null,
      },
    });
  } catch {
    return fail("A project with that permit or bid number already exists.");
  }
  await rescoreCompanies([d.companyId]);
  return done("Project added.");
}

// ---------------------------------------------------------------- activity / tasks

const activitySchema = z.object({
  companyId: id,
  type: z.enum(ACTIVITY_TYPES),
  outcome: z.enum([...OUTCOMES, ""]).optional(),
  body: optional(4000),
  followUpDate: optional(30),
  followUpTitle: optional(200),
});

const CONTACT_TYPES = new Set(["CALL", "EMAIL", "TEXT", "MEETING", "QUOTE"]);

export async function logActivity(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = activitySchema.safeParse(form(fd));
  if (!parsed.success) return fail(zodMessage(parsed.error));
  const d = parsed.data;
  const outcome = d.outcome || null;
  const isOutreach = ["CALL", "EMAIL", "TEXT"].includes(d.type);

  // Outreach to a suppressed lead may only be logged when it records the opt-out itself.
  if (isOutreach && outcome !== "Opted out") {
    const blocked = await outreachBlockReason(d.companyId);
    if (blocked) return fail(blocked);
  }

  await db.activity.create({ data: { companyId: d.companyId, userId: user.id, type: d.type, outcome, body: d.body } });
  const company = await db.company.findUniqueOrThrow({ where: { id: d.companyId }, select: { stage: true } });
  const patch: Record<string, unknown> = {};
  if (CONTACT_TYPES.has(d.type)) patch.lastContactedAt = new Date();
  // Move the lead forward automatically, never backward.
  const order = STAGES.indexOf(company.stage);
  if (d.type === "QUOTE" && order < STAGES.indexOf("QUOTE_SENT")) patch.stage = "QUOTE_SENT";
  else if ((outcome === "Spoke" || outcome === "Interested" || outcome === "Requested quote" || d.type === "MEETING") && order < STAGES.indexOf("CONVERSATION")) patch.stage = "CONVERSATION";
  else if (CONTACT_TYPES.has(d.type) && order < STAGES.indexOf("CONTACTED")) patch.stage = "CONTACTED";
  if (Object.keys(patch).length) await db.company.update({ where: { id: d.companyId }, data: patch });

  if (outcome === "Opted out") {
    await markDoNotContact(d.companyId, "Opted out");
    await audit(user.id, "lead.opt_out", "Company", d.companyId);
  } else if (d.followUpDate) {
    const due = parseDate(d.followUpDate);
    if (!due) return fail("Activity saved, but the follow-up date was not valid.");
    await db.task.create({ data: { companyId: d.companyId, assigneeId: user.id, title: d.followUpTitle || "Follow up", dueDate: due } });
  }
  await rescoreCompanies([d.companyId]);
  return done(outcome === "Opted out" ? "Saved. This lead is now on the do-not-contact list." : "Activity logged.");
}

export async function addTask(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = z.object({ companyId: id, title: text(200).min(2, "Enter a task"), dueDate: text(30), assigneeId: z.string().max(40).optional() }).safeParse(form(fd));
  if (!parsed.success) return fail(zodMessage(parsed.error));
  const due = parseDate(parsed.data.dueDate);
  if (!due) return fail("Choose a due date.");
  await db.task.create({ data: { companyId: parsed.data.companyId, title: parsed.data.title, dueDate: due, assigneeId: parsed.data.assigneeId || user.id } });
  return done("Task added.");
}

export async function completeTask(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = id.safeParse(fd.get("id"));
  if (!parsed.success) return fail("Missing task.");
  const reopen = fd.get("reopen") === "1";
  const task = await db.task.update({ where: { id: parsed.data }, data: { completedAt: reopen ? null : new Date() } }).catch(() => null);
  if (!task) return fail("Task not found.");
  return done(reopen ? "Task reopened." : "Task completed.");
}

// ---------------------------------------------------------------- compliance flags

export async function setDoNotContact(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = z.object({ id, reason: text(200).min(2, "Enter a reason") }).safeParse(form(fd));
  if (!parsed.success) return fail(zodMessage(parsed.error));
  await markDoNotContact(parsed.data.id, parsed.data.reason);
  await audit(user.id, "lead.dnc_set", "Company", parsed.data.id, { reason: parsed.data.reason });
  return done("Added to the do-not-contact list.");
}

/** Admin-only correction for a lead that was flagged by mistake. Logged in the audit trail. */
export async function clearDoNotContact(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = id.safeParse(fd.get("id"));
  if (!parsed.success) return fail("Missing lead.");
  const company = await db.company.findUnique({ where: { id: parsed.data }, include: { contacts: true } });
  if (!company) return fail("Lead not found.");
  const emails = [company.email, ...company.contacts.map((c) => c.email)].filter((v): v is string => !!v);
  const phones = [company.phone, ...company.contacts.map((c) => c.phone)].filter((v): v is string => !!v);
  await db.$transaction([
    db.company.update({ where: { id: company.id }, data: { doNotContact: false, dncReason: null, dncAt: null } }),
    db.suppression.deleteMany({ where: { OR: [{ kind: "email", value: { in: emails } }, { kind: "phone", value: { in: phones } }] } }),
  ]);
  await audit(admin.id, "lead.dnc_cleared", "Company", company.id, { previousReason: company.dncReason, emails, phones });
  return done("Removed from the do-not-contact list.");
}

export async function setHomeownerFlag(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = z.object({ id, value: z.enum(["0", "1"]) }).safeParse(form(fd));
  if (!parsed.success) return fail(zodMessage(parsed.error));
  await db.company.update({ where: { id: parsed.data.id }, data: { likelyHomeowner: parsed.data.value === "1" } });
  await audit(user.id, "lead.homeowner_flag", "Company", parsed.data.id, { value: parsed.data.value === "1" });
  return done("Updated.");
}

// ---------------------------------------------------------------- bulk actions / saved filters

const bulkSchema = z.object({
  ids: z.array(id).min(1, "Select at least one lead").max(500),
  op: z.enum(["assign", "stage", "tag"]),
  value: z.string().trim().max(100),
});

export async function bulkUpdate(input: { ids: string[]; op: string; value: string }): Promise<ActionState> {
  const user = await requireUser();
  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) return fail(zodMessage(parsed.error));
  const { ids, op, value } = parsed.data;
  if (op === "assign") {
    const ownerId = value || null;
    if (ownerId && !(await db.user.findFirst({ where: { id: ownerId, active: true } }))) return fail("That user is not available.");
    await db.company.updateMany({ where: { id: { in: ids } }, data: { ownerId } });
  } else if (op === "stage") {
    const stage = z.enum(STAGES).safeParse(value);
    if (!stage.success) return fail("Choose a stage.");
    if (stage.data === "LOST") return fail("Mark leads as Lost one at a time so each gets a reason.");
    await db.company.updateMany({ where: { id: { in: ids } }, data: { stage: stage.data, lostReason: null } });
  } else {
    const tag = value.slice(0, 30);
    if (!tag) return fail("Enter a tag.");
    const rows = await db.company.findMany({ where: { id: { in: ids } }, select: { id: true, tags: true } });
    await db.$transaction(rows.filter((r) => !r.tags.includes(tag)).map((r) => db.company.update({ where: { id: r.id }, data: { tags: { push: tag } } })));
  }
  await audit(user.id, `lead.bulk_${op}`, "Company", null, { count: ids.length, value });
  return done(`Updated ${ids.length} lead${ids.length === 1 ? "" : "s"}.`);
}

export async function saveFilter(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = z.object({ name: text(60).min(1, "Name this filter"), query: z.string().max(1000) }).safeParse(form(fd));
  if (!parsed.success) return fail(zodMessage(parsed.error));
  if ((await db.savedFilter.count({ where: { userId: user.id } })) >= 30) return fail("You have 30 saved filters. Delete one first.");
  await db.savedFilter.create({ data: { userId: user.id, name: parsed.data.name, query: parsed.data.query } });
  return done("Filter saved.");
}

export async function deleteFilter(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  await db.savedFilter.deleteMany({ where: { id: String(fd.get("id") ?? ""), userId: user.id } });
  return done("Filter deleted.");
}

// ---------------------------------------------------------------- duplicates

export async function resolveDuplicate(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = z.object({ id, decision: z.enum(["keepA", "keepB", "dismiss"]) }).safeParse(form(fd));
  if (!parsed.success) return fail(zodMessage(parsed.error));
  const pair = await db.duplicateCandidate.findUnique({ where: { id: parsed.data.id } });
  if (!pair || pair.status !== "PENDING") return fail("This pair was already handled.");
  if (parsed.data.decision === "dismiss") {
    await db.duplicateCandidate.update({ where: { id: pair.id }, data: { status: "DISMISSED" } });
    await audit(user.id, "duplicate.dismiss", "DuplicateCandidate", pair.id);
  } else {
    const keep = parsed.data.decision === "keepA" ? pair.companyAId : pair.companyBId;
    const drop = parsed.data.decision === "keepA" ? pair.companyBId : pair.companyAId;
    // Deleting the dropped company cascades to this candidate row.
    await mergeCompanies(keep, drop);
    await audit(user.id, "duplicate.merge", "Company", keep, { mergedFrom: drop });
  }
  return done(parsed.data.decision === "dismiss" ? "Kept as separate leads." : "Leads merged.");
}
