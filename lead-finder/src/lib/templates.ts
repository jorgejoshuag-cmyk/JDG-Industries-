// Outreach template rendering. Pure.

export type TemplateVars = {
  company_name: string;
  contact_name: string;
  project_type: string;
  jobsite_city: string;
  material_suggestions: string;
  sender_name: string;
  our_company: string;
};

export type Sender = { companyName: string; businessAddress: string };

export const OPT_OUT_LINE = "If you would rather not hear from us, reply \"unsubscribe\" and we will not email you again.";
export const TEXT_OPT_OUT = "Reply STOP to opt out.";

export function fillMergeFields(text: string, vars: TemplateVars): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (whole, k: string) =>
    k in vars ? (vars as Record<string, string>)[k] : whole,
  );
}

/** CAN-SPAM footer: sender's physical business address plus a clear opt-out. Always appended to email. */
export function emailFooter(sender: Sender): string {
  const address = sender.businessAddress.trim() || "[ADD YOUR BUSINESS ADDRESS IN ADMIN → SETTINGS BEFORE SENDING]";
  return `\n\n--\n${sender.companyName}\n${address}\n${OPT_OUT_LINE}`;
}

export function renderDraft(
  template: { channel: "EMAIL" | "TEXT" | "CALL"; subject?: string | null; body: string },
  vars: TemplateVars,
  sender: Sender,
): { subject: string; body: string } {
  let body = fillMergeFields(template.body, vars).trim();
  if (template.channel === "EMAIL") body += emailFooter(sender);
  if (template.channel === "TEXT" && !/\bstop\b/i.test(body)) body += ` ${TEXT_OPT_OUT}`;
  return { subject: template.subject ? fillMergeFields(template.subject, vars) : "", body };
}

export function mailtoLink(to: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function smsLink(phoneDigits: string, body: string): string {
  return `sms:+1${phoneDigits}?&body=${encodeURIComponent(body)}`;
}
