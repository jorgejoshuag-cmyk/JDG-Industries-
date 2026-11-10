"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { done, fail, zodMessage, type ActionState } from "@/lib/action-state";
import { audit } from "@/lib/audit";
import { PROJECT_TYPES } from "@/lib/constants";
import { db } from "@/lib/db";
import { normalizeCounty, normalizeZip } from "@/lib/normalize";
import { rescoreAll } from "@/lib/rescore";
import { requireAdmin, requireUser } from "@/lib/session";
import { setSetting } from "@/lib/settings";
import { MAPPABLE_FIELDS, SOURCE_DEFAULTS } from "@/lib/sources/config";
import { assertPublicHttpsUrl } from "@/lib/sources/http";
import { getSourceConfig, runSource, saveSourceConfig } from "@/lib/sources";
import type { JsonSourceConfig, PlacesSourceConfig } from "@/lib/sources/types";

const form = (fd: FormData) => Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string"));
const password = z.string().min(10, "Use at least 10 characters").max(200);

// ---------------------------------------------------------------- users

export async function createUser(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = z.object({ name: z.string().trim().min(2).max(80), email: z.string().trim().toLowerCase().email().max(200), role: z.enum(["ADMIN", "SALES"]), password }).safeParse(form(fd));
  if (!parsed.success) return fail(zodMessage(parsed.error));
  if (await db.user.findUnique({ where: { email: parsed.data.email } })) return fail("A user with that email already exists.");
  const user = await db.user.create({
    data: { name: parsed.data.name, email: parsed.data.email, role: parsed.data.role, passwordHash: await bcrypt.hash(parsed.data.password, 12) },
  });
  await audit(admin.id, "user.create", "User", user.id, { email: user.email, role: user.role });
  return done("User created. Share the password with them privately.");
}

export async function updateUser(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = z.object({ id: z.string().min(1).max(40), role: z.enum(["ADMIN", "SALES"]), active: z.enum(["0", "1"]), newPassword: z.string().max(200).optional() }).safeParse(form(fd));
  if (!parsed.success) return fail(zodMessage(parsed.error));
  const d = parsed.data;
  if (d.id === admin.id && (d.role !== "ADMIN" || d.active === "0")) return fail("You cannot remove your own admin access.");
  const data: { role: "ADMIN" | "SALES"; active: boolean; passwordHash?: string } = { role: d.role, active: d.active === "1" };
  if (d.newPassword) {
    const p = password.safeParse(d.newPassword);
    if (!p.success) return fail(zodMessage(p.error));
    data.passwordHash = await bcrypt.hash(p.data, 12);
  }
  await db.user.update({ where: { id: d.id }, data });
  await audit(admin.id, "user.update", "User", d.id, { role: d.role, active: data.active, passwordReset: Boolean(d.newPassword) });
  return done("User updated.");
}

export async function changeOwnPassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = z.object({ current: z.string().max(200), next: password }).safeParse(form(fd));
  if (!parsed.success) return fail(zodMessage(parsed.error));
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await bcrypt.compare(parsed.data.current, row.passwordHash))) return fail("Your current password is not correct.");
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(parsed.data.next, 12) } });
  await audit(user.id, "user.password_change", "User", user.id);
  return done("Password changed.");
}

// ---------------------------------------------------------------- scoring

export async function saveScoringRules(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const rules = await db.scoringRule.findMany();
  const updates: { key: string; weight: number; enabled: boolean }[] = [];
  for (const r of rules) {
    const weight = Number(fd.get(`weight:${r.key}`));
    if (!Number.isInteger(weight) || weight < 0 || weight > 100) return fail(`${r.label}: weight must be a whole number from 0 to 100.`);
    updates.push({ key: r.key, weight, enabled: fd.get(`enabled:${r.key}`) === "on" });
  }
  if (!updates.some((u) => u.enabled && u.weight > 0)) return fail("Keep at least one rule turned on with a weight above 0.");
  await db.$transaction(updates.map((u) => db.scoringRule.update({ where: { key: u.key }, data: { weight: u.weight, enabled: u.enabled } })));
  await rescoreAll();
  await audit(admin.id, "scoring.update", "ScoringRule", null, updates);
  return done("Rules saved and every lead re-scored.");
}

