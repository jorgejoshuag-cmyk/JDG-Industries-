"use client";

import { useState } from "react";
import { reloadWithFlash } from "./flash";
import { useBusy } from "./useBusy";
import { logActivity } from "@/app/actions/leads";
import { generateDraft, personalizeDraft, type Draft } from "@/app/actions/outreach";
import { mailtoLink, smsLink } from "@/lib/templates";

type Props = {
  companyId: string;
  templates: { id: string; name: string; channel: string }[];
  contacts: { id: string; name: string }[];
  aiEnabled: boolean;
  addressMissing: boolean;
};

const CHANNEL_LABEL: Record<string, string> = { EMAIL: "Email", TEXT: "Text", CALL: "Call script" };

export function OutreachPanel({ companyId, templates, contacts, aiEnabled, addressMissing }: Props) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [contactId, setContactId] = useState(contacts[0]?.id ?? "");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [followUpDays, setFollowUpDays] = useState("3");
  const [message, setMessage] = useState<{ error?: string; ok?: string }>({});
  const [pending, start] = useBusy();

  const generate = () =>
    start(async () => {
      setMessage({});
      const res = await generateDraft({ companyId, templateId, contactId: contactId || undefined });
      if (res.error || !res.draft) return setMessage({ error: res.error ?? "Could not create a draft." });
      setDraft(res.draft);
      setSubject(res.draft.subject);
      setBody(res.draft.body);
    });

  const personalize = () =>
    start(async () => {
      if (!draft) return;
      setMessage({});
      const res = await personalizeDraft({ companyId, subject, body, channel: draft.channel });
      if (res.error || !res.body) return setMessage({ error: res.error ?? "Could not personalize." });
      setBody(res.body);
      setMessage({ ok: "Draft rewritten. Read it carefully before sending." });
    });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(draft?.channel === "EMAIL" && subject ? `Subject: ${subject}\n\n${body}` : body);
      setMessage({ ok: "Copied." });
    } catch {
      setMessage({ error: "Copy failed. Select the text and copy it manually." });
    }
  };

  const logSent = () =>
    start(async () => {
      if (!draft) return;
      const fd = new FormData();
      fd.set("companyId", companyId);
      fd.set("type", draft.channel);
      fd.set("body", `${draft.templateName}${subject ? ` — ${subject}` : ""}\n\n${body}`.slice(0, 3900));
      const days = Math.max(0, Math.min(90, parseInt(followUpDays, 10) || 0));
      if (days > 0) {
        fd.set("followUpDate", new Date(Date.now() + days * 86_400_000).toISOString());
        fd.set("followUpTitle", `Follow up on ${CHANNEL_LABEL[draft.channel].toLowerCase()}`);
      }
      const res = await logActivity({}, fd);
      if (res.ok) return reloadWithFlash(res.ok);
      setMessage(res);
    });

  if (!templates.length) return <p className="muted">No active templates. An admin can add them under Admin → Templates.</p>;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="tpl">Template</label>
          <select id="tpl" className="input" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            {templates.map((t) => <option key={t.id} value={t.id}>{CHANNEL_LABEL[t.channel]} · {t.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="who">Contact</label>
          <select id="who" className="input" value={contactId} onChange={(e) => setContactId(e.target.value)} disabled={!contacts.length}>
            {contacts.length ? contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>) : <option value="">Company main line</option>}
          </select>
        </div>
      </div>
      <button type="button" className="btn" disabled={pending || !templateId} onClick={generate}>{pending && !draft ? "Working…" : draft ? "Regenerate draft" : "Create draft"}</button>

      {draft ? (
        <div className="space-y-3 rounded-lg border border-navy-200 bg-navy-50 p-3">
          {draft.channel === "TEXT" ? (
            <p className="rounded border border-black bg-white px-3 py-2 text-sm">
              <strong>Before you text:</strong> marketing texts need the person&apos;s prior written consent under the TCPA and Florida telemarketing law. Only text people who gave you their number for this purpose or asked for a quote.
            </p>
          ) : null}
          {draft.channel === "EMAIL" && addressMissing ? (
            <p className="rounded border border-black bg-white px-3 py-2 text-sm"><strong>Business address missing.</strong> Commercial email must include your postal address. An admin can set it under Admin → Settings.</p>
          ) : null}
          {draft.channel === "EMAIL" ? (
            <div><label htmlFor="subj">Subject</label><input id="subj" className="input" value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} /></div>
          ) : null}
          <div>
            <label htmlFor="body">{draft.channel === "CALL" ? "Call script" : "Message"} — edit before sending</label>
            <textarea id="body" className="input font-mono text-[13px]" rows={draft.channel === "TEXT" ? 5 : 12} value={body} onChange={(e) => setBody(e.target.value)} />
            {draft.channel === "TEXT" ? <p className="muted mt-1">{body.length} characters</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={copy}>Copy</button>
            {draft.channel === "EMAIL" ? (
              draft.toEmail ? <a className="btn-secondary" href={mailtoLink(draft.toEmail, subject, body)}>Open in email app</a> : <span className="muted self-center">No email address on file</span>
            ) : null}
            {draft.channel === "TEXT" ? (
              draft.toPhone ? <a className="btn-secondary" href={smsLink(draft.toPhone, body)}>Open in messages</a> : <span className="muted self-center">No phone number on file</span>
            ) : null}
            {draft.channel === "CALL" && draft.toPhone ? <a className="btn-secondary" href={`tel:+1${draft.toPhone}`}>Call now</a> : null}
            {aiEnabled && draft.channel !== "CALL" ? <button type="button" className="btn-secondary" disabled={pending} onClick={personalize}>Personalize draft (AI)</button> : null}
          </div>
          <div className="flex flex-wrap items-end gap-2 border-t border-navy-200 pt-3">
            <div>
              <label htmlFor="fu">Follow up in (days)</label>
              <input id="fu" type="number" min={0} max={90} className="input w-28" value={followUpDays} onChange={(e) => setFollowUpDays(e.target.value)} />
            </div>
            <button type="button" className="btn" disabled={pending} onClick={logSent}>{pending ? "Saving…" : draft.channel === "CALL" ? "Log call & schedule follow-up" : "I sent it — log & schedule follow-up"}</button>
          </div>
          <p className="muted">Nothing is sent from this tool. You send each message yourself, one at a time.</p>
        </div>
      ) : null}
      {message.error ? <p role="alert" className="text-sm font-medium">⚠ {message.error}</p> : null}
      {message.ok ? <p role="status" className="text-sm font-medium text-navy-600">✓ {message.ok}</p> : null}
    </div>
  );
}
