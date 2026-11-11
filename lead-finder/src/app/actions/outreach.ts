"use server";

import { z } from "zod";
import { zodMessage } from "@/lib/action-state";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { loadAssumptions } from "@/lib/ingest";
import { requireUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { outreachBlockReason } from "@/lib/suppression";
import { renderDraft } from "@/lib/templates";

export type Draft = { channel: "EMAIL" | "TEXT" | "CALL"; subject: string; body: string; toEmail: string | null; toPhone: string | null; templateName: string };
export type DraftResult = { error?: string; draft?: Draft };

const TRADE_MATERIALS: Record<string, string> = {
  "Concrete Contractor": "ready-mix concrete, fill sand and limerock base",
  "Paving / Driveway": "limerock road base and fill sand",
  "Paver Installer": "limerock base and paver sand",
  "Pool Builder": "fill sand and pea rock",
  Landscaper: "topsoil, gravel and pea rock",
  "Septic / Drainfield": "drainfield rock and fill sand",
  "Site Work / Excavation": "fill sand, limerock and rip rap",
};

const schema = z.object({ companyId: z.string().min(1).max(40), templateId: z.string().min(1).max(40), contactId: z.string().max(40).optional() });

export async function generateDraft(input: { companyId: string; templateId: string; contactId?: string }): Promise<DraftResult> {
  const user = await requireUser();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: zodMessage(parsed.error) };

  // Do-not-contact is enforced here on the server, not just hidden in the UI.
  const blocked = await outreachBlockReason(parsed.data.companyId);
  if (blocked) return { error: blocked };

  const [company, template, settings, assumptions] = await Promise.all([
    db.company.findUnique({ where: { id: parsed.data.companyId }, include: { contacts: true, projects: { orderBy: { issueDate: "desc" }, take: 1 } } }),
    db.outreachTemplate.findFirst({ where: { id: parsed.data.templateId, active: true } }),
    getSettings(),
    loadAssumptions(),
  ]);
  if (!company || !template) return { error: "Lead or template not found." };

  const contact = company.contacts.find((c) => c.id === parsed.data.contactId) ?? company.contacts[0] ?? null;
  const project = company.projects[0] ?? null;
  const material =
    (project && assumptions.find((a) => a.projectType === project.type)?.material.toLowerCase()) ||
    TRADE_MATERIALS[company.trade] ||
    "aggregate and ready-mix concrete";

  const rendered = renderDraft(
    template,
    {
      company_name: company.name,
      contact_name: contact?.name.split(" ")[0] ?? "there",
      project_type: project ? project.type.toLowerCase() : "upcoming",
      jobsite_city: project?.city ?? company.city ?? "South Florida",
      material_suggestions: material,
      sender_name: user.name,
      our_company: settings.company_name,
    },
    { companyName: settings.company_name, businessAddress: settings.business_address },
  );

  return {
    draft: {
      channel: template.channel,
      subject: rendered.subject,
      body: rendered.body,
      toEmail: contact?.email ?? company.email,
      toPhone: contact?.phone ?? company.phone,
      templateName: template.name,
    },
  };
}

/**
 * Optional: rewrites a draft using the lead's project details. Only available when OPENAI_API_KEY is set.
 * Sends the draft text plus company name, trade and project description to OpenAI.
 */
export async function personalizeDraft(input: { companyId: string; subject: string; body: string; channel: string }): Promise<{ error?: string; subject?: string; body?: string }> {
  const user = await requireUser();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { error: "AI personalization is not set up." };
  const parsed = z.object({ companyId: z.string().min(1).max(40), subject: z.string().max(300), body: z.string().min(1).max(6000), channel: z.enum(["EMAIL", "TEXT", "CALL"]) }).safeParse(input);
  if (!parsed.success) return { error: zodMessage(parsed.error) };
  const blocked = await outreachBlockReason(parsed.data.companyId);
  if (blocked) return { error: blocked };
  const company = await db.company.findUnique({ where: { id: parsed.data.companyId }, include: { projects: { orderBy: { issueDate: "desc" }, take: 2 } } });
  if (!company) return { error: "Lead not found." };

  // Keep the compliance footer out of the model's hands and re-attach it unchanged.
  const footerAt = parsed.data.channel === "EMAIL" ? parsed.data.body.lastIndexOf("\n\n--\n") : -1;
  const main = footerAt >= 0 ? parsed.data.body.slice(0, footerAt) : parsed.data.body;
  const footer = footerAt >= 0 ? parsed.data.body.slice(footerAt) : "";
  const projects = company.projects.map((p) => `${p.type} in ${p.city ?? "unknown city"}: ${p.description ?? "no description"}`).join("; ") || "none on file";

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You polish short business-to-business sales messages for a company that delivers aggregate and concrete materials. Keep the message honest, plain and brief. Do not invent prices, discounts, facts or past relationships. Keep roughly the same length. Return only the message text, with no subject line and no signature block beyond what is already there.",
          },
          { role: "user", content: `Recipient company: ${company.name} (${company.trade}).\nTheir recent projects: ${projects}\nChannel: ${parsed.data.channel}\n\nRewrite this message so it reads naturally and refers to their project where it helps:\n\n${main}` },
        ],
      }),
    });
    if (!res.ok) return { error: `The AI service returned an error (HTTP ${res.status}).` };
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const textOut = data.choices?.[0]?.message?.content?.trim();
    if (!textOut) return { error: "The AI service returned an empty reply." };
    await audit(user.id, "outreach.personalize", "Company", company.id);
    return { subject: parsed.data.subject, body: textOut + footer };
  } catch {
    return { error: "Could not reach the AI service." };
  }
}

export async function aiEnabled(): Promise<boolean> {
  await requireUser();
  return Boolean(process.env.OPENAI_API_KEY);
}