// ---------------------------------------------------------------- templates

const templateSchema = z.object({
  id: z.string().max(40).optional(),
  name: z.string().trim().min(2).max(100),
  channel: z.enum(["EMAIL", "TEXT", "CALL"]),
  subject: z.string().trim().max(200).optional(),
  body: z.string().trim().min(10, "Write the message").max(5000),
  active: z.string().optional(),
});

export async function saveTemplate(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = templateSchema.safeParse(form(fd));
  if (!parsed.success) return fail(zodMessage(parsed.error));
  const d = parsed.data;
  if (d.channel === "EMAIL" && !d.subject) return fail("Email templates need a subject.");
  const data = { name: d.name, channel: d.channel, subject: d.channel === "EMAIL" ? d.subject : null, body: d.body, active: d.id ? d.active === "on" : true };
  const saved = d.id ? await db.outreachTemplate.update({ where: { id: d.id }, data }) : await db.outreachTemplate.create({ data });
  await audit(admin.id, d.id ? "template.update" : "template.create", "OutreachTemplate", saved.id, { name: d.name });
  return done(d.id ? "Template saved." : "Template added.");
}

export async function deleteTemplate(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = String(fd.get("id") ?? "");
  await db.outreachTemplate.deleteMany({ where: { id } });
  await audit(admin.id, "template.delete", "OutreachTemplate", id);
  return done("Template deleted.");
}

// ---------------------------------------------------------------- material assumptions

export async function saveAssumptions(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const updates = [];
  for (const type of PROJECT_TYPES) {
    const parsed = z
      .object({ material: z.string().trim().min(2).max(200), depthInches: z.coerce.number().min(0).max(120), tonsPerCubicYard: z.coerce.number().min(0.1).max(5), tonsPer10kValue: z.coerce.number().min(0).max(1000) })
      .safeParse({ material: fd.get(`material:${type}`), depthInches: fd.get(`depth:${type}`), tonsPerCubicYard: fd.get(`tpcy:${type}`), tonsPer10kValue: fd.get(`tpv:${type}`) });
    if (!parsed.success) return fail(`${type} — ${zodMessage(parsed.error)}`);
    updates.push(db.materialAssumption.upsert({ where: { projectType: type }, update: parsed.data, create: { projectType: type, ...parsed.data } }));
  }
  await db.$transaction(updates);
  await audit(admin.id, "assumptions.update", "MaterialAssumption");
  return done("Saved. New and re-imported projects will use these numbers.");
}

// ---------------------------------------------------------------- settings / service area

export async function saveSettings(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      company_name: z.string().trim().min(2).max(100),
      business_address: z.string().trim().max(300),
      yard_address: z.string().trim().max(300),
      yard_lat: z.string().trim().max(20),
      yard_lng: z.string().trim().max(20),
      service_counties: z.string().trim().max(300),
    })
    .safeParse(form(fd));
  if (!parsed.success) return fail(zodMessage(parsed.error));
  const d = parsed.data;
  if (d.yard_lat || d.yard_lng) {
    const lat = Number(d.yard_lat);
    const lng = Number(d.yard_lng);
    if (!(lat >= -90 && lat <= 90) || !(lng >= -180 && lng <= 180) || !d.yard_lat || !d.yard_lng) return fail("Enter both a valid yard latitude and longitude, or leave both blank.");
  }
  const counties = d.service_counties.split(",").map((c) => normalizeCounty(c)).filter(Boolean).join(",");
  for (const [k, v] of Object.entries({ ...d, service_counties: counties })) await setSetting(k, v);
  await rescoreAll();
  await audit(admin.id, "settings.update", "Setting");
  return done("Settings saved and every lead re-scored.");
}

export async function addServiceZips(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const raw = String(fd.get("zips") ?? "").slice(0, 5000);
  const zips = [...new Set(raw.split(/[\s,;]+/).map((z) => normalizeZip(z)).filter((z): z is string => !!z))];
  if (!zips.length) return fail("Enter one or more 5-digit ZIP codes.");
  await db.serviceZip.createMany({ data: zips.map((zip) => ({ zip })), skipDuplicates: true });
  await rescoreAll();
  await audit(admin.id, "service_zip.add", "ServiceZip", null, { zips });
  return done(`Added ${zips.length} ZIP code${zips.length === 1 ? "" : "s"}.`);
}

export async function removeServiceZip(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const zip = String(fd.get("zip") ?? "");
  await db.serviceZip.deleteMany({ where: { zip } });
  await rescoreAll();
  await audit(admin.id, "service_zip.remove", "ServiceZip", zip);
  return done("Removed.");
}

// ---------------------------------------------------------------- sources

export async function saveSource(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const key = String(fd.get("key") ?? "");
  const base = SOURCE_DEFAULTS[key];
  if (!base) return fail("Unknown source.");
  const enabled = fd.get("enabled") === "on";

  if (base.kind === "places") {
    const queries = String(fd.get("queries") ?? "").split("\n").map((q) => q.trim().slice(0, 120)).filter(Boolean).slice(0, 25);
    const cfg: PlacesSourceConfig = { kind: "places", enabled, queries, maxPagesPerQuery: Math.max(1, Math.min(3, Number(fd.get("maxPagesPerQuery")) || 1)) };
    await saveSourceConfig(key, cfg);
  } else {
    const url = String(fd.get("url") ?? "").trim().slice(0, 1000);
    if (url) {
      try {
        assertPublicHttpsUrl(url.replace("{limit}", "1").replace("{offset}", "0"));
      } catch (e) {
        return fail(e instanceof Error ? e.message : "Invalid URL.");
      }
    }
    if (enabled && !url) return fail("Add the endpoint URL before turning this source on.");
    const fieldMap: Record<string, string> = {};
    for (const f of MAPPABLE_FIELDS) {
      const v = String(fd.get(`map:${f}`) ?? "").trim().slice(0, 120);
      if (v) fieldMap[f] = v;
    }
    if (enabled && !fieldMap.name) return fail("Map the company name field before turning this source on.");
    let headers: Record<string, string> = {};
    const rawHeaders = String(fd.get("headers") ?? "").trim();
    if (rawHeaders) {
      try {
        const parsed = z.record(z.string().max(500)).parse(JSON.parse(rawHeaders));
        headers = parsed;
      } catch {
        return fail('Headers must be JSON like {"X-App-Token": "abc"}.');
      }
    }
    const cfg: JsonSourceConfig = {
      kind: "json", enabled, url, headers,
      recordsPath: String(fd.get("recordsPath") ?? "").trim().slice(0, 120),
      fieldMap,
      pageSize: Math.max(1, Math.min(5000, Number(fd.get("pageSize")) || 500)),
      maxPages: Math.max(1, Math.min(50, Number(fd.get("maxPages")) || 10)),
      defaultTrade: String(fd.get("defaultTrade") ?? "").trim().slice(0, 80),
      defaultProjectType: String(fd.get("defaultProjectType") ?? "").trim().slice(0, 60),
      defaultCounty: String(fd.get("defaultCounty") ?? "").trim().slice(0, 40),
    };
    await saveSourceConfig(key, cfg);
  }
  await audit(admin.id, "source.update", "Source", key, { enabled });
  return done("Source saved.");
}

export async function runSourceNow(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const key = String(fd.get("key") ?? "");
  if (!SOURCE_DEFAULTS[key]) return fail("Unknown source.");
  await getSourceConfig(key);
  const r = await runSource(key);
  await audit(admin.id, "source.run", "Source", key, { status: r.status, found: r.found, added: r.added });
  if (r.status === "failed") return fail(`Run failed: ${r.message}`);
  if (r.status === "skipped") return fail(`Not run: ${r.message}.`);
  return done(`Found ${r.found}, added ${r.added}, updated ${r.updated}.`);
}
